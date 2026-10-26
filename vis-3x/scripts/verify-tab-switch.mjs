/**
 * 验证 code-group 标签切换是否真的生效
 *
 * VitePress 的实现是 radio + label，可见性由 CSS 控制
 * （不是 inline style.display），所以要用 offsetParent 判断可见块。
 */
import { launchBrowser } from './lib/browser.mjs'

const PORT = 9692
const BASE = 'http://localhost:5300'
const browser = launchBrowser({ port: PORT, windowSize: '1400,900', tag: 'vx-switch' })
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))

class CDP {
  constructor(ws) {
    this.ws = ws
    this.id = 0
    this.pending = new Map()
    ws.addEventListener('message', (e) => {
      const m = JSON.parse(e.data)
      if (m.id && this.pending.has(m.id)) {
        const { resolve, reject } = this.pending.get(m.id)
        this.pending.delete(m.id)
        m.error ? reject(new Error(JSON.stringify(m.error))) : resolve(m.result)
      }
    })
  }
  send(method, params = {}, t = 120000) {
    const id = ++this.id
    return new Promise((resolve, reject) => {
      this.pending.set(id, { resolve, reject })
      this.ws.send(JSON.stringify({ id, method, params }))
      setTimeout(() => {
        if (this.pending.has(id)) {
          this.pending.delete(id)
          reject(new Error('timeout ' + method))
        }
      }, t)
    })
  }
}

async function waitForEndpoint(port) {
  for (let i = 0; i < 90; i++) {
    try {
      const r = await fetch(`http://127.0.0.1:${port}/json/version`)
      if (r.ok) return
    } catch {
      /* retry */
    }
    await sleep(400)
  }
  throw new Error('CDP 未就绪')
}

/** 读取第一个 code-group 的当前可见块文本 */
const READ = `(() => {
  const g = document.querySelector('.vitepress-code-group, .vp-code-group');
  if (!g) return { none: true };
  const blocks = [...g.querySelectorAll('.blocks > div')];
  const visible = blocks.filter(b => b.offsetParent !== null);
  const checked = g.querySelector('.tabs input:checked');
  const checkedLabel = checked
    ? g.querySelector('.tabs label[for="' + checked.id + '"]')?.textContent?.trim()
    : null;
  return {
    checkedLabel,
    visibleCount: visible.length,
    text: (visible[0]?.textContent || '').slice(0, 90).replace(/\\s+/g, ' '),
    labels: [...g.querySelectorAll('.tabs label')].map(l => l.textContent.trim()),
  };
})()`

const PAGES = [
  '/charts/bar',
  '/charts/surface',
  '/charts/lollipop',
  '/guide/javascript',
  '/guide/usage-modes',
  '/custom/extend-chart',
]

async function main() {
  try {
    await waitForEndpoint(PORT)
    const tab = await fetch(
      `http://127.0.0.1:${PORT}/json/new?${encodeURIComponent('about:blank')}`,
      { method: 'PUT' }
    ).then((r) => r.json())
    const ws = new WebSocket(tab.webSocketDebuggerUrl)
    await new Promise((res, rej) => {
      ws.addEventListener('open', res)
      ws.addEventListener('error', rej)
    })
    const cdp = new CDP(ws)
    await cdp.send('Runtime.enable')
    await cdp.send('Page.enable')
    await cdp.send('Emulation.setDeviceMetricsOverride', {
      width: 1400,
      height: 900,
      deviceScaleFactor: 1,
      mobile: false,
    })

    console.log('=== 标签切换验证 ===')

    for (const path of PAGES) {
      await cdp.send('Page.navigate', { url: BASE + path })
      await sleep(4000)

      const before = await cdp.send('Runtime.evaluate', {
        expression: READ,
        returnByValue: true,
      })
      const b = before.result?.value ?? {}

      // 点击 JavaScript 标签
      await cdp.send('Runtime.evaluate', {
        expression: `(() => {
          const g = document.querySelector('.vp-code-group');
          const label = [...g.querySelectorAll('.tabs label')]
            .find(l => /JavaScript/i.test(l.textContent));
          if (label) label.click();
        })()`,
      })
      await sleep(500)

      const after = await cdp.send('Runtime.evaluate', {
        expression: READ,
        returnByValue: true,
      })
      const a = after.result?.value ?? {}

      const changed = b.text !== a.text
      const isJs = /纯 JavaScript|去掉类型|const option =|const \w+ =/.test(a.text)
      console.log(`\n  ${path}`)
      console.log(`    默认标签 : ${b.checkedLabel}  -> ${b.text.slice(0, 55)}`)
      console.log(`    切换后   : ${a.checkedLabel}  -> ${a.text.slice(0, 55)}`)
      console.log(
        `    内容变化 : ${changed ? '✓' : '★ 未变化'}   是 JS 版: ${isJs ? '✓' : '?'}   可见块数: ${a.visibleCount}`
      )
    }
    ws.close()
  } catch (e) {
    console.error('FAIL', e.message)
    process.exitCode = 1
  } finally {
    browser.kill()
  }
}

main()
