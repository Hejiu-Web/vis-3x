/**
 * playground 浏览器验证
 *
 * 验证：
 * 1. 页面无报错
 * 2. 每个图表都真正绘制出了像素
 * 3. 自定义图表（defineChart / extendChart）同样渲染成功
 * 4. 交互（悬停、点击、图例、主题切换）正常
 *
 * 安全说明：浏览器实例通过 scripts/lib/browser.mjs 启动与清理，
 * 只终止本脚本自己启动的进程，**不会影响用户已打开的浏览器**。
 */
import { writeFileSync, mkdirSync } from 'node:fs'
import { join } from 'node:path'
import { launchBrowser, waitForEndpoint, connect, sleep } from './lib/browser.mjs'

const URL_TARGET = process.argv[2] ?? 'http://localhost:5178/'
const OUT_DIR = 'F:\\hejiu45\\3dcharts\\vis-3x\\.verify'
const PORT = 9401

mkdirSync(OUT_DIR, { recursive: true })

const browser = launchBrowser({ port: PORT, windowSize: '1440,1200', tag: 'vis3x-verify' })

/** 统计每个 canvas 的已绘制像素占比 */
const CANVAS_PROBE = `(() => {
  const canvases = [...document.querySelectorAll('canvas')];
  const out = [];
  for (const c of canvases) {
    let painted = 0, sampled = 0;
    try {
      const off = document.createElement('canvas');
      off.width = 100; off.height = 100;
      const ctx = off.getContext('2d');
      ctx.drawImage(c, 0, 0, 100, 100);
      const d = ctx.getImageData(0, 0, 100, 100).data;
      for (let i = 0; i < d.length; i += 4) {
        sampled++;
        if (d[i+3] > 8 && (d[i] > 10 || d[i+1] > 10 || d[i+2] > 10)) painted++;
      }
    } catch (e) { out.push({ error: String(e) }); continue; }
    out.push({
      w: c.width, h: c.height,
      ratio: sampled ? +(painted / sampled).toFixed(3) : 0,
    });
  }
  return {
    canvasCount: canvases.length,
    canvases: out,
    paintedCount: out.filter(o => (o.ratio ?? 0) > 0.01).length,
    labelCount: document.querySelectorAll('.vt-label').length,
    legendCount: document.querySelectorAll('.vt-legend').length,
    titleTexts: [...document.querySelectorAll('.vt-title__text')].map(e => e.textContent),
  };
})()`

async function main() {
  const report = {}
  try {
    await waitForEndpoint(PORT)
    const { cdp, ws } = await connect(PORT, 'about:blank')

    await cdp.send('Page.enable')
    await cdp.send('Runtime.enable')
    await cdp.send('Emulation.setDeviceMetricsOverride', {
      width: 1440,
      height: 1200,
      deviceScaleFactor: 1,
      mobile: false,
    })
    await cdp.send('Page.navigate', { url: URL_TARGET })
    await sleep(11000)

    /* ---------------------- 1. 内置图表渲染 ---------------------- */
    const builtin = await cdp.send('Runtime.evaluate', {
      expression: CANVAS_PROBE,
      returnByValue: true,
    })
    report.builtinTab = builtin.result?.value

    /* ---------------------- 2. 切换到自定义图表 ---------------------- */
    const switched = await cdp.send('Runtime.evaluate', {
      expression: `(async () => {
        const btn = [...document.querySelectorAll('button')]
          .find(b => b.textContent.includes('自定义图表'));
        if (!btn) return { error: '未找到自定义图表 tab' };
        btn.click();
        await new Promise(r => setTimeout(r, 7000));
        return { switched: true };
      })()`,
      awaitPromise: true,
      returnByValue: true,
    })
    report.switchResult = switched.result?.value

    await sleep(4000)
    const custom = await cdp.send('Runtime.evaluate', {
      expression: CANVAS_PROBE,
      returnByValue: true,
    })
    report.customTab = custom.result?.value

    /* ---------------------- 3. 主题切换 ---------------------- */
    const themeSwitch = await cdp.send('Runtime.evaluate', {
      expression: `(async () => {
        const btn = [...document.querySelectorAll('button')]
          .find(b => b.textContent.trim() === '亮色');
        if (!btn) return { error: '未找到亮色主题按钮' };
        btn.click();
        await new Promise(r => setTimeout(r, 5000));
        return { switched: true };
      })()`,
      awaitPromise: true,
      returnByValue: true,
    })
    report.themeSwitch = themeSwitch.result?.value
    await sleep(3000)
    const afterTheme = await cdp.send('Runtime.evaluate', {
      expression: CANVAS_PROBE,
      returnByValue: true,
    })
    report.afterTheme = {
      paintedCount: afterTheme.result?.value?.paintedCount,
      canvasCount: afterTheme.result?.value?.canvasCount,
    }

    /* ---------------------- 4. 交互：悬停 + 点击 ---------------------- */
    const hover = await cdp.send('Runtime.evaluate', {
      expression: `(async () => {
        const container = document.querySelector('.vt-container');
        if (!container) return { error: 'no container' };
        const canvas = container.querySelector('canvas');
        const rect = canvas.getBoundingClientRect();
        const fire = (t, x, y) => canvas.dispatchEvent(new PointerEvent(t, {
          clientX: x, clientY: y, bubbles: true, cancelable: true,
          pointerId: 1, pointerType: 'mouse', isPrimary: true
        }));
        let hit = null;
        for (let i = 1; i < 24 && !hit; i++) {
          for (let j = 1; j < 16 && !hit; j++) {
            const x = rect.left + rect.width * i / 24;
            const y = rect.top + rect.height * j / 16;
            fire('pointermove', x, y);
            await new Promise(r => setTimeout(r, 14));
            const tip = container.querySelector('.vt-tooltip');
            if (tip && getComputedStyle(tip).display !== 'none' && tip.textContent.trim()) {
              hit = { x, y, text: tip.textContent.trim() };
            }
          }
        }
        if (!hit) return { picked: false };
        canvas.dispatchEvent(new MouseEvent('click', {
          clientX: hit.x, clientY: hit.y, bubbles: true, cancelable: true
        }));
        await new Promise(r => setTimeout(r, 300));
        const logEl = [...document.querySelectorAll('.card__foot')]
          .find(d => d.textContent.includes('事件回调'));
        return { picked: true, tooltip: hit.text, clickLog: logEl ? logEl.textContent.trim() : null };
      })()`,
      awaitPromise: true,
      returnByValue: true,
    })
    report.interaction = hover.result?.value

    report.errors = cdp.errors
    report.warnings = cdp.warnings.slice(0, 10)

    writeFileSync(
      join(OUT_DIR, 'playground-report.json'),
      JSON.stringify(report, null, 2)
    )
    console.log(JSON.stringify(report, null, 2))
    ws.close()
  } catch (e) {
    console.error('验证失败:', e.message)
    process.exitCode = 1
  } finally {
    // 只终止本脚本启动的实例
    browser.kill()
  }
}

main()
