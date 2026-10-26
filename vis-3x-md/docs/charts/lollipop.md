# 棒棒糖图 · lollipop3D

棒棒糖图 = 一根细杆 + 顶部一个圆球。它表达的语义和柱状图完全一样（类目 → 数值），但墨水更少：细杆几乎不占视觉重量，圆球成为唯一的注意力焦点。**类目较多、数值差异需要被看清**时，它比柱状图更清爽。

在 3D 场景里它还有个额外优势——细杆不会像宽柱子那样互相遮挡，斜视角下后排数据依然可读。

`lollipop3D` 是**扩展示例图表**，需要先注册。

## 最简示例

<LiveChart
  type="lollipop3D"
  :height="400"
  caption="五个月份的棒棒糖图：细杆从 0 生长到数值，圆球是唯一的视觉焦点与拾取目标，细杆几乎不产生遮挡。"
  :option="{
    showCoordinate: false,
    type: 'lollipop3D',
    xAxis3D: { data: ['一月', '二月', '三月', '四月', '五月'], name: '月份' },
    yAxis3D: { name: '销量' },
    series: [
      {
        type: 'lollipop3D',
        name: '销量',
        data: [120, 200, 150, 80, 170],
      },
    ],
  }"
/>

::: code-group

```ts [TypeScript]
import { useExtraCharts } from 'vis-3x/presets'
import type { Vis3xOption } from 'vis-3x'

useExtraCharts(['lollipop3D'])

const option: Vis3xOption = {
  type: 'lollipop3D',
  xAxis3D: { data: ['一月', '二月', '三月', '四月', '五月'], name: '月份' },
  yAxis3D: { name: '销量' },
  series: [
    {
      type: 'lollipop3D',
      name: '销量',
      data: [120, 200, 150, 80, 170],
    },
  ],
}
```

```js [JavaScript]
// 纯 JavaScript：去掉类型标注即可
import { useExtraCharts } from 'vis-3x/presets'

useExtraCharts(['lollipop3D'])

const option = {
  type: 'lollipop3D',
  xAxis3D: { data: ['一月', '二月', '三月', '四月', '五月'], name: '月份' },
  yAxis3D: { name: '销量' },
  series: [
    {
      type: 'lollipop3D',
      name: '销量',
      data: [120, 200, 150, 80, 170],
    },
  ],
}
```

:::

```vue
<template>
  <div style="height: 460px">
    <VisChart :option="option" />
  </div>
</template>
```

## 专属配置项

::: warning 先说清楚一件事
`lollipop3D` 的**几何参数全部是硬编码的**，没有暴露成系列字段。源码里写死了三个值：

| 参数 | 源码中的取值 | 位置 |
| --- | --- | --- |
| 细杆半径 | `0.055` | `ctx.geometry.cylinder(0.055, 0.055, height, 12)` |
| 圆球半径 | `0.22` | `ctx.geometry.sphere(ballRadius, 22)` |
| 球心位置 | 杆顶 `(x, height, 0)` | `ball.position.set(x, height, 0)` |

所以下面这张表里**没有** `stemRadius`、`ballRadius` 之类的字段——它们不存在。想改尺寸得复制源码改成自己的图表。
:::

实际可用的专属字段只有一个：

| 字段 | 类型 | 默认值 | 说明 |
| --- | --- | --- | --- |
| `data` | `Array<number \| { value, name?, itemStyle?, label? }>` | — | 一维数组，每个元素一根棒棒糖 |
| `color` | `string[]` | `theme.palette` | 系列调色板，按 `index % colors.length` 逐项取色 |

继承自 `BaseSeries` 的通用字段（同样生效）：

| 字段 | 类型 | 默认值 | 说明 |
| --- | --- | --- | --- |
| `name` | `string` | — | 系列名，用于图例与 tooltip |
| `label` | `LabelStyle` | — | 数值标签。`label.show` 为真时显示在圆球上方 `0.25` 处 |
| `itemStyle` | `ItemStyle` | — | 通用项样式（注意：源码中球体材质参数是写死的，此字段主要影响继承来的默认处理） |
| `animation` | `AnimationConfig` | — | 动画配置，驱动「细杆与圆球一起从底部升起」 |

::: details 渲染细节：为什么球一定在杆顶
细杆用 `cylinder(0.055, 0.055, height, 12)` 创建，而 Three.js 的圆柱几何体**中心在原点**，所以杆的位置是 `y = height / 2`；球的位置是 `y = height`，正好坐在杆顶。

生长动画里这两者必须同步改，否则球会脱离杆：

```ts
plan.custom((t) => {
  const h = Math.max(0.0001, height * t)
  stem.scale.y = h / height
  stem.position.y = h / 2
  ball.position.y = h
}, index, { finish: () => { /* 复原到终态 */ } })
```

这是所有「中心在原点」的几何体做生长动画时的通用套路，自己写自定义图表时会经常遇到。
:::

## 数据格式

`data` 是**一维数组**，长度对应 X 轴的类目数，`index` 直接映射到 `ctx.coord.xAtCategory(index)`。

```ts
series: [
  {
    type: 'lollipop3D',

    // 写法 1：纯数字
    data: [120, 200, 150, 80, 170],

    // 写法 2：对象（推荐，能带名字与逐项颜色）
    // data: [
    //   { value: 120, name: '一月' },
    //   { value: 200, name: '二月', itemStyle: { color: '#f59e0b' } },
    // ],
  },
]
```

名称的解析顺序是：`数据项自身的 name` → `xAxis3D.data[index]` → 都不存在时的兜底文案。所以只要配了 `xAxis3D.data`，tooltip 里就能显示正确的类目名。

::: warning 非有限值会被跳过
`if (!Number.isFinite(value)) return` —— `NaN` 与 `Infinity` 的数据项**整根棒棒糖都不画**（杆和球都不会出现），不会用 0 占位。
:::

::: tip 每个数据项必须落在自己的类目上
`ctx.coord.xAtCategory(index)` 使用数组下标定位，所以 `data` 不能跳过类目。要在某个位置「留白」，请传 `0` 而不是省略元素——省略会让后续所有项左移一格。
:::

## 完整示例

逐项配色 + 顶部数值标签 + 收紧的动画：

```ts
import { useExtraCharts } from 'vis-3x/presets'
import type { Vis3xOption } from 'vis-3x'

useExtraCharts(['lollipop3D'])

const option: Vis3xOption = {
  type: 'lollipop3D',
  title: { show: true, text: '各城市门店营收', subtext: '单位：万元' },
  xAxis3D: {
    data: ['北京', '上海', '广州', '深圳', '成都', '杭州'],
    name: '城市',
  },
  yAxis3D: { name: '营收', min: 0 },
  tooltip: { show: true, trigger: 'item' },
  legend: { show: true, position: 'bottom' },
  series: [
    {
      type: 'lollipop3D',
      name: '营收',
      color: ['#4f8cff', '#22d3ee', '#34d399', '#fbbf24', '#f87171', '#a78bfa'],
      data: [
        { value: 320, name: '北京' },
        { value: 410, name: '上海' },
        { value: 275, name: '广州' },
        { value: 380, name: '深圳' },
        { value: 195, name: '成都' },
        { value: 240, name: '杭州' },
      ],
      label: {
        show: true,
        position: 'top',
        precision: 0,
        formatter: '{name} {value}',
        textStyle: { fontSize: 12, color: '#e2e8f0' },
      },
      animation: { enabled: true, duration: 800, easing: 'backOut', stagger: 60 },
    },
  ],
  lights: [
    { type: 'ambient', intensity: 0.55 },
    { type: 'directional', position: [1, 1.6, 1], intensity: 1.6, shadow: true },
  ],
}
```

球体自带 `emissive: color` 与 `emissiveIntensity: 0.35`，暗色主题下球会微微发光，视觉焦点很明确。配合 `easing: 'backOut'`，升起时会有一点回弹，观感比线性生长更「活泼」。

## 使用建议

- **类目 5~15 个时最合适**。少于 5 个用柱状图更有分量感；多于 15 个时圆球会挤在一起，此时应该考虑横向条形图或折线图。
- **Y 轴记得设 `min: 0`**。棒棒糖图的杆长是「从 0 到数值」的视觉隐喻，轴不从 0 开始时这个隐喻就断了，会严重夸大差异。
- **配色别超过 6 种**。逐项配色好看但会削弱「同一系列」的整体感；如果数据本身是一个整体（比如同一指标的不同月份），建议用单色或同色系深浅。
- **想要更大的球，就得改源码**。`ballRadius = 0.22` 是写死的。复制 `defineLollipop3D` 成自己的 `type`（比如 `myLollipop3D`）并改掉常量，是最直接的做法——这也正是把它做成示例图表的意义。
- **数据稀疏时用 `0` 占位**，不要省略数组元素，否则类目会错位。
