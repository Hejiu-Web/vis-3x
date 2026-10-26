/**
 * vis-3x — Vue 组合式函数
 *
 * `useVisChart` 提供「无组件」的命令式用法：
 * 适合在自定义模板结构、或需要精细控制挂载时机的场景使用。
 */
import { onBeforeUnmount, ref, shallowRef, watch, type Ref } from 'vue'
import type { Vis3xOption, ChartEventMap, ChartEventType } from '../types/option'
import type { ChartBase } from '../core/ChartBase'
import { createChart, inferChartType } from '../core/registry'
import type { ChartType } from '../types/option'
import type { EngineOptions } from '../core/Engine'

/** useVisChart 配置 */
export interface UseVisChartOptions {
  /** 容器 ref */
  container: Ref<HTMLElement | null | undefined>
  /** 图表类型 */
  type?: ChartType | Ref<ChartType | undefined>
  /** 图表配置 */
  option: Ref<Vis3xOption | undefined>
  /** 引擎配置 */
  engineOptions?: EngineOptions
  /** 是否自动监听 option 变化并重渲染，默认 true */
  autoUpdate?: boolean
}

/** useVisChart 返回值 */
export interface UseVisChartReturn {
  /** 图表实例 */
  chart: Readonly<Ref<ChartBase | null>>
  /** 是否已就绪 */
  isReady: Readonly<Ref<boolean>>
  /** 导出图片 */
  exportImage: (options?: { backgroundColor?: string | null; scale?: number }) => string
  /** 重新计算尺寸 */
  resize: () => void
  /** 相机自适应 */
  fitToScreen: () => void
  /** 重置视角 */
  resetCamera: () => void
  /** 手动更新配置 */
  setOption: (option: Vis3xOption) => void
  /** 订阅事件 */
  on: <T extends ChartEventType>(
    event: T,
    listener: (payload: ChartEventMap[T]) => void
  ) => () => void
  /** 重新挂载图表 */
  remount: () => void
}

/**
 * 在组合式 API 中使用 vis-3x
 *
 * @example
 * ```ts
 * const container = ref<HTMLDivElement>()
 * const option = ref<Vis3xOption>({ series: [{ type: 'bar3D', data: [1, 2, 3] }] })
 * const { chart, exportImage } = useVisChart({ container, option })
 * ```
 */
export function useVisChart(options: UseVisChartOptions): UseVisChartReturn {
  const { container, option, engineOptions } = options
  const autoUpdate = options.autoUpdate !== false

  const chart = shallowRef<ChartBase | null>(null)
  const isReady = ref(false)

  /** 解析类型 */
  const resolveType = (): Exclude<ChartType, 'auto'> => {
    const rawType = options.type
    const typeValue = rawType && typeof rawType === 'object' && 'value' in rawType
      ? (rawType as Ref<ChartType | undefined>).value
      : (rawType as ChartType | undefined)
    if (typeValue && typeValue !== 'auto') return typeValue
    const configured = option.value?.type
    if (configured && configured !== 'auto') return configured
    const seriesTypes = (option.value?.series ?? []).map((s) => s.type)
    return inferChartType(seriesTypes)
  }

  /** 创建实例 */
  const mount = (): void => {
    const el = container.value
    if (!el) return
    unmount()
    try {
      const instance = createChart(resolveType(), el, engineOptions)
      if (option.value) instance.setOption(option.value)
      chart.value = instance
      isReady.value = true
    } catch (error) {
      console.error('[vis-3x] useVisChart 初始化失败：', error)
      isReady.value = false
    }
  }

  /** 销毁实例 */
  const unmount = (): void => {
    if (chart.value) {
      chart.value.dispose()
      chart.value = null
    }
    isReady.value = false
  }

  // 容器出现后挂载
  watch(
    container,
    (el) => {
      if (el) mount()
      else unmount()
    },
    { immediate: true, flush: 'post' }
  )

  // 配置变化
  if (autoUpdate) {
    watch(
      option,
      (value) => {
        if (!chart.value) return
        if (!value) return
        chart.value.setOption(value)
      },
      { deep: true }
    )

    // 类型变化需要重建
    if (options.type && typeof options.type === 'object' && 'value' in options.type) {
      watch(options.type as Ref<ChartType | undefined>, () => mount())
    }
  }

  onBeforeUnmount(unmount)

  return {
    chart: chart as Readonly<Ref<ChartBase | null>>,
    isReady: isReady as Readonly<Ref<boolean>>,
    exportImage: (opts) => chart.value?.exportImage(opts) ?? '',
    resize: () => chart.value?.resize(),
    fitToScreen: () => chart.value?.fitToScreen(),
    resetCamera: () => chart.value?.resetCamera(),
    setOption: (o) => chart.value?.setOption(o),
    on: (event, listener) =>
      chart.value ? chart.value.on(event, listener) : () => undefined,
    remount: mount,
  }
}

export default useVisChart
