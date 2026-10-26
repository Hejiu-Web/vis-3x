/**
 * vis-3x — 主入口
 *
 * 一个基于 Vue 3 + TypeScript + Three.js 的 3D 数据可视化图表库。
 *
 * 四种用法：
 *
 * 1. **Vue 3 全局注册**
 *    ```ts
 *    import { createApp } from 'vue'
 *    import Vis3x from 'vis-3x'
 *    import 'vis-3x/style.css'
 *    createApp(App).use(Vis3x).mount('#app')
 *    ```
 *
 * 2. **按需引入组件**
 *    ```ts
 *    import { VisBar3D } from 'vis-3x'
 *    ```
 *
 * 3. **组合式 API**
 *    ```ts
 *    import { useVisChart } from 'vis-3x'
 *    ```
 *
 * 4. **纯 JS / 框架无关的命令式用法**
 *    ```js
 *    import { createChart } from 'vis-3x'
 *    const chart = createChart('bar3D', document.getElementById('el'))
 *    chart.setOption({ series: [{ type: 'bar3D', data: [1, 2, 3] }] })
 *    ```
 *
 * 自定义图表（像 ECharts 一样灵活扩展）：
 *    ```ts
 *    import { defineChart, createChart } from 'vis-3x'
 *    defineChart({ type: 'my3D', render(ctx) { ... } })
 *    ```
 */
import type { App, Plugin } from 'vue'

// 引入基础样式，构建时会被抽取为 dist/style.css
import './styles/index.css'

/* -------------------------------------------------------------------------- */
/*                                  组件                                      */
/* -------------------------------------------------------------------------- */
import {
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
} from './components/charts'

/* -------------------------------------------------------------------------- */
/*                                  核心                                      */
/* -------------------------------------------------------------------------- */
import {
  createChart,
  defineChart,
  extendChart,
  registerChart,
  useChartPlugin,
  type ChartPlugin,
} from './core/registry'

import { darkTheme, themes } from './presets/themes'
import { useExtraCharts } from './presets/extra-charts'
import { DEFAULT_PALETTE } from './utils/color'
import { setRuntimeDefaultPalette, setRuntimeDefaultTheme } from './core/ChartBase'
import type { ThemeConfig } from './types/environment'

export { default as VisChartBase } from './components/VisChartBase'
export type { BaseChartProps } from './components/VisChartBase'
export {
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
} from './components/charts'
export {
  createChartComponent,
  chartComponentProps,
  chartComponentEmits,
  type ChartComponentProps,
  type ChartComponentExposed,
  type CreateChartComponentOptions,
} from './components/factory'

/* -------------------------------------------------------------------------- */
/*                                  核心                                      */
/* -------------------------------------------------------------------------- */
export { Engine, type EngineOptions } from './core/Engine'
export { EventBus } from './core/EventBus'
export { ResourceManager } from './core/ResourceManager'
export {
  LabelManager,
  formatNumber,
  abbreviateNumber,
  formatLabel,
  labelBackgroundFor,
} from './core/LabelManager'
export { InteractionManager } from './core/InteractionManager'
export {
  Cartesian3D,
  computeValueExtent,
  autoGridSize,
  statValues,
  DEFAULT_GRID,
} from './core/Cartesian3D'
export type { CartesianConfig, AxisMapping, DataExtent } from './core/Cartesian3D'
export { SceneEnvironment } from './core/SceneEnvironment'
export { CSS2DRenderer } from './core/CSS2DRenderer'
export {
  ChartBase,
  runtimeDefaults,
  setRuntimeDefaultTheme,
  setRuntimeDefaultPalette,
} from './core/ChartBase'
export type { ResolvedChartOption, LegendItemData } from './core/ChartBase'

/* --------------------------- 扩展 API（核心卖点） --------------------------- */
export {
  registerChart,
  unregisterChart,
  hasChartType,
  getChartConstructor,
  getRegisteredTypes,
  getBuiltinTypes,
  createChart,
  inferChartType,
  defineChart,
  extendChart,
  useChartPlugin,
  installChartPlugin,
  getPlugins,
  clearPlugins,
} from './core/registry'
export type {
  ChartConstructor,
  ChartPlugin,
  ChartPluginContext,
  DefineChartOptions,
  ChartRenderContext,
  ChartThemeTokens,
  ChartRenderFn,
  ChartLifecycleHooks,
} from './core/registry'

/* ------------------------------ 内置图表类 ------------------------------ */
export {
  Bar3DChart,
  Line3DChart,
  Area3DChart,
  AreaFlow3DChart,
  Pie3DChart,
  Scatter3DChart,
  Surface3DChart,
  Radar3DChart,
  Funnel3DChart,
  Gauge3DChart,
  Heatmap3DChart,
} from './core/registry'

/* -------------------------------------------------------------------------- */
/*                             组合式函数 & 适配器                             */
/* -------------------------------------------------------------------------- */
export { useVisChart } from './composables/useVisChart'
export type { UseVisChartOptions, UseVisChartReturn } from './composables/useVisChart'

export {
  fromEchartsLikeOption,
  toVis3xOption,
  type EchartsLikeOption,
} from './adapters/echarts'

/* -------------------------------------------------------------------------- */
/*                                 主题预设                                   */
/* -------------------------------------------------------------------------- */
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
} from './presets/themes'

/* -------------------------------------------------------------------------- */
/*                                 示例图表                                   */
/* -------------------------------------------------------------------------- */
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
} from './presets/extra-charts'

/* -------------------------------------------------------------------------- */
/*                                  工具                                      */
/* -------------------------------------------------------------------------- */
export {
  DEFAULT_PALETTE,
  DEFAULT_GRADIENT,
  toCssColor,
  toThreeColor,
  shade,
  withAlpha,
  gradientColorAt,
  createGradientSampler,
  isLightColor,
  splitAlpha,
} from './utils/color'
export {
  clamp,
  lerp,
  inverseLerp,
  degToRad,
  radToDeg,
  niceTicks,
  niceExtent,
  extent,
  sum,
  polarToCartesian,
  catmullRomSpline,
  roundedRectShape,
  uid,
  roundTo,
  isValidNumber,
  computeBoundingBox,
} from './utils/math'
export { EASINGS, getEasing, tween, AnimationManager } from './utils/easing'
export type { EasingFn } from './utils/easing'
export { ObjectPool, vector3Pool, vector2Pool, colorPool } from './utils/object-pool'

/* -------------------------------------------------------------------------- */
/*                                  类型                                      */
/* -------------------------------------------------------------------------- */

/**
 * 重新导出全部公共类型
 *
 * ⚠️ 这里**不能用** `export type * from './types'`。
 * `export *` 会被 tsc 原样写进 `dist/index.d.ts`，而 TypeScript 在解析
 * **声明文件**里的 `export *` 时存在缺陷：它不会把子模块的具名类型带到
 * 本模块的导出表里，导致使用者写
 *
 *   import type { Vis3xOption } from 'vis-3x'
 *
 * 时报 `TS2724: '"vis-3x"' has no exported member named 'Vis3xOption'`
 * （`Vis3xOption` 是纯类型，甚至不会被 `export *` 的“值导出”覆盖）。
 *
 * 逐项显式导出是唯一稳定兼容 `bundler` 与 `node16` 两种解析模式的做法。
 */
export type {
  /* style */
  ColorLike,
  GradientStop,
  GradientSpec,
  ColorInput,
  LineStyle,
  TextStyle,
  BorderStyle,
  ItemStyle,
  AreaStyle,
  PointStyle,
  LabelStyle,
  LabelFormatterParams,
  LegendStyle,
  TooltipStyle,
  TooltipParams,
  /* axis */
  AxisLine,
  AxisTick,
  AxisLabel,
  SplitLine,
  AxisName,
  Axis3D,
  RadarIndicator,
  RadarConfig,
  /* series */
  BuiltinSeriesType,
  SeriesType,
  BaseDataItem,
  SingleValueDataItem,
  MultiValueDataItem,
  DataItem,
  BaseSeries,
  Bar3DSeries,
  Line3DSeries,
  Area3DSeries,
  AreaFlow3DSeries,
  Pie3DSeries,
  Scatter3DSeries,
  Surface3DSeries,
  Radar3DDataItem,
  Radar3DSeries,
  Funnel3DDataItem,
  Funnel3DSeries,
  Gauge3DSeries,
  Heatmap3DSeries,
  CustomSeries,
  Series3D,
  SeriesOf,
  AnimationConfig,
  EasingName,
  /* environment */
  LightKind,
  LightConfig,
  BloomOptions,
  PostprocessingOptions,
  GridFloorConfig,
  InteractionMode,
  ControlSettings,
  ThemeConfig,
  /* option */
  BuiltinChartType,
  ChartType,
  Vis3xOption,
  ResolvedOption,
  ChartEventPayloadBase,
  ChartClickPayload,
  ChartDblClickPayload,
  ChartMouseOverPayload,
  ChartMouseOutPayload,
  ChartMouseMovePayload,
  ChartMouseDownPayload,
  ChartMouseUpPayload,
  LegendTogglePayload,
  RenderedPayload,
  CameraChangePayload,
  ChartEventMap,
  ChartEventType,
  ChartEventPayload,
  Unsubscribe,
  TooltipData,
  LegendItem,
} from './types'

/* -------------------------------------------------------------------------- */
/*                                Vue 插件                                    */
/* -------------------------------------------------------------------------- */

/** 全部内置组件映射表 */
export const components = {
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

/** 插件配置 */
export interface Vis3xPluginOptions {
  /** 是否注册内置组件，默认 true */
  components?: boolean
  /** 全局默认主题 */
  theme?: ThemeConfig
  /** 全局默认调色板 */
  palette?: string[]
  /** 需要安装的图表插件 */
  plugins?: ChartPlugin[]
  /** 是否自动注册内置示例图表（棒棒糖、气泡图等），默认 false */
  extraCharts?: boolean
}

/** 插件对象类型 */
export type Vis3xPlugin = Plugin & {
  /** 全部组件 */
  components: typeof components
  /** 主题预设 */
  themes: typeof themes
  /** 创建图表实例（命令式） */
  createChart: typeof createChart
  /** 函数式定义图表 */
  defineChart: typeof defineChart
  /** 继承改写图表 */
  extendChart: typeof extendChart
  /** 注册图表 */
  registerChart: typeof registerChart
  /** 安装图表插件 */
  useChartPlugin: typeof useChartPlugin
  /** 版本号 */
  version: string
  /** 运行时全局默认主题 */
  defaultTheme: ThemeConfig
  /** 运行时全局默认调色板 */
  defaultPalette: string[]
}

/**
 * 版本号
 *
 * 由构建过程注入（见 `vite.config.ts` 的 `__VERSION__` 常量定义）。
 * 未经过构建直接跑源码时（例如 playground 的 HMR），回退为占位串，
 * 不会影响任何渲染逻辑。
 */
declare const __VERSION__: string

/** 运行时代码版本（与 package.json 的 version 一致） */
export const VERSION: string =
  typeof __VERSION__ !== 'undefined' ? __VERSION__ : '0.0.0-dev'

/**
 * Vue 插件
 *
 * @example
 * ```ts
 * app.use(Vis3x, { theme: themes.blue, extraCharts: true })
 * ```
 */
const Vis3x: Vis3xPlugin = {
  install(app: App, options: Vis3xPluginOptions = {}) {
    if (options.theme) {
      Object.assign(Vis3x.defaultTheme, options.theme)
      // 同步到内核：图表实例解析配置时以它作为最低优先级兜底，
      // 这样 app.use(Vis3x, { theme }) 才真正生效
      setRuntimeDefaultTheme(Vis3x.defaultTheme)
    }
    if (options.palette?.length) {
      Vis3x.defaultPalette = [...options.palette]
      setRuntimeDefaultPalette(Vis3x.defaultPalette)
    }

    if (options.components !== false) {
      for (const [name, component] of Object.entries(components)) {
        app.component(name, component)
      }
    }

    for (const plugin of options.plugins ?? []) {
      useChartPlugin(plugin)
    }

    if (options.extraCharts) {
      useExtraCharts()
    }
  },
  components,
  themes,
  createChart,
  defineChart,
  extendChart,
  registerChart,
  useChartPlugin,
  version: VERSION,
  defaultTheme: { ...darkTheme },
  defaultPalette: [...DEFAULT_PALETTE],
}

export default Vis3x
