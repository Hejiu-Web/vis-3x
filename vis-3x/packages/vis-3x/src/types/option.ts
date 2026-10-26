/**
 * vis-3x — 顶层配置项与事件类型定义
 */
import type { Axis3D, RadarConfig } from './axis'
import type { Series3D, AnimationConfig } from './series'
import type {
  ControlSettings,
  GridFloorConfig,
  LightConfig,
  PostprocessingOptions,
  ThemeConfig,
} from './environment'
import type { LegendStyle, TooltipStyle, LabelStyle, TextStyle } from './style'

/** 内置图表类型标识 */
export type BuiltinChartType =
  | 'bar3D'
  | 'line3D'
  | 'area3D'
  | 'areaFlow3D'
  | 'pie3D'
  | 'scatter3D'
  | 'surface3D'
  | 'radar3D'
  | 'funnel3D'
  | 'gauge3D'
  | 'heatmap3D'

/**
 * 图表类型标识
 *
 * 除内置类型外，通过 `registerChart` / `defineChart` / `extendChart`
 * 注册的自定义类型也属于合法取值（因此联合了 `string`，
 * 同时保留字面量以获得内置类型的自动补全）。
 */
export type ChartType = BuiltinChartType | 'auto' | (string & {})

/**
 * vis-3x 图表配置项
 *
 * 这是整个库的核心数据结构：声明式描述「要画什么」与「怎么画」。
 *
 * @example
 * ```ts
 * const option: Vis3xOption = {
 *   xAxis3D: { data: ['一月', '二月', '三月'] },
 *   series: [{ type: 'bar3D', data: [120, 200, 150] }],
 * }
 * ```
 */
export interface Vis3xOption {
  /** 图表类型；按需引入具体组件时无需填写。`auto` 时按第一个系列的类型推断 */
  type?: ChartType

  /* ------------------------------ 数据系列 ------------------------------ */
  /** 系列列表 */
  series?: Series3D[]

  /* ------------------------------ 坐标系 -------------------------------- */
  /** X 轴（类目轴常用） */
  xAxis3D?: Axis3D
  /** Y 轴（数值轴常用） */
  yAxis3D?: Axis3D
  /** Z 轴（深度轴常用） */
  zAxis3D?: Axis3D
  /** 雷达图坐标系 */
  radar?: RadarConfig
  /** 是否显示坐标系整体开关 */
  showCoordinate?: boolean

  /* ------------------------------ 渲染环境 ------------------------------ */
  /** 光照；不传自动使用三点光照 */
  lights?: LightConfig[]
  /** 是否显示光源辅助线（调试用） */
  showLightHelpers?: boolean
  /** 后处理 */
  postprocessing?: PostprocessingOptions
  /** 地面/背景网格 */
  gridFloor?: GridFloorConfig
  /** 相机控制器 */
  controlSettings?: ControlSettings
  /** 主题 */
  theme?: ThemeConfig
  /** 背景色；null 为透明 */
  backgroundColor?: string | null
  /** 相机初始位置 */
  cameraPosition?: [number, number, number]
  /** 全局默认动画 */
  animation?: AnimationConfig
  /** 是否启用交互（悬停高亮、点击） */
  interactive?: boolean
  /** 是否开启按需渲染（静止时停止重绘），默认 true */
  onDemandRendering?: boolean

  /* ------------------------------ 组件样式 ------------------------------ */
  /** 图例 */
  legend?: LegendStyle
  /** 提示框 */
  tooltip?: TooltipStyle
  /** 全局默认数据标签（会被系列级 label 覆盖） */
  label?: LabelStyle
  /** 全局坐标轴样式（会被 xAxis3D/yAxis3D/zAxis3D 覆盖） */
  axisStyle?: {
    axisLine?: Axis3D['axisLine']
    axisLabel?: Axis3D['axisLabel']
    splitLine?: Axis3D['splitLine']
    nameStyle?: TextStyle
  }
  /** 标题（HTML 覆盖层渲染） */
  title?: {
    show?: boolean
    text?: string
    subtext?: string
    left?: number | string
    top?: number | string
    textStyle?: TextStyle
    subtextStyle?: TextStyle
  }
  /** 是否显示加载中遮罩 */
  loading?: boolean
}

/** 解析后的完整配置（内部使用，所有字段都有值） */
export type ResolvedOption = Vis3xOption & {
  __resolved: true
  kind: Exclude<ChartType, 'auto'>
}

/* -------------------------------------------------------------------------- */
/*                                  事件系统                                   */
/* -------------------------------------------------------------------------- */

/** 交互事件携带的数据 */
export interface ChartEventPayloadBase {
  /** 系列索引 */
  seriesIndex: number
  /** 数据索引 */
  dataIndex: number
  /** 系列名 */
  seriesName?: string
  /** 数据项名 */
  name?: string
  /** 数据值 */
  value: number | number[]
  /** 数据项颜色 */
  color: string
  /** 命中的 Three.js 对象 */
  object: import('three').Object3D
  /** 命中点的世界坐标 */
  position: import('three').Vector3
  /** 原始事件 */
  event: MouseEvent | TouchEvent
}

/** `chart:click` 负载 */
export type ChartClickPayload = ChartEventPayloadBase & { type: 'click' }
/** `chart:dblclick` 负载 */
export type ChartDblClickPayload = ChartEventPayloadBase & { type: 'dblclick' }
/** `chart:mouseover` 负载 */
export type ChartMouseOverPayload = ChartEventPayloadBase & { type: 'mouseover' }
/** `chart:mouseout` 负载 */
export type ChartMouseOutPayload = ChartEventPayloadBase & { type: 'mouseout' }
/** `chart:mousemove` 负载 */
export type ChartMouseMovePayload = ChartEventPayloadBase & { type: 'mousemove' }
/** `chart:mousedown` 负载 */
export type ChartMouseDownPayload = ChartEventPayloadBase & { type: 'mousedown' }
/** `chart:mouseup` 负载 */
export type ChartMouseUpPayload = ChartEventPayloadBase & { type: 'mouseup' }

/** 图例切换负载 */
export interface LegendTogglePayload {
  seriesIndex: number
  seriesName?: string
  visible: boolean
}

/** 渲染完成负载 */
export interface RenderedPayload {
  /** 渲染耗时（毫秒） */
  duration: number
  /** 图表类型 */
  type: string
}

/** 相机变化负载 */
export interface CameraChangePayload {
  position: { x: number; y: number; z: number }
  target: { x: number; y: number; z: number }
}

/** 事件名 -> 负载 的映射表 */
export interface ChartEventMap {
  'chart:click': ChartClickPayload
  'chart:dblclick': ChartDblClickPayload
  'chart:mouseover': ChartMouseOverPayload
  'chart:mouseout': ChartMouseOutPayload
  'chart:mousemove': ChartMouseMovePayload
  'chart:mousedown': ChartMouseDownPayload
  'chart:mouseup': ChartMouseUpPayload
  'chart:rendered': RenderedPayload
  'chart:dispose': { type: string }
  'legend:toggle': LegendTogglePayload
  'camera:change': CameraChangePayload
  resize: { width: number; height: number }
}

/** 所有事件名 */
export type ChartEventType = keyof ChartEventMap

/** 指定事件的负载类型 */
export type ChartEventPayload<T extends ChartEventType> = ChartEventMap[T]

/** 取消订阅函数 */
export type Unsubscribe = () => void

/** 提示框展示数据（内部结构） */
export interface TooltipData {
  title?: string
  seriesName?: string
  value: number | number[]
  color: string
  dataIndex: number
  seriesIndex: number
  /** 屏幕坐标 */
  x: number
  y: number
  /** 百分比 */
  percent?: number
  /** 是否显示 */
  visible: boolean
}

/** 图例项 */
export interface LegendItem {
  name: string
  color: string
  seriesIndex: number
  visible: boolean
  /** 标记形状，饼图等使用扇形 */
  symbol?: 'rect' | 'circle'
}
