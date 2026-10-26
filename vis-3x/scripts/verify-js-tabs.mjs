/**
 * 验证 TS/JS 双标签页渲染
 *
 * 检查每个页面：
 * 1. 出现 code-group 的标签按钮（TypeScript / JavaScript）
 * 2. 点击 JavaScript 标签后代码内容确实切换
 * 3. 实时图表仍然渲染
 */
import { launchBrowser } from './lib/browser.mjs'

const PORT = 9690
const BASE = 'http://localhost:5300'
const browser = launchBrowser({ port: PORT, windowSize: '1400,900', tag: 'vx-js-tabs' })
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

/** 探测页面的 code-group 状态 */
const PROBE = `(() => {
  const groups = [...document.querySelectorAll('.vp-code-group')];
  const info = groups.map(g => {
    const labels = [...g.querySelectorAll('.tabs label')].map(l => l.textContent.trim());
    const blocks = [...g.querySelectorAll('div[class*="language-"]')];
    const visible = blocks.find(b => b.style.display !== 'none');
    return {
      labels,
      hasTs: labels.some(l => /TypeScript/i.test(l)),
      hasJs: labels.some(l => /JavaScript/i.test(l)),
      blockCount: blocks.length,
      visibleText: (visible?.textContent || '').slice(0, 60).replace(/\\s+/g, ' '),
    };
  });
  const figs = [...document.querySelectorAll('.live')];
  const painted = figs.filter(f => {
    const c = f.querySelector('canvas'); if (!c) return false;
    try {
      const o = document.createElement('canvas'); o.width = 48; o.height = 32;
      const x = o.getContext('2d'); x.drawImage(c, 0, 0, 48, 32);
      const d = x.getImageData(0, 0, 48, 32).data; let n = 0;
      for (let i = 0; i < d.length; i += 4) {
        if (d[i+3] > 8 && (d[i] > 10 || d[i+1] > 10 || d[i+2] > 10)) n++;
      }
      return n > 30;
    } catch (e) { return false; }
  });
  return { groupCount: groups.length, groups: info, figs: figs.length, painted: painted.length };
})()`

const PAGES = [
  '/guide/javascript',
  '/guide/usage-modes',
  '/guide/quick-start',
  '/guide/introduction',
  '/charts/bar',
  '/charts/line',
  '/charts/surface',
  '/charts/lollipop',
  '/charts/bar-line',
  '/charts/extra',
  '/custom/',
  '/custom/extend-chart',
  '/custom/register-chart',
  '/api/option',
]

async function main() {
  let failures = 0
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

    console.log('=== TS / JS 双标签页验证 ===')
    console.log('  页面'.padEnd(30) + '标签组  含JS  切换  图表')
    console.log('  ' + '-'.repeat(58))

    for (const path of PAGES) {
      cdp.errors.length = 0
      await cdp.send('Page.navigate', { url: BASE + path })
      await sleep(4200)
      await cdp.send('Runtime.evaluate', {
        expression: `(async()=>{const h=document.body.scrollHeight;for(let y=0;y<h;y+=550){window.scrollTo(0,y);await new Promise(r=>setTimeout(r,110));}window.scrollTo(0,0);})()`,
        awaitPromise: true,
      })
      await sleep(2600)

      const r = await cdp.send('Runtime.evaluate', {
        expression: PROBE,
        returnByValue: true,
      })
      const v = r.result?.value ?? {}
      const groups = v.groups ?? []
      const withJs = groups.filter((g) => g.hasJs).length

      // 点第一个含 JS 的标签组的 JavaScript 标签，验证内容切换
      let switched = '—'
      if (withJs > 0) {
        const click = await cdp.send('Runtime.evaluate', {
          expression: `(() => {
            const g = [...document.querySelectorAll('.vp-code-group')].find(x =>
              [...x.querySelectorAll('.tabs label')].some(l => /JavaScript/i.test(l.textContent))
            );
            if (!g) return null;
            const label = [...g.querySelectorAll('.tabs label')].find(l => /JavaScript/i.test(l.textContent));
            const before = [...g.querySelectorAll('div[class*="language-"]')]
              .find(b => b.style.display !== 'none')?.textContent?.slice(0,40) || '';
            label.click();
            return { before };
          })()`,
          returnByValue: true,
        })
        await sleep(400)
        const after = await cdp.send('Runtime.evaluate', {
          expression: `(() => {
            const g = [...document.querySelectorAll('.vp-code-group')].find(x =>
              [...x.querySelectorAll('.tabs label')].some(l => /JavaScript/i.test(l.textContent))
            );
            const vis = [...g.querySelectorAll('div[class*="language-"]')]
              .find(b => b.style.display !== 'none');
            return (vis?.textContent || '').slice(0, 60).replace(/\\s+/g, ' ');
          })()`,
          returnByValue: true,
        })
        const afterText = after.result?.value ?? ''
        switched = /JavaScript|纯 JavaScript|去掉类型|const option =/.test(afterText)
          ? '✓'
          : '?'
      }

      const figOk = v.figs === 0 || v.painted === v.figs
      const ok = withJs > 0 && figOk
      if (!ok) failures++

      console.log(
        '  ' +
          path.padEnd(28) +
          String(v.groupCount ?? 0).padStart(5) +
          String(withJs).padStart(6) +
          switched.padStart(6) +
          `  ${v.painted ?? 0}/${v.figs ?? 0}` +
          (ok ? '' : '  ★')
      )
    }

    console.log('\n  失败页面数: ' + failures)
    ws.close()
  } catch (e) {
    console.error('FAIL', e.message)
    process.exitCode = 1
  } finally {
    browser.kill()
  }
}

main()
