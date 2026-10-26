/**
 * 定位：OrbitControls 为何收不到指针事件
 *
 * 检查元素层级、事件的 target、以及 OrbitControls 的监听目标。
 */
import { spawn } from 'node:child_process'
import { launchBrowser } from './lib/browser.mjs'
import { mkdtempSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

const CHROME = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe'
const PORT = 9412
const userDataDir = mkdtempSync(join(tmpdir(), 'vis3x-diag-'))

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

const PROBE = `(async () => {
  const mod = await import('/@fs/F:/hejiu45/3dcharts/vis-3x/packages/vis-3x/src/index.ts');
  const el = document.createElement('div');
  el.id = '__vt_test';
  el.style.cssText = 'width:700px;height:500px;position:fixed;left:0;top:0;z-index:99999';
  document.body.appendChild(el);

  const chart = mod.createChart('bar3D', el);
  chart.setOption({
    xAxis3D: { data: ['A','B','C'] },
    series: [{ type: 'bar3D', data: [10, 20, 30] }],
  });
  await new Promise(r => setTimeout(r, 900));
  window.__vtChart = chart;

  // 记录事件真正落到哪个元素
  window.__vtEvents = [];
  const record = (label) => (e) => window.__vtEvents.push(label + '@' + (e.target.tagName || e.target.nodeName));
  document.addEventListener('pointerdown', record('doc:pointerdown'), true);
  el.addEventListener('pointerdown', record('el:pointerdown'), true);

  const canvas = el.querySelector('canvas');
  canvas.addEventListener('pointerdown', record('canvas:pointerdown'), true);
  canvas.addEventListener('wheel', (e) => window.__vtEvents.push('canvas:wheel'), true);

  // 检查各层元素的样式
  const layers = [...el.children].map(c => ({
    tag: c.tagName,
    cls: c.className,
    pointerEvents: getComputedStyle(c).pointerEvents,
    zIndex: getComputedStyle(c).zIndex,
    position: getComputedStyle(c).position,
    w: c.getBoundingClientRect().width,
    h: c.getBoundingClientRect().height,
  }));

  const controls = chart.engine.controls;
  return {
    layers,
    controlsDomElement: controls.domElement ? controls.domElement.tagName + '.' + controls.domElement.className : null,
    controlsDomIsCanvas: controls.domElement === canvas,
    enabled: {
      rotate: controls.enableRotate,
      zoom: controls.enableZoom,
      pan: controls.enablePan,
      damping: controls.enableDamping,
    },
    canvasRect: (() => { const r = canvas.getBoundingClientRect(); return {x:r.x,y:r.y,w:r.width,h:r.height}; })(),
    elementFromCenter: (() => {
      const r = canvas.getBoundingClientRect();
      const e = document.elementFromPoint(r.x + r.width/2, r.y + r.height/2);
      return e ? e.tagName + '.' + e.className : null;
    })(),
  };
})()`

async function main() {
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
    await cdp.send('Page.navigate', { url: 'http://localhost:5178/' })
    await sleep(9000)

    const r = await cdp.send('Runtime.evaluate', {
      expression: PROBE,
      awaitPromise: true,
      returnByValue: true,
    })
    console.log('=== 结构诊断 ===')
    console.log(JSON.stringify(r.result?.value, null, 2))

    // 派发一次真实拖拽，看事件落到哪里
    const rect = r.result.value.canvasRect
    const cx = Math.round(rect.x + rect.w / 2)
    const cy = Math.round(rect.y + rect.h / 2)

    await cdp.send('Input.dispatchMouseEvent', {
      type: 'mousePressed', x: cx, y: cy, button: 'left', clickCount: 1, buttons: 1,
    })
    await sleep(60)
    for (let i = 1; i <= 5; i++) {
      await cdp.send('Input.dispatchMouseEvent', {
        type: 'mouseMoved', x: cx + i * 20, y: cy + i * 8, button: 'left', buttons: 1,
      })
      await sleep(25)
    }
    await cdp.send('Input.dispatchMouseEvent', {
      type: 'mouseReleased', x: cx + 100, y: cy + 40, button: 'left', buttons: 0,
    })
    await sleep(400)

    const ev = await cdp.send('Runtime.evaluate', {
      expression: `({ events: window.__vtEvents, cam: (()=>{const c=window.__vtChart.engine.camera.position;return {x:+c.x.toFixed(4),y:+c.y.toFixed(4),z:+c.z.toFixed(4)};})() })`,
      returnByValue: true,
    })
    console.log('\n=== 事件落点 ===')
    console.log(JSON.stringify(ev.result.value, null, 2))

    ws.close()
  } catch (e) {
    console.error('诊断失败:', e.message)
    process.exitCode = 1
  } finally {
    browser.kill()
  }
}

main()
