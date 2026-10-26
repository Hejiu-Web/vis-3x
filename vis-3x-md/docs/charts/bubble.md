# 气泡图 · bubble3D

气泡图是散点图的三维版本：每个数据点由 `[x, y, z]` 三元组定位在空间中，**球的半径再由 Y 值映射**。于是同一张图能同时表达四个量——三个坐标位置 + 一个尺寸。

3D 气泡比 2D 气泡更需要克制：球会互相遮挡，透明的物理材质在叠加时也会迅速变浑。**控制点数（20~80 个）并把俯角调高一点**，是让气泡图可读的两个关键动作。

`bubble3D` 是**扩展示例图表**，需要先注册。

## 最简示例

<LiveChart
  type="bubble3D"
  :height="400"
  caption="五个 [x, y, z] 三元组气泡：位置由三元组决定，球半径再由 Y 值在 Y 轴值域中的位置映射。"
  :option="{
    showCoordinate: false,
    type: 'bubble3D',
    xAxis3D: { name: '投入' },
    yAxis3D: { name: '产出' },
    zAxis3D: { name: '规模' },
    tooltip: { show: true, trigger: 'item' },
    series: [
      {
        type: 'bubble3D',
        name: '样本',
        data: [
          [10, 30, 5],
          [25, 62, 12],
          [40, 45, 8],
          [55, 78, 20],
          [70, 52, 15],
        ],
      },
    ],
  }"
/>

::: code-group

```ts [TypeScript]
import { useExtraCharts } from 'vis-3x/presets'
import type { Vis3xOption } from 'vis-3x'

useExtraCharts(['bubble3D'])

const option: Vis3xOption = {
  type: 'bubble3D',
  xAxis3D: { name: '投入' },
  yAxis3D: { name: '产出' },
  zAxis3D: { name: '规模' },
  tooltip: { show: true, trigger: 'item' },
  series: [
    {
      type: 'bubble3D',
      name: '样本',
      data: [
        [10, 30, 5],
        [25, 62, 12],
        [40, 45, 8],
        [55, 78, 20],
        [70, 52, 15],
      ],
    },
  ],
}
```

```js [JavaScript]
// 纯 JavaScript：去掉类型标注即可
import { useExtraCharts } from 'vis-3x/presets'

useExtraCharts(['bubble3D'])

const option = {
  type: 'bubble3D',
  xAxis3D: { name: '投入' },
  yAxis3D: { name: '产出' },
  zAxis3D: { name: '规模' },
  tooltip: { show: true, trigger: 'item' },
  series: [
    {
      type: 'bubble3D',
      name: '样本',
      data: [
        [10, 30, 5],
        [25, 62, 12],
        [40, 45, 8],
        [55, 78, 20],
        [70, 52, 15],
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
| `data` | `Array<number[] \| number \| { value }>` | — | 三元组数组，见下节 |
| `color` | `string[]` | `theme.palette` | 系列调色板，按 `index % colors.length` 逐项取色 |
| `pointStyle.sizeRange` | `[number, number]` | `[0.14, 0.5]` | 半径映射范围（世界单位）。**这是本图表唯一真正生效的样式字段** |

::: warning 和其他图表不同：气泡的样式是写死的
`bubble3D` 使用 `preset: 'physical'` 的玻璃质感材质，参数**硬编码在源码里**：

```ts
ctx.material(color, {
  preset: 'physical',
  roughness: 0.12,
  metalness: 0.1,
  transmission: 0.35,     // 玻璃感
  thickness: radius,      // 折射厚度跟随半径
  ior: 1.4,
  opacity: 0.88,
  transparent: true,
  emissive: color,
  emissiveIntensity: 0.18,
})
```

所以 `itemStyle` / `pointStyle.color` 这类字段对它**没有效果**，能调的只有颜色（走系列的 `color`）和尺寸映射（走 `pointStyle.sizeRange`）。

这个材质开销不小——`transmission` 会触发透射渲染。**点数超过 200 时建议换回 `scatter3D` 或改源码把 `preset` 换成 `standard`。**
:::

::: details 半径是怎么算出来的

```ts
const [min, max] = ctx.coord.yDomain            // Y 轴的当前值域
const t = clamp((yv - min) / (max - min || 1), 0, 1)
const radius = lerp(sizeRange[0], sizeRange[1], t)
```

**半径由 Y 值决定，而且映射基准是 Y 轴的完整值域**，不是数据自身的最小/最大值。这意味着：

- 改了 `yAxis3D.min` / `max`，气泡大小会跟着变；
- 如果不显式设置 Y 轴范围，库会自动推导，此时最小的气泡对应 `sizeRange[0]`、最大的对应 `sizeRange[1]`。

注意 `thickness: radius` 会让球的折射厚度随半径变化，这是玻璃质感能成立的关键细节。
:::

## 数据格式

每个数据项是一个 **`[x, y, z]` 三元组**：

```ts
series: [
  {
    type: 'bubble3D',
    data: [
      [10, 30, 5],    // x = 10, y = 30, z = 5；球半径由 y = 30 映射
      [25, 62, 12],
      [40, 45, 8],
    ],
  },
]
```

解析逻辑：

```ts
const raw = extractValue(item)
const tuple = Array.isArray(raw) ? raw : [index, raw, 0]
const [xv, yv, zv = 0] = tuple
```

也就是说：

| 你传的写法 | 实际含义 |
| --- | --- |
| `[10, 30, 5]` | x = 10，y = 30，z = 5 |
| `[10, 30]` | x = 10，y = 30，**z = 0** |
| `30`（纯数字） | x = 当前下标，y = 30，z = 0 |
| `{ value: [10, 30, 5], name: '样本 A' }` | 同上，另带名字 |

::: warning 坐标轴类型要和数据匹配
`ctx.coord.xAt(xv)`、`zAt(zv)` 会按轴的类型解释这个值：

- 轴配置里**有 `data`** → 类目轴，`xv` 应当传**类目下标**（0、1、2…）
- 轴配置里**没有 `data`** → 数值轴，`xv` 直接是数值

混用（比如数值轴上传下标）不会报错，但气泡会挤在靠左的一小块区域。上面的最简示例用的是数值轴，所以直接传了 `10 / 25 / 40`。
:::

::: tip tooltip 里的 value 是整个三元组
`ctx.pickable(bubble, { ..., value: tuple, ... })` —— 拾取载荷里的 `value` 是**数组** `[x, y, z]`，不是单个数字。写 `tooltip.formatter` 时要按数组处理：

```ts
tooltip: {
  show: true,
  formatter: (p) => {
    const [x, y, z] = p.value as number[]
    return `${p.name}<br/>投入 ${x} · 产出 ${y} · 规模 ${z}`
  },
}
```
:::

## 完整示例

类目轴 + 按序配色 + 自定义尺寸映射 + 双系列分组：

```ts
import { useExtraCharts } from 'vis-3x/presets'
import type { Vis3xOption } from 'vis-3x'

useExtraCharts(['bubble3D'])

const option: Vis3xOption = {
  type: 'bubble3D',
  title: { show: true, text: '广告投放效率分布' },
  xAxis3D: { data: ['A 渠道', 'B 渠道', 'C 渠道', 'D 渠道', 'E 渠道'], name: '渠道' },
  yAxis3D: { name: '转化率', min: 0, max: 10 },
  zAxis3D: { name: '窗口编号' },
  tooltip: { show: true, trigger: 'item' },
  legend: { show: true, position: 'bottom' },
  gridFloor: { show: true, divisions: 10, showWall: true, wallOpacity: 0.12 },
  series: [
    {
      type: 'bubble3D',
      name: '上周',
      color: ['#4f8cff', '#22d3ee', '#34d399', '#fbbf24', '#f87171'],
      data: [
        [0, 3.2, 0],
        [1, 6.8, 1],
        [2, 4.5, 2],
        [3, 8.1, 3],
        [4, 5.6, 4],
      ],
      pointStyle: { sizeRange: [0.18, 0.62] },
    },
    {
      type: 'bubble3D',
      name: '本周',
      color: ['#93c5fd', '#67e8f9', '#6ee7b7', '#fcd34d', '#fca5a5'],
      data: [
        [0, 4.1, 0],
        [1, 7.5, 1],
        [2, 5.2, 2],
        [3, 8.9, 3],
        [4, 6.3, 4],
      ],
      pointStyle: { sizeRange: [0.18, 0.62] },
    },
  ],
  controlSettings: {
    cameraDirection: { x: 1, y: 1.3, z: 1 },
    minPolarAngle: 0.4,
    maxPolarAngle: Math.PI / 2.1,
    fitToScreenFactor: 0.85,
  },
}
```

两个系列共 10 个气泡，`yAxis3D` 显式设成 `[0, 10]` 让两组气泡的尺寸映射口径一致——**这是多系列气泡图必须做的事**，否则两组球的大小没法直接比较。

## 使用建议

- **点数控制在 20~80 个**。玻璃材质的透射渲染开销随点数上升明显；超过 200 个请改回 `scatter3D`，或复制源码把 `preset: 'physical'` 降级成 `'standard'`。
- **给 Y 轴显式设 `min` / `max`**。因为尺寸映射基于 `ctx.coord.yDomain`，自动推导的范围会随数据波动，导致「同一个值在不同数据下球不一样大」，跨图表对比就失真了。
- **`sizeRange` 的上下限比建议 1:3 ~ 1:4**。比如 `[0.18, 0.62]`。比值太小球看不出差别，太大则小球会变成看不清的像素点。
- **透明球不要叠太多**。`opacity: 0.88` + `transmission` 让每个球都微微透光，十几个球前后叠加后颜色会糊成一片。数据密度高时把俯角调大（`cameraDirection.y` 提到 1.4 以上），让球在竖直方向拉开。
- **第三个维度（z）留给真正有用的变量**。如果 z 只是「第几个样本」，那它不如直接当类目用；z 应该是像「时间窗口」「设备型号」这样有分析意义的维度。
