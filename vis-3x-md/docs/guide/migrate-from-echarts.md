# 从 ECharts 迁移

如果你熟悉 ECharts，过渡到 vis-3x 会很快——配置结构刻意保持了相似的形状。这一页列出**相同的部分**与**必须注意的差异**。

---

## 概念对照

| ECharts | vis-3x | 说明 |
|---|---|---|
| `xAxis` | `xAxis3D` | 三维场景下轴名带 `3D` 后缀 |
| `yAxis` | `yAxis3D` | |
| — | `zAxis3D` | 新增的深度轴 |
| `series` | `series` | 结构一致 |
| `setOption` | `setOption` | 语义一致（整体替换，不深合并） |
| `chart.on('click')` | `chart.on('chart:click')` | 事件名统一加了 `chart:` 前缀 |
| `chart.resize()` | `chart.resize()` | 一致 |
| `chart.getDataURL()` | `chart.exportImage()` | 返回 dataURL |
| `chart.dispose()` | `chart.dispose()` | 一致 |
| `theme` 字符串 | `theme` 对象 | 见下方差异 2 |
| `echarts.registerChart` | `defineChart` / `registerChart` | 见[自定义图表](/custom/define-chart) |

---

## 迁移示例

### ECharts（2D）

```ts
const option = {
  xAxis: { type: 'category', data: ['Q1', 'Q2', 'Q3', 'Q4'] },
  yAxis: { type: 'value', name: '销售额' },
  legend: { data: ['2024', '2025'] },
  tooltip: { trigger: 'axis' },
  series: [
    { name: '2024', type: 'bar', data: [120, 200, 150, 80] },
    { name: '2025', type: 'bar', data: [150, 230, 190, 120] },
  ],
}
```

### vis-3x（3D）

```ts
const option = {
  // ① 轴名加 3D 后缀；类目轴不用写 type: 'category'，有 data 就是类目轴
  xAxis3D: { data: ['Q1', 'Q2', 'Q3', 'Q4'] },
  yAxis3D: { name: '销售额' },

  // ② legend 不需要 data 字段，自动从系列名收集
  legend: { show: true },

  // ③ tooltip 的 trigger 默认就是 'item'
  tooltip: { show: true },

  // ④ series 的 type 改为 3D 类型名
  series: [
    { name: '2024', type: 'bar3D', data: [120, 200, 150, 80] },
    { name: '2025', type: 'bar3D', data: [150, 230, 190, 120] },
  ],
}
```

改动很小。主要就是轴名和 series 类型名。

---

## 必须注意的差异

### 差异 1：轴类型自动推断

ECharts 需要显式写 `type: 'category'` 或 `type: 'value'`。

vis-3x 按**有没有 `data`** 推断：

```ts
xAxis3D: { data: ['A', 'B', 'C'] }              // 类目轴
xAxis3D: { type: 'value', min: 0, max: 100 }    // 数值轴
```

::: tip 显式写也没问题
`type` 字段仍然支持，只是通常不需要。
从 ECharts 迁移时保留原写法可以正常工作。
:::

### 差异 2：主题是对象不是字符串

```ts
// ECharts
echarts.init(el, 'dark')

// vis-3x — 用预设
import { themes } from 'vis-3x'
const option = { theme: themes.dark }

// vis-3x — 或自定义
const option = {
  theme: {
    palette: ['#4f8cff', '#22d3ee'],
    backgroundColor: '#0a0f1c',
  },
}
```

### 差异 3：事件名带前缀

```ts
// ECharts
chart.on('click', handler)

// vis-3x
chart.on('chart:click', handler)
```

::: tip 为什么加前缀
避免与 DOM 事件名冲突，也便于区分库事件（`chart:`）与将来可能加的插件事件（`plugin:`）。
:::

### 差异 4：多系列沿 Z 轴分布

ECharts 的多系列柱状图沿 X 轴并排。vis-3x **默认沿 Z 轴错开**：

```ts
series: [
  { type: 'bar3D', name: 'A', data: [...] },   // 靠近观察者
  { type: 'bar3D', name: 'B', data: [...] },   // 稍远
]
```

这利用了 3D 的深度维度。如果确实想要 X 轴并排的效果，需要自己把数据合成一个系列：

```ts
series: [{
  type: 'bar3D',
  data: [
    { value: 120, name: 'Q1-2024' },
    { value: 150, name: 'Q1-2025' },
    { value: 200, name: 'Q2-2024' },
    { value: 230, name: 'Q2-2025' },
  ],
}]
```

### 差异 5：饼图 / 雷达图不需要坐标系

```ts
// ECharts 的饼图不需要配轴，vis-3x 同理，且默认不渲染网格
const option = {
  series: [{ type: 'pie3D', data: [...] }],
  // showCoordinate 默认 false，不用写
}
```

### 差异 6：没有 dataZoom

3D 场景下框选缩放会破坏空间感，因此不提供 `dataZoom`。

替代方案：

```ts
// 用相机缩放代替
controlSettings: { interactionMode: 'free' }
// 用户滚轮即可拉近拉远

// 或通过数据筛选做「缩放」
const visibleData = allData.slice(start, end)
```

### 差异 7：自定义图表 API 不同

ECharts 的 `registerChart` 需要实现一整套渲染生命周期，比较复杂。

vis-3x 的 `defineChart` 只要求一个 `render` 函数：

```ts
// ECharts（简化）
echarts.extendChartView({ type: 'myChart', render() { /* ... */ } })
echarts.extendComponentModel({ /* ... */ })

// vis-3x
defineChart({
  type: 'myChart',
  render(ctx) {
    // 直接用 ctx 提供的坐标、几何、材质能力
  },
})
```

详见[自定义图表](/custom/define-chart)。

---

## 配置迁移对照表

| ECharts 字段 | vis-3x 对应 |
|---|---|
| `xAxis.type` | 自动推断，可显式写 |
| `xAxis.data` | `xAxis3D.data` |
| `xAxis.axisLabel` | `xAxis3D.axisLabel` |
| `xAxis.splitLine` | `xAxis3D.splitLine` |
| `grid` | `gridFloor`（但语义不同：一个是 2D 内边距，一个是 3D 地面） |
| `series[].itemStyle` | `series[].itemStyle`（字段不同，见下） |
| `series[].label` | `series[].label` |
| `series[].emphasis` | 无。用 `chart:mouseover` 事件自行处理 |
| `tooltip.trigger: 'axis'` | 不支持，只有 `'item'` |
| `visualMap` | `colorGradient`（曲面 / 热力图内置） |
| `dataZoom` | 无 |
| `markLine` / `markPoint` | 无。可用 `extendChart` 自行绘制 |
| `animationEasing` | `animation.easing` |
| `animationDuration` | `animation.duration` |
| `animationDelay` | `animation.delay` |

### itemStyle 字段差异

ECharts 的 `itemStyle` 是 2D 样式，vis-3x 的是 **PBR 材质参数**：

| ECharts | vis-3x | 说明 |
|---|---|---|
| `color` | `color` | 一致 |
| `opacity` | `opacity` | 一致 |
| `borderColor` | — | 3D 下无边框概念 |
| `borderWidth` | — | 用 `bevelSize` 代替圆角 |
| `shadowBlur` | — | 用真实阴影（`lights[].shadow`） |
| — | `roughness` | 粗糙度 0~1 |
| — | `metalness` | 金属度 0~1 |
| — | `emissive` | 自发光颜色 |
| — | `emissiveIntensity` | 自发光强度 |
| — | `preset` | 材质预设：`'standard'` / `'physical'` / `'basic'` |

```ts
// ECharts 风格
itemStyle: { color: '#4f8cff', borderColor: '#fff', borderWidth: 2 }

// vis-3x 风格
itemStyle: {
  color: '#4f8cff',
  roughness: 0.32,
  metalness: 0.25,
  emissive: '#4f8cff',
  emissiveIntensity: 0.12,
}
```

---

## 视觉上的预期变化

迁移后会看到一些必然的差异，这些不是 bug：

**标签位置会变。** 2D 图表的标签在固定位置，3D 标签会随视角移动（始终朝向相机，但锚点在三维空间里）。

**颜色观感不同。** PBR 材质 + 光照会让同一色值看起来和 2D 不一样。想接近 2D 的纯色效果，可以把 `roughness` 调到 1、`metalness` 调到 0，并把光照设为纯 `ambient`。

**需要更多的垂直空间。** 3D 图表倾斜后需要比 2D 更大的容器才能显示完整，建议至少 `420px`。

---

## 哪些图表没有对应

| ECharts | vis-3x 替代 |
|---|---|
| 箱线图 | 无。用柱状图 + 误差线自定义 |
| K 线图 | 无 |
| 桑基图 | 无 |
| 关系图 graph | 无。用 `scatter3D` + 自定义连线 |
| 树图 / 矩形树图 | 无 |
| 地图 map | 无 |
| 旭日图 | 用 `pie3D` 的嵌套环形近似 |

需要这些图表的话，可以用 `defineChart` 自行实现，或者继续用 ECharts 画 2D 图表——两者可以在同一个页面里共存。

---

## 下一步

- [自定义图表](/custom/define-chart) — 实现 ECharts 里没有的图表
- [常见问题](./faq)
