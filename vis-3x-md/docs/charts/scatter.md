# 散点图 · scatter3D

`scatter3D` 把每个数据项画成一个独立的三维标记，位置可以是完整的 `[x, y, z]` 直角坐标。它是这个库里**唯一真正使用第三维数据**的图表：`bar3D` / `line3D` 的 Z 只是系列的排布层，而 `scatter3D` 的 Z 是数据本身。适合做聚类观察、相关性分析、多维指标分布。代价是每个点都是一个独立网格对象，数据量大时性能下降得很快。

---

## 最简示例

<LiveChart
  type="scatter3D"
  :height="400"
  caption="20 个样本的三维分布：X 是响应时间、Y 是转化率、Z 是客单价指数。三根轴都是数值轴，点的位置就是数据本身的三个分量。"
  :option="{
    xAxis3D: { type: 'value', min: 0, max: 100, name: '响应时间(ms)' },
    yAxis3D: { min: 0, max: 100, name: '转化率(%)' },
    zAxis3D: { type: 'value', min: 0, max: 100, name: '客单价指数' },
    series: [
      {
        type: 'scatter3D',
        name: '样本',
        data: [
          [8, 74, 46], [14, 66, 58], [21, 81, 39], [27, 58, 71], [33, 69, 52],
          [39, 47, 63], [45, 62, 44], [52, 55, 77], [58, 71, 35], [63, 43, 68],
          [69, 38, 57], [74, 52, 49], [79, 34, 72], [85, 46, 41], [91, 28, 65],
          [96, 22, 54], [18, 88, 29], [41, 76, 83], [67, 63, 61], [88, 41, 24],
        ],
      },
    ],
  }"
/>

::: code-group

```ts [TypeScript]
import type { Vis3xOption } from 'vis-3x'

const option: Vis3xOption = {
  xAxis3D: { type: 'value', min: 0, max: 100, name: '响应时间(ms)' },
  yAxis3D: { min: 0, max: 100, name: '转化率(%)' },
  zAxis3D: { type: 'value', min: 0, max: 100, name: '客单价指数' },
  series: [
    {
      type: 'scatter3D',
      name: '样本',
      data: [
        [8, 74, 46], [14, 66, 58], [21, 81, 39], [27, 58, 71], [33, 69, 52],
        [39, 47, 63], [45, 62, 44], [52, 55, 77], [58, 71, 35], [63, 43, 68],
        [69, 38, 57], [74, 52, 49], [79, 34, 72], [85, 46, 41], [91, 28, 65],
        [96, 22, 54], [18, 88, 29], [41, 76, 83], [67, 63, 61], [88, 41, 24],
      ],
    },
  ],
}
```

```js [JavaScript]
// 纯 JavaScript：去掉类型标注即可
const option = {
  xAxis3D: { type: 'value', min: 0, max: 100, name: '响应时间(ms)' },
  yAxis3D: { min: 0, max: 100, name: '转化率(%)' },
  zAxis3D: { type: 'value', min: 0, max: 100, name: '客单价指数' },
  series: [
    {
      type: 'scatter3D',
      name: '样本',
      data: [
        [8, 74, 46], [14, 66, 58], [21, 81, 39], [27, 58, 71], [33, 69, 52],
        [39, 47, 63], [45, 62, 44], [52, 55, 77], [58, 71, 35], [63, 43, 68],
        [69, 38, 57], [74, 52, 49], [79, 34, 72], [85, 46, 41], [91, 28, 65],
        [96, 22, 54], [18, 88, 29], [41, 76, 83], [67, 63, 61], [88, 41, 24],
      ],
    },
  ],
}
```

:::

```vue
<template>
  <div style="height: 460px">
    <VisScatter3D :option="option" />
  </div>
</template>
```

想用完整三维坐标，**必须把 `xAxis3D` / `zAxis3D` 设成 `type: 'value'`**。否则它们会被当成类目轴，`[12, 68, 42]` 里的 `12` 会被四舍五入成类目索引 12 再夹到类目范围内。

---

## 专属配置项

只列 `Scatter3DSeries` 独有的字段。

| 字段 | 类型 | 默认值 | 说明 |
|---|---|---|---|
| `pointStyle` | `PointStyle` | — | 点样式：`color` / `size` / `opacity` / `transparent` / `emissive` / `emissiveIntensity` / `roughness` / `metalness` / `envMapIntensity` / `preset` / `symbol` / `sizeRange` |
| `pointStyle.symbol` | `'circle' \| 'square' \| 'diamond' \| 'sphere' \| 'cube' \| 'ring'` | `'sphere'` | 点的几何形状，映射见下表 |
| `pointStyle.size` | `number` | `0.14` | 点尺寸（世界单位）。球体用半径，方块用边长因子 |
| `pointStyle.sizeRange` | `[number, number]` | — | 设置后按数据值线性映射半径到 `[min, max]`。**优先级高于 `sizeByValue`** |
| `symbolSize` | `number` | `0.14` | 备用尺寸字段，`pointStyle.size` 存在时被覆盖 |
| `sizeByValue` | `boolean` | `false` | 按值映射尺寸，映射到 `[size × 0.5, size × 1.8]` |

### symbol 到几何体的实际映射

| `symbol` 值 | Three.js 几何体 | 尺寸算法（`size` = s） |
|---|---|---|
| `'sphere'`（默认）/ `'circle'` | `SphereGeometry`（20 段） | 半径 = `s` |
| `'square'` / `'cube'` | `BoxGeometry` | 边长 = `s × 1.7` |
| `'diamond'` | `OctahedronGeometry` | 半径 = `s × 1.35` |
| `'ring'` | `TorusGeometry` | 环半径 = `s × 1.2`，管半径 = `s × 0.35` |

::: tip sizeRange 与 sizeByValue 的差别
两者都按 Y 值归一化后插值，但区间不同：

- `sizeRange: [0.08, 0.32]` —— 你**完全指定**最小值和最大值，映射是 `lerp(0.08, 0.32, t)`。
- `sizeByValue: true` —— 区间是固定的 `[size × 0.5, size × 1.8]`，只有想快速看个大概时才用。

做气泡效果（半径编码第三个维度）时用 `sizeRange`，并显式给出有意义的上下限。
:::

::: warning sizeRange 的归一化基准是 Y 值，不是 Z 值
映射用的 `t` 来自 `extractValue(item)` 中的 **Y 分量**（`v[1] ?? v[0]`），不是 Z。想用 Z 编码半径，需要把要编码的维度放到数据第 2 位，或用自定义图表自行控制。
:::
---

## 数据格式

`Scatter3DSeries['data']` 支持三种写法，实现里按数组长度分派：

```ts
series: [
  {
    type: 'scatter3D',

    // 写法 1：number —— 只有高度，x 按下标递增，z = 0（或多系列时的自动错开值）
    // data: [12, 35, 58, 76],

    // 写法 2：[x, y] —— 二维。x 轴是 value 时按数值映射，是 category 时按索引取类目
    // data: [[0, 12], [1, 35], [2, 58]],

    // 写法 3：[x, y, z] —— 完整三维直角坐标（推荐）
    data: [[12, 68, 42], [35, 51, 66], [58, 43, 28]],

    // 写法 4：对象数组，可带名字与单项样式
    // data: [{ value: [12, 68, 42], name: '样本 A', itemStyle: { color: '#f43f5e' } }],
  },
]
```

三种写法的实际坐标解析逻辑：

| 数组长度 | X | Y | Z |
|---|---|---|---|
| `>= 3` | `xAt(arr[0])` 或类目索引 | `arr[1]` | `zAt(arr[2])` |
| `== 2` | `xAt(arr[0])` 或类目索引 | `arr[1]` | 多系列时自动错开，否则 `0` |
| `== 1`（直接给 number） | `xAtCategory(下标)` | `arr[0]` | 同上 |

类目轴下的 X 会被 `clamp(Math.round(x), 0, 类目数 - 1)`，超出范围的索引不会报错，只会被夹到边界——这也是为什么做真正的三维散点必须用 `type: 'value'`。

---

## 完整示例

两组样本 + 半径编码 + 不同形状 + 透明叠加：

```ts
const option: Vis3xOption = {
  title: { show: true, text: '用户分群分布', subtext: '半径 = 活跃天数' },
  xAxis3D: { type: 'value', min: 0, max: 100, name: '响应时间(ms)' },
  yAxis3D: { min: 0, max: 100, name: '转化率(%)' },
  zAxis3D: { type: 'value', min: 0, max: 100, name: '客单价指数' },
  legend: { show: true, position: 'bottom' },
  tooltip: { show: true, trigger: 'item' },
  gridFloor: { show: true, showWall: true, wallOpacity: 0.1 },
  series: [
    {
      type: 'scatter3D',
      name: '高价值用户',
      data: [[12, 82, 74], [18, 76, 68], [24, 88, 81], [9, 71, 79], [30, 79, 72]],
      pointStyle: {
        symbol: 'sphere',
        sizeRange: [0.1, 0.34],       // 半径按 Y 值线性映射到这个区间
        color: '#4f8cff', roughness: 0.2, metalness: 0.35,
        emissive: '#4f8cff',
        emissiveIntensity: 0.35,      // 自发光，让点在暗背景下"发亮"
      },
    },
    {
      type: 'scatter3D',
      name: '流失风险用户',
      data: [[68, 22, 31], [82, 15, 24], [74, 28, 19], [91, 11, 35], [63, 33, 27]],
      pointStyle: {
        symbol: 'diamond',            // 八面体，形状本身也是一层编码
        sizeRange: [0.1, 0.3],
        color: '#fb7185',
        opacity: 0.85,                // 半透明，重叠时能看出密度
        roughness: 0.3, metalness: 0.2,
        emissive: '#fb7185', emissiveIntensity: 0.3,
      },
    },
  ],
}
```

关键配置说明：

- **`type: 'value'` 在 X 和 Z 轴上都要写**，否则坐标会被当成类目索引处理。
- **`sizeRange` 的上下限差 3 倍左右比较合适**（如 `[0.1, 0.34]`）。差 10 倍时大球会互相吞掉，差 1.5 倍时肉眼几乎分辨不出大小差异。
- **`opacity: 0.85` 不用再给 `transparent`**：材质在 `opacity < 1` 时会自动带上 `transparent: true`。
- **`gridFloor.showWall`** 打开背景墙，给三维散点提供空间参照——没有墙和地面网格时，纯散点很难判断深度。

---

## 使用建议

1. **每个点就是一个 Mesh，控制在 3000 点以内。** 散点没有做实例化合并，3000 个点就是 3000 次绘制调用。上万点的场景应改用 `heatmap3D` 做密度表达，或用 `defineChart` 自己写 `InstancedMesh`。

2. **符号的分段数直接影响顶点量。** 默认球体是 20 段（纬向 10 段），单个球约 400 个顶点。降到 `symbol: 'diamond'`（八面体，8 个面）可以便宜一个数量级，中小尺寸下视觉几乎没差别。

3. **不给 `type: 'value'` 是最常见的错误。** 症状是：明明给了 `[12, 68, 42]`，点却全部挤在类目网格上。原因是 `xAxis3D` 没有 `data` 时会从数据推断类目，`arr[0]` 被当作索引向下取整。三维散点的三根轴都应显式声明为数值轴并给出 `min` / `max`。

4. **不要同时用颜色和尺寸编码同一个维度。** 如果 Y 值既决定高度又决定半径（`sizeRange` 的默认行为），再加一层颜色映射就是三重冗余，读者会误以为有三个独立维度。选一个作为主编码，其余维度用形状或颜色区分**类别**而不是数值。
