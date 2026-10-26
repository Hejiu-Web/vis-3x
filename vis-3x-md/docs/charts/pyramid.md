# 金字塔图 · pyramid3D

金字塔图把数据画成一摞由下至上逐层收缩的实心棱锥，层宽与该层数值成正比。它适合表达**有天然层级、且越往下基数越大**的结构：人口年龄金字塔、销售漏斗的层级转化、客户分层、库存 ABC 分级。

关键特点是**层序即语义**：数组最后一项永远在最底层、最宽处，越靠前越靠上越窄。这和漏斗图（数据自上而下）的直觉相反，建模时务必注意。

`pyramid3D` 是 `nonCartesian` 图表——它会跳过坐标轴与网格的构建，所有尺寸都是世界单位下的自定常量。

`pyramid3D` 是**扩展示例图表**，需要先注册。

## 最简示例

<LiveChart
  type="pyramid3D"
  :height="400"
  caption="五层用户金字塔：数据自上而下排列，末项落在最底层最宽处，非笛卡尔图表没有坐标轴可参照，因此开启标签读数。"
  :option="{
    showCoordinate: false,
    type: 'pyramid3D',
    tooltip: { show: true, trigger: 'item' },
    series: [
      {
        type: 'pyramid3D',
        name: '用户分层',
        data: [12, 38, 96, 210, 480],
      },
    ],
  }"
/>

::: code-group

```ts [TypeScript]
import { useExtraCharts } from 'vis-3x/presets'
import type { Vis3xOption } from 'vis-3x'

useExtraCharts(['pyramid3D'])

const option: Vis3xOption = {
  type: 'pyramid3D',
  series: [
    {
      type: 'pyramid3D',
      name: '用户分层',
      data: [12, 38, 96, 210, 480],
    },
  ],
}
```

```js [JavaScript]
// 纯 JavaScript：去掉类型标注即可
import { useExtraCharts } from 'vis-3x/presets'

useExtraCharts(['pyramid3D'])

const option = {
  type: 'pyramid3D',
  series: [
    {
      type: 'pyramid3D',
      name: '用户分层',
      data: [12, 38, 96, 210, 480],
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

源码里写死了四个常量，它们没有暴露成任何系列字段：

| 参数 | 源码中的取值 | 位置 |
| --- | --- | --- |
| 总高 | `6` | `const totalHeight = 6` |
| 最宽层的底宽 | `4.4` | `const baseWidth = 4.4` |
| 挤出深度 | `3.2` | `const depth = 3.2` |
| 每层高度 | `totalHeight / values.length` | `const layerHeight = ...` |

所以下面这张表里**没有** `totalHeight`、`baseWidth`、`depth`、`layerHeight` 之类的字段——它们不存在。另外 `nonCartesian: true` 意味着 `xAxis3D` / `yAxis3D` / `zAxis3D` 的配置对图形**完全没有影响**，改 `gridHeight` 也不会让金字塔变高。要调尺寸得复制源码改常量。

:::

实际可用的专属字段全部继承自 `BaseSeries`：

| 字段 | 类型 | 默认值 | 说明 |
| --- | --- | --- | --- |
| `data` | `Array<number \| { value, name? }>` | — | 每个系列的数据。多个系列会沿 Z 轴并排渲染 |
| `color` | `string[]` | `theme.palette` | 逐层调色板，按 `index % colors.length` 取色 |
| `name` | `string` | — | 系列名，进入 tooltip 与图例 |
| `label.show` | `boolean` | — | 为真时在每层右侧显示数值标签 |
| `itemStyle` | `ItemStyle` | — | 材质参数写死，此字段对本图表基本无效果 |
| `animation` | `AnimationConfig` | — | 驱动「各层从上方滑入」的动画 |

以下是**硬编码、不可配置**的材质与几何细节：

| 参数 | 源码中的取值 |
| --- | --- |
| 倒角 | `bevelThickness: 0.02`、`bevelSize: 0.02`、`bevelSegments: 1` |
| 材质 | `preset: 'standard'`、`roughness: 0.32`、`metalness: 0.3`、`side: 'double'` |
| 自发光 | `emissive: color`、`emissiveIntensity: 0.08` |
| 标签位置 | 每层中心 `y + layerHeight * 0.72`，z 固定 `depth * 0.62` |
| 兜底层名 | 数据项无 `name` 时为 `层级 ${index + 1}` |

::: details 每层的宽度是怎么算出来的
```ts
const maxValue = Math.max(...values, 1)                  // 全数组最大值，兜底 1
values.forEach((value, index) => {
  const t = clamp(value / maxValue, 0.08, 1)             // 本层「下方」宽度系数，下限 0.08
  const topT = clamp((values[index + 1] ?? value * 0.6) / maxValue, 0.06, 1)
  const topWidth = baseWidth * topT                      // 本层「上方」宽度
  const bottomWidth = baseWidth * t                      // 本层「下方」宽度
})
```

这里有两个公式要点：

1. **层的上边宽度取的是「下一项」的值**（`values[index + 1]`），不是本层值。因为数组末项在最底层，`index + 1` 恰好是**下面一层**——于是本层的底宽与下一层的顶宽数值一致，层与层之间严丝合缝，不会出现台阶错位。
2. **对最后一项（最底层）没有 `index + 1`**，回退到 `value * 0.6`，即最底层顶宽是自身宽度的 60%。这就是金字塔尖端收口的地方。

`clamp` 的下限 `0.08` / `0.06` 保证即使某层数值相对极小，也仍有一块可见的宽度，不会退化成一条线。

数据是**自上而下**排列的：`t` 由 `value / maxValue` 决定，所以最大的一层最宽、`index` 最大也在最底；如果数据不是递减的，金字塔会变成「鼓起来」的异形——不报错，但语义就乱了。
:::

::: details 标签的锚点为什么用 `mesh.position.y`
```ts
const targetY = (values.length - 1 - index) * layerHeight + layerHeight / 2
mesh.position.y = targetY
...
ctx.anchor(0, mesh.position.y + layerHeight * 0.72, depth * 0.62, ...)
```

堆叠公式 `(values.length - 1 - index) * layerHeight + layerHeight / 2` 把 `index` **倒过来**用：数组末项（`index = length - 1`）得到 `y = layerHeight / 2`，即贴着地面；数组首项落在最高处。

`+ layerHeight / 2` 是因为每层的截面 Shape 以 `-layerHeight/2 ~ +layerHeight/2` 绘制，**几何体中心在原点**，所以位置要抬半个层高，层与层才能无缝相接。

标签的 x 固定在 `0`、z 固定在 `depth * 0.62`（略微伸出金字塔前方），y 跟随层中心再往上 `0.72 × layerHeight`。这个 `0.72` 让标签落在层内的偏上位置，视觉上更居中对齐梯形而不是压在边缘。

**注意**：`ctx.anchor` 用的是 `mesh.position.y` 的**当前值**。而动画在 `plan.custom` 里把 `mesh.position.y` 从 `startY`（`targetY + 2.2`）改到 `targetY`——但标签是在 `plan.custom` 之后才登记的，此时 `mesh.position.y` 还是被赋值过的 `startY`。所以标签初始会偏高，且**不会跟随层一起下落**。这是本图表已知的表现细节；如果标签位置看起来偏，把 `animation` 关掉或缩短时长即可。
:::

## 数据格式

`data` 是**一维数组，且必须按「自上而下」的顺序排列**——`index = 0` 是最顶端最窄的一层，`index = length - 1` 是最底层最宽的一层。

```ts
series: [
  {
    type: 'pyramid3D',
    data: [
      // 自上而下：顶端 → 底部
      12,                                   // 最顶层（最窄）
      { value: 38, name: '高价值' },         // 对象写法可带名字
      96,
      210,
      480,                                  // 最底层（最宽）
    ],
  },
]
```

::: tip 多个系列会沿 Z 轴并排
传入多个 `pyramid3D` 系列时，每个系列画一座金字塔，沿 **Z 轴**依次排开并整体居中：

```ts
series: [
  { type: 'pyramid3D', name: '2024', data: [...] },
  { type: 'pyramid3D', name: '2025', data: [...] },
]
```

系列间距是 `depth × 1.35`。每个系列有独立的 `maxValue` 与配色，
所以两座塔的层宽比例各按自身数据计算——适合做同期对比。
:::

::: warning 非正数与 `NaN` 会被当成 0
```ts
const v = extractScalar(item as never)
return Number.isFinite(v) && v > 0 ? v : 0
```
负数、`0`、`NaN`、`Infinity` 一律变成 `0`。这些层不会消失，而是以 `clamp` 的下限宽度（`baseWidth * 0.08 ≈ 0.35`）画出一块很细的层。如果某层宽度看起来「不对劲地窄」，先检查它是不是 0 或负值。
:::

::: tip 层数建议 3~8 层
`layerHeight = 6 / values.length` 是硬编码的总高除以层数。10 层时每层只有 `0.6` 高，加上数值标签后文字会互相挤压；超过 12 层基本不可读。层数少时（3~4 层）棱锥感最强。
:::

## 完整示例

5 层用户金字塔，逐层配色 + 数值标签 + 自下而上的落位动画：

```ts
import { useExtraCharts } from 'vis-3x/presets'
import type { Vis3xOption } from 'vis-3x'

useExtraCharts(['pyramid3D'])

const option: Vis3xOption = {
  type: 'pyramid3D',
  title: { show: true, text: '用户价值分层', subtext: '单位：万人' },
  tooltip: { show: true, trigger: 'item' },
  series: [
    {
      type: 'pyramid3D',
      name: '用户数',
      // 自上而下：顶端 → 底部
      data: [
        { value: 8, name: '黑钻' },
        { value: 26, name: '钻石' },
        { value: 74, name: '黄金' },
        { value: 185, name: '白银' },
        { value: 430, name: '普通' },
      ],
      // 逐层配色：从深到浅，越往下越"基础"
      color: ['#7c3aed', '#a78bfa', '#fbbf24', '#94a3b8', '#64748b'],
      label: {
        show: true,
        precision: 0,
        suffix: ' 万',
        formatter: '{name} {value}',
        textStyle: { fontSize: 12, color: '#e2e8f0' },
      },
    },
  ],
  animation: { enabled: true, duration: 700, easing: 'cubicOut', stagger: 90 },
  controlSettings: {
    cameraDirection: { x: 1, y: 0.75, z: 1.35 },
    minPolarAngle: 0.5,
    maxPolarAngle: Math.PI / 2.2,
    fitToScreenFactor: 0.8,
  },
  lights: [
    { type: 'ambient', intensity: 0.6 },
    { type: 'directional', position: [1.2, 1.8, 1.4], intensity: 1.5, shadow: true },
  ],
}
```

动画的延迟用的是 `values.length - 1 - index`——**底层（`index` 最大）delay 为 0，先落位**，然后逐层往上，形成「从地面往上堆」的观感。所有层的下落起点统一是 `targetY + 2.2`，距离一致、时间一致，收尾很整齐。

## 使用建议

- **数据必须递减排列**。金字塔的宽度直接由 `value / maxValue` 决定，且层的上下边宽度取自相邻项。数据乱序会让某些层出现「上宽下窄」的倒梯形。先把数据排好序再传进去。
- **没有坐标轴可以参照，请务必开 `label`**。`nonCartesian` 跳过了轴线与刻度，读者唯一能读到具体数值的途径就是标签或 tooltip。`label.show: true` 配合 `formatter` 是最低要求。
- **`cameraDirection.y` 别压太低**。金字塔的层宽差异全在 XZ 平面上，俯角过小（接近水平）时层与层的宽度差会被透视压缩，看起来像一个柱体。建议 `y` 在 `0.7~1.0` 之间。
- **配色要在层间形成递进**。逐层配色时用同色系深浅或明确的分级色（如上例的紫→金→灰），能强化「层级」语义；随机撞色会让金字塔读起来像一块拼图。
- **层数为 3~8 层，且想清楚「为什么是金字塔」**。如果数据本身不构成从大到小的结构，用横向条形图或漏斗图更诚实——金字塔的视觉隐喻本身就是一种断言。
