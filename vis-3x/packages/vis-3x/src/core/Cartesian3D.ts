/**
 * vis-3x — 3D 笛卡尔坐标系
 *
 * 负责：
 * - 数据值 ↔ 世界坐标 的双向映射（三个轴各自独立）
 * - 柱子 / 点位的尺寸计算（间距、宽度、深度）
 * - 网格尺寸推导
 *
 * 坐标约定（与 Three.js 一致）：
 * - X 轴向右
 * - Y 轴向上（数值轴）
 * - Z 轴向前（面向观察者），类目/深度轴
 */
import * as THREE from 'three'
import type { Axis3D } from '../types/axis'
import type { Series3D } from '../types/series'
import { extractScalar, extractName } from '../types/series'
import { extent, niceExtent, isValidNumber } from '../utils/math'

/** 单个轴的映射信息 */
export interface AxisMapping {
  /** 类目列表（类目轴） */
  categories: string[]
  /** 数值范围 [min, max] */
  domain: [number, number]
  /** 世界坐标长度 */
  length: number
  /** 轴类型 */
  type: 'category' | 'value'
  /** 轴配置 */
  config: Axis3D
}

/** 笛卡尔坐标系配置 */
export interface CartesianConfig {
  gridWidth: number
  gridHeight: number
  gridDepth: number
}

/** 默认网格尺寸（世界单位） */
export const DEFAULT_GRID: CartesianConfig = {
  gridWidth: 10,
  gridHeight: 6,
  gridDepth: 6,
}

/** 数据范围统计结果 */
export interface DataExtent {
  min: number
  max: number
  /** 是否全部为负 / 含负值 */
  hasNegative: boolean
}

/**
 * 由系列数据推导出数值轴范围
 *
 * 支持堆叠（同名 stack 的系列正负分别累加）。
 */
export function computeValueExtent(seriesList: Series3D[]): DataExtent {
  let min = 0
  let max = 0
  let hasNegative = false

  // 堆叠累加器：stackName -> index -> value
  const positiveStacks = new Map<string, number[]>()
  const negativeStacks = new Map<string, number[]>()

  for (const series of seriesList) {
    if (series.visible === false) continue
    // 曲面/热力等非一维系列不参与数值轴推导
    if (series.type === 'surface3D') {
      const matrix = series.data as number[][]
      for (const row of matrix) {
        for (const v of row) {
          if (!isValidNumber(v)) continue
          if (v < min) min = v
          if (v > max) max = v
          if (v < 0) hasNegative = true
        }
      }
      continue
    }
    if (series.type === 'heatmap3D') {
      const cells = series.data as Array<
        [number, number, number] | { value: [number, number, number] }
      >
      for (const item of cells) {
        const v = Array.isArray(item) ? item[2] : item.value?.[2]
        if (!isValidNumber(v)) continue
        if (v < min) min = v
        if (v > max) max = v
        if (v < 0) hasNegative = true
      }
      continue
    }
    // 饼图/漏斗/仪表/雷达/关系图不使用笛卡尔数值轴
    if (
      series.type === 'pie3D' ||
      series.type === 'funnel3D' ||
      series.type === 'gauge3D' ||
      series.type === 'radar3D'
    ) {
      continue
    }

    const data = (series as { data?: unknown[] }).data ?? []
    const values = data.map((item) => {
      const v = extractScalar(item as never)
      return isValidNumber(v) ? v : 0
    })

    // 堆叠：仅柱状/面积等 BaseSeries 支持 stack
    const stackName = (series as { stack?: string }).stack

    if (stackName) {
      const target = positiveStacks
      const negative = negativeStacks
      const posArr = target.get(stackName) ?? []
      const negArr = negative.get(stackName) ?? []
      values.forEach((v, i) => {
        if (v >= 0) posArr[i] = (posArr[i] ?? 0) + v
        else negArr[i] = (negArr[i] ?? 0) + v
      })
      target.set(stackName, posArr)
      negative.set(stackName, negArr)
      continue
    }

    for (const v of values) {
      if (!isValidNumber(v)) continue
      if (v < min) min = v
      if (v > max) max = v
      if (v < 0) hasNegative = true
    }
  }

  // 统计堆叠结果
  for (const arr of positiveStacks.values()) {
    for (const v of arr) {
      if (v > max) max = v
    }
  }
  for (const arr of negativeStacks.values()) {
    for (const v of arr) {
      if (v < min) min = v
      if (v < 0) hasNegative = true
    }
  }

  if (min === 0 && max === 0) max = 1
  return { min, max, hasNegative }
}

/**
 * 笛卡尔坐标系
 *
 * 使用方式：先 `setData()` 分析数据，再通过 `xAt()` / `yAt()` / `zAt()` 取值。
 */
export class Cartesian3D {
  /** 网格尺寸 */
  config: CartesianConfig
  /** X 轴映射 */
  xAxis: AxisMapping
  /** Y 轴映射（数值轴） */
  yAxis: AxisMapping
  /** Z 轴映射 */
  zAxis: AxisMapping
  /** 数值范围是否含负值 */
  hasNegative = false
  /** 类目数量 */
  categoryCount = 0

  constructor(config: Partial<CartesianConfig> = {}) {
    this.config = { ...DEFAULT_GRID, ...config }
    this.xAxis = this.createMapping([], [0, 1], this.config.gridWidth, 'value', {})
    this.yAxis = this.createMapping([], [0, 1], this.config.gridHeight, 'value', {})
    this.zAxis = this.createMapping([], [0, 1], this.config.gridDepth, 'value', {})
  }

  private createMapping(
    categories: string[],
    domain: [number, number],
    length: number,
    type: 'category' | 'value',
    config: Axis3D
  ): AxisMapping {
    return { categories, domain, length, type, config }
  }

  /**
   * 根据系列与轴配置初始化坐标系
   *
   * @param seriesList 系列列表
   * @param xAxisConfig X 轴配置
   * @param yAxisConfig Y 轴配置
   * @param zAxisConfig Z 轴配置
   */
  setData(
    seriesList: Series3D[],
    xAxisConfig: Axis3D = {},
    yAxisConfig: Axis3D = {},
    zAxisConfig: Axis3D = {}
  ): void {
    /* -------------------------- X 轴 -------------------------- */
    const explicitX = xAxisConfig.data?.map((v) => String(v)) ?? []
    let categories: string[] = explicitX

    if (!categories.length) {
      // 从数据推断类目：取最长系列的长度
      let maxLength = 0
      let sample: Series3D | undefined
      for (const s of seriesList) {
        if ('data' in s && Array.isArray(s.data) && s.data.length > maxLength) {
          maxLength = s.data.length
          sample = s
        }
      }
      if (sample && 'data' in sample && Array.isArray(sample.data)) {
        categories = (sample.data as unknown[]).map((item, i) => {
          const name = extractName(item as never, undefined)
          return name ?? String(i + 1)
        })
      }
    }

    this.categoryCount = categories.length
    const xType: 'category' | 'value' =
      xAxisConfig.type === 'value' ? 'value' : categories.length ? 'category' : 'value'

    this.xAxis = this.createMapping(
      categories,
      xAxisConfig.min !== undefined || xAxisConfig.max !== undefined
        ? [xAxisConfig.min ?? 0, xAxisConfig.max ?? Math.max(1, categories.length - 1)]
        : [0, Math.max(1, categories.length - 1)],
      this.config.gridWidth,
      xType === 'value' ? 'value' : 'category',
      xAxisConfig
    )

    /* -------------------------- Y 轴 -------------------------- */
    const ext = computeValueExtent(seriesList)
    this.hasNegative = ext.hasNegative

    let yMin = yAxisConfig.min !== undefined ? yAxisConfig.min : ext.min
    let yMax = yAxisConfig.max !== undefined ? yAxisConfig.max : ext.max

    if (yAxisConfig.min === undefined || yAxisConfig.max === undefined) {
      // 自动留出顶部空间，视觉更舒适
      const span = yMax - yMin || 1
      if (yAxisConfig.max === undefined) yMax = yMax + span * 0.08
      if (yAxisConfig.min === undefined) yMin = yMin < 0 ? yMin - span * 0.08 : 0
      const [niceMin, niceMax] = niceExtent(yMin, yMax, 5)
      if (yAxisConfig.min === undefined) yMin = Math.min(niceMin, yMin)
      if (yAxisConfig.max === undefined) yMax = Math.max(niceMax, yMax)
    }
    if (yMin === yMax) yMax = yMin + 1

    this.yAxis = this.createMapping([], [yMin, yMax], this.config.gridHeight, 'value', yAxisConfig)

    /* -------------------------- Z 轴 -------------------------- */
    // Z 轴默认表示「系列维」，用于多系列并列；也可由使用者传入 data 作为深度类目
    const zCategories = zAxisConfig.data?.map((v) => String(v)) ?? []
    this.zAxis = this.createMapping(
      zCategories,
      [zAxisConfig.min ?? 0, zAxisConfig.max ?? Math.max(1, zCategories.length - 1)],
      this.config.gridDepth,
      zCategories.length ? 'category' : 'value',
      zAxisConfig
    )
  }

  /** 设置网格尺寸 */
  setGridSize(config: Partial<CartesianConfig>): void {
    this.config = { ...this.config, ...config }
    this.xAxis.length = this.config.gridWidth
    this.yAxis.length = this.config.gridHeight
    this.zAxis.length = this.config.gridDepth
  }

  /* ------------------------------------------------------------------ */
  /*                            坐标映射方法                             */
  /* ------------------------------------------------------------------ */

  /**
   * 类目索引 -> 世界 X 坐标
   *
   * 类目均匀分布在网格宽度上，两端各留半个步长的边距，
   * 使柱子完整落在网格内部。
   */
  xAtCategory(index: number, total = this.categoryCount): number {
    const count = Math.max(1, total)
    const step = this.config.gridWidth / count
    return -this.config.gridWidth / 2 + step * (index + 0.5)
  }

  /** 类目步长（世界单位） */
  get xStep(): number {
    const count = Math.max(1, this.categoryCount)
    return this.config.gridWidth / count
  }

  /**
   * X 轴取值：
   * - 类目轴：传入索引
   * - 数值轴：传入数值
   */
  xAt(value: number): number {
    if (this.xAxis.type === 'category') {
      return this.xAtCategory(value)
    }
    return this.valueToWorld(value, this.xAxis, 'x')
  }

  /** 数值 -> 世界 Y 坐标 */
  yAt(value: number): number {
    return this.valueToWorld(value, this.yAxis, 'y')
  }

  /**
   * Z 轴取值
   * - 类目轴：传入索引
   * - 数值轴：传入数值
   */
  zAt(value: number): number {
    if (this.zAxis.type === 'category' && this.zAxis.categories.length) {
      const count = this.zAxis.categories.length
      const step = this.config.gridDepth / count
      // 注意：Z 轴正向朝向观察者，索引 0 放在最靠前，视觉上更符合直觉
      return this.config.gridDepth / 2 - step * (value + 0.5)
    }
    return this.valueToWorld(value, this.zAxis, 'z')
  }

  /** 数值 -> 世界坐标（内部通用实现） */
  private valueToWorld(value: number, axis: AxisMapping, dimension: 'x' | 'y' | 'z'): number {
    const [min, max] = axis.domain
    const span = max - min || 1
    const t = (value - min) / span
    const length = axis.length
    if (dimension === 'y') {
      // Y 轴从 0 向上增长；若有负值，0 平面位于网格中部
      return t * length
    }
    // X / Z 轴以原点为中心
    return (t - 0.5) * length
  }

  /** 世界 Y 坐标 -> 数值（用于交互反查） */
  yToValue(worldY: number): number {
    const [min, max] = this.yAxis.domain
    const span = max - min
    return min + (worldY / (this.yAxis.length || 1)) * span
  }

  /** 世界 X 坐标 -> 类目索引（就近） */
  xToCategoryIndex(worldX: number): number {
    const step = this.xStep
    const index = Math.floor((worldX + this.config.gridWidth / 2) / step)
    return Math.max(0, Math.min(this.categoryCount - 1, index))
  }

  /* ------------------------------------------------------------------ */
  /*                            派生几何信息                             */
  /* ------------------------------------------------------------------ */

  /** 数值轴在网格高度上的缩放比例（世界单位 / 数值单位） */
  get yScaleFactor(): number {
    const [min, max] = this.yAxis.domain
    return this.config.gridHeight / (max - min || 1)
  }

  /** 是否含负值（决定柱子从 y=0 平面向上下延伸） */
  get zeroPlaneY(): number {
    return this.yAt(0)
  }

  /**
   * 计算多系列并行时的柱子定位
   *
   * @param seriesIndex 当前系列索引
   * @param seriesCount 同图系列总数（仅统计柱状类）
   * @param barGap 系列内间隙比例
   * @param barCategoryGap 系列间间隙比例
   */
  getBarSlot(
    seriesIndex: number,
    seriesCount: number,
    barGap = 0.1,
    barCategoryGap = 0.3
  ): { width: number; offset: number } {
    const step = this.xStep
    const usable = step * (1 - barCategoryGap)
    const groupCount = Math.max(1, seriesCount)
    const width = Math.max(0.01, usable / groupCount - step * barGap * 0.1)
    const totalWidth = width * groupCount
    const startOffset = -totalWidth / 2 + width / 2
    return {
      width,
      offset: startOffset + width * seriesIndex,
    }
  }

  /** 网格包围盒（用于相机自适应） */
  getBounds(): THREE.Box3 {
    const halfW = this.config.gridWidth / 2
    const halfD = this.config.gridDepth / 2
    return new THREE.Box3(
      new THREE.Vector3(-halfW, 0, -halfD),
      new THREE.Vector3(halfW, this.config.gridHeight, halfD)
    )
  }

  /** 网格中心 */
  getCenter(): THREE.Vector3 {
    return new THREE.Vector3(0, this.config.gridHeight / 2, 0)
  }

  /** 数值轴刻度（用于绘制分割线） */
  getYTicks(count = 5): number[] {
    const [min, max] = this.yAxis.domain
    const ticks = niceExtentList(min, max, count)
    return ticks
  }

  /** 格式化类目名 */
  categoryName(index: number): string {
    return this.xAxis.categories[index] ?? String(index + 1)
  }
}

/** 生成刻度列表（内部使用） */
function niceExtentList(min: number, max: number, count: number): number[] {
  const span = max - min
  if (!Number.isFinite(span) || span <= 0) return [min, max]
  const rawStep = span / Math.max(1, count)
  const mag = 10 ** Math.floor(Math.log10(rawStep))
  const norm = rawStep / mag
  const step = (norm <= 1 ? 1 : norm <= 2 ? 2 : norm <= 5 ? 5 : 10) * mag
  const start = Math.ceil(min / step) * step
  const out: number[] = []
  for (let v = start; v <= max + step * 1e-6 && out.length < 500; v += step) {
    out.push(Math.round(v * 1e6) / 1e6)
  }
  if (!out.length) out.push(min, max)
  return out
}

/** 根据系列集合自动推荐网格尺寸（保持视觉比例协调） */
export function autoGridSize(
  categoryCount: number,
  seriesCount: number,
  hasMultipleSeries: boolean
): CartesianConfig {
  const width = Math.max(8, Math.min(16, categoryCount * 1.35))
  const depth = hasMultipleSeries ? Math.max(5, Math.min(11, seriesCount * 2.6)) : 6
  const { max } = { max: 0 }
  void max
  const height = Math.max(4.5, Math.min(8.5, width * 0.55))
  return { gridWidth: width, gridHeight: height, gridDepth: depth }
}

/** 计算一组数值的统计信息（供扩展使用） */
export function statValues(values: number[]): { min: number; max: number; avg: number } {
  const [min, max] = extent(values)
  const total = values.reduce((a, b) => a + (isValidNumber(b) ? b : 0), 0)
  return { min, max, avg: values.length ? total / values.length : 0 }
}
