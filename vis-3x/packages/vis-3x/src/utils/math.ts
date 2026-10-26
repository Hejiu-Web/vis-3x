/**
 * vis-3x — 几何与数学工具
 */
import * as THREE from 'three'

/** 数值夹取 */
export function clamp(value: number, min: number, max: number): number {
  return value < min ? min : value > max ? max : value
}

/** 线性插值 */
export function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t
}

/** 反向插值：求 t 使 lerp(a,b,t) = v */
export function inverseLerp(a: number, b: number, v: number): number {
  return a === b ? 0 : (v - a) / (b - a)
}

/** 度数转弧度 */
export function degToRad(deg: number): number {
  return (deg * Math.PI) / 180
}

/** 弧度转度数 */
export function radToDeg(rad: number): number {
  return (rad * 180) / Math.PI
}

/** 保留小数位（避免浮点误差） */
export function roundTo(value: number, digits = 6): number {
  const p = 10 ** digits
  return Math.round(value * p) / p
}

/** 判断数值是否有效 */
export function isValidNumber(v: unknown): v is number {
  return typeof v === 'number' && Number.isFinite(v)
}

/** 数组求和 */
export function sum(arr: number[]): number {
  let s = 0
  for (let i = 0; i < arr.length; i++) s += arr[i] ?? 0
  return s
}

/** 数组最值 */
export function extent(arr: number[]): [number, number] {
  if (!arr.length) return [0, 0]
  let min = Infinity
  let max = -Infinity
  for (const v of arr) {
    if (!Number.isFinite(v)) continue
    if (v < min) min = v
    if (v > max) max = v
  }
  if (min === Infinity) return [0, 0]
  return [min, max]
}

/**
 * 根据数据范围计算「好看」的刻度
 *
 * 参考 d3 的 tick 算法思想：优先选择 1/2/5 × 10^n 的步长。
 *
 * @param min 最小值
 * @param max 最大值
 * @param count 期望刻度数量
 * @returns 刻度数组，包含起止值
 */
export function niceTicks(min: number, max: number, count = 5): number[] {
  if (!Number.isFinite(min) || !Number.isFinite(max)) return [0, 1]
  if (min === max) {
    const pad = Math.abs(min) || 1
    min -= pad
    max += pad
  }
  const span = max - min
  const step0 = span / Math.max(1, count)
  const mag = Math.pow(10, Math.floor(Math.log10(step0)))
  const norm = step0 / mag
  let step: number
  if (norm <= 1) step = 1
  else if (norm <= 2) step = 2
  else if (norm <= 5) step = 5
  else step = 10
  step *= mag

  const start = Math.ceil(min / step) * step
  const end = Math.floor(max / step) * step
  const ticks: number[] = []
  // 防止极端情况下循环过长
  const maxTicks = 1000
  for (let v = start, i = 0; v <= end + step * 1e-9 && i < maxTicks; v += step, i++) {
    ticks.push(roundTo(v, 10))
  }
  if (!ticks.length) ticks.push(roundTo(min, 10), roundTo(max, 10))
  return ticks
}

/** 计算数据范围的扩展边界（向外取整到好看的刻度） */
export function niceExtent(min: number, max: number, count = 5): [number, number] {
  const ticks = niceTicks(min, max, count)
  return [ticks[0], ticks[ticks.length - 1]]
}

/** 角度转圆周坐标（XZ 平面） */
export function polarToCartesian(
  radius: number,
  angleDeg: number,
  centerX = 0,
  centerZ = 0
): { x: number; z: number } {
  const rad = degToRad(angleDeg)
  return {
    x: centerX + radius * Math.cos(rad),
    z: centerZ - radius * Math.sin(rad),
  }
}

/**
 * 生成圆角矩形截面 Shape（用于 ExtrudeGeometry 挤出柱子）
 *
 * @param width 宽
 * @param depth 深
 * @param radius 圆角半径
 */
export function roundedRectShape(
  width: number,
  depth: number,
  radius: number
): THREE.Shape {
  const w = Math.max(width, 1e-6)
  const d = Math.max(depth, 1e-6)
  const r = clamp(radius, 0, Math.min(w, d) / 2)
  const shape = new THREE.Shape()
  const hw = w / 2
  const hd = d / 2
  if (r <= 1e-6) {
    shape.moveTo(-hw, -hd)
    shape.lineTo(hw, -hd)
    shape.lineTo(hw, hd)
    shape.lineTo(-hw, hd)
    shape.closePath()
    return shape
  }
  shape.moveTo(-hw + r, -hd)
  shape.lineTo(hw - r, -hd)
  shape.quadraticCurveTo(hw, -hd, hw, -hd + r)
  shape.lineTo(hw, hd - r)
  shape.quadraticCurveTo(hw, hd, hw - r, hd)
  shape.lineTo(-hw + r, hd)
  shape.quadraticCurveTo(-hw, hd, -hw, hd - r)
  shape.lineTo(-hw, -hd + r)
  shape.quadraticCurveTo(-hw, -hd, -hw + r, -hd)
  shape.closePath()
  return shape
}

/**
 * Catmull-Rom 平滑插值
 *
 * 给定一串点，返回经过加密的平滑点序列（用于折线图 smooth）。
 */
export function catmullRomSpline(
  points: THREE.Vector3[],
  segments = 16,
  tension = 0.5
): THREE.Vector3[] {
  if (points.length < 3) return points.map((p) => p.clone())
  const out: THREE.Vector3[] = []
  const n = points.length
  // 首尾各补一个虚拟点，保证端点也有切线
  const get = (i: number): THREE.Vector3 => {
    if (i < 0) {
      const a = points[0]
      const b = points[1]
      return new THREE.Vector3(a.x * 2 - b.x, a.y * 2 - b.y, a.z * 2 - b.z)
    }
    if (i > n - 1) {
      const a = points[n - 1]
      const b = points[n - 2]
      return new THREE.Vector3(a.x * 2 - b.x, a.y * 2 - b.y, a.z * 2 - b.z)
    }
    return points[i]
  }

  for (let i = 0; i < n - 1; i++) {
    const p0 = get(i - 1)
    const p1 = get(i)
    const p2 = get(i + 1)
    const p3 = get(i + 2)
    const steps = i === n - 2 ? segments : segments - 1
    for (let s = 0; s <= steps; s++) {
      const t = s / segments
      const t2 = t * t
      const t3 = t2 * t
      // Catmull-Rom 基函数（tension 控制松紧）
      const m1x = (p2.x - p0.x) * tension
      const m1y = (p2.y - p0.y) * tension
      const m1z = (p2.z - p0.z) * tension
      const m2x = (p3.x - p1.x) * tension
      const m2y = (p3.y - p1.y) * tension
      const m2z = (p3.z - p1.z) * tension

      const h1 = 2 * t3 - 3 * t2 + 1
      const h2 = -2 * t3 + 3 * t2
      const h3 = t3 - 2 * t2 + t
      const h4 = t3 - t2

      out.push(
        new THREE.Vector3(
          h1 * p1.x + h2 * p2.x + h3 * m1x + h4 * m2x,
          h1 * p1.y + h2 * p2.y + h3 * m1y + h4 * m2y,
          h1 * p1.z + h2 * p2.z + h3 * m1z + h4 * m2z
        )
      )
    }
  }
  return out
}

/** 计算一组三维点的包围盒 */
export function computeBoundingBox(points: THREE.Vector3[]): THREE.Box3 {
  const box = new THREE.Box3()
  if (!points.length) return box
  box.setFromPoints(points)
  return box
}

/** 复用向量计算世界坐标，减少 GC */
export function worldPosition(object: THREE.Object3D, target: THREE.Vector3): THREE.Vector3 {
  return object.getWorldPosition(target)
}

/** 生成命名空间化的唯一 id */
let uidCounter = 0
export function uid(prefix = 'vt'): string {
  uidCounter += 1
  return `${prefix}-${uidCounter.toString(36)}-${Math.random().toString(36).slice(2, 7)}`
}
