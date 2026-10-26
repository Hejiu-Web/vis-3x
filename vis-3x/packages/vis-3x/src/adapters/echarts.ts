/**
 * vis-3x — ECharts 风格配置适配器
 *
 * 让熟悉 ECharts 的使用者可以复用已有的 option 结构，
 * 由本适配器转换为 vis-3x 的配置项。
 *
 * 支持转换：
 * - `series[].type`（bar/line/pie/scatter/surface/radar/gauge/heatmap/funnel）
 * - `xAxis.data` / `yAxis.min|max|name` / `zAxis`
 * - `color` 调色板
 * - `backgroundColor` / `legend` / `tooltip` / `title` / `grid`
 * - `visualMap`（heatmap / surface 色带）
 */
import type { Vis3xOption } from '../types/option'
import type { Series3D, SeriesType } from '../types/series'
import type { Axis3D } from '../types/axis'
import type { ThemeConfig } from '../types/environment'

/** 简化的 ECharts 配置类型 */
export interface EchartsLikeOption {
  color?: string[]
  backgroundColor?: string | null
  title?: {
    show?: boolean
    text?: string
    subtext?: string
    left?: string | number
    top?: string | number
    textStyle?: Record<string, unknown>
    subtextStyle?: Record<string, unknown>
  }
  legend?: {
    show?: boolean
    bottom?: string | number
    top?: string | number
    left?: string | number
    right?: string | number
    textStyle?: { color?: string; fontSize?: number }
    icon?: string
  }
  tooltip?: {
    show?: boolean
    backgroundColor?: string
    borderColor?: string
    textStyle?: { color?: string; fontSize?: number }
  }
  grid?: {
    boxWidth?: number
    boxHeight?: number
    boxDepth?: number
  }
  xAxis?: EchartsLikeAxis | EchartsLikeAxis[]
  yAxis?: EchartsLikeAxis | EchartsLikeAxis[]
  zAxis?: EchartsLikeAxis | EchartsLikeAxis[]
  radar?: {
    indicator?: Array<{ name?: string; max?: number; min?: number }>
    radius?: number
    splitNumber?: number
    startAngle?: number
  }
  visualMap?: {
    min?: number
    max?: number
    inRange?: { color?: string[] }
    color?: string[]
  }
  series?: EchartsLikeSeries[]
}

interface EchartsLikeAxis {
  type?: string
  name?: string
  data?: Array<string | number>
  min?: number
  max?: number
  interval?: number
  axisLine?: { show?: boolean; lineStyle?: { color?: string; width?: number } }
  axisLabel?: { show?: boolean; color?: string; fontSize?: number; formatter?: unknown }
  splitLine?: { show?: boolean; lineStyle?: { color?: string; opacity?: number } }
  nameTextStyle?: { color?: string; fontSize?: number }
}

interface EchartsLikeSeries {
  type?: string
  name?: string
  data?: unknown[]
  stack?: string
  barWidth?: number | string
  barDepth?: number | string
  smooth?: boolean
  symbolSize?: number
  showSymbol?: boolean
  itemStyle?: Record<string, unknown>
  lineStyle?: Record<string, unknown>
  areaStyle?: Record<string, unknown>
  label?: Record<string, unknown>
  color?: string[]
  radius?: number | string | [number | string, number | string]
  roseType?: string | boolean
  center?: [number | string, number | string]
  depth?: number
  startAngle?: number
  endAngle?: number
  min?: number
  max?: number
  splitNumber?: number
  axisLine?: { lineStyle?: { width?: number; color?: unknown } }
  progress?: { show?: boolean; itemStyle?: Record<string, unknown> }
  pointer?: { show?: boolean; length?: string | number; width?: number; itemStyle?: Record<string, unknown> }
  detail?: { show?: boolean; formatter?: unknown; fontSize?: number; color?: string }
  xAxisData?: unknown[]
  yAxisData?: unknown[]
  wireframe?: { show?: boolean }
  sort?: string
  gap?: number
  funnelAlign?: string
  gridSize?: number | [number, number]
  nodeScaleRatio?: number
}

/** ECharts 类型 -> vis-3x 类型 */
function mapSeriesType(type: string | undefined): SeriesType {
  switch (type) {
    case 'bar':
    case 'bar3D':
      return 'bar3D'
    case 'line':
    case 'line3D':
      return 'line3D'
    case 'pie':
    case 'pie3D':
      return 'pie3D'
    case 'scatter':
    case 'scatter3D':
    case 'effectScatter':
      return 'scatter3D'
    case 'surface':
    case 'surface3D':
      return 'surface3D'
    case 'radar':
    case 'radar3D':
      return 'radar3D'
    case 'gauge':
    case 'gauge3D':
      return 'gauge3D'
    case 'heatmap':
    case 'heatmap3D':
      return 'heatmap3D'
    case 'funnel':
    case 'funnel3D':
      return 'funnel3D'
    case 'area':
    case 'area3D':
      return 'area3D'
    default:
      return 'bar3D'
  }
}

/** 转换坐标轴 */
function convertAxis(axis?: EchartsLikeAxis | EchartsLikeAxis[]): Axis3D | undefined {
  if (!axis) return undefined
  const a = Array.isArray(axis) ? axis[0] : axis
  if (!a) return undefined
  const result: Axis3D = {
    show: true,
    type: a.type === 'category' ? 'category' : 'value',
    name: a.name,
    min: a.min,
    max: a.max,
    interval: a.interval,
  }
  if (a.data?.length) {
    result.data = a.data
    result.type = 'category'
  }
  if (a.axisLine) {
    result.axisLine = {
      show: a.axisLine.show !== false,
      lineStyle: {
        color: a.axisLine.lineStyle?.color,
        width: a.axisLine.lineStyle?.width,
      },
    }
  }
  if (a.axisLabel) {
    result.axisLabel = {
      show: a.axisLabel.show !== false,
      textStyle: {
        color: a.axisLabel.color,
        fontSize: a.axisLabel.fontSize,
      },
    }
  }
  if (a.splitLine) {
    result.splitLine = {
      show: a.splitLine.show !== false,
      lineStyle: {
        color: a.splitLine.lineStyle?.color,
        opacity: a.splitLine.lineStyle?.opacity,
      },
    }
  }
  if (a.nameTextStyle) {
    result.nameStyle = {
      show: true,
      text: a.name,
      textStyle: {
        color: a.nameTextStyle.color,
        fontSize: a.nameTextStyle.fontSize,
      },
    }
  }
  return result
}

/** 解析 radius 写法：[内, 外] 或 单一半径（按百分比映射到世界单位） */
function parseRadius(
  radius: number | string | [number | string, number | string] | undefined,
  base = 3.4
): { radius: number; innerRadius: number } {
  const toWorld = (v: number | string): number => {
    if (typeof v === 'number') return (v / 100) * base * 2
    const parsed = parseFloat(String(v))
    return Number.isFinite(parsed) ? (parsed / 100) * base * 2 : base
  }
  if (radius === undefined) return { radius: base, innerRadius: 0 }
  if (Array.isArray(radius)) {
    return { innerRadius: toWorld(radius[0]), radius: toWorld(radius[1]) }
  }
  return { radius: toWorld(radius), innerRadius: 0 }
}

/** 解析百分比数值（如 '60%' -> 0.6） */
function parsePercent(value: unknown, fallback: number): number {
  if (typeof value === 'number') return value > 1 ? value / 100 : value
  if (typeof value === 'string') {
    const n = parseFloat(value)
    return Number.isFinite(n) ? n / 100 : fallback
  }
  return fallback
}

/**
 * 把 ECharts 风格的配置转换为 vis-3x 配置
 */
export function fromEchartsLikeOption(option: EchartsLikeOption): Vis3xOption {
  const xAxis = convertAxis(option.xAxis)
  const yAxis = convertAxis(option.yAxis)
  const zAxis = convertAxis(option.zAxis)

  // 主题
  const theme: ThemeConfig = {}
  if (option.color?.length) theme.palette = option.color
  if (option.backgroundColor !== undefined) theme.backgroundColor = option.backgroundColor ?? undefined
  if (option.legend?.textStyle?.color) theme.textColor = option.legend.textStyle.color
  if (option.xAxis) {
    const ax = Array.isArray(option.xAxis) ? option.xAxis[0] : option.xAxis
    if (ax?.axisLabel?.color) theme.textColor = ax.axisLabel.color
    if (ax?.splitLine?.lineStyle?.color) theme.splitLineColor = ax.splitLine.lineStyle.color
  }

  // 网格尺寸
  const gridFloor = {
    show: true,
    showShadowPlane: true,
    showWall: false,
  }

  // 系列转换
  const series: Series3D[] = []
  const visualMapColors = option.visualMap?.inRange?.color ?? option.visualMap?.color

  for (const s of option.series ?? []) {
    const type = mapSeriesType(s.type)
    const base = {
      name: s.name,
      type,
      visible: true,
    } as unknown as Series3D

    switch (type) {
      case 'bar3D': {
        Object.assign(base, {
          data: (s.data ?? []) as never,
          stack: s.stack,
          barWidth: s.barWidth as number | undefined,
          barDepth: s.barDepth as number | undefined,
          color: s.color,
          itemStyle: s.itemStyle as never,
          label: s.label as never,
        })
        break
      }
      case 'line3D': {
        Object.assign(base, {
          data: (s.data ?? []) as never,
          smooth: s.smooth,
          showSymbol: s.showSymbol ?? s.symbolSize !== undefined,
          symbolSize: s.symbolSize,
          lineStyle: s.lineStyle as never,
          color: s.color,
        })
        break
      }
      case 'area3D': {
        Object.assign(base, {
          data: (s.data ?? []) as never,
          smooth: s.smooth,
          areaStyle: s.areaStyle as never,
          lineStyle: s.lineStyle as never,
          color: s.color,
        })
        break
      }
      case 'pie3D': {
        const { radius, innerRadius } = parseRadius(s.radius)
        Object.assign(base, {
          data: (s.data ?? []) as never,
          radius,
          innerRadius,
          depth: s.depth ?? 0.85,
          startAngle: s.startAngle ?? 90,
          roseType: s.roseType === 'radius' || s.roseType === 'area' ? s.roseType : false,
          color: s.color,
          itemStyle: s.itemStyle as never,
          label: s.label as never,
        })
        break
      }
      case 'scatter3D': {
        Object.assign(base, {
          data: (s.data ?? []) as never,
          symbolSize: s.symbolSize,
          pointStyle: s.itemStyle ? ({ ...s.itemStyle } as never) : undefined,
          color: s.color,
        })
        break
      }
      case 'surface3D': {
        Object.assign(base, {
          data: (s.data ?? []) as number[][],
          colorGradient: visualMapColors,
          wireframe: s.wireframe as never,
        })
        break
      }
      case 'radar3D': {
        Object.assign(base, {
          data: (s.data ?? []) as never,
          areaStyle: s.areaStyle as never,
          lineStyle: s.lineStyle as never,
          color: s.color,
        })
        break
      }
      case 'gauge3D': {
        const progress = s.progress?.itemStyle as { color?: string } | undefined
        Object.assign(base, {
          data: (s.data ?? []) as never,
          min: s.min ?? 0,
          max: s.max ?? 100,
          startAngle: s.startAngle ?? 225,
          endAngle: s.endAngle ?? -45,
          splitNumber: s.splitNumber ?? 5,
          axisWidth: parsePercent(
            (s.axisLine?.lineStyle?.width as unknown) ?? 12,
            0.16
          ) * 6,
          progressStyle: progress,
          pointer: s.pointer
            ? {
                show: s.pointer.show !== false,
                length:
                  typeof s.pointer.length === 'number'
                    ? s.pointer.length
                    : parsePercent(s.pointer.length, 0.72) * 3.4,
                width: s.pointer.width,
                color: (s.pointer.itemStyle as { color?: string } | undefined)?.color,
              }
            : undefined,
          detail: s.detail
            ? {
                show: s.detail.show !== false,
                formatter:
                  typeof s.detail.formatter === 'string' || typeof s.detail.formatter === 'function'
                    ? (s.detail.formatter as string | ((v: number) => string))
                    : undefined,
                fontSize: s.detail.fontSize,
                color: s.detail.color,
              }
            : undefined,
          color: s.color,
        })
        break
      }
      case 'heatmap3D': {
        Object.assign(base, {
          data: (s.data ?? []) as never,
          colorGradient: visualMapColors,
          valueRange:
            option.visualMap?.min !== undefined && option.visualMap?.max !== undefined
              ? [option.visualMap.min, option.visualMap.max]
              : undefined,
          xAxisData: s.xAxisData as never,
          zAxisData: s.yAxisData as never,
          label: s.label as never,
        })
        break
      }
      case 'funnel3D': {
        Object.assign(base, {
          data: (s.data ?? []) as never,
          sort: (s.sort as 'ascending' | 'descending' | 'none') ?? 'descending',
          gap: s.gap,
          color: s.color,
          label: s.label as never,
        })
        break
      }
      default:
        break
    }
    series.push(base)
  }

  return {
    type: 'auto',
    series,
    xAxis3D: xAxis,
    yAxis3D: yAxis,
    zAxis3D: zAxis,
    radar: option.radar
      ? {
          indicator: option.radar.indicator,
          radius: option.radar.radius,
          splitNumber: option.radar.splitNumber,
          startAngle: option.radar.startAngle,
        }
      : undefined,
    theme: Object.keys(theme).length ? theme : undefined,
    backgroundColor: option.backgroundColor ?? undefined,
    legend: option.legend
      ? {
          show: option.legend.show !== false,
          position: option.legend.bottom !== undefined ? 'bottom' : 'top',
          color: option.legend.textStyle?.color,
          fontSize: option.legend.textStyle?.fontSize,
          iconSize: parsePercent(
            (option.legend as { itemWidth?: number }).itemWidth ?? 12,
            12
          ),
        }
      : undefined,
    tooltip: option.tooltip
      ? {
          show: option.tooltip.show !== false,
          backgroundColor: option.tooltip.backgroundColor,
          borderColor: option.tooltip.borderColor,
          color: option.tooltip.textStyle?.color,
          fontSize: option.tooltip.textStyle?.fontSize,
        }
      : undefined,
    title: option.title
      ? {
          show: option.title.show !== false,
          text: option.title.text,
          subtext: option.title.subtext,
          left: option.title.left as string | number | undefined,
          top: option.title.top as string | number | undefined,
          textStyle: option.title.textStyle as never,
          subtextStyle: option.title.subtextStyle as never,
        }
      : undefined,
    gridFloor,
  }
}

/**
 * vis-3x 配置 -> ECharts 风格（反向转换，便于调试与迁移核对）
 */
export function toVis3xOption(option: EchartsLikeOption): Vis3xOption {
  return fromEchartsLikeOption(option)
}
