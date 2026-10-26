/**
 * vis-3x — 对象池
 *
 * 图表在交互/动画时会产生大量临时向量，直接 new 会造成 GC 抖动。
 * 这里提供按帧复用的轻量池。
 */
import * as THREE from 'three'

/** 通用对象池 */
export class ObjectPool<T> {
  private available: T[] = []
  private readonly factory: () => T
  private readonly reset?: (item: T) => void
  private readonly maxSize: number

  constructor(factory: () => T, reset?: (item: T) => void, maxSize = 512) {
    this.factory = factory
    this.reset = reset
    this.maxSize = maxSize
  }

  /** 取一个对象 */
  acquire(): T {
    const item = this.available.pop()
    if (item !== undefined) return item
    return this.factory()
  }

  /** 归还对象 */
  release(item: T): void {
    if (this.available.length >= this.maxSize) return
    this.reset?.(item)
    this.available.push(item)
  }

  /** 批量归还 */
  releaseAll(items: T[]): void {
    for (const item of items) this.release(item)
  }

  /** 清空池 */
  clear(): void {
    this.available.length = 0
  }

  get size(): number {
    return this.available.length
  }
}

/** Vector3 池 */
export const vector3Pool = new ObjectPool<THREE.Vector3>(
  () => new THREE.Vector3(),
  (v) => v.set(0, 0, 0)
)

/** Vector2 池 */
export const vector2Pool = new ObjectPool<THREE.Vector2>(
  () => new THREE.Vector2(),
  (v) => v.set(0, 0)
)

/** Color 池 */
export const colorPool = new ObjectPool<THREE.Color>(
  () => new THREE.Color(),
  (c) => c.set(0xffffff)
)

/** 使用池化对象执行回调，并自动归还 */
export function withPooledVector3<R>(fn: (v: THREE.Vector3) => R): R {
  const v = vector3Pool.acquire()
  try {
    return fn(v)
  } finally {
    vector3Pool.release(v)
  }
}

/** 一次取多个 Vector3 */
export function withPooledVectors<R>(count: number, fn: (vs: THREE.Vector3[]) => R): R {
  const vs: THREE.Vector3[] = []
  for (let i = 0; i < count; i++) vs.push(vector3Pool.acquire())
  try {
    return fn(vs)
  } finally {
    vector3Pool.releaseAll(vs)
  }
}
