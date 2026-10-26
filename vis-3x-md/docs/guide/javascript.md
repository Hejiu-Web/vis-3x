# 纯 JavaScript 使用

vis-3x 用 TypeScript 编写，但**不要求使用者写 TypeScript**。

所有 API 在纯 JavaScript 下完全可用——类型标注只是编译期的提示，运行时不参与。
这一页给出完整的 JS 用法，可以把它当作「不用 TS 时的官方文档」。

---

## 前提：库与 JS 的关系

| 事实 | 说明 |
|---|---|
| 发布产物是 JS | `dist/index.js`（ESM）、`dist/index.cjs`（CJS） |
| 类型定义是独立的 | `dist/index.d.ts`，**不引用它也不影响运行** |
| `vis-3x` + `three` 就够 | 只用命令式 API 时**连 Vue 都不用装** |

```bash
# 纯 JS 最小安装：不需要 vue，不需要 @types/*
npm install vis-3x three
```

::: tip 什么时候需要 vue
只有用 `<VisBar3D>` 这类 **Vue 组件**时才需要装 `vue`。
用 `createChart()` 命令式 API 完全不依赖 Vue 运行时。
:::

---

## 三种 JS 环境

::: warning 浏览器里请走 ESM（不支持 `<script src>` 直引）
`three` 自 0.150 起是纯 ESM 包，不再提供 `build/three.min.js` 这类浏览器全局构建，
所以 `vis-3x` **不发布 UMD 产物**。要用得先经构建工具打包，或用下面的 import map。
:::

::: code-group

```html [浏览器 import map（无构建）]
<link rel="stylesheet" href="https://unpkg.com/vis-3x/dist/style.css" />
<div id="chart" style="height: 460px"></div>

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
  chart.setOption({
    xAxis3D: { data: ['A', 'B', 'C', 'D'] },
    series: [{ type: 'bar3D', data: [30, 80, 45, 95] }],
  })
</script>
```

```js [ESM（Vite / webpack 等）]
// 走打包器时用 ESM 入口
import { createChart, themes, useExtraCharts } from 'vis-3x'
import 'vis-3x/style.css'

const chart = createChart('bar3D', document.getElementById('chart'))

chart.setOption({
  xAxis3D: { data: ['A', 'B', 'C', 'D'] },
  series: [{ type: 'bar3D', data: [30, 80, 45, 95] }],
})
```

```js [CommonJS（Node / 老构建）]
// CJS 产物，require 即可
const { createChart, themes } = require('vis-3x')
require('vis-3x/style.css') // 打包器会处理；纯 Node 环境请忽略这行

const chart = createChart('bar3D', document.getElementById('chart'))
chart.setOption({
  xAxis3D: { data: ['A', 'B', 'C', 'D'] },
  series: [{ type: 'bar3D', data: [30, 80, 45, 95] }],
})
```

:::

---

## 配置对象：JS 里怎么写

TS 里的 `const option: Vis3xOption = {...}` 在 JS 里**去掉类型标注**即可：

::: code-group

```ts [TypeScript]
import type { Vis3xOption } from 'vis-3x'

const option: Vis3xOption = {
  xAxis3D: { data: ['Q1', 'Q2', 'Q3', 'Q4'] },
  yAxis3D: { name: '销售额' },
  series: [{ type: 'bar3D', name: '2025', data: [120, 200, 150, 80] }],
}
```

```js [JavaScript]
// 类型标注去掉就行，其余一模一样
const option = {
  xAxis3D: { data: ['Q1', 'Q2', 'Q3', 'Q4'] },
  yAxis3D: { name: '销售额' },
  series: [{ type: 'bar3D', name: '2025', data: [120, 200, 150, 80] }],
}
```

:::

::: warning `type` 字段不能省
TS 里 `series[].type` 有自动补全，JS 里没有。**写错一个字就会报「未知的图表类型」**。

可用的类型名：

```
笛卡尔：bar3D  line3D  area3D  scatter3D  surface3D  heatmap3D
非笛卡尔：pie3D  radar3D  funnel3D  gauge3D
扩展示例（需注册）：lollipop3D  bubble3D  barLine3D  pyramid3D  ringProgress3D  stepTerrain3D
```

用 `getRegisteredTypes()` 可以在控制台随时查证。
:::

---

## 命令式用法（推荐给 JS）

### 创建与更新

```js
import { createChart } from 'vis-3x'
import 'vis-3x/style.css'

const chart = createChart('bar3D', document.getElementById('chart'))

// 首次配置
chart.setOption({
  xAxis3D: { data: ['A', 'B', 'C'] },
  series: [{ type: 'bar3D', data: [10, 20, 30] }],
})

// 更新：整体替换，不是深合并
chart.setOption({
  xAxis3D: { data: ['A', 'B', 'C'] },
  series: [{ type: 'bar3D', data: [30, 10, 20] }],
})
```

::: danger `setOption` 是整体替换
```js
chart.setOption({ series: [{ type: 'bar3D', data: [1, 2, 3] }] })
chart.setOption({ title: { text: '新标题' } })
// ✗ series 没了，图表空了
```

要保留原配置，先取出来合并：

```js
const next = Object.assign({}, chart.getOption(), {
  title: { text: '新标题' },
})
chart.setOption(next)
```
:::

### 事件

```js
// on() 返回取消订阅的函数
const off = chart.on('chart:click', function (payload) {
  console.log(payload.seriesName + ' · ' + payload.name + ' = ' + payload.value)
})

// 需要时取消
off()

// 悬停
chart.on('chart:mouseover', function (p) {
  console.log('hover: ' + p.name)
})

// 渲染完成
chart.on('chart:rendered', function (info) {
  console.log('渲染耗时 ' + info.duration.toFixed(1) + 'ms')
})
```

事件名与负载结构见[事件列表](/api/events)。

### 销毁

```js
// 不用了必须销毁，否则 WebGL 上下文会累积
chart.dispose()
```

::: danger JS 使用者最容易漏掉这一步
在 Vue / React 里组件卸载会自动清理，但**纯 JS 没有生命周期**。
路由切换、弹窗关闭、Tabs 切换时都要手动 `dispose()`。

浏览器通常限制 8~16 个 WebGL 上下文，超出后新图表创建失败。
:::

---

## 完整的 JS 页面示例

一个可直接粘贴到 `.html` 就跑的完整例子：

```html
<!doctype html>
<html lang="zh-CN">
  <head>
    <meta charset="utf-8" />
    <title>vis-3x 纯 JS 示例</title>
    <link rel="stylesheet" href="https://unpkg.com/vis-3x/dist/style.css" />
    <style>
      body { margin: 0; background: #0a0f1c; font-family: system-ui, sans-serif; }
      #chart { width: 100vw; height: 100vh; }
      #tip { position: fixed; left: 16px; top: 16px; color: #94a3b8; font-size: 13px; }
    </style>
  </head>
  <body>
    <div id="chart"></div>
    <div id="tip">点击柱子试试</div>

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
      import { createChart, themes } from 'vis-3x'

      const el = document.getElementById('chart')
      const tip = document.getElementById('tip')

      const chart = createChart('bar3D', el)

      chart.setOption({
        title: { show: true, text: '季度销售额', subtext: '单位：万元' },
        xAxis3D: { data: ['Q1', 'Q2', 'Q3', 'Q4'], name: '季度' },
        yAxis3D: { name: '销售额' },
        legend: { show: true, position: 'bottom' },
        tooltip: { show: true },
        theme: themes.dark,
        series: [
          { type: 'bar3D', name: '2024 年', data: [120, 200, 150, 80] },
          { type: 'bar3D', name: '2025 年', data: [150, 230, 190, 120] },
        ],
        animation: { enabled: true, duration: 900, stagger: 60 },
      })

      chart.on('chart:click', function (p) {
        tip.textContent = p.seriesName + ' · ' + p.name + ' = ' + p.value + ' 万'
      })

      // 窗口变化时重算尺寸
      window.addEventListener('resize', function () {
        chart.resize()
      })

      // 页面卸载时释放
      window.addEventListener('beforeunload', function () {
        chart.dispose()
      })
    </script>
  </body>
</html>
```

---

## 在 React / 其他框架里用

纯 JS 的核心是「自己管生命周期」。以 React 为例：

```jsx
import { useEffect, useRef } from 'react'
import { createChart } from 'vis-3x'
import 'vis-3x/style.css'

export function BarChart({ data }) {
  const containerRef = useRef(null)
  const chartRef = useRef(null)

  // 创建一次，卸载时销毁
  useEffect(() => {
    const chart = createChart('bar3D', containerRef.current)
    chartRef.current = chart

    return () => {
      chart.dispose()
      chartRef.current = null
    }
  }, [])

  // 数据变化时更新（不重建实例）
  useEffect(() => {
    if (!chartRef.current) return
    chartRef.current.setOption({
      xAxis3D: { data: data.map((_, i) => '第 ' + (i + 1) + ' 项') },
      series: [{ type: 'bar3D', data: data }],
    })
  }, [data])

  return <div ref={containerRef} style={{ height: 420 }} />
}
```

::: tip 两个 useEffect 缺一不可
第一个管**实例生命周期**（空依赖数组），第二个管**数据更新**（依赖 data）。

合在一起会导致每次数据变化都重建整个 WebGL 场景，性能很差。
:::

---

## 自定义图表（JS 版）

`defineChart` 在 JS 里同样可用，只是**没有参数类型提示**：

```js
import * as THREE from 'three'
import { defineChart, createChart } from 'vis-3x'

defineChart({
  type: 'lollipop3D',

  // ctx 的结构见 /custom/render-context
  render: function (ctx) {
    var series = ctx.series[0]
    var plan = ctx.transition

    series.data.forEach(function (item, i) {
      // 纯 JS：需要自己判断数据形状
      var value = typeof item === 'number' ? item : item.value

      var x = ctx.coord.xAtCategory(i)
      var h = Math.max(ctx.coord.yAt(value), 0.0001)
      var color = ctx.theme.colorAt(i)

      // 细杆
      var stem = new THREE.Mesh(
        ctx.geometry.cylinder(0.055, 0.055, h, 12),
        ctx.material(color, { roughness: 0.4, metalness: 0.3 })
      )
      stem.position.set(x, h / 2, 0)
      ctx.add(stem)

      // 顶部圆球
      var ball = new THREE.Mesh(
        ctx.geometry.sphere(0.22, 22),
        ctx.material(color, { emissive: color, emissiveIntensity: 0.35 })
      )
      ball.position.set(x, h, 0)

      // 标记为可交互
      ctx.pickable(ball, {
        seriesIndex: 0,
        dataIndex: i,
        name: ctx.coord.categoryName(i),
        value: value,
        color: color,
      })
      ctx.add(ball)

      // 生长动画
      plan.custom(
        function (t) {
          var hh = Math.max(0.0001, h * t)
          stem.scale.y = hh / h
          stem.position.y = hh / 2
          ball.position.y = hh
        },
        i,
        {
          finish: function () {
            stem.scale.y = 1
            stem.position.y = h / 2
            ball.position.y = h
          },
        }
      )
    })

    plan.run()
    ctx.keepAnimating()
  },
})

createChart('lollipop3D', document.getElementById('chart'))
```

::: warning JS 里没有类型检查的保护
TS 会把 `ctx.coord.yAtCategory` 这种拼写错误标红，JS 只会在运行时得到 `undefined`，
表现为柱子位置错乱或完全不显示。

**建议开发时打开控制台**，注意看有没有 `undefined` 相关的错误。
:::

---

## 扩展示例图表：记得注册

6 个扩展示例图表默认不注册，JS 里同样要显式调用：

```js
import { useExtraCharts, getRegisteredTypes } from 'vis-3x'

// 注册全部 6 个
useExtraCharts()

// 或者只注册需要的
useExtraCharts(['lollipop3D', 'ringProgress3D'])

// 查证是否成功
console.log(getRegisteredTypes())
// ['bar3D', ..., 'lollipop3D', 'ringProgress3D']
```

不注册就创建会报：

```
[vis-3x] 未知的图表类型 "lollipop3D"。
已注册类型: bar3D, line3D, area3D, ...
```

---

## JS 与 TS 的差异清单

| 场景 | TypeScript | JavaScript |
|---|---|---|
| 配置对象 | `const option: Vis3xOption = {}` | `const option = {}` |
| 导入类型 | `import type { ... }` | 不需要，删掉 |
| `series[].type` | 自动补全 + 拼错报错 | 手写，拼错运行时才报 |
| `ctx` 参数 | 有完整类型提示 | 无提示，靠文档 |
| 泛型 | `SeriesOf<'bar3D'>` | 不存在 |
| 数据项 | 编译期检查形状 | 需要自己判断 |
| **运行时行为** | 完全相同 | 完全相同 |

::: tip 混用也没问题
`.ts` 文件里可以不写类型（等于 JS），`.js` 文件里也可以用 JSDoc 获得提示：

```js
/**
 * @param {import('vis-3x').Vis3xOption} option
 */
function render(option) {
  chart.setOption(option)
}
```

VS Code 会读 JSDoc 给出补全，兼顾灵活性与提示。
:::

---

## 常见问题

::: details JS 里 import 报错 Cannot use import statement
你用的是 CommonJS 环境。两种解法：

```js
// ① 改用 require
const { createChart } = require('vis-3x')
```

```json
// ② 或在 package.json 里声明 ESM
{
  "type": "module"
}
```
:::

::: details 图表不显示，控制台没报错
按顺序检查：

1. 容器有没有高度？`<div id="chart">` 默认高度是 0
2. 引入 `vis-3x/style.css` 了吗？没引会导致标签错乱（但图表本体还能显示）
3. `series[].type` 拼对了吗？用 `getRegisteredTypes()` 核对
:::

::: details 报错「未知的图表类型」
三种可能：

1. `type` 拼错（`bar3d` ≠ `bar3D`，**注意大写 D**）
2. 用的是扩展图表但没调 `useExtraCharts()`
3. 用 `<VisChart>` 时没显式写 `type`，导致推断成了别的类型
:::

::: details 内存一直涨
忘了 `dispose()`。纯 JS 没有组件生命周期帮你清理。

```js
const chart = createChart('bar3D', el)
// ... 用完
chart.dispose()   // ← 必须调用
```
:::

---

## 下一步

- [配置项 Option](/api/option) — 所有字段（TS 写法，JS 去掉类型即可）
- [图表手册](/charts/bar) — 每个图表都有 TS / JS 双标签页
- [自定义图表](/custom/) — 扩展 API
