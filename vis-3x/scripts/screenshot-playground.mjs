/**
 * 对 playground 截图，用于人工视觉核对。
 *
 * 安全说明：浏览器实例通过 scripts/lib/browser.mjs 启动与清理，
 * 只终止本脚本自己启动的进程，**不会影响用户已打开的浏览器**。
 */
import { writeFileSync, mkdirSync } from 'node:fs'
import { join } from 'node:path'
import { launchBrowser, waitForEndpoint, connect, sleep } from './lib/browser.mjs'

const URL_TARGET = process.argv[2] ?? 'http://localhost:5178/'
const OUT_DIR = 'F:\\hejiu45\\3dcharts\\vis-3x\\.verify'
const PORT = 9402

mkdirSync(OUT_DIR, { recursive: true })

/** 启动隔离的 headless 实例 */
const browser = launchBrowser({ port: PORT, windowSize: '1440,1100', tag: 'vis3x-shot' })

async function main() {
  try {
    await waitForEndpoint(PORT)
    const { cdp, ws } = await connect(PORT, 'about:blank')

    await cdp.send('Page.enable')
    await cdp.send('Runtime.enable')
    await cdp.send('Emulation.setDeviceMetricsOverride', {
      width: 1440,
      height: 1100,
      deviceScaleFactor: 1,
      mobile: false,
    })
    await cdp.send('Page.navigate', { url: URL_TARGET })
    await sleep(11000)

    const shot = async (name) => {
      const r = await cdp.send('Page.captureScreenshot', { format: 'png' })
      writeFileSync(join(OUT_DIR, `${name}.png`), Buffer.from(r.data, 'base64'))
      console.log(`${name}.png saved`)
    }

    // 内置图表
    await shot('pg-builtin-top')
    await cdp.send('Runtime.evaluate', { expression: 'window.scrollTo(0, 1000)' })
    await sleep(1200)
    await shot('pg-builtin-mid')

    // 自定义图表 tab
    await cdp.send('Runtime.evaluate', {
      expression: `[...document.querySelectorAll('button')].find(b => b.textContent.includes('自定义图表'))?.click()`,
    })
    await sleep(8000)
    await cdp.send('Runtime.evaluate', { expression: 'window.scrollTo(0, 0)' })
    await sleep(1500)
    await shot('pg-custom-top')
    await cdp.send('Runtime.evaluate', { expression: 'window.scrollTo(0, 900)' })
    await sleep(1500)
    await shot('pg-custom-mid')

    ws.close()
  } catch (e) {
    console.error('截图失败:', e.message)
    process.exitCode = 1
  } finally {
    browser.kill()
  }
}

main()
