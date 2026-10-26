/**
 * 验证文档站里所有 LiveChart 都真实渲染
 *
 * 逐个图表页访问，检查：
 * 1. 出现了 .live 容器与 canvas
 * 2. canvas 真的画出了像素（不是空白）
 * 3. 没有停在加载态
 * 4. 页面无 JS 异常
 */
import { launchBrowser } from './lib/browser.mjs'
import { mkdirSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'

const OUT = 'F:\\hejiu45\\3dcharts\\vis-3x\\.verify'
mkdirSync(OUT, { recursive: true })
const PORT = 9610
const BASE = 'http://localhost:5330'

const browser = launchBrowser({ port: PORT, windowSize: '1440,1000', tag: 'vx-alllive' })
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

/** 页面内的图表探针 */
const PROBE = `(() => {
  const figures = [...document.querySelectorAll('.live')];
  const results = figures.map((f, i) => {
    const cs = [...f.querySelectorAll('canvas')];
    const painted = cs.filter(c => { try {
      const o = document.createElement('canvas'); o.width = 60; o.height = 44;
      const x = o.getContext('2d'); x.drawImage(c, 0, 0, 60, 44);
      const d = x.getImageData(0, 0, 60, 44).data; let n = 0;
      for (let k = 0; k < d.length; k += 4) {
        if (d[k+3] > 8 && (d[k] > 10 || d[k+1] > 10 || d[k+2] > 10)) n++;
      }
      return n > 40;
    } catch (e) { return false; } });
    return {
      i,
      canvas: cs.length,
      painted: painted.length,
      loading: !!f.querySelector('.live__loading'),
      caption: (f.querySelector('.live__caption')?.textContent || '').trim().slice(0, 50),
    };
  });
  return { count: figures.length, results };
})()`

const PAGES = [
  '/guide/introduction',
  '/guide/quick-start',
  '/charts/bar',
  '/charts/line',
  '/charts/area',
  '/charts/scatter',
  '/charts/surface',
  '/charts/heatmap',
  '/charts/pie',
  '/charts/radar',
  '/charts/funnel',
  '/charts/gauge',
  '/charts/lollipop',
  '/charts/bubble',
  '/charts/pyramid',
  '/charts/ring-progress',
  '/charts/step-terrain',
  '/charts/bar-line',
  '/charts/extra',
]

async function main() {
  const report = { pages: [], totalFigures: 0, totalPainted: 0, failed: [] }
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
      width: 1440,
      height: 1000,
      deviceScaleFactor: 1,
      mobile: false,
    })

    console.log('=== 文档站实时图表渲染验证 ===')
    console.log('  页面'.padEnd(28) + '图表数  已绘制  状态')
    console.log('  ' + '-'.repeat(56))

    for (const path of PAGES) {
      await cdp.send('Page.navigate', { url: BASE + path })
      await sleep(3200)
      // 滚动一遍触发 IntersectionObserver 懒加载
      await cdp.send('Runtime.evaluate', {
        expression: `(async () => {
          const h = document.body.scrollHeight;
          for (let y = 0; y < h; y += 600) {
            window.scrollTo(0, y);
            await new Promise(r => setTimeout(r, 120));
          }
          window.scrollTo(0, 0);
        })()`,
        awaitPromise: true,
      })
      await sleep(2600)

      const r = await cdp.send('Runtime.evaluate', {
        expression: PROBE,
        returnByValue: true,
      })
      const v = r.result?.value ?? { count: 0, results: [] }

      const painted = v.results.filter((x) => x.painted > 0).length
      const loading = v.results.filter((x) => x.loading).length
      report.totalFigures += v.count
      report.totalPainted += painted

      const ok = v.count > 0 && painted === v.count
      if (!ok) report.failed.push({ path, count: v.count, painted, loading })

      console.log(
        '  ' +
          path.padEnd(26) +
          String(v.count).padStart(4) +
          String(painted).padStart(8) +
          '   ' +
          (ok ? '✓' : `★ 异常 (loading=${loading})`)
      )
      report.pages.push({ path, count: v.count, painted, loading })
    }

    console.log('\n  图表总数: ' + report.totalFigures)
    console.log('  成功渲染: ' + report.totalPainted)
    console.log('  页面异常: ' + cdp.errors.length)
    if (report.failed.length) {
      console.log('\n  未通过:')
      report.failed.forEach((f) => console.log('    ' + f.path))
    }
    cdp.errors.slice(0, 6).forEach((e) => console.log('  JS: ' + String(e).slice(0, 180)))

    writeFileSync(join(OUT, 'livechart-report.json'), JSON.stringify(report, null, 2))
    ws.close()
  } catch (e) {
    console.error('FAIL', e.message)
    process.exitCode = 1
  } finally {
    browser.kill()
  }
}

main()
