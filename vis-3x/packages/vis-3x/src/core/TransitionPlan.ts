/**
 * vis-3x — 图表过渡动画系统
 *
 * 目标：让所有图表拥有一致、可配置的入场与更新动画，
 * 而不是各自实现一套（之前有的缩放、有的淡入、有的只在首帧播放）。
 *
 * ## 三种过渡
 *
 * | 类型 | 触发时机 | 表现 |
 * |---|---|---|
 * | `initial` | 图表首次渲染 | 从「零状态」生长出来 |
 * | `update`  | 数据更新（setOption） | 从「旧状态」平滑过渡到「新状态」 |
 * | `highlight` | 悬停等交互 | 由 InteractionManager 负责，不在此处 |
 *
 * ## 用法（在图表子类中）
 *
 * ```ts
 * const plan = this.createTransitionPlan(series, values.length)
 *
 * data.forEach((item, i) => {
 *   const mesh = this.createBar(...)
 *   plan.applyScaleY(mesh, valueHeight, i)   // 声明式描述动画
 *   plan.applyFade(mesh.material, i)
 * })
 *
 * plan.run()   // 统一启动
 * ```
 */
import * as THREE from 'three'
import type { AnimationManager } from '../utils/easing'
import type { AnimationConfig } from '../types/series'

/** 已解析的动画参数 */
export interface ResolvedAnimation {
  enabled: boolean
  duration: number
  delay: number
  easing: NonNullable<AnimationConfig['easing']>
  /** 逐项错峰步长（毫秒） */
  stagger: number
}

/** 动画阶段 */
export type TransitionPhase = 'initial' | 'update'

/** 单个可动画目标的描述 */
interface AnimationTarget {
  /** 应用动画（t 为 0~1 的缓动后进度） */
  apply: (t: number) => void
  /** 完成时调用 */
  finish?: () => void
  /** 延迟（毫秒） */
  delay: number
  /** 持续时长（毫秒） */
  duration: number
}

/**
 * 一次渲染的过渡计划
 *
 * 图表在 renderSeries 里通过它登记所有需要动画的对象，
 * 最后由 `run()` 统一启动，保证所有元素同步收尾。
 */
export class TransitionPlan {
  private targets: AnimationTarget[] = []
  private animations: AnimationManager
  private config: ResolvedAnimation
  private phase: TransitionPhase
  private started = false

  constructor(
    animations: AnimationManager,
    config: ResolvedAnimation,
    phase: TransitionPhase
  ) {
    this.animations = animations
    this.config = config
    this.phase = phase
  }

  /**
   * 动画是否启用（只看配置，**不依赖已登记的目标**）
   *
   * 注意：不要用这个值去守卫「登记动画」的代码，
   * 否则会形成自锁死——还没登记时 enabled 为 false，
   * 于是永远不登记。
   *
   * 正确用法：
   * ```ts
   * if (plan.animationsEnabled) plan.scaleY(mesh, i)  // ✓ 登记
   * ```
   * 而 `enabled` 只适合在**登记完成后**判断「是否有动画要跑」。
   */
  get animationsEnabled(): boolean {
    return this.config.enabled
  }

  /**
   * 是否真的会产生动画（配置启用 **且** 已登记了目标）
   *
   * 用于 `run()` 之后或需要知道「这次渲染有没有动画」的场景。
   */
  get enabled(): boolean {
    return this.config.enabled && this.targets.length > 0
  }

  /** 已登记的目标数量 */
  get targetCount(): number {
    return this.targets.length
  }

  /** 当前阶段 */
  get currentPhase(): TransitionPhase {
    return this.phase
  }

  /** 计算某个数据项的错峰延迟 */
  delayFor(index: number, extraDelay = 0): number {
    return this.config.delay + index * this.config.stagger + extraDelay
  }

  /* ------------------------------------------------------------------ */
  /*                          声明式动画登记                              */
  /* ------------------------------------------------------------------ */

  /**
   * 垂直缩放生长
   *
   * 适用于柱子、面积、曲面等「从底部向上长」的元素。
   * 要求几何体底部位于局部 y = 0（这样缩放时底部固定）。
   *
   * @param object  目标对象
   * @param index   数据索引（用于错峰）
   * @param from    起始缩放（默认 0.001）
   * @param extraDelay 额外延迟
   */
  scaleY(object: THREE.Object3D, index: number, from = 0.001, extraDelay = 0): void {
    if (!this.config.enabled) return
    const start = from
    object.scale.y = start
    this.targets.push({
      delay: this.delayFor(index, extraDelay),
      duration: this.config.duration,
      apply: (t) => {
        object.scale.y = start + (1 - start) * t
      },
      finish: () => {
        object.scale.y = 1
      },
    })
  }

  /**
   * 径向缩放生长
   *
   * 适用于雷达面、饼图等「从中心向外扩」的元素（XZ 平面）。
   */
  scaleXZ(object: THREE.Object3D, index: number, from = 0.001, extraDelay = 0): void {
    if (!this.config.enabled) return
    const start = from
    object.scale.set(start, 1, start)
    this.targets.push({
      delay: this.delayFor(index, extraDelay),
      duration: this.config.duration,
      apply: (t) => {
        const s = start + (1 - start) * t
        object.scale.set(s, 1, s)
      },
      finish: () => {
        object.scale.set(1, 1, 1)
      },
    })
  }

  /**
   * 透明度淡入
   *
   * 适用于材质透明度可控的元素（散点、面片、漏斗层）。
   */
  fade(object: THREE.Object3D, index: number, targetOpacity = 1, extraDelay = 0): void {
    if (!this.config.enabled) return
    const materials = collectMaterials(object)
    if (!materials.length) return
    for (const m of materials) {
      m.transparent = true
      m.opacity = 0
      m.needsUpdate = true
    }
    this.targets.push({
      delay: this.delayFor(index, extraDelay),
      duration: this.config.duration,
      apply: (t) => {
        for (const m of materials) m.opacity = targetOpacity * t
      },
      finish: () => {
        for (const m of materials) {
          m.opacity = targetOpacity
          // 不透明材质恢复以省一点渲染开销
          if (targetOpacity >= 1) m.transparent = false
          m.needsUpdate = true
        }
      },
    })
  }

  /**
   * 自定义属性动画
   *
   * @param apply      收到 0~1 的进度
   * @param index      数据索引
   */
  custom(
    apply: (t: number) => void,
    index: number,
    options: { finish?: () => void; extraDelay?: number } = {}
  ): void {
    if (!this.config.enabled) return
    this.targets.push({
      delay: this.delayFor(index, options.extraDelay ?? 0),
      duration: this.config.duration,
      apply,
      finish: options.finish,
    })
  }

  /* ------------------------------------------------------------------ */
  /*                              执行                                   */
  /* ------------------------------------------------------------------ */

  /** 启动全部动画（每帧只应调用一次） */
  run(): void {
    if (this.started) return
    this.started = true
    if (!this.config.enabled) {
      // 未启用时直接落到终态
      for (const t of this.targets) {
        t.apply(1)
        t.finish?.()
      }
      return
    }
    for (const target of this.targets) {
      this.animations.add({
        duration: target.duration,
        delay: target.delay,
        easing: this.config.easing,
        onUpdate: target.apply,
        onComplete: target.finish,
      })
    }
  }
}

/** 收集对象上的所有材质（含子对象） */
function collectMaterials(object: THREE.Object3D): THREE.Material[] {
  const out: THREE.Material[] = []
  object.traverse((child) => {
    const mesh = child as THREE.Mesh
    if (!mesh.material) return
    const mats = Array.isArray(mesh.material) ? mesh.material : [mesh.material]
    for (const m of mats) {
      if (m && !out.includes(m)) out.push(m)
    }
  })
  return out
}
