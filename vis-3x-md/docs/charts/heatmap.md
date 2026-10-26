# 热力图 · heatmap3D

`heatmap3D` 在 XZ 平面网格上铺一层离散色块，每块的高度和颜色同时由数值决定。它是**双类目维度**的图表：X 轴一个类目、Z 轴一个类目，交叉点的数值决定柱块的高低。适合做相关性矩阵、时段×星期的活动分布、A/B 组合的效果对比。相比 `surface3D` 的连续曲面，它更诚实——每块是独立离散的，不会插值出并不存在的中间值。

---

## 最简示例

<LiveChart
  type="heatmap3D"
  :height="400"
  caption="4×4 的订单量网格：X 轴是星期、Z 轴是时段。每块的高度和颜色都由交叉点的数值映射，没给三元组的格子不会绘制。"
  :option="{
    xAxis3D: { data: ['周一', '周二', '周三', '周四'], name: '星期' },
    zAxis3D: { data: ['上午', '下午', '晚间', '深夜'], name: '时段' },
    yAxis3D: { name: '订单量' },
    series: [
      {
        type: 'heatmap3D',
        name: '订单分布',
        xAxisData: ['周一', '周二', '周三', '周四'],
        zAxisData: ['上午', '下午', '晚间', '深夜'],
        data: [
          [0, 0, 42], [1, 0, 51], [2, 0, 38], [3, 0, 56],
          [0, 1, 68], [1, 1, 74], [2, 1, 59], [3, 1, 81],
          [0, 2, 95], [1, 2, 88], [2, 2, 102], [3, 2, 119],
          [0, 3, 21], [1, 3, 17], [2, 3, 26], [3, 3, 33],
        ],
      },
    ],
  }"
/>

::: code-group

```ts [TypeScript]
import type { Vis3xOption } from 'vis-3x'

const option: Vis3xOption = {
  xAxis3D: { data: ['周一', '周二', '周三', '周四'], name: '星期' },
  zAxis3D: { data: ['上午', '下午', '晚间', '深夜'], name: '时段' },
  yAxis3D: { name: '订单量' },
  series: [
    {
      type: 'heatmap3D',
      name: '订单分布',
      xAxisData: ['周一', '周二', '周三', '周四'],
      zAxisData: ['上午', '下午', '晚间', '深夜'],
      data: [
        [0, 0, 42], [1, 0, 51], [2, 0, 38], [3, 0, 56],
        [0, 1, 68], [1, 1, 74], [2, 1, 59], [3, 1, 81],
        [0, 2, 95], [1, 2, 88], [2, 2, 102], [3, 2, 119],
        [0, 3, 21], [1, 3, 17], [2, 3, 26], [3, 3, 33],
      ],
    },
  ],
}
```

```js [JavaScript]
// 纯 JavaScript：去掉类型标注即可
const option = {
  xAxis3D: { data: ['周一', '周二', '周三', '周四'], name: '星期' },
  zAxis3D: { data: ['上午', '下午', '晚间', '深夜'], name: '时段' },
  yAxis3D: { name: '订单量' },
  series: [
    {
      type: 'heatmap3D',
      name: '订单分布',
      xAxisData: ['周一', '周二', '周三', '周四'],
      zAxisData: ['上午', '下午', '晚间', '深夜'],
      data: [
        [0, 0, 42], [1, 0, 51], [2, 0, 38], [3, 0, 56],
        [0, 1, 68], [1, 1, 74], [2, 1, 59], [3, 1, 81],
        [0, 2, 95], [1, 2, 88], [2, 2, 102], [3, 2, 119],
        [0, 3, 21], [1, 3, 17], [2, 3, 26], [3, 3, 33],
      ],
    },
  ],
}
```

:::

```vue
<template>
  <div style="height: 460px">
    <VisHeatmap3D :option="option" />
  </div>
</template>
```

注意 `xAxisData` / `zAxisData` 是 **series 级**字段，不是轴上的 `data`。轴上那份 `xAxis3D.data` / `zAxis3D.data` 负责刻度和类目计数，series 里那份负责生成 tooltip 名字——**两份都要写，且顺序一致**。

---

## 专属配置项

`Heatmap3DSeries` 同样**不继承** `BaseSeries`（没有 `stack` / `zAxisIndex` 等字段）。完整字段：

| 字段 | 类型 | 默认值 | 说明 |
|---|---|---|---|
| `data` | `Array<[number, number, number] \| { value: [number, number, number] }>` | 必填 | 三元组 `[x 索引, z 索引, 数值]` |
| `name` | `string` | — | 系列名 |
| `xAxisData` | `Array<string \| number>` | — | X 方向类目名。不传时用数据里的最大 x 索引 + 1 推断格子数 |
| `zAxisData` | `Array<string \| number>` | — | Z 方向类目名。作用同上 |
| `colorGradient` | `string[]` | 内置 7 色带 | 色带（从低到高），色块的填充色 |
| `valueRange` | `[number, number]` | 数据极值 | **颜色**映射的数值范围 |
| `heightRange` | `[number, number]` | `[0.15, gridHeight × 0.9]` | **高度**映射的世界单位范围 |
| `tileRatio` | `number` | `0.86` | 色块占格子的比例，被 `clamp` 到 `0.1 ~ 1` |
| `showValue` | `boolean` | `false` | 是否在色块顶部显示数值 |
| `itemStyle` | `ItemStyle` | — | 色块材质样式。可调 `roughness` / `metalness` / `opacity` 等，但 **`color` 无效**——颜色始终由 `colorGradient` 按数值决定 |
| `label` | `LabelStyle` | — | 标签样式。`label.show` 为 true 时等效于 `showValue`，且可用 `label.formatter` 自定义文本 |

默认色带与曲面图相同：`#1e3a8a → #0ea5e9 → #22d3ee → #34d399 → #fde047 → #fb923c → #ef4444`。

### 颜色和高度是两套独立映射

这是热力图最容易搞混的地方：

```
t = clamp((value - valueRange[0]) / (valueRange[1] - valueRange[0]), 0, 1)

颜色 = gradientColorAt(colorGradient, t)
高度 = lerp(heightRange[0], heightRange[1], t)
```

两者**共用同一个 `t`**，但范围分别由 `valueRange` 和 `heightRange` 控制。所以你可以让颜色范围比高度范围更宽——颜色表达完整数值差异，高度则压在一个视觉舒服的区间里，避免最高的色块顶穿网格。

::: warning heightRange 的上限别超过 gridHeight
默认上限是 `gridHeight × 0.9`（`gridHeight` 由网格自动推导，约在 4.5~8.5）。设成比 `gridHeight` 大的值，色块会直接穿出网格上边界。想突出高度差异，把下限压得更极端（比如 `0.1`）比拉高上限更安全。
:::

::: tip 色块高度不参与 Y 轴数值推导
热力图的数值只影响色块自身的高度与颜色，**不会**改变 `yAxis3D` 的 domain。即使数值是 10000，色块高度也只在 `heightRange` 里取值。这是它和 `bar3D` 的关键区别。
:::

---

## 数据格式

数据是**三元组数组**，不是矩阵。每个三元组代表一个格子：

```ts
series: [
  {
    type: 'heatmap3D',

    // [x 索引, z 索引, 数值]
    data: [
      [0, 0, 42],   // x 类目 0 × z 类目 0
      [1, 0, 51],   // x 类目 1 × z 类目 0
      [0, 1, 68],   // x 类目 0 × z 类目 1
    ],

    // 对象形式等价：{ value: [0, 0, 42] }
  },
]
```

三点约定：

- **x / z 是索引，不是数值。** 实现里直接当作类目下标使用（`stepX * (cell.x + 0.5)`），写小数位置会偏——**给整数**。
- **格子尺寸** 由 `xAxisData.length`（或数据中最大 x 索引 + 1）决定：`stepX = gridWidth / xCount`，`stepZ = gridDepth / zCount`。
- **没给的三元组就是不画**。热力图不补零，稀疏数据会留下空位——这反而是它的好处。非有限数值会被直接跳过。

::: details 从矩阵转成三元组
```ts
const matrix = [[42, 51, 38], [68, 74, 59], [95, 88, 102]]
const cells = matrix.flatMap((row, z) => row.map((v, x) => [x, z, v] as [number, number, number]))
// → [[0,0,42], [1,0,51], [2,0,38], [0,1,68], ...]
```
:::

---

## 完整示例

双类目维度 + 独立控制高度与颜色的映射范围 + 数值标注：

```ts
const option: Vis3xOption = {
  title: { show: true, text: '门店客流热力', subtext: '高度与颜色 = 客流量' },
  xAxis3D: { data: ['周一', '周二', '周三', '周四', '周五', '周六', '周日'], name: '星期' },
  zAxis3D: { data: ['凌晨', '上午', '下午', '晚间'], name: '时段' },
  yAxis3D: { name: '客流量（相对高度）' },
  tooltip: { show: true, trigger: 'item' },   // 名字形如「周三 / 下午」
  series: [
    {
      type: 'heatmap3D',
      name: '客流',
      xAxisData: ['周一', '周二', '周三', '周四', '周五', '周六', '周日'],
      zAxisData: ['凌晨', '上午', '下午', '晚间'],
      data: [
        // 每行一个时段：[x 索引, z 索引, 数值]
        [0, 0, 8], [1, 0, 6], [2, 0, 7], [3, 0, 5], [4, 0, 12], [5, 0, 24], [6, 0, 19],   // 凌晨
        [0, 1, 46], [1, 1, 52], [2, 1, 49], [3, 1, 55], [4, 1, 68], [5, 1, 92], [6, 1, 84], // 上午
        [0, 2, 61], [1, 2, 58], [2, 2, 66], [3, 2, 72], [4, 2, 95], [5, 2, 128], [6, 2, 116], // 下午
        [0, 3, 74], [1, 3, 69], [2, 3, 81], [3, 3, 88], [4, 3, 112], [5, 3, 76], [6, 3, 63], // 晚间
      ],
      valueRange: [0, 140],          // 颜色范围放宽到 140，避免周末峰值把工作日压成一片深蓝
      heightRange: [0.12, 5.2],      // 高度范围收窄，色块不会顶穿网格
      tileRatio: 0.9,                // 色块留一点缝，看得出格子边界
      colorGradient: ['#1e3a8a', '#0ea5e9', '#34d399', '#fde047', '#fb923c', '#ef4444'],
      showValue: true,               // 顶部标数值
      label: { precision: 0, distance: 0.22, textStyle: { fontSize: 10, color: '#e2e8f0' } },
      itemStyle: { roughness: 0.35, metalness: 0.2 },  // 别写 color，会覆盖掉数值渐变色
    },
  ],
}
```

几个配置意图：

- **`valueRange` 放宽到 140**：数据最大值是 128。若让范围自动取到 128，周末峰值会独占色带顶端，工作日全挤在下半段。手动留余量能让中间段的色差更可辨。
- **`tileRatio: 0.9`**：留 10% 缝隙，读者能数清格子边界。想让整片连成连续色域就设 `1`。
- **`heightRange` 与 `valueRange` 解耦**：这里取 `[0.12, 5.2]`。默认上限是 `gridHeight × 0.9`，觉得"柱子太高像柱状图"就压低上限。
- **`itemStyle.color` 不生效**：颜色由 `colorGradient` 按数值映射，材质创建时 `color` 会被强制写回。
  想改整体色系请换 `colorGradient`，不要用 `itemStyle.color`。
  其他字段（`roughness` / `metalness` / `opacity` / `emissiveIntensity`）正常生效。

---

## 使用建议

1. **两个维度都控制在 30 以内。** 30 × 30 = 900 个独立 `BoxGeometry` 网格，每个都参与射线检测。超过之后帧率下降明显，且色块小到已经看不出差异。格子更多时考虑降采样或改用 `surface3D`。

2. **热力图适合"离散 × 离散"，不适合连续量。** 如果两个维度物理上是连续的温度、时间、坐标，用 `surface3D` 更自然——插值出的中间值有意义。只有两个维度天然就是类目（星期、渠道、产品线）时，离散色块才是正确表达。

3. **高度和颜色不要编码两个不同的量。** 默认两者共用同一个 `t`，等于双重强调同一个数值。看着"3D 酷炫"，信息量却没增加，还会让读者误以为高度和颜色是两个独立维度。真有两个量要表达时，用颜色编码类别、高度编码数值。

4. **单系列图表别指望图例。** 热力图通常只有一个系列，`legend` 只有一项、没有信息量。更有效的做法是把色带做成 HTML 图例，或者开 `showValue` 直接标数值。另外 `Heatmap3DSeries` 没有系列级并排开关，多系列热力图会叠在同一网格上。
