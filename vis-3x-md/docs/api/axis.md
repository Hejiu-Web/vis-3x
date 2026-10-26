# 坐标轴 Axis

`Axis3D` 的完整字段参考。三个轴（`xAxis3D` / `yAxis3D` / `zAxis3D`）共用同一个接口。

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

## 接口定义

```ts
interface Axis3D {
  show?: boolean
  type?: 'category' | 'value' | 'time'
  name?: string
  nameStyle?: AxisName
  data?: Array<string | number>
  min?: number
  max?: number
  interval?: number
  axisLine?: AxisLine
  axisTick?: AxisTick
  axisLabel?: AxisLabel
  splitLine?: SplitLine
  color?: ColorLike
}
```

---

## 基础字段

| 字段 | 类型 | 默认 | 说明 |
|---|---|---|---|
| `show` | `boolean` | `true` | 是否显示该轴 |
| `type` | `'category' \| 'value' \| 'time'` | 自动推断 | 轴类型 |
| `name` | `string` | — | 轴名称 |
| `data` | `(string \| number)[]` | — | 类目轴的数据 |
| `min` | `number` | 自动 | 数值轴最小值 |
| `max` | `number` | 自动 | 数值轴最大值 |
| `interval` | `number` | 自动 | 强制刻度间隔 |
| `color` | `ColorLike` | 主题值 | 轴线颜色（快捷写法） |

### type 的推断规则

```ts
// 有 data → 类目轴
xAxis3D: { data: ['Q1', 'Q2', 'Q3'] }

// 无 data → 数值轴
xAxis3D: { min: -5, max: 5 }
```

显式写 `type` 也可以，行为一致。

::: tip time 类型
`type: 'time'` 目前与 `'value'` 行为相同——不做时间刻度格式化。
传入时间戳作为数值使用即可：

```ts
xAxis3D: {
  type: 'value',
  axisLabel: {
    formatter: (v) => new Date(Number(v)).toLocaleDateString(),
  },
}
```
:::

---

## name / nameStyle

轴名称是主要字段，`nameStyle` 用于精细控制：

```ts
{
  yAxis3D: {
    name: '销售额',
    nameStyle: {
      show: true,
      text: '销售额（万元）',   // 优先于 name
      margin: 0.8,
      textStyle: { fontSize: 13, color: '#94a3b8' },
    },
  },
}
```

`AxisName`：

| 字段 | 类型 | 默认 | 说明 |
|---|---|---|---|
| `show` | `boolean` | `true` | 是否显示 |
| `text` | `string` | `name` 的值 | 名称文本 |
| `textStyle` | `TextStyle` | — | 文字样式 |
| `margin` | `number` | 自动 | 与轴线的距离（世界单位） |

---

## axisLine

轴线本身：

```ts
{
  xAxis3D: {
    axisLine: {
      show: true,
      lineStyle: { color: '#475569', width: 1, opacity: 0.8 },
    },
  },
}
```

| 字段 | 类型 | 默认 |
|---|---|---|
| `show` | `boolean` | `true` |
| `lineStyle` | `LineStyle` | 主题值 |

---

## axisTick

刻度线：

```ts
{
  yAxis3D: {
    axisTick: {
      show: true,
      length: 0.18,        // 世界单位
      lineStyle: { color: '#475569' },
    },
  },
}
```

| 字段 | 类型 | 默认 | 说明 |
|---|---|---|---|
| `show` | `boolean` | `true` | 是否显示 |
| `length` | `number` | 自动 | 刻度线长度（世界单位，不是像素） |
| `lineStyle` | `LineStyle` | 主题值 | 线样式 |

::: warning length 是世界单位
`length: 0.18` 表示 0.18 个世界单位，大致相当于 0.18 个网格格子的宽度。
不是像素值。网格大小会随类目数变化，所以视觉效果会略有不同。
:::

---

## axisLabel

刻度文字：

```ts
{
  yAxis3D: {
    axisLabel: {
      show: true,
      precision: 0,
      abbreviate: true,       // 12000 → 1.2万
      margin: 0.42,
      textStyle: { fontSize: 11, color: '#94a3b8' },
      formatter: (value) => `${value} 万`,
    },
  },
}
```

| 字段 | 类型 | 默认 | 说明 |
|---|---|---|---|
| `show` | `boolean` | `true` | 是否显示 |
| `textStyle` | `TextStyle` | — | 文字样式 |
| `precision` | `number` | 自动 | 小数位数 |
| `abbreviate` | `boolean` | `false` | 大数缩写（12000 → 1.2万） |
| `formatter` | `(value, index) => string` | — | 自定义格式化 |
| `margin` | `number` | 自动 | 与轴线的距离 |

### abbreviate 的规则

```ts
abbreviate: true

// 1200      → '1200'
// 12000     → '1.2万'
// 120000000 → '1.2亿'
```

中文场景下的缩写，适合数值跨度大的情况。

### formatter 用法

```ts
axisLabel: {
  formatter: (value, index) => {
    const n = Number(value)
    if (n >= 10000) return `${(n / 10000).toFixed(1)}万`
    return String(n)
  },
}
```

`value` 是原始值（数字或类目字符串），`index` 是刻度索引。

---

## splitLine

网格分割线：

```ts
{
  yAxis3D: {
    splitLine: {
      show: true,
      splitNumber: 5,
      lineStyle: { color: '#1e293b', opacity: 0.6 },
      showSplitArea: false,
    },
  },
}
```

| 字段 | 类型 | 默认 | 说明 |
|---|---|---|---|
| `show` | `boolean` | `true` | 是否显示 |
| `lineStyle` | `LineStyle` | 主题值 | 线样式 |
| `splitNumber` | `number` | 自动 | 分割段数 |
| `showSplitArea` | `boolean` | `false` | 是否显示交替色带 |
| `splitAreaColors` | `ColorLike[]` | — | 交替色，如 `['rgba(255,255,255,0.02)', 'rgba(255,255,255,0.05)']` |

::: tip 小尺寸图表建议关闭轴标签
在 280px 高的小卡片里，`splitNumber: 5` 加上轴标签会显得很挤。

```ts
yAxis3D: {
  axisLabel: { show: false },
  splitLine: { show: true, splitNumber: 3 },
}
```
:::

---

## 三轴的常见配置

### X 轴 — 类目

```ts
xAxis3D: {
  data: ['一月', '二月', '三月', '四月'],
  name: '月份',
  axisLabel: { precision: 0 },
}
```

### Y 轴 — 数值

```ts
yAxis3D: {
  name: '销售额',
  min: 0,
  max: 300,
  axisLabel: { precision: 0, abbreviate: true },
  splitLine: { show: true, splitNumber: 5 },
}
```

### Z 轴 — 深度

```ts
// 多系列时用于并排
zAxis3D: { name: '系列' }

// 或作为第二个类目维度（热力图、阶梯图）
zAxis3D: { data: ['周一', '周二', '周三'], name: '星期' }
```

---

## 隐藏整个坐标系

```ts
// 只隐藏某一轴
xAxis3D: { show: false }

// 隐藏全部轴与网格
{ showCoordinate: false }
```

`showCoordinate: false` 等价于三个轴都设 `show: false`，且不渲染地面网格。

---

## 非笛卡尔图表

饼图、雷达图、漏斗图、仪表盘**不使用** `Axis3D`：

```ts
// ✗ 对 pie3D 无效
{ xAxis3D: { data: [...] } }

// ✓ 雷达图用自己的配置
{ radar: { indicator: [...] } }
```

雷达图的 `RadarConfig`：

```ts
{
  radar: {
    indicator: [
      { name: '性能', max: 100 },
      { name: '易用性', max: 100, min: 0 },
    ],
    radius: 3.2,
    splitNumber: 4,
    startAngle: 90,
    axisLine: { show: true, lineStyle: { color: '#334155' } },
    axisLabel: { show: true, textStyle: { fontSize: 11 } },
    splitLine: { show: true, lineStyle: { color: '#1e293b' } },
    splitArea: { show: true, opacity: 0.5 },
    nameStyle: { fontSize: 12, color: '#94a3b8' },
  },
}
```

| 字段 | 类型 | 默认 | 说明 |
|---|---|---|---|
| `indicator` | `{ name, max, min? }[]` | — | 维度定义 |
| `radius` | `number` | 自动 | 半径（世界单位） |
| `splitNumber` | `number` | `4` | 同心环数 |
| `startAngle` | `number` | `90` | 起始角度（度） |
| `axisLine` | `AxisLine` | — | 径向轴线 |
| `axisLabel` | `AxisLabel` | — | 刻度文字 |
| `splitLine` | `SplitLine` | — | 蛛网线 |
| `splitArea` | `{ show, colors, opacity }` | — | 环带填充 |
| `nameStyle` | `TextStyle` | — | 维度名称样式 |

---

## 下一步

- [样式 Style](./style)
- [Series 参考](./series)
