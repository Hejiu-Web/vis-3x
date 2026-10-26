/**
 * vis-3x — 缓动函数集合
 *
 * 独立实现，不依赖第三方动画库。
 */
import type { EasingName } from '../types/series'

/** 缓动函数签名：输入 0~1，输出（可能超出 0~1，如弹性缓动） */
export type EasingFn = (t: number) => number

const c1 = 1.70158
const c3 = c1 + 1
const c4 = (2 * Math.PI) / 3

/** 缓动函数表 */
export const EASINGS: Record<EasingName, EasingFn> = {
  linear: (t) => t,
  quadraticIn: (t) => t * t,
  quadraticOut: (t) => t * (2 - t),
  quadraticInOut: (t) => (t < 0.5 ? 2 * t * t : -1 + (4 - 2 * t) * t),
  cubicIn: (t) => t * t * t,
  cubicOut: (t) => 1 - (1 - t) ** 3,
  cubicInOut: (t) => (t < 0.5 ? 4 * t * t * t : 1 - (-2 * t + 2) ** 3 / 2),
  elasticOut: (t) =>
    t === 0 ? 0 : t === 1 ? 1 : 2 ** (-10 * t) * Math.sin((t * 10 - 0.75) * c4) + 1,
  backOut: (t) => 1 + c3 * (t - 1) ** 3 + c1 * (t - 1) ** 2,
  bounceOut: (t) => {
    const n1 = 7.5625
    const d1 = 2.75
    if (t < 1 / d1) return n1 * t * t
    if (t < 2 / d1) {
      const t2 = t - 1.5 / d1
      return n1 * t2 * t2 + 0.75
    }
    if (t < 2.5 / d1) {
      const t2 = t - 2.25 / d1
      return n1 * t2 * t2 + 0.9375
    }
    const t2 = t - 2.625 / d1
    return n1 * t2 * t2 + 0.984375
  },
  exponentialOut: (t) => (t === 1 ? 1 : 1 - 2 ** (-10 * t)),
}

/** 获取缓动函数，未知名称回退到 cubicOut */
export function getEasing(name: EasingName | undefined): EasingFn {
  if (!name) return EASINGS.cubicOut
  return EASINGS[name] ?? EASINGS.cubicOut
}

/** requestAnimationFrame 的兼容封装 */
export function raf(callback: FrameRequestCallback): number {
  if (typeof requestAnimationFrame === 'function') return requestAnimationFrame(callback)
  return setTimeout(() => callback(performance.now()), 16) as unknown as number
}

/** 取消 raf */
export function caf(handle: number): void {
  if (typeof cancelAnimationFrame === 'function') cancelAnimationFrame(handle)
  else clearTimeout(handle as unknown as ReturnType<typeof setTimeout>)
}

/** 简易时间线：管理一次属性动画 */
export interface TweenOptions {
  duration: number
  delay?: number
  easing?: EasingName
  onUpdate: (t: number) => void
  onComplete?: () => void
}

/**
 * 启动一个 tween。返回取消函数。
 */
export function tween(options: TweenOptions): () => void {
  const { duration, delay = 0, easing, onUpdate, onComplete } = options
  const ease = getEasing(easing)
  const start = performance.now() + delay
  let handle = 0
  let cancelled = false

  const step = (now: number) => {
    if (cancelled) return
    const elapsed = now - start
    if (elapsed < 0) {
      handle = raf(step)
      return
    }
    const t = duration <= 0 ? 1 : Math.min(1, elapsed / duration)
    onUpdate(ease(t))
    if (t < 1) {
      handle = raf(step)
    } else {
      onComplete?.()
    }
  }
  handle = raf(step)

  return () => {
    cancelled = true
    caf(handle)
  }
}

/**
 * 动画管理器：统一管理一个图表实例的所有 tween，销毁时批量取消。
 */
export class AnimationManager {
  private handles = new Set<() => void>()

  /** 创建 tween 并纳入管理 */
  add(options: TweenOptions): () => void {
    const cancel = tween(options)
    const wrapped = () => {
      cancel()
      this.handles.delete(wrapped)
    }
    this.handles.add(wrapped)
    return wrapped
  }

  /** 取消全部动画 */
  clear(): void {
    for (const cancel of this.handles) cancel()
    this.handles.clear()
  }

  /** 当前是否有动画在运行 */
  get active(): boolean {
    return this.handles.size > 0
  }
}
