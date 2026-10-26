/**
 * 诊断：柱状图柱子底部是否贴合地面
 *
 * 直接读取每根柱子在世界坐标中的包围盒，检查 bottom（min.y）是否都等于 0。
 * 这是判断「柱子悬空」最直接的证据。
 */
import { spawn } from 'node:child_process'
import { launchBrowser } from './lib/browser.mjs'
import { mkdtempSync, writeFileSync, mkdirSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

const CHROME = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe'
const OUT_DIR = 'F:\\hejiu45\\3dcharts\\vis-3x\\.verify'
const PORT = 9420
const userDataDir = mkdtempSync(join(tmpdir(), 'vis3x-bars-'))

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

const PROBE = `(async () => {
  const mod = await import('/@fs/F:/hejiu45/3dcharts/vis-3x/packages/vis-3x/src/index.ts');
  const THREE = await import('/node_modules/three/build/three.module.js');
  document.body.innerHTML = '';
  const el = document.createElement('div');
  el.style.cssText = 'width:900px;height:600px;position:fixed;left:0;top:0;z-index:99999';
  document.body.appendChild(el);

  const chart = mod.createChart('bar3D', el);
  chart.setOption({
    xAxis3D: { data: ['Q1','Q2','Q3','Q4'] },
    yAxis3D: { name: 's' },
    series: [
      { type: 'bar3D', name: 'A', data: [120, 200, 150, 80] },
      { type: 'bar3D', name: 'B', data: [150, 230, 190, 120] },
    ],
    animation: { enabled: false },
  });
  await new Promise(r => setTimeout(r, 1500));

  const bars = [];
  chart.engine.scene.traverse(o => {
    if (o.name === '__vt_bar' && o.isMesh) {
      // 用官方 Box3 计算世界包围盒（会自动处理 position / scale / matrixWorld）
      const box = new THREE.Box3().setFromObject(o);
      // 几何体局部包围盒
      o.geometry.computeBoundingBox();
      const lb = o.geometry.boundingBox;
      bars.push({
        localMinY: +lb.min.y.toFixed(4),
        localMaxY: +lb.max.y.toFixed(4),
        worldMinY: +box.min.y.toFixed(4),
        worldMaxY: +box.max.y.toFixed(4),
        meshPosY: +o.position.y.toFixed(4),
        scaleY: +o.scale.y.toFixed(4),
      });
    }
  });

  const axis = {
    yDomain: chart.cartesian.yAxis.domain,
    yLength: chart.cartesian.yAxis.length,
    gridHeight: chart.cartesian.config.gridHeight,
    yAt0: +chart.cartesian.yAt(0).toFixed(4),
    yAt120: +chart.cartesian.yAt(120).toFixed(4),
    yAt230: +chart.cartesian.yAt(230).toFixed(4),
  };

  chart.dispose();
  return { axis, bars };
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
      width: 1200, height: 900, deviceScaleFactor: 1, mobile: false,
    })
    await cdp.send('Page.navigate', { url: 'http://localhost:5178/' })
    await sleep(9000)

    const r = await cdp.send('Runtime.evaluate', {
      expression: PROBE, awaitPromise: true, returnByValue: true,
    })

    const v = r.result?.value
    writeFileSync(join(OUT_DIR, 'bar-ground.json'), JSON.stringify(v, null, 2))
    console.log('=== 坐标系 ===')
    console.log(JSON.stringify(v?.axis, null, 2))
    console.log('\n=== 每根柱子（worldMinY 应恒为 0） ===')
    let bad = 0
    for (const b of v?.bars ?? []) {
      const ok = Math.abs(b.worldMinY) < 0.005
      if (!ok) bad++
      console.log(
        `  local=[${String(b.localMinY).padStart(7)}, ${String(b.localMaxY).padStart(7)}]  world=[${String(b.worldMinY).padStart(7)}, ${String(b.worldMaxY).padStart(7)}]  posY=${String(b.meshPosY).padStart(6)}  ${ok ? 'OK' : '<-- 悬空'}` 
      )
    }
    console.log(`\n结论：${bad === 0 ? '全部柱子底部贴合地面 ✓' : bad + ' 根柱子悬空 ✗'}`)
    ws.close()
  } catch (e) {
    console.error('诊断失败:', e.message)
    process.exitCode = 1
  } finally {
    browser.kill()
  }
}

main()
