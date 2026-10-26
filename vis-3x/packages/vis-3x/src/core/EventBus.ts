/**
 * vis-3x — 类型安全的事件总线
 *
 * 用于图表内部各组件（坐标系、光照、交互、图层）之间的解耦通信，
 * 同时作为对外事件 API 的基础实现。
 */
import type { ChartEventMap, ChartEventType, Unsubscribe } from '../types/option'

type Listener<T extends ChartEventType> = (payload: ChartEventMap[T]) => void

/**
 * 事件总线
 *
 * @example
 * ```ts
 * const bus = new EventBus()
 * const off = bus.on('chart:click', (p) => console.log(p.dataIndex))
 * bus.emit('chart:click', payload)
 * off()
 * ```
 */
export class EventBus {
  private listeners = new Map<ChartEventType, Set<Listener<ChartEventType>>>()
  private onceListeners = new Map<ChartEventType, Set<Listener<ChartEventType>>>()
  private debug = false

  /** 开启调试日志 */
  setDebug(enabled: boolean): void {
    this.debug = enabled
  }

  /** 订阅事件，返回取消订阅函数 */
  on<T extends ChartEventType>(event: T, listener: Listener<T>): Unsubscribe {
    let set = this.listeners.get(event)
    if (!set) {
      set = new Set()
      this.listeners.set(event, set)
    }
    set.add(listener as Listener<ChartEventType>)
    return () => this.off(event, listener)
  }

  /** 订阅一次 */
  once<T extends ChartEventType>(event: T, listener: Listener<T>): Unsubscribe {
    let set = this.onceListeners.get(event)
    if (!set) {
      set = new Set()
      this.onceListeners.set(event, set)
    }
    set.add(listener as Listener<ChartEventType>)
    return () => {
      this.onceListeners.get(event)?.delete(listener as Listener<ChartEventType>)
    }
  }

  /** 取消订阅 */
  off<T extends ChartEventType>(event: T, listener: Listener<T>): void {
    this.listeners.get(event)?.delete(listener as Listener<ChartEventType>)
    this.onceListeners.get(event)?.delete(listener as Listener<ChartEventType>)
  }

  /** 发布事件 */
  emit<T extends ChartEventType>(event: T, payload: ChartEventMap[T]): void {
    if (this.debug) {
      // eslint-disable-next-line no-console
      console.debug(`[vis-3x] event: ${event}`, payload)
    }
    const set = this.listeners.get(event)
    if (set) {
      // 复制一份，避免监听器内部增删导致遍历异常
      for (const listener of [...set]) {
        try {
          ;(listener as Listener<T>)(payload)
        } catch (error) {
          console.error(`[vis-3x] 事件监听器执行出错: ${event}`, error)
        }
      }
    }
    const onceSet = this.onceListeners.get(event)
    if (onceSet && onceSet.size) {
      const snapshot = [...onceSet]
      onceSet.clear()
      for (const listener of snapshot) {
        try {
          ;(listener as Listener<T>)(payload)
        } catch (error) {
          console.error(`[vis-3x] 一次性事件监听器执行出错: ${event}`, error)
        }
      }
    }
  }

  /** 等待某个事件（返回 Promise） */
  waitFor<T extends ChartEventType>(
    event: T,
    timeout?: number
  ): Promise<ChartEventMap[T]> {
    return new Promise((resolve, reject) => {
      let timer: ReturnType<typeof setTimeout> | undefined
      const off = this.once(event, (payload) => {
        if (timer) clearTimeout(timer)
        resolve(payload)
      })
      if (timeout !== undefined && timeout > 0) {
        timer = setTimeout(() => {
          off()
          reject(new Error(`[vis-3x] 等待事件 "${event}" 超时（${timeout}ms）`))
        }, timeout)
      }
    })
  }

  /** 清空监听器 */
  clear(event?: ChartEventType): void {
    if (event) {
      this.listeners.delete(event)
      this.onceListeners.delete(event)
      return
    }
    this.listeners.clear()
    this.onceListeners.clear()
  }

  /** 某事件的监听器数量 */
  listenerCount(event: ChartEventType): number {
    return (this.listeners.get(event)?.size ?? 0) + (this.onceListeners.get(event)?.size ?? 0)
  }

  /** 已注册的事件名 */
  eventNames(): ChartEventType[] {
    const names = new Set<ChartEventType>([
      ...this.listeners.keys(),
      ...this.onceListeners.keys(),
    ])
    return [...names]
  }
}
