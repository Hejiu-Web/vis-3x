/**
 * 验证：固定视角下数据交互（悬停高亮 / 提示框 / 点击）是否仍然可用
 *
 * 这是对文档承诺的直接检验：
 * 「'fixed' 只锁定相机；悬停高亮、点击事件、提示框仍然可用」
 */
import { spawn } from 'node:child_process'
import { launchBrowser } from './lib/browser.mjs'
import { mkdtempSync, writeFileSync, mkdirSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

const CHROME = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe'
const OUT_DIR = 'F:\\hejiu45\\3dcharts\\vis-3x\\.verify'
const PORT = 9413
const userDataDir = mkdtempSync(join(tmpdir(), 'vis3x-data-'))

mkdirSync(OUT_DIR, { recursive: true })

const browser = launchBrowser({ port: PORT, windowSize: '1200,900', tag: 'vis3x-diag' })

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
  send(method, params = {}) {
    const id = ++this.id
    return new Promise((resolve, reject) => {
      this.pending.set(id, { resolve, reject })
      this.ws.send(JSON.stringify({ id, method, params }))
      setTimeout(() => {
        if (this.pending.has(id)) {
          this.pending.delete(id)
          reject(new Error('timeout ' + method))
        }
      }, 40000)
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

/** 建立一个足够大的图表，便于命中 */
const SETUP = `(async () => {
  const mod = await import('/@fs/F:/hejiu45/3dcharts/vis-3x/packages/vis-3x/src/index.ts');
  document.body.innerHTML = '';
  const el = document.createElement('div');
  el.id = '__vt_test';
  el.style.cssText = 'width:900px;height:600px;position:fixed;left:0;top:0;z-index:99999';
  document.body.appendChild(el);

  const events = [];
  const chart = mod.createChart('bar3D', el);
  chart.on('chart:click', (p) => events.push('click:' + p.dataIndex));
  chart.on('chart:mouseover', (p) => events.push('over:' + p.dataIndex));

  chart.setOption({
    xAxis3D: { data: ['A','B','C','D'] },
    yAxis3D: { name: 'v' },
    series: [{ type: 'bar3D', data: [40, 80, 60, 100], barWidth: 1.6, barDepth: 2.4 }],
    controlSettings: { interactionMode: 'fixed' },
  });
  await new Promise(r => setTimeout(r, 1200));

  window.__vtChart = chart;
  window.__vtEvents = events;
  const r = el.querySelector('canvas').getBoundingClientRect();
  return { left:r.left, top:r.top, width:r.width, height:r.height,
           mode: chart.interactionMode, canRotate: chart.engine.controls.enableRotate };
})()`

async function main() {
  const report = {}
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
      width: 1200, height: 900, deviceScaleFactor: 1, mobile: false,
    })
    await cdp.send('Page.navigate', { url: 'http://localhost:5178/' })
    await sleep(9000)

    const setup = await cdp.send('Runtime.evaluate', {
      expression: SETUP, awaitPromise: true, returnByValue: true,
    })
    const rect = setup.result?.value
    report.setup = rect
    if (!rect) throw new Error('初始化失败: ' + JSON.stringify(setup))

    /* ---------- 网格扫描，寻找命中柱子的位置 ---------- */
    // 注意：提示框 DOM 由 Vue 组件渲染，命令式 API 下不存在，
    // 因此以 chart:mouseover 事件作为命中判据。
    let hit = null
    outer: for (let i = 2; i < 26; i++) {
      for (let j = 2; j < 18; j++) {
        const x = Math.round(rect.left + (rect.width * i) / 26)
        const y = Math.round(rect.top + (rect.height * j) / 18)
        await cdp.send('Input.dispatchMouseEvent', { type: 'mouseMoved', x, y })
        await sleep(35)
        const t = await cdp.send('Runtime.evaluate', {
          expression: `window.__vtEvents.some(e => e.startsWith('over:'))`,
          returnByValue: true,
        })
        if (t.result.value) {
          hit = { x, y }
          break outer
        }
      }
    }

    report.hoverHit = hit
    report.hoverEventWorks = !!hit

    /* ---------- 在命中点点击，验证 click 事件 ---------- */
    if (hit) {
      // 完整的按下-抬起序列，CDP 才会合成 click 事件
      await cdp.send('Input.dispatchMouseEvent', {
        type: 'mouseMoved', x: hit.x, y: hit.y,
      })
      await sleep(80)
      await cdp.send('Input.dispatchMouseEvent', {
        type: 'mousePressed', x: hit.x, y: hit.y,
        button: 'left', clickCount: 1, buttons: 1,
      })
      await sleep(60)
      await cdp.send('Input.dispatchMouseEvent', {
        type: 'mouseReleased', x: hit.x, y: hit.y,
        button: 'left', clickCount: 1, buttons: 0,
      })
    }
    await sleep(500)

    const ev = await cdp.send('Runtime.evaluate', {
      expression: `({ events: window.__vtEvents, cam: (()=>{const c=window.__vtChart.engine.camera.position;return +Math.hypot(c.x,c.y,c.z).toFixed(4)})() })`,
      returnByValue: true,
    })
    report.chartEvents = ev.result.value.events
    report.clickWorks = ev.result.value.events.some((e) => e.startsWith('click:'))
    report.cameraRadius = ev.result.value.cam
    report.note =
      '提示框(DOM)由 Vue 组件渲染；命令式 API 下以 chart:mouseover / chart:click 事件验证数据交互'

    writeFileSync(join(OUT_DIR, 'fixed-mode-data.json'), JSON.stringify(report, null, 2))
    console.log(JSON.stringify(report, null, 2))
    ws.close()
  } catch (e) {
    console.error('验证失败:', e.message)
    console.log(JSON.stringify(report, null, 2))
    process.exitCode = 1
  } finally {
    browser.kill()
  }
}

main()
