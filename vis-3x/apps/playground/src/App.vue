<script setup lang="ts">
/**
 * vis-3x 演示站点
 *
 * 展示三层能力：
 * 1. 内置 10 种图表（开箱即用）
 * 2. 6 种自定义扩展图表（defineChart / extendChart 注册）
 * 3. 事件、导出、主题切换、数据更新
 */
import { computed, ref, shallowRef } from 'vue'
import type { Vis3xOption, InteractionMode } from 'vis-3x'
import type { ChartBase } from 'vis-3x/core'
import { themes, type ThemeName } from 'vis-3x'

/* ------------------------------ 全局状态 ------------------------------ */

type TabKey = 'builtin' | 'custom' | 'cartesian' | 'polar' | 'special'

const activeTab = ref<TabKey>('builtin')
const themeName = ref<ThemeName>('dark')
const dynamicMode = ref(false)
const barRef = ref<{ getChart: () => ChartBase | null } | null>(null)
const eventLog = shallowRef('（点击图表中的数据元素试试）')

const months = ['1月', '2月', '3月', '4月', '5月', '6月', '7月', '8月', '9月', '10月', '11月', '12月']

const currentTheme = computed(() => themes[themeName.value])

/* ------------------------------ 1. 柱状图 ------------------------------ */

const barOption = computed<Vis3xOption>(() => ({
  title: { show: true, text: '季度销售额', subtext: '单位：万元' },
  xAxis3D: { data: ['Q1', 'Q2', 'Q3', 'Q4'], name: '季度', type: 'category' },
  yAxis3D: { name: '销售额' },
  legend: { show: true, position: 'bottom' },
  tooltip: { show: true },
  theme: currentTheme.value,
  series: [
    {
      type: 'bar3D',
      name: '2024 年',
      data: dynamicMode.value ? [180, 240, 195, 310] : [120, 200, 150, 80],
      borderRadius: 0.1,
      label: { show: true, precision: 0 },
    },
    {
      type: 'bar3D',
      name: '2025 年',
      data: dynamicMode.value ? [210, 268, 240, 355] : [150, 230, 190, 120],
      borderRadius: 0.1,
      label: { show: true, precision: 0 },
    },
  ],
  gridFloor: { show: true, showWall: true, wallOpacity: 0.12 },
  animation: { enabled: true, duration: 1000, easing: 'cubicOut', stagger: 60 },
}))

/* ------------------------------ 2. 折线图 ------------------------------ */

const lineOption = computed<Vis3xOption>(() => ({
  title: { show: true, text: '全年流量趋势', subtext: '垂幕模式增强空间感' },
  xAxis3D: { data: months, name: '月份' },
  yAxis3D: { name: '访问量' },
  legend: { show: true, position: 'bottom' },
  theme: currentTheme.value,
  series: [
    {
      type: 'line3D',
      name: 'PC 端',
      data: [820, 932, 901, 1290, 1330, 1450, 1620, 1380, 1520, 1690, 1820, 2010],
      smooth: true,
      curtain: true,
      lineStyle: { width: 4 },
    },
    {
      type: 'line3D',
      name: '移动端',
      data: [620, 732, 851, 934, 1090, 1230, 1310, 1540, 1620, 1780, 1920, 2240],
      smooth: true,
      curtain: true,
      lineStyle: { width: 4 },
    },
  ],
  gridFloor: { show: true, showWall: true, wallOpacity: 0.1 },
}))

/* ------------------------------ 3. 面积图 ------------------------------ */

const areaOption = computed<Vis3xOption>(() => ({
  title: { show: true, text: '营收构成', subtext: '面积图' },
  xAxis3D: { data: months, name: '月份' },
  yAxis3D: { name: '营收' },
  theme: currentTheme.value,
  series: [
    {
      type: 'area3D',
      name: '订阅收入',
      data: [320, 410, 380, 520, 610, 580, 690, 720, 680, 810, 860, 940],
      areaStyle: { opacity: 0.78 },
      smooth: true,
    },
  ],
  gridFloor: { show: true, showWall: true, wallOpacity: 0.12 },
}))

/* ------------------------------ 4. 饼图 ------------------------------ */

const pieOption = computed<Vis3xOption>(() => ({
  title: { show: true, text: '渠道占比', subtext: '环形 + 立体厚度' },
  legend: { show: false },
  theme: currentTheme.value,
  series: [
    {
      type: 'pie3D',
      name: '渠道',
      innerRadius: 1.3,
      radius: 3.2,
      depth: 0.9,
      padAngle: 1.6,
      data: [
        { value: 1048, name: '搜索引擎' },
        { value: 735, name: '直接访问' },
        { value: 580, name: '邮件营销' },
        { value: 484, name: '联盟广告' },
        { value: 300, name: '视频广告' },
      ],
      label: { show: true, formatter: '{name}\n{value} ({percent})', precision: 0, distance: 0.9 },
      centerLabel: { show: true, total: true, textStyle: { fontSize: 24 } },
    },
  ],
  gridFloor: { show: false },
  showCoordinate: false,
}))

/* ------------------------------ 5. 散点图 ------------------------------ */

const scatterOption = computed<Vis3xOption>(() => {
  const data: number[][] = []
  for (let i = 0; i < 60; i++) {
    const cluster = i % 3
    data.push([
      cluster * 3 - 3 + (Math.random() - 0.5) * 2.4,
      20 + Math.random() * 80 + cluster * 12,
      ((cluster + 1) % 3) * 2 - 2 + (Math.random() - 0.5) * 2.4,
    ])
  }
  return {
    title: { show: true, text: '用户分布聚类', subtext: '三维坐标散点' },
    xAxis3D: { type: 'value', name: '活跃度', min: -6, max: 6 },
    yAxis3D: { name: '消费额' },
    zAxis3D: { type: 'value', name: '留存', min: -4, max: 4 },
    legend: { show: true, position: 'bottom' },
    theme: currentTheme.value,
    series: [
      {
        type: 'scatter3D',
        name: '用户样本',
        data,
        pointStyle: { symbol: 'sphere', sizeRange: [0.12, 0.32] },
      },
    ],
    gridFloor: { show: true, showWall: true, wallOpacity: 0.09 },
  }
})

/* ------------------------------ 6. 曲面图 ------------------------------ */

const surfaceOption = computed<Vis3xOption>(() => {
  const rows = 24
  const cols = 24
  const matrix: number[][] = []
  for (let r = 0; r < rows; r++) {
    const row: number[] = []
    for (let c = 0; c < cols; c++) {
      const x = (c / (cols - 1)) * 4 - 2
      const z = (r / (rows - 1)) * 4 - 2
      row.push(
        Number(
          (
            Math.sin(x * 1.6) * Math.cos(z * 1.6) * 3 +
            Math.exp(-(x * x + z * z) / 1.4) * 4 +
            2
          ).toFixed(3)
        )
      )
    }
    matrix.push(row)
  }
  return {
    title: { show: true, text: '地形高程曲面', subtext: '顶点色映射 + 侧壁 + 等高线' },
    xAxis3D: { type: 'value', name: '经度', min: -2, max: 2 },
    zAxis3D: { type: 'value', name: '纬度', min: -2, max: 2 },
    yAxis3D: { name: '高程' },
    theme: currentTheme.value,
    series: [
      {
        type: 'surface3D',
        name: '高程',
        data: matrix,
        colorGradient: ['#1e3a8a', '#0ea5e9', '#22d3ee', '#34d399', '#fde047', '#fb923c', '#ef4444'],
        wireframe: { show: true, opacity: 0.16, step: 3 },
        contour: { show: true, levels: 6, opacity: 0.3 },
        smoothSubdivision: 2,
      },
    ],
    gridFloor: { show: true, showWall: true, wallOpacity: 0.1 },
  }
})

/* ------------------------------ 7. 热力图 ------------------------------ */

const heatmapOption = computed<Vis3xOption>(() => {
  const days = ['周一', '周二', '周三', '周四', '周五', '周六', '周日']
  const hours = ['0-4', '4-8', '8-12', '12-16', '16-20', '20-24']
  const data: Array<[number, number, number]> = []
  for (let d = 0; d < days.length; d++) {
    for (let h = 0; h < hours.length; h++) {
      const isWeekend = d >= 5
      const peak = h === 2 || h === 4 ? 1.5 : h === 1 || h === 5 ? 0.7 : 0.45
      data.push([h, d, Math.round((isWeekend ? 62 : 48) * peak + Math.random() * 22)])
    }
  }
  return {
    title: { show: true, text: '时段活跃热力', subtext: '高度 + 颜色双映射' },
    xAxis3D: { data: hours, name: '时段', type: 'category' },
    zAxis3D: { data: days, name: '星期', type: 'category' },
    yAxis3D: { name: '活跃度', min: 0 },
    legend: { show: false },
    theme: currentTheme.value,
    series: [
      {
        type: 'heatmap3D',
        name: '活跃度',
        data,
        xAxisData: hours,
        zAxisData: days,
        colorGradient: ['#0f2a5e', '#0ea5e9', '#22d3ee', '#34d399', '#fde047', '#f97316'],
        tileRatio: 0.88,
      },
    ],
    gridFloor: { show: true, showWall: true, wallOpacity: 0.1 },
  }
})

/* ------------------------------ 8. 雷达图 ------------------------------ */

const radarOption = computed<Vis3xOption>(() => ({
  title: { show: true, text: '综合能力评估', subtext: '立体雷达' },
  legend: { show: true, position: 'bottom' },
  theme: currentTheme.value,
  radar: {
    indicator: [
      { name: '性能', max: 100 },
      { name: '易用性', max: 100 },
      { name: '生态', max: 100 },
      { name: '文档', max: 100 },
      { name: '扩展性', max: 100 },
      { name: '稳定性', max: 100 },
    ],
    splitNumber: 4,
    startAngle: 90,
    splitArea: { show: true, opacity: 0.5 },
  },
  series: [
    {
      type: 'radar3D',
      name: '方案 A',
      data: [{ name: '方案 A', value: [85, 92, 78, 88, 74, 90] }],
      areaStyle: { opacity: 0.42 },
      showPoint: true,
    },
  ],
  gridFloor: { show: false },
  showCoordinate: false,
}))

/* ------------------------------ 9. 漏斗图 ------------------------------ */

const funnelOption = computed<Vis3xOption>(() => ({
  title: { show: true, text: '转化漏斗', subtext: '3D 漏斗' },
  legend: { show: true, position: 'right' },
  theme: currentTheme.value,
  series: [
    {
      type: 'funnel3D',
      name: '转化',
      data: [
        { value: 100, name: '曝光' },
        { value: 78, name: '点击' },
        { value: 52, name: '加购' },
        { value: 34, name: '下单' },
        { value: 21, name: '支付' },
      ],
      height: 6.4,
      width: 5.4,
      depth: 1.7,
      gap: 0.18,
      minSize: 0.26,
      label: { show: true, formatter: '{name} {value}', distance: 0.3 },
    },
  ],
  gridFloor: { show: false },
  showCoordinate: false,
}))

/* ------------------------------ 10. 仪表盘 ------------------------------ */

const gaugeOption = computed<Vis3xOption>(() => ({
  title: { show: true, text: '系统健康度', subtext: '3D 仪表盘' },
  theme: currentTheme.value,
  series: [
    {
      type: 'gauge3D',
      name: '健康度',
      min: 0,
      max: 100,
      data: [{ value: dynamicMode.value ? 92 : 73 }],
      radius: 3.4,
      axisWidth: 0.62,
      depth: 0.5,
      splitNumber: 5,
      detail: { show: true, formatter: '{value}', fontSize: 30 },
      axisTick: { show: true, length: 0.24 },
      pointer: { show: true, color: '#f8fafc' },
    },
  ],
  gridFloor: { show: false },
  showCoordinate: false,
  animation: { enabled: true, duration: 1400, easing: 'cubicOut' },
}))

/**
 * 自定义图表类型名断言
 *
 * `ChartType` 已联合了 `string & {}`，所以自定义类型名本可以直接写字符串。
 * 这里保留一个显式辅助函数，是为了在 demo 中清楚地标示
 * 「这个类型不是内置的，而是通过 defineChart/extendChart 注册的」。
 *
 * 使用者的两种做法：
 * 1. 直接写字符串：`type: 'lollipop3D'`（配合 ChartType 的 string 联合即可）
 * 2. 用 `declare module 'vis-3x'` 扩展 ChartType，获得完整补全
 */
const custom = (type: string): string => type

/* --------------------------- 11. 自定义：棒棒糖图 --------------------------- */

const lollipopOption = computed<Vis3xOption>(() => ({
  title: { show: true, text: '各渠道转化率', subtext: 'defineChart 自定义 · lollipop3D' },
  xAxis3D: { data: ['搜索', '社交', '邮件', '直访', '联盟', '视频'], name: '渠道' },
  yAxis3D: { name: '转化率 %' },
  theme: currentTheme.value,
  series: [
    {
      type: custom('lollipop3D'),
      name: '转化率',
      data: [38, 52, 24, 61, 33, 45],
      label: { show: true, suffix: '%', precision: 0 },
    },
  ],
  gridFloor: { show: true, showWall: true, wallOpacity: 0.1 },
}))

/* --------------------------- 12. 自定义：气泡图 --------------------------- */

const bubbleOption = computed<Vis3xOption>(() => {
  const data: number[][] = []
  for (let i = 0; i < 40; i++) {
    data.push([(Math.random() - 0.5) * 8, 15 + Math.random() * 85, (Math.random() - 0.5) * 5])
  }
  return {
    title: { show: true, text: '三维气泡分布', subtext: 'defineChart 自定义 · bubble3D' },
    xAxis3D: { type: 'value', name: 'X', min: -5, max: 5 },
    yAxis3D: { name: 'Y' },
    zAxis3D: { type: 'value', name: 'Z', min: -3, max: 3 },
    theme: currentTheme.value,
    series: [
      {
        type: custom('bubble3D'),
        name: '样本',
        data,
        pointStyle: { sizeRange: [0.14, 0.42] },
      },
    ],
    gridFloor: { show: true, showWall: true, wallOpacity: 0.09 },
  }
})

/* ------------------------- 13. 自定义：柱线组合图 ------------------------- */

const barLineOption = computed<Vis3xOption>(() => ({
  // 必须显式声明 type：否则 VisChart 会按首个系列推断成 bar3D，
  // 而我们需要的是扩展后的 barLine3D。
  type: custom('barLine3D'),
  title: { show: true, text: '销量与趋势线', subtext: 'extendChart 扩展 bar3D · barLine3D' },
  xAxis3D: { data: months.slice(0, 8), name: '月份' },
  yAxis3D: { name: '销量' },
  legend: { show: true, position: 'bottom' },
  theme: currentTheme.value,
  series: [
    {
      type: custom('bar3D'),
      name: '销量',
      data: [320, 410, 380, 520, 610, 580, 690, 720],
      borderRadius: 0.08,
    },
    {
      // 约定：name 以 "line:" 开头的系列会被渲染成折线
      type: custom('line3D'),
      name: 'line:趋势',
      data: [340, 400, 420, 500, 590, 620, 660, 760],
    },
  ],
  gridFloor: { show: true, showWall: true, wallOpacity: 0.1 },
}))

/* --------------------------- 14. 自定义：金字塔图 --------------------------- */

const pyramidOption = computed<Vis3xOption>(() => ({
  title: { show: true, text: '用户分层金字塔', subtext: 'defineChart 自定义 · pyramid3D' },
  legend: { show: true, position: 'right' },
  theme: currentTheme.value,
  series: [
    {
      type: custom('pyramid3D'),
      name: '用户分层',
      data: [
        { value: 1000, name: '浏览' },
        { value: 620, name: '注册' },
        { value: 340, name: '活跃' },
        { value: 180, name: '付费' },
        { value: 72, name: '复购' },
      ],
      label: { show: true, formatter: '{name} {value}', distance: 0.3 },
    },
  ],
  gridFloor: { show: false },
  showCoordinate: false,
}))

/* --------------------------- 15. 自定义：环形进度 --------------------------- */

const ringOption = computed<Vis3xOption>(() => ({
  title: { show: true, text: '多指标达成率', subtext: 'defineChart 自定义 · ringProgress3D' },
  theme: currentTheme.value,
  series: [
    {
      type: custom('ringProgress3D'),
      name: '达成率',
      data: [
        { value: 86, name: '营收' },
        { value: 72, name: '用户' },
        { value: 64, name: '留存' },
        { value: 45, name: '转化' },
      ],
      label: { show: true, formatter: '{value}%', precision: 0 },
    },
  ],
  gridFloor: { show: false },
  showCoordinate: false,
}))

/* --------------------------- 16. 自定义：阶梯地形 --------------------------- */

const terrainOption = computed<Vis3xOption>(() => {
  const rows = 12
  const cols = 12
  const matrix: number[][] = []
  for (let r = 0; r < rows; r++) {
    const row: number[] = []
    for (let c = 0; c < cols; c++) {
      const x = (c / (cols - 1)) * 3 - 1.5
      const z = (r / (rows - 1)) * 3 - 1.5
      row.push(Number((Math.sin(x * 2) * Math.cos(z * 2) * 5 + 8).toFixed(2)))
    }
    matrix.push(row)
  }
  return {
    title: { show: true, text: '阶梯地形', subtext: 'defineChart 自定义 · stepTerrain3D' },
    xAxis3D: { type: 'value', min: -1.5, max: 1.5 },
    zAxis3D: { type: 'value', min: -1.5, max: 1.5 },
    yAxis3D: { name: '高度' },
    theme: currentTheme.value,
    series: [
      {
        type: custom('stepTerrain3D'),
        name: '地形',
        data: matrix,
        colorGradient: ['#0f2a5e', '#0ea5e9', '#34d399', '#fde047', '#f97316'],
      },
    ],
    gridFloor: { show: true, showWall: true, wallOpacity: 0.1 },
  }
})

/* ------------------------------ 交互逻辑 ------------------------------ */

function handleClick(payload: {
  name?: string
  value: number | number[]
  seriesName?: string
}) {
  const v = Array.isArray(payload.value)
    ? payload.value.map((x) => Number(x).toFixed(1)).join(', ')
    : payload.value
  eventLog.value = `点击「${payload.seriesName ?? '系列'}」→ ${payload.name ?? '-'} = ${v}`
}

function exportChart() {
  const chart = barRef.value?.getChart?.()
  if (!chart) return
  const link = document.createElement('a')
  link.href = chart.exportImage({ scale: 2 })
  link.download = 'vis-3x-bar3d.png'
  link.click()
}

const tabs: Array<{ key: TabKey; label: string }> = [
  { key: 'builtin', label: '内置图表' },
  { key: 'custom', label: '自定义图表 ✨' },
  { key: 'cartesian', label: '笛卡尔系' },
  { key: 'polar', label: '非笛卡尔系' },
  { key: 'special', label: '特殊图表' },
]

const themeOptions: Array<{ key: ThemeName; label: string }> = [
  { key: 'dark', label: '暗色' },
  { key: 'light', label: '亮色' },
  { key: 'blue', label: '深蓝' },
  { key: 'warm', label: '暖色' },
  { key: 'mono', label: '灰白' },
]

/* ---------------------------- 视角交互模式 ---------------------------- */

/**
 * 三种交互模式：
 * - free   自由视角（旋转 + 缩放 + 平移）
 * - rotate 仅旋转
 * - fixed  固定视角（完全锁定）
 */
const interactionMode = ref<InteractionMode>('free')

const modeOptions: Array<{ key: InteractionMode; label: string; hint: string }> = [
  { key: 'free', label: '自由视角', hint: '旋转 + 缩放 + 平移' },
  { key: 'rotate', label: '仅旋转', hint: '锁定远近与位置' },
  { key: 'fixed', label: '固定视角', hint: '完全锁定视角' },
]

/** 把模式注入到每个图表的 controlSettings */
const withMode = (option: Vis3xOption): Vis3xOption => ({
  ...option,
  controlSettings: {
    ...(option.controlSettings ?? {}),
    interactionMode: interactionMode.value,
  },
})

const show = (keys: TabKey[]) => keys.includes(activeTab.value)
</script>

<template>
  <div class="hero">
    <h1>vis-3x · 3D 图表库</h1>
    <p>
      基于 <strong>Vue 3 + TypeScript + Three.js</strong> · 10 种内置图表 + 6 种自定义扩展示例 ·
      支持组件 / 组合式 / 纯 JS 三种用法
    </p>
  </div>

  <div class="controls">
    <button
      v-for="tab in tabs"
      :key="tab.key"
      class="chip"
      :class="{ active: activeTab === tab.key }"
      @click="activeTab = tab.key"
    >
      {{ tab.label }}
    </button>
    <div class="actions">
      <button class="chip" @click="dynamicMode = !dynamicMode">
        {{ dynamicMode ? '✓ 数据已更新' : '切换数据集' }}
      </button>
      <button class="chip" @click="exportChart">导出 PNG</button>
    </div>
  </div>

  <div class="controls controls--tight">
    <span class="label">主题：</span>
    <button
      v-for="t in themeOptions"
      :key="t.key"
      class="chip"
      :class="{ active: themeName === t.key }"
      @click="themeName = t.key"
    >
      {{ t.label }}
    </button>
  </div>

  <div class="controls controls--tight">
    <span class="label">视角交互：</span>
    <button
      v-for="m in modeOptions"
      :key="m.key"
      class="chip"
      :class="{ active: interactionMode === m.key }"
      :title="m.hint"
      @click="interactionMode = m.key"
    >
      {{ m.label }}
    </button>
    <span class="label" style="margin-left: 8px">
      {{
        interactionMode === 'fixed'
          ? '🔒 视角已锁定，试试拖动图表'
          : interactionMode === 'rotate'
            ? '🔄 可旋转，但缩放/平移已禁用'
            : '✋ 可自由旋转、缩放、平移'
      }}
    </span>
  </div>

  <div class="grid">
    <!-- ============================ 自定义图表区 ============================ -->
    <template v-if="show(['custom'])">
      <div class="card full banner">
        <div class="banner__inner">
          <strong>✨ 自定义图表</strong>
          <span>
            以下 6 个图表由使用者通过公开 API <code>defineChart()</code> /
            <code>extendChart()</code> 定义并注册 —— 与第三方扩展能力完全一致。
            源码见 <code>packages/vis-3x/src/presets/extra-charts.ts</code>。
          </span>
        </div>
      </div>

      <div class="card">
        <div class="card__head">
          <span class="card__title">① 棒棒糖图</span>
          <span class="card__tag">defineChart</span>
        </div>
        <div class="card__body"><VisChart :option="withMode(lollipopOption)" @click="handleClick" /></div>
      </div>

      <div class="card">
        <div class="card__head">
          <span class="card__title">② 3D 气泡图</span>
          <span class="card__tag">defineChart</span>
        </div>
        <div class="card__body"><VisChart :option="withMode(bubbleOption)" @click="handleClick" /></div>
      </div>

      <div class="card">
        <div class="card__head">
          <span class="card__title">③ 柱线组合图</span>
          <span class="card__tag">extendChart</span>
        </div>
        <div class="card__body"><VisChart :option="withMode(barLineOption)" @click="handleClick" /></div>
      </div>

      <div class="card">
        <div class="card__head">
          <span class="card__title">④ 金字塔图</span>
          <span class="card__tag">defineChart</span>
        </div>
        <div class="card__body"><VisChart :option="withMode(pyramidOption)" @click="handleClick" /></div>
      </div>

      <div class="card">
        <div class="card__head">
          <span class="card__title">⑤ 多环进度图</span>
          <span class="card__tag">defineChart</span>
        </div>
        <div class="card__body"><VisChart :option="withMode(ringOption)" @click="handleClick" /></div>
      </div>

      <div class="card">
        <div class="card__head">
          <span class="card__title">⑥ 阶梯地形图</span>
          <span class="card__tag">defineChart</span>
        </div>
        <div class="card__body"><VisChart :option="withMode(terrainOption)" @click="handleClick" /></div>
      </div>
    </template>

    <!-- ============================ 内置图表区 ============================ -->
    <template v-if="show(['builtin'])">
      <div class="card full">
        <div class="card__head">
          <span class="card__title">① 3D 柱状图 · 多系列 + 圆角 + 生长动画</span>
          <span class="card__tag">&lt;VisBar3D&gt;</span>
        </div>
        <div class="card__body card__body--wide">
          <VisBar3D ref="barRef" :option="withMode(barOption)" @click="handleClick" />
        </div>
        <div class="card__foot">事件回调：{{ eventLog }}</div>
      </div>

      <div class="card">
        <div class="card__head">
          <span class="card__title">② 3D 折线图 · 平滑 + 垂幕</span>
          <span class="card__tag">&lt;VisLine3D&gt;</span>
        </div>
        <div class="card__body"><VisLine3D :option="withMode(lineOption)" /></div>
      </div>

      <div class="card">
        <div class="card__head">
          <span class="card__title">③ 3D 面积图</span>
          <span class="card__tag">&lt;VisArea3D&gt;</span>
        </div>
        <div class="card__body"><VisArea3D :option="withMode(areaOption)" /></div>
      </div>

      <div class="card">
        <div class="card__head">
          <span class="card__title">④ 3D 散点图 · 三维坐标</span>
          <span class="card__tag">&lt;VisScatter3D&gt;</span>
        </div>
        <div class="card__body"><VisScatter3D :option="withMode(scatterOption)" /></div>
      </div>

      <div class="card">
        <div class="card__head">
          <span class="card__title">⑤ 3D 曲面图</span>
          <span class="card__tag">&lt;VisSurface3D&gt;</span>
        </div>
        <div class="card__body"><VisSurface3D :option="withMode(surfaceOption)" /></div>
      </div>

      <div class="card">
        <div class="card__head">
          <span class="card__title">⑥ 3D 热力图</span>
          <span class="card__tag">&lt;VisHeatmap3D&gt;</span>
        </div>
        <div class="card__body"><VisHeatmap3D :option="withMode(heatmapOption)" /></div>
      </div>

      <div class="card">
        <div class="card__head">
          <span class="card__title">⑦ 3D 环形饼图</span>
          <span class="card__tag">&lt;VisPie3D&gt;</span>
        </div>
        <div class="card__body"><VisPie3D :option="withMode(pieOption)" /></div>
      </div>

      <div class="card">
        <div class="card__head">
          <span class="card__title">⑧ 3D 雷达图</span>
          <span class="card__tag">&lt;VisRadar3D&gt;</span>
        </div>
        <div class="card__body"><VisRadar3D :option="withMode(radarOption)" /></div>
      </div>

      <div class="card">
        <div class="card__head">
          <span class="card__title">⑨ 3D 漏斗图</span>
          <span class="card__tag">&lt;VisFunnel3D&gt;</span>
        </div>
        <div class="card__body"><VisFunnel3D :option="withMode(funnelOption)" /></div>
      </div>

      <div class="card">
        <div class="card__head">
          <span class="card__title">⑩ 3D 仪表盘</span>
          <span class="card__tag">&lt;VisGauge3D&gt;</span>
        </div>
        <div class="card__body"><VisGauge3D :option="withMode(gaugeOption)" /></div>
      </div>
    </template>

    <!-- ============================ 笛卡尔系 ============================ -->
    <template v-if="show(['cartesian'])">
      <div class="card full">
        <div class="card__head">
          <span class="card__title">柱状图</span><span class="card__tag">bar3D</span>
        </div>
        <div class="card__body card__body--wide">
          <VisBar3D :option="withMode(barOption)" @click="handleClick" />
        </div>
        <div class="card__foot">事件回调：{{ eventLog }}</div>
      </div>
      <div class="card">
        <div class="card__head"><span class="card__title">折线图</span><span class="card__tag">line3D</span></div>
        <div class="card__body"><VisLine3D :option="withMode(lineOption)" /></div>
      </div>
      <div class="card">
        <div class="card__head"><span class="card__title">面积图</span><span class="card__tag">area3D</span></div>
        <div class="card__body"><VisArea3D :option="withMode(areaOption)" /></div>
      </div>
      <div class="card">
        <div class="card__head"><span class="card__title">散点图</span><span class="card__tag">scatter3D</span></div>
        <div class="card__body"><VisScatter3D :option="withMode(scatterOption)" /></div>
      </div>
      <div class="card">
        <div class="card__head"><span class="card__title">曲面图</span><span class="card__tag">surface3D</span></div>
        <div class="card__body"><VisSurface3D :option="withMode(surfaceOption)" /></div>
      </div>
      <div class="card">
        <div class="card__head"><span class="card__title">热力图</span><span class="card__tag">heatmap3D</span></div>
        <div class="card__body"><VisHeatmap3D :option="withMode(heatmapOption)" /></div>
      </div>
    </template>

    <!-- ============================ 非笛卡尔 ============================ -->
    <template v-if="show(['polar'])">
      <div class="card">
        <div class="card__head"><span class="card__title">环形饼图</span><span class="card__tag">pie3D</span></div>
        <div class="card__body"><VisPie3D :option="withMode(pieOption)" /></div>
      </div>
      <div class="card">
        <div class="card__head"><span class="card__title">雷达图</span><span class="card__tag">radar3D</span></div>
        <div class="card__body"><VisRadar3D :option="withMode(radarOption)" /></div>
      </div>
    </template>

    <!-- ============================ 特殊图表 ============================ -->
    <template v-if="show(['special'])">
      <div class="card">
        <div class="card__head"><span class="card__title">漏斗图</span><span class="card__tag">funnel3D</span></div>
        <div class="card__body"><VisFunnel3D :option="withMode(funnelOption)" /></div>
      </div>
      <div class="card">
        <div class="card__head"><span class="card__title">仪表盘</span><span class="card__tag">gauge3D</span></div>
        <div class="card__body"><VisGauge3D :option="withMode(gaugeOption)" /></div>
      </div>
    </template>
  </div>

  <footer>
    vis-3x · MIT License · 基于 Vue 3 + Three.js 构建<br />
    拖拽旋转 · 滚轮缩放 · 右键平移 · 点击/悬停查看数据
  </footer>
</template>

<style scoped>
.controls--tight {
  margin-top: -12px;
}
.label {
  font-size: 12px;
  color: var(--muted);
  align-self: center;
}
.banner {
  background: linear-gradient(100deg, rgba(79, 140, 255, 0.14), rgba(34, 211, 238, 0.08));
  border-color: rgba(79, 140, 255, 0.35);
}
.banner__inner {
  display: flex;
  flex-direction: column;
  gap: 6px;
  padding: 16px 20px;
  font-size: 13px;
  line-height: 1.7;
  color: var(--muted);
}
.banner__inner strong {
  color: #dbeafe;
  font-size: 14px;
}
.banner__inner code {
  padding: 1px 6px;
  border-radius: 4px;
  background: rgba(79, 140, 255, 0.16);
  color: #bfdbfe;
  font-family: ui-monospace, monospace;
  font-size: 12px;
}
</style>
