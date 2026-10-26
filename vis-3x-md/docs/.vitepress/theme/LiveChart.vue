<script setup lang="ts">
/**
 * 文档内嵌的可交互图表
 *
 * 在 Markdown 里直接写配置对象，组件负责创建真实的 vis-3x 实例：
 *
 * ```md
 * <LiveChart
 *   type="bar3D"
 *   :option="{ xAxis3D: { data: ['A','B'] }, series: [{ type: 'bar3D', data: [1,2] }] }"
 * />
 * ```
 *
 * 特性：
 * - 图表可拖拽旋转、滚轮缩放
 * - 支持「重置视角 / 导出图片」小工具条
 * - 进入视口才创建实例（省内存，长文档里尤其重要）
 * - 组件卸载时自动 dispose
 */
import { computed, onBeforeUnmount, onMounted, ref, shallowRef, watch } from 'vue'
import { createChart, themes, useExtraCharts } from 'vis-3x'
import type { Vis3xOption, ThemeName } from 'vis-3x'

/**
 * 注册 6 个扩展示例图表
 *
 * **必须从包根 `vis-3x` 导入，不能用 `vis-3x/presets`。**
 *
 * 原因：注册表是 `registry.ts` 里的一个模块级 Map。
 * 如果 `createChart` 来自 `vis-3x` 而 `useExtraCharts` 来自 `vis-3x/presets`，
 * 打包器会把两者当成不同的模块图（各自解析到不同的入口文件），
 * 于是注册写进了 A 实例的 Map，`createChart` 读的是 B 实例 → 报「未知的图表类型」。
 *
 * 从同一个入口导入即可保证共用同一份注册表。
 * `useExtraCharts` 是幂等的，多次调用安全。
 */
useExtraCharts()

const props = withDefaults(
  defineProps<{
    /** 图表类型。省略时按 option.series[0].type 推断 */
    type?: string
    /** 图表配置 */
    option: Vis3xOption
    /** 容器高度 */
    height?: number | string
    /** 主题名，默认 dark */
    theme?: ThemeName
    /** 默认视角交互模式 */
    interaction?: 'free' | 'rotate' | 'fixed'
    /** 隐藏工具条 */
    plain?: boolean
    /** 图表下方的说明文字 */
    caption?: string
  }>(),
  {
    height: 420,
    theme: 'dark',
    interaction: 'free',
    plain: false,
  }
)

const host = ref<HTMLDivElement>()
const ready = ref(false)
const visible = ref(false)
const chart = shallowRef<ReturnType<typeof createChart> | null>(null)

const heightStyle = computed(() =>
  typeof props.height === 'number' ? `${props.height}px` : props.height
)

/** 合并主题与交互模式 */
const mergedOption = computed<Vis3xOption>(() => ({
  ...props.option,
  theme: props.option.theme ?? themes[props.theme],
  controlSettings: {
    interactionMode: props.interaction,
    ...props.option.controlSettings,
  },
}))

let observer: IntersectionObserver | null = null

function mountChart() {
  if (!host.value || chart.value) return
  try {
    const instance = createChart(props.type ?? 'auto', host.value)
    instance.setOption(mergedOption.value)
    chart.value = instance
    ready.value = true
  } catch (e) {
    console.error('[LiveChart] 创建失败', e)
  }
}

onMounted(() => {
  if (typeof IntersectionObserver === 'undefined') {
    visible.value = true
    mountChart()
    return
  }
  observer = new IntersectionObserver(
    (entries) => {
      for (const entry of entries) {
        if (entry.isIntersecting) {
          visible.value = true
          // 稍等一帧，确保容器已完成布局（否则尺寸为 0）
          requestAnimationFrame(mountChart)
          observer?.disconnect()
          observer = null
        }
      }
    },
    { rootMargin: '200px' }
  )
  if (host.value) observer.observe(host.value)
})

onBeforeUnmount(() => {
  observer?.disconnect()
  observer = null
  chart.value?.dispose()
  chart.value = null
})

/** 配置变化时更新图表 */
watch(
  mergedOption,
  (next) => {
    chart.value?.setOption(next)
  },
  { deep: true }
)

function resetCamera() {
  chart.value?.resetCamera()
  chart.value?.fitToScreen()
}

function fit() {
  chart.value?.fitToScreen()
}

function exportPng() {
  const instance = chart.value
  if (!instance) return
  const url = instance.exportImage({ scale: 2 })
  const a = document.createElement('a')
  a.href = url
  a.download = `${props.type ?? 'chart'}.png`
  a.click()
}
</script>

<template>
  <figure class="live">
    <div class="live__stage" :style="{ height: heightStyle }">
      <div ref="host" class="live__host"></div>

      <div v-if="!ready" class="live__loading">
        <span class="live__spinner"></span>
        <span>正在渲染图表…</span>
      </div>

      <div v-if="ready && !plain" class="live__tools">
        <button type="button" title="重置视角" @click="resetCamera">重置视角</button>
        <button type="button" title="适应窗口" @click="fit">适应窗口</button>
        <button type="button" title="导出 PNG" @click="exportPng">导出</button>
      </div>

      <div v-if="ready" class="live__hint">拖拽旋转 · 滚轮缩放</div>
    </div>

    <figcaption v-if="caption" class="live__caption">{{ caption }}</figcaption>
  </figure>
</template>

<style scoped>
.live {
  margin: 20px 0 28px;
  border: 1px solid var(--vp-c-divider);
  border-radius: 12px;
  overflow: hidden;
  background: linear-gradient(180deg, var(--vp-c-bg-soft), var(--vp-c-bg-alt));
}

.live__stage {
  position: relative;
  width: 100%;
}

.live__host {
  width: 100%;
  height: 100%;
}

/* 图表容器需要显式撑满（库自身的 .vt-container 是 100% 尺寸） */
.live__host :deep(.vt-container) {
  width: 100%;
  height: 100%;
}

/* --------------------------------- 加载态 -------------------------------- */

.live__loading {
  position: absolute;
  inset: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 10px;
  font-size: 13px;
  color: var(--vp-c-text-3);
  background: var(--vp-c-bg-alt);
}

.live__spinner {
  width: 15px;
  height: 15px;
  border: 2px solid var(--vp-c-divider);
  border-top-color: var(--vp-c-brand-1);
  border-radius: 50%;
  animation: live-spin 0.7s linear infinite;
}

@keyframes live-spin {
  to {
    transform: rotate(360deg);
  }
}

/* --------------------------------- 工具条 -------------------------------- */

.live__tools {
  position: absolute;
  top: 10px;
  right: 10px;
  display: flex;
  gap: 6px;
  opacity: 0;
  transition: opacity 0.18s ease;
}

.live__stage:hover .live__tools,
.live__tools:focus-within {
  opacity: 1;
}

.live__tools button {
  font-family: inherit;
  font-size: 11.5px;
  color: var(--vp-c-text-2);
  padding: 4px 10px;
  border-radius: 6px;
  border: 1px solid var(--vp-c-divider);
  background: color-mix(in srgb, var(--vp-c-bg) 82%, transparent);
  backdrop-filter: blur(6px);
  cursor: pointer;
  transition: all 0.16s ease;
}

.live__tools button:hover {
  color: var(--vp-c-text-1);
  border-color: var(--vp-c-brand-1);
}

.live__hint {
  position: absolute;
  left: 12px;
  bottom: 8px;
  font-size: 11px;
  color: var(--vp-c-text-3);
  pointer-events: none;
  opacity: 0.75;
}

.live__caption {
  padding: 10px 16px;
  border-top: 1px solid var(--vp-c-divider);
  font-size: 12.5px;
  line-height: 1.65;
  color: var(--vp-c-text-3);
  background: var(--vp-c-bg-alt);
}

@media (prefers-reduced-motion: reduce) {
  .live__spinner {
    animation: none;
  }
  .live__tools {
    opacity: 1;
    transition: none;
  }
}
</style>
