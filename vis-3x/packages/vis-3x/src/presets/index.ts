/**
 * vis-3x — 预设入口（`vis-3x/presets`）
 *
 * 包含主题预设与「用公开扩展 API 实现的示例图表」。
 */
export {
  darkTheme,
  lightTheme,
  blueTheme,
  warmTheme,
  monoTheme,
  themes,
  getTheme,
  extendTheme,
  type ThemeName,
} from './themes'

export {
  defineLollipop3D,
  defineBubble3D,
  defineBarLine3D,
  definePyramid3D,
  defineRingProgress3D,
  defineStepTerrain3D,
  useExtraCharts,
  getExtraChartTypes,
  type ExtraChartType,
} from './extra-charts'
