/**
 * vis-3x — 内置语义化图表组件集
 *
 * 每个组件都是 `VisChartBase` 的轻量封装：
 * 自动注入对应的 `type`，并让 `option.series[].type` 可省略。
 *
 * 若需为自己的自定义图表生成组件，请使用 `createChartComponent`。
 */
import { defineComponent, h, ref, type ComponentPublicInstance } from 'vue'
import VisChartBase from './VisChartBase'
import type { Vis3xOption } from '../types/option'
import {
  bridgeChartEvents,
  chartComponentEmits,
  chartComponentProps,
  createChartComponent,
  createChartExposed,
} from './factory'

/* -------------------------------------------------------------------------- */
/*                              内置图表组件                                   */
/* -------------------------------------------------------------------------- */

/** 3D 柱状图 */
export const VisBar3D = createChartComponent({
  name: 'VisBar3D',
  type: 'bar3D',
  seriesType: 'bar3D',
})

/** 3D 折线图 */
export const VisLine3D = createChartComponent({
  name: 'VisLine3D',
  type: 'line3D',
  seriesType: 'line3D',
})

/** 3D 面积图 */
export const VisArea3D = createChartComponent({
  name: 'VisArea3D',
  type: 'area3D',
  seriesType: 'area3D',
})

/**
 * 3D 面积流图（山体地形效果）
 *
 * 多条平滑曲线各自向下渐隐成半透明色块，层叠出山峦轮廓。
 * 适合客流趋势、访问量走势等需要强视觉冲击的大屏场景。
 */
export const VisAreaFlow3D = createChartComponent({
  name: 'VisAreaFlow3D',
  type: 'areaFlow3D',
  seriesType: 'areaFlow3D',
})

/** 3D 饼图 / 环形图 / 玫瑰图 */
export const VisPie3D = createChartComponent({
  name: 'VisPie3D',
  type: 'pie3D',
  seriesType: 'pie3D',
})

/** 3D 散点图 */
export const VisScatter3D = createChartComponent({
  name: 'VisScatter3D',
  type: 'scatter3D',
  seriesType: 'scatter3D',
})

/** 3D 曲面图 */
export const VisSurface3D = createChartComponent({
  name: 'VisSurface3D',
  type: 'surface3D',
  seriesType: 'surface3D',
})

/** 3D 雷达图 */
export const VisRadar3D = createChartComponent({
  name: 'VisRadar3D',
  type: 'radar3D',
  seriesType: 'radar3D',
})

/** 3D 漏斗图 / 金字塔图 */
export const VisFunnel3D = createChartComponent({
  name: 'VisFunnel3D',
  type: 'funnel3D',
  seriesType: 'funnel3D',
})

/** 3D 仪表盘 */
export const VisGauge3D = createChartComponent({
  name: 'VisGauge3D',
  type: 'gauge3D',
  seriesType: 'gauge3D',
})

/** 3D 热力图 */
export const VisHeatmap3D = createChartComponent({
  name: 'VisHeatmap3D',
  type: 'heatmap3D',
  seriesType: 'heatmap3D',
})

/* -------------------------------------------------------------------------- */
/*                              通用图表组件                                   */
/* -------------------------------------------------------------------------- */

/**
 * 通用图表组件
 *
 * 依据 `option.type` 动态决定图表类型；
 * 未指定时按第一个系列的 `type` 自动推断。
 */
export const VisChart = defineComponent({
  name: 'VisChart',
  props: chartComponentProps,
  emits: [...chartComponentEmits],
  setup(props, { emit, expose, slots }) {
    const baseRef = ref<ComponentPublicInstance | null>(null)
    expose(createChartExposed(baseRef))

    /** 把 interactionMode prop 合并进 option.controlSettings */
    const mergedOption = (): Vis3xOption => {
      const option = props.option ?? {}
      if (!props.interactionMode) return option
      return {
        ...option,
        controlSettings: {
          ...(option.controlSettings ?? {}),
          interactionMode: props.interactionMode,
        },
      }
    }

    return () =>
      h(
        VisChartBase,
        {
          ref: baseRef,
          option: mergedOption(),
          type: props.option?.type ?? 'auto',
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

/** 全部内置组件映射表，供 `app.use()` 批量注册 */
const charts = {
  VisChart,
  VisBar3D,
  VisLine3D,
  VisArea3D,
  VisAreaFlow3D,
  VisPie3D,
  VisScatter3D,
  VisSurface3D,
  VisRadar3D,
  VisFunnel3D,
  VisGauge3D,
  VisHeatmap3D,
}

export default charts
