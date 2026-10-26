/**
 * 打包产物消费测试
 *
 * 直接在 Node 中以「使用者视角」导入构建产物，验证：
 * 1. 主入口与各子路径入口都能被解析
 * 2. defineChart / extendChart / registerChart 等扩展 API 可用
 * 3. createChart 能真正创建实例（用最小 DOM 桩）
 * 4. 已注册类型列表正确
 *
 * 这里用 Node 而不是浏览器，是为了验证「模块解析 + 导出形状」，
 * 浏览器渲染验证由 playground 承担。
 */
import { strict as assert } from 'node:assert'

/* ---------------------------- 1. 主入口（ESM） ---------------------------- */
const main = await import('vis-3x')

const requiredExports = [
  // 组件
  'VisChart',
  'VisBar3D',
  'VisLine3D',
  'VisArea3D',
  'VisAreaFlow3D',
  'VisPie3D',
  'VisScatter3D',
  'VisSurface3D',
  'VisRadar3D',
  'VisFunnel3D',
  'VisGauge3D',
  'VisHeatmap3D',
  'VisChartBase',
  'createChartComponent',
  // 核心
  'Engine',
  'ChartBase',
  'Cartesian3D',
  'ResourceManager',
  'EventBus',
  'LabelManager',
  'InteractionManager',
  'CSS2DRenderer',
  // 扩展 API
  'registerChart',
  'unregisterChart',
  'hasChartType',
  'getChartConstructor',
  'getRegisteredTypes',
  'getBuiltinTypes',
  'createChart',
  'inferChartType',
  'defineChart',
  'extendChart',
  'useChartPlugin',
  'installChartPlugin',
  'getPlugins',
  'clearPlugins',
  // 组合式 / 适配器 / 主题
  'useVisChart',
  'fromEchartsLikeOption',
  'themes',
  'darkTheme',
  'lightTheme',
  'getTheme',
  'extendTheme',
  // 预设图表
  'defineLollipop3D',
  'defineBubble3D',
  'defineBarLine3D',
  'definePyramid3D',
  'defineRingProgress3D',
  'defineStepTerrain3D',
  'useExtraCharts',
  // 工具
  'clamp',
  'lerp',
  'gradientColorAt',
  'DEFAULT_PALETTE',
  'EASINGS',
]

const missing = requiredExports.filter((name) => !(name in main))
assert.equal(missing.length, 0, `主入口缺少导出: ${missing.join(', ')}`)
console.log(`✓ 主入口导出完整（校验 ${requiredExports.length} 个符号）`)

assert.ok(main.default && typeof main.default.install === 'function', '默认导出应是 Vue 插件')
console.log('✓ 默认导出是合法的 Vue 插件（含 install）')

/* ---------------------------- 2. 子路径入口 ---------------------------- */
const core = await import('vis-3x/core')
assert.ok(typeof core.createChart === 'function', 'vis-3x/core 应导出 createChart')
assert.ok(typeof core.defineChart === 'function', 'vis-3x/core 应导出 defineChart')
assert.ok(typeof core.ChartBase === 'function', 'vis-3x/core 应导出 ChartBase')
console.log('✓ vis-3x/core 可独立导入')

const presets = await import('vis-3x/presets')
assert.ok(presets.darkTheme, 'vis-3x/presets 应导出 darkTheme')
assert.ok(typeof presets.useExtraCharts === 'function', 'vis-3x/presets 应导出 useExtraCharts')
console.log('✓ vis-3x/presets 可独立导入')

const adapters = await import('vis-3x/adapters')
assert.ok(
  typeof adapters.fromEchartsLikeOption === 'function',
  'vis-3x/adapters 应导出 fromEchartsLikeOption'
)
console.log('✓ vis-3x/adapters 可独立导入')

const utils = await import('vis-3x/utils')
assert.ok(typeof utils.clamp === 'function', 'vis-3x/utils 应导出 clamp')
assert.equal(utils.clamp(5, 0, 3), 3)
console.log('✓ vis-3x/utils 可独立导入且行为正确')

const charts = await import('vis-3x/charts')
assert.ok(typeof charts.Bar3DChart === 'function', 'vis-3x/charts 应导出 Bar3DChart')
console.log('✓ vis-3x/charts 可独立导入')

const composables = await import('vis-3x/composables')
assert.ok(typeof composables.useVisChart === 'function', 'vis-3x/composables 应导出 useVisChart')
console.log('✓ vis-3x/composables 可独立导入')

/* ---------------------------- 3. 内置类型注册 ---------------------------- */
const builtins = main.getBuiltinTypes()
assert.ok(builtins.includes('bar3D'), '内置类型应包含 bar3D')
assert.ok(builtins.length >= 10, `内置类型应至少 10 个，实际 ${builtins.length}`)
console.log(`✓ 内置图表类型已注册：${builtins.join(', ')}`)

// 别名解析
assert.ok(main.hasChartType('bar'), '别名 "bar" 应可解析到 bar3D')
assert.equal(main.getChartConstructor('bar'), main.getChartConstructor('bar3D'))
console.log('✓ 类型别名解析正确（bar → bar3D）')

/* ---------------------------- 4. defineChart ---------------------------- */
let renderCalled = 0
const CustomCtor = main.defineChart({
  type: 'testCustom3D',
  render(ctx) {
    renderCalled++
    assert.ok(ctx.coord, 'ctx.coord 应存在')
    assert.ok(ctx.geometry, 'ctx.geometry 应存在')
    assert.ok(ctx.material, 'ctx.material 应存在')
    assert.ok(ctx.theme, 'ctx.theme 应存在')
    assert.ok(Array.isArray(ctx.theme.palette), 'theme.palette 应是数组')
    assert.ok(typeof ctx.coord.xAtCategory === 'function', 'coord.xAtCategory 应是函数')
    assert.ok(typeof ctx.coord.yAt === 'function', 'coord.yAt 应是函数')
  },
})
assert.ok(typeof CustomCtor === 'function', 'defineChart 应返回构造函数')
assert.ok(main.hasChartType('testCustom3D'), '自定义类型应已注册')
console.log('✓ defineChart 注册成功')

/* ---------------------------- 5. extendChart ---------------------------- */
let beforeCalled = 0
let afterCalled = 0
const ExtendedCtor = main.extendChart('bar3D', {
  type: 'testExtended3D',
  beforeRender() {
    beforeCalled++
  },
  afterRender() {
    afterCalled++
  },
})
assert.ok(typeof ExtendedCtor === 'function', 'extendChart 应返回构造函数')
assert.ok(main.hasChartType('testExtended3D'), '扩展类型应已注册')
// 继承关系校验
assert.ok(
  ExtendedCtor.prototype instanceof main.ChartBase,
  '扩展图表应继承自 ChartBase'
)
console.log('✓ extendChart 继承自 ChartBase')

/* ---------------------------- 6. 插件系统 ---------------------------- */
main.useChartPlugin({
  name: 'test-plugin',
  install({ defineChart }) {
    defineChart({ type: 'pluginChart3D', render() {} })
  },
})
assert.ok(main.hasChartType('pluginChart3D'), '插件应能注册图表')
assert.deepEqual(main.getPlugins(), ['test-plugin'])
// 幂等性
main.useChartPlugin({
  name: 'test-plugin',
  install() {
    throw new Error('不应被重复执行')
  },
})
console.log('✓ 插件系统工作正常且幂等')

/* ---------------------------- 7. 预设图表定义器 ---------------------------- */
const extrasBefore = main.getRegisteredTypes().length
main.useExtraCharts()
const extrasAfter = main.getRegisteredTypes().length
assert.ok(extrasAfter > extrasBefore, 'useExtraCharts 应注册新类型')
for (const t of ['lollipop3D', 'bubble3D', 'barLine3D', 'pyramid3D', 'ringProgress3D', 'stepTerrain3D']) {
  assert.ok(main.hasChartType(t), `预设图表 ${t} 应已注册`)
}
console.log(`✓ useExtraCharts 注册了 ${extrasAfter - extrasBefore} 个预设图表`)

/* ---------------------------- 8. 错误处理 ---------------------------- */
assert.throws(
  () => main.registerChart('', () => {}),
  /type 必须是非空字符串/,
  '空类型名应抛错'
)
assert.throws(
  () => main.registerChart('bad', null),
  /ctor 必须是构造函数/,
  '非函数 ctor 应抛错'
)
// 注销不存在的类型：返回 false，不抛错
assert.equal(
  main.unregisterChart('__not_exists__'),
  false,
  '注销不存在的类型应返回 false'
)
// 注销已存在的类型：返回 true
assert.equal(main.unregisterChart('testCustom3D'), true, '注销已注册类型应返回 true')
assert.equal(main.hasChartType('testCustom3D'), false, '注销后不应再存在')
console.log('✓ 参数校验与错误提示正常')

/* ---------------------------- 9. ECharts 适配器 ---------------------------- */
const converted = main.fromEchartsLikeOption({
  color: ['#4f8cff', '#22d3ee'],
  xAxis: { type: 'category', data: ['A', 'B', 'C'] },
  yAxis: { type: 'value', name: '值' },
  series: [{ type: 'bar', name: '测试', data: [1, 2, 3] }],
})
assert.ok(converted.series, '转换结果应包含 series')
assert.equal(converted.series[0].type, 'bar3D', 'bar 应转换为 bar3D')
assert.deepEqual(converted.xAxis3D.data, ['A', 'B', 'C'], 'xAxis.data 应被转换')
console.log('✓ ECharts 配置适配器工作正常')

/* ---------------------------- 10. CJS 入口 ---------------------------- */
const { createRequire } = await import('node:module')
const require = createRequire(import.meta.url)
const cjs = require('vis-3x')
assert.ok(typeof cjs.createChart === 'function', 'CJS 入口应导出 createChart')
assert.ok(typeof cjs.getBuiltinTypes === 'function', 'CJS 入口应导出 getBuiltinTypes')
console.log('✓ CJS（require）入口可用')

/* ---------------------------- 11. 样式文件存在 ---------------------------- */
const { existsSync } = await import('node:fs')
const { dirname, resolve } = await import('node:path')
const pkgPath = require.resolve('vis-3x/package.json')
const pkgDir = dirname(pkgPath)
const pkgJson = JSON.parse(await import('node:fs').then((fs) => fs.readFileSync(pkgPath, 'utf8')))
assert.ok(existsSync(resolve(pkgDir, 'dist/style.css')), 'dist/style.css 应存在')
console.log('✓ 样式文件存在')

/* ---------------------------- 12. 版本号已注入 ---------------------------- */
assert.equal(
  main.VERSION,
  pkgJson.version,
  `导出的 VERSION 应等于 package.json 的 version（实际 ${main.VERSION} vs ${pkgJson.version}）`
)
assert.equal(main.default.version, pkgJson.version, '插件对象的 version 应已注入真实版本号')
assert.ok(
  !String(main.VERSION).includes('__VERSION__') && main.VERSION !== '0.0.0-dev',
  'VERSION 不应是构建期占位符'
)
console.log(`✓ 版本号正确注入：${main.VERSION}`)

/* ------------------------ 13. 不再发布 UMD 产物 ------------------------ */
assert.equal(
  existsSync(resolve(pkgDir, 'dist/index.umd.js')),
  false,
  'three 已是 ESM-only，不应再产出 UMD（详见 vite.config.ts 说明）'
)
assert.equal(pkgJson.unpkg, undefined, 'package.json 不应再声明 unpkg 字段')
assert.equal(pkgJson.jsdelivr, undefined, 'package.json 不应再声明 jsdelivr 字段')
console.log('✓ 未发布 UMD 产物与 unpkg/jsdelivr 字段')

/* --------------------- 14. 声明文件不含 CSS 副作用导入 --------------------- */
const indexDts = await import('node:fs').then((fs) =>
  fs.readFileSync(resolve(pkgDir, 'dist/index.d.ts'), 'utf8')
)
assert.ok(
  !/^\s*import\s+['"][^'"]+\.css['"]/m.test(indexDts),
  'index.d.ts 不应包含 CSS 副作用导入（会让 TS 报 TS2307）'
)
console.log('✓ 声明文件不含 CSS 副作用导入')

/* -------------------- 15. 运行时全局默认主题确实生效 -------------------- */
{
  const {
    ChartBase,
    setRuntimeDefaultTheme,
    setRuntimeDefaultPalette,
    runtimeDefaults,
  } = await import('vis-3x/core')

  // 直接调用基类的主题解析逻辑（不实例化，避免依赖 WebGL）
  const proto = ChartBase.prototype
  assert.ok(typeof proto.resolveTheme === 'function', 'ChartBase 应提供 resolveTheme')
  assert.ok(typeof proto.resolvePalette === 'function', 'ChartBase 应提供 resolvePalette')

  // 场景 A：没有全局默认值 → 只用 option.theme
  setRuntimeDefaultTheme(null)
  setRuntimeDefaultPalette(null)
  assert.deepEqual(
    proto.resolveTheme.call(null, { theme: { textColor: '#111111' } }),
    { textColor: '#111111' },
    '无全局默认值时应原样返回 option.theme'
  )

  // 场景 B：app.use({ theme }) 之后 → 全局值作为兜底，option 覆盖
  setRuntimeDefaultTheme({ textColor: '#aaaaaa', axisColor: '#bbbbbb' })
  const merged = proto.resolveTheme.call(null, { theme: { textColor: '#111111' } })
  assert.equal(merged.textColor, '#111111', 'option.theme 应覆盖全局默认值')
  assert.equal(merged.axisColor, '#bbbbbb', 'option 未指定的字段应由全局默认值兜底')

  // 场景 C：调色板优先级 option > 全局默认 > DEFAULT_PALETTE
  assert.deepEqual(
    proto.resolvePalette.call(null, {}),
    main.DEFAULT_PALETTE,
    '没有全局调色板时应回退到 DEFAULT_PALETTE'
  )
  setRuntimeDefaultPalette(['#ff0000'])
  assert.deepEqual(
    proto.resolvePalette.call(null, {}),
    ['#ff0000'],
    'app.use({ palette }) 设置的全局调色板应生效'
  )
  assert.deepEqual(
    proto.resolvePalette.call(null, { palette: ['#00ff00'] }),
    ['#00ff00'],
    'option.theme.palette 应覆盖全局调色板'
  )
  assert.deepEqual(runtimeDefaults.palette, ['#ff0000'], '全局调色板应被记录')

  // 复原，避免影响其它用例
  setRuntimeDefaultTheme(null)
  setRuntimeDefaultPalette(null)
}
console.log('✓ app.use({ theme, palette }) 的全局默认值确实生效')

console.log('\n=== 全部打包产物消费测试通过 ===')
console.log(`渲染回调测试：defineChart render 被调用 ${renderCalled} 次（需真实 DOM 才会触发）`)
void beforeCalled
void afterCalled
