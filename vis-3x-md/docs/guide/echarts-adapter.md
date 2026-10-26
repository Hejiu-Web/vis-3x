# ECharts 配置适配器

如果你已经有一堆 ECharts 配置想迁移，这个适配器可以省掉大量手工改写。

---

## 用法

```ts
import { fromEchartsLikeOption, createChart } from 'vis-3x'

const echartsOption = {
  color: ['#4f8cff', '#22d3ee'],
  backgroundColor: '#0a0f1c',
  title: { text: '销售概览', subtext: '单位：万元' },
  legend: { show: true, bottom: 0 },
  tooltip: { show: true },
  xAxis: { type: 'category', data: ['Q1', 'Q2', 'Q3', 'Q4'] },
  yAxis: { type: 'value', name: '销售额' },
  series: [
    { name: '2024', type: 'bar', data: [120, 200, 150, 80] },
    { name: '2025', type: 'bar', data: [150, 230, 190, 120] },
  ],
}

const option = fromEchartsLikeOption(echartsOption)
const chart = createChart('bar3D', document.getElementById('el')!)
chart.setOption(option)
```

`toVis3xOption` 是它的别名，两个函数行为完全相同。

---

## 支持的转换

| ECharts 字段 | 转换为 | 说明 |
|---|---|---|
| `series[].type` | `series[].type` | 见下方类型映射表 |
| `xAxis.data` | `xAxis3D.data` | 类目轴数据 |
| `xAxis.type` | `xAxis3D.type` | `'category'` / `'value'` / `'time'` |
| `yAxis.min` / `max` / `name` | `yAxis3D.*` | 数值轴范围与名称 |
| `zAxis` | `zAxis3D` | 深度轴 |
| `xAxis.axisLabel` / `splitLine` | 同名 | 轴样式 |
| `color` | `theme.palette` | 调色板 |
| `backgroundColor` | `theme.backgroundColor` | 背景 |
| `title` | `title` | 标题与副标题 |
| `legend` | `legend` | 图例（含 `bottom` / `top` 定位） |
| `tooltip` | `tooltip` | 提示框（含配色） |
| `grid.boxWidth` / `boxHeight` / `boxDepth` | 网格尺寸 | 3D 特有 |
| `visualMap.inRange.color` | `colorGradient` | 曲面 / 热力图的色带 |
| `radar.indicator` 等 | `radar.*` | 雷达图坐标系 |

### 系列类型映射

| ECharts type | vis-3x type |
|---|---|
| `'bar'` / `'bar3D'` | `'bar3D'` |
| `'line'` / `'line3D'` | `'line3D'` |
| `'pie'` | `'pie3D'` |
| `'scatter'` | `'scatter3D'` |
| `'surface'` | `'surface3D'` |
| `'radar'` | `'radar3D'` |
| `'gauge'` | `'gauge3D'` |
| `'heatmap'` | `'heatmap3D'` |
| `'funnel'` | `'funnel3D'` |
| 其他 / 未识别 | `'bar3D'`（兜底） |

::: warning 未识别的类型会静默退化成柱状图
适配器不认识 `'boxplot'`、`'candlestick'`、`'sankey'`、`'tree'`、`'graph'`、`'map'` 等类型，
遇到时会当作 `bar3D` 处理。

迁移后请检查渲染结果，不要假设全部转换正确。
:::

---

## 雷达图

雷达图的坐标系在 ECharts 里也是独立的 `radar` 字段，适配器会原样搬运：

```ts
const option = fromEchartsLikeOption({
  radar: {
    indicator: [
      { name: '性能', max: 100 },
      { name: '易用性', max: 100 },
      { name: '生态', max: 100 },
    ],
  },
  series: [
    {
      type: 'radar',
      data: [{ value: [85, 92, 78], name: '本方案' }],
    },
  ],
})
```

---

## 色带（visualMap）

曲面图与热力图用渐变表达数值，ECharts 用 `visualMap`，vis-3x 用 `colorGradient`：

```ts
const option = fromEchartsLikeOption({
  visualMap: {
    min: 0,
    max: 100,
    inRange: {
      color: ['#1e3a8a', '#0ea5e9', '#22d3ee', '#34d399', '#fde047', '#ef4444'],
    },
  },
  series: [{ type: 'heatmap', data: [[0, 0, 10], [1, 0, 40]] }],
})
```

也接受简写的 `color` 字段：

```ts
visualMap: { color: ['#0f2a5e', '#22d3ee', '#f97316'] }
```

---

## 转换后需要手工调整的部分

适配器只处理**结构映射**，不做语义转换。以下情况需要你手动补：

::: details 1. 轴名加了 3D 后缀
输出里的轴字段是 `xAxis3D` / `yAxis3D` / `zAxis3D`。
如果你后续要按 vis-3x 的文档改配置，记得用新名字。
:::

::: details 2. 不支持 dataZoom
ECharts 的 `dataZoom` 会被忽略。3D 场景下用相机缩放代替。
:::

::: details 3. 不支持 markLine / markPoint
这两个字段会被忽略。需要的话用 `extendChart` 自行绘制。
:::

::: details 4. tooltip.trigger 只有 'item'
ECharts 的 `trigger: 'axis'`（整轴提示）不支持，会退化为单项提示。
:::

::: details 5. 多系列沿 Z 轴而非 X 轴
ECharts 的多系列柱状图沿 X 轴并排，vis-3x 默认沿 **Z 轴**错开。
转换后视觉布局会不同——这是 3D 的固有差异，不是 bug。

想恢复 X 轴并排效果，需要把数据合并成单个系列：

```ts
series: [{
  type: 'bar3D',
  data: [
    { value: 120, name: 'Q1-2024' },
    { value: 150, name: 'Q1-2025' },
    // ...
  ],
}]
```
:::

::: details 6. 颜色观感会变
2D 的纯色在 PBR 材质 + 光照下会有明暗变化。
想要接近 2D 的观感：

```ts
option.series?.forEach((s) => {
  s.itemStyle = { ...s.itemStyle, roughness: 1, metalness: 0 }
})
option.lights = [{ type: 'ambient', intensity: 1 }]
```
:::

---

## 迁移策略建议

::: tip 三种做法

**① 全量转换** — 配置简单、类型都在支持列表里时直接转：

```ts
chart.setOption(fromEchartsLikeOption(oldOption))
```

**② 转换后微调** — 转完再覆盖 3D 特有的部分：

```ts
const option = fromEchartsLikeOption(oldOption)
chart.setOption({
  ...option,
  gridFloor: { show: true, showWall: true },
  controlSettings: { interactionMode: 'free' },
  animation: { duration: 900, stagger: 60 },
})
```

**③ 只在数据层复用** — 保留 ECharts 的数据结构，配置重写：

```ts
const option = {
  xAxis3D: { data: oldOption.xAxis.data },
  series: oldOption.series.map((s) => ({
    type: 'bar3D',
    name: s.name,
    data: s.data,
  })),
}
```

多数情况下 **③ 效果最好**——因为 3D 图表的视觉配置本来就需要重新调，
盲目转换反而会带进一堆不适用的参数。
:::

---

## 相关

- [从 ECharts 迁移](/guide/migrate-from-echarts) — 概念对照与差异清单
- [配置项 Option](/api/option)
