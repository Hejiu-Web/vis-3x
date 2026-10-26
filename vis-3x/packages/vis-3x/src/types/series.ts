/**
 * vis-3x — 系列（series）类型定义
 *
 * 系列是「数据 + 样式」的容器。每种图表类型对应一个 Series 接口，
 * 通过 `type` 字段区分，并借助可辨识联合类型获得完整的类型推导。
 */
import type {
  ItemStyle,
  LineStyle,
  AreaStyle,
  LabelStyle,
  PointStyle,
  TextStyle,
  ColorInput,
  BorderStyle,
} from './style'

/** 内置 3D 系列类型标识 */
export type BuiltinSeriesType =
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
 * 所有 3D 系列类型标识
 *
 * 与 `ChartType` 同理：除内置类型外，通过 `defineChart` / `extendChart` /
 * `registerChart` 注册的自定义类型也是合法取值，因此联合了 `string`，
 * 同时保留字面量以获得内置类型的自动补全与收窄。
 *
 * @example
 * ```ts
 * // 内置类型会被收窄为具体系列接口（如 Bar3DSeries）
 * const s: Series3D = { type: 'bar3D', data: [1, 2, 3] }
 *
 * // 自定义类型也可直接使用
 * const c: Series3D = { type: 'lollipop3D', data: [1, 2, 3] }
 * ```
 */
export type SeriesType = BuiltinSeriesType | (string & {})

/** 数据项基类 */
export interface BaseDataItem {
  name?: string
  itemStyle?: ItemStyle
  label?: LabelStyle
}

/** 单值数据项 */
export interface SingleValueDataItem extends BaseDataItem {
  value: number
}

/** 多值（坐标）数据项 */
export interface MultiValueDataItem extends BaseDataItem {
  value: number[]
}

/** 允许的数据项写法 */
export type DataItem = number | number[] | SingleValueDataItem | MultiValueDataItem

/** 通用系列配置 */
export interface BaseSeries<TItem = DataItem> {
  /** 系列名，用于图例与提示框 */
  name?: string
  /** 系列类型 */
  type: SeriesType
  /** 数据 */
  data: TItem[]
  /** 系列调色板，不传则使用主题色 */
  color?: string[]
  /** 数据项默认样式 */
  itemStyle?: ItemStyle
  /** 数据项默认标签 */
  label?: LabelStyle
  /** 是否参与堆叠（柱状/面积），同名 stack 的系列会堆叠 */
  stack?: string
  /** 系列是否可见（配合图例切换） */
  visible?: boolean
  /** 该系列的动画配置 */
  animation?: AnimationConfig
  /** 关联的坐标轴索引（多轴场景预留） */
  xAxisIndex?: number
  yAxisIndex?: number
  zAxisIndex?: number
}

/**
 * 柱状图系列
 *
 * @example
 * ```ts
 * { type: 'bar3D', data: [120, 200, 150], barWidth: 4, barDepth: 4 }
 * ```
 */
export interface Bar3DSeries extends BaseSeries<number | SingleValueDataItem> {
  type: 'bar3D'
  /** 柱子宽度（世界单位），不传按类目间距自动计算 */
  barWidth?: number
  /** 柱子深度 */
  barDepth?: number
  /** 同系列不同数据之间的间隙（占间距比例 0~1） */
  barGap?: number
  /** 多系列之间的间隙（占间距比例 0~1） */
  barCategoryGap?: number
  /** 柱子是否使用圆角 */
  borderRadius?: number
  /** 柱子顶部标签 */
  topLabel?: LabelStyle
  /** 是否按数值给柱子上色（渐变色带） */
  colorByValue?: boolean
  /** 顶部装饰：发光顶盖 */
  capStyle?: ItemStyle
}

/** 折线图系列 */
export interface Line3DSeries extends BaseSeries<number | SingleValueDataItem> {
  type: 'line3D'
  lineStyle?: LineStyle
  /** 是否平滑曲线（默认 true） */
  smooth?: boolean
  /** 平滑张力 0~1 */
  smoothTension?: number
  /** 是否显示数据点 */
  showSymbol?: boolean
  /** 数据点样式 */
  pointStyle?: PointStyle
  /** 数据点大小 */
  symbolSize?: number
  /** 是否在折线下方生成垂直「幕布」，增强 3D 纵深感 */
  curtain?: boolean
  /** 幕布样式 */
  curtainStyle?: AreaStyle
  /** 折线所在的高度（世界单位），默认贴合 Y 轴数值 */
  z?: number
}

/** 面积图系列 */
export interface Area3DSeries extends BaseSeries<number | SingleValueDataItem> {
  type: 'area3D'
  areaStyle?: AreaStyle
  lineStyle?: LineStyle
  smooth?: boolean
  /** 面积基准值，默认 0 */
  baseValue?: number
  /** 是否显示顶部描边 */
  showLine?: boolean
}

/**
 * 面积流图系列（块状山体）
 *
 * 每个数据点是一个**有厚度的实体块**，相邻块紧密拼合形成连绵山体。
 * 与 `line3D + curtain` 的「薄片幕布」不同，这里是真正的块状体积。
 *
 * @example
 * ```ts
 * {
 *   type: 'areaFlow3D',
 *   name: '客流',
 *   data: [820, 932, 901, 1290, 1330, 1450],
 *   blockGap: 0,                      // 块之间无缝
 *   curtainStyle: {
 *     color: '#1EE793',
 *     opacity: 0.85,
 *   },
 *   colorByValue: true,               // 越高的块越亮
 *   colorGradient: ['#0FA76A', '#1EE793', '#5EF3B6'],
 * }
 * ```
 */
export interface AreaFlow3DSeries extends BaseSeries<number | SingleValueDataItem> {
  type: 'areaFlow3D'
  /** 块体样式（主体材质） */
  curtainStyle?: AreaStyle
  /**
   * 块之间的缝隙，占槽位宽度的比例 0~0.9
   *
   * - `0` 完全贴合（默认），形成连续山体
   * - `0.2` 明显分离，呈柱状
   */
  blockGap?: number
  /** 块的 Z 方向厚度，占网格深度的比例 0~1，默认 1（占满） */
  blockDepth?: number
  /** 是否按数值高度调色，默认 false */
  colorByValue?: boolean
  /** 按值调色时的色带（从低到高） */
  colorGradient?: string[]
  /**
   * 层叠透明度
   *
   * 多系列时靠后的系列会略微变透，让前面的山体透出来。
   * 默认 `true`。
   */
  layerOpacity?: boolean
  /** 层叠透明度的最小值（默认 0.45） */
  minLayerOpacity?: number
  /** 顶面样式（单独给块的顶面上色，做出高光/描边感） */
  topStyle?: ItemStyle & {
    show?: boolean
  }
  /** 是否显示数据点（块状图不使用，保留兼容） */
  showSymbol?: boolean
  /** 平滑（块状图不使用，保留兼容） */
  smooth?: boolean
}

/** 饼图（含环形、玫瑰图）系列 */
export interface Pie3DSeries {
  type: 'pie3D'
  name?: string
  data: Array<number | SingleValueDataItem>
  color?: string[]
  itemStyle?: ItemStyle
  label?: LabelStyle
  visible?: boolean
  animation?: AnimationConfig
  /** 内半径（世界单位），>0 时成为环形图 */
  innerRadius?: number
  /** 外半径，不传自动 */
  radius?: number
  /** 饼图厚度（高度） */
  depth?: number
  /** 每块高度是否随数值变化 */
  depthByValue?: boolean
  /** 高度映射范围 [min, max]，depthByValue 为 true 时生效 */
  depthRange?: [number, number]
  /** 起始角度（度），默认 90（12 点方向） */
  startAngle?: number
  /** 每块之间的间隙角度（度） */
  padAngle?: number
  /** 玫瑰图模式：'radius' 半径线性映射，'area' 面积线性映射 */
  roseType?: 'radius' | 'area' | false
  /** 每块向外偏移距离（强调效果） */
  selectedOffset?: number
  /** 高亮块的偏移索引 */
  selectedIndex?: number
  /** 中心文字 */
  centerLabel?: {
    show?: boolean
    /** 显示总量 */
    total?: boolean
    text?: string
    textStyle?: TextStyle
  }
}

/** 散点图系列 */
export interface Scatter3DSeries extends BaseSeries<number | number[] | MultiValueDataItem> {
  type: 'scatter3D'
  pointStyle?: PointStyle
  /** 点大小 */
  symbolSize?: number
  /** 数据项格式：
   * - `[x, y]`  二维（x 为类目索引或数值，y 为高度）
   * - `[x, y, z]` 三维直角坐标
   * - `number` 仅高度（x 自动递增，z=0）
   */
  /** 是否需要按值映射尺寸 */
  sizeByValue?: boolean
}

/** 曲面图系列 */
export interface Surface3DSeries {
  type: 'surface3D'
  name?: string
  /**
   * 曲面数据：二维矩阵 data[row][col]
   * 行对应 X 方向，列对应 Z 方向
   */
  data: number[][]
  /** 调色板（曲面图主要用 colorGradient，此项用于图例等场景） */
  color?: string[]
  xAxisData?: Array<string | number>
  zAxisData?: Array<string | number>
  /** 高度范围，用于颜色映射 */
  min?: number
  max?: number
  /** 渐变色带（从低到高） */
  colorGradient?: string[]
  itemStyle?: ItemStyle
  label?: LabelStyle
  visible?: boolean
  animation?: AnimationConfig
  /** 是否叠加线框 */
  wireframe?: {
    show?: boolean
    color?: string
    opacity?: number
    /** 线框抽稀步长 */
    step?: number
  }
  /** 是否显示等高线投影到地面 */
  contour?: {
    show?: boolean
    /** 等高线层数 */
    levels?: number
    opacity?: number
  }
  /** 曲面平滑细分倍数 */
  smoothSubdivision?: number
}

/** 雷达图数据项 */
export interface Radar3DDataItem extends BaseDataItem {
  value: number[]
}

/** 雷达图系列 */
export interface Radar3DSeries {
  type: 'radar3D'
  name?: string
  data: Radar3DDataItem[]
  color?: string[]
  itemStyle?: ItemStyle
  label?: LabelStyle
  visible?: boolean
  animation?: AnimationConfig
  /** 面片样式 */
  areaStyle?: AreaStyle
  /** 描边样式 */
  lineStyle?: LineStyle
  /** 数据面片在 Z 轴上的层间距（多层雷达形成立体感） */
  layerGap?: number
  /** 是否在顶点绘制数据点 */
  showPoint?: boolean
  pointStyle?: PointStyle
}

/** 漏斗图数据项 */
export interface Funnel3DDataItem extends BaseDataItem {
  value: number
}

/** 漏斗图系列 */
export interface Funnel3DSeries {
  type: 'funnel3D'
  name?: string
  data: Array<number | Funnel3DDataItem>
  color?: string[]
  itemStyle?: ItemStyle
  label?: LabelStyle
  visible?: boolean
  animation?: AnimationConfig
  /** 漏斗总高度 */
  height?: number
  /** 顶部宽度 */
  width?: number
  /** 层间间隙（世界单位） */
  gap?: number
  /** 数据类型：'funnel' 梯形收缩，'pyramid' 金字塔 */
  shape?: 'funnel' | 'pyramid'
  /** 底部最小宽度比例 0~1 */
  minSize?: number
  /** 排序 */
  sort?: 'ascending' | 'descending' | 'none'
  /** 厚度 */
  depth?: number
}

/** 仪表盘系列 */
export interface Gauge3DSeries {
  type: 'gauge3D'
  name?: string
  /** 单值：直接给数字，或 [{value}] */
  data: Array<number | SingleValueDataItem>
  color?: string[]
  itemStyle?: ItemStyle
  label?: LabelStyle
  visible?: boolean
  animation?: AnimationConfig
  /** 最小值 */
  min?: number
  /** 最大值 */
  max?: number
  /** 起始角度（度），默认 225 */
  startAngle?: number
  /** 结束角度（度），默认 -45 */
  endAngle?: number
  /** 分割段数 */
  splitNumber?: number
  /** 环带宽度 */
  axisWidth?: number
  /** 环带半径 */
  radius?: number
  /** 厚度 */
  depth?: number
  /** 进度条样式 */
  progressStyle?: ItemStyle & {
    /**
     * 沿角度渐变的色带（从弧起点到终点）
     *
     * 与 `color` 的 CSS 渐变不同：CSS 渐变的贴图方向在圆弧上是错的，
     * 这个选项会按顶点角度采样，得到「沿圆周从亮到暗」的正确效果。
     *
     * @example
     * ```ts
     * progressStyle: {
     *   angleGradient: ['#5EF3B6', '#1EE793', '#0FA76A'],
     * }
     * ```
     */
    angleGradient?: string[]
    /** 终点宽度，与 `axisWidth` 不同时形成「一头宽一头窄」的锥形弧 */
    widthEnd?: number
  }
  /** 未填充轨道是否使用玻璃壳（菲涅尔边缘发光）材质 */
  trackShell?: boolean
  /**
   * 内层环带（进度弧内侧的窄环）
   *
   * 用于还原「双层圆环」设计：外层是粗进度弧，内侧再嵌一圈细环。
   */
  innerArc?: {
    show?: boolean
    /** 内环半径（世界单位），默认 `radius - axisWidth * 0.95` */
    radius?: number
    /** 内环宽度，默认 `axisWidth * 0.42` */
    width?: number
    /** 内环颜色 */
    color?: ColorInput
    /** 内环透明度，默认 0.18 */
    opacity?: number
    /** 内环沿 Z 的厚度，默认 `depth * 0.6` */
    depth?: number
    /** 内环起始角度，默认与主环一致 */
    startAngle?: number
    /** 内环结束角度，默认与主环一致 */
    endAngle?: number
    /** 内环描边 */
    border?: BorderStyle
  }
  /**
   * 同心刻度圆环（蛛网层）
   *
   * 在表盘内部画出若干条同心圆弧线，增强「仪表」的分层感。
   */
  concentricRings?: {
    show?: boolean
    /** 环数量，默认 3 */
    count?: number
    /** 最外环半径，默认 `radius - axisWidth` */
    maxRadius?: number
    /** 最内环半径，默认 `maxRadius * 0.32` */
    minRadius?: number
    /** 线颜色 */
    color?: ColorInput
    /** 线透明度，默认 0.28 */
    opacity?: number
    /** 圆弧张角，默认与主环一致 */
    startAngle?: number
    endAngle?: number
  }
  /**
   * 中心轴帽样式
   *
   * 参考图里是一个带立体感的球状轴心，而不是简单的圆柱。
   */
  hub?: {
    show?: boolean
    /** 形状：'sphere' 球体（默认）、'cylinder' 圆柱、'none' 不画 */
    shape?: 'sphere' | 'cylinder' | 'none'
    /** 尺寸倍率，相对 pointer.width，默认 1.6 */
    size?: number
    /** 轴帽主色，默认与指针同色 */
    color?: ColorInput
    /** 外圈描边色（球体外壳） */
    ringColor?: ColorInput
    /** 外圈半径倍率，默认 1.9 */
    ringScale?: number
    /** 金属度 */
    metalness?: number
    /** 粗糙度 */
    roughness?: number
    /** 发光强度 */
    emissiveIntensity?: number
  }
  /** 是否显示刻度 */
  axisTick?: { show?: boolean; length?: number; color?: string }
  /** 是否显示刻度数值 */
  axisLabel?: { show?: boolean; fontSize?: number; color?: string; precision?: number }
  /** 指针 */
  pointer?: {
    show?: boolean
    length?: number
    width?: number
    color?: string
  }
  /** 中心详情文字 */
  detail?: {
    show?: boolean
    formatter?: string | ((value: number) => string)
    fontSize?: number
    color?: string
    offsetY?: number
    /**
     * 数值小数位数，默认 0
     *
     * 参考图里的 `78.2` 需要设为 1；不设时按整数显示。
     */
    precision?: number
  }
}

/** 热力图系列 */
export interface Heatmap3DSeries {
  type: 'heatmap3D'
  name?: string
  /**
   * 数据格式：
   * - `[x, y, value]` 三元组（x/y 为类目索引或数值）
   */
  data: Array<[number, number, number] | { value: [number, number, number] }>
  /** 调色板（热力图主要用 colorGradient，此项用于图例等场景） */
  color?: string[]
  xAxisData?: Array<string | number>
  zAxisData?: Array<string | number>
  label?: LabelStyle
  visible?: boolean
  animation?: AnimationConfig
  /** 色带（从低到高） */
  colorGradient?: string[]
  /** 数值范围 [min, max]，不传自动 */
  valueRange?: [number, number]
  /** 色块高度映射范围 [min, max] */
  heightRange?: [number, number]
  /** 色块占比 0~1（1 表示铺满格子） */
  tileRatio?: number
  /** 是否显示色块顶部标签 */
  showValue?: boolean
  itemStyle?: ItemStyle
}

/**
 * 通用系列（用于自定义图表）
 *
 * 当 `type` 不是内置类型时，`Series3D` 会落到这个成员上。
 * 它保留 `BaseSeries` 的全部字段，并允许携带额外的自定义配置。
 *
 * 注意：这里不使用 `[key: string]: unknown` 索引签名 ——
 * 那会把继承来的 `data` / `name` 等属性类型也污染成 `unknown`，
 * 破坏内置系列的精确推导。
 */
export interface CustomSeries extends Omit<BaseSeries<DataItem>, 'type' | 'data'> {
  /** 自定义类型标识（`defineChart` / `extendChart` 注册的类型） */
  type: string
  /** 数据（宽松类型，自定义图表自行解析） */
  data: unknown[]
}

/**
 * 所有系列类型的联合
 *
 * 前 10 个是内置图表；最后追加 `CustomSeries` 使自定义类型也能通过类型检查。
 * 内置的 `type` 字面量仍会被精确收窄。
 */
export type Series3D =
  | Bar3DSeries
  | Line3DSeries
  | Area3DSeries
  | AreaFlow3DSeries
  | Pie3DSeries
  | Scatter3DSeries
  | Surface3DSeries
  | Radar3DSeries
  | Funnel3DSeries
  | Gauge3DSeries
  | Heatmap3DSeries
  | CustomSeries

/** 按 type 取出对应的系列类型（内置类型可获得精确推导） */
export type SeriesOf<T extends BuiltinSeriesType> = Extract<Series3D, { type: T }>

/** 动画配置 */
export interface AnimationConfig {
  /** 是否启用，默认 true */
  enabled?: boolean
  /** 动画时长（毫秒），默认 800 */
  duration?: number
  /** 延迟（毫秒） */
  delay?: number
  /** 缓动函数名 */
  easing?: EasingName
  /** 逐个数据项的错峰延迟步长（毫秒） */
  stagger?: number
  /** 更新数据时的动画时长，不传复用 duration */
  updateDuration?: number
}

/** 缓动函数名 */
export type EasingName =
  | 'linear'
  | 'quadraticIn'
  | 'quadraticOut'
  | 'quadraticInOut'
  | 'cubicIn'
  | 'cubicOut'
  | 'cubicInOut'
  | 'elasticOut'
  | 'backOut'
  | 'bounceOut'
  | 'exponentialOut'

/* -------------------------------------------------------------------------- */
/*                              类型守卫与工具函数                              */
/* -------------------------------------------------------------------------- */

/** 判断数据项是否为对象写法 */
export function isDataItemObject(
  item: unknown
): item is SingleValueDataItem | MultiValueDataItem {
  return typeof item === 'object' && item !== null && 'value' in (item as object)
}

/** 从数据项中提取数值 */
export function extractValue(item: DataItem): number | number[] {
  if (typeof item === 'number') return item
  if (Array.isArray(item)) return item
  return item.value
}

/** 从数据项中提取数值数组（标量会被包成单元素数组） */
export function extractValueArray(item: DataItem): number[] {
  const v = extractValue(item)
  return Array.isArray(v) ? v : [v]
}

/** 从数据项中提取数值（标量），多值时取第一个 */
export function extractScalar(item: DataItem): number {
  const v = extractValue(item)
  return Array.isArray(v) ? (v[1] ?? v[0] ?? 0) : v
}

/** 从数据项中提取名称 */
export function extractName(item: DataItem, fallback?: string): string | undefined {
  if (isDataItemObject(item)) return item.name ?? fallback
  return fallback
}

export function isBarSeries(s: Series3D): s is Bar3DSeries {
  return s.type === 'bar3D'
}
export function isLineSeries(s: Series3D): s is Line3DSeries {
  return s.type === 'line3D'
}
export function isAreaSeries(s: Series3D): s is Area3DSeries {
  return s.type === 'area3D'
}
export function isPieSeries(s: Series3D): s is Pie3DSeries {
  return s.type === 'pie3D'
}
export function isScatterSeries(s: Series3D): s is Scatter3DSeries {
  return s.type === 'scatter3D'
}
export function isSurfaceSeries(s: Series3D): s is Surface3DSeries {
  return s.type === 'surface3D'
}
export function isRadarSeries(s: Series3D): s is Radar3DSeries {
  return s.type === 'radar3D'
}
export function isFunnelSeries(s: Series3D): s is Funnel3DSeries {
  return s.type === 'funnel3D'
}
export function isGaugeSeries(s: Series3D): s is Gauge3DSeries {
  return s.type === 'gauge3D'
}
export function isHeatmapSeries(s: Series3D): s is Heatmap3DSeries {
  return s.type === 'heatmap3D'
}
