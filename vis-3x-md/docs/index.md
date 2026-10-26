---
layout: home

hero:
  name: vis-3x
  text: 3D 图表库
  tagline: 基于 Vue 3 + TypeScript + Three.js。10 种开箱即用的 3D 图表，以及一套像 ECharts 一样自由的扩展 API。
  actions:
    - theme: brand
      text: 快速开始
      link: /guide/quick-start
    - theme: alt
      text: 浏览图表
      link: /charts/bar
    - theme: alt
      text: 自定义图表
      link: /custom/

features:
  - icon: 📊
    title: 10 种内置 3D 图表
    details: 柱状、折线、面积、饼图、散点、曲面、雷达、漏斗、仪表盘、热力图。每种都针对 3D 空间单独设计，而不是给 2D 图表加厚度。
  - icon: 🧩
    title: 像 ECharts 一样扩展
    details: defineChart 函数式定义、extendChart 继承改写、registerChart 注册类、插件系统打包复用。四种方式覆盖从「改一点」到「完全从零」。
  - icon: ⚡
    title: 四种使用方式
    details: Vue 组件、组合式 API、纯 JavaScript、CDN script 标签。同一个渲染内核，换用法不用重写代码。
  - icon: 🎬
    title: 统一的过渡动画
    details: 入场生长与数据更新过渡都有内置动画，支持逐项错峰与 10 种缓动函数。自定义图表通过 ctx.transition 使用同一套系统。
  - icon: 🎯
    title: 相机与数据交互分离
    details: interactionMode 可锁定视角，但悬停高亮、点击事件、提示框依然可用。适合投屏展示场景。
  - icon: 🔒
    title: 类型完备
    details: "series 是可辨识联合——写对 type 就会自动收窄到对应图表的全部可用字段。"
---

## 一段代码看清楚

```vue
<script setup lang="ts">
import type { Vis3xOption } from 'vis-3x'

const option: Vis3xOption = {
  xAxis3D: { data: ['Q1', 'Q2', 'Q3', 'Q4'] },
  yAxis3D: { name: '销售额' },
  legend: { show: true },
  tooltip: { show: true },
  series: [
    { type: 'bar3D', name: '2024 年', data: [120, 200, 150, 80] },
    { type: 'bar3D', name: '2025 年', data: [150, 230, 190, 120] },
  ],
}
</script>

<template>
  <div style="height: 460px">
    <VisBar3D :option="option" />
  </div>
</template>
```

这段配置得到的是一个可旋转、可缩放、带悬停提示与点击事件的 3D 柱状图。柱体有圆角、顶面高光与入场生长动画，地面有网格与阴影承接面。光照、材质、标签定位、资源回收都由库处理。

## 从哪开始读

| 你的情况 | 建议起点 |
|---|---|
| 第一次接触 | [简介](/guide/introduction) → [快速开始](/guide/quick-start) |
| 要选一个图表类型 | [图表手册](/charts/bar) |
| 内置图表不够用 | [自定义图表](/custom/define-chart) |
| 从 ECharts 迁移过来 | [迁移指南](/guide/migrate-from-echarts) |
| 要查具体字段 | [API 参考](/api/option) |

## 相关链接

<script setup>
import { PLAYGROUND_URL, REPO_URL } from './.vitepress/site-config'
</script>

- <a :href="PLAYGROUND_URL">在线演示 Playground</a> — 26 个图表的可交互示例
- <a :href="REPO_URL">GitHub 仓库</a>
- [更新日志](/changelog)
