<script setup lang="ts">
/**
 * 首页特性区块
 *
 * 布局刻意避开「三张等宽卡片」的默认套路：
 * 用一张主卡 + 两张侧卡的 bento 结构，格子数与内容数一致。
 */
import { ref } from 'vue'

interface Feature {
  icon: string
  title: string
  desc: string
}

const features: Feature[] = [
  {
    icon: 'layers',
    title: '10 种内置 3D 图表',
    desc: '柱状、折线、面积、饼图、散点、曲面、雷达、漏斗、仪表盘、热力图。每一种都针对 3D 空间做了专门的视觉设计，而不是把 2D 图表拉出厚度。',
  },
  {
    icon: 'puzzle',
    title: '像 ECharts 一样扩展',
    desc: 'defineChart 函数式定义、extendChart 继承改写、registerChart 注册类、插件系统打包复用。四种方式覆盖从「改一点」到「完全从零」的全部场景。',
  },
  {
    icon: 'code',
    title: '四种使用方式',
    desc: 'Vue 组件、组合式 API、纯 JS 命令式、CDN script 标签。同一个内核，不需要为了换个用法重写代码。',
  },
  {
    icon: 'zap',
    title: '按需渲染',
    desc: '场景静止时自动停止重绘，交互时才唤醒。长时间挂在大屏上的图表不会持续吃 GPU。',
  },
  {
    icon: 'shield',
    title: '资源不泄漏',
    desc: '几何体、材质、贴图统一登记与释放，材质按参数缓存复用。反复切换数据也不会把显存撑爆。',
  },
  {
    icon: 'type',
    title: 'TypeScript 完整类型',
    desc: 'series 是可辨识联合，写 type: "bar3D" 就会自动收窄到柱状图的全部字段。35+ 声明文件覆盖每一个公开 API。',
  },
]

const iconPaths: Record<string, string> = {
  layers: 'M12 2 2 7l10 5 10-5-10-5ZM2 17l10 5 10-5M2 12l10 5 10-5',
  puzzle:
    'M19 7h-3V5a3 3 0 0 0-6 0v2H7a2 2 0 0 0-2 2v3H3a3 3 0 0 0 0 6h2v1a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V7Z',
  code: 'm8 6-6 6 6 6M16 6l6 6-6 6',
  zap: 'M13 2 3 14h7l-1 8 10-12h-7l1-8Z',
  shield: 'M12 2 4 6v6c0 5 3.4 9.3 8 10 4.6-.7 8-5 8-10V6l-8-4Z',
  type: 'M4 7V5h16v2M9 19h6M12 5v14',
}

const visible = ref(false)

/** 用 IntersectionObserver 做一次入场，尊重 reduced-motion */
if (typeof window !== 'undefined' && typeof IntersectionObserver !== 'undefined') {
  const check = () => {
    const el = document.getElementById('features')
    if (!el) return
    const io = new IntersectionObserver(
      (entries) => {
        for (const e of entries) {
          if (e.isIntersecting) {
            visible.value = true
            io.disconnect()
          }
        }
      },
      { threshold: 0.08 }
    )
    io.observe(el)
  }
  if (typeof requestAnimationFrame !== 'undefined') requestAnimationFrame(check)
}
</script>

<template>
  <section id="features" class="features">
    <div class="wrap">
      <header class="sec-head">
        <p class="sec-head__eyebrow">为什么是 vis-3x</p>
        <h2 class="sec-head__title">
          不只是把图表<br />
          拉出一个厚度
        </h2>
      </header>

      <div class="bento" :class="{ 'is-on': visible }">
        <!-- 主卡：扩展能力（放最大，因为这是最核心的差异点） -->
        <article class="cell cell--hero">
          <div class="cell__icon">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6">
              <path :d="iconPaths.puzzle" stroke-linecap="round" stroke-linejoin="round" />
            </svg>
          </div>
          <h3 class="cell__title">{{ features[1].title }}</h3>
          <p class="cell__desc">{{ features[1].desc }}</p>

          <pre class="cell__code"><code><span class="k">defineChart</span>({
  <span class="p">type</span>: <span class="s">'lollipop3D'</span>,
  <span class="k">render</span>(ctx) {
    ctx.series[<span class="n">0</span>].data.<span class="k">forEach</span>((v, i) => {
      <span class="c">// 坐标映射 · 几何体 · 材质 · 交互</span>
      <span class="k">const</span> x = ctx.coord.<span class="k">xAtCategory</span>(i)
      <span class="k">const</span> h = ctx.coord.<span class="k">yAt</span>(v)
    })
  },
})</code></pre>
        </article>

        <!-- 右侧两张卡 -->
        <article class="cell">
          <div class="cell__icon">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6">
              <path :d="iconPaths.layers" stroke-linecap="round" stroke-linejoin="round" />
            </svg>
          </div>
          <h3 class="cell__title">{{ features[0].title }}</h3>
          <p class="cell__desc">{{ features[0].desc }}</p>
        </article>

        <article class="cell">
          <div class="cell__icon">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6">
              <path :d="iconPaths.code" stroke-linecap="round" stroke-linejoin="round" />
            </svg>
          </div>
          <h3 class="cell__title">{{ features[2].title }}</h3>
          <p class="cell__desc">{{ features[2].desc }}</p>
          <div class="cell__pills">
            <span>组件</span><span>Composition</span><span>纯 JS</span><span>CDN</span>
          </div>
        </article>

        <!-- 下方三张等宽卡 -->
        <article v-for="f in [features[3], features[4], features[5]]" :key="f.title" class="cell cell--sm">
          <div class="cell__icon cell__icon--sm">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6">
              <path :d="iconPaths[f.icon]" stroke-linecap="round" stroke-linejoin="round" />
            </svg>
          </div>
          <h3 class="cell__title cell__title--sm">{{ f.title }}</h3>
          <p class="cell__desc">{{ f.desc }}</p>
        </article>
      </div>
    </div>
  </section>
</template>

<style scoped>
.features {
  padding: 110px 24px;
  position: relative;
  border-top: 1px solid rgba(30, 41, 59, 0.6);
}

.wrap {
  max-width: 1400px;
  margin: 0 auto;
}

/* ------------------------------- 区块标题 -------------------------------- */

.sec-head {
  margin-bottom: 48px;
  max-width: 620px;
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
  margin: 0;
}

/* --------------------------------- Bento --------------------------------- */

.bento {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 16px;
}

.cell {
  position: relative;
  padding: 26px 24px;
  border: 1px solid rgba(30, 41, 59, 0.9);
  border-radius: 12px;
  background: linear-gradient(180deg, rgba(13, 20, 36, 0.75), rgba(9, 14, 26, 0.85));
  overflow: hidden;
  opacity: 0;
  transform: translateY(16px);
  transition:
    opacity 0.6s cubic-bezier(0.22, 1, 0.36, 1),
    transform 0.6s cubic-bezier(0.22, 1, 0.36, 1),
    border-color 0.22s ease;
}

.bento.is-on .cell {
  opacity: 1;
  transform: none;
}

.bento.is-on .cell:nth-child(1) {
  transition-delay: 0.02s;
}
.bento.is-on .cell:nth-child(2) {
  transition-delay: 0.08s;
}
.bento.is-on .cell:nth-child(3) {
  transition-delay: 0.14s;
}
.bento.is-on .cell:nth-child(4) {
  transition-delay: 0.2s;
}
.bento.is-on .cell:nth-child(5) {
  transition-delay: 0.26s;
}
.bento.is-on .cell:nth-child(6) {
  transition-delay: 0.32s;
}

.cell:hover {
  border-color: rgba(79, 140, 255, 0.34);
}

/* 主卡占两列两行 */
.cell--hero {
  grid-column: span 2;
  grid-row: span 2;
  display: flex;
  flex-direction: column;
}

.cell--sm {
  padding: 22px 20px;
}

/* --------------------------------- 图标 ---------------------------------- */

.cell__icon {
  width: 38px;
  height: 38px;
  display: grid;
  place-items: center;
  border-radius: 9px;
  background: rgba(79, 140, 255, 0.11);
  border: 1px solid rgba(79, 140, 255, 0.2);
  color: #6ba0ff;
  margin-bottom: 16px;
}

.cell__icon svg {
  width: 19px;
  height: 19px;
}

.cell__icon--sm {
  width: 32px;
  height: 32px;
  border-radius: 8px;
}

.cell__icon--sm svg {
  width: 16px;
  height: 16px;
}

/* --------------------------------- 文字 ---------------------------------- */

.cell__title {
  font-size: 17px;
  font-weight: 700;
  color: #e2e8f0;
  margin: 0 0 10px;
  letter-spacing: -0.015em;
}

.cell__title--sm {
  font-size: 15px;
  margin-bottom: 8px;
}

.cell__desc {
  font-size: 13.5px;
  line-height: 1.72;
  color: #8b9cb3;
  margin: 0;
  max-width: 62ch;
}

.cell__pills {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
  margin-top: 14px;
}

.cell__pills span {
  font-size: 11px;
  color: #7fa8e8;
  background: rgba(79, 140, 255, 0.09);
  border: 1px solid rgba(79, 140, 255, 0.18);
  padding: 3px 9px;
  border-radius: 999px;
}

/* -------------------------------- 代码块 --------------------------------- */

.cell__code {
  margin: auto 0 0;
  margin-top: 20px;
  padding: 16px;
  border-radius: 10px;
  background: rgba(5, 9, 18, 0.85);
  border: 1px solid rgba(30, 41, 59, 0.9);
  overflow-x: auto;
  font-size: 12.5px;
  line-height: 1.68;
}

.cell__code code {
  font-family: ui-monospace, 'SFMono-Regular', Consolas, monospace;
  color: #cbd5e1;
  white-space: pre;
}

.cell__code .k {
  color: #c084fc;
}
.cell__code .s {
  color: #34d399;
}
.cell__code .n {
  color: #fbbf24;
}
.cell__code .p {
  color: #7fa8e8;
}
.cell__code .c {
  color: #475569;
}

/* --------------------------------- 响应式 -------------------------------- */

@media (max-width: 1024px) {
  .bento {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }

  .cell--hero {
    grid-column: span 2;
    grid-row: auto;
  }
}

@media (max-width: 700px) {
  .features {
    padding: 72px 16px;
  }

  .bento {
    grid-template-columns: 1fr;
  }

  .cell--hero {
    grid-column: span 1;
  }
}

@media (prefers-reduced-motion: reduce) {
  .cell {
    opacity: 1;
    transform: none;
    transition: none;
  }
}
</style>
