<script setup lang="ts">
/**
 * 上手代码示例：带用法 / 语言双切换
 *
 * 四种使用方式 × 两种语言（TypeScript / JavaScript）。
 * 让访客一眼看到「我的项目该怎么写」。
 */
import { ref, computed } from 'vue'

type TabKey = 'vue' | 'compose' | 'vanilla' | 'custom'
type LangKey = 'ts' | 'js'

interface Tab {
  key: TabKey
  label: string
  hint: string
  /** 两种语言各自的文件名与代码 */
  files: Record<LangKey, string>
  codes: Record<LangKey, string>
}

const tabs: Tab[] = [
  {
    key: 'vue',
    label: 'Vue 组件',
    hint: '最常用，适合 Vue 项目',
    files: { ts: 'App.vue', js: 'App.vue' },
    codes: {
      ts: `<script setup lang="ts">
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
<\/script>

<template>
  <div style="height: 460px">
    <VisBar3D :option="option" @click="onClick" />
  </div>
</template>`,
      js: `<script setup>
// 纯 JavaScript：去掉类型标注即可
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
<\/script>

<template>
  <div style="height: 460px">
    <VisBar3D :option="option" @click="onClick" />
  </div>
</template>`,
    },
  },
  {
    key: 'compose',
    label: '组合式 API',
    hint: '需要精细控制挂载时机',
    files: { ts: 'ChartPanel.vue', js: 'ChartPanel.vue' },
    codes: {
      ts: `<script setup lang="ts">
import { ref } from 'vue'
import { useVisChart, type Vis3xOption } from 'vis-3x'

const container = ref<HTMLDivElement>()
const option = ref<Vis3xOption>({
  xAxis3D: { data: ['A', 'B', 'C'] },
  series: [{ type: 'bar3D', data: [10, 20, 30] }],
})

const { chart, isReady, exportImage, resetCamera } = useVisChart({
  container,
  option,
})
<\/script>

<template>
  <div>
    <button @click="exportImage({ scale: 2 })">导出 PNG</button>
    <div ref="container" style="height: 420px" />
  </div>
</template>`,
      js: `<script setup>
// 纯 JavaScript：ref() 不需要泛型，也不 import type
import { ref } from 'vue'
import { useVisChart } from 'vis-3x'

const container = ref()
const option = ref({
  xAxis3D: { data: ['A', 'B', 'C'] },
  series: [{ type: 'bar3D', data: [10, 20, 30] }],
})

const { chart, isReady, exportImage, resetCamera } = useVisChart({
  container,
  option,
})
<\/script>

<template>
  <div>
    <button @click="exportImage({ scale: 2 })">导出 PNG</button>
    <div ref="container" style="height: 420px" />
  </div>
</template>`,
    },
  },
  {
    key: 'vanilla',
    label: '纯 JavaScript',
    hint: '不需要 Vue、不需要构建工具',
    files: { ts: 'chart.ts', js: 'chart.js' },
    codes: {
      ts: `import { createChart } from 'vis-3x'
import 'vis-3x/style.css'

const chart = createChart('bar3D', document.getElementById('chart')!)

chart.setOption({
  xAxis3D: { data: ['A', 'B', 'C', 'D'] },
  series: [{ type: 'bar3D', data: [30, 80, 45, 95] }],
})

chart.on('chart:click', (p) => {
  console.log(p.name, p.value)
})`,
      js: `// 纯 JavaScript：不需要 Vue，也不需要 TypeScript
import { createChart } from 'vis-3x'
import 'vis-3x/style.css'

const chart = createChart('bar3D', document.getElementById('chart'))

chart.setOption({
  xAxis3D: { data: ['A', 'B', 'C', 'D'] },
  series: [{ type: 'bar3D', data: [30, 80, 45, 95] }],
})

chart.on('chart:click', (p) => {
  console.log(p.name, p.value)
})

// 用完记得销毁，释放 WebGL 上下文
// chart.dispose()`,
    },
  },
  {
    key: 'custom',
    label: '自定义图表',
    hint: '从零定义一个新类型',
    files: { ts: 'my-chart.ts', js: 'my-chart.js' },
    codes: {
      ts: `import * as THREE from 'three'
import { defineChart, createChart } from 'vis-3x'

defineChart({
  type: 'lollipop3D',
  render(ctx) {
    const series = ctx.series[0]
    const plan = ctx.transition        // 统一的过渡动画

    series.data.forEach((item, i) => {
      const value = typeof item === 'number' ? item : item.value
      const x = ctx.coord.xAtCategory(i)   // 类目 -> 世界 X
      const h = ctx.coord.yAt(value)       // 数值 -> 世界 Y
      const color = ctx.theme.colorAt(i)

      // 细杆（几何体自动登记，销毁时释放）
      const stem = new THREE.Mesh(
        ctx.geometry.cylinder(0.06, 0.06, h, 12),
        ctx.material(color)
      )
      stem.position.set(x, h / 2, 0)
      plan.scaleY(stem, i)
      ctx.add(stem)

      // 顶部圆球 + 交互
      const ball = new THREE.Mesh(ctx.geometry.sphere(0.22, 20), ctx.material(color))
      ball.position.set(x, h, 0)
      ctx.pickable(ball, { seriesIndex: 0, dataIndex: i, value, color })
      ctx.add(ball)
    })

    plan.run()
    ctx.keepAnimating()
  },
})

createChart('lollipop3D', document.getElementById('el'))`,
      js: `// 纯 JavaScript：同样的 API，只是没有类型提示
import * as THREE from 'three'
import { defineChart, createChart } from 'vis-3x'

defineChart({
  type: 'lollipop3D',
  render(ctx) {
    const series = ctx.series[0]
    const plan = ctx.transition        // 统一的过渡动画

    series.data.forEach((item, i) => {
      const value = typeof item === 'number' ? item : item.value
      const x = ctx.coord.xAtCategory(i)   // 类目 -> 世界 X
      const h = ctx.coord.yAt(value)       // 数值 -> 世界 Y
      const color = ctx.theme.colorAt(i)

      // 细杆（几何体自动登记，销毁时释放）
      const stem = new THREE.Mesh(
        ctx.geometry.cylinder(0.06, 0.06, h, 12),
        ctx.material(color)
      )
      stem.position.set(x, h / 2, 0)
      plan.scaleY(stem, i)
      ctx.add(stem)

      // 顶部圆球 + 交互
      const ball = new THREE.Mesh(ctx.geometry.sphere(0.22, 20), ctx.material(color))
      ball.position.set(x, h, 0)
      ctx.pickable(ball, { seriesIndex: 0, dataIndex: i, value, color })
      ctx.add(ball)
    })

    plan.run()
    ctx.keepAnimating()
  },
})

createChart('lollipop3D', document.getElementById('el'))`,
    },
  },
]

const active = ref<TabKey>('vue')
const lang = ref<LangKey>('ts')

const current = computed(() => tabs.find((t) => t.key === active.value) ?? tabs[0])
const currentCode = computed(() => current.value.codes[lang.value])
const currentFile = computed(() => current.value.files[lang.value])

const copied = ref(false)

async function copyCode() {
  try {
    await navigator.clipboard.writeText(currentCode.value)
    copied.value = true
    setTimeout(() => (copied.value = false), 1600)
  } catch {
    /* 剪贴板不可用时静默失败 */
  }
}
</script>

<template>
  <section class="quickstart">
    <div class="wrap">
      <header class="sec-head">
        <p class="sec-head__eyebrow">快速开始</p>
        <h2 class="sec-head__title">四行配置<br />就能出图</h2>
        <p class="sec-head__lead">
          TypeScript 与 JavaScript 的 API 完全一致——类型标注只在编译期生效，
          去掉它就是一个合法的 JS 文件。下面的示例可以切换语言。
        </p>
      </header>

      <div class="panel">
        <div class="panel__tabs">
          <button
            v-for="t in tabs"
            :key="t.key"
            class="ptab"
            :class="{ 'is-active': active === t.key }"
            type="button"
            @click="active = t.key"
          >
            {{ t.label }}
          </button>
          <span class="panel__hint">{{ current.hint }}</span>
        </div>

        <div class="panel__body">
          <div class="panel__filebar">
            <span class="panel__dot"></span>
            <span class="panel__dot"></span>
            <span class="panel__dot"></span>
            <code class="panel__file">{{ currentFile }}</code>

            <!-- 语言切换 -->
            <div class="panel__lang" role="group" aria-label="选择语言">
              <button
                type="button"
                :class="{ 'is-on': lang === 'ts' }"
                @click="lang = 'ts'"
              >
                TypeScript
              </button>
              <button
                type="button"
                :class="{ 'is-on': lang === 'js' }"
                @click="lang = 'js'"
              >
                JavaScript
              </button>
            </div>

            <button class="panel__copy" type="button" @click="copyCode">
              {{ copied ? '已复制' : '复制' }}
            </button>
          </div>
          <pre class="panel__code"><code>{{ currentCode }}</code></pre>
        </div>
      </div>
    </div>
  </section>
</template>

<style scoped>
.quickstart {
  padding: 110px 24px;
  border-top: 1px solid rgba(30, 41, 59, 0.6);
}

.wrap {
  max-width: 1400px;
  margin: 0 auto;
}

.sec-head {
  margin-bottom: 40px;
}

.sec-head__lead {
  margin: 16px 0 0;
  max-width: 62ch;
  font-size: 14px;
  line-height: 1.75;
  color: #8b9cb3;
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

/* --------------------------------- 面板 ---------------------------------- */

.panel {
  border: 1px solid rgba(30, 41, 59, 0.9);
  border-radius: 14px;
  overflow: hidden;
  background: linear-gradient(180deg, rgba(13, 20, 36, 0.8), rgba(7, 11, 20, 0.9));
  box-shadow: 0 24px 60px rgba(0, 0, 0, 0.4);
}

.panel__tabs {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 6px;
  padding: 12px 16px;
  border-bottom: 1px solid rgba(30, 41, 59, 0.8);
  background: rgba(11, 17, 32, 0.6);
}

.ptab {
  font-size: 12.5px;
  font-weight: 500;
  color: #94a3b8;
  padding: 6px 14px;
  border-radius: 7px;
  border: 1px solid #1e293b;
  background: transparent;
  cursor: pointer;
  transition: all 0.16s ease;
  font-family: inherit;
}

.ptab:hover {
  color: #e2e8f0;
  border-color: rgba(79, 140, 255, 0.35);
}

.ptab.is-active {
  color: #dbeafe;
  background: linear-gradient(180deg, rgba(79, 140, 255, 0.24), rgba(79, 140, 255, 0.12));
  border-color: rgba(79, 140, 255, 0.55);
}

.panel__hint {
  margin-left: auto;
  font-size: 11.5px;
  color: #475569;
}

/* ------------------------------ 语言切换 ------------------------------- */

.panel__lang {
  display: flex;
  gap: 2px;
  margin-left: 12px;
  padding: 2px;
  border-radius: 7px;
  background: rgba(5, 9, 18, 0.6);
  border: 1px solid #1e293b;
}

.panel__lang button {
  font-family: inherit;
  font-size: 11px;
  font-weight: 500;
  color: #64748b;
  padding: 4px 10px;
  border: none;
  border-radius: 5px;
  background: transparent;
  cursor: pointer;
  transition: all 0.15s ease;
  white-space: nowrap;
}

.panel__lang button:hover {
  color: #cbd5e1;
}

.panel__lang button.is-on {
  color: #dbeafe;
  background: rgba(79, 140, 255, 0.2);
}

/* --------------------------------- 代码 ---------------------------------- */

.panel__body {
  position: relative;
}

.panel__filebar {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 10px 16px;
  border-bottom: 1px solid rgba(30, 41, 59, 0.6);
}

.panel__dot {
  width: 9px;
  height: 9px;
  border-radius: 50%;
  background: #1e293b;
}

.panel__file {
  margin-left: 8px;
  font-family: ui-monospace, 'SFMono-Regular', Consolas, monospace;
  font-size: 11.5px;
  color: #64748b;
}

.panel__copy {
  margin-left: auto;
  font-size: 11.5px;
  color: #94a3b8;
  padding: 4px 12px;
  border-radius: 6px;
  border: 1px solid #1e293b;
  background: transparent;
  cursor: pointer;
  font-family: inherit;
  transition: all 0.16s ease;
}

.panel__copy:hover {
  color: #e2e8f0;
  border-color: rgba(79, 140, 255, 0.4);
}

.panel__code {
  margin: 0;
  padding: 20px 22px 24px;
  overflow-x: auto;
  max-height: 520px;
  background: rgba(5, 9, 18, 0.6);
}

.panel__code code {
  font-family: ui-monospace, 'SFMono-Regular', Consolas, monospace;
  font-size: 13px;
  line-height: 1.72;
  color: #cbd5e1;
  white-space: pre;
}

@media (max-width: 680px) {
  .quickstart {
    padding: 72px 16px;
  }

  .panel__hint {
    display: none;
  }

  .panel__code {
    font-size: 12px;
    padding: 16px;
  }
}
</style>
