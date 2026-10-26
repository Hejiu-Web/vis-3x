/**
 * 专项诊断：barLine3D（extendChart 生成的类型）渲染链路。
 *
 * 在真实浏览器中加载库源码，逐步验证：
 * 1. useExtraCharts 是否注册成功
 * 2. createChart('barLine3D') 是否成功构造
 * 3. setOption 后场景中是否出现柱子（父类渲染）与折线（afterRender）
 */
import { spawn } from 'node:child_process'
import { launchBrowser } from './lib/browser.mjs'
import { mkdtempSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

const CHROME = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe'
const PORT = 9408
const userDataDir = mkdtempSync(join(tmpdir(), 'vis3x-diag2-'))

const browser = launchBrowser({ port: PORT, windowSize: '1200,900', tag: 'vis3x-diag' })

const sleep = (ms) => new Promise((r) => setTimeout(r, ms))

class CDP {
  constructor(ws) {
    this.ws = ws
    this.id = 0
    this.pending = new Map()
    this.console = []
    ws.addEventListener('message', (e) => {
      const m = JSON.parse(e.data)
      if (m.id && this.pending.has(m.id)) {
        const { resolve, reject } = this.pending.get(m.id)
        this.pending.delete(m.id)
        m.error ? reject(new Error(JSON.stringify(m.error))) : resolve(m.result)
        return
      }
      if (m.method === 'Runtime.consoleAPICalled') {
        this.console.push(
          `[${m.params.type}] ` +
            (m.params.args ?? []).map((a) => a.value ?? a.description ?? '').join(' ').slice(0, 300)
        )
      }
      if (m.method === 'Runtime.exceptionThrown') {
        this.console.push(
          '[exception] ' +
            (m.params.exceptionDetails?.exception?.description ??
              m.params.exceptionDetails?.text)
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

/**
 * 探针：在页面内创建一个隐藏 iframe 承载模块，
 * 这样可以用相对 URL 正常 import。
 */
const PROBE = `(async () => {
  const out = { steps: [] };
  try {
    // 在 Vite 开发环境下用绝对路径导入源码入口
    const mod = await import('/@fs/F:/hejiu45/3dcharts/vis-3x/packages/vis-3x/src/index.ts');
    out.steps.push('import ok');

    mod.useExtraCharts();
    out.steps.push('useExtraCharts ok');
    out.hasBarLine = mod.hasChartType('barLine3D');
    out.types = mod.getRegisteredTypes(false);

    const el = document.createElement('div');
    el.style.cssText = 'width:600px;height:400px;position:fixed;left:-9999px;top:0';
    document.body.appendChild(el);

    const chart = mod.createChart('barLine3D', el);
    out.steps.push('createChart ok, chartType=' + chart.chartType);

    chart.setOption({
      xAxis3D: { data: ['A','B','C','D'] },
      yAxis3D: { name: 'v' },
      series: [
        { type: 'bar3D', name: 'bar', data: [10, 20, 30, 40] },
        { type: 'line3D', name: 'line:trend', data: [15, 25, 35, 45] },
      ],
    });
    out.steps.push('setOption ok');

    await new Promise(r => setTimeout(r, 600));

    const counts = {};
    const named = [];
    chart.engine.scene.traverse(o => {
      counts[o.type] = (counts[o.type] || 0) + 1;
      if (o.name && o.name.startsWith('__vt_')) named.push(o.name);
    });

    out.counts = counts;
    out.named = named;
    out.yDomain = chart.cartesian.yAxis.domain;
    out.categoryCount = chart.cartesian.categoryCount;
    out.contentChildren = chart.content.children.length;
    chart.dispose();
    out.steps.push('done');
  } catch (e) {
    out.error = String((e && e.stack) || e);
  }
  return out;
})()`

async function main() {
  try {
    await waitForEndpoint()
    const tab = await fetch(
      `http://127.0.0.1:${PORT}/json/new?${encodeURIComponent('http://localhost:5178/')}`,
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
    await sleep(9000)

    const r = await cdp.send('Runtime.evaluate', {
      expression: PROBE,
      awaitPromise: true,
      returnByValue: true,
    })

    console.log(JSON.stringify(r.result?.value ?? r.exceptionDetails ?? null, null, 2))
    if (cdp.console.length) {
      console.log('\nCONSOLE:')
      cdp.console.slice(-20).forEach((c) => console.log('  ' + c))
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
