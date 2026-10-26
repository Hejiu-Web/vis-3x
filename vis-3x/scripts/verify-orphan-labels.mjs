/**
 * 跨图表「图例隐藏后标签残留」回归测试
 *
 * 对每种图表：创建 → 记录标签 → 隐藏系列 → 再记录
 * 判定：隐藏后不应残留任何「纯数字」标签（那说明有孤立标签）
 */
import { launchBrowser } from './lib/browser.mjs'

const PORT = 9730
const browser = launchBrowser({ port: PORT, windowSize: '900,700', tag: 'vx-orphan' })
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
  send(method, params = {}, t = 180000) {
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

const SCRIPT = `(async () => {
  const mod = await import('/@fs/F:/hejiu45/3dcharts/vis-3x/packages/vis-3x/src/index.ts');
  mod.useExtraCharts();

  document.body.innerHTML = '';
  const el = document.createElement('div');
  el.id = 't';
  el.style.cssText = 'width:820px;height:600px;position:fixed;left:0;top:0';
  document.body.appendChild(el);

  const read = () => {
    const out = [];
    el.querySelectorAll('div').forEach((d) => {
      const t = (d.textContent || '').trim();
      if (!t) return;
      if (d.children.length > 0) return;
      const r = d.getBoundingClientRect();
      if (r.width === 0 && r.height === 0) return;
      out.push({ text: t.slice(0, 12), x: Math.round(r.x), y: Math.round(r.y) });
    });
    return out;
  };

  const CASES = [
    ['bar3D', { xAxis3D:{data:['A','B','C']}, yAxis3D:{name:'值'}, series:[{type:'bar3D',name:'S',data:[30,60,45],label:{show:true}}] }],
    ['line3D', { xAxis3D:{data:['A','B','C']}, series:[{type:'line3D',name:'S',data:[10,40,25],label:{show:true}}] }],
    ['area3D', { xAxis3D:{data:['A','B','C']}, series:[{type:'area3D',name:'S',data:[10,40,25]}] }],
    ['scatter3D', { xAxis3D:{type:'value',min:0,max:10}, zAxis3D:{type:'value',min:0,max:10}, series:[{type:'scatter3D',name:'S',data:[[1,20,2],[5,60,6]]}] }],
    ['pie3D', { showCoordinate:false, series:[{type:'pie3D',name:'S',data:[{value:30,name:'A'},{value:50,name:'B'}]}] }],
    ['radar3D', { showCoordinate:false, radar:{indicator:[{name:'a',max:100},{name:'b',max:100},{name:'c',max:100}]}, series:[{type:'radar3D',name:'S',data:[{value:[80,60,70],name:'S'}]}] }],
    ['funnel3D', { showCoordinate:false, series:[{type:'funnel3D',name:'S',data:[{value:100,name:'A'},{value:60,name:'B'},{value:30,name:'C'}]}] }],
    ['gauge3D', { showCoordinate:false, series:[{type:'gauge3D',name:'S',min:0,max:100,data:[{value:73}],detail:{show:true}}] }],
    ['heatmap3D', { xAxis3D:{data:['a','b']}, zAxis3D:{data:['x','y']}, series:[{type:'heatmap3D',name:'S',data:[[0,0,10],[1,0,40],[0,1,25],[1,1,55]]}] }],
    ['lollipop3D', { xAxis3D:{data:['A','B','C']}, series:[{type:'lollipop3D',name:'S',data:[30,60,45]}] }],
  ];

  const results = [];
  for (const [type, base] of CASES) {
    const rec = { type };
    try {
      const chart = mod.createChart(type, el);
      chart.setOption(Object.assign({ animation: { enabled: false }, theme: mod.themes.dark }, base));
      await new Promise(r => setTimeout(r, 900));
      rec.before = read().length;

      // 隐藏全部系列
      const hidden = JSON.parse(JSON.stringify(base));
      hidden.series = base.series.map(s => Object.assign({}, s, { visible: false }));
      chart.setOption(Object.assign({ animation: { enabled: false }, theme: mod.themes.dark }, hidden));
      await new Promise(r => setTimeout(r, 900));

      const after = read();
      rec.after = after.length;
      // 孤立标签的特征是失去锚点后落在容器左上角；坐标轴刻度在绘图区内，不算\n      rec.orphans = after.filter(l => l.x < 130 && l.y < 130 && /^[\d.]+%?$/.test(l.text));
      rec.ok = rec.orphans.length === 0;

      chart.dispose();
      el.innerHTML = '';
      await new Promise(r => setTimeout(r, 200));
    } catch (e) {
      rec.error = String((e && e.message) || e);
      rec.ok = false;
    }
    results.push(rec);
  }
  return results;
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
      expression: SCRIPT,
      awaitPromise: true,
      returnByValue: true,
    })
    if (r.exceptionDetails) {
      console.log('异常:', r.exceptionDetails.exception?.description?.slice(0, 400))
      return
    }

    const rows = r.result?.value ?? []
    console.log('=== 图例隐藏后的标签残留检查 ===')
    console.log('  图表'.padEnd(16) + '隐藏前  隐藏后  残留数字')
    console.log('  ' + '-'.repeat(46))
    let bad = 0
    for (const x of rows) {
      if (!x.ok) bad++
      console.log(
        '  ' +
          x.type.padEnd(14) +
          String(x.before ?? '?').padStart(6) +
          String(x.after ?? '?').padStart(8) +
          '  ' +
          (x.orphans?.length ? JSON.stringify(x.orphans) : '无') +
          (x.error ? '  ★ ' + x.error.slice(0, 40) : x.ok ? '  ✓' : '  ★')
      )
    }
    console.log(`\n  失败: ${bad} / ${rows.length}`)
    console.log('  页面异常:', cdp.errors.length)
    ws.close()
  } catch (e) {
    console.error('FAIL', e.message)
    process.exitCode = 1
  } finally {
    browser.kill()
  }
}

main()
