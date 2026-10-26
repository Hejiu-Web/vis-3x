# 阶梯地形图 · stepTerrain3D

阶梯地形图把**二维矩阵**画成一片高低起伏的立方体阵列，像把高度场做成了乐高模型。它适合表达**离散的二维网格数据**：城市各区块的热度、传感器阵列读数、棋盘式的产能分布、游戏地图的地形高度。

它和曲面图（`surface3D`）解决的是同一类问题，气质完全不同：曲面图是连续平滑的山峦，阶梯地形图是**一格一格的方块**，每个格子边界清晰、可单独拾取。数据本身就是离散网格、或者需要看清「每一格」时，用这张图。

`stepTerrain3D` 是**扩展示例图表**，需要先注册。

## 最简示例

<LiveChart
  type="stepTerrain3D"
  :height="440"
  caption="10 × 10 的高度场，用 sin/cos 生成的双峰地形。颜色与高度共用同一个映射值，所以越高越暖。"
  :option="{
    type: 'stepTerrain3D',
    xAxis3D: { show: false },
    zAxis3D: { show: false },
    yAxis3D: { name: '高程' },
    series: [
      {
        type: 'stepTerrain3D',
        name: '高度场',
        data: [
          [48, 75.8, 79, 63.6, 51.1, 44.9, 32.4, 17, 20.2, 48],
          [44, 67.6, 68.5, 53.9, 44.9, 43.1, 34.1, 19.5, 20.4, 44],
          [36, 49, 44.2, 31.6, 31.2, 40.8, 40.4, 27.8, 23, 36],
          [32, 32.8, 21.6, 11.2, 20.8, 43.2, 52.8, 42.4, 31.2, 32],
          [36, 28.9, 13.5, 4.6, 20.6, 51.4, 67.4, 58.5, 43.1, 36],
          [44, 36.9, 21.5, 12.6, 28.6, 59.4, 75.4, 66.5, 51.1, 44],
          [48, 48.8, 37.6, 27.2, 36.8, 59.2, 68.8, 58.4, 47.2, 48],
          [44, 57, 52.2, 39.6, 39.2, 48.8, 48.4, 35.8, 31, 44],
          [36, 59.6, 60.5, 45.9, 36.9, 35.1, 26.1, 11.5, 12.4, 36],
          [32, 59.8, 63, 47.6, 35.1, 28.9, 16.4, 1, 4.2, 32],
        ],
      },
    ],
  }"
/>

::: code-group

```ts [TypeScript]
import { useExtraCharts } from 'vis-3x/presets'
import type { Vis3xOption } from 'vis-3x'

useExtraCharts(['stepTerrain3D'])

const option: Vis3xOption = {
  type: 'stepTerrain3D',
  xAxis3D: { name: '列' },
  zAxis3D: { name: '行' },
  series: [
    {
      type: 'stepTerrain3D',
      name: '高度场',
      // data 是二维矩阵：行 × 列
      data: [
        [1, 3, 5, 4, 2],
        [2, 6, 9, 7, 3],
        [4, 8, 12, 9, 5],
        [3, 6, 8, 6, 4],
      ],
    },
  ],
}
```

```js [JavaScript]
// 纯 JavaScript：去掉类型标注即可
import { useExtraCharts } from 'vis-3x/presets'

useExtraCharts(['stepTerrain3D'])

const option = {
  type: 'stepTerrain3D',
  xAxis3D: { name: '列' },
  zAxis3D: { name: '行' },
  series: [
    {
      type: 'stepTerrain3D',
      name: '高度场',
      // data 是二维矩阵：行 × 列
      data: [
        [1, 3, 5, 4, 2],
        [2, 6, 9, 7, 3],
        [4, 8, 12, 9, 5],
        [3, 6, 8, 6, 4],
      ],
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

| 字段 | 类型 | 默认值 | 说明 |
| --- | --- | --- | --- |
| `data` | `number[][]` | — | **二维矩阵**，行 × 列，见下节 |
| `colorGradient` | `string[]` | 见下 | **自定义色带**，覆盖默认的 7 色带 |
| `name` | `string` | — | 系列名，进入 tooltip |

以下参数是**硬编码、不可配置**的：

| 参数 | 源码中的取值 | 位置 |
| --- | --- | --- |
| 立方体宽度系数 | `stepX * 0.92` | `ctx.geometry.box(...)` |
| 立方体深度系数 | `stepZ * 0.92` | 同上 |
| 高度上限 | `gridHeight * 0.75` | `const maxHeight = ...` |
| 高度下限（映射起点） | `0.12` | `lerp(0.12, maxHeight, t)` |
| 绝对最矮高度 | `0.05` | `Math.max(..., 0.05)` |
| 材质 | `roughness 0.4 / metalness 0.16` | `ctx.material(color, {...})` |
| 自发光 | `emissiveIntensity: 0.08 + t * 0.18` | 越高的格子越亮 |
| 拾取名 | `R${r+1}C${c+1}` | 如 `R2C3` |

::: details 立方体尺寸与间距系数
```ts
const { gridWidth, gridDepth } = ctx.coord.grid
const stepX = gridWidth / cols            // 每列占的 X 宽度
const stepZ = gridDepth / rows            // 每行占的 Z 深度

const cube = new THREE.Mesh(
  ctx.geometry.box(stepX * 0.92, height, stepZ * 0.92),
  ...
)
```

**`0.92` 是间距系数**：格子的实际尺寸是它所在「格位」的 92%，剩下 8% 成为格子之间的缝隙。这个缝隙是必要的——方块紧贴时相邻面会 Z-fighting（深度冲突闪烁），而且没有缝隙就看不出「一格一格」的结构，会糊成一整块。

格子总数是 `rows × cols`。**这个图表没有总数上限，但每个格子都是一个独立的 `BoxGeometry` + 独立材质**，所以 `rows × cols` 超过几百块时初始化会明显变慢。20×20 = 400 块是可以接受的量级；50×50 = 2500 块请谨慎。
:::

::: details 行/列与坐标轴的对应关系
```ts
const x = -gridWidth / 2 + stepX * (c + 0.5)
const z = gridDepth / 2 - stepZ * (r + 0.5)
```

| 维度 | 对应轴 | 方向 |
| --- | --- | --- |
| 列 `c`（`matrix[r][c]` 的内层下标） | **X 轴** | 从左（`-gridWidth/2`）到右 |
| 行 `r`（外层下标） | **Z 轴** | 从后（`+gridDepth/2`）到前 |

两个轴的 `+ 0.5` 都是把格子推到**格位中心**，而不是格位左上角。Z 轴用了**减法**，因为 `z = gridDepth / 2` 是后排、`z = -gridDepth / 2` 是前排，所以要倒过来算。

**矩阵的第 0 行显示在最后排（远处）**，第 0 列显示在最左侧。如果发现地形与预期左右/前后镜像，先检查矩阵的行列顺序——这是最容易搞错的地方。
:::

::: details 高度映射：从一个数到一个立方体
```ts
const flat = matrix.flat().filter((v) => Number.isFinite(v))
const min = Math.min(...flat)
const max = Math.max(...flat)
const span = max - min || 1

const t = clamp((value - min) / span, 0, 1)
const height = Math.max(lerp(0.12, maxHeight, t), 0.05)
```

三步：

1. **`t` 是全局归一化位置**。用的是**整个矩阵的最小/最大值**，不是每行每列各自的。所以同一高度在不同图表里可比——前提是两图的数据范围一致。
2. **`lerp(0.12, maxHeight, t)`** 把 `t ∈ [0, 1]` 映射到 `[0.12, maxHeight]`。**下限是 `0.12` 而不是 0**：数值最小的格子也有一块可见的薄片，不会像「没有数据」一样消失。`maxHeight = gridHeight * 0.75`，即最高的格子占网格高度的 75%，留出 25% 的顶部空间，柱子不会顶到相机。
3. **`Math.max(..., 0.05)`** 是兜底：如果 `gridHeight` 配得极小（比如 `0.05`），`0.12` 和 `maxHeight` 可能双双低于 `0.05`，这一层保证格子永远不是零高度——零高度的 Box 会产生退化法线，渲染时会出黑块。

注意 `span = max - min || 1`：当所有值相等时（`span = 0`），用 `1` 兜底避免除零，此时所有格子都会得到 `t = 0`，全部绘制成最矮的薄片。
:::

## 颜色映射：`gradientColorAt` 与 `colorGradient`

颜色和高度**共用同一个 `t`**，所以色带与高度严格同步——最高的格子一定是色带末端（默认是红色）。

```ts
const gradient =
  series?.colorGradient ??
  ['#1e3a8a', '#0ea5e9', '#22d3ee', '#34d399', '#fde047', '#fb923c', '#ef4444']

const color = gradientColorAt(gradient, t)
```

默认色带就是 `DEFAULT_GRADIENT`（深蓝 → 天蓝 → 青 → 绿 → 黄 → 橙 → 红），七色等距分布。`gradientColorAt` 会在相邻两色之间做**线性插值**，所以实际输出是连续渐变，不是七个色块：

```ts
const scaled = clamped * (gradient.length - 1)   // 七色带 → [0, 6]
const i = Math.floor(scaled)
const f = scaled - i
c1.lerp(c2, f)                                    // 在第 i 与 i+1 色之间插值
```

用 `colorGradient` 覆盖默认色带：

```ts
series: [
  {
    type: 'stepTerrain3D',
    name: '温度场',
    data: [...],
    // 单色系：低处深、高处浅，适合表现"强度"而非"分类"
    colorGradient: ['#0c4a6e', '#0369a1', '#0ea5e9', '#7dd3fc', '#e0f2fe'],
  },
]
```

::: tip 换色带的实用技巧
- **单色系**（如深蓝 → 浅蓝）适合表达「同一指标的量级」，视觉上更克制，适合正式报表。
- **彩虹色带**（默认）对比强烈、层次分明，适合探索性分析，但要注意红绿色盲的可读性——把中间的绿换成青或紫更稳妥。
- **色带只有 1 个颜色**时，`gradientColorAt` 直接返回该色，所有格子同色，此时地形完全靠高度表达信息。
- 想调**对比度**就改色带两端：把首色压得更暗，落差感立刻增强。
:::

## 数据格式

`data` 是**二维数字矩阵** `number[][]`：外层数组是行，内层数组是列。

```ts
series: [
  {
    type: 'stepTerrain3D',
    name: '高度场',
    data: [
      //  列0  列1  列2  列3  列4
      [   1,   3,   5,   4,   2 ],   // 行 0 → Z 轴最后排
      [   2,   6,   9,   7,   3 ],   // 行 1
      [   4,   8,  12,   9,   5 ],   // 行 2
      [   3,   6,   8,   6,   4 ],   // 行 3 → Z 轴最前排
    ],
    //    ↑ 列 0 在 X 轴最左侧
  },
]
```

::: warning 第一行决定列数，行长不一致会被忽略
```ts
const rows = matrix.length
const cols = matrix[0].length
```

`cols` 只取**第一行**的长度。如果后面的行更长，多出来的列**永远不会被访问**（循环条件是 `c < cols`）；如果某行更短，`matrix[r][c]` 会得到 `undefined`，`Number.isFinite(undefined)` 为假，那一格被跳过——**地面上会留下一个空洞**。请保证矩阵是规整的矩形。
:::

::: warning 非有限值会留出空洞
`if (!Number.isFinite(value)) continue` —— `NaN`、`Infinity`、`undefined` 对应的格子**完全不绘制**，那个位置就是空的，能直接看到网格底面。这其实是个有用的特性：用 `NaN` 可以在非规则形状的地形上「挖洞」，比如只保留城市边界内的区块。
:::

::: tip `data` 不能是扁平数组
矩阵必须是二维的。此外空矩阵有前置检查：

```ts
const matrix = series?.data
if (!matrix?.length || !matrix[0]?.length) return
```

`[]` 或 `[[]]` 会让整个渲染函数直接返回（什么都不画，也不报错）。

::: warning 只有 `series[0]` 会被渲染
渲染函数里取的是 `ctx.series[0]`，**传入第二个及之后的 `stepTerrain3D` 系列不会有输出**。
多组地形需要并排放多个图表实例。
:::

## 完整示例

城市区块热力地形，自定义单色色带 + 用 `NaN` 挖出非规则边界 + 逐格生长的动画：

```ts
import { useExtraCharts } from 'vis-3x/presets'
import type { Vis3xOption } from 'vis-3x'

useExtraCharts(['stepTerrain3D'])

// 6×8 的街区热度矩阵；NaN 表示"此处无街区"，会留出空洞
const heat: number[][] = [
  [2, 5, 9, 14, 11, 7, 4, 1],
  [4, NaN, 12, 21, 18, 10, 6, 3],
  [7, 11, 19, 32, 27, 15, 9, 5],
  [5, 9, 16, 26, 22, 13, NaN, 4],
  [3, 6, 10, 15, 12, 8, 5, 2],
  [1, 3, 5, 7, 6, 4, 2, 1],
]

const option: Vis3xOption = {
  type: 'stepTerrain3D',
  title: { show: true, text: '街区人流热力', subtext: '高度与颜色同步映射人流量' },
  xAxis3D: { name: '列（东 → 西）' },
  zAxis3D: { name: '行（北 → 南）' },
  tooltip: { show: true, trigger: 'item' },
  gridFloor: { show: true, divisions: 12, showWall: false },
  series: [
    {
      type: 'stepTerrain3D',
      name: '人流量',
      data: heat,
      // 单色系色带：低处深海蓝，高处亮青白
      colorGradient: ['#0c4a6e', '#0369a1', '#0ea5e9', '#38bdf8', '#bae6fd'],
    },
  ],
  animation: { enabled: true, duration: 900, easing: 'cubicOut', stagger: 18 },
  controlSettings: {
    cameraDirection: { x: 1, y: 1.1, z: 1 },
    minPolarAngle: 0.4,
    maxPolarAngle: Math.PI / 2.15,
    fitToScreenFactor: 0.82,
  },
  lights: [
    { type: 'ambient', intensity: 0.55 },
    { type: 'directional', position: [1, 1.7, 1.2], intensity: 1.6, shadow: true },
  ],
}
```

格子按 `r * cols + c` 的顺序依次升起，`stagger: 18` 让整片地形像多米诺骨牌一样从左上角逐渐「长」出来。想要整齐的齐步生长就把 `stagger` 设为 `0`。

## 使用建议

- **`rows × cols` 控制在 400 以内**。每格是独立的 `BoxGeometry` 与材质实例，400 块（20×20）初始化流畅、视觉密度也刚好；超过 1000 块请考虑 `surface3D`，或改源码用 `InstancedMesh` 重写。
- **高度上限是 `gridHeight * 0.75`，靠 `gridHeight` 调**。这个图表的几何尺寸不可配，但 `gridHeight`（网格高度）是**唯一能间接影响地形起伏的旋钮**。地形太平就调大 `gridHeight`，太尖就调小——不过记住 `xAxis3D` / `zAxis3D` 的配置对它没有影响。
- **用 `NaN` 挖洞比用 `0` 更准确**。`0` 会画出一块最矮的薄片（占位），`NaN` 则完全留空。表达「这里没有数据 / 不属于该区域」时用 `NaN`，表达「这里测得 0」时才用 `0`。
- **色带与高度是绑死的，别指望用颜色表达第二个维度**。`t` 同时驱动高度和颜色，你能调的只有色带本身。真要表达第二个变量，应该拆成两个图表或改用 `surface3D` 配合额外的着色逻辑。
- **矩阵务必规整且顺序正确**。第 0 行是 Z 轴最后排、第 0 列是 X 轴最左侧；行长不一致会在图上留下意外的空洞。传数据前先 `console.log` 一下 `matrix.map(r => r.length)` 确认每行等长。
