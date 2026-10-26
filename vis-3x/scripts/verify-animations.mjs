/**
 * 动画专项验证
 *
 * 验证要点：
 * 1. 首次入场：动画期间对象在变化（采样多个时间点）
 * 2. 动画收敛：结束后达到终态
 * 3. 数据更新：同样有过渡动画（这是之前缺失的能力）
 * 4. 所有 10 种图表都具备动画
 */
import { launchBrowser } from './lib/browser.mjs'
import { mkdirSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'

const OUT_DIR = 'F:\\hejiu45\\3dcharts\\vis-3x\\.verify'
const PORT = 9450
mkdirSync(OUT_DIR, { recursive: true })

const browser = launchBrowser({ port: PORT, windowSize: '1000,800', tag: 'vis3x-anim' })
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
  send(method, params = {}, t = 240000) {
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

/**
 * 页面内探针
 *
 * 对每种图表：
 * 1. 创建图表，立即采样「动画中」的状态
 * 2. 等动画结束后采样「终态」
 * 3. 更新数据，再采样「更新动画中」的状态
 */
const PROBE = `(async () => {
  const mod = await import('/@fs/F:/hejiu45/3dcharts/vis-3x/packages/vis-3x/src/index.ts');
  mod.useExtraCharts();

  /** 各图表的测试配置 */
  const CASES = [
    { type: 'bar3D', option: { xAxis3D:{data:['A','B','C']}, series:[{type:'bar3D',data:[30,60,45]}] } },
    { type: 'line3D', option: { xAxis3D:{data:['A','B','C','D']}, series:[{type:'line3D',data:[10,40,25,55]}] } },
    { type: 'area3D', option: { xAxis3D:{data:['A','B','C','D']}, series:[{type:'area3D',data:[10,40,25,55]}] } },
    { type: 'scatter3D', option: { xAxis3D:{data:['A','B','C']}, series:[{type:'scatter3D',data:[20,50,35]}] } },
    { type: 'surface3D', option: { series:[{type:'surface3D',data:[[1,2,3],[4,5,6],[7,8,9]]}] } },
    { type: 'pie3D', option: { showCoordinate:false, series:[{type:'pie3D',data:[{value:30,name:'A'},{value:50,name:'B'}]}] } },
    { type: 'radar3D', option: { showCoordinate:false, radar:{indicator:[{name:'a',max:100},{name:'b',max:100},{name:'c',max:100}]}, series:[{type:'radar3D',data:[{value:[80,60,70]}]}] } },
    { type: 'funnel3D', option: { showCoordinate:false, series:[{type:'funnel3D',data:[{value:100,name:'A'},{value:60,name:'B'},{value:30,name:'C'}]}] } },
    { type: 'gauge3D', option: { showCoordinate:false, series:[{type:'gauge3D',data:[{value:65}],min:0,max:100}] } },
    { type: 'heatmap3D', option: { xAxis3D:{data:['a','b']}, zAxis3D:{data:['x','y']}, series:[{type:'heatmap3D',data:[[0,0,10],[1,0,40],[0,1,25],[1,1,55]]}] } },
    { type: 'lollipop3D', option: { xAxis3D:{data:['A','B','C']}, series:[{type:'lollipop3D',data:[30,60,45]}] } },
    { type: 'bubble3D', option: { xAxis3D:{type:'value',min:-5,max:5}, zAxis3D:{type:'value',min:-5,max:5}, series:[{type:'bubble3D',data:[[0,30,0],[2,60,1],[-2,45,-1]]}] } },
  ];

  /**
   * 采集渲染画面指纹
   *
   * 直接对 canvas 采样像素并做哈希 —— 比检查对象属性更贴近
   * 「用户看到的动画」。任何视觉变化都会被捕捉到，
   * 也不依赖 mesh 命名。
   */
  const snapshot = (el) => {
    const canvas = el.querySelector('canvas');
    if (!canvas) return 'no-canvas';
    const off = document.createElement('canvas');
    off.width = 60; off.height = 40;
    const ctx = off.getContext('2d');
    ctx.drawImage(canvas, 0, 0, 60, 40);
    const d = ctx.getImageData(0, 0, 60, 40).data;
    // 简单哈希：采样每个像素的 RGB
    let h = 0;
    for (let i = 0; i < d.length; i += 4) {
      h = (h * 31 + d[i] * 7 + d[i+1] * 13 + d[i+2] * 17) | 0;
    }
    return String(h);
  };

  const results = [];

  for (const c of CASES) {
    const el = document.createElement('div');
    el.style.cssText = 'width:600px;height:400px;position:fixed;left:0;top:0;z-index:9999';
    document.body.appendChild(el);

    const entry = { type: c.type, ok: false };
    try {
      const chart = mod.createChart(c.type, el);

      const baseOption = {
        ...c.option,
        animation: { enabled: true, duration: 1200, easing: 'cubicOut', stagger: 40 },
      };

      chart.setOption(baseOption);

      // 采样：动画早期
      await new Promise(r => setTimeout(r, 150));
      const early = snapshot(el);

      // 采样：动画中段
      await new Promise(r => setTimeout(r, 400));
      const mid = snapshot(el);

      // 等待动画结束
      await new Promise(r => setTimeout(r, 1600));
      const settled = snapshot(el);

      entry.initialAnimates = early !== mid || mid !== settled;
      entry.settledHash = settled;

      // 数据更新：应再次产生过渡动画
      const updated = JSON.parse(JSON.stringify(c.option));
      if (updated.series && updated.series[0]) {
        const d0 = updated.series[0].data;
        if (Array.isArray(d0)) {
          updated.series[0].data = d0.map((d, idx) => {
            // 数字：直接放大
            if (typeof d === 'number') return d * 1.8;
            // 数字数组（散点/气泡的 [x,y,z]）：放大数值分量
            if (Array.isArray(d)) {
              return d.map((v, i) =>
                typeof v === 'number' ? (i === 0 || i === 2 ? v : v * 1.8) : v
              );
            }
            // 对象（{value,name}）：放大 value
            if (d && typeof d === 'object' && typeof d.value === 'number') {
              return { ...d, value: d.value * 1.8 };
            }
            if (d && typeof d === 'object' && Array.isArray(d.value)) {
              return { ...d, value: d.value.map((v, i) => (i === 0 ? v : v * 1.8)) };
            }
            // 嵌套矩阵（曲面/地形）
            return d;
          });
        }
      }
      // 曲面/地形类：整体放大矩阵
      if (updated.series && updated.series[0] && Array.isArray(updated.series[0].data)) {
        const first = updated.series[0].data[0];
        if (Array.isArray(first)) {
          updated.series[0].data = updated.series[0].data.map((row) =>
            Array.isArray(row) ? row.map((v) => (typeof v === 'number' ? v * 1.8 : v)) : row
          );
        }
      }
      chart.setOption({
        ...updated,
        animation: { enabled: true, duration: 900, easing: 'quadraticOut' },
      });

      await new Promise(r => setTimeout(r, 120));
      const updEarly = snapshot(el);
      await new Promise(r => setTimeout(r, 1500));
      const updSettled = snapshot(el);

      entry.updateAnimates = updEarly !== updSettled;

      chart.dispose();
      entry.ok = true;
    } catch (e) {
      entry.error = String((e && e.message) || e);
    }
    results.push(entry);
  }

  return { results };
})()`

async function main() {
  const report = { results: [], errors: [] }
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

    const v = r.result?.value ?? {}
    report.results = v.results ?? []
    report.errors = cdp.errors

    console.log('=== 动画验证结果 ===')
    console.log(
      '  图表'.padEnd(16) + '入场动画  更新动画  状态'
    )
    console.log('  ' + '-'.repeat(50))
    for (const x of report.results) {
      const a = x.initialAnimates ? '  ✓  ' : '  ✗  '
      const b = x.updateAnimates ? '  ✓  ' : '  ✗  '
      const st = x.ok ? '' : ' 错误: ' + (x.error ?? '')
      console.log(`  ${x.type.padEnd(14)}${a}     ${b}   ${st}`)
    }
    const pass = report.results.filter((x) => x.ok && x.initialAnimates && x.updateAnimates).length
    console.log(`\n  通过 ${pass}/${report.results.length}`)
    if (report.errors.length) {
      console.log('\n  页面错误:')
      report.errors.slice(0, 5).forEach((e) => console.log('    - ' + String(e).slice(0, 200)))
    }

    writeFileSync(join(OUT_DIR, 'animation-report.json'), JSON.stringify(report, null, 2))
    ws.close()
  } catch (e) {
    console.error('验证失败:', e.message)
    process.exitCode = 1
  } finally {
    browser.kill()
  }
}

main()
