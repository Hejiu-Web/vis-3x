# 仪表盘 · gauge3D

仪表盘用一个指针在刻度环上的位置表达**单个数值在量程中的位置**。它是少见的「只画一个数」的图表——适合放在看板顶部展示核心 KPI：CPU 使用率、完成进度、健康分、满意度。

3D 带来的收益在这里比较具体：环带、指针、刻度都是立体的，斜视角下能看清层叠关系；同时因为所有元素都被压在同一平面上挤出，正视角下它又是一个规整的、和 2D 仪表盘一样好读的部件。适合做数据大屏的中心元件。

## 最简示例

<LiveChart
  type="gauge3D"
  :height="400"
  caption="单值仪表盘：只读取 data[0]，指针、进度弧与中心数值由同一次动画驱动。"
  :option="{
    showCoordinate: false,
    series: [
      {
        type: 'gauge3D',
        name: '完成率',
        data: [72],
        min: 0,
        max: 100,
        startAngle: 225,
        endAngle: -45,
        radius: 3.4,
        axisWidth: 0.55,
        depth: 0.5,
        splitNumber: 5,
        detail: { show: true, formatter: '{value}%' },
      },
    ],
  }"
/>

::: code-group

```ts [TypeScript]
import type { Vis3xOption } from 'vis-3x'

const option: Vis3xOption = {
  series: [
    {
      type: 'gauge3D',
      name: '完成率',
      data: [72],
      min: 0,
      max: 100,
      startAngle: 225,
      endAngle: -45,
      radius: 3.4,
      axisWidth: 0.55,
      depth: 0.5,
      splitNumber: 5,
      detail: { show: true, formatter: '{value}%' },
    },
  ],
}
```

```js [JavaScript]
// 纯 JavaScript：去掉类型标注即可
const option = {
  series: [
    {
      type: 'gauge3D',
      name: '完成率',
      data: [72],
      min: 0,
      max: 100,
      startAngle: 225,
      endAngle: -45,
      radius: 3.4,
      axisWidth: 0.55,
      depth: 0.5,
      splitNumber: 5,
      detail: { show: true, formatter: '{value}%' },
    },
  ],
}
```

:::

```vue
<template>
  <div style="height: 420px">
    <VisChart :option="option" />
  </div>
</template>
```

## 坐标约定：一切都在 XY 平面，沿 Z 挤出

这一点值得单独说明，因为它决定了仪表盘的**可读视角**：

- **环带**：在 XY 平面用 `(cos θ · r, sin θ · r)` 画扇环，沿 **+Z** 挤出到 `z ∈ [0, depth]`
- **进度弧**：同样在 XY 平面，但厚度取 `depth * 1.08`，略微凸出于外壳形成层次
- **刻度线**：在 XY 平面，`z = depth + 0.012`，贴在环带前表面，避免 z-fighting
- **指针**：形状画在 XY 平面（从原点指向 +X），绕 **Z 轴**旋转定位；几何体沿 Z 挤出后平移到环带表面
- **中心轴帽**：一个沿 Z 轴的小圆柱，压在指针根部
- **标签与中心数值**：`(cos θ · r, sin θ · r, depth)`，与环带同平面

整个分组还会整体后移 `depth / 2`，让表盘厚度以原点为中心，相机聚焦原点时不会偏到一侧。

::: tip 这意味着什么
从 **+Z 方向正视**（相机朝 XY 平面看）时，仪表盘是平齐、规整的，指针不会飘在环外。旋转视角后所有元素一起呈现立体厚度，不会互相错位。

但**不要把它转到接近侧视**——一旦视线与 XY 平面接近平行，环带会被压成一条线。推荐把俯角限制在中等范围（比如 `minPolarAngle: 0.6`、`maxPolarAngle: 1.4`）。
:::

## 专属配置项

| 字段 | 类型 | 默认值 | 说明 |
| --- | --- | --- | --- |
| `min` | `number` | `0` | 量程下限 |
| `max` | `number` | `100` | 量程上限 |
| `startAngle` | `number` | `225` | 起始角度（度）。225 即左下方向 |
| `endAngle` | `number` | `-45` | 结束角度（度）。默认 225 → -45，顺时针扫过 270°，即经典的开口气缸造型 |
| `radius` | `number` | `3.4` | 环带中心线半径。环带内缘 = `radius - axisWidth / 2`，外缘 = `radius + axisWidth / 2` |
| `axisWidth` | `number` | `0.55` | 环带宽度 |
| `depth` | `number` | `0.5` | 整体厚度（挤出高度） |
| `splitNumber` | `number` | `5` | 分割段数。刻度线与刻度数值各绘制 `splitNumber + 1` 个 |
| `progressStyle` | `ItemStyle` | `{ opacity: 1, emissiveIntensity: 0.3 }` | 进度弧样式。默认色取系列色，并带自发光 |
| `axisTick` | `object` | `{ show: true, length: 0.22, color: '#94a3b8' }` | 刻度线：`{ show?, length?, color? }` |
| `axisLabel` | `object` | `{ show: true, fontSize: 11, color: '#94a3b8', precision: 0 }` | 刻度数值：`{ show?, fontSize?, color?, precision? }` |
| `pointer` | `object` | `{ length: radius * 0.72, width: 0.14, color: '#f8fafc' }` | 指针：`{ show?, length?, width?, color? }` |
| `detail` | `object` | `{ fontSize: 30, color: '#f1f5f9' }` | 中心数值，见下表 |

`detail` 子字段：

| 字段 | 类型 | 默认值 | 说明 |
| --- | --- | --- | --- |
| `detail.show` | `boolean` | `true` | `show !== false` 即显示 |
| `detail.formatter` | `string \| (value: number) => string` | `formatNumber(v, { precision: 0 })` | 字符串模板里的 `{value}` 会被替换为格式化后的数值；传函数则完全接管 |
| `detail.fontSize` | `number` | `30` | 字号 |
| `detail.color` | `string` | `'#f1f5f9'` | 颜色 |
| `detail.offsetY` | `number` | — | 预留的纵向偏移字段，当前实现中数值锚点位置由 `radius * 0.42` 决定 |

::: details 进度弧与刻度的位置细节
- **进度弧**：`t = clamp((value - min) / (max - min), 0, 1)`，终止角为 `startAngle - |startAngle - endAngle| * t`。当扫过角小于 `0.5°` 时**不绘制**该弧。
- **刻度线**：从 `radius + axisWidth / 2 + 0.08` 起，向外延伸 `axisTick.length`。
- **刻度数值**：半径取 `刻度外端 + 0.52`，值按 `min + (max - min) * t` 等分——注意这里是**等分角度**，不是按数据等分。
- **指针旋转**：`pointer.rotation.z = degToRad(startAngle - totalSpan * t)`，与环带扫过方向严格一致。
:::

## 数据格式

`data` 是数组，但**只读取第一项**：

```ts
series: [
  {
    type: 'gauge3D',

    // 写法 1：直接给数字
    data: [72],

    // 写法 2：对象（name 只影响图例与 tooltip 文案）
    // data: [{ value: 72, name: '完成率' }],
  },
]
```

::: warning 一个系列就是一个表盘
`extractScalar(series.data[0])` —— 只有 `data[0]` 会被读取，其余数据项被忽略。

要画多个表盘，请写**多个 `gauge3D` 系列**（每个系列一个表盘，共享同一套分组，但当前实现下会重叠在同一位置，通常应拆成多个图表实例并排摆放）。
:::

数值超出 `[min, max]` 时会被 `clamp` 到边界：指针停在端点，进度弧画满或为空，但**中心数值仍显示原始值**。

## 完整示例

带自定义量程、刻度精度、进度色与格式化函数：

```ts
import type { Vis3xOption } from 'vis-3x'

const option: Vis3xOption = {
  title: { show: true, text: '服务器负载' },
  series: [
    {
      type: 'gauge3D',
      name: 'CPU',
      data: [{ value: 76.4, name: 'CPU 使用率' }],
      min: 0,
      max: 120,
      startAngle: 210,
      endAngle: -30,
      radius: 3.6,
      axisWidth: 0.6,
      depth: 0.62,
      splitNumber: 6,
      color: ['#38bdf8'],
      progressStyle: {
        color: '#f97316',
        emissive: '#f97316',
        emissiveIntensity: 0.45,
        roughness: 0.2,
        metalness: 0.5,
      },
      axisTick: { show: true, length: 0.24, color: '#94a3b8' },
      axisLabel: { show: true, fontSize: 12, color: '#cbd5e1', precision: 0 },
      pointer: { show: true, length: 2.6, width: 0.16, color: '#f8fafc' },
      detail: {
        show: true,
        formatter: (v) => `${v.toFixed(1)}%`,
        fontSize: 34,
        color: '#f8fafc',
      },
      itemStyle: { color: '#1e293b', opacity: 0.6, preset: 'standard' },
      animation: { enabled: true, duration: 1200, easing: 'cubicOut' },
    },
  ],
}
```

字符串模板写法同样可用：

```ts
detail: { show: true, formatter: '{value} 分' }
// 若需控制小数位，用 axisLabel.precision 或直接传函数
detail: { show: true, formatter: (v) => `${v.toFixed(1)} 分` }
```

::: tip 动画会同时驱动三个部件
从 `min` 起步增长到目标值的过程中，**进度弧、指针、中心数值由同一次动画统一驱动**，所以三者永远同步，不会出现「针到了但数字没到」。设置 `animation.enabled: false` 则直接落到目标值。
:::

## 使用建议

- **`startAngle` / `endAngle` 决定造型**。默认 `225 → -45` 是 270° 的开口气缸，最通用；想要一个闭合的圆环用 `360 → 0`（注意首尾会重叠，`axisTick` 端点也会叠在一起）；想要半圆表盘用 `180 → 0` 并适当放大 `radius`。
- **`splitNumber` 取 4~8**。它同时决定刻度线和刻度数值的数量（各 `splitNumber + 1` 个）。超过 10 时数值会绕成一圈、互相挤压。
- **仪表盘只表达「一个数」**。多个指标请并排放多个图表实例，而不是堆在同一个表盘里；同时展示 3 个以上表盘时，把 `detail.fontSize` 统一调小到 `22~26`，视觉上更整齐。
- **`itemStyle.opacity` 控制外壳环带**，`progressStyle.opacity` 控制进度弧。外壳调到 `0.4~0.6` 能让进度弧更突出。
- **数值超出量程时不会报警**。指针只会停在端点，中心数值照常显示真实值——如果你需要「超限变红」，得在传入前自己判断并切换 `progressStyle.color`。
