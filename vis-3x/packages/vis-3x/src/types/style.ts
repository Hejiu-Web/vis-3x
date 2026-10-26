/**
 * vis-3x — 样式相关类型定义
 *
 * 所有样式类型都设计为「可选 + 合理默认值」，使用者可以只写关心的字段。
 */

/** 支持的颜色写法：CSS 颜色字符串或 16 进制数字 */
export type ColorLike = string | number

/**
 * 渐变色标
 *
 * @example
 * ```ts
 * { offset: 0, color: '#1EE793', alpha: 1 }
 * { offset: 1.1042, color: 'rgb(0, 0, 0)', alpha: 0.1 }
 * ```
 */
export interface GradientStop {
  /** 归一化位置 0~1（CSS 里写 `110.42%` 会解析成 `1.1042`） */
  offset: number
  /** 颜色（不含 alpha） */
  color: string
  /** 透明度 0~1 */
  alpha?: number
}

/**
 * 解析后的渐变描述
 *
 * 由 `parseGradient()` 从 CSS 渐变字符串解析得到。
 * 角度约定：`0` 自下而上（`0deg`），`180` 自上而下（`180deg`）。
 * 其它角度会被**降级为 `180`**，因为 3D 场景里的渐变贴图统一按竖向 UV 映射。
 */
export interface GradientSpec {
  /** 渐变类型 */
  kind: 'linear' | 'radial'
  /** 规范化后的角度（0 或 180） */
  angle: number
  /** 色标序列，offset 递增 */
  stops: GradientStop[]
  /** 原始字符串 */
  raw: string
}

/**
 * 颜色输入：纯色，或 CSS 渐变字符串
 *
 * 纯色写法完全兼容旧的 `ColorLike`，现有代码无需改动。
 * 渐变写法直接传 CSS 语法，例如：
 *
 * ```ts
 * color: 'linear-gradient(180deg, #1EE793 0%, rgba(0, 0, 0, 0.1) 110.42%)'
 * ```
 *
 * 支持的角度：`0deg` / `180deg` / `to top` / `to bottom`，
 * 其它角度（如 `45deg`）会被降级为 `180deg` 竖向渐变。
 */
export type ColorInput = ColorLike | (string & {})

/** 通用线条样式 */
export interface LineStyle {
  /**
   * 线条颜色
   *
   * 支持纯色或竖向渐变。渐变会被采样成首尾两色，
   * 用于折线主体与垂幕的上下渐变。
   */
  color?: ColorInput
  /** 线宽（像素，WebGL 环境下大于 1 时自动使用 Line2 方案） */
  width?: number
  /** 透明度 0~1 */
  opacity?: number
  /** 虚线间隔，例如 [6, 4]；不传为实线 */
  dash?: [number, number]
  /** 自发光颜色（用于辉光后处理） */
  emissive?: ColorInput
  /** 自发光强度 */
  emissiveIntensity?: number
}

/** 文字样式 */
export interface TextStyle {
  color?: ColorLike
  fontSize?: number
  fontFamily?: string
  fontWeight?: string | number
  /** 文字阴影，CSS 语法 */
  textShadow?: string
  /** 背景色 */
  backgroundColor?: ColorLike
  /** 内边距（像素） */
  padding?: number
  /** 圆角（像素） */
  borderRadius?: number
  /** 边框颜色 */
  borderColor?: ColorLike
  /** 边框宽度（像素） */
  borderWidth?: number
  /** 行高倍数 */
  lineHeight?: number
}

/**
 * 描边配置（用于给弧、块体等 3D 图形勾勒细边）
 *
 * 与 CSS 的 `border` 不同：3D 场景里没有「盒模型边框」，
 * 这里的实现是沿图形边缘生成一条极细的管体（TubeGeometry）浮在表面上。
 *
 * @example
 * ```ts
 * itemStyle: {
 *   color: '#fff',
 *   opacity: 0.1,
 *   border: { show: true, color: '#E8FFF7', width: 0.02 },
 * }
 * ```
 */
export interface BorderStyle {
  /** 是否显示描边，默认 false */
  show?: boolean
  /** 描边颜色 */
  color?: ColorInput
  /**
   * 描边粗细（世界单位）
   *
   * 环形仪表盘建议 0.01~0.03；块状图建议 0.015~0.04。
   */
  width?: number
  /** 描边透明度 0~1，默认 1 */
  opacity?: number
  /** 是否绘制内沿，默认 true */
  inner?: boolean
  /** 是否绘制外沿，默认 true */
  outer?: boolean
  /** 两端封口是否绘制，默认 false */
  cap?: boolean
  /** 自发光强度，0 表示不受光照影响（纯色描边），默认 0.35 */
  emissiveIntensity?: number
}

/**
 * 图形（材质）样式
 *
 * 覆盖 Three.js 常用材质参数，同时提供若干「语义化预设」。
 */
export interface ItemStyle {
  /**
   * 基础颜色，覆盖系列调色板
   *
   * 支持纯色或竖向渐变：
   * ```ts
   * color: '#1EE793'
   * color: 'linear-gradient(180deg, #1EE793 0%, rgba(0,0,0,0.1) 110.42%)'
   * ```
   */
  color?: ColorInput
  /** 透明度 0~1 */
  opacity?: number
  /** 是否透明物体 */
  transparent?: boolean
  /** 粗糙度 0~1（PBR） */
  roughness?: number
  /** 金属度 0~1（PBR） */
  metalness?: number
  /** 自发光颜色 */
  emissive?: ColorInput
  /** 自发光强度 */
  emissiveIntensity?: number
  /** 环境贴图强度 */
  envMapIntensity?: number
  /** 清漆层强度 0~1（需要 MeshPhysicalMaterial 预设） */
  clearcoat?: number
  /** 清漆层粗糙度 */
  clearcoatRoughness?: number
  /** 透射（玻璃感）0~1 */
  transmission?: number
  /** 折射率 */
  ior?: number
  /** 厚度 */
  thickness?: number
  /** 渲染面：'front' | 'back' | 'double' */
  side?: 'front' | 'back' | 'double'
  /** 是否线框渲染 */
  wireframe?: boolean
  /** 平面着色（低多边形风格） */
  flatShading?: boolean
  /** 深度测试 */
  depthTest?: boolean
  /** 深度写入 */
  depthWrite?: boolean
  /** 是否投射阴影 */
  castShadow?: boolean
  /** 是否接收阴影 */
  receiveShadow?: boolean
  /**
   * 材质预设
   *
   * - `standard`  MeshStandardMaterial（默认，物理正确）
   * - `physical`  MeshPhysicalMaterial（玻璃/清漆等高级效果）
   * - `lambert`   性能更好的漫反射材质
   * - `basic`     不受光照影响
   * - `toon`      卡通描边感
   */
  preset?: 'standard' | 'physical' | 'lambert' | 'basic' | 'toon'
  /** 贴图 URL（颜色贴图） */
  map?: string
  /** 贴图重复次数 */
  textureRepeat?: [number, number]
  /** 贴图旋转角度（弧度） */
  textureRotation?: number
  /**
   * 描边
   *
   * 给图形边缘勾勒一条细线。3D 场景里没有盒模型边框，
   * 这里的实现是沿边缘生成极细的管体浮在表面上。
   *
   * @example
   * ```ts
   * itemStyle: {
   *   color: '#fff',
   *   opacity: 0.1,
   *   border: { show: true, color: '#E8FFF7', width: 0.02 },
   * }
   * ```
   */
  border?: BorderStyle
}

/** 区域（面）样式，常用于面积图、曲面图 */
export interface AreaStyle {
  /**
   * 区域颜色
   *
   * 支持纯色或 CSS 渐变：
   * ```ts
   * color: '#1EE793'
   * // 或竖向渐变（顶 → 底）
   * color: 'linear-gradient(180deg, #1EE793 0%, rgba(0, 0, 0, 0.1) 110.42%)'
   * ```
   */
  color?: ColorInput
  opacity?: number
  roughness?: number
  metalness?: number
  emissive?: ColorInput
  emissiveIntensity?: number
  /**
   * 渐变方向
   *
   * - `'vertical'` 沿高度渐变（默认）
   * - `'horizontal'` 沿 X 轴渐变（按数据索引从左到右）
   * - `'none'` 纯色，即使 `color` 写了渐变也只取首色
   */
  gradient?: 'vertical' | 'horizontal' | 'none'
  /** 渐变的起止透明度 [底部, 顶部]，覆盖渐变字符串里的 alpha */
  gradientOpacity?: [number, number]
  /**
   * 渐变的终止颜色
   *
   * 当 `color` 是纯色时，用它构造「`color` → `endColor`」的竖向渐变，
   * 等价于手写 `linear-gradient(180deg, color, endColor)`。
   */
  endColor?: ColorInput
  /**
   * 描边
   *
   * 给面片/块体边缘勾勒细线。面积流图的块状实体会沿棱边描边，
   * 折线垂幕会沿上下沿描边。
   */
  border?: BorderStyle
  side?: 'front' | 'back' | 'double'
}

/** 散点/数据点样式 */
export interface PointStyle {
  /** 点颜色，支持纯色或竖向渐变 */
  color?: ColorInput
  /** 点尺寸（世界单位半径或边长） */
  size?: number
  opacity?: number
  /** 是否强制透明渲染 */
  transparent?: boolean
  emissive?: ColorInput
  emissiveIntensity?: number
  /** 表面粗糙度 0~1 */
  roughness?: number
  /** 金属度 0~1 */
  metalness?: number
  /** 环境贴图强度 */
  envMapIntensity?: number
  /** 材质预设 */
  preset?: ItemStyle['preset']
  /** 点的几何形状 */
  symbol?: 'circle' | 'square' | 'diamond' | 'sphere' | 'cube' | 'ring'
  /** 设置后按数据值映射尺寸 [min, max] */
  sizeRange?: [number, number]
}

/** 数据标签样式 */
export interface LabelStyle {
  show?: boolean
  /** 标签位置 */
  position?:
    | 'top'
    | 'bottom'
    | 'left'
    | 'right'
    | 'inside'
    | 'center'
    | 'outside'
    | 'insideTop'
    | 'insideBottom'
  /** 相对锚点的偏移距离（世界单位） */
  distance?: number
  /** 屏幕像素偏移 [x, y] */
  offset?: [number, number]
  /** 文本格式化：字符串模板（`{value}` / `{name}` / `{series}`）或函数 */
  formatter?: string | ((params: LabelFormatterParams) => string)
  /** 数值格式化：小数位数 */
  precision?: number
  /** 数值单位后缀 */
  suffix?: string
  /** 数值单位前缀 */
  prefix?: string
  /** 大数字缩写（12000 -> 1.2万） */
  abbreviate?: boolean
  /** 样式 */
  textStyle?: TextStyle
  /** 标签透明度 */
  opacity?: number
  /** 允许使用者透传自定义字段（供 formatter 或自定义渲染使用） */
  [key: string]: unknown
}

/** 标签格式化回调参数 */
export interface LabelFormatterParams {
  value: number | number[]
  name?: string
  seriesName?: string
  dataIndex: number
  seriesIndex: number
  /** 该数据项占总量的百分比（饼图等有意义） */
  percent?: number
}

/**
 * 图例样式
 *
 * 字段命名与 ECharts 的 `legend` 保持一致，降低迁移成本。
 */
export interface LegendStyle {
  show?: boolean
  /**
   * 图例位置
   *
   * 语义与 ECharts 的 `left` / `top` 组合等价，只是用枚举简化常用组合。
   */
  position?: 'top' | 'bottom' | 'left' | 'right' | 'top-left' | 'top-right' | 'bottom-left' | 'bottom-right'
  /** 文字颜色 */
  color?: ColorLike
  /** 字号 */
  fontSize?: number
  /** 图标尺寸（同时设置宽高；单独控制请用 itemWidth / itemHeight） */
  iconSize?: number
  /** 图例项间距 */
  gap?: number
  /** 背景色 */
  backgroundColor?: ColorLike
  /** 内边距 */
  padding?: number
  /** 圆角 */
  borderRadius?: number
  /** 是否可点击切换系列显隐 */
  selectable?: boolean

  /* ------------------------- 以下为对照 ECharts 补齐 ------------------------- */

  /**
   * 图标形状
   *
   * 与 ECharts 一致，支持内置形状或图片 URL。
   */
  icon?: 'rect' | 'circle' | 'roundRect' | 'triangle' | 'diamond' | 'pin' | 'arrow' | string
  /**
   * 图标样式
   *
   * 设置 `color` 会**覆盖**从 series 解析出的颜色（用于统一图例配色）。
   */
  itemStyle?: {
    color?: ColorInput
    borderColor?: ColorInput
    borderWidth?: number
    opacity?: number
    /** 图标之间的宽度，等价 ECharts 的 itemWidth */
    width?: number
    /** 图标高度，等价 ECharts 的 itemHeight */
    height?: number
  }
  /** 图标宽度，优先于 iconSize */
  itemWidth?: number
  /** 图标高度，优先于 iconSize */
  itemHeight?: number
  /** 图例项之间的间隔 */
  itemGap?: number
  /** 图例项内的左右对齐 */
  align?: 'auto' | 'left' | 'right'
  /** 选中项的文字颜色 */
  selectedColor?: ColorLike
  /** 未选中项（被隐藏）的颜色 */
  inactiveColor?: ColorLike
  /** 未选中项图标的边框色 */
  inactiveBorderColor?: ColorInput
  /** 选中模式：'single' 单选、'multiple' 多选（默认）、false 不允许选中 */
  selectedMode?: 'single' | 'multiple' | false
  /** 初始选中状态，key 为图例项名称 */
  selected?: Record<string, boolean>
  /** 图例文字格式化 */
  formatter?: string | ((name: string) => string)
  /** 提示框文字样式 */
  textStyle?: TextStyle
  /** 边框颜色 */
  borderColor?: ColorLike
  /** 边框宽度 */
  borderWidth?: number
  /** 超出容器时的滚动配置（图例项很多时启用） */
  scroll?: boolean
  /** 图例最大高度（滚动模式），数字为像素 */
  maxHeight?: number | string
  /** 图例宽度 */
  width?: number | string
}

/** 提示框样式 */
export interface TooltipStyle {
  show?: boolean
  /** 触发方式 */
  trigger?: 'item' | 'axis' | 'none'
  /** 背景色 */
  backgroundColor?: ColorLike
  /** 文字颜色 */
  color?: ColorLike
  /** 边框颜色 */
  borderColor?: ColorLike
  /** 边框宽度 */
  borderWidth?: number
  /** 字号 */
  fontSize?: number
  /** 内边距 */
  padding?: number
  /** 圆角 */
  borderRadius?: number
  /** 数值格式化函数 */
  formatter?: (params: TooltipParams) => string
  /** CSS 类名 */
  className?: string
}

/** 提示框渲染参数 */
export interface TooltipParams {
  seriesName?: string
  name?: string
  value: number | number[]
  color: ColorLike
  dataIndex: number
  seriesIndex: number
  percent?: number
}
