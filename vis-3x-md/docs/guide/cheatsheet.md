# 配置速查

一页看完常用配置。适合已经读过[配置项结构](/guide/option-structure)、需要快速回忆字段名时查阅。

---

## 完整结构

```ts
interface Vis3xOption {
  type?: ChartType              // 不传则按 series[0].type 推断
  series?: Series3D[]           // 系列（数据 + 样式）——唯一必填

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

  // 周边组件
  legend?: LegendStyle
  tooltip?: TooltipStyle
  label?: LabelStyle
  title?: { show?: boolean; text?: string; subtext?: string }
  loading?: boolean
}
```

---

## 最小配置

```ts
const option = {
  series: [{ type: 'bar3D', data: [10, 20, 30] }],
}
```

轴、网格、光照、相机全部自动推导。

---

## 数据

```ts
// 纯数字
data: [120, 200, 150]

// 带名字
data: [{ value: 120, name: '一月' }]

// 带独立样式
data: [
  120,
  { value: 200, itemStyle: { color: '#f00' } },
]

// 多维（散点）
data: [[1, 20], [2, 35, 5]]      // [x, y] 或 [x, y, z]

// 矩阵（曲面 / 地形）
data: [[1, 2, 3], [4, 5, 6]]

// 三元组（热力图）
data: [[xIndex, zIndex, value]]
```

---

## 坐标系

```ts
// 类目轴（有 data）
xAxis3D: { data: ['Q1', 'Q2', 'Q3', 'Q4'], name: '季度' }

// 数值轴（无 data）
yAxis3D: { type: 'value', min: 0, max: 300, name: '销售额' }

// 隐藏坐标系
showCoordinate: false
```

轴样式：

```ts
yAxis3D: {
  name: '销售额',
  min: 0,
  max: 300,
  axisLine: { lineStyle: { color: '#475569' } },
  axisTick: { show: true, length: 0.18 },
  axisLabel: { precision: 0, abbreviate: true, margin: 0.42 },
  splitLine: { show: true, splitNumber: 5 },
}
```

---

## 光照

```ts
// 默认三点光照（不写就是这样）
lights: [
  { type: 'ambient', intensity: 0.55 },
  { type: 'directional', position: [1, 1.6, 1], intensity: 1.6, shadow: true },
  { type: 'directional', position: [-1.2, 0.9, 0.8], color: '#dbeafe', intensity: 0.6 },
  { type: 'directional', position: [-0.6, 0.5, -1.4], color: '#93c5fd', intensity: 0.45 },
]
```

关掉阴影（性能优先）：

```ts
lights: [
  { type: 'ambient', intensity: 0.6 },
  { type: 'directional', position: [1, 1.6, 1], intensity: 1.5, shadow: false },
]
```

---

## 地面与背景

```ts
gridFloor: {
  show: true,
  color: '#33415c',
  divisions: 10,
  showWall: true,              // 背景墙，增强纵深
  wallOpacity: 0.12,
  showShadowPlane: true,       // 接触阴影
  shadowPlaneOpacity: 0.55,
}

backgroundColor: null          // 透明，透出下层 DOM
```

---

## 相机

```ts
controlSettings: {
  interactionMode: 'free',     // 'free' | 'rotate' | 'fixed'
  cameraDirection: { x: 1, y: 1.15, z: 1 },
  minPolarAngle: Math.PI / 8,
  maxPolarAngle: Math.PI / 2.2,
  enablePan: false,
  autoRotate: true,
  autoRotateSpeed: 0.6,
  fitToScreenFactor: 0.82,
}
```

锁定视角但保留缩放：

```ts
controlSettings: { interactionMode: 'fixed', enableZoom: true }
```

---

## 动画

```ts
animation: {
  enabled: true,
  duration: 900,          // 入场时长
  updateDuration: 500,    // 数据更新时长，默认 duration × 0.6
  delay: 0,
  easing: 'cubicOut',
  stagger: 60,            // 逐项错峰
}
```

关闭动画：

```ts
animation: { enabled: false }
```

---

## 主题

```ts
import { themes } from 'vis-3x'

theme: themes.dark   // 'dark' | 'light' | 'blue' | 'warm' | 'mono'
```

自定义：

```ts
theme: {
  palette: ['#4f8cff', '#22d3ee', '#34d399'],
  backgroundColor: '#0a0f1c',
  textColor: '#94a3b8',
  axisColor: '#475569',
  splitLineColor: '#1e293b',
}
```

---

## 材质

```ts
itemStyle: {
  color: '#4f8cff',
  roughness: 0.3,           // 0~1，越小越光滑
  metalness: 0.28,          // 0~1，越大越像金属
  emissive: '#4f8cff',
  emissiveIntensity: 0.15,
  opacity: 0.9,
  transparent: true,
  preset: 'standard',       // 'standard' | 'physical' | 'lambert' | 'basic' | 'toon'
}
```

::: tip 数据图表的推荐区间
`roughness: 0.3~0.5`、`metalness: 0.15~0.35`。
这个范围内颜色保持调色板观感，同时有足够体积感。

`metalness` 超过 0.5 后颜色会明显偏离调色板。
:::

---

## 标签

```ts
label: {
  show: true,
  precision: 0,
  formatter: '{value} 万',      // 支持 {value} {name} {series} {percent}
  distance: 0.3,
  interval: 0,                  // 0=全显示，1=隔一个
  textStyle: {
    color: '#f1f5f9',
    fontSize: 11,
    fontWeight: 600,
    backgroundColor: 'rgba(15,23,42,0.82)',
    padding: 3,
    borderRadius: 4,
  },
}
```

---

## 组件

```ts
title: { show: true, text: '销售概览', subtext: '单位：万元' },
legend: { show: true, position: 'bottom' },   // 'top' | 'bottom' | 'left' | 'right'
tooltip: { show: true },                       // trigger 只支持 'item'
```

---

## 柱状图

```ts
series: [{
  type: 'bar3D',
  name: '销售额',
  data: [120, 200, 150],
  barWidth: 1.2,            // 世界单位，不传自动
  barDepth: 1.8,
  barGap: 0.08,             // 同系列内间隙
  barCategoryGap: 0.32,     // 系列组之间间隙
  borderRadius: 0.08,       // 圆角
  colorByValue: true,       // 按数值渐变上色
  stack: 'total',           // 同名堆叠
}]
```

---

## 折线图

```ts
series: [{
  type: 'line3D',
  data: [820, 932, 901, 1290],
  smooth: true,             // 默认就是 true
  smoothTension: 0.5,
  curtain: true,            // 垂幕投影到地面 —— 3D 折线的关键
  lineStyle: { width: 5, color: '#4f8cff' },
  showSymbol: true,
  symbolSize: 0.12,
}]
```

---

## 饼图

```ts
series: [{
  type: 'pie3D',
  data: [
    { value: 1048, name: '搜索引擎' },
    { value: 735, name: '直接访问' },
  ],
  radius: 3.4,
  innerRadius: 1.3,         // >0 变环形
  depth: 0.85,              // 厚度
  padAngle: 1.2,            // 扇区间隙（度）
  roseType: 'radius',       // 南丁格尔玫瑰图
  centerLabel: { show: true, total: true },
}]
```

---

## 曲面图

```ts
series: [{
  type: 'surface3D',
  data: matrix,             // 必须是二维数组
  colorGradient: ['#1e3a8a', '#0ea5e9', '#22d3ee', '#34d399', '#fde047', '#ef4444'],
  wireframe: { show: true, opacity: 0.14, step: 3 },
  contour: { show: true, levels: 6 },
  smoothSubdivision: 1,     // 每加 1 顶点数约 ×9
}]
```

---

## 仪表盘

```ts
series: [{
  type: 'gauge3D',
  min: 0,
  max: 100,
  data: [{ value: 73 }],    // 只读 data[0]
  startAngle: 225,
  endAngle: -45,
  radius: 3.4,
  axisWidth: 0.55,
  depth: 0.5,
  splitNumber: 5,
  pointer: { length: 2.4, width: 0.14, color: '#f8fafc' },
  detail: { show: true, fontSize: 30 },
}]
```

---

## 实例方法

```ts
chart.setOption(option)
chart.getOption()
chart.resize()
chart.fitToScreen()
chart.resetCamera()
chart.setInteractionMode('fixed')
chart.exportImage({ scale: 2 })
chart.requestRender()
chart.dispose()

chart.on('chart:click', handler)
chart.on('chart:rendered', ({ duration }) => {})
```

---

## 相关

- [配置项 Option](/api/option) — 逐个字段的完整说明
- [Series 参考](/api/series)
- [坐标轴 Axis](/api/axis)
- [样式 Style](/api/style)
