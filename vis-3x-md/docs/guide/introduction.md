# 简介

> vis-3x 是一个基于 **Vue 3 + TypeScript + Three.js** 的 3D 数据可视化图表库。

它想解决的问题很具体：**在 Web 上做 3D 图表，要么太麻烦，要么太死板。**

直接写 Three.js，意味着你要自己管相机、光照、坐标映射、标签定位、资源释放，几百行代码才能画出一组柱子。用现成的 3D 图表库，又常常被它支持的图表类型框住，想加一个自己需要的形式只能改源码。

vis-3x 的取舍是：**开箱即用的部分做到位，不确定的部分留出接口。**

---

## 它能做什么

<div class="vx-grid">
  <div class="vx-card">
    <h4>10 种内置 3D 图表</h4>
    <p>柱状、折线、面积、饼图、散点、曲面、雷达、漏斗、仪表盘、热力图。每种都针对 3D 空间单独设计，不是给 2D 图表加厚度。</p>
  </div>
  <div class="vx-card">
    <h4>四种使用方式</h4>
    <p>Vue 组件、组合式 API、纯 JavaScript、CDN script 标签。同一个渲染内核，换用法不用重写。</p>
  </div>
  <div class="vx-card">
    <h4>自由的扩展 API</h4>
    <p><code>defineChart</code> 函数式定义、<code>extendChart</code> 继承改写、<code>registerChart</code> 注册类、插件系统打包复用。</p>
  </div>
  <div class="vx-card">
    <h4>完整的 TS 类型</h4>
    <p><code>series</code> 是可辨识联合，写 <code>type: 'bar3D'</code> 就会自动收窄到柱状图的全部可用字段。</p>
  </div>
</div>

---

## 一段代码看清楚

这段配置得到的就是下面这个图表——它是**真实运行的实例**，不是截图。拖拽旋转、滚轮缩放，把鼠标移到柱子上看提示框：

<LiveChart
  type="bar3D"
  :height="420"
  caption="上面的配置渲染出的实际效果。两个系列沿 Z 轴并排，柱体带圆角与顶面高光，地面有网格与阴影承接面。"
  :option="{
    xAxis3D: { data: ['Q1', 'Q2', 'Q3', 'Q4'] },
    yAxis3D: { name: '销售额' },
    legend: { show: true, position: 'bottom' },
    tooltip: { show: true },
    series: [
      { type: 'bar3D', name: '2024', data: [120, 200, 150, 80] },
      { type: 'bar3D', name: '2025', data: [150, 230, 190, 120] },
    ],
  }"
/>

::: code-group

```vue [TypeScript]
<script setup lang="ts">
import type { Vis3xOption } from 'vis-3x'

const option: Vis3xOption = {
  xAxis3D: { data: ['Q1', 'Q2', 'Q3', 'Q4'] },
  yAxis3D: { name: '销售额' },
  legend: { show: true },
  tooltip: { show: true },
  series: [
    { type: 'bar3D', name: '2024', data: [120, 200, 150, 80] },
    { type: 'bar3D', name: '2025', data: [150, 230, 190, 120] },
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
  xAxis3D: { data: ['Q1', 'Q2', 'Q3', 'Q4'] },
  yAxis3D: { name: '销售额' },
  legend: { show: true },
  tooltip: { show: true },
  series: [
    { type: 'bar3D', name: '2024', data: [120, 200, 150, 80] },
    { type: 'bar3D', name: '2025', data: [150, 230, 190, 120] },
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

柱体有圆角、顶面高光、入场生长动画，地面有网格与阴影承接面。光照、材质、标签定位、资源回收这些都由库处理。

---

## 设计取向

有几个决定值得说明，因为它们解释了库的行为方式：

**配置驱动，而不是命令式 API 堆叠。** 你描述「要画什么」，库负责「怎么画」。这与 ECharts 的思路一致，好处是配置可以被序列化、对比、回放——做图表编辑器或存到数据库里都很自然。

**按需渲染是默认行为。** 场景静止时停止重绘。挂在大屏上跑一整天的图表，不会持续占用 GPU。

**相机交互与数据交互分离。** `controlSettings.interactionMode` 可以锁定视角，但**悬停高亮、点击事件、提示框依然可用**。这在做投屏展示时很有用：观众不能转视角，但仍能点开数据。

**扩展是一等公民。** 内置的 6 个示例图表（棒棒糖图、气泡图、柱线组合图等）**就是用公开 API 实现的**，源码在 `presets/extra-charts.ts`，可以直接当作扩展范例读。

---

## 浏览器与依赖要求

| 项目 | 要求 |
|---|---|
| Node.js | >= 18 |
| Vue | >= 3.3（**仅使用组件时需要**） |
| Three.js | >= 0.160 |
| 浏览器 | 支持 WebGL 2 |

::: tip 不装 Vue 也能用
命令式 API（`createChart`）与核心引擎不依赖 Vue 运行时。
如果你只是想在普通网页里放一个 3D 图表，装 `vis-3x` + `three` 就够了。
:::

---

## 下一步

- [安装](./installation) — 把库装进你的项目
- [快速开始](./quick-start) — 五分钟画出第一个图表
- [四种使用方式](./usage-modes) — 找到适合你的用法
- [自定义图表](/custom/define-chart) — 从零定义一个图表类型

---

<style>
.vx-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(260px, 1fr));
  gap: 14px;
  margin: 24px 0;
}

.vx-card {
  border: 1px solid var(--vp-c-divider);
  border-radius: 12px;
  padding: 18px 20px;
  background: var(--vp-c-bg-soft);
}

.vx-card h4 {
  margin: 0 0 8px;
  font-size: 14.5px;
  font-weight: 700;
  color: var(--vp-c-text-1);
  border: none;
  padding: 0;
}

.vx-card p {
  margin: 0;
  font-size: 13px;
  line-height: 1.7;
  color: var(--vp-c-text-2);
}
</style>
