# 漏斗图 · funnel3D

漏斗图表现**逐级流失的转化过程**：用户从进入页面到最终下单，每一层都筛掉一部分。每层是一个上窄下宽的梯形棱柱，宽度按数值线性映射，堆叠起来自然形成漏斗形状。

它也常用于展示「层级结构」——把 `sort` 设为 `'none'`，就能画出固定顺序的层级（如组织架构、套餐档位）。数据不按降序排列时，画出来的不是漏斗而是一个「灯笼」，见下面的说明。

## 最简示例

<LiveChart
  type="funnel3D"
  :height="400"
  caption="五层注册转化漏斗：层宽按数值线性映射，数据已按降序排列，斜视角下能看清每层的挤出厚度。"
  :option="{
    showCoordinate: false,
    title: { show: true, text: '注册转化漏斗' },
    tooltip: { show: true, trigger: 'item' },
    label: { show: true, formatter: '{name}: {value}' },
    series: [
      {
        type: 'funnel3D',
        name: '转化',
        data: [
          { value: 100, name: '访问' },
          { value: 80, name: '注册' },
          { value: 60, name: '实名' },
          { value: 40, name: '下单' },
          { value: 20, name: '支付' },
        ],
        height: 6,
        width: 5,
        depth: 1.6,
        gap: 0.14,
        sort: 'descending',
      },
    ],
  }"
/>

::: code-group

```ts [TypeScript]
import type { Vis3xOption } from 'vis-3x'

const option: Vis3xOption = {
  title: { show: true, text: '注册转化漏斗' },
  tooltip: { show: true, trigger: 'item' },
  label: { show: true, formatter: '{name}: {value}' },
  series: [
    {
      type: 'funnel3D',
      name: '转化',
      data: [
        { value: 100, name: '访问' },
        { value: 80, name: '注册' },
        { value: 60, name: '实名' },
        { value: 40, name: '下单' },
        { value: 20, name: '支付' },
      ],
      height: 6,
      width: 5,
      depth: 1.6,
      gap: 0.14,
      sort: 'descending',
    },
  ],
}
```

```js [JavaScript]
// 纯 JavaScript：去掉类型标注即可
const option = {
  title: { show: true, text: '注册转化漏斗' },
  tooltip: { show: true, trigger: 'item' },
  label: { show: true, formatter: '{name}: {value}' },
  series: [
    {
      type: 'funnel3D',
      name: '转化',
      data: [
        { value: 100, name: '访问' },
        { value: 80, name: '注册' },
        { value: 60, name: '实名' },
        { value: 40, name: '下单' },
        { value: 20, name: '支付' },
      ],
      height: 6,
      width: 5,
      depth: 1.6,
      gap: 0.14,
      sort: 'descending',
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
| `height` | `number` | `6` | 漏斗总高度（所有层 + 间隙之和） |
| `width` | `number` | `5` | 顶部最宽处的宽度（世界单位），也是宽度映射的基准 |
| `gap` | `number` | `0.14` | 层与层之间的垂直间隙 |
| `depth` | `number` | `1.6` | 每层的挤出厚度（Z 方向） |
| `shape` | `'funnel' \| 'pyramid'` | `'funnel'` | `'funnel'` 梯形收缩；`'pyramid'` 金字塔。当前实现下两者的宽度计算一致，区别主要在语义与默认观感 |
| `minSize` | `number` | `0.22` | 底部最小宽度比例，会被 `clamp(值, 0.02, 1)` 夹紧。保证占比极小的层仍然可见 |
| `sort` | `'ascending' \| 'descending' \| 'none'` | `'descending'` | 排序方式。默认按数值**从大到小**排，这正是漏斗所需的顺序 |

::: details 每层的宽度和高度是怎么算出来的

```ts
maxValue = max(所有数据项的 value, 1)
layerHeight = (height - gap * (层数 - 1)) / 层数

t     = clamp(value / maxValue, 0, 1)
width = this.width * (minSize + (1 - minSize) * t)
```

- 高度**均分**，不按数值变化——只有宽度编码数值。
- 宽度做线性映射，最宽的一层恰好等于 `width`。
- 下一层的下底宽度取下一层自己的宽度值；如果是最后一层，则取 `当前宽度 * 0.6`，形成收口。
- 层级从下往上堆叠：`y = (层数 - 1 - layerIndex) * (layerHeight + gap)`。
:::

## 数据格式

`data` 是**一维数组**，每项对应漏斗的一层，同样是数字或对象两种写法：

```ts
series: [
  {
    type: 'funnel3D',

    // 写法 1：纯数字（名字自动补为「阶段 1」「阶段 2」…）
    data: [100, 80, 60, 40, 20],

    // 写法 2：对象（推荐，能带名字）
    // data: [
    //   { value: 100, name: '访问' },
    //   { value: 80,  name: '注册' },
    // ],
  },
]
```

::: warning 数据必须降序，否则画不出漏斗
虽然默认 `sort: 'descending'` 会帮你排好序，但一旦你把 `sort` 改成 `'none'` 或 `'ascending'`，而数据本身又是乱的，画出来的就是一个上宽下窄交替的「灯笼」，不再是漏斗。

**保证漏斗形状的正确姿势**：直接用降序数据 + 保留默认的 `sort: 'descending'`（或显式写 `'none'` 配合已排好序的数据）。这样 `name` 与 `value` 的对应关系完全可控，也避免了排序后 `dataIndex` 事件回调与原始数组下标错位。

排序改变的是绘制顺序，**不会改变 `dataIndex`**——排序前每个数据项的原始下标被保留下来，事件与 `label` 里拿到的 `dataIndex` 始终指向你传入的原始数组。
:::

## 完整示例

带排序控制的层级结构 + 强调颜色 + 百分比标签：

```ts
import type { Vis3xOption } from 'vis-3x'

const option: Vis3xOption = {
  title: { show: true, text: '电商下单链路', subtext: '单位：万人次' },
  tooltip: { show: true, trigger: 'item' },
  series: [
    {
      type: 'funnel3D',
      name: '链路',
      data: [
        { value: 420, name: '首页曝光', itemStyle: { color: '#4f8cff' } },
        { value: 310, name: '商品详情', itemStyle: { color: '#22d3ee' } },
        { value: 190, name: '加入购物车', itemStyle: { color: '#34d399' } },
        { value: 95, name: '提交订单', itemStyle: { color: '#fbbf24' } },
        { value: 62, name: '完成支付', itemStyle: { color: '#f87171' } },
      ],
      height: 6.5,
      width: 5.4,
      depth: 1.4,
      gap: 0.18,
      minSize: 0.26,
      shape: 'funnel',
      sort: 'descending',
      itemStyle: {
        roughness: 0.28,
        metalness: 0.3,
        side: 'double',
      },
      label: {
        show: true,
        formatter: '{name}  {value} 万（{percent}%）',
        textStyle: { fontSize: 12, color: '#e2e8f0' },
        distance: 0.3,
      },
    },
  ],
}
```

`label.formatter` 可用占位符与饼图一致：`{name}`、`{value}`、`{percent}`、`{series}`。漏斗的 `percent` 是**相对所有层之和**的占比，不是相对第一层的转化率——要显示转化率请传函数自己算：

```ts
label: {
  show: true,
  formatter: (p) => `${p.name}：${((p.value as number) / 420 * 100).toFixed(1)}%`,
}
```

::: tip 标签位置是固定的
每一层的标签锚点固定在 `层顶 + label.distance`（默认 `0.25`）处，并沿 Z 轴推到轮廓前方（`depth / 2 + 0.15`），所以标签总是贴在梯形正上方的正面。`label.position` 对漏斗图不生效。
:::

## 使用建议

- **层数控制在 3~6 层**。层数越多，`layerHeight = (height - gap * (n - 1)) / n` 越小；超过 6 层时记得同步加大 `height` 或减小 `gap`，否则每层薄得像纸片。
- **`minSize` 是防「消失」的保险**。真实转化链路末端的数值经常只有首层的 1%~3%，若不设 `minSize`，那一层会缩成一条线。`0.2~0.3` 是兼顾真实感与可读性的区间。
- **`gap` 与 `depth` 配合决定观感**。`gap: 0.1~0.2` 配 `depth: 1.4~1.8` 是比较稳的组合；`gap` 太大会让漏斗散架，太小则层与层的分界看不清。
- **不要用面积去估比例**。视觉宽度是数值的线性映射，但**视觉面积**约等于宽度 × 高度，感知上会放大差异，这个偏离在漏斗上恰恰是想要的强调效果。
- **想显示转化率就在 `label.formatter` 里算**。逐层转化率（本层 / 上一层）比总量占比更有业务价值。
