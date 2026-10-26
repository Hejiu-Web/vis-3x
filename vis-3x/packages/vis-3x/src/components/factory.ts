/**
 * vis-3x — 图表组件工厂
 *
 * 把一个「图表类型标识」包装成开箱即用的 Vue 组件。
 *
 * 内置的 `VisBar3D` / `VisLine3D` 等都由此工厂生成；
 * 使用者注册了自定义图表后，也可以用同一个工厂生成自己的组件：
 *
 * @example
 * ```ts
 * import { createChartComponent, registerChart } from 'vis-3x'
 * import { MyHeatmapChart } from './MyHeatmapChart'
 *
 * registerChart('myHeatmap3D', MyHeatmapChart)
 *
 * export const VisMyHeatmap3D = createChartComponent({
 *   name: 'VisMyHeatmap3D',
 *   type: 'myHeatmap3D',
 *   seriesType: 'heatmap3D',
 * })
 * ```
 */
import {
  defineComponent,
  h,
  ref,
  type Component,
  type ComponentPublicInstance,
  type CSSProperties,
  type PropType,
} from 'vue'
import VisChartBase from './VisChartBase'
import type { Vis3xOption, ChartEventMap } from '../types/option'
import type { InteractionMode } from '../types/environment'
import type { ChartBase } from '../core/ChartBase'

/** 图表组件对外暴露的实例 API */
export interface ChartComponentExposed {
  /** 获取底层图表实例（ChartBase 子类） */
  getChart: () => ChartBase | null
  /** 获取容器 DOM */
  getContainer: () => HTMLElement | null
  /** 导出 PNG DataURL */
  exportImage: (options?: { backgroundColor?: string | null; scale?: number }) => string
  /** 重新计算尺寸 */
  resize: () => void
  /** 相机自适应 */
  fitToScreen: () => void
  /** 重置相机视角 */
  resetCamera: () => void
  /** 命令式更新配置 */
  setOption: (option: Vis3xOption) => void
  /** 订阅事件 */
  on: (
    event: string,
    listener: (payload: never) => void
  ) => (() => void) | undefined
  /** 派发事件 */
  dispatch: (event: string, payload: never) => void
  /** 请求重绘 */
  render: () => void
}

/** 图表组件共享的 props 定义 */
export interface ChartComponentProps {
  /** 图表配置项 */
  option: Vis3xOption
  /** 宽度，默认 '100%' */
  width?: string | number
  /** 高度，默认 '100%' */
  height?: string | number
  /** 调色板快捷设置 */
  palette?: string[]
  /** 是否显示加载遮罩 */
  loading?: boolean
  /** 高亮光源索引（调试用） */
  hoveredLightIndex?: number
  /** 额外容器样式 */
  containerStyle?: CSSProperties
  /**
   * 相机交互模式（等价于 `option.controlSettings.interactionMode`）
   *
   * - `'free'`   自由视角：旋转 + 缩放 + 平移（默认）
   * - `'rotate'` 仅旋转：禁用缩放与平移
   * - `'fixed'`  固定视角：完全禁用，画面锁定
   *
   * 只影响相机；悬停高亮、点击事件、提示框仍然可用。
   *
   * @example
   * ```vue
   * <VisBar3D :option="option" interaction-mode="fixed" />
   * ```
   */
  interactionMode?: InteractionMode
}

/** createChartComponent 的参数 */
export interface CreateChartComponentOptions {
  /** 组件名（需唯一，建议用 Vis 前缀） */
  name: string
  /** 图表类型标识，需已通过 registerChart 注册 */
  type: string
  /**
   * 系列默认类型
   *
   * 设置后，使用该组件时 `series[].type` 可省略，会自动补全为该值。
   */
  seriesType?: string
}

/** 内部：统一 props 定义 */
export const chartComponentProps = {
  option: {
    type: Object as PropType<Vis3xOption>,
    required: true,
  },
  width: {
    type: [String, Number] as PropType<string | number>,
    default: '100%',
  },
  height: {
    type: [String, Number] as PropType<string | number>,
    default: '100%',
  },
  palette: {
    type: Array as PropType<string[] | undefined>,
    default: undefined,
  },
  loading: {
    type: Boolean,
    default: false,
  },
  hoveredLightIndex: {
    type: Number as PropType<number | undefined>,
    default: undefined,
  },
  containerStyle: {
    type: Object as PropType<CSSProperties | undefined>,
    default: undefined,
  },
  interactionMode: {
    type: String as PropType<InteractionMode | undefined>,
    default: undefined,
  },
}

/** 内部：统一 emits 定义 */
export const chartComponentEmits = [
  'click',
  'dblclick',
  'mouseover',
  'mouseout',
  'mousemove',
  'mousedown',
  'mouseup',
  'rendered',
  'legend-toggle',
  'camera-change',
  'ready',
] as const

/** 内部：把底层图表事件桥接为 Vue 事件 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function bridgeChartEvents(emit: (...args: any[]) => void) {
  return {
    onClick: (p: ChartEventMap['chart:click']) => emit('click', p),
    onDblclick: (p: ChartEventMap['chart:dblclick']) => emit('dblclick', p),
    onMouseover: (p: ChartEventMap['chart:mouseover']) => emit('mouseover', p),
    onMouseout: (p: ChartEventMap['chart:mouseout']) => emit('mouseout', p),
    onMousemove: (p: ChartEventMap['chart:mousemove']) => emit('mousemove', p),
    onMousedown: (p: ChartEventMap['chart:mousedown']) => emit('mousedown', p),
    onMouseup: (p: ChartEventMap['chart:mouseup']) => emit('mouseup', p),
    onRendered: (p: ChartEventMap['chart:rendered']) => emit('rendered', p),
    onLegendToggle: (p: ChartEventMap['legend:toggle']) => emit('legend-toggle', p),
    onCameraChange: (p: ChartEventMap['camera:change']) => emit('camera-change', p),
    onReady: (c: unknown) => emit('ready', c),
  }
}

/** 内部：构造对外暴露的 API 对象 */
export function createChartExposed(
  baseRef: ReturnType<typeof ref<ComponentPublicInstance | null>>
): ChartComponentExposed {
  const api = () => baseRef.value as unknown as ChartComponentExposed | null
  return {
    getChart: () => (api()?.getChart() ?? null) as ChartBase | null,
    getContainer: () => api()?.getContainer() ?? null,
    exportImage: (options) => api()?.exportImage(options) ?? '',
    resize: () => api()?.resize(),
    fitToScreen: () => api()?.fitToScreen(),
    resetCamera: () => api()?.resetCamera(),
    setOption: (o) => api()?.setOption(o),
    on: (event, listener) => api()?.on(event, listener),
    dispatch: (event, payload) => api()?.dispatch(event, payload),
    render: () => api()?.render(),
  }
}

/**
 * 创建一个图表组件
 *
 * @param options 组件配置
 * @returns Vue 组件
 */
export function createChartComponent(
  options: CreateChartComponentOptions
): Component {
  const { name, type, seriesType } = options

  return defineComponent({
    name,
    props: chartComponentProps,
    emits: [...chartComponentEmits],
    setup(props, { emit, expose, slots }) {
      const baseRef = ref<ComponentPublicInstance | null>(null)

      /** 自动补全 series[].type，使用户无需重复书写 */
      const normalizedOption = (): Vis3xOption => {
        const option = props.option ?? {}
        const series = seriesType && option.series
          ? option.series.map((s) => ({
              ...s,
              type: (s as { type?: string }).type ?? seriesType,
            }))
          : option.series

        // interactionMode prop 优先级高于 option.controlSettings 中的设置
        const controlSettings = props.interactionMode
          ? {
              ...(option.controlSettings ?? {}),
              interactionMode: props.interactionMode,
            }
          : option.controlSettings

        return {
          ...option,
          series: series as Vis3xOption['series'],
          controlSettings,
        }
      }

      expose(createChartExposed(baseRef))

      return () =>
        h(
          VisChartBase,
          {
            ref: baseRef,
            option: normalizedOption(),
            type,
            width: props.width,
            height: props.height,
            palette: props.palette,
            loading: props.loading,
            hoveredLightIndex: props.hoveredLightIndex,
            containerStyle: props.containerStyle,
            ...bridgeChartEvents(emit),
          },
          slots
        )
    },
  })
}
