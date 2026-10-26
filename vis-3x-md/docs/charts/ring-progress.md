# 多环进度图 · ringProgress3D

多环进度图把每个数据项画成**一圈嵌套的立体圆环**，最外圈是第 1 项、向内逐圈递减。它适合在有限空间里同时展示 4~8 个「完成度」指标：服务器资源占用、项目各阶段达成率、技能雷达的替代方案。

相比雷达图，它不需要读者理解多边形面积；相比并排的 8 个进度条，它在 3D 场景里只有一个视觉焦点，观感更整。

`ringProgress3D` 是 `nonCartesian` 图表——不构建坐标轴与网格，所有尺寸都是世界单位下的自定常量。

`ringProgress3D` 是**扩展示例图表**，需要先注册。

## 最简示例

<LiveChart
  type="ringProgress3D"
  :height="400"
  caption="四环完成率：data 是一维数字数组，每项一圈由外向内递减，max 决定进度分母，标签落在各自进度弧的末端。"
  :option="{
    showCoordinate: false,
    type: 'ringProgress3D',
    tooltip: { show: true, trigger: 'item' },
    series: [
      {
        type: 'ringProgress3D',
        name: '完成率',
        data: [82, 64, 91, 45],
        max: 100,
      },
    ],
  }"
/>

::: code-group

```ts [TypeScript]
import { useExtraCharts } from 'vis-3x/presets'
import type { Vis3xOption } from 'vis-3x'

useExtraCharts(['ringProgress3D'])

const option: Vis3xOption = {
  type: 'ringProgress3D',
  series: [
    {
      type: 'ringProgress3D',
      name: '完成率',
      // data 是数字数组，配合 max 决定进度比例
      data: [82, 64, 91, 45],
      max: 100,
    },
  ],
}
```

```js [JavaScript]
// 纯 JavaScript：去掉类型标注即可
import { useExtraCharts } from 'vis-3x/presets'

useExtraCharts(['ringProgress3D'])

const option = {
  type: 'ringProgress3D',
  series: [
    {
      type: 'ringProgress3D',
      name: '完成率',
      // data 是数字数组，配合 max 决定进度比例
      data: [82, 64, 91, 45],
      max: 100,
    },
  ],
}
```

:::

```vue
<template>
  <div style="height: 520px">
    <VisChart :option="option" />
  </div>
</template>
```

## 专属配置项

::: warning 先说清楚：所有几何尺寸都是硬编码的

源码里写死了四个常量，没有暴露成系列字段：

| 参数 | 源码中的取值 | 位置 |
| --- | --- | --- |
| 环宽 | `0.34` | `const ringWidth = 0.34` |
| 环间距 | `0.12` | `const gap = 0.12` |
| 最外圈半径 | `2.9` | `const baseRadius = 2.9` |
| 挤出厚度 | `0.32` | `const depth = 0.32` |

所以下面这张表里**没有** `ringWidth`、`gap`、`baseRadius`、`depth` 之类的字段。另外因为是 `nonCartesian`，`xAxis3D` / `yAxis3D` / `zAxis3D` 的配置对图形没有影响。想调环的粗细或圈数上限，得复制源码改常量。

:::

实际可用的专属字段只有两个：

| 字段 | 类型 | 默认值 | 说明 |
| --- | --- | --- | --- |
| `data` | `number[]` | — | **数字数组**，每一项对应一圈。不是对象数组 |
| `max` | `number` | `Math.max(...data, 100)` | 进度分母。`ratio = clamp(value / max, 0, 1)` |

继承自 `BaseSeries` 的通用字段：

| 字段 | 类型 | 默认值 | 说明 |
| --- | --- | --- | --- |
| `color` | `string[]` | `theme.palette` | 逐环调色板，按 `index % colors.length` 取色 |
| `name` | `string` | — | 系列名，进入 tooltip |
| `label` | `LabelStyle` | 见下 | **`label.show !== false` 时才显示**；不传时用内置默认样式 |
| `itemStyle` | `ItemStyle` | — | 材质参数写死，此字段对本图表基本无效果 |
| `animation` | `AnimationConfig` | — | 驱动进度弧「从中心向外扩张」的动画 |

以下是**硬编码、不可配置**的细节：

| 参数 | 源码中的取值 |
| --- | --- |
| 轨道颜色 | `shade(color, -0.4)`，即把环色调暗 40% |
| 轨道材质 | `roughness 0.6 / metalness 0.2 / opacity 0.35 / transparent true` |
| 进度弧材质 | `roughness 0.25 / metalness 0.4 / emissiveIntensity 0.35` |
| 倒角 | `bevelThickness: 0.012`、`bevelSize: 0.012`、`bevelSegments: 1` |
| 标签高度 | y 固定 `0.22` |
| 标签半径 | `radius + ringWidth * 0.9` |
| 兜底标签文本 | `${Math.round(ratio * 100)}%` |
| 兜底层名 | 数据项无名字时为 `指标 ${index + 1}` |

::: details 每环的半径怎么递减
环宽与间隙**按数据量自适应**，保证所有数据项都能画出来：

```ts
const count = Math.max(1, values.length)
const innerLimit = 0.55                       // 最内环半径下限
const usable = baseRadius - innerLimit
const slot = usable / count                   // 每环占用的径向空间
const ringWidth = Math.max(0.14, slot * 0.74) // 环宽约占 74%
const gap = Math.max(0.04, slot - ringWidth)

const radius = baseRadius - index * (ringWidth + gap)
if (radius <= ringWidth * 0.6) return         // 细到不可见才跳过
```

第 1 环半径固定为 `baseRadius`（`2.9`），之后按 `ringWidth + gap` 递减：

| 数据项数 | 环宽 | 间隙 | 最内环半径 |
| --- | --- | --- | --- |
| 3 | 0.580 | 0.204 | 1.333 |
| 5 | 0.348 | 0.122 | 1.020 |
| 8 | 0.217 | 0.076 | 0.844 |
| 12 | 0.145 | 0.051 | 0.746 |

环宽下限是 `0.14`、间隙下限 `0.04`，所以数据项很多时环会细到看不见——
但**不会像固定环宽那样在第 7 项处静默丢弃数据**。
:::

::: details 轨道（track）与进度弧（arc）的区别
每一环会尝试构建**两个**几何体：

```ts
// 1. 背景轨道：整圈，暗色半透明，永远绘制
const track = buildArc(0, 359.9, ctx.material(shade(color, -0.4), { opacity: 0.35, transparent: true }))
ctx.add(track)

// 2. 进度弧：从 90° 起顺时针扫 sweep 度，只在 sweep > 0.5 时绘制
const sweep = 359.9 * ratio
if (sweep > 0.5) {
  const arc = buildArc(90, 90 - sweep, ctx.material(color, { ... }))
  ctx.pickable(arc, { ... })
  ctx.add(arc)
}
```

- **轨道**是「满环的底」，让读者知道 100% 在哪里；它**不参与拾取**，hover 到轨道上不会出 tooltip。
- **进度弧**是真实数值，**只有一个对象可拾取**（`ctx.pickable(arc, ...)`），tooltip 绑在它身上。

`359.9` 而不是 `360` 是个实用细节：闭合的 360° 圆环在 `ExtrudeGeometry` 里首尾顶点重合，容易产生法线翻转的接缝。留 0.1° 缺口可以绕开。

进度弧的扫过角度就是 `359.9 * ratio`。两点注意：

1. **`ratio = 0` 时进度弧完全不画**（`sweep = 0` 不大于 `0.5`），只剩一个暗色轨道环。这是「0%」应有的样子。
2. **起始角固定 90°**（12 点方向），顺时针扫。源码里弧的角度参数是 `buildArc(90, 90 - sweep)`，而标签用的 `endAngle` 是 `degToRad(90 - sweep - 6)`——`- 6` 是让标签再往外让 6°，避免压住弧末端。
:::

## 数据格式

`data` 是**纯数字数组**，不是对象数组。第 `index` 项对应第 `index` 环（从外向内）。

```ts
series: [
  {
    type: 'ringProgress3D',
    data: [82, 64, 91, 45],   // 4 环，最外圈 82
    max: 100,                  // 分母，决定 82 → 82%
  },
]
```

::: warning `max` 的默认值有个陷阱
```ts
const maxValue = (series as { max?: number }).max ?? Math.max(...values, 100)
```

不传 `max` 时，分母是 `max(数据最大值, 100)`。所以：

- 数据是 `[82, 64, 91, 45]` → `max = max(91, 100) = 100` → 内圈 91 显示 91%，符合直觉；
- 数据是 `[1200, 800, 1500]` → `max = max(1500, 100) = 1500` → **最大那一项永远是 100%**。

「最大项恒为满环」在「相对比较」的场景下没问题，但它不是「完成度」。要表达完成率请**显式传 `max`**（比如 `max: 2000` 表示配额），否则数值语义会悄悄变成归一化。
:::

::: warning 对象数组会被解析成什么
`extractScalar` 对 `{ value: 82 }` 这类对象能正常取出 `82`，所以 `data: [{ value: 82 }]` 不会报错。但**数据项的名字会被丢弃**——标签里读的是 `extractName(series.data[index], '指标 N')`，对象上的 `name` 只在部分路径生效，且 `data` 的类型签名是 `number[]`，写对象数组过不了类型检查。**请老老实实传数字数组**，环的名字靠别的方式标注（比如在图例或外层 HTML 里）。
:::

::: tip 标签默认是开启的
`if (series.label?.show !== false)` —— 判断的是 **`!== false`**，所以**不传 `label` 也会显示标签**，内容为 `${Math.round(ratio * 100)}%`，样式为内置的 `{ fontSize: 11, color: ctx.theme.textColor }`。

想关掉标签必须显式写 `label: { show: false }`，只写 `label: {}` 是关不掉的。传了 `label` 对象时，`show` 不为 `false` 且带 `formatter` 就用 `formatLabel` 的结果，否则回退到百分比文本。
:::

## 完整示例

6 环系统资源面板，自定义配色与标签格式：

```ts
import { useExtraCharts } from 'vis-3x/presets'
import type { Vis3xOption } from 'vis-3x'

useExtraCharts(['ringProgress3D'])

const option: Vis3xOption = {
  type: 'ringProgress3D',
  title: { show: true, text: '集群资源占用', subtext: '外圈 → 内圈' },
  tooltip: { show: true, trigger: 'item' },
  series: [
    {
      type: 'ringProgress3D',
      name: '资源',
      // 6 项：正好卡在 6 环的绘制上限
      data: [88, 62, 41, 95, 30, 77],
      max: 100,
      color: [
        '#f87171', '#fbbf24', '#34d399',
        '#22d3ee', '#60a5fa', '#a78bfa',
      ],
      label: {
        show: true,
        precision: 0,
        suffix: '%',
        textStyle: { fontSize: 12, color: '#e2e8f0' },
      },
    },
  ],
  animation: { enabled: true, duration: 900, easing: 'backOut', stagger: 110 },
  controlSettings: {
    cameraDirection: { x: 0.6, y: 1.5, z: 0.9 },   // 接近俯视，环的嵌套关系最清楚
    minPolarAngle: 0.25,
    maxPolarAngle: Math.PI / 2.6,
    fitToScreenFactor: 0.75,
  },
  lights: [
    { type: 'ambient', intensity: 0.7 },
    { type: 'directional', position: [0.8, 1.8, 1], intensity: 1.4, shadow: true },
  ],
}
```

进度弧的动画是 `arc.scale.set(s, s, 1)`——**在 XY 平面上从中心缩放**，所以视觉上是「弧从圆心长出来」，而不是「沿圆周扫过」。`scale.z` 固定为 `1`，厚度不变。配合 `easing: 'backOut'` 会有轻微过冲，观感更像仪表盘通电。

## 使用建议

- **环数建议 3~6 个**。环宽会随数据量自适应收缩，所以超过 6 项也会全部画出来，不会丢数据；但环宽下限是 `0.14`，10 项以上每环就细到难以分辨了。真要展示很多指标，拆成多个图表实例更清楚。
- **务必显式传 `max`**。默认分母是 `max(数据最大值, 100)`，会让最大项恒为满环，把「绝对完成度」偷换成「相对比较」。传 `max: 100` 表示百分比、`max: 配额` 表示达成率，语义才明确。
- **配色要能区分相邻环，别用同色系渐变**。环与环是嵌套关系，相邻环颜色太近时边界会糊在一起。用色相差异明显的颜色（如上例红→黄→绿→青→蓝→紫），或者干脆单色、靠标签区分。
- **标签位置是自动错开的**。标签落在各自进度弧的末端（`degToRad(90 - sweep - 6)`），所以进度不同的环标签天然分散、不会重叠——这是本图表相比「所有标签固定在 12 点方向」的进度条组最大的优势，不必手动调 `offset`。
- **相机俯角调大一些**。环是水平的圆，接近平视时它们会退化成几条重叠的线，只能看到最外圈的侧面。`cameraDirection.y` 在 `1.4~1.6`、`maxPolarAngle` 收紧到 `Math.PI / 2.6` 左右，嵌套关系最清晰。
