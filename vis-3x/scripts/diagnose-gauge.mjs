/**
 * 诊断：仪表盘各元素的实际空间位置
 *
 * 目的：确认环带、刻度、指针、标签分别在哪个平面上。
 * 判断依据是各对象的世界包围盒（BoundingBox）。
 */
import { launchBrowser } from './lib/browser.mjs'
import { mkdtempSync, writeFileSync, mkdirSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

const OUT_DIR = 'F:\\hejiu45\\3dcharts\\vis-3x\\.verify'
const PORT = 9440
mkdirSync(OUT_DIR, { recursive: true })

const browser = launchBrowser({ port: PORT, windowSize: '900,700', tag: 'vis3x-gauge' })
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
  send(method, params = {}, t = 40000) {
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

const PROBE = `(async () => {
  const mod = await import('/@fs/F:/hejiu45/3dcharts/vis-3x/packages/vis-3x/src/index.ts');
  const THREE = await import('/node_modules/three/build/three.module.js');

  document.body.innerHTML = '';
  const el = document.createElement('div');
  el.style.cssText = 'width:700px;height:600px;position:fixed;left:0;top:0';
  document.body.appendChild(el);

  const chart = mod.createChart('gauge3D', el);
  chart.setOption({
    series: [{
      type: 'gauge3D',
      min: 0, max: 100,
      data: [{ value: 73 }],
      radius: 3.4,
      depth: 0.5,
      axisWidth: 0.62,
      splitNumber: 5,
      detail: { show: true },
    }],
    animation: { enabled: false },
  });
  await new Promise(r => setTimeout(r, 1500));

  const summarize = (obj) => {
    const box = new THREE.Box3().setFromObject(obj);
    return {
      name: obj.name || obj.type,
      yType: obj.isMesh ? 'Mesh' : obj.type,
      min: [+box.min.x.toFixed(3), +box.min.y.toFixed(3), +box.min.z.toFixed(3)],
      max: [+box.max.x.toFixed(3), +box.max.y.toFixed(3), +box.max.z.toFixed(3)],
      size: [
        +(box.max.x - box.min.x).toFixed(3),
        +(box.max.y - box.min.y).toFixed(3),
        +(box.max.z - box.min.z).toFixed(3),
      ],
      pos: [+obj.position.x.toFixed(3), +obj.position.y.toFixed(3), +obj.position.z.toFixed(3)],
    };
  };

  const out = { meshes: [], groups: [], labels: [] };

  chart.engine.scene.traverse(o => {
    if (o.name === '__vt_gauge_arc' || o.name === '__vt_gauge_pointer' ||
        o.name === '__vt_gauge_progress' || o.name === '__vt_series') {
      if (o.isMesh) out.meshes.push(summarize(o));
      else out.groups.push(summarize(o));
    }
  });

  // 标签（CSS2D 的锚点对象）
  chart.engine.scene.traverse(o => {
    if (o.isObject3D && !o.isMesh && !o.name.startsWith('__vt_light') &&
        o.parent && o.parent.name === '__vt_series') {
      out.labels.push({
        pos: [+o.position.x.toFixed(3), +o.position.y.toFixed(3), +o.position.z.toFixed(3)],
      });
    }
  });

  chart.dispose();
  return out;
})()`

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
    await cdp.send('Page.navigate', { url: 'http://localhost:5178/' })
    await sleep(9000)

    const r = await cdp.send('Runtime.evaluate', {
      expression: PROBE, awaitPromise: true, returnByValue: true,
    })
    const v = r.result?.value
    writeFileSync(join(OUT_DIR, 'gauge-layout.json'), JSON.stringify(v, null, 2))

    console.log('=== 网格体（环带 / 指针 / 轴帽） ===')
    for (const m of v?.meshes ?? []) {
      console.log(`  ${m.name}`)
      console.log(`    pos=[${m.pos}]  size=[${m.size}]`)
      console.log(`    y范围=${m.min[1]} ~ ${m.max[1]}   z范围=${m.min[2]} ~ ${m.max[2]}`)
    }
    console.log('\n=== 分组 ===')
    for (const g of v?.groups ?? []) {
      console.log(`  ${g.name}  pos=[${g.pos}]  size=[${g.size}]`)
    }
    console.log('\n=== 标签锚点 ===')
    for (const l of v?.labels ?? []) {
      console.log(`  pos=[${l.pos}]`)
    }
    ws.close()
  } catch (e) {
    console.error('诊断失败:', e.message)
    process.exitCode = 1
  } finally {
    browser.kill()
  }
}

main()
