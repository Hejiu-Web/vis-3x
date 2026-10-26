/**
 * vis-3x — 渲染环境相关类型
 *
 * 包括光照、后处理、相机控制、网格地面等。
 */
import type { ColorLike } from './style'

/** 光源类型 */
export type LightKind = 'ambient' | 'directional' | 'point' | 'hemisphere' | 'spot'

/**
 * 光源配置
 *
 * @example
 * ```ts
 * { type: 'directional', position: [5, 10, 7], intensity: 1.4, shadow: true }
 * ```
 */
export interface LightConfig {
  /** 光源类型，默认 directional */
  type?: LightKind
  /** 光源位置（世界单位）；ambient / hemisphere 可省略 */
  position?: [number, number, number]
  /** 目标点（directional / spot 有效） */
  target?: [number, number, number]
  /** 颜色 */
  color?: ColorLike
  /** 强度 */
  intensity?: number
  /** 是否投射阴影 */
  shadow?: boolean
  /** 阴影贴图分辨率，默认 2048 */
  shadowMapSize?: number
  /** 阴影相机范围（正交阴影相机的半边长） */
  shadowCameraSize?: number
  /** 阴影模糊半径 */
  shadowRadius?: number
  /** 阴影偏置，防止条纹 */
  shadowBias?: number
  /** 阴影透明度 */
  shadowOpacity?: number
  /** 环境光/半球光的天空色 */
  skyColor?: ColorLike
  /** 半球光的地面色 */
  groundColor?: ColorLike
  /** 点光/聚光的衰减距离 */
  distance?: number
  /** 聚光灯光锥角度（度） */
  angle?: number
  /** 聚光灯边缘羽化 0~1 */
  penumbra?: number
}

/** 后处理泛光配置 */
export interface BloomOptions {
  enabled?: boolean
  /** 泛光强度 */
  intensity?: number
  /** 泛光半径 */
  radius?: number
  /** 亮度阈值，只有超过该亮度的像素才发光 */
  threshold?: number
}

/** 后处理配置 */
export interface PostprocessingOptions {
  /** 是否启用后处理 */
  enabled?: boolean
  /** 泛光 */
  bloom?: BloomOptions
  /** 色调映射 */
  toneMapping?: 'none' | 'linear' | 'reinhard' | 'cineon' | 'aces' | 'agx' | 'neutral'
  /** 曝光度 */
  toneMappingExposure?: number
  /** 抗锯齿采样数（使用 WebGL2 MSAA 时） */
  antialias?: boolean
}

/** 地面 / 背景网格配置 */
export interface GridFloorConfig {
  /** 是否显示 */
  show?: boolean
  /** 网格线颜色 */
  color?: ColorLike
  /** 次要网格线颜色 */
  subColor?: ColorLike
  /** 网格划分数量 */
  divisions?: number
  /** 是否显示背景墙（增强空间感） */
  showWall?: boolean
  /** 背景墙颜色 */
  wallColor?: ColorLike
  /** 背景墙透明度 */
  wallOpacity?: number
  /** 是否显示「地面阴影承接面」 */
  showShadowPlane?: boolean
  /** 阴影承接面颜色 */
  shadowPlaneColor?: ColorLike
  /** 阴影承接面透明度 */
  shadowPlaneOpacity?: number
}

/** 相机控制器配置 */
/**
 * 相机交互模式
 *
 * 用一个语义化开关决定用户能否用鼠标/触摸调整视角：
 *
 * - `'free'`   **自由视角（默认）** — 旋转、缩放、平移全部可用
 * - `'rotate'` 仅可旋转 — 锁定远近与位置，只允许转角度
 * - `'fixed'`  **固定视角** — 完全禁用交互，画面锁定为设定的观察角度
 *
 * 设为 `'fixed'` 后仍会保留悬停高亮、点击事件、提示框等**数据交互**，
 * 只是相机不再响应用户操作。若连数据交互也要关闭，请设
 * `option.interactive = false`。
 *
 * @example
 * ```ts
 * // 固定视角，用户无法旋转
 * controlSettings: { interactionMode: 'fixed' }
 *
 * // 自由视角（默认行为，无需显式指定）
 * controlSettings: { interactionMode: 'free' }
 * ```
 */
export type InteractionMode = 'free' | 'rotate' | 'fixed'

/**
 * 相机控制器配置
 *
 * 最常用的是顶部的 `interactionMode` 总开关；
 * 其余字段用于在开启交互后做精细化限制。
 */
export interface ControlSettings {
  /**
   * 交互模式总开关（推荐优先使用）
   *
   * - `'free'`   自由视角：旋转 + 缩放 + 平移（默认）
   * - `'rotate'` 仅旋转：禁用缩放与平移
   * - `'fixed'`  固定视角：全部禁用，画面锁定
   *
   * 设置后会覆盖 `enableRotate` / `enableZoom` / `enablePan` 的默认值；
   * 若同时显式指定了这三个字段，则以显式字段为准。
   */
  interactionMode?: InteractionMode
  /** 是否启用旋转 */
  enableRotate?: boolean
  /** 是否启用缩放 */
  enableZoom?: boolean
  /** 是否启用平移 */
  enablePan?: boolean
  /** 最小极角（弧度），限制俯仰 */
  minPolarAngle?: number
  /** 最大极角（弧度） */
  maxPolarAngle?: number
  /** 最小方位角（弧度） */
  minAzimuthAngle?: number
  /** 最大方位角（弧度） */
  maxAzimuthAngle?: number
  /** 最小缩放距离 */
  minDistance?: number
  /** 最大缩放距离 */
  maxDistance?: number
  /** 阻尼系数 0~1，越小越顺滑 */
  dampingFactor?: number
  /** 缩放速度 */
  zoomSpeed?: number
  /** 旋转速度 */
  rotateSpeed?: number
  /** 是否自动旋转 */
  autoRotate?: boolean
  /** 自动旋转速度 */
  autoRotateSpeed?: number
  /** 相机观察方向，用于调整默认俯角 */
  cameraDirection?: { x?: number; y?: number; z?: number }
  /** 相机适配留白系数 0~1，越大留白越多，默认 0.82 */
  fitToScreenFactor?: number
  /** 是否允许通过拖拽交互触发惯性 */
  enableDamping?: boolean
  /** 目标点 */
  target?: [number, number, number]
}

/** 主题配置 */
export interface ThemeConfig {
  /** 调色板 */
  palette?: string[]
  /** 背景色 */
  backgroundColor?: ColorLike
  /** 文字颜色 */
  textColor?: ColorLike
  /** 坐标轴颜色 */
  axisColor?: ColorLike
  /** 网格线颜色 */
  splitLineColor?: ColorLike
  /** 提示框背景色 */
  tooltipBackgroundColor?: ColorLike
  /** 提示框文字颜色 */
  tooltipTextColor?: ColorLike
}
