/**
 * vis-3x — 核心入口（`vis-3x/core`）
 *
 * 只包含与 Vue 无关的渲染内核，适合：
 * - 纯 JavaScript 项目
 * - 二次开发 / 自定义图表
 * - 只想要引擎能力的场景
 */
export { Engine, type EngineOptions } from './Engine'
export { EventBus } from './EventBus'
export { ResourceManager } from './ResourceManager'
export {
  LabelManager,
  formatNumber,
  abbreviateNumber,
  formatLabel,
  labelBackgroundFor,
} from './LabelManager'
export type { LabelManagerOptions, LabelCreateParams } from './LabelManager'
export { InteractionManager } from './InteractionManager'
export type { InteractionManagerOptions, PickableMeta } from './InteractionManager'
export {
  Cartesian3D,
  computeValueExtent,
  autoGridSize,
  statValues,
  DEFAULT_GRID,
} from './Cartesian3D'
export type { CartesianConfig, AxisMapping, DataExtent } from './Cartesian3D'
export { SceneEnvironment, shadowPlaneColor } from './SceneEnvironment'
export type { SceneEnvironmentOptions } from './SceneEnvironment'
export { CSS2DRenderer } from './CSS2DRenderer'
export {
  ChartBase,
  runtimeDefaults,
  setRuntimeDefaultTheme,
  setRuntimeDefaultPalette,
} from './ChartBase'
export type { ResolvedChartOption, LegendItemData } from './ChartBase'

/* --------------------------- 图表注册与扩展 API --------------------------- */
export {
  registerChart,
  unregisterChart,
  getChartConstructor,
  getRegisteredTypes,
  hasChartType,
  createChart,
  inferChartType,
  defineChart,
  useChartPlugin,
  installChartPlugin,
  extendChart,
  getPlugins,
  clearPlugins,
} from './registry'

export type {
  ChartConstructor,
  ChartPlugin,
  ChartPluginContext,
  DefineChartOptions,
  ChartRenderContext,
  ChartThemeTokens,
} from './registry'

/* ------------------------------ 内置图表类 ------------------------------ */
export { Bar3DChart } from '../charts/Bar3DChart'
export { Line3DChart } from '../charts/Line3DChart'
export { Area3DChart } from '../charts/Area3DChart'
export { Pie3DChart } from '../charts/Pie3DChart'
export { Scatter3DChart } from '../charts/Scatter3DChart'
export { Surface3DChart } from '../charts/Surface3DChart'
export { Radar3DChart } from '../charts/Radar3DChart'
export { Funnel3DChart } from '../charts/Funnel3DChart'
export { Gauge3DChart } from '../charts/Gauge3DChart'
export { Heatmap3DChart } from '../charts/Heatmap3DChart'
