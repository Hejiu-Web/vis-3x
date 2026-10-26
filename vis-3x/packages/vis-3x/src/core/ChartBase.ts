/**
 * vis-3x — 图表基类
 *
 * 负责把「配置项」翻译成「引擎 + 环境 + 系列」：
 * 1. 解析并补全默认配置
 * 2. 初始化坐标系与场景环境
 * 3. 计算网格尺寸
 * 4. 暴露渲染钩子供子类实现具体图形
 * 5. 统一生命周期：setOption / resize / dispose / exportImage
 *
 * 子类只需实现 `renderSeries()`。
 */
import * as THREE from 'three'
import { Engine, type EngineOptions } from './Engine'
import { EventBus } from './EventBus'
import { ResourceManager } from './ResourceManager'
import { LabelManager } from './LabelManager'
import { InteractionManager } from './InteractionManager'
import { Cartesian3D, autoGridSize, type CartesianConfig } from './Cartesian3D'
import { SceneEnvironment } from './SceneEnvironment'
import { setChartBase } from './chart-base-ref'
import { TransitionPlan, type ResolvedAnimation } from './TransitionPlan'
import type { Vis3xOption, ChartEventMap, ChartEventType, TooltipData } from '../types/option'
import type { Series3D, AnimationConfig } from '../types/series'
import type { InteractionMode, ThemeConfig } from '../types/environment'
import { DEFAULT_PALETTE } from '../utils/color'
import { representativeColor } from '../utils/gradient'
import type { ColorLike, LegendStyle } from '../types/style'
import { AnimationManager } from '../utils/easing'

/**
 * 运行时全局默认值
 *
 * 由主入口的 Vue 插件 `app.use(Vis3x, { theme, palette })` 写入，
 * 所有图表实例在解析配置时作为**最低优先级**的兜底。
 *
 * 放在模块级而不是单例对象上，是因为 `vis-3x/core` 子路径使用者
 * （不经过 Vue 插件）同样应该能吃到 `app.use()` 设置的默认值。
 */
export const runtimeDefaults: {
  theme: ThemeConfig | null
  palette: string[] | null
} = {
  theme: null,
  palette: null,
}

/** 设置运行时全局默认主题（传 null 清除） */
export function setRuntimeDefaultTheme(theme: ThemeConfig | null): void {
  runtimeDefaults.theme = theme
}

/** 设置运行时全局默认调色板（传 null 清除） */
export function setRuntimeDefaultPalette(palette: string[] | null): void {
  runtimeDefaults.palette = palette?.length ? [...palette] : null
}

/** 解析后的配置（默认值已填充） */
export interface ResolvedChartOption extends Vis3xOption {
  /** 明确指定的图表类型 */
  resolvedType: string
}

/** 图表基类抽象定义 */
export abstract class ChartBase {
  /** 渲染引擎 */
  readonly engine: Engine
  /** 资源管理器 */
  readonly resources: ResourceManager
  /** 标签管理器 */
  readonly labels: LabelManager
  /** 坐标系 */
  readonly cartesian: Cartesian3D
  /** 场景环境 */
  readonly environment: SceneEnvironment
  /** 交互管理器 */
  readonly interaction: InteractionManager
  /** 动画管理器 */
  readonly animations = new AnimationManager()

  /** 当前配置 */
  protected option: Vis3xOption = {}
  /** 主题 */
  protected theme: ThemeConfig = {}
  /** 调色板 */
  protected palette: string[] = DEFAULT_PALETTE

  /** 系列根分组：每次渲染重建 */
  protected seriesGroup = new THREE.Group()

  /**
   * 系列根分组（对外只读）
   *
   * 自定义图表通过 `ctx.add()` 挂载内容，底层就是加到这里的。
   */
  get content(): THREE.Group {
    return this.seriesGroup
  }

  /** 当前生效的主题（对外只读） */
  get currentTheme(): ThemeConfig {
    return this.theme
  }

  /** 当前生效的调色板（对外只读） */
  get currentPalette(): string[] {
    return this.palette
  }

  /**
   * 取调色板颜色（公开版本，供自定义图表使用）
   */
  color(index: number): string {
    return this.colorAt(index)
  }

  /**
   * 生命周期钩子：图表挂载完成后调用
   *
   * 子类（含 defineChart 生成的类）可覆写以执行初始化逻辑。
   */
  protected onChartMounted(): void {
    /* 默认空实现，由子类/扩展覆盖 */
  }

  /** 是否已完成首次渲染 */
  protected rendered = false
  /**
   * 已执行的渲染次数
   *
   * 0 表示尚未渲染（首次入场），>0 表示数据更新。
   * 图表据此选择「入场动画」还是「更新过渡」。
   */
  protected renderCount = 0
  /** 提示框回调（由外部组件注入） */
  private tooltipCallback?: (data: TooltipData) => void
  /** 图例回调 */
  private legendCallback?: (items: LegendItemData[]) => void
  /** 销毁标记 */
  private disposed = false

  constructor(container: HTMLElement, engineOptions: EngineOptions = {}) {
    this.engine = new Engine(container, engineOptions)
    this.resources = this.engine.resources
    this.labels = new LabelManager({
      renderer: this.engine.labelRenderer,
      container,
    })
    this.cartesian = new Cartesian3D()
    this.environment = new SceneEnvironment({
      cartesian: this.cartesian,
      resources: this.resources,
      labels: this.labels,
    })
    this.interaction = new InteractionManager({
      engine: this.engine,
      target: this.seriesGroup,
      onTooltip: (data) => this.tooltipCallback?.(data),
    })

    this.seriesGroup.name = '__vt_series'
    this.engine.root.add(this.environment.group)
    this.engine.root.add(this.seriesGroup)

    /**
     * 通知子类已完成初始化（供 defineChart / extendChart 挂载钩子使用）
     *
     * 关键：**不能**在构造函数里直接同步调用。
     * 子类（含 defineChart 生成的类）的字段初始化器在 `super()` 返回之后才执行，
     * 而本文件 `useDefineForClassFields: true` 时子类字段会在 super 之后才赋值。
     * 同步调用会让钩子看到「字段全是 undefined」的半成品实例。
     *
     * 推迟到当前同步栈结束后（微任务）调用，此时子类字段已初始化完毕，
     * 但引擎尚未开始渲染，适合做一次性初始化。
     */
    queueMicrotask(() => {
      if (this.disposed) return
      try {
        this.onChartMounted()
      } catch (error) {
        console.error('[vis-3x] onChartMounted 钩子执行出错', error)
      }
    })
  }

  /* ------------------------------------------------------------------ */
  /*                              配置解析                               */
  /* ------------------------------------------------------------------ */

  /**
   * 设置配置项并渲染
   */
  setOption(option: Vis3xOption): void {
    if (this.disposed) return
    const start = performance.now()

    this.option = option ?? {}
    this.theme = this.resolveTheme(this.option)
    this.palette = this.resolvePalette(this.theme)

    // 主题
    this.engine.applyTheme(this.theme)
    this.engine.applyPostprocessing(this.option.postprocessing)

    // 背景：option 显式优先，其次主题
    if (this.option.backgroundColor !== undefined) {
      if (this.option.backgroundColor === null) this.engine.scene.background = null
      else this.engine.scene.background = new THREE.Color(this.option.backgroundColor)
    } else if (this.theme.backgroundColor !== undefined) {
      if (this.theme.backgroundColor === null) this.engine.scene.background = null
      else this.engine.scene.background = new THREE.Color(this.theme.backgroundColor)
    }

    // 光照
    if (this.option.lights?.length) this.engine.setLights(this.option.lights)
    this.engine.setLightHelpersVisible(this.option.showLightHelpers ?? false)

    // 控制器
    this.engine.applyControlSettings(this.option.controlSettings)

    // 按需渲染
    if (this.option.onDemandRendering !== undefined) {
      this.engine.setContinuousRendering(this.option.onDemandRendering === false)
    }

    // 交互
    this.interaction.setEnabled(this.option.interactive !== false)

    // 标签默认样式
    this.labels.setDefaultTextStyle(this.option.label?.textStyle)

    // 解析参数
    const resolved = this.resolveOption(this.option)

    // 系列数据
    const seriesList = resolved.series ?? []
    this.cartesian.setGridSize(
      autoGridSize(this.countCategories(seriesList), this.countSeries(seriesList), seriesList.length > 1)
    )
    this.cartesian.setData(
      seriesList,
      resolved.xAxis3D,
      resolved.yAxis3D,
      resolved.zAxis3D
    )

    // 重建环境（使用解析后的配置，保证 showCoordinate / gridFloor 生效）
    this.environment.build({
      gridFloor: resolved.gridFloor,
      theme: this.theme,
      showCoordinate: resolved.showCoordinate,
      axisStyle: resolved.axisStyle,
      xAxis: resolved.xAxis3D,
      yAxis: resolved.yAxis3D,
      zAxis: resolved.zAxis3D,
    })

    // 重建系列
    // 注意：必须在释放旧网格之前清掉悬停引用，否则交互管理器会继续
    // 持有已被 dispose 的材质，下一次 pointerleave 会操作野对象。
    this.interaction.resetHover()
    /**
     * 数据更新时保留标签 DOM，首次渲染时重建
     *
     * - 首次渲染：没有任何标签，走 `clearSeries()` 即可；
     * - 数据更新：走 `clearSeriesKeepLabels()`，标签元素与锚点对象的绑定
     *   仍然有效，渲染时通过 `LabelManager.update()` 就地改文本，
     *   避免 DOM 重建造成的闪动与「停在左上角」问题。
     */
    if (this.rendered) this.clearSeriesKeepLabels()
    else this.clearSeries()
    this.animations.clear()
    // 清空上一轮的过渡计划：本次 renderSeries 会重新创建，
    // 这样数据更新时也能登记并播放入场动画（而不是复用已完成、started 的旧 plan）
    this.activePlan = null
    this.renderSeries(resolved)

    // 摘掉新数据里已不存在的「孤儿标签」
    if (this.rendered) {
      this.labels.pruneOrphans((object) => object.parent !== null && this.isWithinContent(object))
    }

    // 递增渲染计数：0 -> 1 表示完成首次入场，之后都算数据更新
    const wasFirstRender = this.renderCount === 0
    this.renderCount++

    // 动画期间保持重绘（按需渲染模式下必需）
    this.keepRenderingWhileAnimating()

    // 图例
    this.legendCallback?.(this.buildLegendItems(seriesList))

    // 相机自适应（仅首次；后续数据更新保持用户当前视角）
    if (!this.rendered || wasFirstRender) {
      this.fitToScreen()
      this.rendered = true
    } else {
      this.engine.requestRender()
    }

    const duration = performance.now() - start
    this.engine.eventBus.emit('chart:rendered', {
      duration,
      type: this.chartType,
    })
  }

  /**
   * 合并主题：运行时全局默认 < option.theme
   *
   * `app.use(Vis3x, { theme })` 设置的是全局默认值，
   * 单个图表的 `option.theme` 应当能覆盖它。
   */
  protected resolveTheme(option: Vis3xOption): ThemeConfig {
    const globalTheme = runtimeDefaults.theme
    const localTheme = option.theme ?? {}
    if (!globalTheme) return localTheme
    return { ...globalTheme, ...localTheme }
  }

  /**
   * 合并调色板：option.theme.palette > 全局默认调色板 > DEFAULT_PALETTE
   */
  protected resolvePalette(theme: ThemeConfig): string[] {
    if (theme.palette?.length) return theme.palette
    if (runtimeDefaults.palette?.length) return runtimeDefaults.palette
    return DEFAULT_PALETTE
  }

  /**
   * 解析配置：填充默认值、推导尺寸
   * 子类可覆写以定制默认值
   */
  protected resolveOption(option: Vis3xOption): ResolvedChartOption {
    const series = (option.series ?? []).map((s) => ({ ...s })) as Series3D[]
    return {
      ...option,
      series,
      showCoordinate: option.showCoordinate ?? !this.isNonCartesian(),
      gridFloor: {
        show: true,
        showShadowPlane: true,
        showWall: false,
        ...option.gridFloor,
      },
      resolvedType: this.chartType,
    }
  }

  /** 统计类目数量 */
  protected countCategories(seriesList: Series3D[]): number {
    let max = 0
    for (const s of seriesList) {
      // 曲面/热力图的类目来自 xAxisData
      if (s.type === 'surface3D' || s.type === 'heatmap3D') {
        const xAxisData = (s as { xAxisData?: Array<string | number> }).xAxisData
        if (xAxisData?.length) max = Math.max(max, xAxisData.length)
        continue
      }
      const data = (s as { data?: unknown[] }).data
      if (Array.isArray(data)) max = Math.max(max, data.length)
    }
    return max || 5
  }

  /** 统计系列数量 */
  protected countSeries(seriesList: Series3D[]): number {
    return Math.max(1, seriesList.filter((s) => s.visible !== false).length)
  }

  /** 是否为非笛卡尔图表（饼图、漏斗、仪表等） */
  protected isNonCartesian(): boolean {
    return false
  }

  /**
   * 渲染系列内容（子类必须实现）
   *
   * 实现时把网格挂载到 `this.content`（即 seriesGroup）。
   */
  protected abstract renderSeries(option: ResolvedChartOption): void

  /** 图表类型标识（用于事件与调试） */
  abstract get chartType(): string;

  /** 获取网格尺寸配置 */
  protected get gridConfig(): CartesianConfig {
    return this.cartesian.config
  }

  /* ------------------------------------------------------------------ */
  /*                            系列辅助方法                             */
  /* ------------------------------------------------------------------ */

  /**
   * 清空系列分组（释放几何体与材质）
   *
   * 注意：这里会调用 `clearSeriesLabels()` 清理标签。
   * 子类如果用了额外的 label 分组，必须覆写 `clearSeriesLabels()`，
   * 否则那些标签在重新渲染后仍留在 DOM 里、失去锚点（表现为飘到左上角）。
   */
  protected clearSeries(): void {
    this.clearSeriesLabels()
    for (const child of [...this.seriesGroup.children]) {
      this.seriesGroup.remove(child)
      this.resources.disposeSubtree(child)
    }
  }

  /**
   * 清空「属于系列」的标签分组
   *
   * 默认只清 `'series'` 分组。子类用了自定义分组时覆写这个方法，
   * 例如仪表盘的中心数值用 `'gauge-detail'`：
   *
   * ```ts
   * protected clearSeriesLabels(): void {
   *   super.clearSeriesLabels()
   *   this.labels.clearGroup('gauge-detail')
   * }
   * ```
   *
   * 不要清 `'axis'` 分组——坐标轴标签由 SceneEnvironment 自己管理。
   */
  protected clearSeriesLabels(): void {
    this.labels.clearGroup('series')
  }

  /**
   * 清空系列网格，但**保留标签 DOM**
   *
   * 用于 `setOption` 的数据更新路径：标签元素与 `object` 的绑定关系
   * 只要锚点对象被复用就依然有效，重建 DOM 反而会让新元素在下一帧
   * 渲染前停留于「无 transform」状态（停在容器左上角）并造成闪烁。
   *
   * 子类如果自己维护了额外分组的标签，可覆写本方法做同样的保留处理。
   *
   * @returns 被移除的网格列表（子类可用来清理自定义状态）
   */
  protected clearSeriesKeepLabels(): void {
    for (const child of [...this.seriesGroup.children]) {
      this.seriesGroup.remove(child)
      this.resources.disposeSubtree(child)
    }
  }

  /**
   * 判断某个对象是否仍挂在本图表的内容树上
   *
   * 用于清理孤儿标签：锚点已经从 `seriesGroup` 上摘掉的，
   * 对应标签元素也必须一并移除，否则会永远停在最后一帧的位置。
   */
  protected isWithinContent(object: THREE.Object3D): boolean {
    let node: THREE.Object3D | null = object
    while (node) {
      if (node === this.seriesGroup) return true
      node = node.parent
    }
    return false
  }

  /** 取调色板颜色 */
  protected colorAt(index: number): string {
    if (!this.palette.length) return DEFAULT_PALETTE[0]
    const i = ((index % this.palette.length) + this.palette.length) % this.palette.length
    return this.palette[i]
  }

  /** 取某个系列的颜色列表（系列级 color 优先） */
  protected seriesColors(series: Series3D, count: number): string[] {
    const explicit = (series as { color?: string[] }).color
    const out: string[] = []
    for (let i = 0; i < count; i++) {
      out.push(explicit?.length ? explicit[i % explicit.length] : this.colorAt(i))
    }
    return out
  }

  /**
   * 解析系列的「代表性颜色」——图例、提示框、标签等处统一使用
   *
   * 优先级（与 ECharts 的 `itemStyle.color` 优先约定一致）：
   *
   * 1. `series.itemStyle.color`      ⭐ ECharts 标准写法
   * 2. `series.lineStyle.color`      折线
   * 3. `series.areaStyle.color`      面积
   * 4. `series.curtainStyle.color`   折线垂幕
   * 5. `series.pointStyle.color`     散点
   * 6. `series.color[index]`         系列调色板
   * 7. 主题调色板 `palette[index]`    兜底
   *
   * 若命中的是渐变字符串，返回其**中间色**（`representativeColor`），
   * 因为图例色块 / 提示框小圆点无法渲染渐变。
   */
  protected resolveSeriesColor(series: Series3D, index = 0): string {
    const s = series as unknown as {
      itemStyle?: { color?: ColorLike }
      lineStyle?: { color?: ColorLike }
      areaStyle?: { color?: ColorLike }
      curtainStyle?: { color?: ColorLike }
      pointStyle?: { color?: ColorLike }
      color?: string[]
      type?: string
    }

    // 按「系列类型最相关的样式」优先，避免误取到不存在的字段
    const candidates: Array<ColorLike | undefined> = []
    if (s.itemStyle?.color !== undefined) candidates.push(s.itemStyle.color)

    switch (s.type) {
      case 'line3D':
        candidates.push(s.lineStyle?.color, s.curtainStyle?.color)
        break
      case 'area3D':
        candidates.push(s.areaStyle?.color, s.lineStyle?.color)
        break
      case 'scatter3D':
        candidates.push(s.pointStyle?.color)
        break
      default:
        // 通用兜底：把可能存在的样式字段都放进候选
        candidates.push(s.lineStyle?.color, s.areaStyle?.color, s.curtainStyle?.color, s.pointStyle?.color)
        break
    }

    // 系列调色板
    if (s.color?.length) candidates.push(s.color[index % s.color.length])

    for (const candidate of candidates) {
      if (candidate === undefined || candidate === null) continue
      if (typeof candidate === 'number') return `#${candidate.toString(16).padStart(6, '0')}`
      return representativeColor(candidate, this.colorAt(index))
    }

    return this.colorAt(index)
  }

  /**
   * 解析系列的完整调色板颜色列表（饼图 / 漏斗等按数据项着色的场景）
   */
  protected resolveSeriesPalette(series: Series3D, count: number): string[] {
    const s = series as unknown as { color?: string[]; itemStyle?: { color?: ColorLike } }
    const out: string[] = []
    for (let i = 0; i < count; i++) {
      if (s.color?.length) {
        out.push(representativeColor(s.color[i % s.color.length], this.colorAt(i)))
      } else if (s.itemStyle?.color !== undefined) {
        out.push(representativeColor(s.itemStyle.color, this.colorAt(i)))
      } else {
        out.push(this.colorAt(i))
      }
    }
    return out
  }

  /** 合并系列动画配置与全局动画配置 */
  protected seriesAnimation(series: Series3D): Required<
    Pick<AnimationConfig, 'enabled' | 'duration' | 'delay' | 'easing' | 'stagger'>
  > {
    const global = this.option.animation ?? {}
    const local = (series as { animation?: AnimationConfig }).animation ?? {}
    const merged = { ...global, ...local }

    // 数据更新时使用更短的时长，避免等待过久
    const isUpdate = this.renderCount > 0
    const baseDuration = merged.duration ?? 900
    const updateDuration = merged.updateDuration ?? Math.round(baseDuration * 0.6)

    return {
      enabled: merged.enabled !== false,
      // 首次入场用完整时长；更新时用 updateDuration
      duration: isUpdate ? updateDuration : baseDuration,
      delay: merged.delay ?? 0,
      // 更新时用更克制的缓动，避免视觉噪声
      easing: merged.easing ?? (isUpdate ? 'quadraticOut' : 'cubicOut'),
      stagger: merged.stagger ?? 0,
    }
  }

  /**
   * 创建一次渲染的过渡计划
   *
   * 图表在 `renderSeries` 中用返回的 plan 登记动画，
   * 最后调用 `plan.run()` 统一启动。
   *
   * @param series 系列配置（取其动画设置）
   *
   * @example
   * ```ts
   * const plan = this.createTransitionPlan(series)
   * mesh.position.set(x, y, z)
   * plan.scaleY(mesh, dataIndex)      // 登记生长动画
   * plan.fade(labelAnchor, dataIndex) // 登记淡入
   * plan.run()                        // 统一启动
   * ```
   */
  protected createTransitionPlan(series: Series3D): TransitionPlan {
    const cfg = this.seriesAnimation(series)
    const plan = new TransitionPlan(
      this.animations,
      {
        enabled: cfg.enabled,
        duration: cfg.duration,
        delay: cfg.delay,
        easing: cfg.easing,
        stagger: cfg.stagger,
      },
      this.renderCount > 0 ? 'update' : 'initial'
    )
    // 记录当前 plan，供 buildRenderContext（自定义图表）读取
    this.activePlan = plan
    return plan
  }

  /**
   * 当前渲染使用的过渡计划
   *
   * 由 `createTransitionPlan()` 设置；自定义图表通过
   * `ctx.transition` 访问同一个实例。
   */
  protected activePlan: TransitionPlan | null = null

  /** 供 registry 的 buildRenderContext 读取当前 plan */
  get currentTransition(): TransitionPlan | null {
    return this.activePlan
  }

  /** 供 registry 调用：动画期间保持重绘 */
  keepAnimatingForContext(): void {
    this.keepRenderingWhileAnimating()
  }

  /**
   * 供 registry 调用：为自定义图表创建过渡计划
   *
   * `defineChart` 的 render 回调里通过 `ctx.transition` 使用。
   */
  createTransitionPlanForContext(series?: Series3D): TransitionPlan {
    const target = series ?? ((this.option.series ?? [])[0] as Series3D) ?? ({ type: 'bar3D', data: [] } as Series3D)
    return this.createTransitionPlan(target)
  }

  /** 当前渲染阶段：首次入场 / 数据更新 */
  get renderPhase(): 'initial' | 'update' {
    return this.renderCount > 1 ? 'update' : 'initial'
  }

  /**
   * 启动「动画期间持续渲染」
   *
   * 按需渲染模式下，动画期间必须保持重绘，
   * 动画结束后自动停止。所有图表共用这一逻辑。
   */
  protected keepRenderingWhileAnimating(): void {
    if (!this.animations.active) return
    // 动画结束后自动注销循环回调，让引擎回到「无需求不排 rAF」的静止状态
    const stop = this.engine.onLoop(() => {
      if (!this.animations.active) stop()
    })
  }

  /** 当前是否处于动画中 */
  protected get isAnimating(): boolean {
    return this.animations.active
  }

  /**
   * 为对象附加交互数据
   */
  protected makePickable(
    object: THREE.Object3D,
    meta: {
      seriesIndex: number
      dataIndex: number
      seriesName?: string
      name?: string
      value: number | number[]
      color: string
    }
  ): void {
    object.userData.__vtPick = meta
  }

  /** 工具：创建一个文字标签 */
  protected createLabel(
    object: THREE.Object3D,
    text: string,
    style: Parameters<LabelManager['create']>[0]['style'],
    group = 'series'
  ): void {
    this.labels.create({ object, text, style, group })
  }

  /* ------------------------------------------------------------------ */
  /*                            图例与提示框                             */
  /* ------------------------------------------------------------------ */

  /** 构建图例数据 */
  protected buildLegendItems(seriesList: Series3D[], legendOverride?: LegendStyle): LegendItemData[] {
    const items: LegendItemData[] = []
    // 优先用传入的图例配置（组件层可能带 palette 覆盖），其次当前配置
    const legendCfg = legendOverride ?? this.option.legend ?? {}
    const iconStyle = legendCfg.itemStyle
    // 图例级 itemStyle.color 可统一覆盖所有图标颜色
    const overrideColor = iconStyle?.color

    for (let i = 0; i < seriesList.length; i++) {
      const series = seriesList[i]
      // 饼图/漏斗等使用数据项作为图例
      if (series.type === 'pie3D' || series.type === 'funnel3D') {
        const pieData = series.data as Array<
          number | { value: number; name?: string }
        >
        const colors = this.resolveSeriesPalette(series, pieData.length)
        pieData.forEach((item, di) => {
          const name =
            typeof item === 'object' && item !== null && 'name' in item && item.name
              ? String(item.name)
              : `数据 ${di + 1}`
          items.push({
            name,
            color: overrideColor !== undefined
              ? representativeColor(overrideColor, colors[di])
              : colors[di],
            seriesIndex: i,
            dataIndex: di,
            visible: legendCfg.selected?.[name] ?? true,
            symbol: legendCfg.icon === 'circle' ? 'circle' : 'rect',
          })
        })
        continue
      }
      const name = series.name ?? `系列 ${i + 1}`
      items.push({
        name,
        color:
          overrideColor !== undefined
            ? representativeColor(overrideColor, this.resolveSeriesColor(series, i))
            : this.resolveSeriesColor(series, i),
        seriesIndex: i,
        visible: legendCfg.selected?.[name] ?? series.visible !== false,
        symbol: legendCfg.icon === 'circle' ? 'circle' : 'rect',
      })
    }
    return items
  }

  /** 注册提示框回调 */
  onTooltip(callback: (data: TooltipData) => void): void {
    this.tooltipCallback = callback
    this.interaction.setTooltipCallback(callback)
  }

  /** 注册图例回调 */
  onLegend(callback: (items: LegendItemData[]) => void): void {
    this.legendCallback = callback
    if (this.option.series) {
      callback(this.buildLegendItems(this.option.series))
    }
  }

  /**
   * 计算图例项（公开 API）
   *
   * 组件层与命令式用法共用同一套颜色解析逻辑，保证图例色块、
   * 提示框小圆点与 3D 图形本身用的永远是同一个颜色。
   *
   * @param option 可选：按指定配置计算；不传则用当前配置
   */
  getLegendItems(option?: Vis3xOption): LegendItemData[] {
    const series = option?.series ?? this.option.series ?? []
    return this.buildLegendItems(series as Series3D[], option?.legend)
  }

  /* ------------------------------------------------------------------ */
  /*                              事件 API                               */
  /* ------------------------------------------------------------------ */

  /** 订阅事件 */
  on<T extends ChartEventType>(
    event: T,
    listener: (payload: ChartEventMap[T]) => void
  ): () => void {
    return this.engine.eventBus.on(event, listener)
  }

  /** 订阅一次 */
  once<T extends ChartEventType>(
    event: T,
    listener: (payload: ChartEventMap[T]) => void
  ): () => void {
    return this.engine.eventBus.once(event, listener)
  }

  /** 取消订阅 */
  off<T extends ChartEventType>(
    event: T,
    listener: (payload: ChartEventMap[T]) => void
  ): void {
    this.engine.eventBus.off(event, listener)
  }

  /** 派发事件 */
  dispatch<T extends ChartEventType>(event: T, payload: ChartEventMap[T]): void {
    this.engine.eventBus.emit(event, payload)
  }

  /** 事件总线（高级用法） */
  get eventBus(): EventBus {
    return this.engine.eventBus
  }

  /* ------------------------------------------------------------------ */
  /*                              生命周期                               */
  /* ------------------------------------------------------------------ */

  /** 尺寸变化 */
  resize(): void {
    this.engine.resize()
  }

  /** 相机自适应 */
  fitToScreen(): void {
    // 预留边距，保证坐标轴标签与轴名称完整可见
    const { gridWidth, gridHeight, gridDepth } = this.cartesian.config
    const padding = Math.max(gridWidth, gridDepth, gridHeight) * 0.2
    this.engine.fitToScreen(undefined, undefined, padding)
  }

  /** 重置视角 */
  resetCamera(): void {
    this.engine.resetCamera(this.option.controlSettings?.cameraDirection)
  }

  /**
   * 切换相机交互模式
   *
   * - `'free'`   自由视角：旋转 + 缩放 + 平移
   * - `'rotate'` 仅旋转：禁用缩放与平移
   * - `'fixed'`  固定视角：完全禁用，画面锁定
   *
   * 注意：只影响**相机**交互；悬停高亮、点击事件、提示框仍然可用。
   * 要一并关闭数据交互，请设 `setOption({ interactive: false })`。
   *
   * @example
   * ```ts
   * chart.setInteractionMode('fixed')  // 锁定视角
   * chart.setInteractionMode('free')   // 恢复自由视角
   * ```
   */
  setInteractionMode(mode: InteractionMode): void {
    if (this.option.controlSettings) {
      this.option.controlSettings.interactionMode = mode
    } else {
      this.option.controlSettings = { interactionMode: mode }
    }
    this.engine.setInteractionMode(mode)
  }

  /** 当前交互模式 */
  get interactionMode(): InteractionMode {
    return this.option.controlSettings?.interactionMode ?? 'free'
  }

  /** 相机当前是否可被用户操作 */
  get isCameraInteractive(): boolean {
    return this.engine.isCameraInteractive
  }

  /** 获取当前配置副本 */
  getOption(): Vis3xOption {
    return this.option
  }

  /**
   * 导出图片
   *
   * @param options 导出选项
   */
  exportImage(options?: { backgroundColor?: string | null; scale?: number }): string {
    return this.engine.exportImage({
      backgroundColor: options?.backgroundColor ?? this.option.backgroundColor ?? undefined,
      scale: options?.scale,
    })
  }

  /** 切换持续渲染 */
  setContinuousRendering(enabled: boolean): void {
    this.engine.setContinuousRendering(enabled)
  }

  /** 请求重绘 */
  requestRender(): void {
    this.engine.requestRender()
  }

  /** 销毁 */
  dispose(): void {
    if (this.disposed) return
    this.disposed = true
    this.animations.clear()
    this.labels.clear()
    this.interaction.dispose()
    this.environment.dispose()
    this.engine.eventBus.emit('chart:dispose', { type: this.chartType })
    this.engine.dispose()
  }

  get isDisposed(): boolean {
    return this.disposed
  }
}

/**
 * 把 ChartBase 自身注入引用桥
 *
 * `defineChart` / `extendChart` 需要在运行时拿到 ChartBase 才能动态构造子类。
 * 通过独立的中立模块（chart-base-ref）传递引用，避免与 registry 形成循环依赖。
 */
setChartBase(ChartBase as unknown as new (
  container: HTMLElement,
  options?: EngineOptions
) => ChartBase)

/** 图例项数据 */
export interface LegendItemData {
  name: string
  color: string
  seriesIndex: number
  /** 数据项索引（饼图等多色系列使用） */
  dataIndex?: number
  visible: boolean
  symbol?: 'rect' | 'circle'
}
