# 配置项结构

`Vis3xOption` 是整个库的核心数据结构。理解它的分层，后面看每个图表的文档都会轻松很多。

---

## 整体形状

```ts
interface Vis3xOption {
  // ① 图表类型（通常不用写，组件会推断）
  type?: ChartType

  // ② 数据系列 —— 这是唯一必填的部分
  series?: Series3D[]

  // ③ 坐标系
  xAxis3D?: Axis3D
  yAxis3D?: Axis3D
  zAxis3D?: Axis3D
  radar?: RadarConfig
  showCoordinate?: boolean

  // ④ 渲染环境
  lights?: LightConfig[]
  postprocessing?: PostprocessingOptions
  gridFloor?: GridFloorConfig
  controlSettings?: ControlSettings
  theme?: ThemeConfig
  backgroundColor?: string | null
  animation?: AnimationConfig
  interactive?: boolean
  onDemandRendering?: boolean

  // ⑤ 周边组件
  legend?: LegendStyle
  tooltip?: TooltipStyle
  label?: LabelStyle
  title?: { show?: boolean; text?: string; subtext?: string }
  loading?: boolean
}
```

只有 `series` 是必须的，其他都有合理默认值。一个最小可用的配置是：

```ts
const option = {
  series: [{ type: 'bar3D', data: [10, 20, 30] }],
}
```

它会自动推断出类目轴（1、2、3）、数值轴范围、网格尺寸、光照、相机位置。

---

## ① 图表类型

大多数时候**不需要写**：

- 用 `<VisBar3D>` 时，`type` 由组件注入
- 用 `createChart('bar3D', el)` 时，`type` 是第一个参数
- 用 `<VisChart>` 且不写 `type` 时，按 `series[0].type` 推断

需要显式指定的场景是**多类型混排**——比如柱线组合图：

```ts
{
  type: 'barLine3D',        // 显式声明：否则会按 series[0] 推断成 bar3D
  series: [
    { type: 'bar3D', name: '销量', data: [...] },
    { type: 'line3D', name: 'line:趋势', data: [...] },
  ],
}
```

---

## ② 系列（series）

系列是「数据 + 样式」的容器。每种图表类型有对应的系列接口，通过 `type` 字段区分。

### 数据的三种写法

```ts
series: [
  {
    type: 'bar3D',

    // 写法 1：纯数字数组
    data: [120, 200, 150],

    // 写法 2：对象数组（可以带名字与单项样式）
    // data: [
    //   { value: 120, name: '一月' },
    //   { value: 200, name: '二月', itemStyle: { color: '#f00' } },
    // ],

    // 写法 3：二维数组（散点图用坐标，曲面图用矩阵）
    // data: [[1, 20], [2, 35], [3, 28]],           // 散点：[x, y]
    // data: [[1, 20, 5], [2, 35, 8]],              // 散点：[x, y, z]
    // data: [[1, 2, 3], [4, 5, 6]],                // 曲面：矩阵
  },
]
```

### 系列级样式覆盖

```ts
series: [
  {
    type: 'bar3D',
    name: '销售额',
    data: [120, 200, 150],

    // 该系列独立调色板（优先级高于 option.theme.palette）
    color: ['#4f8cff', '#22d3ee', '#34d399'],

    // 该系列的数据项默认样式
    itemStyle: { roughness: 0.2, metalness: 0.5 },

    // 该系列的数据标签
    label: { show: true, formatter: '{value} 万', precision: 0 },

    // 该系列的动画（覆盖全局 animation）
    animation: { duration: 600, stagger: 40 },
  },
]
```

优先级：**数据项级 > 系列级 > 全局**。

```ts
series: [{
  type: 'bar3D',
  itemStyle: { color: '#4f8cff' },              // 系列级
  data: [
    120,
    { value: 200, itemStyle: { color: '#f00' } }, // 数据项级，覆盖系列级
    150,
  ],
}]
```

---

## ③ 坐标系

`xAxis3D` / `yAxis3D` / `zAxis3D` 分别对应 Three.js 的三个轴向。

```ts
{
  xAxis3D: {
    data: ['Q1', 'Q2', 'Q3', 'Q4'],   // 有 data 就是类目轴
    name: '季度',
  },
  yAxis3D: {
    name: '销售额',                     // 没有 data 就是数值轴
    min: 0,
    max: 300,
  },
  zAxis3D: {
    // 多系列时 z 轴用于并排展示；指定 data 可以作为第三个类目维度
  },
}
```

轴的具体字段见[坐标轴 API](/api/axis)。

::: tip 什么时候需要管 z 轴
单系列柱状图、折线图**不需要**配置 z 轴——库会自动把所有内容放在同一个深度平面上。

需要配 z 轴的场景：
- **多系列并排**：库会自动沿 z 轴错开，也可以显式指定
- **三维散点**：`zAxis3D` 决定第三维的范围
- **热力图 / 阶梯图**：`zAxis3D.data` 提供第二个类目维度
:::

---

## ④ 渲染环境

这一层决定图表的「观感」，不改数据。

### 光照

```ts
{
  lights: [
    { type: 'ambient', intensity: 0.55 },
    {
      type: 'directional',
      position: [1, 1.6, 1],
      intensity: 1.6,
      shadow: true,
      shadowMapSize: 2048,
    },
    // 补光：降低对比、柔化暗部
    { type: 'directional', position: [-1.2, 0.9, 0.8], color: '#dbeafe', intensity: 0.6 },
    // 轮廓光：勾出边缘
    { type: 'directional', position: [-0.6, 0.5, -1.4], color: '#93c5fd', intensity: 0.45 },
  ],
}
```

不传 `lights` 时使用上面这套默认的三点光照。

### 地面与背景

```ts
{
  gridFloor: {
    show: true,              // 地面网格
    color: '#33415c',
    divisions: 10,
    showWall: true,          // 背景墙（增强空间纵深感）
    wallOpacity: 0.12,
    showShadowPlane: true,   // 阴影承接面（让柱子「站」在地上）
    shadowPlaneOpacity: 0.55,
  },
}
```

### 相机

```ts
{
  controlSettings: {
    interactionMode: 'free',        // 'free' | 'rotate' | 'fixed'
    cameraDirection: { x: 1, y: 1.15, z: 1 },  // 调整俯角
    minPolarAngle: 0.2,             // 限制俯仰范围（弧度）
    maxPolarAngle: Math.PI / 2.1,
    autoRotate: true,               // 自动旋转
    autoRotateSpeed: 0.6,
    fitToScreenFactor: 0.82,        // 留白系数，越大越远
  },
}
```

详见[视角交互](./interaction)。

### 主题

```ts
{
  theme: {
    palette: ['#4f8cff', '#22d3ee', '#34d399'],
    backgroundColor: '#0a0f1c',
    textColor: '#94a3b8',
    axisColor: '#475569',
    splitLineColor: '#1e293b',
  },
}
```

也可以直接用预设：

```ts
import { themes } from 'vis-3x'

const option = { theme: themes.blue }
```

详见[主题与配色](./theme)。

---

## ⑤ 周边组件

这几个组件是 **HTML 覆盖层**，不参与 WebGL 渲染。好处是文字始终清晰，也能用 CSS 完全自定义外观。

```ts
{
  title: { show: true, text: '销售概览', subtext: '单位：万元' },
  legend: { show: true, position: 'bottom', selectable: true },
  tooltip: { show: true, trigger: 'item' },
  label: { show: true, precision: 1 },
}
```

它们的样式字段见 [样式 API](/api/style)。

---

## 配置合并规则

多次调用 `setOption` **不是深合并**，而是整体替换。这一点与 ECharts 一致。

```ts
chart.setOption({ series: [{ type: 'bar3D', data: [1, 2, 3] }] })
chart.setOption({ title: { text: '新标题' } })
// 结果：series 没了！只有 title
```

要保留原有配置，需要自己合并：

```ts
const next = {
  ...chart.getOption(),
  title: { text: '新标题' },
}
chart.setOption(next)
```

::: tip 为什么不做深合并
深合并带来两个问题：数组到底是「替换」还是「逐项合并」很难界定；
以及配置里删除一个字段就变得不可能（只能设为 `undefined`，容易出意外）。

整体替换的语义更可预测，也更容易做撤销/重做这类功能。
:::

---

## 下一步

- [坐标系与网格](./coordinate-system) — 数据怎么映射到空间
- [主题与配色](./theme) — 换肤与调色板
- [图表手册](/charts/bar) — 逐个图表看可用字段
