# 雷达图 · radar3D

雷达图把 N 个维度均匀铺在一个圆周上，每个样本是一条连接各维度得分点的闭合折线，围出的面积直观反映「综合能力强弱」。它适合**多指标评分对比**：产品能力矩阵、员工绩效、游戏角色属性。

vis-3x 的 `radar3D` 在这个基础上做了分层：多个数据项会沿 Y 轴以 `layerGap` 逐层抬升，形成一叠悬浮的多边形面片。转一下视角，层与层之间的关系一目了然。

维度少于 3 个时雷达图没有意义，此时**直接跳过渲染**。

## 最简示例

<LiveChart
  type="radar3D"
  :height="400"
  caption="五维产品能力雷达：数据面按 indicator 的 max 归一化，拖拽旋转可以看清顶点球与蛛网的关系。"
  :option="{
    showCoordinate: false,
    title: { show: true, text: '产品能力评估' },
    tooltip: { show: true, trigger: 'item' },
    radar: {
      indicator: [
        { name: '性能', max: 100 },
        { name: '易用性', max: 100 },
        { name: '生态', max: 100 },
        { name: '文档', max: 100 },
        { name: '价格', max: 100 },
      ],
      radius: 3.6,
      splitNumber: 4,
      startAngle: 90,
      axisLabel: { show: true },
      splitLine: { show: true },
    },
    series: [
      {
        type: 'radar3D',
        name: '产品 A',
        data: [{ value: [85, 72, 90, 68, 76], name: '产品 A' }],
        areaStyle: { opacity: 0.5 },
        lineStyle: { width: 2 },
      },
    ],
  }"
/>

::: code-group

```ts [TypeScript]
import type { Vis3xOption } from 'vis-3x'

const option: Vis3xOption = {
  title: { show: true, text: '产品能力评估' },
  tooltip: { show: true, trigger: 'item' },
  radar: {
    indicator: [
      { name: '性能', max: 100 },
      { name: '易用性', max: 100 },
      { name: '生态', max: 100 },
      { name: '文档', max: 100 },
      { name: '价格', max: 100 },
    ],
    radius: 3.6,
    splitNumber: 4,
    startAngle: 90,
    axisLabel: { show: true },
    splitLine: { show: true },
  },
  series: [
    {
      type: 'radar3D',
      name: '产品 A',
      data: [{ value: [85, 72, 90, 68, 76], name: '产品 A' }],
      areaStyle: { opacity: 0.5 },
      lineStyle: { width: 2 },
    },
  ],
}
```

```js [JavaScript]
// 纯 JavaScript：去掉类型标注即可
const option = {
  title: { show: true, text: '产品能力评估' },
  tooltip: { show: true, trigger: 'item' },
  radar: {
    indicator: [
      { name: '性能', max: 100 },
      { name: '易用性', max: 100 },
      { name: '生态', max: 100 },
      { name: '文档', max: 100 },
      { name: '价格', max: 100 },
    ],
    radius: 3.6,
    splitNumber: 4,
    startAngle: 90,
    axisLabel: { show: true },
    splitLine: { show: true },
  },
  series: [
    {
      type: 'radar3D',
      name: '产品 A',
      data: [{ value: [85, 72, 90, 68, 76], name: '产品 A' }],
      areaStyle: { opacity: 0.5 },
      lineStyle: { width: 2 },
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

::: warning radar 配置挂在顶层，不在 series 里
坐标系参数（`indicator`、`radius`、`splitNumber`、`startAngle`、蛛网线样式）属于 `option.radar`，是**全局坐标系配置**；`areaStyle`、`lineStyle`、`layerGap`、`showPoint`、`pointStyle` 才属于 `series`。这是最容易写错的地方。
:::

## 专属配置项

### 坐标系：`option.radar`

| 字段 | 类型 | 默认值 | 说明 |
| --- | --- | --- | --- |
| `indicator` | `RadarIndicator[]` | `[]` | 指示器数组，每项 `{ name?, max?, min? }`。不传时按数据的 `value.length` 推断维度数，各维 `max` 取该条数据自身最大值 |
| `radius` | `number` | `3.6` | 蛛网外圈半径（世界单位） |
| `splitNumber` | `number` | `4` | 同心多边形层数（分割段数） |
| `startAngle` | `number` | `90` | 第一个维度的角度（度），90 即 12 点方向，其余维度按顺时针均分 |
| `axisLine` | `AxisLine` | — | 从圆心出发的轴线，`{ show, lineStyle }` |
| `splitLine` | `SplitLine` | — | 同心蛛网线，`{ show, lineStyle }`。最后一层（最外圈）透明度默认 0.7，其余 0.3 |
| `splitArea.show` | `boolean` | `false` | 是否交替填充分割区域 |
| `splitArea.colors` | `ColorLike[]` | `['rgba(255,255,255,0.03)', 'rgba(255,255,255,0.07)']` | 交替色，逐层循环 |
| `splitArea.opacity` | `number` | `1` | 区域透明度，会与颜色自带 alpha 相乘 |
| `axisLabel` | `AxisLabel` | — | 维度名称标签，`show !== false` 即显示 |
| `nameStyle` | `TextStyle` | `{ color: '#cbd5e1', fontSize: 12, fontWeight: 600 }` | 维度名称的文字样式 |

`indicator` 每项：

| 字段 | 类型 | 说明 |
| --- | --- | --- |
| `name` | `string` | 维度名。省略时显示为「维度 N」 |
| `max` | `number` | 该维度上限。省略时取该条数据所有值的最大值 |
| `min` | `number` | 该维度下限，默认 `0` |

### 系列：`Radar3DSeries`

| 字段 | 类型 | 默认值 | 说明 |
| --- | --- | --- | --- |
| `areaStyle` | `AreaStyle` | `{ opacity: 0.5, roughness: 0.4, metalness: 0.15 }` | 数据面片样式 |
| `lineStyle` | `LineStyle` | `{ width: 2, opacity: 1 }` | 外圈描边样式 |
| `layerGap` | `number` | `0` | 层间距。仅在**可见系列数 > 1** 时生效，第 i 层抬升 `i * layerGap` |
| `showPoint` | `boolean` | `true` | 是否在顶点绘制球体数据点（`showPoint !== false` 即显示） |
| `pointStyle` | `PointStyle` | `{ size: 0.09 }` | 顶点样式 |

::: details 归一化是怎么算的
每个顶点的半径按维度的 `min` / `max` 线性归一化：

```ts
t = clamp((value - min) / (max - min), 0, 1)
r = radius * t
```

所以 **`max` 一定要写对**。如果某个维度的 `max` 明显偏小，那条边就会顶到外圈；反之会缩成一小团，几个维度之间就没法比了。多指标对比时，让所有维度的 `max` 相等（比如统一 100）是最省心的做法。
:::

## 数据格式

雷达图的 `data` 和饼图、漏斗图都不一样：**`value` 必须是数组**，数组顺序严格对应 `radar.indicator` 的顺序。

```ts
series: [
  {
    type: 'radar3D',

    data: [
      {
        value: [85, 72, 90, 68, 76],   // ← 依次对应 性能/易用性/生态/文档/价格
        name: '产品 A',
      },
      {
        value: [70, 88, 65, 92, 60],
        name: '产品 B',
        itemStyle: { color: '#f59e0b' },
      },
    ],
  },
]
```

::: warning value 长度必须 >= 3
`value.length < 3` 的数据项会被**直接跳过**，不报错也不渲染。维度数与 `indicator.length` 不一致时，以 `indicator` 的长度为准：多出的值被忽略，缺少的位置读作 `undefined` 并参与归一化（结果偏小）。
:::

`value` 中的每一项还可以写成 `number[]` 形式的多值数据项吗？——不可以。雷达图数据项固定为 `{ value: number[], name?, itemStyle?, label? }`。

## 完整示例

多层雷达 + 交替分割区域 + 顶点样式：

```ts
import type { Vis3xOption } from 'vis-3x'

const option: Vis3xOption = {
  title: { show: true, text: '团队能力盘点' },
  tooltip: { show: true, trigger: 'item' },
  legend: { show: true, position: 'bottom' },
  radar: {
    indicator: [
      { name: '前端', max: 100 },
      { name: '后端', max: 100 },
      { name: '数据', max: 100 },
      { name: '运维', max: 100 },
      { name: '设计', max: 100 },
      { name: '测试', max: 100 },
    ],
    radius: 4,
    splitNumber: 5,
    startAngle: 90,
    axisLine: { show: true, lineStyle: { color: '#475569', opacity: 0.6 } },
    splitLine: { show: true, lineStyle: { color: '#1e293b' } },
    splitArea: { show: true, opacity: 0.9 },
    nameStyle: { fontSize: 13, color: '#e2e8f0', fontWeight: 600 },
  },
  series: [
    {
      type: 'radar3D',
      name: '甲组',
      data: [{ value: [90, 75, 60, 55, 80, 70], name: '甲组' }],
      layerGap: 0.6,
      areaStyle: { opacity: 0.55, roughness: 0.35, metalness: 0.2 },
      lineStyle: { width: 3, color: '#4f8cff' },
      showPoint: true,
      pointStyle: { size: 0.11, preset: 'standard', emissiveIntensity: 0.4 },
    },
    {
      type: 'radar3D',
      name: '乙组',
      data: [{ value: [65, 88, 92, 70, 52, 85], name: '乙组' }],
      layerGap: 0.6,
      areaStyle: { opacity: 0.45 },
      lineStyle: { width: 3, color: '#f59e0b' },
      showPoint: true,
      pointStyle: { size: 0.11 },
    },
  ],
}
```

两个可见系列时，`layerGap: 0.6` 让乙组整体上浮 0.6 个世界单位，形成「双层雷达」。系列数越多、`layerGap` 越大，立体感越强，但也越容易在俯视角下互相遮挡——超过 3 层建议把 `layerGap` 提到 `1.0` 以上。

## 使用建议

- **维度数控制在 3~8 个**。少于 3 个直接跳过渲染；多于 8 个时相邻维度名称会挤在一起，且多边形会趋近于圆，失去形状辨识度。
- **`max` 统一口径**。跨对象对比时把所有维度的 `max` 设为同一个值，否则形状的「胖瘦」会被归一化扭曲，看起来 A 比 B 强，实际只是量纲不同。
- **`areaStyle.opacity` 建议 0.35~0.6**。雷达图的面片天然重叠，默认 `0.5` 配 `depthWrite: false` 已经能正确叠色；调到 0.8 以上会盖住下层的蛛网线，看不清基准。
- **`showPoint` 不只是装饰**。顶点球体是**唯一可点击拾取的对象**（面片和描边都标记为不可拾取），关闭它就没有 tooltip 与 hover 了。
- **`splitNumber` 决定读数精度**。4~5 层足够；层数过多时同心多边形密集成一片，反而干扰数据面的轮廓判断。
