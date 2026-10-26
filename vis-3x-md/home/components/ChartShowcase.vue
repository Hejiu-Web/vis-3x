<script setup lang="ts">
/**
 * 图表总览：用真实库渲染 6 个迷你图表
 *
 * 每个卡片都是一个独立运行的 vis-3x 实例。
 * 相比截图，这让访客可以直接拖动验证效果。
 */
import { computed, ref, onMounted, onBeforeUnmount } from 'vue'
import { themes, type Vis3xOption } from 'vis-3x'
import { docsUrl } from '../site-config'

interface ShowcaseItem {
  key: string
  name: string
  tag: string
  link: string
  option: Vis3xOption
}

const months = ['1月', '2月', '3月', '4月', '5月', '6月', '7月', '8月', '9月', '10月', '11月', '12月']

const items: ShowcaseItem[] = [
  {
    key: 'bar',
    name: '柱状图',
    tag: 'bar3D',
    link: '/charts/bar',
    option: {
      type: 'bar3D',
      xAxis3D: { data: ['A', 'B', 'C', 'D'], type: 'category' },
      // 小图空间有限：隐藏数值轴标签，只留网格，避免与柱顶数字挤在一起
      yAxis3D: { axisLabel: { show: false }, splitLine: { show: true, splitNumber: 3 } },
      legend: { show: false },
      theme: themes.dark,
      controlSettings: { interactionMode: 'rotate' },
      series: [
        {
          type: 'bar3D',
          data: [120, 200, 150, 240],
          borderRadius: 0.08,
        },
      ],
      gridFloor: { show: true, showWall: true, wallOpacity: 0.12 },
      animation: { enabled: true, duration: 900, stagger: 50 },
    },
  },
  {
    key: 'line',
    name: '折线图',
    tag: 'line3D',
    link: '/charts/line',
    option: {
      type: 'line3D',
      xAxis3D: { data: months.slice(0, 8) },
      yAxis3D: { axisLabel: { show: false }, splitLine: { show: true, splitNumber: 3 } },
      legend: { show: false },
      theme: themes.dark,
      controlSettings: { interactionMode: 'rotate' },
      series: [
        {
          type: 'line3D',
          data: [820, 932, 901, 1290, 1330, 1450, 1620, 1380],
          smooth: true,
          curtain: true,
          lineStyle: { width: 5 },
        },
      ],
      gridFloor: { show: true, showWall: true, wallOpacity: 0.1 },
      animation: { enabled: true, duration: 1000 },
    },
  },
  {
    key: 'area',
    name: '面积图',
    tag: 'area3D',
    link: '/charts/area',
    option: {
      type: 'area3D',
      xAxis3D: { data: months.slice(0, 8) },
      yAxis3D: { axisLabel: { show: false }, splitLine: { show: true, splitNumber: 3 } },
      legend: { show: false },
      theme: themes.dark,
      controlSettings: { interactionMode: 'rotate' },
      series: [
        {
          type: 'area3D',
          data: [320, 410, 380, 520, 610, 580, 690, 720],
          areaStyle: { opacity: 0.8 },
        },
      ],
      gridFloor: { show: true, showWall: true, wallOpacity: 0.1 },
      animation: { enabled: true, duration: 950 },
    },
  },
  {
    key: 'scatter',
    name: '散点图',
    tag: 'scatter3D',
    link: '/charts/scatter',
    option: {
      type: 'scatter3D',
      xAxis3D: { type: 'value', min: -6, max: 6, axisLabel: { show: false } },
      yAxis3D: { axisLabel: { show: false }, splitLine: { show: true, splitNumber: 3 } },
      zAxis3D: { type: 'value', min: -4, max: 4, axisLabel: { show: false } },
      legend: { show: false },
      theme: themes.dark,
      controlSettings: { interactionMode: 'free' },
      series: [
        {
          type: 'scatter3D',
          data: Array.from({ length: 46 }, (_, i) => {
            const cluster = i % 3
            return [
              cluster * 3 - 3 + (Math.random() - 0.5) * 2.4,
              20 + Math.random() * 80 + cluster * 12,
              ((cluster + 1) % 3) * 2 - 2 + (Math.random() - 0.5) * 2.4,
            ]
          }),
          pointStyle: { symbol: 'sphere', sizeRange: [0.13, 0.3] },
        },
      ],
      gridFloor: { show: true, showWall: true, wallOpacity: 0.08 },
      animation: { enabled: true, duration: 900, stagger: 12 },
    },
  },
  {
    key: 'pie',
    name: '环形饼图',
    tag: 'pie3D',
    link: '/charts/pie',
    option: {
      type: 'pie3D',
      theme: themes.dark,
      showCoordinate: false,
      legend: { show: false },
      controlSettings: { interactionMode: 'rotate' },
      series: [
        {
          type: 'pie3D',
          innerRadius: 1.4,
          radius: 2.9,
          depth: 0.85,
          padAngle: 1.8,
          data: [
            { value: 1048, name: '搜索' },
            { value: 735, name: '直访' },
            { value: 580, name: '邮件' },
            { value: 484, name: '联盟' },
          ],
          label: { show: false },
          centerLabel: { show: true, total: true, textStyle: { fontSize: 24 } },
        },
      ],
      gridFloor: { show: false },
      animation: { enabled: true, duration: 950, stagger: 80 },
    },
  },
  {
    key: 'gauge',
    name: '仪表盘',
    tag: 'gauge3D',
    link: '/charts/gauge',
    option: {
      type: 'gauge3D',
      theme: themes.dark,
      showCoordinate: false,
      legend: { show: false },
      controlSettings: { interactionMode: 'fixed' },
      series: [
        {
          type: 'gauge3D',
          min: 0,
          max: 100,
          data: [{ value: 76 }],
          radius: 2.9,
          axisWidth: 0.58,
          depth: 0.48,
          splitNumber: 5,
          detail: { show: true, fontSize: 30 },
          axisTick: { show: true, length: 0.22 },
        },
      ],
      gridFloor: { show: false },
      animation: { enabled: true, duration: 1300 },
    },
  },
]

const isOn = ref(false)
let io: IntersectionObserver | null = null

onMounted(() => {
  // 进入视口后再渲染图表，避免首屏之外的空转
  if (typeof IntersectionObserver === 'undefined') {
    isOn.value = true
    return
  }
  const el = document.getElementById('showcase')
  if (!el) {
    isOn.value = true
    return
  }
  io = new IntersectionObserver(
    (entries) => {
      for (const e of entries) {
        if (e.isIntersecting) {
          isOn.value = true
          io?.disconnect()
        }
      }
    },
    { threshold: 0.03 }
  )
  io.observe(el)
})

onBeforeUnmount(() => {
  io?.disconnect()
  io = null
})

const count = computed(() => items.length)
</script>

<template>
  <section id="showcase" class="showcase">
    <div class="wrap">
      <header class="sec-head">
        <p class="sec-head__eyebrow">内置图表</p>
        <h2 class="sec-head__title">
          {{ count }} 种开箱即用<br />
          每种都能拖
        </h2>
        <p class="sec-head__lead">
          下面每一张都是真实运行的图表实例，不是截图。
          把鼠标放上去转一转，直接判断它是否符合你的需求。
        </p>
      </header>

      <div class="grid">
        <a v-for="it in items" :key="it.key" class="card" :href="docsUrl(it.link)">
          <div class="card__head">
            <span class="card__name">{{ it.name }}</span>
            <code class="card__tag">{{ it.tag }}</code>
          </div>
          <div class="card__view">
            <VisChart v-if="isOn" :option="it.option" height="100%" />
            <div v-else class="card__skeleton"></div>
          </div>
        </a>
      </div>

      <div class="more">
        <a class="btn btn--ghost" :href="docsUrl('/charts/bar')">查看全部 16 种图表</a>
      </div>
    </div>
  </section>
</template>

<style scoped>
.showcase {
  padding: 110px 24px;
  border-top: 1px solid rgba(30, 41, 59, 0.6);
  position: relative;
}

.wrap {
  max-width: 1400px;
  margin: 0 auto;
}

/* ------------------------------- 区块标题 -------------------------------- */

.sec-head {
  margin-bottom: 44px;
  max-width: 640px;
}

.sec-head__eyebrow {
  font-size: 12px;
  font-weight: 600;
  letter-spacing: 0.1em;
  text-transform: uppercase;
  color: #4f8cff;
  margin: 0 0 14px;
}

.sec-head__title {
  font-size: clamp(30px, 3.6vw, 44px);
  line-height: 1.12;
  letter-spacing: -0.03em;
  font-weight: 800;
  color: #f1f5f9;
  margin: 0 0 16px;
}

.sec-head__lead {
  font-size: 14.5px;
  line-height: 1.75;
  color: #8b9cb3;
  margin: 0;
  max-width: 56ch;
}

/* --------------------------------- 网格 ---------------------------------- */

.grid {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 16px;
}

.card {
  display: block;
  border: 1px solid rgba(30, 41, 59, 0.9);
  border-radius: 12px;
  background: linear-gradient(180deg, rgba(13, 20, 36, 0.72), rgba(9, 14, 26, 0.85));
  overflow: hidden;
  text-decoration: none;
  transition:
    border-color 0.2s ease,
    transform 0.2s ease,
    box-shadow 0.2s ease;
}

.card:hover {
  border-color: rgba(79, 140, 255, 0.38);
  transform: translateY(-3px);
  box-shadow: 0 18px 40px rgba(0, 0, 0, 0.36);
}

.card__head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 12px 14px;
  border-bottom: 1px solid rgba(30, 41, 59, 0.7);
}

.card__name {
  font-size: 13px;
  font-weight: 600;
  color: #e2e8f0;
}

.card__tag {
  font-family: ui-monospace, 'SFMono-Regular', Consolas, monospace;
  font-size: 10.5px;
  color: #7fa8e8;
  background: rgba(79, 140, 255, 0.09);
  border: 1px solid rgba(79, 140, 255, 0.2);
  padding: 2px 7px;
  border-radius: 5px;
}

.card__view {
  height: 280px;
}

.card__view :deep(.vt-container) {
  width: 100%;
  height: 100%;
}

.card__skeleton {
  width: 100%;
  height: 100%;
  background: linear-gradient(
    90deg,
    rgba(30, 41, 59, 0.28) 25%,
    rgba(51, 65, 85, 0.4) 37%,
    rgba(30, 41, 59, 0.28) 63%
  );
  background-size: 400% 100%;
  animation: shimmer 1.5s ease-in-out infinite;
}

@keyframes shimmer {
  0% {
    background-position: 100% 50%;
  }
  100% {
    background-position: 0 50%;
  }
}

/* --------------------------------- 更多 ---------------------------------- */

.more {
  margin-top: 36px;
  text-align: center;
}

.btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  height: 44px;
  padding: 0 24px;
  border-radius: 8px;
  font-size: 14px;
  font-weight: 600;
  text-decoration: none;
  white-space: nowrap;
  transition: all 0.18s ease;
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

/* --------------------------------- 响应式 -------------------------------- */

@media (max-width: 1024px) {
  .grid {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }
}

@media (max-width: 680px) {
  .showcase {
    padding: 72px 16px;
  }

  .grid {
    grid-template-columns: 1fr;
  }

  .card__view {
    height: 240px;
  }
}

@media (prefers-reduced-motion: reduce) {
  .card {
    transition: none;
  }
}
</style>
