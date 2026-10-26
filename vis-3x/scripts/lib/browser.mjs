/**
 * 验证脚本的浏览器启动工具
 *
 * 设计原则（重要）：
 * 1. **绝不按映像名杀进程**。
 *    早期版本在收尾时调用 `taskkill /F /IM chrome.exe`，
 *    这会杀掉用户自己打开的所有 Chrome 窗口 —— 这是错误的。
 *    现在只通过 spawn 返回的句柄终止**本脚本启动的**那一个进程。
 *
 * 2. **独立 user-data-dir**。
 *    每个实例使用独立的临时目录，与用户日常浏览器的 profile 完全隔离，
 *    不会互相干扰，也不会继承用户的登录状态。
 *
 * 3. **端口占用检测**。
 *    若调试端口已被占用，说明上一次的实例可能没退干净，
 *    这时直接报错退出，而不是去杀进程。
 */
import { spawn } from 'node:child_process'
import { existsSync, mkdtempSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

/** 常见的 Chrome / Edge 安装路径 */
const BROWSER_CANDIDATES = [
  'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
  'C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe',
  `${process.env.LOCALAPPDATA ?? ''}\\Google\\Chrome\\Application\\chrome.exe`,
  'C:\\Program Files\\Microsoft\\Edge\\Application\\msedge.exe',
  'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe',
]

/**
 * 找到可用的浏览器可执行文件
 *
 * 可用环境变量 `VIS3X_CHROME` 覆盖。
 */
export function findBrowser() {
  const override = process.env.VIS3X_CHROME
  if (override && existsSync(override)) return override
  for (const p of BROWSER_CANDIDATES) {
    if (p && existsSync(p)) return p
  }
  throw new Error(
    '未找到 Chrome / Edge。请安装，或设置环境变量 VIS3X_CHROME 指向可执行文件。'
  )
}

/**
 * 启动一个隔离的 headless 浏览器实例
 *
 * @param {object} options
 * @param {number} options.port          远程调试端口
 * @param {string} [options.browserPath] 浏览器可执行文件路径
 * @param {string} [options.windowSize]  窗口尺寸，如 '1440x1100'
 * @param {string} [options.tag]         临时目录前缀（便于识别）
 * @returns {{ proc: import('node:child_process').ChildProcess, kill: () => void, userDataDir: string }}
 */
export function launchBrowser(options) {
  const {
    port,
    browserPath = findBrowser(),
    windowSize = '1440,1100',
    tag = 'vis3x',
  } = options

  // 每个实例独立的 profile 目录，不与用户浏览器共享
  const userDataDir = mkdtempSync(join(tmpdir(), `${tag}-`))

  const proc = spawn(
    browserPath,
    [
      '--headless=new',
      `--remote-debugging-port=${port}`,
      `--user-data-dir=${userDataDir}`,
      '--use-gl=angle',
      '--use-angle=swiftshader',
      '--enable-unsafe-swiftshader',
      '--no-first-run',
      '--no-default-browser-check',
      '--disable-extensions',
      '--hide-scrollbars',
      `--window-size=${windowSize}`,
      'about:blank',
    ],
    { stdio: 'ignore' }
  )

  /** 只终止本脚本启动的这一个进程，绝不影响其他浏览器 */
  const kill = () => {
    if (!proc.killed) {
      try {
        proc.kill('SIGKILL')
      } catch {
        /* 进程可能已退出 */
      }
    }
  }

  return { proc, kill, userDataDir }
}

/** 等待 CDP HTTP 端点就绪 */
export async function waitForEndpoint(port, timeoutMs = 36000) {
  const deadline = Date.now() + timeoutMs
  const sleep = (ms) => new Promise((r) => setTimeout(r, ms))
  while (Date.now() < deadline) {
    try {
      const res = await fetch(`http://127.0.0.1:${port}/json/version`)
      if (res.ok) return await res.json()
    } catch {
      /* 尚未启动 */
    }
    await sleep(400)
  }
  throw new Error(
    `CDP 端点未就绪（端口 ${port}）。` +
      `若该端口被占用，请先手动结束上一次遗留的调试实例，脚本不会替你杀进程。`
  )
}

/**
 * 极简 CDP 客户端
 */
export class CDP {
  constructor(ws) {
    this.ws = ws
    this.id = 0
    this.pending = new Map()
    this.errors = []
    this.warnings = []
    ws.addEventListener('message', (e) => {
      const m = JSON.parse(e.data)
      if (m.id && this.pending.has(m.id)) {
        const { resolve, reject } = this.pending.get(m.id)
        this.pending.delete(m.id)
        if (m.error) reject(new Error(JSON.stringify(m.error)))
        else resolve(m.result)
        return
      }
      if (m.method === 'Runtime.exceptionThrown') {
        this.errors.push(
          m.params.exceptionDetails?.exception?.description ??
            m.params.exceptionDetails?.text
        )
      }
      if (m.method === 'Runtime.consoleAPICalled') {
        const text = (m.params.args ?? [])
          .map((a) => a.value ?? a.description ?? '')
          .join(' ')
        if (m.params.type === 'error') this.errors.push(text)
        else if (m.params.type === 'warning') this.warnings.push(text)
      }
    })
  }

  send(method, params = {}, timeoutMs = 45000) {
    const id = ++this.id
    return new Promise((resolve, reject) => {
      this.pending.set(id, { resolve, reject })
      this.ws.send(JSON.stringify({ id, method, params }))
      setTimeout(() => {
        if (this.pending.has(id)) {
          this.pending.delete(id)
          reject(new Error(`CDP 调用超时: ${method}`))
        }
      }, timeoutMs)
    })
  }
}

/** 连接到一个新标签页 */
export async function connect(port, url) {
  const tab = await fetch(
    `http://127.0.0.1:${port}/json/new?${encodeURIComponent(url ?? 'about:blank')}`,
    { method: 'PUT' }
  ).then((r) => r.json())

  const ws = new WebSocket(tab.webSocketDebuggerUrl)
  await new Promise((resolve, reject) => {
    ws.addEventListener('open', resolve)
    ws.addEventListener('error', reject)
  })
  return { cdp: new CDP(ws), ws }
}

export const sleep = (ms) => new Promise((r) => setTimeout(r, ms))
