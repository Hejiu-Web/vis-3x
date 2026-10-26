# 快速开始

五分钟，从零到一个可交互的 3D 图表。

---

## 第 1 步：安装

```bash
npm install vis-3x three vue
```

---

## 第 2 步：全局注册（Vue 项目）

```ts
// main.ts
import { createApp } from 'vue'
import App from './App.vue'
import Vis3x from 'vis-3x'
import 'vis-3x/style.css'

createApp(App)
  .use(Vis3x)
  .mount('#app')
```

`.use(Vis3x)` 会一次性注册全部 11 个组件：`VisChart`、`VisBar3D`、`VisLine3D` 等。

---

## 第 3 步：写配置

<LiveChart
  type="bar3D"
  :height="420"
  caption="多系列柱状图。两个系列沿 Z 轴并排，柱子带圆角、顶盖高光与入场生长动画。"
  :option="{
    title: { show: true, text: '季度销售额', subtext: '单位：万元' },
    xAxis3D: { data: ['Q1', 'Q2', 'Q3', 'Q4'], name: '季度' },
    yAxis3D: { name: '销售额' },
    legend: { show: true, position: 'bottom' },
    tooltip: { show: true },
    series: [
      {
        type: 'bar3D',
        name: '2024 年',
        data: [120, 200, 150, 80],
        label: { show: true, precision: 0 },
      },
      {
        type: 'bar3D',
        name: '2025 年',
        data: [150, 230, 190, 120],
        label: { show: true, precision: 0 },
      },
    ],
  }"
/>

::: code-group

```vue [TypeScript]
<script setup lang="ts">
import type { Vis3xOption } from 'vis-3x'

const option: Vis3xOption = {
  title: { show: true, text: '季度销售额', subtext: '单位：万元' },
  xAxis3D: { data: ['Q1', 'Q2', 'Q3', 'Q4'], name: '季度' },
  yAxis3D: { name: '销售额' },
  legend: { show: true, position: 'bottom' },
  tooltip: { show: true },
  series: [
    {
      type: 'bar3D',
      name: '2024 年',
      data: [120, 200, 150, 80],
      label: { show: true, precision: 0 },
    },
    {
      type: 'bar3D',
      name: '2025 年',
      data: [150, 230, 190, 120],
      label: { show: true, precision: 0 },
    },
  ],
}
</script>

<template>
  <div style="height: 460px">
    <VisBar3D :option="option" />
  </div>
</template>
```

```vue [JavaScript]
<script setup>
// 纯 JavaScript：去掉 import type 与类型标注即可
const option = {
  title: { show: true, text: '季度销售额', subtext: '单位：万元' },
  xAxis3D: { data: ['Q1', 'Q2', 'Q3', 'Q4'], name: '季度' },
  yAxis3D: { name: '销售额' },
  legend: { show: true, position: 'bottom' },
  tooltip: { show: true },
  series: [
    {
      type: 'bar3D',
      name: '2024 年',
      data: [120, 200, 150, 80],
      label: { show: true, precision: 0 },
    },
    {
      type: 'bar3D',
      name: '2025 年',
      data: [150, 230, 190, 120],
      label: { show: true, precision: 0 },
    },
  ],
}
</script>

<template>
  <div style="height: 460px">
    <VisBar3D :option="option" />
  </div>
</template>
```

:::

::: warning 容器必须有高度
图表铺满父容器。如果父元素高度是 `0`（比如 `<div>` 里只有图表），什么都不会显示。

给容器一个明确高度：`style="height: 460px"`，或让它在 flex/grid 布局中撑开。
:::

这时候你应该能看到一个 3D 柱状图，能拖拽旋转、滚轮缩放，柱子带圆角与入场生长的动画。

---

## 第 4 步：接事件

```vue
<template>
  <div style="height: 460px">
    <VisBar3D :option="option" @click="onClick" @mouseover="onHover" />
  </div>
</template>

<script setup lang="ts">
function onClick(payload: {
  seriesIndex: number
  dataIndex: number
  name?: string
  seriesName?: string
  value: number | number[]
  color: string
}) {
  console.log(`点击了 ${payload.seriesName} 的 ${payload.name}，值 = ${payload.value}`)
}
</script>
```

可用事件见[事件系统](./events)。

---

## 第 5 步：让它动起来

改数据后重新传 `option` 即可。库会自动做**过渡动画**——不需要手动处理。

```vue
<script setup lang="ts">
import { ref, computed } from 'vue'

const mode = ref(0)

const option = computed<Vis3xOption>(() => ({
  xAxis3D: { data: ['Q1', 'Q2', 'Q3', 'Q4'] },
  yAxis3D: { name: '销售额' },
  series: [
    {
      type: 'bar3D',
      name: '2024 年',
      // 切换模式时数据变化，柱子会平滑过渡到新高度
      data: mode.value === 0 ? [120, 200, 150, 80] : [180, 240, 195, 310],
    },
  ],
}))
</script>

<template>
  <div>
    <button @click="mode = mode === 0 ? 1 : 0">切换数据集</button>
    <div style="height: 460px">
      <VisBar3D :option="option" />
    </div>
  </div>
</template>
```

首次渲染播放的是**入场动画**（从零生长），后续数据更新播放**过渡动画**（从旧值到新值）。

可以通过 `animation` 调整：

```ts
animation: {
  enabled: true,
  duration: 900,        // 入场时长
  updateDuration: 500,  // 更新时长（默认是 duration 的 0.6 倍）
  easing: 'cubicOut',
  stagger: 60,          // 每个数据项错开 60ms
}
```

详见[动画与过渡](./animation)。

---

## 完整示例

<script setup>
const demoTabs = ['基础柱状图', '多系列对比', '带垂幕的折线图']
</script>

### 多系列 + 堆叠

```ts
const option: Vis3xOption = {
  xAxis3D: { data: ['一月', '二月', '三月', '四月'] },
  yAxis3D: { name: '销量' },
  legend: { show: true },
  series: [
    {
      type: 'bar3D',
      name: '线上',
      stack: 'total',        // 相同 stack 名称的系列会堆叠
      data: [120, 132, 101, 134],
    },
    {
      type: 'bar3D',
      name: '线下',
      stack: 'total',
      data: [220, 182, 191, 234],
    },
  ],
}
```

### 折线图加垂幕

```ts
const option: Vis3xOption = {
  xAxis3D: { data: ['1月', '2月', '3月', '4月', '5月', '6月'] },
  yAxis3D: { name: '访问量' },
  series: [
    {
      type: 'line3D',
      name: 'PV',
      data: [820, 932, 901, 1290, 1330, 1450],
      smooth: true,
      curtain: true,        // 从折线向地面投影，增强空间感
      lineStyle: { width: 5 },
    },
  ],
}
```

`curtain: true` 会从折线每个点向下生成渐变的半透明面，是 3D 折线图最有效的「落地」手段。

---

## 下一步

- [四种使用方式](./usage-modes) — 组件之外的其他选择
- [配置项结构](./option-structure) — 系统理解 option
- [图表手册](/charts/bar) — 逐个图表看可用字段
