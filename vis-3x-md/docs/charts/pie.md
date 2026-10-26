# 饼图 · pie3D

饼图用「一块扇形的角度占比」表达部分与整体的关系。加上厚度之后还有一个额外好处：**扇形的高度可以再承载一个维度**（`depthByValue`），于是同一张图能同时读到「占比」和「绝对值」。环形模式（`innerRadius > 0`）留出的中心空洞适合放总量或关键指标。

它对类目数量很敏感：3~6 类最好读，超过 8 类角度差异肉眼几乎分辨不出，这时候应该换柱状图。所有扇块在 XY 平面构造后沿 Z 挤出，因此需要旋转视角才能看到厚度。

## 最简示例

<LiveChart
  type="pie3D"
  :height="420"
  caption="五类流量来源的占比。innerRadius 把饼切成环形，depth 挤出厚度；饼图不是笛卡尔图表，所以关掉坐标系，拖拽旋转才能看到扇块的侧面。"
  :option="{
    showCoordinate: false,
    series: [
      {
        type: 'pie3D',
        name: '来源',
        data: [
          { value: 1048, name: '搜索引擎' },
          { value: 735, name: '直接访问' },
          { value: 580, name: '邮件营销' },
          { value: 484, name: '联盟广告' },
          { value: 300, name: '视频广告' },
        ],
        radius: 3.4,
        innerRadius: 1.7,
        depth: 0.85,
        padAngle: 1.2,
        label: { show: true, formatter: '{name} {percent}%' },
        centerLabel: { show: true, total: true },
      },
    ],
  }"
/>

::: code-group

```ts [TypeScript]
import type { Vis3xOption } from 'vis-3x'

const option: Vis3xOption = {
  showCoordinate: false,
  series: [
    {
      type: 'pie3D',
      name: '来源',
      data: [
        { value: 1048, name: '搜索引擎' },
        { value: 735, name: '直接访问' },
        { value: 580, name: '邮件营销' },
        { value: 484, name: '联盟广告' },
        { value: 300, name: '视频广告' },
      ],
      radius: 3.4,
      innerRadius: 1.7,
      depth: 0.85,
      padAngle: 1.2,
      label: { show: true, formatter: '{name} {percent}%' },
      centerLabel: { show: true, total: true },
    },
  ],
}
```

```js [JavaScript]
// 纯 JavaScript：去掉类型标注即可
const option = {
  showCoordinate: false,
  series: [
    {
      type: 'pie3D',
      name: '来源',
      data: [
        { value: 1048, name: '搜索引擎' },
        { value: 735, name: '直接访问' },
        { value: 580, name: '邮件营销' },
        { value: 484, name: '联盟广告' },
        { value: 300, name: '视频广告' },
      ],
      radius: 3.4,
      innerRadius: 1.7,
      depth: 0.85,
      padAngle: 1.2,
      label: { show: true, formatter: '{name} {percent}%' },
      centerLabel: { show: true, total: true },
    },
  ],
}
```

:::

```vue
<template>
  <div style="height: 480px">
    <VisChart :option="option" />
  </div>
</template>
```

## 专属配置项

以下字段只在 `type: 'pie3D'` 的系列上有效。

| 字段 | 类型 | 默认值 | 说明 |
| --- | --- | --- | --- |
| `innerRadius` | `number` | `0` | 内半径（世界单位）。`> 0` 即成为环形图；建议取 `radius` 的 0.4~0.65 |
| `radius` | `number` | `3.4` | 外半径，不传用默认值 |
| `depth` | `number` | `0.85` | 扇块厚度（挤出高度） |
| `depthByValue` | `boolean` | `false` | 每块厚度是否随数值变化 |
| `depthRange` | `[number, number]` | `[depth*0.5, depth*1.6]` | 厚度映射范围，仅 `depthByValue: true` 时生效 |
| `startAngle` | `number` | `90` | 起始角度（度），90 即 12 点方向 |
| `padAngle` | `number` | `1.2` | 相邻扇块之间的间隙角（度）。从每块两端各切一半，圆心角之和不变 |
| `roseType` | `'radius' \| 'area' \| false` | `false` | 玫瑰图模式：`'radius'` 半径线性映射，`'area'` 面积线性映射 |
| `selectedOffset` | `number` | `0.32` | 高亮块沿半径向外偏移的距离 |
| `selectedIndex` | `number` | — | 指定哪一块向外偏移，做「强调某一块」效果 |
| `centerLabel` | `object` | — | 中心文字，见下表 |

`centerLabel` 子字段：

| 字段 | 类型 | 默认值 | 说明 |
| --- | --- | --- | --- |
| `centerLabel.show` | `boolean` | — | 是否显示（必须为 `true` 才渲染） |
| `centerLabel.total` | `boolean` | `true` | 是否显示所有数据的合计值 |
| `centerLabel.text` | `string` | — | 自定义文字。一旦提供，`total` 失效 |
| `centerLabel.textStyle` | `TextStyle` | `{ fontSize: 22, fontWeight: 700, color: '#f1f5f9' }` | 文字样式 |

## 数据格式

`data` 是**一维数组**，每项对应一块扇形。支持两种写法：

```ts
series: [
  {
    type: 'pie3D',

    // 写法 1：纯数字（名字自动补为「数据 1」「数据 2」…）
    data: [1048, 735, 580],

    // 写法 2：对象（推荐，能带名字与逐项样式）
    // data: [
    //   { value: 1048, name: '搜索引擎' },
    //   { value: 735, name: '直接访问', itemStyle: { color: '#f59e0b' } },
    // ],
  },
]
```

::: warning 只求和正值
渲染前每个值都会被归一化：**非有限值（`NaN` / `Infinity`）与 `<= 0` 的值一律按 0 处理，且不生成扇块**。如果全部数据都是 0，整个饼图不会渲染任何内容。

负值不会反向绘制，需要自己先取绝对值或过滤。
:::

每块的圆心角 = `value / total * 360`，其中 `total` 是所有有效值之和。实际绘制角为 `max(0.4, angleSpan - padAngle)`，保证极小占比的块仍可见。

## 完整示例

环形 + 中心总量 + 逐块高度 + 强调某一块：

```ts
import type { Vis3xOption } from 'vis-3x'

const option: Vis3xOption = {
  title: { show: true, text: '各渠道成交额', subtext: '单位：万元' },
  tooltip: { show: true, trigger: 'item' },
  legend: { show: true, position: 'right' },
  series: [
    {
      type: 'pie3D',
      name: '渠道',
      data: [
        { value: 335, name: '直营' },
        { value: 310, name: '分销' },
        { value: 274, name: '电商' },
        { value: 235, name: '团购' },
        { value: 400, name: '海外', itemStyle: { emissiveIntensity: 0.4 } },
      ],
      radius: 3.6,
      innerRadius: 1.85,        // 环形
      depth: 0.7,
      depthByValue: true,       // 值越大扇块越厚
      depthRange: [0.4, 1.3],
      startAngle: 90,
      padAngle: 1.6,
      selectedIndex: 4,         // 把「海外」推出来强调
      selectedOffset: 0.4,
      label: {
        show: true,
        position: 'outside',
        formatter: '{name} {value} 万（{percent}%）',
        textStyle: { fontSize: 12, color: '#cbd5e1' },
      },
      centerLabel: {
        show: true,
        total: true,
        textStyle: { fontSize: 26, color: '#f8fafc' },
      },
    },
  ],
}
```

`label.formatter` 是字符串模板，可用的占位符：

| 占位符 | 含义 |
| --- | --- |
| `{name}` | 该数据项的名字，缺省为 `数据 N` |
| `{value}` | 该项数值 |
| `{percent}` | 该项占总量百分比（数值，如 `22.5`，不带 `%`，需要自己加） |
| `{series}` | 系列名（`series.name`） |

```ts
// 也可以传函数，拿到完整上下文
label: {
  show: true,
  formatter: (p) => `${p.name}：${p.value}（${p.percent?.toFixed(1)}%）`,
}
```

::: tip 标签的位置由代码决定
饼图标签锚点固定在 `外半径 + label.distance`（默认 `0.55`）的中间角方向上，并抬高到扇块顶部以上 `0.15`。也就是说 `label.position` 对饼图**基本不起作用**，调远近请用 `label.distance`。
:::

## 使用建议

- **占比之和为 100% 才有意义**。如果数据之间不是「整体的一部分」（比如同比增速），用柱状图。
- **类目控制在 3~6 个**。超过 8 类时，把尾部小项合并成「其他」；`padAngle` 在类目多时也要减小（`0.5~0.8`），否则小扇块会被间隙吃掉。
- **`depthByValue` 是双刃剑**。它让厚度和角度编码同一种信息（冗余但强化），同时也放大了视觉差异——如果只想展示占比，把它关掉，保持 `depth` 统一。
- **环形图的中心是黄金位置**。`innerRadius` 取 `radius * 0.5` 左右，配合 `centerLabel` 放总量、增长率或所选中的那一项的数值。
- **玫瑰图慎用于精确比较**。`roseType: 'area'` 在感知上比 `'radius'` 更接近真实比例，但两者都不如柱状图易读。
