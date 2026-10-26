# 柱线组合图 · barLine3D

柱线组合图用柱子表达「量」、用折线表达「率」或「趋势」。这是商业报表里最常见的双指标结构：比如各月营收（柱）+ 同比增速（线），两类数据量纲完全不同，单独任何一张图都讲不清。

`barLine3D` 的实现方式和 `lollipop3D` 有本质区别——它是 **`extendChart('bar3D')`**，也就是继承内置柱状图、只在 `afterRender` 里追加一条折线。柱子的一切能力（圆角、间隙、堆叠、`colorByValue`）原样继承，你不需要重新实现。

`barLine3D` 是**扩展示例图表**，需要先注册。

## 最简示例

<LiveChart
  type="barLine3D"
  :height="440"
  caption="柱子表示营收，折线表示趋势。折线被放在网格最前方，所以不会被柱子遮挡。"
  :option="{
    type: 'barLine3D',
    xAxis3D: {
      data: ['一月', '二月', '三月', '四月', '五月'],
      name: '月份',
    },
    yAxis3D: { name: '数值' },
    legend: { show: true, position: 'bottom' },
    series: [
      {
        type: 'bar3D',
        name: '营收',
        data: [120, 200, 150, 80, 170],
      },
      {
        type: 'line3D',
        name: 'line:趋势',
        data: [110, 180, 165, 95, 150],
      },
    ],
  }"
/>

::: code-group

```ts [TypeScript]
import { useExtraCharts } from 'vis-3x/presets'
import type { Vis3xOption } from 'vis-3x'

useExtraCharts(['barLine3D'])

const option: Vis3xOption = {
  type: 'barLine3D',
  xAxis3D: {
    data: ['一月', '二月', '三月', '四月', '五月'],
    name: '月份',
  },
  yAxis3D: { name: '数值' },
  series: [
    {
      type: 'bar3D',
      name: '营收',
      data: [120, 200, 150, 80, 170],
    },
    {
      // 标记为折线：用 line: 前缀或 type: 'line3D'
      type: 'line3D',
      name: 'line:趋势',
      data: [110, 180, 165, 95, 150],
    },
  ],
}
```

```js [JavaScript]
// 纯 JavaScript：去掉类型标注即可
import { useExtraCharts } from 'vis-3x/presets'

useExtraCharts(['barLine3D'])

const option = {
  type: 'barLine3D',
  xAxis3D: {
    data: ['一月', '二月', '三月', '四月', '五月'],
    name: '月份',
  },
  yAxis3D: { name: '数值' },
  series: [
    {
      type: 'bar3D',
      name: '营收',
      data: [120, 200, 150, 80, 170],
    },
    {
      // 标记为折线：用 line: 前缀或 type: 'line3D'
      type: 'line3D',
      name: 'line:趋势',
      data: [110, 180, 165, 95, 150],
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

## 哪个系列画柱子、哪个画折线

这是本图表唯一需要理解的规则。`afterRender` 里的过滤条件逐字如下：

```ts
const lineSeries = ctx.allSeries.filter(
  (s) => s.type === 'line3D' || /^line:/i.test(s.name ?? '')
)
```

判定顺序是「**或**」关系，满足任意一条即被当作折线：

| 判定方式 | 写法 | 说明 |
| --- | --- | --- |
| 系列 type | `type: 'line3D'` | 最直观，推荐 |
| 系列名前缀 | `name: 'line:趋势'` | 不区分大小写（`line:` / `Line:` / `LINE:` 都行） |

其余所有系列**一律交给父类 `bar3D` 画柱子**——包括 `type: 'bar3D'` 和任何没被匹配到的类型。

::: warning 折线系列仍然只读 `data` 的标量值
虽然命中折线分支的系列 `type` 可能写的是 `line3D`，但绘制**完全没有走内置折线图的逻辑**。它只做了一件事：对每个数据项调 `extractScalar(item)` 取数值，再用 `catmullRomSpline` 平滑。所以 `lineStyle`、`showSymbol`、`curtain`、`smooth`、`smoothTension`、`z` 这些 `Line3DSeries` 的字段**在这里全部无效**。想调折线外观只能改源码常量。
:::

## 专属配置项

`barLine3D` 自己**没有新增任何配置字段**。它读取的全是继承来的通用字段：

| 字段 | 类型 | 默认值 | 说明 |
| --- | --- | --- | --- |
| `series[].type` | `'line3D'` | — | 命中的系列画折线 |
| `series[].name` | `string` | — | `line:` 前缀同样命中折线分支；同时用于图例与 tooltip |
| `series[].data` | `Array<number \| { value, name? }>` | — | 折线系列按标量解析 |
| `series[].color[0]` | `string` | `theme.colorAt(seriesIndex)` | **折线只取色板的第一个颜色**，不是逐项配色 |

柱子系列因为走的是父类 `bar3D`，`barWidth`、`barDepth`、`barGap`、`barCategoryGap`、`borderRadius`、`colorByValue`、`stack` 等字段**全部照常生效**，详见 [柱状图 bar3D](./bar)。

以下是**硬编码、不可配置**的折线参数：

| 参数 | 源码中的取值 | 位置 |
| --- | --- | --- |
| 折线的 z 位置 | `gridDepth / 2 + 0.42` | `const lineZ = ...` |
| 平滑方式 | `catmullRomSpline(points, 14, 0.5)` | 每段 14 个采样点，张力 0.5 |
| 管半径 | `0.06` | `ctx.geometry.tube(smooth, 0.06, ...)` |
| 管分段数 | `smooth.length * 2` | 跟随平滑点数 |
| 折线材质 | `roughness 0.2 / metalness 0.4 / emissiveIntensity 0.3` | 写死在 `ctx.material(...)` |
| 数据点半径 | `0.11` | `ctx.geometry.sphere(0.11, 16)` |
| 数据点颜色 | `'#ffffff'` | 固定白色小球 |
| 额外延迟 | `extraDelay: 120` | 折线比柱子晚 120ms 启动 |

::: details 折线为什么必须浮在网格最前方
```ts
const lineZ = ctx.coord.grid.gridDepth / 2 + 0.42
```
折线的 z 被**硬推到网格外面**（`gridDepth / 2` 是 Z 方向的前边缘，再往外 `0.42`）。柱子的 z 落在 `[-gridDepth/2, gridDepth/2]` 之内，所以折线一定在柱子前面，斜视角下不会被高柱子挡住。

代价是折线的 z 与柱子的 z **不共享同一套坐标含义**——它只是个「贴在最前面的浮层」。如果柱子的 `barDepth` 被调得特别大，视觉上折线会明显脱离柱阵，这是这个实现方案的固有取舍。
:::

::: warning 没有折线系列时也必须 `plan.run()`
`afterRender` 里有一个容易踩的坑：

```ts
if (!lineSeries.length) {
  plan.run()            // ← 必须调用
  ctx.keepAnimating()   // ← 必须调用
  return
}
```

`extendChart` 的父类只负责**登记**柱子动画，真正启动动画的 `plan.run()` 位于扩展钩子之后。如果这里直接 `return` 而不调 `plan.run()`，**父类登记的柱子生长动画永远不会启动**——柱子会停在初始状态，看起来像渲染坏了。`ctx.keepAnimating()` 同理，缺了它动画期间不会重绘。

只要你在 `afterRender` 里提前返回，就必须自己补上这两行。
:::

## 数据格式

两个系列的 `data` 都是**一维标量数组**，长度应与 `xAxis3D.data` 的类目数一致；第 `index` 项落在 `ctx.coord.xAtCategory(index)` 上。

```ts
series: [
  // 柱子：交给父类 bar3D，接受数字或对象
  { type: 'bar3D', name: '营收', data: [120, 200, 150, 80, 170] },

  // 折线：只读取标量值
  {
    type: 'line3D',
    name: 'line:趋势',
    data: [
      110,
      { value: 180, name: '二月' },   // 对象写法也能解析出 180
      165,
      95,
      150,
    ],
  },
]
```

::: tip 折线用 `name` 前缀的好处
折线系列如果写 `type: 'line3D'` 且不带 `line:` 前缀，图例里会显示「line3D」之外的原始 `name`。想在图例上直观区分「这是线不是柱」，把 `name` 写成 `'line:同比增速'` 最省事——它同时满足两条判定中的一条，不依赖 `type`。
:::

::: warning 折线至少需要 2 个有效点
`if (points.length < 2) return` —— 有效点不足 2 个时，该折线系列**整条不画**（连数据点小球也不会出现，因为 `return` 在画点之前）。无效值（`NaN` / `Infinity`）会被跳过，但不会打断其余点。
:::

## 完整示例

双柱 + 一条趋势线，柱子用圆角与数值配色，折线用高对比色：

```ts
import { useExtraCharts } from 'vis-3x/presets'
import type { Vis3xOption } from 'vis-3x'

useExtraCharts(['barLine3D'])

const option: Vis3xOption = {
  type: 'barLine3D',                       // 必须显式声明，否则会被推断成 bar3D
  title: { show: true, text: '季度营收与增速', subtext: '柱：营收（万元） 线：同比增速' },
  xAxis3D: { data: ['Q1', 'Q2', 'Q3', 'Q4'], name: '季度' },
  yAxis3D: { name: '营收', min: 0 },
  tooltip: { show: true, trigger: 'item' },
  legend: { show: true, position: 'bottom' },
  gridFloor: { show: true, divisions: 8, showWall: true, wallOpacity: 0.12 },
  series: [
    {
      type: 'bar3D',
      name: '本期',
      data: [320, 410, 385, 520],
      borderRadius: 0.12,
      barCategoryGap: 0.35,
    },
    {
      type: 'bar3D',
      name: '上期',
      data: [280, 360, 400, 460],
      borderRadius: 0.12,
      barCategoryGap: 0.35,
    },
    {
      // 折线：name 前缀命中判定，同时图例里能一眼看出是线
      type: 'line3D',
      name: 'line:增速',
      color: ['#fbbf24'],                  // 只取第一个颜色
      data: [12.4, 18.6, 9.2, 21.5],
    },
  ],
  animation: { enabled: true, duration: 900, easing: 'cubicOut', stagger: 70 },
  lights: [
    { type: 'ambient', intensity: 0.6 },
    { type: 'directional', position: [1, 1.6, 1], intensity: 1.5, shadow: true },
  ],
}
```

折线会比柱子晚 `120ms` 出现（`extraDelay: 120`），形成「柱子先立起来、趋势线随后拉起」的层次感。数据点用固定白色小球，在彩色折线上始终清晰。

## 使用建议

- **显式写 `type: 'barLine3D'`**。`<VisChart>` 在缺省 `type` 时会按 `series[0].type` 推断，此时会推断成 `bar3D`，折线逻辑（`afterRender`）根本不会执行。
- **折线最多 1~2 条**。所有折线都被推到同一个 `lineZ`（网格最前方），多条折线的 z 完全重合，只有 XY 位置不同，容易互相穿插。要区分请靠颜色和点标记。
- **折线语义上是「浮层」，不是独立坐标系**。它和柱子共用同一个 Y 轴，所以「营收 320 万」和「增速 12.4%」画在同一高度基准上会被压缩。稳妥做法是让折线数据本身也落在与柱状接近的量级（比如把百分比放大 10 倍再在 label 里说明），或直接用两条柱。
- **柱子该有的配置照常写**。圆角、间隙、`colorByValue`、`stack` 都继承自 `bar3D`——这是 `extendChart` 相对 `defineChart` 最大的省力之处。
- **想改折线的粗细、颜色规则或 z 位置，只能改源码**。复制 `defineBarLine3D` 改名成自己的 `type`（比如 `myBarLine3D`）再调 `0.06`、`0.42`、`extraDelay` 这些常量即可；`registerChart` 会覆盖同名类型，不必担心冲突。
