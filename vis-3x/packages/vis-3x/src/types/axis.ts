/**
 * vis-3x — 坐标轴类型定义
 */
import type { LineStyle, TextStyle, ColorLike } from './style'

/** 轴线 */
export interface AxisLine {
  show?: boolean
  lineStyle?: LineStyle
}

/** 轴刻度线 */
export interface AxisTick {
  show?: boolean
  /** 刻度线长度（世界单位） */
  length?: number
  lineStyle?: LineStyle
}

/** 轴文字标签 */
export interface AxisLabel {
  show?: boolean
  textStyle?: TextStyle
  /** 数值格式化：小数位 */
  precision?: number
  /** 数值缩写（12000 -> 1.2万） */
  abbreviate?: boolean
  /** 自定义格式化函数 */
  formatter?: (value: string | number, index: number) => string
  /** 标签与轴线的距离 */
  margin?: number
}

/** 分割线（网格线） */
export interface SplitLine {
  show?: boolean
  lineStyle?: LineStyle
  /** 分割段数，不传则根据数据自动计算 */
  splitNumber?: number
  /** 是否显示交替背景色带 */
  showSplitArea?: boolean
  /** 交替背景色，例如 ['rgba(255,255,255,0.02)', 'rgba(255,255,255,0.05)'] */
  splitAreaColors?: ColorLike[]
}

/** 轴名称（如 "X轴"） */
export interface AxisName {
  show?: boolean
  text?: string
  textStyle?: TextStyle
  /** 与轴线的距离 */
  margin?: number
}

/**
 * 3D 坐标轴配置
 */
export interface Axis3D {
  show?: boolean
  /** 轴类型 */
  type?: 'category' | 'value' | 'time'
  /** 轴名称 */
  name?: string
  /** 名称配置（优先于 name 的简单配置） */
  nameStyle?: AxisName
  /** 类目轴数据 */
  data?: Array<string | number>
  /** 数值轴最小值，不传自动 */
  min?: number
  /** 数值轴最大值，不传自动 */
  max?: number
  /** 强制刻度间隔 */
  interval?: number
  axisLine?: AxisLine
  axisTick?: AxisTick
  axisLabel?: AxisLabel
  splitLine?: SplitLine
  /** 轴线颜色（axisLine.lineStyle.color 的快捷写法） */
  color?: ColorLike
}

/** 雷达图指示器 */
export interface RadarIndicator {
  name?: string
  max?: number
  min?: number
}

/** 雷达图坐标系配置 */
export interface RadarConfig {
  /** 指示器列表 */
  indicator?: RadarIndicator[]
  /** 半径（世界单位），不传自动 */
  radius?: number
  /** 分割段数 */
  splitNumber?: number
  /** 起始角度（度） */
  startAngle?: number
  /** 轴线 */
  axisLine?: AxisLine
  /** 标签 */
  axisLabel?: AxisLabel
  /** 分割线（蛛网） */
  splitLine?: SplitLine
  /** 分割区域填充 */
  splitArea?: {
    show?: boolean
    colors?: ColorLike[]
    opacity?: number
  }
  /** 名称样式 */
  nameStyle?: TextStyle
}
