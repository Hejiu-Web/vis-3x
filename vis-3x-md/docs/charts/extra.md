# 扩展示例图表 · 总览

`vis-3x/presets` 里除了主题预设，还有 **6 个用公开扩展 API 写成的示例图表**。它们有两个身份：

1. **开箱可用的图表**——注册后 `type` 就能像内置类型一样直接用；
2. **自定义图表的活文档**——源码只用到了 `defineChart` / `extendChart` / 注册表这几个公开入口，和第三方使用者能调用的能力完全一致。

换句话说：**想看「自定义图表到底怎么写」，读 `extra-charts.ts` 就是最短路径。**

## 六个图表

| type | 名称 | 实现方式 | 一句话 |
| --- | --- | --- | --- |
| `lollipop3D` | 棒棒糖图 | `defineChart` | 细杆 + 顶部圆球，类目数据的轻量替代柱状图 |
| `bubble3D` | 气泡图 | `defineChart` | `[x, y, z]` 三元组定位，半径按数值映射 |
| `barLine3D` | 柱线组合图 | `extendChart('bar3D')` | 复用柱状图渲染，在其上叠加折线 |
| `pyramid3D` | 金字塔图 | `defineChart` | 由下至上逐层收缩的实心棱锥 |
| `ringProgress3D` | 多环进度图 | `defineChart` | 每个数据项一圈，嵌套的立体进度环 |
| `stepTerrain3D` | 阶梯地形图 | `defineChart` | 矩阵数据画成立方体阶梯，表现离散高度场 |

其中 `barLine3D` 是唯一的 `extendChart` 例子——它演示了「不为重写、只为增强」这个最典型的继承用法：父类负责柱子，`afterRender` 里追加一条折线。

### 看效果

这四个例子都是**真实运行的图表**，可以直接拖拽：

<LiveChart
  type="lollipop3D"
  :height="330"
  caption="lollipop3D — 细杆 + 顶部圆球。比柱状图更轻，适合类目不多时做数值对比。"
  :option="{
    xAxis3D: { data: ['一月', '二月', '三月', '四月', '五月', '六月'] },
    yAxis3D: { name: '销量' },
    series: [
      {
        type: 'lollipop3D',
        name: '销量',
        data: [120, 180, 95, 210, 160, 140],
      },
    ],
  }"
/>

<LiveChart
  type="bubble3D"
  :height="330"
  caption="bubble3D — 数据是 [x, y, z] 三元组，半径按 y 值映射。xAxis3D / zAxis3D 需要是数值轴。"
  :option="{
    xAxis3D: { type: 'value', min: -6, max: 6, name: '投入' },
    yAxis3D: { name: '产出' },
    zAxis3D: { type: 'value', min: -5, max: 5, name: '区域' },
    series: [
      {
        type: 'bubble3D',
        name: '样本',
        data: [
          [-4, 22, -3], [-3, 38, -2], [-2.4, 55, -3.4],
          [-1, 31, -1], [-0.5, 74, -2], [0, 46, 0],
          [0.8, 88, 1], [1.6, 52, 0.5], [2.2, 67, 2],
          [3, 41, 1.5], [3.6, 79, 3], [4.4, 35, 2.5],
          [1.2, 29, -1.5], [-2, 63, 2.2], [2.8, 58, -2.5],
        ],
      },
    ],
  }"
/>

<LiveChart
  type="pyramid3D"
  :height="330"
  caption="pyramid3D — 数据自上而下排列，每层宽度按数值映射，底层最宽。"
  :option="{
    showCoordinate: false,
    series: [
      {
        type: 'pyramid3D',
        name: '人口结构',
        data: [
          { value: 32, name: '0-14 岁' },
          { value: 58, name: '15-29 岁' },
          { value: 76, name: '30-44 岁' },
          { value: 64, name: '45-59 岁' },
          { value: 41, name: '60 岁以上' },
        ],
      },
    ],
  }"
/>

<LiveChart
  type="ringProgress3D"
  :height="330"
  caption="ringProgress3D — 数据是一维数字数组，每项一环。传 max 才能表达「绝对完成度」而非相对比较。"
  :option="{
    showCoordinate: false,
    series: [
      {
        type: 'ringProgress3D',
        name: '完成度',
        max: 100,
        data: [92, 78, 64, 45],
        label: { show: true },
      },
    ],
  }"
/>

## 注册：`useExtraCharts()`

这些图表**默认不会自动注册**，必须显式调用。这样内置包的用户不会被 6 个用不到的图表定义污染。

```ts
import { useExtraCharts } from 'vis-3x/presets'

// 注册全部 6 个
useExtraCharts()
```

只注册需要的几个：

```ts
import { useExtraCharts } from 'vis-3x/presets'

useExtraCharts(['lollipop3D', 'bubble3D'])
```

也可以单独导入某个定义函数自己注册：

```ts
import { defineLollipop3D } from 'vis-3x/presets'
import { registerChart } from 'vis-3x'

registerChart(defineLollipop3D())
```

`useExtraCharts()` 内部就是遍历名字表并调用对应的 `defineXxx()`，`defineXxx()` 返回的 `ChartConstructor` 交给注册表。重复调用是安全的——同名类型会被覆盖。

查看全部可注册的类型名：

```ts
import { getExtraChartTypes } from 'vis-3x/presets'

console.log(getExtraChartTypes())
// ['lollipop3D', 'bubble3D', 'barLine3D', 'pyramid3D', 'ringProgress3D', 'stepTerrain3D']
```

::: warning 注册必须在创建图表之前
`useExtraCharts()` 是**同步**的，但要在 `createChart(...)` 或组件挂载**之前**调用。放在模块顶层最稳妥：

```ts
// main.ts —— 全局注册一次
import { createApp } from 'vue'
import App from './App.vue'
import Vis3x from 'vis-3x'
import { useExtraCharts } from 'vis-3x/presets'
import 'vis-3x/style.css'

useExtraCharts()          // ← 在这里

createApp(App).use(Vis3x).mount('#app')
```

若在组件内注册，请放在 `<script setup>` 的顶层（或 `onMounted` 之前的同步代码里），不要塞进 `setTimeout` 或异步回调。
:::

## 完整示例

一个最小的可运行页面，用两个扩展图表：

::: code-group

```vue [TypeScript]
<script setup lang="ts">
import { useExtraCharts } from 'vis-3x/presets'
import type { Vis3xOption } from 'vis-3x'

useExtraCharts(['lollipop3D', 'bubble3D'])

const lollipopOption: Vis3xOption = {
  type: 'lollipop3D',
  xAxis3D: { data: ['一月', '二月', '三月', '四月', '五月'] },
  yAxis3D: { name: '销量' },
  series: [
    {
      type: 'lollipop3D',
      name: '销量',
      data: [120, 200, 150, 80, 170],
      label: { show: true, precision: 0 },
    },
  ],
}

const bubbleOption: Vis3xOption = {
  type: 'bubble3D',
  xAxis3D: { name: '投入' },
  yAxis3D: { name: '产出' },
  zAxis3D: { name: '规模' },
  series: [
    {
      type: 'bubble3D',
      name: '样本',
      data: [
        [10, 30, 5],
        [25, 62, 12],
        [40, 45, 8],
      ],
      pointStyle: { sizeRange: [0.14, 0.5] },
    },
  ],
}
</script>

<template>
  <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 16px">
    <div style="height: 420px">
      <VisChart :option="lollipopOption" />
    </div>
    <div style="height: 420px">
      <VisChart :option="bubbleOption" />
    </div>
  </div>
</template>
```

```vue [JavaScript]
<script setup>
// 纯 JavaScript：去掉类型标注即可
import { useExtraCharts } from 'vis-3x/presets'

useExtraCharts(['lollipop3D', 'bubble3D'])

const lollipopOption = {
  type: 'lollipop3D',
  xAxis3D: { data: ['一月', '二月', '三月', '四月', '五月'] },
  yAxis3D: { name: '销量' },
  series: [
    {
      type: 'lollipop3D',
      name: '销量',
      data: [120, 200, 150, 80, 170],
      label: { show: true, precision: 0 },
    },
  ],
}

const bubbleOption = {
  type: 'bubble3D',
  xAxis3D: { name: '投入' },
  yAxis3D: { name: '产出' },
  zAxis3D: { name: '规模' },
  series: [
    {
      type: 'bubble3D',
      name: '样本',
      data: [
        [10, 30, 5],
        [25, 62, 12],
        [40, 45, 8],
      ],
      pointStyle: { sizeRange: [0.14, 0.5] },
    },
  ],
}
</script>

<template>
  <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 16px">
    <div style="height: 420px">
      <VisChart :option="lollipopOption" />
    </div>
    <div style="height: 420px">
      <VisChart :option="bubbleOption" />
    </div>
  </div>
</template>
```

:::

::: tip 显式写 `type` 更保险
`<VisChart>` 不写 `type` 时会按 `series[0].type` 推断。对于扩展图表这通常也能work，但 `barLine3D` 这类「父类型 + 增强系列」的组合必须显式声明 `type`，否则会被推断成 `bar3D` 而丢掉折线。
:::

## 源码就是最好的自定义图表教程

打开 `packages/vis-3x/src/presets/extra-charts.ts`，你会看到两种最核心的写法：

### 1. `defineChart` —— 从零实现

```ts
export function defineLollipop3D(): ChartConstructor {
  return defineChart({
    type: 'lollipop3D',
    render(ctx) {
      const series = ctx.series[0]
      const plan = ctx.transition

      series.data.forEach((item, index) => {
        const value = extractScalar(item as never)
        const x = ctx.coord.xAtCategory(index)
        const height = Math.max(ctx.coord.yAt(value), 0.0001)

        const stem = new THREE.Mesh(
          ctx.geometry.cylinder(0.055, 0.055, height, 12),
          ctx.material(shade(color, -0.12), { preset: 'standard' })
        )
        stem.position.set(x, height / 2, 0)
        ctx.add(stem)
        // …
      })

      plan.run()
      ctx.keepAnimating()
    },
  })
}
```

渲染上下文 `ctx` 提供的都是公开能力：

| 成员 | 用途 |
| --- | --- |
| `ctx.series` / `ctx.allSeries` | 当前图表的系列（前者已按类型过滤） |
| `ctx.coord` | 坐标映射：`xAtCategory(i)`、`xAt(v)`、`yAt(v)`、`zAt(v)`、`yDomain`、`grid` |
| `ctx.geometry` | 几何体工厂：`cylinder`、`sphere`、`box`、`tube`、`extrude` |
| `ctx.material(color, opts)` | 材质工厂，自动纳入资源管理与销毁 |
| `ctx.theme` | 主题：`palette`、`colorAt(i)`、`textColor` |
| `ctx.add(obj)` | 把对象加入场景分组 |
| `ctx.anchor(...)` | 在指定世界坐标放一个 HTML 标签 |
| `ctx.pickable(obj, payload)` | 让对象可拾取（触发 tooltip / click / hover） |
| `ctx.transition` | 过渡计划：`plan.custom(...)`、`plan.fade(...)`、`plan.scaleXZ(...)`、`plan.run()` |
| `ctx.keepAnimating()` | 动画期间保持重绘 |
| `ctx.nonCartesian: true` | 声明该图表不需要笛卡尔坐标轴 |

### 2. `extendChart` —— 在既有图表上增强

```ts
export function defineBarLine3D(): ChartConstructor {
  return extendChart('bar3D', {
    type: 'barLine3D',
    afterRender(ctx) {
      const plan = ctx.transition
      const lineSeries = ctx.allSeries.filter(
        (s) => s.type === 'line3D' || /^line:/i.test(s.name ?? '')
      )
      if (!lineSeries.length) {
        plan.run()            // 没有折线时也要启动父类登记的柱子动画
        ctx.keepAnimating()
        return
      }
      // 用 tube 画平滑折线，追加到场景
      // …
    },
  })
}
```

::: details 读源码时值得注意的几个细节
- **几何体与材质都要登记**：`ctx.geometry.*` 和 `ctx.material(...)` 返回的对象会自动纳入资源跟踪，图表销毁时统一释放。自己 `new THREE.BufferGeometry()` 的话，记得配合 `ctx.resources.trackGeometry(...)`。
- **不参与拾取的对象要标记**：内置实现里给面片、描边、辅助线设了 `userData.__vtNoPick = true`，避免它们抢走 hover 与 tooltip。
- **动画要让出重绘**：`plan.run()` 和 `ctx.keepAnimating()` 必须成对出现在 `render` 的末尾，否则动画不动或持续空转。
- **`extendChart` 里必须自己启动动画**：`afterRender` 里如果提前 `return`，父类登记的柱子动画不会被启动——所以 `barLine3D` 在 `!lineSeries.length` 分支里也调了 `plan.run()`。
- **`nonCartesian: true`** 会让图表跳过坐标轴与网格的构建，`pyramid3D` 和 `ringProgress3D` 都用了它。
:::

::: warning `stepTerrain3D` 的数据是矩阵
它的 `data` 是 `number[][]`（二维矩阵，行对应 X、列对应 Z），而不是一维数组。这类图表的数据结构完全由你自己的 `defineChart` 决定——`CustomSeries` 把 `data` 放宽成 `unknown[]`，正是为了给自定义图表留出空间。
:::

## 使用建议

- **先读源码再改源码**。这 6 个文件加起来不到 700 行，是理解 `defineChart` 渲染流程性价比最高的材料。
- **按需注册**。只用一两个就传数组，避免打包体积白增——虽然定义函数很轻，但 `barLine3D` 会连带拉起 `bar3D`。
- **把它们当模板，不要当黑盒**。复制 `defineLollipop3D` 改名成自己的 `type`，是最快的自定义图表起步方式；记得 `type` 名不能与内置的 10 种冲突（`bar3D`、`line3D`、`area3D`、`pie3D`、`scatter3D`、`surface3D`、`radar3D`、`funnel3D`、`gauge3D`、`heatmap3D`）。
- **需要定制就先看有没有能 `extendChart` 的父类**。改一处细节用继承比从头写省得多，`barLine3D` 就是范例。

## 下一步

- [棒棒糖图 lollipop3D](./lollipop) — 最基础的 `defineChart` 范例
- [气泡图 bubble3D](./bubble) — 三元组数据与尺寸映射
- [渲染上下文 ctx](/custom/render-context) — `ctx` 的完整能力
