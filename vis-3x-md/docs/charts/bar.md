# 柱状图 · bar3D

`bar3D` 用来比较**离散类目之间的大小**。每个类目一根带厚度的柱体，高度映射数值，宽度和深度占据网格上的一个槽位。它适合 5~20 个类目、需要一眼看出"谁高谁低"的场景，比如各季度销售额、各地区产量对比。类目超过 30 个之后柱子会细到看不出差异，这时应该换成 `heatmap3D` 或 `surface3D`。

---

## 最简示例

<LiveChart
  type="bar3D"
  :height="400"
  caption="单个系列的四分类柱状图。拖拽旋转可以看到柱体的厚度与地面网格。"
  :option="{
    xAxis3D: { data: ['Q1', 'Q2', 'Q3', 'Q4'], name: '季度' },
    yAxis3D: { name: '销售额' },
    series: [
      {
        type: 'bar3D',
        name: '2025 年',
        data: [120, 200, 150, 80],
      },
    ],
  }"
/>

::: code-group

```ts [TypeScript]
import type { Vis3xOption } from 'vis-3x'

const option: Vis3xOption = {
  xAxis3D: { data: ['Q1', 'Q2', 'Q3', 'Q4'], name: '季度' },
  yAxis3D: { name: '销售额' },
  series: [
    {
      type: 'bar3D',
      name: '2025 年',
      data: [120, 200, 150, 80],
    },
  ],
}
```

```js [JavaScript]
// 纯 JavaScript：去掉类型标注即可
const option = {
  xAxis3D: { data: ['Q1', 'Q2', 'Q3', 'Q4'], name: '季度' },
  yAxis3D: { name: '销售额' },
  series: [
    {
      type: 'bar3D',
      name: '2025 年',
      data: [120, 200, 150, 80],
    },
  ],
}
```

:::

```vue
<template>
  <div style="height: 460px">
    <VisBar3D :option="option" />
  </div>
</template>
```

不写 `barWidth` / `barDepth` 时，库按类目步长和网格深度自动算槽位：单系列宽度约为 `步长 × (1 - barCategoryGap)`，深度约为 `min(gridDepth × 0.42, barWidth × 1.6)`。**不确定就不要写这两个字段。**

---

## 专属配置项

只列 `Bar3DSeries` 独有的字段；`name` / `data` / `color` / `itemStyle` / `label` / `stack` / `visible` / `animation` 见 [基类字段](/api/series)。

| 字段 | 类型 | 默认值 | 说明 |
|---|---|---|---|
| `barWidth` | `number \| string` | 按槽位自动 | 柱子宽度。数字为世界单位；字符串如 `'60%'` 按类目步长取百分比 |
| `barDepth` | `number \| string` | `min(gridDepth × 0.42, barWidth × 1.6)` | 柱子深度（Z 方向）。字符串按网格深度取百分比 |
| `barGap` | `number` | `0.08` | 同组内相邻柱子的间隙，占步长比例（实现中按 `step × barGap × 0.1` 扣减宽度） |
| `barCategoryGap` | `number` | `0.32` | 类目组之间的间隙比例，先扣掉它再在组内平分宽度 |
| `borderRadius` | `number` | `0.06` | 圆角**比例**，实际圆角半径 = `borderRadius × min(barWidth, barDepth)` |
| `colorByValue` | `boolean` | `false` | 按数值在当前 Y 轴 domain 中的位置插值取色（连续色带），会覆盖系列调色板 |
| `capStyle` | `ItemStyle` | 金属度 > 0.2 时自动生成 | 柱顶那层薄片（发光顶盖）的材质样式 |
| `topLabel` | `LabelStyle` | — | 柱子顶部标签，仅在 `label` 未设置时生效（`label ?? topLabel ?? option.label`） |

::: tip 圆角是比例不是绝对值
`borderRadius: 0.06` 不是 0.06 个世界单位。实现里是 `radius × Math.min(width, depth)`。
所以同一份配置在窄柱子上圆角也窄，视觉比例恒定。想做出"胶囊柱"就调到 `0.3` 以上。
:::

::: warning 顶盖是自动出现的
当 `itemStyle.metalness > 0.2`（默认就是 0.25）时，每根柱子会额外挂一个 `BoxGeometry` 顶盖。
它会轻微放大柱截面（`width × 1.005`）并带一点自发光。柱子很多时可以显式设 `itemStyle: { metalness: 0.1 }` 关掉它，减少一倍绘制对象。
:::

---

## 数据格式

`Bar3DSeries['data']` 的类型是 `Array<number | SingleValueDataItem>`，即两种写法：

```ts
series: [
  {
    type: 'bar3D',

    // 写法 1：纯数字数组（最常用）
    data: [120, 200, 150, 80],

    // 写法 2：对象数组，可为单项指定名字与样式
    // data: [
    //   { value: 120, name: 'Q1' },
    //   { value: 200, name: 'Q2', itemStyle: { color: '#f43f5e' } },
    //   { value: 150, name: 'Q3', label: { show: true, suffix: ' 万' } },
    // ],
  },
]
```

**不支持**多维数组。写 `data: [[1, 2], [3, 4]]` 时标量提取会取数组的第二个元素（`extractScalar` 对多值取 `v[1] ?? v[0]`），结果往往不是你想要的。要做二维矩阵请用 `surface3D`，要做三维点位请用 `scatter3D`。

---

## 完整示例

多系列 + 堆叠 + 负值 + 按值上色：

```ts
const option: Vis3xOption = {
  title: { show: true, text: '各渠道收支', subtext: '单位：万元' },
  xAxis3D: { data: ['一月', '二月', '三月', '四月'], name: '月份' },
  yAxis3D: { name: '金额' },          // 含负值，0 平面会自动落在网格中部
  zAxis3D: { name: '系列' },          // 多系列时用于深度方向并排
  legend: { show: true, position: 'bottom' },
  tooltip: { show: true, trigger: 'item' },
  series: [
    {
      type: 'bar3D',
      name: '线上收入',
      stack: 'income',                // 同名 stack 会堆叠，正值向上累加
      data: [120, 132, 101, 134],
      borderRadius: 0.12,             // 更圆的柱角
      barDepth: 1.6,                  // 显式指定深度，让堆叠柱更"厚"
    },
    {
      type: 'bar3D',
      name: '线下收入',
      stack: 'income',
      data: [90, 68, 75, 102],
      borderRadius: 0.12,
      barDepth: 1.6,
      label: { show: true, precision: 0, position: 'top' },
    },
    {
      type: 'bar3D',
      name: '支出',
      stack: 'cost',                  // 另一个堆叠组，与收入不叠加
      data: [-60, -45, -80, -52],     // 负值向下堆叠，与正值分别累加
      colorByValue: true,             // 按数值在 Y domain 中的位置取连续色
      itemStyle: { metalness: 0.1 },  // 关掉自动顶盖，减少绘制对象
    },
  ],
}
```

几个行为上的细节：

- **堆叠只对柱底生效**：第二根柱子从第一根的顶部开始，正负分别维护累加器，所以同一类目可以同时有向上和向下的柱段。
- **多系列沿 Z 轴排开**：`seriesCount > 1` 时，第 `i` 个系列定位在 `zAt((i + 0.5) / seriesCount)`，而不是像 2D 图表那样挤在 X 方向上。
- **Y 轴范围自动留白**：自动模式下顶部会多留 8% 再进行"好看刻度"取整；要精确控制就显式写 `yAxis3D: { min: 0, max: 300 }`。

---

## 使用建议

1. **别手动设 `barWidth`，除非你知道步长。** 类目步长是 `gridWidth / 类目数`，`gridWidth` 又会按 `clamp(类目数 × 1.35, 8, 16)` 自动推导。写了显式宽度后库**不会**做任何重叠检测——类目一多就会互相穿插。要调间距用 `barCategoryGap` / `barGap`，它们是比例，天然自适应。

2. **堆叠柱不要超过 4 段。** 底座以下的段落在斜视角下会被前排柱子遮挡，第 5 段开始基本看不清。超过 4 个维度考虑换成 `area3D` 堆叠或者分面展示。

3. **柱子数量控制在单系列 50 根以内。** 每根柱子都是一个独立的 `ExtrudeGeometry` + 顶盖 Mesh，绘制调用数随类目线性增长。数据密集时热力图在信息密度和性能上都更划算。

4. **负值场景记得检查 0 平面。** 有负值时 `yAxis.domain` 会自动扩展到负区，0 平面随之上移到网格中部。如果你的柱子在视觉上"悬空"，通常是因为显式写了 `yAxis3D.min: 0` 把负值裁掉了。
