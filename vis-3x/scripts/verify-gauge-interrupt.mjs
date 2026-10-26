/**
 * 决定性测试：动画进行中打断 → 图例隐藏
 *
 * 这是用户的实际场景：
 * 入场动画还在跑，用户点了图例 → setOption 清空动画 →
 * 旧实现里最后一帧新建的数值标签永远停在左上角
 */
import { launchBrowser } from './lib/browser.mjs'
import { mkdirSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'

const OUT = 'F:\\hejiu45\\3dcharts\\vis-3x\\.verify'
mkdirSync(OUT, { recursive: true })
const PORT = 9731
const browser = launchBrowser({ port: PORT, windowSize: '900,650', tag: 'vx-interrupt' })
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

  const mkOption = (visible) => ({
    showCoordinate: false,
    title: { show: true, text: '系统健康度', subtext: '3D 仪表盘' },
    theme: mod.themes.dark,
    legend: { show: true },
    series: [{
      type: 'gauge3D', name: '健康度', min: 0, max: 100,
      data: [{ value: 73 }], radius: 3.4, depth: 0.5, splitNumber: 5,
      detail: { show: true }, visible: visible,
    }],
    // 长动画，保证我们有时间在动画途中打断
    animation: { enabled: true, duration: 2500 },
  });

  const results = [];

  // 场景：入场动画跑到一半就隐藏系列
  for (const delay of [150, 400, 800, 1400]) {
    const chart = mod.createChart('gauge3D', el);
    chart.setOption(mkOption(true));
    await new Promise(r => setTimeout(r, delay));   // 动画途中
    const midLabels = read();
    chart.setOption(mkOption(false));                // 打断 + 隐藏
    await new Promise(r => setTimeout(r, 700));
    const after = read();
    results.push({
      delay,
      midCount: midLabels.length,
      afterCount: after.length,
      topLeft: after.filter(l => l.x < 130 && l.y < 130),
      all: after,
    });
    chart.dispose();
    el.innerHTML = '';
    await new Promise(r => setTimeout(r, 200));
  }

  // 场景：动画结束后再隐藏
  {
    const chart = mod.createChart('gauge3D', el);
    chart.setOption(mkOption(true));
    await new Promise(r => setTimeout(r, 3000));
    const before = read();
    chart.setOption(mkOption(false));
    await new Promise(r => setTimeout(r, 700));
    const after = read();
    results.push({
      delay: 3000,
      midCount: before.length,
      afterCount: after.length,
      topLeft: after.filter(l => l.x < 130 && l.y < 130),
      all: after,
    });
    chart.dispose();
    el.innerHTML = '';
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
    console.log('=== 动画途中打断 + 图例隐藏 ===')
    console.log('  打断时机   打断时标签  隐藏后标签  左上角残影')
    console.log('  ' + '-'.repeat(50))
    let bad = 0
    for (const x of rows) {
      const fail = x.topLeft.length > 0 || x.afterCount > 0
      if (fail) bad++
      console.log(
        '  ' +
          (x.delay + 'ms').padEnd(12) +
          String(x.midCount).padStart(8) +
          String(x.afterCount).padStart(12) +
          '  ' +
          (x.topLeft.length ? JSON.stringify(x.topLeft) : '无') +
          (fail ? '  ★' : '  ✓')
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
