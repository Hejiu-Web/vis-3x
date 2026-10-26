# Series 参考

`Series3D` 是一个可辨识联合：通过 `type` 字段区分，TypeScript 会自动收窄到对应的接口。

---

::: tip JavaScript 使用者怎么看这一页
本页用 TypeScript 语法描述字段类型（如 `color?: string`），
**这些标注只影响编辑器提示，不影响运行**。

在纯 JavaScript 里：

- 写成 `option.color = '#4f8cff'` 即可，不需要声明类型
- `?` 表示可选字段，JS 里直接不写就行
- 字段名、取值、默认值**完全一致**

完整的 JS 用法见[纯 JavaScript 使用](/guide/javascript)。
:::

## 通用字段

所有系列共享 `BaseSeries`：

```ts
interface BaseSeries<TItem = DataItem> {
  name?: string
  type: SeriesType
  data: TItem[]
  color?: string[]
  itemStyle?: ItemStyle
  label?: LabelStyle
  stack?: string
  visible?: boolean
  animation?: AnimationConfig
  xAxisIndex?: number
  yAxisIndex?: number
  zAxisIndex?: number
}
```

| 字段 | 类型 | 说明 |
|---|---|---|
| `name` | `string` | 系列名，用于图例与提示框 |
| `type` | `SeriesType` | 系列类型（必需） |
| `data` | `TItem[]` | 数据（必需） |
| `color` | `string[]` | 系列调色板，覆盖主题 |
| `itemStyle` | `ItemStyle` | 数据项默认样式 |
| `label` | `LabelStyle` | 数据项默认标签 |
| `stack` | `string` | 同名堆叠 |
| `visible` | `boolean` | 是否可见（配合图例） |
| `animation` | `AnimationConfig` | 该系列的动画 |
| `xAxisIndex` 等 | `number` | 关联轴索引（多轴预留） |

### 数据项写法

```ts
type DataItem = number | number[] | SingleValueDataItem | MultiValueDataItem

interface SingleValueDataItem {
  value: number
  name?: string
  itemStyle?: ItemStyle
  label?: LabelStyle
}

interface MultiValueDataItem {
  value: number[]
  name?: string
  itemStyle?: ItemStyle
  label?: LabelStyle
}
```

三种写法：

```ts
data: [
  120,                                        // 纯数字
  { value: 200, name: '二月' },                // 带名字
  { value: 150, itemStyle: { color: '#f00' } } // 带独立样式
]
```

---

## 类型速查

| type | 接口 | 数据形态 |
|---|---|---|
| `'bar3D'` | `Bar3DSeries` | `number \| SingleValueDataItem` |
| `'line3D'` | `Line3DSeries` | `number \| SingleValueDataItem` |
| `'area3D'` | `Area3DSeries` | `number \| SingleValueDataItem` |
| `'pie3D'` | `Pie3DSeries` | `SingleValueDataItem` |
| `'scatter3D'` | `Scatter3DSeries` | `number[] \| MultiValueDataItem` |
| `'surface3D'` | `Surface3DSeries` | `number[][]`（矩阵） |
| `'radar3D'` | `Radar3DSeries` | `MultiValueDataItem` |
| `'funnel3D'` | `Funnel3DSeries` | `SingleValueDataItem` |
| `'gauge3D'` | `Gauge3DSeries` | `SingleValueDataItem` |
| `'heatmap3D'` | `Heatmap3DSeries` | `number[]`（`[x, z, value]`） |
| 自定义 | `CustomSeries` | `unknown[]` |

---

## 常用子类型

### PointStyle

散点图的数据点样式：

```ts
interface PointStyle {
  symbol?: 'sphere' | 'cube' | 'circle' | 'diamond'
  size?: number
  /** 按数值映射的尺寸范围 [min, max] */
  sizeRange?: [number, number]
  /** 球体分段数，影响顶点数 */
  segments?: number
  color?: ColorLike
  opacity?: number
}
```

### LabelStyle

```ts
interface LabelStyle {
  show?: boolean
  /** 小数位数 */
  precision?: number
  /** 格式化模板，支持 {value} {name} {series} {percent} */
  formatter?: string | ((params) => string)
  /** 与锚点的距离 */
  distance?: number
  /** 显示间隔：0 为全部显示，1 为隔一个显示 */
  interval?: number
  /** 位置 */
  position?: 'top' | 'bottom' | 'left' | 'right' | 'inside'
  textStyle?: TextStyle
}
```

### AnimationConfig

```ts
interface AnimationConfig {
  enabled?: boolean
  duration?: number
  updateDuration?: number
  delay?: number
  easing?: EasingName
  stagger?: number
}
```

---

## Bar3DSeries

```ts
interface Bar3DSeries extends BaseSeries<number | SingleValueDataItem> {
  type: 'bar3D'
  barWidth?: number
  barDepth?: number
  barGap?: number
  barCategoryGap?: number
  borderRadius?: number
  topLabel?: LabelStyle
  colorByValue?: boolean
  capStyle?: ItemStyle
}
```

| 字段 | 类型 | 说明 |
|---|---|---|
| `barWidth` | `number` | 柱子宽度（世界单位）。不传按类目间距自动算 |
| `barDepth` | `number` | 柱子深度 |
| `barGap` | `number` | 同系列内间隙（占间距比例 0~1） |
| `barCategoryGap` | `number` | 多系列组之间间隙（占间距比例 0~1） |
| `borderRadius` | `number` | 圆角大小（世界单位） |
| `topLabel` | `LabelStyle` | 柱顶标签 |
| `colorByValue` | `boolean` | 按数值渐变上色 |
| `capStyle` | `ItemStyle` | 顶部发光顶盖的样式 |

::: warning barWidth 过大时会重叠
显式设 `barWidth` 时库**不会**自动防止重叠。
类目多（步长小）而 `barWidth` 大时，柱子会互相穿插。

不确定时不要设这个字段。
:::

---

## Line3DSeries

```ts
interface Line3DSeries extends BaseSeries<number | SingleValueDataItem> {
  type: 'line3D'
  lineStyle?: LineStyle
  smooth?: boolean
  smoothTension?: number
  showSymbol?: boolean
  pointStyle?: PointStyle
  symbolSize?: number
  /** 是否绘制垂幕（向地面投影） */
  curtain?: boolean
  curtainStyle?: AreaStyle
  /** Z 轴深度位置 */
  z?: number
}
```

| 字段 | 类型 | 默认 | 说明 |
|---|---|---|---|
| `lineStyle` | `LineStyle` | — | 线样式 |
| `smooth` | `boolean` | `true` | 是否平滑 |
| `smoothTension` | `number` | `0.5` | 平滑张力 0~1 |
| `showSymbol` | `boolean` | — | 是否显示数据点 |
| `pointStyle` | `PointStyle` | — | 数据点样式 |
| `curtain` | `boolean` | `false` | 是否绘制垂幕 |
| `curtainStyle` | `AreaStyle` | — | 垂幕样式 |
| `z` | `number` | 自动 | 深度位置 |

::: tip curtain 是 3D 折线图的关键
`curtain: true` 从折线每个点向下拉出渐变半透明面直到地面。

它解决了 3D 折线最大的问题——**看不出线在空间里的高度**。
有了垂幕，观众能直观判断每个点的实际数值。
:::

---

## Pie3DSeries

```ts
interface Pie3DSeries extends BaseSeries<SingleValueDataItem> {
  type: 'pie3D'
  radius?: number
  innerRadius?: number
  depth?: number
  startAngle?: number
  padAngle?: number
  roseType?: 'radius' | 'area' | false
  depthByValue?: boolean
  depthRange?: [number, number]
  centerLabel?: { show?: boolean; total?: boolean; text?: string; textStyle?: TextStyle }
  selectedIndex?: number
  selectedOffset?: number
}
```

| 字段 | 类型 | 默认 | 说明 |
|---|---|---|---|
| `radius` | `number` | `3.4` | 外半径 |
| `innerRadius` | `number` | `0` | 内半径，>0 时为环形 |
| `depth` | `number` | `0.85` | 厚度 |
| `startAngle` | `number` | `90` | 起始角度（度） |
| `padAngle` | `number` | `1.2` | 扇区间隙（度） |
| `roseType` | `'radius' \| 'area' \| false` | `false` | 南丁格尔玫瑰图 |
| `depthByValue` | `boolean` | `false` | 厚度也按数值变化 |
| `centerLabel` | `object` | — | 中心文字 |

::: warning 非有限值与 ≤0 的项不会生成扇块
数据里如果有 `0`、负数、`NaN`，对应扇区**直接不绘制**（而不是画成一条线）。
百分比计算时这些项仍然占位，所以 `{percent}` 可能与你预期不同。
:::

---

## Scatter3DSeries

```ts
interface Scatter3DSeries extends BaseSeries<number[] | MultiValueDataItem> {
  type: 'scatter3D'
  pointStyle?: PointStyle
  /** 是否按数值上色 */
  colorByValue?: boolean
}
```

数据是坐标元组：

```ts
data: [
  [1, 20],        // [x, y]，z 默认为 0
  [2, 35, 5],     // [x, y, z]
]
```

---

## Surface3DSeries

```ts
interface Surface3DSeries extends BaseSeries<number[]> {
  type: 'surface3D'
  /** 连续色带 */
  colorGradient?: string[]
  wireframe?: { show?: boolean; opacity?: number; step?: number }
  contour?: { show?: boolean; levels?: number; opacity?: number }
  /** 平滑细分倍数 */
  smoothSubdivision?: number
  /** 是否显示底面 */
  showBase?: boolean
}
```

数据必须是**二维矩阵**：

```ts
data: [
  [1, 2, 3],
  [4, 5, 6],
  [7, 8, 9],
]
```

::: danger smoothSubdivision 是顶点数放大器
`2` 表示每个方向插值成 3 段，总顶点数变成 **9 倍**。

60×60 的曲面加 `smoothSubdivision: 2` → 约 32 万顶点，明显卡顿。

需要更平滑时，**提高输入数据密度**比事后插值更划算。
:::

---

## Radar3DSeries

```ts
interface Radar3DSeries extends BaseSeries<MultiValueDataItem> {
  type: 'radar3D'
  areaStyle?: AreaStyle
  lineStyle?: LineStyle
  showPoint?: boolean
  pointStyle?: PointStyle
  /** 多系列时的层间距 */
  layerGap?: number
}
```

数据里的 `value` 是**数组**，顺序对应 `radar.indicator`：

```ts
{
  radar: {
    indicator: [
      { name: '性能', max: 100 },
      { name: '易用性', max: 100 },
      { name: '生态', max: 100 },
    ],
  },
  series: [{
    type: 'radar3D',
    data: [{ value: [85, 92, 78] }],   // 顺序必须与 indicator 一致
  }],
}
```

::: warning 维度少于 3 个不渲染
`indicator` 少于 3 项时整个图表不绘制（无法构成平面）。
数据项的 `value` 长度也需 ≥ 3。
:::

---

## Funnel3DSeries

```ts
interface Funnel3DSeries extends BaseSeries<SingleValueDataItem> {
  type: 'funnel3D'
  height?: number
  width?: number
  gap?: number
  depth?: number
  shape?: 'funnel' | 'pyramid'
  minSize?: number
  sort?: 'ascending' | 'descending' | 'none'
}
```

| 字段 | 类型 | 默认 | 说明 |
|---|---|---|---|
| `height` | `number` | `6` | 总高度 |
| `width` | `number` | `5` | 最大宽度 |
| `gap` | `number` | `0.14` | 层间距 |
| `depth` | `number` | `1.6` | 厚度 |
| `shape` | `'funnel' \| 'pyramid'` | `'funnel'` | 形状 |
| `minSize` | `number` | `0.22` | 最小层宽比例 |
| `sort` | `'ascending' \| 'descending' \| 'none'` | `'descending'` | 排序 |

::: tip 高度均分，只有宽度编码数值
每层高度固定为 `(height - gap × (n-1)) / n`，
**数值只影响宽度**：`width × (minSize + (1 - minSize) × t)`。

这是漏斗图的常规语义——宽度代表转化率。
:::

::: warning 数据建议降序
默认 `sort: 'descending'` 会自动降序排列。

`sort: 'none'` 时按原始顺序绘制，数据若不降序，漏斗会「鼓出来」不像漏斗。

排序只改变绘制顺序，**事件回调里的 `dataIndex` 仍指向原始数组**。
:::

---

## Gauge3DSeries

```ts
interface Gauge3DSeries extends BaseSeries<SingleValueDataItem> {
  type: 'gauge3D'
  min?: number
  max?: number
  startAngle?: number
  endAngle?: number
  radius?: number
  axisWidth?: number
  depth?: number
  splitNumber?: number
  axisTick?: { show?: boolean; length?: number; color?: ColorLike }
  axisLabel?: { show?: boolean; fontSize?: number; color?: ColorLike; precision?: number }
  pointer?: { show?: boolean; length?: number; width?: number; color?: ColorLike }
  detail?: { show?: boolean; formatter?: string | ((v: number) => string); fontSize?: number; color?: ColorLike }
  progressStyle?: ItemStyle
}
```

| 字段 | 类型 | 默认 |
|---|---|---|
| `min` / `max` | `number` | `0` / `100` |
| `startAngle` / `endAngle` | `number` | `225` / `-45` |
| `radius` | `number` | `3.4` |
| `axisWidth` | `number` | `0.55` |
| `depth` | `number` | `0.5` |
| `splitNumber` | `number` | `5` |
| `pointer.length` | `number` | `radius × 0.72` |
| `pointer.width` | `number` | `0.14` |
| `detail.fontSize` | `number` | `30` |

::: warning 只读取 data[0]
仪表盘只显示**第一个数据项**。传入多个只在第一个生效。
:::

---

## Heatmap3DSeries

```ts
interface Heatmap3DSeries extends BaseSeries<number[]> {
  type: 'heatmap3D'
  colorGradient?: string[]
  /** 色块高度映射的最大值 */
  maxHeight?: number
  /** 是否显示色块之间的间隙 */
  gap?: number
}
```

数据格式是 `[x索引, z索引, 值]`：

```ts
{
  xAxis3D: { data: ['周一', '周二', '周三'] },
  zAxis3D: { data: ['上午', '下午'] },
  series: [{
    type: 'heatmap3D',
    data: [
      [0, 0, 10],   // 周一 · 上午 = 10
      [1, 0, 40],   // 周二 · 上午 = 40
      [0, 1, 25],   // 周一 · 下午 = 25
    ],
  }],
}
```

---

## CustomSeries

自定义图表用的宽松类型：

```ts
interface CustomSeries extends Omit<BaseSeries<DataItem>, 'type' | 'data'> {
  type: string
  data: unknown[]
}
```

用 `defineChart` 注册的类型可以接受任意形状的 `data`：

```ts
series: [{
  type: 'stepTerrain3D',
  data: [[1, 2], [3, 4]],   // 矩阵，不检查类型
}]
```

代价是**失去类型提示**——需要自己断言：

```ts
const matrix = series.data as number[][]
```

---

## 类型收窄

`Series3D` 是可辨识联合，写对 `type` 就会自动收窄：

```ts
function render(series: Series3D) {
  if (series.type === 'bar3D') {
    series.borderRadius   // ✓ 类型已知
    series.pointStyle     // ✗ 报错：柱状图没有这个字段
  }
}
```

这也是为什么建议用 `as const` 或显式的 `Vis3xOption` 类型标注——让 TS 帮你检查字段是否用错图表。

---

## 下一步

- [坐标轴 Axis](./axis)
- [样式 Style](./style)
- [类型定义](./types)
