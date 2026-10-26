# vis-3x

> 基于 **Vue 3 + TypeScript + Three.js** 的 3D 数据可视化图表库。
> 支持 Vue 组件、组合式 API 与纯 JavaScript 三种用法，并提供 ECharts 风格的灵活扩展能力。

<p>
  <img src="https://img.shields.io/badge/three-%3E%3D0.160-000000" alt="three" />
  <img src="https://img.shields.io/badge/vue-%3E%3D3.3-42b883" alt="vue" />
  <img src="https://img.shields.io/badge/license-MIT-blue" alt="license" />
  <img src="https://img.shields.io/badge/types-included-3178c6" alt="types" />
  <img src="https://img.shields.io/badge/TypeScript%20%7C%20JavaScript-both-3178c6" alt="ts-js" />
</p>

> [!TIP]
> **TypeScript 与 JavaScript 都能用**
>
> 库用 TypeScript 编写，但**不要求使用者写 TypeScript**——类型标注只在编译期生效，
> 去掉它就是合法的 JavaScript。文档里每个示例都提供 TS / JS 两种写法。

```js
// 纯 JavaScript：能跑
import { createChart } from 'vis-3x'
import 'vis-3x/style.css'

const chart = createChart('bar3D', document.getElementById('chart'))
chart.setOption({
  xAxis3D: { data: ['A', 'B', 'C'] },
  series: [{ type: 'bar3D', data: [10, 20, 30] }],
})
```

> 📖 **完整文档**：本 README 是快速上手版。
>
> 详细的指南、每个图表的完整字段说明、自定义图表教程与 API 参考
> 都在文档站源码里（`apps/vis-3x-md/docs`），可用以下命令本地运行：
>
> ```bash
> pnpm --filter vis-3x-md dev      # 文档站
> pnpm --filter vis-3x-md home:dev # 门户首页
> ```

---

## ✨ 特性

- **10 种内置 3D 图表** — 柱状、折线、面积、饼图/环形/玫瑰、散点、曲面、雷达、漏斗、仪表盘、热力图
- **像 ECharts 一样自由扩展** — `defineChart()` 函数式定义、`extendChart()` 继承改写、`registerChart()` 注册类、插件系统
- **三套 API，同一内核** — Vue 组件 / `useVisChart` 组合式 / `createChart` 命令式（**不需要 Vue 也能用**）
- **完整 TypeScript 类型** — 可辨识联合让 `series[].type` 自动收窄，35+ 声明文件
- **按需引入** — 8 个子路径入口（`vis-3x/core`、`vis-3x/charts` …），支持 tree-shaking
- **双产物格式** — ESM + CJS（`three` 为纯 ESM 包，不提供 UMD）
- **开箱即用的视觉质量** — 三点光照、ACES 色调映射、软阴影、圆角柱体、玻璃拟态标签
- **按需渲染** — 场景静止时自动停止重绘，显著降低 GPU 占用
- **健壮的资源管理** — 几何体/材质/贴图统一登记释放，材质参数化缓存，杜绝 WebGL 泄漏
- **5 套主题预设** — `dark` / `light` / `blue` / `warm` / `mono`
- **易迁移** — 内置 ECharts 配置适配器 `fromEchartsLikeOption()`

---

## 📦 安装

```bash
npm install vis-3x three
# 使用 Vue 组件时再装 vue
npm install vis-3x three vue
```

`three` 与 `vue` 是 **peerDependencies**，由你的项目提供，不会被重复打包。

---

## 🚀 快速开始

### 方式一：Vue 3 全局注册

```ts
// main.ts
import { createApp } from 'vue'
import App from './App.vue'
import Vis3x from 'vis-3x'
import 'vis-3x/style.css'

createApp(App)
  .use(Vis3x, { extraCharts: true }) // extraCharts 会注册 6 个示例扩展图表
  .mount('#app')
```

```vue
<script setup lang="ts">
import type { Vis3xOption } from 'vis-3x'

const option: Vis3xOption = {
  title: { show: true, text: '季度销售额' },
  xAxis3D: { data: ['Q1', 'Q2', 'Q3', 'Q4'] },
  yAxis3D: { name: '销售额' },
  legend: { show: true },
  tooltip: { show: true },
  series: [
    { type: 'bar3D', name: '2024', data: [120, 200, 150, 80] },
    { type: 'bar3D', name: '2025', data: [150, 230, 190, 120] },
  ],
}
</script>

<template>
  <!-- 容器必须有明确高度 -->
  <div style="height: 460px">
    <VisBar3D :option="option" />
  </div>
</template>
```

### 方式二：按需引入

```vue
<script setup lang="ts">
import { VisLine3D } from 'vis-3x'
import 'vis-3x/style.css'

const option = {
  xAxis3D: { data: ['1月', '2月', '3月', '4月', '5月'] },
  // 使用 VisLine3D 时 series[].type 可省略，组件会自动补全为 'line3D'
  series: [{ data: [820, 932, 901, 1290, 1330], curtain: true }],
}
</script>

<template>
  <div style="height: 400px"><VisLine3D :option="option" /></div>
</template>
```

### 方式三：纯 JavaScript（不需要 Vue）

```js
import { createChart } from 'vis-3x'
import 'vis-3x/style.css'

const chart = createChart('bar3D', document.getElementById('chart'))

chart.setOption({
  xAxis3D: { data: ['A', 'B', 'C', 'D'] },
  series: [{ type: 'bar3D', data: [30, 80, 45, 95] }],
})

chart.on('chart:click', (p) => console.log(p.name, p.value))

// 销毁，释放 WebGL 资源
// chart.dispose()
```

### 方式四：组合式 API

```vue
<script setup lang="ts">
import { ref } from 'vue'
import { useVisChart, type Vis3xOption } from 'vis-3x'

const container = ref<HTMLDivElement>()
const option = ref<Vis3xOption>({
  xAxis3D: { data: ['A', 'B', 'C'] },
  series: [{ type: 'bar3D', data: [10, 20, 30] }],
})

const { chart, isReady, exportImage, resetCamera } = useVisChart({ container, option })
</script>

<template>
  <div>
    <button @click="exportImage({ scale: 2 })">导出 PNG</button>
    <div ref="container" style="height: 420px" />
  </div>
</template>
```

### 方式五：CDN（import map）

> [!IMPORTANT]
> `three` 自 0.150 起是**纯 ESM 包**，官方不再提供 `build/three.min.js` 这类浏览器全局
> 构建，因此 `vis-3x` **不发布 UMD 产物**（`<script src=".../index.umd.js">` 的组合
> 在运行时会报 `THREE.WebGLRenderer is not a constructor`）。
> 浏览器里请用 ESM + import map：

```html
<link rel="stylesheet" href="https://unpkg.com/vis-3x/dist/style.css" />
<div id="chart" style="height: 400px"></div>

<script type="importmap">
{
  "imports": {
    "three": "https://esm.sh/three@0.160.0",
    "three/": "https://esm.sh/three@0.160.0/",
    "vue": "https://esm.sh/vue@3.5.13",
    "vis-3x": "https://esm.sh/vis-3x"
  }
}
</script>

<script type="module">
  import { createChart } from 'vis-3x'
  const chart = createChart('bar3D', document.getElementById('chart'))
  chart.setOption({ series: [{ type: 'bar3D', data: [1, 2, 3] }] })
</script>
```

---

## 🎨 自定义图表（核心能力）

### 方式 A：`defineChart()` — 函数式定义（推荐）

不需要继承类，只描述「怎么画」：

```ts
import * as THREE from 'three'
import { defineChart, createChart } from 'vis-3x'

defineChart({
  type: 'lollipop3D',
  render(ctx) {
    const series = ctx.series[0]

    series.data.forEach((item, i) => {
      const value = typeof item === 'number' ? item : item.value
      const x = ctx.coord.xAtCategory(i)   // 类目 → 世界 X
      const h = ctx.coord.yAt(value)       // 数值 → 世界 Y
      const color = ctx.theme.colorAt(i)

      // 细杆（几何体会自动登记，销毁时释放）
      const stem = new THREE.Mesh(
        ctx.geometry.cylinder(0.06, 0.06, h, 12),
        ctx.material(color, { roughness: 0.4, metalness: 0.3 })
      )
      stem.position.set(x, h / 2, 0)
      ctx.add(stem)

      // 顶部圆球 + 交互
      const ball = new THREE.Mesh(ctx.geometry.sphere(0.22, 20), ctx.material(color))
      ball.position.set(x, h, 0)
      ctx.pickable(ball, { seriesIndex: 0, dataIndex: i, value, color })
      ctx.add(ball)

      // 标签
      if (series.label?.show) {
        ctx.anchor(x, h + 0.45, 0, String(value), series.label)
      }
    })
  },
})

const chart = createChart('lollipop3D', document.getElementById('el')!)
chart.setOption({
  xAxis3D: { data: ['搜索', '社交', '邮件'] },
  series: [{ type: 'lollipop3D', data: [38, 52, 24] }],
})
```

**`ctx` 渲染上下文提供：**

| 能力 | API |
|---|---|
| 坐标映射 | `ctx.coord.xAt()` / `yAt()` / `zAt()` / `xAtCategory()` / `barSlot()` |
| 几何体 | `ctx.geometry.box()` / `sphere()` / `cylinder()` / `plane()` / `circle()` / `extrude()` / `tube()` |
| 材质 | `ctx.material(color, style)`（带缓存）/ `ctx.uniqueMaterial()` |
| 挂载 | `ctx.add(object)` / `ctx.anchor(x,y,z,text,style)` / `ctx.label()` |
| 交互 | `ctx.pickable(object, meta)` |
| 主题 | `ctx.theme.palette` / `colorAt()` / `textColor` / `axisColor` |
| 动画 | `ctx.animation.add({ duration, easing, onUpdate })` |
| 重绘 | `ctx.invalidate()` |

### 方式 B：`extendChart()` — 继承改写内置图表

复用内置渲染逻辑，只做微调：

```ts
import { extendChart } from 'vis-3x'

// 在柱状图基础上追加一条趋势折线
extendChart('bar3D', {
  type: 'barLine3D',
  afterRender(ctx) {
    // 父类已经把柱子画完了，这里追加折线
    const lineSeries = ctx.allSeries.filter((s) => s.type === 'line3D')
    lineSeries.forEach((series) => {
      const points = series.data.map((item, i) => {
        const v = typeof item === 'number' ? item : item.value
        return new THREE.Vector3(
          ctx.coord.xAtCategory(i),
          ctx.coord.yAt(v),
          ctx.coord.grid.gridDepth / 2 + 0.42
        )
      })
      const mesh = new THREE.Mesh(
        ctx.geometry.tube(points, 0.06),
        ctx.material('#22d3ee', { emissive: '#22d3ee', emissiveIntensity: 0.3 })
      )
      ctx.add(mesh)
    })
  },
})
```

### 方式 C：`registerChart()` — 注册完整图表类

```ts
import { ChartBase, registerChart, type ResolvedChartOption } from 'vis-3x'

class MyChart extends ChartBase {
  get chartType() { return 'my3D' }

  protected renderSeries(option: ResolvedChartOption) {
    // this.cartesian    坐标映射
    // this.resources    几何体/材质管理
    // this.content      挂载内容的分组
    // this.labels       标签管理
    // this.animations   动画管理
  }
}

registerChart('my3D', MyChart, { aliases: ['my'] })
```

### 方式 D：插件 — 打包复用

```ts
import { useChartPlugin } from 'vis-3x'

useChartPlugin({
  name: 'my-chart-pack',
  install({ defineChart, extendChart, registerChart }) {
    defineChart({ type: 'chartA', render(ctx) { /* ... */ } })
    defineChart({ type: 'chartB', render(ctx) { /* ... */ } })
  },
})

// 或通过插件选项一次性安装
app.use(Vis3x, { plugins: [myChartPack] })
```

---

## 📊 内置图表

| 组件 | 类型标识 | 说明 |
|---|---|---|
| `<VisBar3D>` | `bar3D` | 柱状图：多系列、堆叠、圆角、按值渐变、顶盖高光 |
| `<VisLine3D>` | `line3D` | 折线图：平滑曲线、垂幕纵深、数据点 |
| `<VisArea3D>` | `area3D` | 面积图：带厚度的实体面片 |
| `<VisPie3D>` | `pie3D` | 饼图 / 环形 / 南丁格尔玫瑰 |
| `<VisScatter3D>` | `scatter3D` | 散点图：`[x,y]` / `[x,y,z]`、多种 symbol |
| `<VisSurface3D>` | `surface3D` | 曲面图：顶点色映射、线框、等高线、侧壁 |
| `<VisRadar3D>` | `radar3D` | 雷达图：多层立体蛛网 |
| `<VisFunnel3D>` | `funnel3D` | 漏斗 / 金字塔 |
| `<VisGauge3D>` | `gauge3D` | 仪表盘：环带、指针、刻度 |
| `<VisHeatmap3D>` | `heatmap3D` | 热力图：高度 + 颜色双映射 |

通用组件 `<VisChart>` 按 `option.type` 自动选择类型。

### 附带的示例扩展图表

调用 `useExtraCharts()` 或 `app.use(Vis3x, { extraCharts: true })` 后可用：

`lollipop3D`（棒棒糖）· `bubble3D`（气泡）· `barLine3D`（柱线组合）·
`pyramid3D`（金字塔）· `ringProgress3D`（多环进度）· `stepTerrain3D`（阶梯地形）

这些图表**全部用公开 API 实现**，源码在 `src/presets/extra-charts.ts`，可作为扩展范例。

---

## ⚙️ 配置项速查

```ts
interface Vis3xOption {
  type?: ChartType              // 不传则按首个系列推断
  series?: Series3D[]           // 系列（数据 + 样式）

  // 坐标系
  xAxis3D?: Axis3D
  yAxis3D?: Axis3D
  zAxis3D?: Axis3D
  radar?: RadarConfig
  showCoordinate?: boolean

  // 渲染环境
  lights?: LightConfig[]
  postprocessing?: PostprocessingOptions
  gridFloor?: GridFloorConfig
  controlSettings?: ControlSettings
  theme?: ThemeConfig
  backgroundColor?: string | null
  animation?: AnimationConfig
  interactive?: boolean
  onDemandRendering?: boolean

  // 组件
  legend?: LegendStyle
  tooltip?: TooltipStyle
  label?: LabelStyle
  title?: { show?: boolean; text?: string; subtext?: string }
  loading?: boolean
}
```

**自定义光照**

```ts
lights: [
  { type: 'ambient', intensity: 0.5 },
  { type: 'directional', position: [1, 1.8, 1], intensity: 1.8, shadow: true },
  { type: 'directional', position: [-1, 0.8, -1], color: '#93c5fd', intensity: 0.5 },
]
```

**限制相机**

```ts
controlSettings: {
  minPolarAngle: Math.PI / 8,
  maxPolarAngle: Math.PI / 2.2,
  enablePan: false,
  autoRotate: true,
  autoRotateSpeed: 0.6,
}
```

**视角交互模式（固定 / 自由）**

用一个语义化开关决定用户能否用鼠标调整视角：

```ts
controlSettings: {
  interactionMode: 'free',   // 默认：旋转 + 缩放 + 平移
  // interactionMode: 'rotate'  // 仅旋转：锁定远近与位置
  // interactionMode: 'fixed'   // 固定视角：完全锁定
}
```

| 模式 | 旋转 | 缩放 | 平移 | 适用场景 |
|---|---|---|---|---|
| `'free'`（默认） | ✅ | ✅ | ✅ | 探索性数据展示 |
| `'rotate'` | ✅ | ❌ | ❌ | 允许换角度但保持构图稳定 |
| `'fixed'` | ❌ | ❌ | ❌ | 大屏看板、导出、演示 |

Vue 组件也提供同名 prop：

```vue
<VisBar3D :option="option" interaction-mode="fixed" />
```

运行时切换：

```ts
chart.setInteractionMode('fixed')   // 锁定
chart.setInteractionMode('free')    // 恢复
chart.interactionMode               // 读取当前模式
chart.isCameraInteractive           // 相机是否可操作
```

> **重要**：`interactionMode` 只影响**相机**。悬停高亮、点击事件、提示框等
> **数据交互仍然可用**，即使在 `'fixed'` 下也能响应数据。若要连数据交互一起关闭，
> 请设 `interactive: false`。

显式字段优先级高于模式默认值：

```ts
controlSettings: {
  interactionMode: 'fixed',  // 模式说「全禁用」
  enableZoom: true,          // 但显式开启缩放 → 最终可缩放
}
```

**数据标签**

```ts
series: [{
  type: 'bar3D',
  data: [120, 200, 150],
  label: {
    show: true,
    formatter: '{name}: {value} 万元',
    precision: 0,
    textStyle: { color: '#f1f5f9', fontSize: 12 },
  },
}]
```

**堆叠柱状图**

```ts
series: [
  { type: 'bar3D', name: '线上', stack: 'total', data: [120, 132, 101] },
  { type: 'bar3D', name: '线下', stack: 'total', data: [220, 182, 191] },
]
```

---

## 🎯 事件

```vue
<VisBar3D
  :option="option"
  @click="onClick"
  @mouseover="onHover"
  @rendered="onRendered"
  @legend-toggle="onLegendToggle"
/>
```

```ts
function onClick(p: {
  seriesIndex: number
  dataIndex: number
  name?: string
  seriesName?: string
  value: number | number[]
  color: string
  object: THREE.Object3D
  position: THREE.Vector3
  event: MouseEvent
}) { /* ... */ }
```

| 事件 | 说明 |
|---|---|
| `click` / `dblclick` | 点击 / 双击数据元素 |
| `mouseover` / `mouseout` / `mousemove` | 悬停相关 |
| `mousedown` / `mouseup` | 鼠标按键 |
| `rendered` | 渲染完成（含耗时） |
| `legend-toggle` | 图例项显隐切换 |
| `camera-change` | 相机变化 |
| `ready` | 实例就绪（返回 ChartBase） |

---

## 🔧 实例方法

```ts
const ref = ref()
// <VisBar3D ref="ref" :option="option" />

ref.value.exportImage({ scale: 2 })  // 导出 PNG DataURL
ref.value.resize()                    // 重算尺寸
ref.value.fitToScreen()               // 相机自适应
ref.value.resetCamera()               // 重置视角
ref.value.setOption(newOption)        // 命令式更新
ref.value.getChart()                  // 底层 ChartBase 实例
ref.value.on('chart:click', handler)  // 订阅事件
```

---

## 🎨 主题

```ts
import { themes, extendTheme } from 'vis-3x'

const option = {
  theme: themes.blue,
  // 或局部覆盖
  // theme: extendTheme('dark', { textColor: '#aabbcc' }),
  series: [{ type: 'bar3D', data: [1, 2, 3] }],
}
```

也可以直接传调色板：`<VisBar3D :option="option" :palette="['#f00','#0f0']" />`

覆盖 HTML 覆盖层样式：

```css
.vt-container {
  --vt-font-family: 'Inter', sans-serif;
  --vt-tooltip-bg: rgba(15, 23, 42, 0.94);
  --vt-tooltip-color: #f1f5f9;
  --vt-title-color: #e2e8f0;
}
```

---

## 📦 按需引入（子路径）

```ts
import { createChart, defineChart } from 'vis-3x/core'      // 内核 + 扩展 API
import { Bar3DChart } from 'vis-3x/charts'                  // 图表实现类
import { VisBar3D } from 'vis-3x/components'                // Vue 组件
import { useVisChart } from 'vis-3x/composables'            // 组合式函数
import type { Vis3xOption } from 'vis-3x/types'             // 纯类型
import { clamp, gradientColorAt } from 'vis-3x/utils'       // 工具
import { fromEchartsLikeOption } from 'vis-3x/adapters'     // 适配器
import { themes, useExtraCharts } from 'vis-3x/presets'     // 主题 + 示例图表
```

---

## 🔄 从 ECharts 迁移

```ts
import { fromEchartsLikeOption } from 'vis-3x'

const option = fromEchartsLikeOption({
  color: ['#4f8cff', '#22d3ee'],
  xAxis: { type: 'category', data: ['A', 'B', 'C'] },
  yAxis: { type: 'value', name: '数值' },
  series: [{ type: 'bar', data: [120, 200, 150] }],
  tooltip: { show: true },
  legend: { show: true },
})
```

---

## 🏗️ 架构

```
createChart / <VisBar3D> / useVisChart / defineChart
                    │
            ┌───────▼────────┐
            │   ChartBase    │  生命周期 · 配置解析 · 事件 · 导出
            └───────┬────────┘
                    │
   ┌──────────┬─────┴─────┬──────────────┐
   ▼          ▼           ▼              ▼
Cartesian3D SceneEnv  Interaction   LabelManager
 坐标映射    轴/网格    射线拾取      CSS2D 标签
   └──────────┴─────┬─────┴──────────────┘
                    ▼
                 Engine
     场景 · 相机 · 渲染器 · 光照 · 控制器 · 按需渲染
                    │
          ResourceManager（几何体/材质/贴图 统一管理）
```

各层职责清晰、可独立替换：不想要 Vue 就只用 `Engine` + `ChartBase`。

---

## ⚙️ 环境要求

- Node.js >= 18
- Vue >= 3.3（**仅使用组件时需要**；命令式 API 不依赖 Vue 运行时）
- Three.js >= 0.160
- 支持 WebGL 2 的浏览器

---

## 📄 许可证

[MIT](./LICENSE)

本项目为独立实现，未复制任何第三方图表库的源代码。
