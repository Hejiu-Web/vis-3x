<script setup lang="ts">
/**
 * 首页 Hero：可交互 3D 图表舞台
 *
 * - 左侧：品牌信息 + CTA
 * - 右侧：真实运行的 vis-3x 图表，可切换图表类型、数据集，可拖拽旋转
 *
 * 这里刻意使用「真实图表」而不是截图或装饰性 WebGL：
 * 访客第一眼看到的就是这个库的实际输出。
 */
import { computed, onBeforeUnmount, onMounted, ref, shallowRef } from 'vue'
import { themes, type Vis3xOption, type ThemeName } from 'vis-3x'
import { docsUrl } from '../site-config'

/* ------------------------------ 图表类型切换 ------------------------------ */

type DemoKey = 'bar3D' | 'surface3D' | 'pie3D' | 'radar3D' | 'line3D' | 'gauge3D'

interface DemoEntry {
  key: DemoKey
  label: string
  tag: string
  desc: string
  build: (dynamic: boolean) => Vis3xOption
}

const months = ['1月', '2月', '3月', '4月', '5月', '6月', '7月', '8月', '9月', '10月', '11月', '12月']

/** 生成一个「双峰」曲面矩阵 */
function buildSurface(seed: number): number[][] {
  const rows = 22
  const cols = 22
  const m: number[][] = []
  for (let r = 0; r < rows; r++) {
    const row: number[] = []
    for (let c = 0; c < cols; c++) {
      const x = (c / (cols - 1)) * 4 - 2
      const z = (r / (rows - 1)) * 4 - 2
      const v =
        Math.sin(x * 1.7 + seed) * Math.cos(z * 1.7) * 2.6 +
        Math.exp(-(x * x + z * z) / 1.5) * 4 +
        2.5
      row.push(Number(v.toFixed(3)))
    }
    m.push(row)
  }
  return m
}

const DEMOS: DemoEntry[] = [
  {
    key: 'bar3D',
    label: '柱状图',
    tag: 'bar3D',
    desc: '多系列 / 堆叠 / 圆角 / 生长动画',
    build: (d) => ({
      type: 'bar3D',
      xAxis3D: { data: ['Q1', 'Q2', 'Q3', 'Q4'], name: '季度' },
      yAxis3D: { name: '销售额' },
      legend: { show: true, position: 'bottom' },
      theme: themes.dark,
      series: [
        {
          type: 'bar3D',
          name: '2024',
          data: d ? [180, 240, 195, 310] : [120, 200, 150, 80],
          borderRadius: 0.08,
        },
        {
          type: 'bar3D',
          name: '2025',
          data: d ? [210, 268, 240, 355] : [150, 230, 190, 120],
          borderRadius: 0.08,
        },
      ],
      gridFloor: { show: true, showWall: true, wallOpacity: 0.12 },
      animation: { enabled: true, duration: 900, easing: 'cubicOut', stagger: 55 },
    }),
  },
  {
    key: 'surface3D',
    label: '曲面图',
    tag: 'surface3D',
    desc: '顶点色映射 / 线框 / 等高线',
    build: (d) => ({
      type: 'surface3D',
      xAxis3D: { type: 'value', name: '经度', min: -2, max: 2 },
      zAxis3D: { type: 'value', name: '纬度', min: -2, max: 2 },
      yAxis3D: { name: '高程' },
      theme: themes.dark,
      series: [
        {
          type: 'surface3D',
          name: '高程',
          data: buildSurface(d ? 1.6 : 0),
          colorGradient: ['#1e3a8a', '#0ea5e9', '#22d3ee', '#34d399', '#fde047', '#fb923c', '#ef4444'],
          wireframe: { show: true, opacity: 0.14, step: 3 },
          contour: { show: true, levels: 6, opacity: 0.28 },
          smoothSubdivision: 2,
        },
      ],
      gridFloor: { show: true, showWall: true, wallOpacity: 0.1 },
      animation: { enabled: true, duration: 1100, easing: 'cubicOut' },
    }),
  },
  {
    key: 'line3D',
    label: '折线图',
    tag: 'line3D',
    desc: '平滑曲线 / 垂幕纵深 / 数据点',
    build: (d) => ({
      type: 'line3D',
      xAxis3D: { data: months, name: '月份' },
      yAxis3D: { name: '访问量' },
      legend: { show: true, position: 'bottom' },
      theme: themes.dark,
      series: [
        {
          type: 'line3D',
          name: 'PC 端',
          data: d
            ? [920, 1020, 1100, 1290, 1430, 1550, 1720, 1480, 1620, 1790, 1920, 2110]
            : [820, 932, 901, 1290, 1330, 1450, 1620, 1380, 1520, 1690, 1820, 2010],
          smooth: true,
          curtain: true,
          lineStyle: { width: 5 },
        },
        {
          type: 'line3D',
          name: '移动端',
          data: d
            ? [720, 832, 951, 1034, 1190, 1330, 1410, 1640, 1720, 1880, 2020, 2340]
            : [620, 732, 851, 934, 1090, 1230, 1310, 1540, 1620, 1780, 1920, 2240],
          smooth: true,
          curtain: true,
          lineStyle: { width: 5 },
        },
      ],
      gridFloor: { show: true, showWall: true, wallOpacity: 0.1 },
      animation: { enabled: true, duration: 1000, easing: 'cubicOut' },
    }),
  },
  {
    key: 'pie3D',
    label: '饼图',
    tag: 'pie3D',
    desc: '环形 / 立体厚度 / 中心总量',
    build: (d) => ({
      type: 'pie3D',
      theme: themes.dark,
      showCoordinate: false,
      series: [
        {
          type: 'pie3D',
          name: '渠道',
          innerRadius: 1.3,
          radius: 3.2,
          depth: 0.9,
          padAngle: 1.6,
          data: d
            ? [
                { value: 1280, name: '搜索引擎' },
                { value: 860, name: '直接访问' },
                { value: 640, name: '邮件营销' },
                { value: 520, name: '联盟广告' },
                { value: 380, name: '视频广告' },
              ]
            : [
                { value: 1048, name: '搜索引擎' },
                { value: 735, name: '直接访问' },
                { value: 580, name: '邮件营销' },
                { value: 484, name: '联盟广告' },
                { value: 300, name: '视频广告' },
              ],
          label: { show: true, formatter: '{name}\n{percent}', precision: 0, distance: 0.85 },
          centerLabel: { show: true, total: true, textStyle: { fontSize: 26 } },
        },
      ],
      gridFloor: { show: false },
      animation: { enabled: true, duration: 950, easing: 'cubicOut', stagger: 80 },
    }),
  },
  {
    key: 'radar3D',
    label: '雷达图',
    tag: 'radar3D',
    desc: '立体蛛网 / 多维对比',
    build: (d) => ({
      type: 'radar3D',
      theme: themes.dark,
      showCoordinate: false,
      legend: { show: true, position: 'bottom' },
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
          name: '本方案',
          data: [
            {
              name: '本方案',
              value: d ? [92, 95, 86, 90, 88, 93] : [85, 92, 78, 88, 74, 90],
            },
          ],
          areaStyle: { opacity: 0.42 },
          showPoint: true,
        },
      ],
      gridFloor: { show: false },
      animation: { enabled: true, duration: 900, easing: 'cubicOut' },
    }),
  },
  {
    key: 'gauge3D',
    label: '仪表盘',
    tag: 'gauge3D',
    desc: '立体环带 / 指针 / 数值动画',
    build: (d) => ({
      type: 'gauge3D',
      theme: themes.dark,
      showCoordinate: false,
      series: [
        {
          type: 'gauge3D',
          name: '健康度',
          min: 0,
          max: 100,
          data: [{ value: d ? 88 : 73 }],
          radius: 3.4,
          axisWidth: 0.62,
          depth: 0.5,
          splitNumber: 5,
          detail: { show: true, formatter: '{value}', fontSize: 32 },
          axisTick: { show: true, length: 0.24 },
          pointer: { show: true, color: '#f8fafc' },
        },
      ],
      gridFloor: { show: false },
      animation: { enabled: true, duration: 1400, easing: 'cubicOut' },
    }),
  },
]

const activeKey = ref<DemoKey>('bar3D')
const dynamic = ref(false)
const chartTheme = ref<ThemeName>('dark')

const activeDemo = computed(() => DEMOS.find((d) => d.key === activeKey.value) ?? DEMOS[0])

const currentOption = computed<Vis3xOption>(() => {
  const opt = activeDemo.value.build(dynamic.value)
  return { ...opt, theme: themes[chartTheme.value] }
})

/* ------------------------------ 图表实例控制 ------------------------------ */

const stageRef = shallowRef<{ getChart: () => unknown } | null>(null)

/** 切换图表类型后，触发一次相机自适应 */
function onDemoChange() {
  setTimeout(() => {
    const chart = stageRef.value?.getChart?.() as
      | { fitToScreen?: () => void; requestRender?: () => void }
      | null
    chart?.fitToScreen?.()
    chart?.requestRender?.()
  }, 60)
}

const themeOptions: Array<{ key: ThemeName; label: string }> = [
  { key: 'dark', label: '暗色' },
  { key: 'blue', label: '深蓝' },
  { key: 'warm', label: '暖色' },
]

/* ------------------------------ 滚动进场地动效 ------------------------------ */

const revealed = ref(false)
let observer: IntersectionObserver | null = null

onMounted(() => {
  // 首屏内容做一次轻微的入场
  requestAnimationFrame(() => {
    revealed.value = true
  })

  // 下方区块滚动进入时渐显
  if (typeof IntersectionObserver !== 'undefined') {
    observer = new IntersectionObserver(
      (entries) => {
        for (const e of entries) {
          if (e.isIntersecting) {
            e.target.classList.add('is-visible')
            observer?.unobserve(e.target)
          }
        }
      },
      { threshold: 0.12 }
    )
    document.querySelectorAll('[data-reveal]').forEach((el) => observer?.observe(el))
  }
})

onBeforeUnmount(() => {
  observer?.disconnect()
  observer = null
})

/** 图表能力清单（用于 Hero 下方的小标签） */
const capabilities = [
  'Vue 3 组件',
  'Composition API',
  '纯 JavaScript',
  'TypeScript 类型完备',
  'ESM / CJS / UMD',
  '按需引入',
  '可自定义扩展',
]
</script>

<template>
  <section class="hero" :class="{ 'is-revealed': revealed }">
    <!-- 背景层：网格 + 光晕 -->
    <div class="hero__bg" aria-hidden="true">
      <div class="hero__grid"></div>
      <div class="hero__glow hero__glow--a"></div>
      <div class="hero__glow hero__glow--b"></div>
      <div class="hero__scanline"></div>
    </div>

    <div class="hero__inner">
      <!-- 左：文案 -->
      <div class="hero__copy">
        <div class="hero__eyebrow">
          <span class="hero__dot"></span>
          Vue 3 · TypeScript &amp; JavaScript · Three.js
        </div>

        <h1 class="hero__title">
          让数据
          <span class="hero__title-accent">立起来</span>
        </h1>

        <p class="hero__sub">
          10 种开箱即用的 3D 图表，以及一套像 ECharts 一样自由的扩展 API。
          写配置就能出图，也能从零定义属于你的图表类型。
        </p>

        <div class="hero__cta">
          <a class="btn btn--primary" :href="docsUrl('/guide/quick-start')">快速开始</a>
          <a class="btn btn--ghost" :href="docsUrl('/charts/bar')">浏览图表</a>
        </div>

        <ul class="hero__caps">
          <li v-for="c in capabilities" :key="c">{{ c }}</li>
        </ul>
      </div>

      <!-- 右：可交互图表舞台 -->
      <div class="hero__stage">
        <div class="stage">
          <div class="stage__bar">
            <div class="stage__bar-left">
              <span class="stage__label">{{ activeDemo.label }}</span>
              <code class="stage__tag">{{ activeDemo.tag }}</code>
            </div>
            <div class="stage__bar-right">
              <button
                class="mini"
                :class="{ 'is-on': dynamic }"
                type="button"
                @click="dynamic = !dynamic"
              >
                {{ dynamic ? '数据集 B' : '数据集 A' }}
              </button>
            </div>
          </div>

          <div class="stage__view">
            <VisChart
              :key="activeKey"
              ref="stageRef"
              :option="currentOption"
            />
            <div class="stage__hint">拖拽旋转 · 滚轮缩放</div>
          </div>

          <div class="stage__foot">
            <div class="stage__tabs">
              <button
                v-for="d in DEMOS"
                :key="d.key"
                class="tab"
                :class="{ 'is-active': activeKey === d.key }"
                type="button"
                @click="
                  () => {
                    activeKey = d.key
                    onDemoChange()
                  }
                "
              >
                {{ d.label }}
              </button>
            </div>
            <p class="stage__desc">{{ activeDemo.desc }}</p>

            <div class="stage__themes">
              <span class="stage__themes-label">主题</span>
              <button
                v-for="t in themeOptions"
                :key="t.key"
                class="mini"
                :class="{ 'is-on': chartTheme === t.key }"
                type="button"
                @click="chartTheme = t.key"
              >
                {{ t.label }}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- 滚动提示：一行极简的代码，暗示使用方式 -->
    <div class="hero__code">
      <code>npm install vis-3x three vue</code>
    </div>
  </section>
</template>

<style scoped>
/* --------------------------------- 布局 ---------------------------------- */

.hero {
  position: relative;
  min-height: 100dvh;
  display: flex;
  flex-direction: column;
  justify-content: center;
  overflow: hidden;
  /* 顶部让开固定导航，底部留出命令行提示 */
  padding: 88px 24px 40px;
}

.hero__inner {
  position: relative;
  z-index: 2;
  max-width: 1400px;
  width: 100%;
  margin: 0 auto;
  display: grid;
  grid-template-columns: minmax(0, 0.85fr) minmax(0, 1.15fr);
  gap: 56px;
  align-items: center;
}

/* -------------------------------- 背景层 --------------------------------- */

.hero__bg {
  position: absolute;
  inset: 0;
  z-index: 0;
  pointer-events: none;
}

.hero__grid {
  position: absolute;
  inset: 0;
  background-image:
    linear-gradient(rgba(79, 140, 255, 0.055) 1px, transparent 1px),
    linear-gradient(90deg, rgba(79, 140, 255, 0.055) 1px, transparent 1px);
  background-size: 56px 56px;
  mask-image: radial-gradient(ellipse 90% 70% at 50% 40%, #000 30%, transparent 100%);
}

.hero__glow {
  position: absolute;
  border-radius: 50%;
  filter: blur(90px);
}

.hero__glow--a {
  width: 520px;
  height: 520px;
  top: -140px;
  left: -80px;
  background: radial-gradient(circle, rgba(79, 140, 255, 0.26), transparent 68%);
}

.hero__glow--b {
  width: 460px;
  height: 460px;
  bottom: -160px;
  right: -60px;
  background: radial-gradient(circle, rgba(34, 211, 238, 0.18), transparent 68%);
}

.hero__scanline {
  position: absolute;
  inset: 0;
  background: repeating-linear-gradient(
    to bottom,
    transparent 0,
    transparent 3px,
    rgba(255, 255, 255, 0.012) 3px,
    rgba(255, 255, 255, 0.012) 4px
  );
  opacity: 0.6;
}

/* --------------------------------- 文案 ---------------------------------- */

.hero__copy {
  opacity: 0;
  transform: translateY(18px);
  transition:
    opacity 0.7s cubic-bezier(0.22, 1, 0.36, 1),
    transform 0.7s cubic-bezier(0.22, 1, 0.36, 1);
}

.is-revealed .hero__copy {
  opacity: 1;
  transform: none;
}

.hero__eyebrow {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  font-size: 12px;
  font-weight: 600;
  letter-spacing: 0.08em;
  text-transform: uppercase;
  color: #7fa8e8;
  padding: 6px 12px;
  border: 1px solid rgba(79, 140, 255, 0.28);
  border-radius: 999px;
  background: rgba(79, 140, 255, 0.08);
  margin-bottom: 24px;
}

.hero__dot {
  width: 6px;
  height: 6px;
  border-radius: 50%;
  background: #22d3ee;
  box-shadow: 0 0 10px #22d3ee;
  animation: pulse 2.2s ease-in-out infinite;
}

@keyframes pulse {
  0%,
  100% {
    opacity: 1;
    transform: scale(1);
  }
  50% {
    opacity: 0.45;
    transform: scale(0.8);
  }
}

.hero__title {
  font-size: clamp(42px, 5.4vw, 68px);
  line-height: 1.04;
  letter-spacing: -0.035em;
  font-weight: 800;
  margin: 0 0 20px;
  color: #f1f5f9;
}

.hero__title-accent {
  background: linear-gradient(100deg, #4f8cff 10%, #22d3ee 60%, #34d399 100%);
  -webkit-background-clip: text;
  background-clip: text;
  color: transparent;
}

.hero__sub {
  font-size: 16px;
  line-height: 1.75;
  color: #94a3b8;
  max-width: 46ch;
  margin: 0 0 32px;
}

.hero__cta {
  display: flex;
  gap: 12px;
  margin-bottom: 32px;
  flex-wrap: wrap;
}

.btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  height: 44px;
  padding: 0 22px;
  border-radius: 8px;
  font-size: 14px;
  font-weight: 600;
  text-decoration: none;
  transition: all 0.18s ease;
  white-space: nowrap;
}

.btn--primary {
  background: linear-gradient(180deg, #5d97ff, #3d7af0);
  color: #fff;
  box-shadow: 0 6px 20px rgba(79, 140, 255, 0.32);
}

.btn--primary:hover {
  background: linear-gradient(180deg, #6ea3ff, #4a85f5);
  transform: translateY(-1px);
  box-shadow: 0 10px 26px rgba(79, 140, 255, 0.42);
}

.btn--ghost {
  color: #cbd5e1;
  border: 1px solid #1e293b;
  background: rgba(13, 20, 36, 0.6);
}

.btn--ghost:hover {
  border-color: rgba(79, 140, 255, 0.42);
  color: #e2e8f0;
  background: rgba(79, 140, 255, 0.09);
}

.hero__caps {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  list-style: none;
  padding: 0;
  margin: 0;
}

.hero__caps li {
  font-size: 11.5px;
  color: #64748b;
  padding: 4px 10px;
  border: 1px solid #1e293b;
  border-radius: 999px;
  background: rgba(13, 20, 36, 0.5);
}

/* ------------------------------- 图表舞台 -------------------------------- */

.hero__stage {
  opacity: 0;
  transform: translateY(24px) scale(0.985);
  transition:
    opacity 0.9s cubic-bezier(0.22, 1, 0.36, 1) 0.12s,
    transform 0.9s cubic-bezier(0.22, 1, 0.36, 1) 0.12s;
}

.is-revealed .hero__stage {
  opacity: 1;
  transform: none;
}

.stage {
  border: 1px solid rgba(30, 41, 59, 0.9);
  border-radius: 14px;
  background: linear-gradient(180deg, rgba(13, 20, 36, 0.92), rgba(9, 14, 26, 0.96));
  box-shadow:
    0 30px 80px rgba(0, 0, 0, 0.5),
    0 0 0 1px rgba(79, 140, 255, 0.06) inset;
  overflow: hidden;
  backdrop-filter: blur(12px);
}

.stage__bar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 12px 16px;
  border-bottom: 1px solid rgba(30, 41, 59, 0.8);
  background: rgba(11, 17, 32, 0.7);
}

.stage__bar-left {
  display: flex;
  align-items: center;
  gap: 10px;
}

.stage__label {
  font-size: 13px;
  font-weight: 600;
  color: #e2e8f0;
}

.stage__tag {
  font-family: ui-monospace, 'SFMono-Regular', Consolas, monospace;
  font-size: 11px;
  color: #7fa8e8;
  background: rgba(79, 140, 255, 0.1);
  border: 1px solid rgba(79, 140, 255, 0.22);
  padding: 2px 7px;
  border-radius: 5px;
}

.stage__view {
  position: relative;
  height: 420px;
}

/* VitePress 之外的组件，需要显式撑满 */
.stage__view :deep(.vt-container) {
  width: 100%;
  height: 100%;
}

.stage__hint {
  position: absolute;
  right: 12px;
  bottom: 10px;
  font-size: 11px;
  color: #475569;
  pointer-events: none;
  letter-spacing: 0.02em;
}

.stage__foot {
  padding: 12px 16px 14px;
  border-top: 1px solid rgba(30, 41, 59, 0.8);
  background: rgba(11, 17, 32, 0.55);
}

.stage__tabs {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
  margin-bottom: 10px;
}

.tab {
  font-size: 12px;
  font-weight: 500;
  color: #94a3b8;
  padding: 5px 12px;
  border-radius: 7px;
  border: 1px solid #1e293b;
  background: rgba(13, 20, 36, 0.7);
  cursor: pointer;
  transition: all 0.16s ease;
  font-family: inherit;
}

.tab:hover {
  color: #e2e8f0;
  border-color: rgba(79, 140, 255, 0.35);
}

.tab.is-active {
  color: #dbeafe;
  background: linear-gradient(180deg, rgba(79, 140, 255, 0.24), rgba(79, 140, 255, 0.12));
  border-color: rgba(79, 140, 255, 0.55);
  box-shadow: 0 0 0 1px rgba(79, 140, 255, 0.1);
}

.stage__desc {
  font-size: 12px;
  color: #64748b;
  margin: 0 0 10px;
  min-height: 18px;
}

.stage__themes {
  display: flex;
  align-items: center;
  gap: 6px;
}

.stage__themes-label {
  font-size: 11px;
  color: #475569;
  margin-right: 2px;
}

.mini {
  font-size: 11px;
  color: #94a3b8;
  padding: 3px 9px;
  border-radius: 6px;
  border: 1px solid #1e293b;
  background: transparent;
  cursor: pointer;
  transition: all 0.16s ease;
  font-family: inherit;
}

.mini:hover {
  color: #e2e8f0;
  border-color: rgba(79, 140, 255, 0.35);
}

.mini.is-on {
  color: #bfdbfe;
  background: rgba(79, 140, 255, 0.16);
  border-color: rgba(79, 140, 255, 0.45);
}

/* -------------------------------- 底部命令 -------------------------------- */

.hero__code {
  position: relative;
  z-index: 2;
  margin: 40px auto 0;
  max-width: 1400px;
  width: 100%;
  text-align: center;
}

.hero__code code {
  font-family: ui-monospace, 'SFMono-Regular', Consolas, monospace;
  font-size: 12.5px;
  color: #7fa8e8;
  background: rgba(13, 20, 36, 0.8);
  border: 1px solid #1e293b;
  padding: 9px 18px;
  border-radius: 8px;
  display: inline-block;
}

/* --------------------------------- 响应式 -------------------------------- */

@media (max-width: 1100px) {
  .hero__inner {
    grid-template-columns: 1fr;
    gap: 40px;
  }

  .hero {
    padding-top: 80px;
  }

  .hero__sub {
    max-width: 100%;
  }

  .stage__view {
    height: 380px;
  }
}

@media (max-width: 640px) {
  .hero {
    padding: 72px 16px 48px;
  }

  .hero__title {
    font-size: 38px;
  }

  .stage__view {
    height: 320px;
  }

  .hero__cta {
    width: 100%;
  }

  .btn {
    flex: 1;
  }
}

@media (prefers-reduced-motion: reduce) {
  .hero__copy,
  .hero__stage {
    transition: none;
    opacity: 1;
    transform: none;
  }

  .hero__dot {
    animation: none;
  }
}
</style>
