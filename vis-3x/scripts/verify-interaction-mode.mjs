/**
 * 交互模式验证（使用 CDP 原生输入事件）
 *
 * 关键点：JS 合成的 PointerEvent 无法驱动 OrbitControls
 * （它依赖 setPointerCapture 等真实指针状态），
 * 因此这里用 CDP 的 Input.dispatchMouseEvent 注入**真实**鼠标事件。
 *
 * 验证内容：
 * 1. free   — 拖拽可旋转 + 滚轮可缩放
 * 2. rotate — 拖拽可旋转 + 滚轮不可缩放
 * 3. fixed  — 拖拽不可旋转 + 滚轮不可缩放
 * 4. 显式字段覆盖模式默认值
 * 5. 固定视角下数据交互（悬停/提示框）仍可用
 */
import { spawn } from 'node:child_process'
import { launchBrowser } from './lib/browser.mjs'
import { mkdtempSync, writeFileSync, mkdirSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

const CHROME = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe'
const URL_TARGET = process.argv[2] ?? 'http://localhost:5178/'
const OUT_DIR = 'F:\\hejiu45\\3dcharts\\vis-3x\\.verify'
const PORT = 9411
const userDataDir = mkdtempSync(join(tmpdir(), 'vis3x-native-'))

mkdirSync(OUT_DIR, { recursive: true })

const browser = launchBrowser({ port: PORT, windowSize: '1200,900', tag: 'vis3x-diag' })

const sleep = (ms) => new Promise((r) => setTimeout(r, ms))

class CDP {
  constructor(ws) {
    this.ws = ws
    this.id = 0
    this.pending = new Map()
    this.errors = []
    ws.addEventListener('message', (e) => {
      const m = JSON.parse(e.data)
      if (m.id && this.pending.has(m.id)) {
        const { resolve, reject } = this.pending.get(m.id)
        this.pending.delete(m.id)
        m.error ? reject(new Error(JSON.stringify(m.error))) : resolve(m.result)
        return
      }
      if (m.method === 'Runtime.exceptionThrown') {
        this.errors.push(
          m.params.exceptionDetails?.exception?.description ??
            m.params.exceptionDetails?.text
        )
      }
    })
  }
  send(method, params = {}) {
    const id = ++this.id
    return new Promise((resolve, reject) => {
      this.pending.set(id, { resolve, reject })
      this.ws.send(JSON.stringify({ id, method, params }))
      setTimeout(() => {
        if (this.pending.has(id)) {
          this.pending.delete(id)
          reject(new Error(`timeout ${method}`))
        }
      }, 45000)
    })
  }
}

async function waitForEndpoint() {
  for (let i = 0; i < 90; i++) {
    try {
      const r = await fetch(`http://127.0.0.1:${PORT}/json/version`)
      if (r.ok) return
    } catch {
      /* retry */
    }
    await sleep(400)
  }
  throw new Error('CDP 未就绪')
}

/** 在页面内建立测试图表，并暴露操作句柄 */
const SETUP = `(async () => {
  const mod = await import('/@fs/F:/hejiu45/3dcharts/vis-3x/packages/vis-3x/src/index.ts');
  const el = document.createElement('div');
  el.id = '__vt_test';
  el.style.cssText = 'width:700px;height:500px;position:fixed;left:0;top:0;z-index:99999';
  document.body.appendChild(el);

  const chart = mod.createChart('bar3D', el);
  chart.setOption({
    xAxis3D: { data: ['A','B','C','D'] },
    yAxis3D: { name: 'v' },
    theme: { backgroundColor: '#0a0f1c' },
    series: [{ type: 'bar3D', data: [10, 20, 30, 40] }],
  });
  await new Promise(r => setTimeout(r, 1000));

  window.__vtChart = chart;
  window.__vtRect = el.querySelector('canvas').getBoundingClientRect();
  return { ok: true, rect: {
    left: window.__vtRect.left, top: window.__vtRect.top,
    width: window.__vtRect.width, height: window.__vtRect.height
  }};
})()`

/** 读取当前相机位置 */
const CAM = `(() => {
  const c = window.__vtChart.engine.camera.position;
  return { x: +c.x.toFixed(5), y: +c.y.toFixed(5), z: +c.z.toFixed(5) };
})()`

async function main() {
  const report = { results: [], errors: [] }
  try {
    await waitForEndpoint()
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
      width: 1200,
      height: 900,
      deviceScaleFactor: 1,
      mobile: false,
    })
    await cdp.send('Page.navigate', { url: URL_TARGET })
    await sleep(9000)

    const setup = await cdp.send('Runtime.evaluate', {
      expression: SETUP,
      awaitPromise: true,
      returnByValue: true,
    })
    const rect = setup.result?.value?.rect
    if (!rect) throw new Error('图表初始化失败: ' + JSON.stringify(setup))

    const cx = Math.round(rect.left + rect.width / 2)
    const cy = Math.round(rect.top + rect.height / 2)

    /** 读取相机位置 */
    const cam = async () => {
      const r = await cdp.send('Runtime.evaluate', {
        expression: CAM,
        returnByValue: true,
      })
      return r.result.value
    }

    /** 用 CDP 原生事件拖拽 */
    const nativeDrag = async () => {
      await cdp.send('Input.dispatchMouseEvent', {
        type: 'mousePressed', x: cx, y: cy, button: 'left', clickCount: 1, buttons: 1,
      })
      await sleep(50)
      for (let i = 1; i <= 12; i++) {
        await cdp.send('Input.dispatchMouseEvent', {
          type: 'mouseMoved', x: cx + i * 14, y: cy + i * 5,
          button: 'left', buttons: 1,
        })
        await sleep(22)
      }
      await cdp.send('Input.dispatchMouseEvent', {
        type: 'mouseReleased', x: cx + 168, y: cy + 60, button: 'left', buttons: 0,
      })
      await sleep(450)
    }

    /** 用 CDP 原生事件滚轮 */
    const nativeWheel = async () => {
      await cdp.send('Input.dispatchMouseEvent', {
        type: 'mouseWheel', x: cx, y: cy, deltaX: 0, deltaY: -300,
      })
      await sleep(450)
    }

    /** 设定模式并复位视角 */
    const setMode = async (mode, reset = true) => {
      await cdp.send('Runtime.evaluate', {
        expression: `window.__vtChart.setInteractionMode('${mode}')`,
        returnByValue: true,
      })
      if (reset) {
        await cdp.send('Runtime.evaluate', {
          expression: `window.__vtChart.engine.resetCamera({ x: 1, y: 1.15, z: 1 })`,
          returnByValue: true,
        })
      }
      await sleep(500)
    }

    const dist = (a, b) => +Math.hypot(a.x - b.x, a.y - b.y, a.z - b.z).toFixed(5)

    /* ------------------ 逐一验证三种模式 ------------------ */
    for (const mode of ['free', 'rotate', 'fixed']) {
      await setMode(mode)

      const before = await cam()
      await nativeDrag()
      const afterDrag = await cam()
      await nativeWheel()
      const afterWheel = await cam()

      const state = await cdp.send('Runtime.evaluate', {
        expression: `({
          rotate: window.__vtChart.engine.controls.enableRotate,
          zoom: window.__vtChart.engine.controls.enableZoom,
          pan: window.__vtChart.engine.controls.enablePan,
          reportedMode: window.__vtChart.interactionMode,
          interactive: window.__vtChart.isCameraInteractive,
          cursor: getComputedStyle(document.querySelector('#__vt_test canvas')).cursor,
        })`,
        returnByValue: true,
      })

      report.results.push({
        mode,
        ...state.result.value,
        rotateDelta: dist(before, afterDrag),
        zoomDelta: dist(afterDrag, afterWheel),
      })
    }

    /* ------------------ 显式字段覆盖模式 ------------------ */
    await cdp.send('Runtime.evaluate', {
      expression: `(() => {
        const c = window.__vtChart;
        c.setOption({
          xAxis3D: { data: ['A','B'] },
          series: [{ type: 'bar3D', data: [1,2] }],
          controlSettings: { interactionMode: 'fixed', enableZoom: true },
        });
      })()`,
      returnByValue: true,
    })
    await sleep(600)
    const override = await cdp.send('Runtime.evaluate', {
      expression: `({
        rotate: window.__vtChart.engine.controls.enableRotate,
        zoom: window.__vtChart.engine.controls.enableZoom,
        pan: window.__vtChart.engine.controls.enablePan,
      })`,
      returnByValue: true,
    })
    report.explicitOverride = override.result.value

    /* ------------------ 固定视角下数据交互 ------------------ */
    await setMode('fixed', false)
    let hovered = false
    for (let i = 2; i < 18 && !hovered; i++) {
      for (let j = 2; j < 12 && !hovered; j++) {
        const x = Math.round(rect.left + (rect.width * i) / 18)
        const y = Math.round(rect.top + (rect.height * j) / 12)
        await cdp.send('Input.dispatchMouseEvent', { type: 'mouseMoved', x, y })
        await sleep(40)
        const t = await cdp.send('Runtime.evaluate', {
          expression: `(() => {
            const tip = document.querySelector('#__vt_test .vt-tooltip');
            if (!tip) return '';
            const st = getComputedStyle(tip);
            return (st.display !== 'none' && tip.textContent.trim()) ? tip.textContent.trim() : '';
          })()`,
          returnByValue: true,
        })
        if (t.result.value) {
          hovered = true
          report.fixedModeTooltip = t.result.value
        }
      }
    }
    report.fixedModeDataInteraction = hovered

    /* ------------------ 图表组件 prop 形式 ------------------ */
    report.cdpErrors = cdp.errors
    writeFileSync(
      join(OUT_DIR, 'interaction-mode-report.json'),
      JSON.stringify(report, null, 2)
    )
    console.log(JSON.stringify(report, null, 2))
    ws.close()
  } catch (e) {
    console.error('验证失败:', e.message)
    report.errors.push(e.message)
    console.log(JSON.stringify(report, null, 2))
    process.exitCode = 1
  } finally {
    browser.kill()
  }
}

main()
