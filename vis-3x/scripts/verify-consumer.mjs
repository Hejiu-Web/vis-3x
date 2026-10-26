/**
 * 真实消费者验证
 *
 * 模拟「用户从 npm 装了 vis-3x」的完整链路，用来在发布前回答一个关键问题：
 * **这个 tarball 装进一个干净的 TS + Vite 项目，到底能不能用？**
 *
 * 验证内容：
 * 1. `npm pack` 生成真实的 tarball，检查它不是空包
 * 2. 在临时目录建一个干净项目，安装该 tarball + three + vue
 * 3. `tsc --noEmit` 在两种主流解析模式下检查类型：
 *    - `moduleResolution: "bundler"`（Vite / TS 5 推荐）
 *    - `moduleResolution: "node16"` + `NodeNext`（Node 原生 ESM）
 * 4. `vite build` 真的打一次包（验证 exports / style.css 可解析、无未定义引用）
 * 5. `node` 里 require / import 两种方式跑一遍，读 `VERSION`
 *
 * 用法：
 *   node scripts/verify-consumer.mjs
 *
 * 说明：需要联网首次安装 three / vue（通常来自 pnpm 本地 store 或 npm cache）。
 */
import { execFileSync } from 'node:child_process'
import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const here = dirname(fileURLToPath(import.meta.url))
// 本脚本在仓库根的 scripts/ 下：从 scripts/ 退到仓库根，再进 packages/vis-3x
const pkgRoot = resolve(here, '..', 'packages', 'vis-3x')
const workRoot = resolve(here, '..', '.verify-consumer')

let failures = 0
const fail = (msg) => {
  failures++
  console.error(`  ✗ ${msg}`)
}
const pass = (msg) => console.log(`  ✓ ${msg}`)

/** 同步执行并返回 stdout（失败时抛出，由调用方捕获） */
function run(cmd, args, cwd, label) {
  try {
    return execFileSync(cmd, args, {
      cwd,
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'pipe'],
      shell: process.platform === 'win32',
      env: { ...process.env, CI: '1' },
    })
  } catch (error) {
    const out = `${error.stdout ?? ''}${error.stderr ?? ''}`
    throw new Error(`${label ?? cmd} 失败:\n${out}`)
  }
}

/* -------------------------------------------------------------------------- */
/*                              0. 清理 & 打包                                */
/* -------------------------------------------------------------------------- */
console.log('\n=== vis-3x 真实消费者验证 ===\n')

if (!existsSync(join(pkgRoot, 'dist', 'index.js'))) {
  console.error('  ✗ dist/index.js 不存在，请先执行 pnpm build')
  process.exit(1)
}

rmSync(workRoot, { recursive: true, force: true })
mkdirSync(join(workRoot, 'consumer', 'src'), { recursive: true })

console.log('[1/5] 打包 tarball')
const packOut = run('npm', ['pack', '--json', '--pack-destination', workRoot], pkgRoot, 'npm pack')
const packInfo = JSON.parse(packOut)[0]
const tarball = join(workRoot, packInfo.filename)
const pkgJson = JSON.parse(readFileSync(join(pkgRoot, 'package.json'), 'utf8'))

if (!existsSync(tarball)) {
  fail(`tarball 未生成: ${tarball}`)
  process.exit(1)
}
if (packInfo.files.length < 20) {
  fail(`tarball 文件数异常偏少（${packInfo.files.length}），疑似漏打包`)
} else {
  pass(`tarball 已生成：${packInfo.filename}`)
}
pass(`体积：解包 ${(packInfo.unpackedSize / 1024).toFixed(1)} KB / 压缩 ${(packInfo.size / 1024).toFixed(1)} KB`)
pass(`文件数：${packInfo.files.length}`)

/** tarball 里必须有的东西 */
const packedPaths = new Set(packInfo.files.map((f) => f.path))
for (const required of ['dist/index.js', 'dist/index.cjs', 'dist/index.d.ts', 'dist/style.css', 'LICENSE', 'README.md']) {
  if (packedPaths.has(required)) pass(`包含 ${required}`)
  else fail(`缺少 ${required}`)
}
/** tarball 里不该有的东西 */
for (const forbidden of ['dist/index.umd.js']) {
  if (packedPaths.has(forbidden)) fail(`不应包含 ${forbidden}`)
}
const mapCount = packInfo.files.filter((f) => f.path.endsWith('.map')).length
if (mapCount > 0) fail(`不应包含 sourcemap（发现 ${mapCount} 个）`)
else pass('不包含 sourcemap')

/* -------------------------------------------------------------------------- */
/*                              1. 建消费者项目                               */
/* -------------------------------------------------------------------------- */
console.log('\n[2/5] 创建干净的消费者项目并安装 tarball')

const consumerDir = join(workRoot, 'consumer')

const consumerPkg = {
  name: 'vis-3x-consumer-fixture',
  private: true,
  version: '0.0.0',
  type: 'module',
  dependencies: {
    'vis-3x': `file:${tarball.replace(/\\/g, '/')}`,
    three: '^0.160.0',
    vue: '^3.5.13',
  },
  devDependencies: {
    typescript: '~5.6.3',
    vite: '^6.0.7',
  },
}
writeFileSync(join(consumerDir, 'package.json'), JSON.stringify(consumerPkg, null, 2))

try {
  run('npm', ['install', '--no-audit', '--no-fund', '--loglevel=error'], consumerDir, 'npm install')
  pass('依赖安装完成（vis-3x 来自 tarball）')
} catch (error) {
  fail(error.message)
  console.error('\n安装失败，后续步骤跳过')
  process.exit(1)
}

/* -------------------------------------------------------------------------- */
/*                          2. 类型检查（两种解析模式）                        */
/* -------------------------------------------------------------------------- */
console.log('\n[3/5] TypeScript 消费方类型检查')

/** 覆盖主入口、所有子路径、样式导入与 Vue 组件用法 */
writeFileSync(
  join(consumerDir, 'src', 'app.ts'),
  `import {
  createChart,
  defineChart,
  registerChart,
  VisBar3D,
  VisChart,
  useVisChart,
  themes,
  darkTheme,
  fromEchartsLikeOption,
  getBuiltinTypes,
  ChartBase,
  VERSION,
} from 'vis-3x'
import type { Vis3xOption, Series3D, TooltipData } from 'vis-3x'
import type { Vis3xOption as FromTypesSubpath } from 'vis-3x/types'
import { clamp } from 'vis-3x/utils'
import { Bar3DChart } from 'vis-3x/charts'
import { createChartComponent } from 'vis-3x/components'
import { Engine, EventBus } from 'vis-3x/core'
import { useExtraCharts } from 'vis-3x/presets'
import { toVis3xOption } from 'vis-3x/adapters'
import { useVisChart as useVisChart2 } from 'vis-3x/composables'
import 'vis-3x/style.css'

/* ---- 1. option 类型可辨识联合：series.type 应自动收窄 ---- */
const option: Vis3xOption = {
  xAxis3D: { data: ['Q1', 'Q2'] },
  yAxis3D: { name: '销售额' },
  theme: themes.blue,
  series: [
    { type: 'bar3D', name: '2024', data: [120, 200] },
    { type: 'line3D', name: '2025', data: [150, 230] },
  ],
}

/* ---- 2. 主入口类型导出 ---- */
const optionAlias: FromTypesSubpath = option
void optionAlias

/* ---- 3. 命令式 API 的返回值是 ChartBase ---- */
declare const el: HTMLElement
const chart: ChartBase = createChart('bar3D', el, { antialias: true })
chart.setOption(option)
const png: string = chart.exportImage({ scale: 2 })
void png

/* ---- 4. 扩展 API ---- */
defineChart({
  type: 'fixture3D',
  render(ctx) {
    const first: Series3D | undefined = ctx.series[0]
    if (!first) return
    // ctx 上的能力都应可用
    ctx.add(ctx.anchor(0, 0, 0, 'hi'))
    ctx.label(ctx.anchor(0, 1, 0), 'x')
    ctx.keepAnimating()
    const t: 'initial' | 'update' = ctx.phase
    void t
    void ctx.transition
    void ctx.coord.xAtCategory(0)
    void ctx.material('#fff')
  },
})

/* ---- 5. 组件可以直接作为 Vue 组件使用（类型层面）---- */
const comps = [VisBar3D, VisChart, Bar3DChart]
void comps
void createChartComponent
void useVisChart
void useVisChart2
void useExtraCharts
void fromEchartsLikeOption
void toVis3xOption
void registerChart
void Engine
void EventBus
void clamp(1, 0, 2)
void getBuiltinTypes()
void darkTheme
void VERSION

/* ---- 6. 事件负载类型 ---- */
const off = chart.on('chart:click', (payload) => {
  const dataIndex: number = payload.dataIndex
  const value: number | number[] = payload.value
  void dataIndex
  void value
})
off()

/* ---- 7. tooltip formatter 的类型 ---- */
void ({ value: 1, color: '#fff', dataIndex: 0, seriesIndex: 0 } as Partial<TooltipData>)
`,
)

writeFileSync(
  join(consumerDir, 'tsconfig.bundler.json'),
  JSON.stringify(
    {
      compilerOptions: {
        target: 'ES2020',
        lib: ['ES2020', 'DOM', 'DOM.Iterable'],
        module: 'ESNext',
        moduleResolution: 'bundler',
        strict: true,
        noEmit: true,
        skipLibCheck: true,
        // 开启后，任何找不到模块的副作用导入都会报错——
        // 这正是「CSS 导入写进 d.ts」会暴露问题的开关
        noUncheckedSideEffectImports: true,
      },
      include: ['src/**/*.ts'],
    },
    null,
    2,
  ),
)

writeFileSync(
  join(consumerDir, 'tsconfig.node16.json'),
  JSON.stringify(
    {
      compilerOptions: {
        target: 'ES2020',
        lib: ['ES2020', 'DOM', 'DOM.Iterable'],
        module: 'NodeNext',
        moduleResolution: 'NodeNext',
        strict: true,
        noEmit: true,
        skipLibCheck: true,
        noUncheckedSideEffectImports: true,
      },
      include: ['src/**/*.ts'],
    },
    null,
    2,
  ),
)

for (const cfg of ['tsconfig.bundler.json', 'tsconfig.node16.json']) {
  try {
    run('npx', ['tsc', '-p', cfg], consumerDir, `tsc (${cfg})`)
    pass(`${cfg} 类型检查通过`)
  } catch (error) {
    fail(`${cfg} 类型检查失败\n${error.message}`)
  }
}

/* -------------------------------------------------------------------------- */
/*                              3. Vite 真实打包                              */
/* -------------------------------------------------------------------------- */
console.log('\n[4/5] Vite 真实打包（验证 exports / style.css 可解析）')

writeFileSync(
  join(consumerDir, 'index.html'),
  `<!doctype html><html><body><div id="app"></div><script type="module" src="/src/main.js"></script></body></html>`,
)

writeFileSync(
  join(consumerDir, 'src', 'main.js'),
  `import { createChart, VERSION, getBuiltinTypes } from 'vis-3x'
import 'vis-3x/style.css'

globalThis.__resolved = { createChart, VERSION, getBuiltinTypes }
void createChart
`,
)

writeFileSync(
  join(consumerDir, 'vite.config.js'),
  `import { defineConfig } from 'vite'
export default defineConfig({
  build: { outDir: 'dist', minify: false, target: 'es2019' },
})
`,
)

try {
  run('npx', ['vite', 'build', '--logLevel=warn'], consumerDir, 'vite build')
  pass('vite build 成功')
  const html = readFileSync(join(consumerDir, 'dist', 'index.html'), 'utf8')
  if (/\.css/.test(html)) pass('样式已随构建产出并被页面引用')
  else fail('构建产物里没有 CSS 引用（style.css 可能未被打进产物）')
} catch (error) {
  fail(`vite build 失败\n${error.message}`)
}

/* -------------------------------------------------------------------------- */
/*                        4. Node 里跑 ESM / CJS 入口                         */
/* -------------------------------------------------------------------------- */
console.log('\n[5/5] Node 中加载 ESM 与 CJS 入口')

const esmScript = `
import { VERSION, getBuiltinTypes, ChartBase, runtimeDefaults } from 'vis-3x'
const types = getBuiltinTypes()
if (typeof VERSION !== 'string' || !/^\\d+\\.\\d+\\.\\d+/.test(VERSION)) {
  throw new Error('VERSION 不是合法版本号: ' + VERSION)
}
if (types.length < 11) throw new Error('内置类型数量不足: ' + types.length)
if (typeof ChartBase !== 'function') throw new Error('ChartBase 缺失')
console.log(JSON.stringify({ VERSION, count: types.length, hasDefaults: !!runtimeDefaults }))
`
writeFileSync(join(consumerDir, 'check-esm.mjs'), esmScript)

const cjsScript = `
const { VERSION, getBuiltinTypes } = require('vis-3x')
const types = getBuiltinTypes()
if (typeof VERSION !== 'string') throw new Error('CJS VERSION 缺失')
console.log(JSON.stringify({ VERSION, count: types.length }))
`
writeFileSync(join(consumerDir, 'check-cjs.cjs'), cjsScript)

for (const [script, label] of [
  ['check-esm.mjs', 'ESM import'],
  ['check-cjs.cjs', 'CJS require'],
]) {
  try {
    const out = run(process.execPath, [script], consumerDir, label).trim()
    const info = JSON.parse(out)
    if (info.VERSION !== pkgJson.version) {
      fail(`${label}: VERSION=${info.VERSION}，与 package.json 的 ${pkgJson.version} 不一致`)
    } else {
      pass(`${label} 可用（version=${info.VERSION}, 内置类型 ${info.count} 个）`)
    }
  } catch (error) {
    fail(`${label} 失败\n${error.message}`)
  }
}

/* -------------------------------------------------------------------------- */
/*                                  结果                                      */
/* -------------------------------------------------------------------------- */
console.log('\n=== 结果 ===')
if (failures > 0) {
  console.error(`✗ 发现 ${failures} 个问题，不建议发布\n`)
  console.error(`消费者项目保留在：${consumerDir}\n`)
  process.exit(1)
}
console.log('✓ 全部通过：该 tarball 可以被真实 TS / Vite / Node 项目正常消费\n')
rmSync(workRoot, { recursive: true, force: true })
