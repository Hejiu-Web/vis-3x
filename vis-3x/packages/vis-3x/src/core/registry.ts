/**
 * vis-3x — 图表注册表与扩展 API
 *
 * 这是「像 ECharts 一样灵活自定义图表」的核心：
 *
 * | 能力 | API | 适用场景 |
 * |---|---|---|
 * | 注册已有图表类 | `registerChart(type, Ctor)` | 已有完整实现 |
 * | 函数式定义图表 | `defineChart({ type, render })` | 最常用，无需写类 |
 * | 改写内置图表 | `extendChart('bar3D', {...})` | 复用内置渲染逻辑做微调 |
 * | 挂载插件 | `useChartPlugin(plugin)` | 跨图表复用坐标轴/图例等能力 |
 *
 * 三种方式都产出可被 `createChart` / `<VisChart>` 使用的图表类型。
 */
import * as THREE_NS from 'three'
import type * as THREE from 'three'
import type { ChartBase, ResolvedChartOption } from './ChartBase'
import type { EngineOptions } from './Engine'
// 通过中立的引用桥获取 ChartBase，避免 registry <-> ChartBase 循环依赖
import { getChartBase } from './chart-base-ref'
import type { ChartType, Vis3xOption } from '../types/option'
import type { Series3D } from '../types/series'
import type { ThemeConfig } from '../types/environment'
import { Bar3DChart } from '../charts/Bar3DChart'
import { Line3DChart } from '../charts/Line3DChart'
import { Area3DChart } from '../charts/Area3DChart'
import { AreaFlow3DChart } from '../charts/AreaFlow3DChart'
import { Pie3DChart } from '../charts/Pie3DChart'
import { Scatter3DChart } from '../charts/Scatter3DChart'
import { Surface3DChart } from '../charts/Surface3DChart'
import { Radar3DChart } from '../charts/Radar3DChart'
import { Funnel3DChart } from '../charts/Funnel3DChart'
import { Gauge3DChart } from '../charts/Gauge3DChart'
import { Heatmap3DChart } from '../charts/Heatmap3DChart'

/** three 命名空间（供 buildRenderContext 使用） */
function getThreeNamespace(): typeof THREE_NS {
  return THREE_NS
}

/** 图表类构造函数签名 */
export type ChartConstructor = new (
  container: HTMLElement,
  options?: EngineOptions
) => ChartBase

/* -------------------------------------------------------------------------- */
/*                                 渲染上下文                                  */
/* -------------------------------------------------------------------------- */

/** 主题令牌：给自定义图表提供的语义化配色 */
export interface ChartThemeTokens {
  /** 调色板 */
  palette: string[]
  /** 按索引取色 */
  colorAt: (index: number) => string
  /** 文字色 */
  textColor: string
  /** 坐标轴色 */
  axisColor: string
  /** 分割线色 */
  splitLineColor: string
  /** 背景色 */
  backgroundColor: string | null
}

/**
 * 自定义图表的渲染上下文
 *
 * `defineChart` 的 `render` 回调会收到这个对象，
 * 它把 ChartBase 的能力以「函数」形式暴露出来，
 * 让你不必继承类就能完成绝大多数渲染工作。
 */
export interface ChartRenderContext {
  /** 已解析的完整配置 */
  option: ResolvedChartOption
  /** 当前图表的系列列表（已过滤掉 visible === false） */
  series: Series3D[]
  /** 完整系列列表（含隐藏项） */
  allSeries: Series3D[]
  /** 底层图表实例，需要高级能力时使用 */
  chart: ChartBase

  /** 坐标系：数据值 → 世界坐标 */
  coord: {
    xAt: (value: number) => number
    yAt: (value: number) => number
    zAt: (value: number) => number
    xAtCategory: (index: number) => number
    /** 类目步长 */
    xStep: number
    /** 网格尺寸 */
    grid: { gridWidth: number; gridHeight: number; gridDepth: number }
    /** 数值轴当前范围 */
    yDomain: [number, number]
    /** 类目数量 */
    categoryCount: number
    /** 类目名 */
    categoryName: (index: number) => string
    /** 多系列柱状槽位 */
    barSlot: (
      seriesIndex: number,
      seriesCount: number
    ) => { width: number; offset: number }
  }

  /** 创建一个几何体并登记（销毁时自动释放） */
  geometry: {
    box: (w: number, h: number, d: number) => THREE.BufferGeometry
    sphere: (radius: number, segments?: number) => THREE.BufferGeometry
    cylinder: (
      rTop: number,
      rBottom: number,
      height: number,
      segments?: number
    ) => THREE.BufferGeometry
    plane: (w: number, h: number) => THREE.BufferGeometry
    circle: (radius: number, segments?: number) => THREE.BufferGeometry
    /** 由任意 Shape 挤出 */
    extrude: (
      shape: THREE.Shape,
      depth: number,
      options?: Record<string, unknown>
    ) => THREE.BufferGeometry
    /** 由点集生成管状曲线 */
    tube: (
      points: THREE.Vector3[],
      radius: number,
      tubularSegments?: number
    ) => THREE.BufferGeometry
    /** 登记自定义几何体 */
    track: <T extends THREE.BufferGeometry>(geo: T) => T
  }

  /** 创建材质（带缓存，同参数复用） */
  material: (color: string | number, style?: Record<string, unknown>) => THREE.Material
  /** 创建不复用缓存的新材质 */
  uniqueMaterial: (
    color: string | number,
    style?: Record<string, unknown>
  ) => THREE.Material

  /** 把网格挂载到图表内容分组 */
  add: (object: THREE.Object3D) => void
  /** 创建一个纯 Object3D 锚点（用于挂标签） */
  anchor: (
    x: number,
    y: number,
    z: number,
    text?: string,
    labelStyle?: Record<string, unknown>
  ) => THREE.Object3D
  /** 创建数据标签 */
  label: (
    object: THREE.Object3D,
    text: string,
    style?: Record<string, unknown>
  ) => void

  /** 标记为可交互对象（触发 click / hover / tooltip） */
  pickable: (
    object: THREE.Object3D,
    meta: {
      seriesIndex: number
      dataIndex: number
      seriesName?: string
      name?: string
      value: number | number[]
      color: string
    }
  ) => void

  /** 主题令牌 */
  theme: ChartThemeTokens
  /** 缓动工具（底层动画管理器） */
  animation: ChartBase['animations']

  /**
   * 过渡动画（推荐使用）
   *
   * 让自定义图表也拥有与内置图表一致的入场/更新动画。
   *
   * @example
   * ```ts
   * defineChart({
   *   type: 'my3D',
   *   render(ctx) {
   *     const plan = ctx.transition          // ← 创建过渡计划
   *     series.data.forEach((item, i) => {
   *       const mesh = new THREE.Mesh(...)
   *       mesh.position.set(x, y, 0)
   *       ctx.add(mesh)
   *       plan.scaleY(mesh, i)               // ← 登记生长动画
   *     })
   *     plan.run()                           // ← 统一启动
   *     ctx.keepAnimating()                  // ← 动画期间保持重绘
   *   },
   * })
   * ```
   */
  transition: import('./TransitionPlan').TransitionPlan
  /** 动画期间保持重绘（按需渲染模式下必需） */
  keepAnimating: () => void
  /** 当前是首次入场还是数据更新 */
  phase: 'initial' | 'update'

  /** 请求重绘 */
  invalidate: () => void
}

/** 图表渲染函数 */
export type ChartRenderFn = (ctx: ChartRenderContext) => void

/** 图表生命周期钩子 */
export interface ChartLifecycleHooks {
  /** 首次挂载后 */
  mounted?: (chart: ChartBase) => void
  /** 每次渲染后 */
  rendered?: (chart: ChartBase, option: ResolvedChartOption) => void
  /** 销毁前 */
  beforeDispose?: (chart: ChartBase) => void
}

/* -------------------------------------------------------------------------- */
/*                              函数式图表定义                                 */
/* -------------------------------------------------------------------------- */

/** `defineChart` 的参数 */
export interface DefineChartOptions {
  /** 图表类型标识（唯一） */
  type: string
  /**
   * 渲染函数
   *
   * 在其中使用 `ctx` 提供的能力绘制内容。
   */
  render: ChartRenderFn
  /**
   * 是否为非笛卡尔图表
   *
   * 为 true 时默认隐藏坐标轴与网格（饼图、仪表盘等适用）。
   */
  nonCartesian?: boolean
  /** 生命周期钩子 */
  hooks?: ChartLifecycleHooks
  /** 覆盖默认配置解析 */
  resolveOption?: (option: Vis3xOption) => Vis3xOption
}

/* -------------------------------------------------------------------------- */
/*                                 注册表实现                                  */
/* -------------------------------------------------------------------------- */

/** 登记条目：除构造函数外，附带元信息 */
interface RegistryEntry {
  ctor: ChartConstructor
  /** 来源：内置 / 用户注册 */
  builtin: boolean
  /** 类型别名（例如 'bar' -> 'bar3D'） */
  aliases?: string[]
}

const registry = new Map<string, RegistryEntry>()

/** 已安装的插件 */
const installedPlugins = new Map<string, ChartPlugin>()

/**
 * 注册一个图表类型
 *
 * @param type 类型标识
 * @param ctor 图表类
 * @param options 可选：别名、是否标记为内置
 *
 * @example
 * ```ts
 * registerChart('my3D', MyChart, { aliases: ['my', 'custom3D'] })
 * ```
 */
export function registerChart(
  type: string,
  ctor: ChartConstructor,
  options: { aliases?: string[]; builtin?: boolean } = {}
): void {
  if (!type || typeof type !== 'string') {
    throw new Error('[vis-3x] registerChart: type 必须是非空字符串')
  }
  if (typeof ctor !== 'function') {
    throw new Error(`[vis-3x] registerChart("${type}"): ctor 必须是构造函数`)
  }
  registry.set(type, {
    ctor,
    builtin: options.builtin ?? false,
    aliases: options.aliases,
  })
  // 同时注册别名
  for (const alias of options.aliases ?? []) {
    registry.set(alias, { ctor, builtin: false, aliases: [type] })
  }
}

/** 注销一个图表类型 */
export function unregisterChart(type: string): boolean {
  return registry.delete(type)
}

/** 是否已注册某类型 */
export function hasChartType(type: string): boolean {
  return registry.has(type)
}

/** 获取图表类 */
export function getChartConstructor(type: string): ChartConstructor | undefined {
  return registry.get(type)?.ctor
}

/**
 * 已注册的图表类型列表
 *
 * @param includeBuiltin 是否包含内置类型，默认 true
 * @param includeAliases 是否包含别名，默认 false
 */
export function getRegisteredTypes(
  includeBuiltin = true,
  includeAliases = false
): string[] {
  const out: string[] = []
  for (const [name, entry] of registry) {
    if (!includeBuiltin && entry.builtin) continue
    const isAlias = entry.aliases && entry.aliases.length && !entry.builtin
    if (isAlias && !includeAliases) continue
    out.push(name)
  }
  return out
}

/** 已注册的内置图表类型 */
export function getBuiltinTypes(): string[] {
  return [...registry.entries()]
    .filter(([, entry]) => entry.builtin)
    .map(([name]) => name)
}

/**
 * 创建一个图表实例
 *
 * @param type 图表类型
 * @param container 容器 DOM
 * @param options 引擎配置
 */
export function createChart(
  type: string,
  container: HTMLElement,
  options?: EngineOptions
): ChartBase {
  const Ctor = getChartConstructor(type)
  if (!Ctor) {
    throw new Error(
      `[vis-3x] 未知的图表类型 "${type}"。已注册类型：${getRegisteredTypes().join(', ')}`
    )
  }
  if (!container || typeof container.appendChild !== 'function') {
    throw new Error('[vis-3x] createChart: container 必须是有效的 DOM 元素')
  }
  return new Ctor(container, options)
}

/**
 * 根据系列类型推断图表类型
 */
export function inferChartType(seriesTypes: string[]): string {
  for (const t of seriesTypes) {
    if (registry.has(t)) return t
  }
  return 'bar3D'
}

/* -------------------------------------------------------------------------- */
/*                              defineChart 实现                               */
/* -------------------------------------------------------------------------- */

/**
 * 用「函数式」方式定义一个图表类型
 *
 * 这是最推荐的扩展方式：不需要继承类，只要描述「怎么画」。
 *
 * @example
 * ```ts
 * import * as THREE from 'three'
 * import { defineChart, createChart } from 'vis-3x'
 *
 * defineChart({
 *   type: 'lollipop3D',
 *   render(ctx) {
 *     const series = ctx.series[0]
 *     series.data.forEach((item, i) => {
 *       const value = typeof item === 'number' ? item : item.value
 *       const x = ctx.coord.xAtCategory(i)
 *       const h = ctx.coord.yAt(value)
 *       const color = ctx.theme.colorAt(i)
 *
 *       // 柱子
 *       const bar = new THREE.Mesh(
 *         ctx.geometry.cylinder(0.08, 0.08, h, 12),
 *         ctx.material(color)
 *       )
 *       bar.position.set(x, h / 2, 0)
 *       ctx.pickable(bar, { seriesIndex: 0, dataIndex: i, value, color })
 *       ctx.add(bar)
 *
 *       // 圆球
 *       const ball = new THREE.Mesh(ctx.geometry.sphere(0.22, 20), ctx.material(color))
 *       ball.position.set(x, h, 0)
 *       ctx.add(ball)
 *     })
 *   },
 * })
 *
 * const chart = createChart('lollipop3D', document.getElementById('el')!)
 * ```
 */
export function defineChart(options: DefineChartOptions): ChartConstructor {
  const { type, render, nonCartesian, hooks, resolveOption } = options

  if (!type) throw new Error('[vis-3x] defineChart: 缺少 type')
  if (typeof render !== 'function') {
    throw new Error(`[vis-3x] defineChart("${type}"): render 必须是函数`)
  }

  // 动态构造一个 ChartBase 子类
  // 通过中立的引用桥获取 ChartBase，避免 registry <-> ChartBase 循环依赖
  const BaseClass = getChartBase()

  class DefinedChart extends BaseClass {
    get chartType(): string {
      return type
    }

    protected isNonCartesian(): boolean {
      return nonCartesian ?? false
    }

    protected resolveOption(option: Vis3xOption): ResolvedChartOption {
      const patched = resolveOption ? resolveOption(option) : option
      return super.resolveOption(patched)
    }

    protected renderSeries(option: ResolvedChartOption): void {
      const ctx = buildRenderContext(this, option, type)
      render(ctx)
      hooks?.rendered?.(this, option)
    }

    /** 生命周期钩子：挂载完成 */
    protected onChartMounted(): void {
      hooks?.mounted?.(this)
    }

    /** 生命周期钩子：销毁前 */
    dispose(): void {
      hooks?.beforeDispose?.(this)
      super.dispose()
    }
  }

  // 自动注册
  registerChart(type, DefinedChart)
  return DefinedChart
}

/* -------------------------------------------------------------------------- */
/*                               extendChart                                   */
/* -------------------------------------------------------------------------- */

/**
 * 继承并改写一个已有图表类型
 *
 * 适用于「内置图表已经满足 90%，只想改一点点」的场景。
 *
 * @example
 * ```ts
 * // 让柱状图的每根柱子顶部加一个发光球
 * extendChart('bar3D', {
 *   type: 'bar3DGlow',
 *   afterRender(ctx) {
 *     // ... 追加绘制
 *   },
 * })
 * ```
 */
export function extendChart(
  baseType: string,
  options: {
    type: string
    /** 在父类渲染前执行 */
    beforeRender?: ChartRenderFn
    /** 在父类渲染后执行 */
    afterRender?: ChartRenderFn
    /** 覆盖 isNonCartesian */
    nonCartesian?: boolean
    /** 覆盖 resolveOption */
    resolveOption?: (option: Vis3xOption) => Vis3xOption
    /** 注册为别名而非新类型时，可指定 aliases */
    aliases?: string[]
  }
): ChartConstructor {
  const BaseCtor = getChartConstructor(baseType)
  if (!BaseCtor) {
    throw new Error(
      `[vis-3x] extendChart: 找不到基础图表类型 "${baseType}"。已注册：${getRegisteredTypes().join(', ')}`
    )
  }

  const { type, beforeRender, afterRender, nonCartesian, resolveOption, aliases } = options

  /**
   * 抓取父类的「原始」renderSeries 实现
   *
   * 注意不能走 `this.renderSeries` 之类的转发：
   * 它们会在运行时解析到子类的覆写版本，造成无限递归。
   * 必须直接在父类原型上取出未绑定的方法，再用 call 绑定当前实例。
   */
  type RenderSeriesFn = (this: ChartBase, option: ResolvedChartOption) => void

  const rawRenderSeries = BaseCtor.prototype.renderSeries as unknown as
    | RenderSeriesFn
    | undefined

  if (typeof rawRenderSeries !== 'function') {
    throw new Error(
      `[vis-3x] extendChart("${type}"): 基础图表 "${baseType}" 未实现 renderSeries，无法扩展`
    )
  }

  // 固定为已收窄的类型，避免闭包内丢失 narrowing
  const parentRenderSeries: RenderSeriesFn = rawRenderSeries

  class ExtendedChart extends (BaseCtor as unknown as new (
    container: HTMLElement,
    engineOptions?: EngineOptions
  ) => ChartBase) {
    get chartType(): string {
      return type
    }

    protected isNonCartesian(): boolean {
      return nonCartesian ?? super.isNonCartesian()
    }

    protected resolveOption(option: Vis3xOption): ResolvedChartOption {
      const patched = resolveOption ? resolveOption(option) : option
      return super.resolveOption(patched)
    }

    protected renderSeries(option: ResolvedChartOption): void {
      if (beforeRender) beforeRender(buildRenderContext(this, option, type))
      // 复用父类的渲染逻辑（调用父类原型上的原始实现，避免递归）
      parentRenderSeries.call(this, option)
      if (afterRender) afterRender(buildRenderContext(this, option, type))
    }
  }

  registerChart(type, ExtendedChart, { aliases })
  return ExtendedChart
}

/* -------------------------------------------------------------------------- */
/*                                 插件系统                                    */
/* -------------------------------------------------------------------------- */

/** 插件上下文 */
export interface ChartPluginContext {
  /** 注册一个图表类型 */
  registerChart: typeof registerChart
  /** 函数式定义图表 */
  defineChart: typeof defineChart
  /** 继承改写图表 */
  extendChart: typeof extendChart
  /** 当前已注册类型 */
  getRegisteredTypes: typeof getRegisteredTypes
}

/** 图表插件 */
export interface ChartPlugin {
  /** 插件名（唯一，用于去重） */
  name: string
  /**
   * 安装函数
   *
   * 在 `app.use(vis-3x, { plugins: [...] })` 或手动 `useChartPlugin(plugin)` 时调用。
   */
  install: (ctx: ChartPluginContext) => void
}

/**
 * 安装插件
 *
 * @example
 * ```ts
 * useChartPlugin({
 *   name: 'my-charts',
 *   install({ defineChart }) {
 *     defineChart({ type: 'my3D', render(ctx) { ... } })
 *   },
 * })
 * ```
 */
export function useChartPlugin(plugin: ChartPlugin): void {
  if (!plugin?.name) throw new Error('[vis-3x] useChartPlugin: 插件必须有 name')
  if (typeof plugin.install !== 'function') {
    throw new Error(`[vis-3x] useChartPlugin("${plugin.name}"): install 必须是函数`)
  }
  if (installedPlugins.has(plugin.name)) return // 幂等

  installedPlugins.set(plugin.name, plugin)
  plugin.install({
    registerChart,
    defineChart,
    extendChart,
    getRegisteredTypes,
  })
}

/** `useChartPlugin` 的别名，语义更贴近「安装」 */
export const installChartPlugin = useChartPlugin

/** 已安装的插件名列表 */
export function getPlugins(): string[] {
  return [...installedPlugins.keys()]
}

/** 清空插件记录（主要用于测试） */
export function clearPlugins(): void {
  installedPlugins.clear()
}

/* -------------------------------------------------------------------------- */
/*                            内部：构建渲染上下文                             */
/* -------------------------------------------------------------------------- */

/** 构建传给自定义 render 函数的上下文 */
function buildRenderContext(
  chart: ChartBase,
  option: ResolvedChartOption,
  _type: string
): ChartRenderContext {
  const cartesian = chart.cartesian
  const grid = cartesian.config

  const allSeries = (option.series ?? []) as Series3D[]
  const series = allSeries.filter((s) => s.visible !== false)

  const themeConfig = chart.currentTheme
  const theme: ChartThemeTokens = {
    palette: chart.currentPalette,
    colorAt: (index: number) => chart.color(index),
    textColor: themeConfig.textColor ? String(themeConfig.textColor) : '#94a3b8',
    axisColor: themeConfig.axisColor ? String(themeConfig.axisColor) : '#475569',
    splitLineColor: themeConfig.splitLineColor
      ? String(themeConfig.splitLineColor)
      : '#1e293b',
    backgroundColor: themeConfig.backgroundColor
      ? String(themeConfig.backgroundColor)
      : null,
  }

  const THREE_NS = getThreeNamespace()

  return {
    option,
    series,
    allSeries,
    chart,

    coord: {
      xAt: (v: number) => cartesian.xAt(v),
      yAt: (v: number) => cartesian.yAt(v),
      zAt: (v: number) => cartesian.zAt(v),
      xAtCategory: (i: number) => cartesian.xAtCategory(i),
      xStep: cartesian.xStep,
      grid: {
        gridWidth: grid.gridWidth,
        gridHeight: grid.gridHeight,
        gridDepth: grid.gridDepth,
      },
      yDomain: [...cartesian.yAxis.domain] as [number, number],
      categoryCount: cartesian.categoryCount,
      categoryName: (i: number) => cartesian.categoryName(i),
      barSlot: (seriesIndex: number, seriesCount: number) =>
        cartesian.getBarSlot(seriesIndex, seriesCount),
    },

    geometry: {
      box: (w, h, d) => chart.resources.createBox(w, h, d),
      sphere: (r, seg) => chart.resources.createSphere(r, seg),
      cylinder: (rt, rb, h, seg) => chart.resources.createCylinder(rt, rb, h, seg),
      plane: (w, h) => chart.resources.createPlane(w, h),
      circle: (r, seg) => chart.resources.createCircle(r, seg),
      extrude: (shape, depth, opts) => {
        const geo = new THREE_NS.ExtrudeGeometry(shape, {
          depth,
          bevelEnabled: false,
          ...(opts ?? {}),
        })
        return chart.resources.trackGeometry(geo)
      },
      tube: (points, radius, tubularSegments) => {
        const curve = new THREE_NS.CatmullRomCurve3(points, false, 'centripetal')
        const geo = new THREE_NS.TubeGeometry(
          curve,
          tubularSegments ?? Math.max(24, points.length * 2),
          radius,
          8,
          false
        )
        return chart.resources.trackGeometry(geo)
      },
      track: (geo) => chart.resources.trackGeometry(geo),
    },

    material: (color, style) =>
      chart.resources.createMaterial(color, style as never),
    uniqueMaterial: (color, style) =>
      chart.resources.createUniqueMaterial(color, style as never),

    add: (object) => chart.content.add(object),

    anchor: (x, y, z, text, labelStyle) => {
      const node = new THREE_NS.Object3D()
      node.position.set(x, y, z)
      chart.content.add(node)
      if (text) {
        chart.labels.create({
          object: node,
          text,
          group: 'series',
          style: (labelStyle ?? { show: true }) as never,
        })
      }
      return node
    },

    label: (object, text, style) => {
      chart.labels.create({
        object,
        text,
        group: 'series',
        style: (style ?? { show: true }) as never,
      })
    },

    pickable: (object, meta) => {
      object.userData.__vtPick = meta
    },

    theme,
    animation: chart.animations,

    /* ---------------------- 过渡动画（自定义图表用） ---------------------- */
    // 说明：这里用 getter 而不是固定值，是因为 buildRenderContext 在
    // renderSeries 之前创建，而 extendChart 的父类会在 renderSeries 里
    // 设置 activePlan。用 getter 才能拿到「最终的」那个 plan。
    //
    // - defineChart 图表：始终为 null -> 每次新建（保证更新时也有动画）
    // - extendChart 图表：父类创建后复用同一个 plan，使前后动画同步
    get transition() {
      return chart.currentTransition ?? chart.createTransitionPlanForContext(series[0])
    },
    keepAnimating: () => chart.keepAnimatingForContext(),
    phase: chart.renderPhase,

    invalidate: () => chart.requestRender(),
  }
}

/* ------------------------------ 注册内置图表 ------------------------------ */

registerChart('bar3D', Bar3DChart as ChartConstructor, { builtin: true, aliases: ['bar'] })
registerChart('line3D', Line3DChart as ChartConstructor, { builtin: true, aliases: ['line'] })
registerChart('area3D', Area3DChart as ChartConstructor, { builtin: true, aliases: ['area'] })
registerChart('areaFlow3D', AreaFlow3DChart as ChartConstructor, {
  builtin: true,
  aliases: ['areaFlow', 'flow'],
})
registerChart('pie3D', Pie3DChart as ChartConstructor, { builtin: true, aliases: ['pie'] })
registerChart('scatter3D', Scatter3DChart as ChartConstructor, {
  builtin: true,
  aliases: ['scatter', 'effectScatter'],
})
registerChart('surface3D', Surface3DChart as ChartConstructor, { builtin: true, aliases: ['surface'] })
registerChart('radar3D', Radar3DChart as ChartConstructor, { builtin: true, aliases: ['radar'] })
registerChart('funnel3D', Funnel3DChart as ChartConstructor, { builtin: true, aliases: ['funnel'] })
registerChart('gauge3D', Gauge3DChart as ChartConstructor, { builtin: true, aliases: ['gauge'] })
registerChart('heatmap3D', Heatmap3DChart as ChartConstructor, {
  builtin: true,
  aliases: ['heatmap'],
})

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
}
