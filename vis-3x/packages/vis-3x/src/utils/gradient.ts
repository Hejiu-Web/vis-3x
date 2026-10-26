/**
 * vis-3x — 渐变解析与采样
 *
 * 把 CSS 的 `linear-gradient(...)` 字符串解析成可用的色标序列，
 * 并提供三处消费能力：
 *
 * 1. `parseGradient`        解析成 `GradientSpec`（角度 + 色标）
 * 2. `sampleGradientAt`     在任意 t 处采样（顶点色 / 逐点着色）
 * 3. `createGradientTexture` 生成垂直渐变的 Canvas 贴图（材质层注入）
 *
 * ## 角度约定
 *
 * 与 CSS 一致：`0deg` 指向正上方，`180deg` 指向正下方。
 * 3D 场景里的「垂直渐变」对应 `180deg`（顶 → 底）。
 * 其它角度按约定**降级为垂直渐变**（视觉优先级：垂直方向最符合 3D 柱体/面片的逻辑）。
 *
 * ## 透明度
 *
 * `rgba(0, 0, 0, 0.1)` 这类带 alpha 的颜色会被拆成「颜色 + alpha」两部分：
 * - 顶点色路径：alpha 写入顶点属性的第 4 分量，配合自定义 shader 输出真正透明的渐变
 * - 贴图路径：alpha 直接写进 Canvas，靠材质的 `transparent` 生效
 */
import * as THREE from 'three'
import type { ColorLike, ColorInput, GradientSpec, GradientStop } from '../types/style'
import { toThreeColor, splitAlpha } from './color'

/** 渐变字符串的识别前缀 */
const GRADIENT_PREFIX = /^(linear-gradient|radial-gradient)\s*\(/i

/** 默认渐变的色带（当解析失败时兜底） */
const FALLBACK_STOPS: GradientStop[] = [
  { offset: 0, color: '#4f8cff', alpha: 1 },
  { offset: 1, color: '#22d3ee', alpha: 1 },
]

/** 是否是一个渐变字符串 */
export function isGradient(input: unknown): input is string {
  return typeof input === 'string' && GRADIENT_PREFIX.test(input.trim())
}

/** 是否是可以直接交给 THREE.Color 的纯色 */
export function isSolidColor(input: unknown): input is ColorLike {
  return (typeof input === 'string' && !isGradient(input)) || typeof input === 'number'
}

/* -------------------------------------------------------------------------- */
/*                                  解析                                      */
/* -------------------------------------------------------------------------- */

/**
 * 按顶层逗号切分渐变参数
 *
 * 不能简单用 `split(',')`，因为 `rgba(0, 0, 0, 0.1)` 内部也有逗号。
 */
function splitTopLevel(input: string): string[] {
  const out: string[] = []
  let depth = 0
  let current = ''
  for (const ch of input) {
    if (ch === '(') depth++
    else if (ch === ')') depth--
    if (ch === ',' && depth === 0) {
      out.push(current.trim())
      current = ''
    } else {
      current += ch
    }
  }
  if (current.trim()) out.push(current.trim())
  return out
}

/**
 * 解析单条色标，例如 `#1EE793 0%`、`rgba(0,0,0,0.1) 110.42%`、`red`
 *
 * 返回 offset 为 `0~1` 的归一化值（CSS 里常出现 >100% 的写法，直接保留比例）。
 */
function parseStop(token: string): GradientStop | null {
  // 位置：支持百分比与纯数字，可能是起止区间（`10% 30%`），取起始值
  const percentMatch = token.match(/(-?[\d.]+)%/)
  const numberMatch = token.match(/(?:^|\s)(-?[\d.]+)(?:\s|$)/)
  let offset = 0
  if (percentMatch) {
    offset = parseFloat(percentMatch[1]) / 100
  } else if (numberMatch && /^(linear|radial)/i.test(token) === false && !token.includes('(')) {
    offset = parseFloat(numberMatch[1])
  }

  // 颜色部分：可能是 #hex / rgb() / rgba() / hsl() / 关键字
  const colorToken =
    token.match(/#[0-9a-f]{3,8}/i)?.[0] ??
    token.match(/(?:rgba?|hsla?)\([^)]*\)/i)?.[0] ??
    token.replace(/(-?[\d.]+%?)/g, '').trim()

  if (!colorToken) return null

  const { color, alpha } = splitAlpha(colorToken)
  return {
    offset: Math.min(1, Math.max(0, offset)),
    color,
    alpha: Number.isFinite(alpha) ? alpha : 1,
  }
}

/**
 * 解析 CSS 渐变字符串
 *
 * 支持：
 * ```txt
 * linear-gradient(180deg, #1EE793 0%, rgba(0, 0, 0, 0.1) 110.42%)
 * linear-gradient(to bottom, #4f8cff, #22d3ee)
 * linear-gradient(90deg, red, blue, yellow)
 * ```
 *
 * 非渐变输入返回 `null`，调用方据此回退到纯色逻辑。
 */
export function parseGradient(input: ColorInput | undefined): GradientSpec | null {
  if (!isGradient(input)) return null
  const text = String(input).trim()

  const openIndex = text.indexOf('(')
  const closeIndex = text.lastIndexOf(')')
  if (openIndex < 0 || closeIndex < openIndex) return null

  const kind: GradientSpec['kind'] = /^radial-gradient/i.test(text)
    ? 'radial'
    : 'linear'
  const body = text.slice(openIndex + 1, closeIndex)
  const parts = splitTopLevel(body)
  if (!parts.length) return null

  // 第一个参数可能是角度 / 方向关键字，也可能直接就是颜色
  let angle = 180
  let stopStart = 0
  const head = parts[0]

  const degMatch = head.match(/^(?:-?[\d.]+)(deg|rad|turn|grad)$/i)
  const directionWord = /^(to\s+)?(top|bottom|left|right|top\s+left|top\s+right|bottom\s+left|bottom\s+right)$/i
  if (degMatch) {
    angle = toDegrees(parseFloat(head), degMatch[1])
    stopStart = 1
  } else if (directionWord.test(head)) {
    angle = directionToAngle(head)
    stopStart = 1
  } else if (!/#[0-9a-f]|rgba?\(|hsla?\(/i.test(head.split(/\s+/)[0] ?? '')) {
    // `45px` 之类无法识别的头部，忽略
    stopStart = 1
  }

  const stops: GradientStop[] = []
  for (let i = stopStart; i < parts.length; i++) {
    const stop = parseStop(parts[i])
    if (stop) stops.push(stop)
  }
  if (!stops.length) return null

  // 补全省略的 offset（CSS 规范：均分）
  const hasExplicitOffset = parts.slice(stopStart).map((p) => /%|\d/.test(p))
  let lastAssigned = 0
  for (let i = 0; i < stops.length; i++) {
    const explicit = hasExplicitOffset[i] && /%\s*$|^\s*[\d.]+\s*$/.test(parts[stopStart + i])
    if (!explicit) {
      const remaining = stops.length - i
      const span = (1 - lastAssigned) / Math.max(1, remaining)
      stops[i].offset = lastAssigned + span * 0
      stops[i].offset = stops.length === 1 ? 0 : i / (stops.length - 1)
    }
    lastAssigned = stops[i].offset
  }

  // 保证递增
  for (let i = 1; i < stops.length; i++) {
    if (stops[i].offset < stops[i - 1].offset) stops[i].offset = stops[i - 1].offset
  }

  // 规范化：非垂直角度降级为垂直（180deg）
  const normalized = normalizeAngle(angle)

  return {
    kind,
    angle: normalized,
    stops,
    raw: text,
  }
}

/** 角度单位换算成度 */
function toDegrees(value: number, unit: string): number {
  switch (unit.toLowerCase()) {
    case 'rad':
      return (value * 180) / Math.PI
    case 'turn':
      return value * 360
    case 'grad':
      return value * 0.9
    default:
      return value
  }
}

/** 方向关键字 → 角度 */
function directionToAngle(head: string): number {
  const text = head.toLowerCase().replace(/^to\s+/, '').replace(/\s+/g, ' ')
  switch (text) {
    case 'top':
      return 0
    case 'bottom':
      return 180
    case 'left':
      return 270
    case 'right':
      return 90
    default:
      // 斜向方向在 3D 场景里统一按垂直处理
      return 180
  }
}

/**
 * 规范化角度
 *
 * 约定只保留 `0`（自下而上）与 `180`（自上而下）两种，其余一律按 `180` 处理。
 * 这样材质层的竖向贴图 UV 映射始终是确定的。
 */
function normalizeAngle(angle: number): number {
  const a = ((angle % 360) + 360) % 360
  if (Math.abs(a - 0) < 1e-6) return 0
  if (Math.abs(a - 180) < 1e-6) return 180
  return 180
}

/* -------------------------------------------------------------------------- */
/*                                  采样                                      */
/* -------------------------------------------------------------------------- */

/** 在 `t`(0~1) 处采样，返回 THREE.Color，alpha 通过第二个返回值给出 */
export function sampleGradientAt(
  spec: GradientSpec,
  t: number
): { color: THREE.Color; alpha: number } {
  const stops = spec.stops.length ? spec.stops : FALLBACK_STOPS
  const p = Math.min(1, Math.max(0, t))

  if (stops.length === 1) {
    const s = stops[0]
    return { color: toThreeColor(s.color), alpha: s.alpha ?? 1 }
  }

  let i = 0
  while (i < stops.length - 2 && p > stops[i + 1].offset) i++

  const a = stops[i]
  const b = stops[Math.min(i + 1, stops.length - 1)]
  const span = b.offset - a.offset || 1
  const f = Math.min(1, Math.max(0, (p - a.offset) / span))

  const color = toThreeColor(a.color).lerp(toThreeColor(b.color), f)
  const alpha = (a.alpha ?? 1) + ((b.alpha ?? 1) - (a.alpha ?? 1)) * f
  return { color, alpha }
}

/**
 * 生成垂直渐变的 Canvas 贴图
 *
 * 用于材质层统一注入：只要 `color` 是渐变字符串，就把生成的贴图挂到
 * `material.map`，无需改动各图表的几何体构建逻辑。
 *
 * @param spec  解析后的渐变
 * @param height 贴图高度（越大过渡越平滑，默认 256）
 */
export function createGradientTexture(spec: GradientSpec, height = 256): THREE.CanvasTexture {
  const canvas = document.createElement('canvas')
  canvas.width = 4
  canvas.height = height
  const ctx = canvas.getContext('2d')

  if (ctx) {
    const grad = ctx.createLinearGradient(0, 0, 0, height)
    const stops = spec.stops.length ? spec.stops : FALLBACK_STOPS
    for (const stop of stops) {
      const { color, alpha } = splitAlpha(stop.color)
      grad.addColorStop(
        Math.min(1, Math.max(0, stop.offset)),
        `rgba(${hexToRgbCss(color)}, ${stop.alpha ?? 1})`
      )
    }
    ctx.fillStyle = grad
    ctx.fillRect(0, 0, canvas.width, canvas.height)
  }

  const texture = new THREE.CanvasTexture(canvas)
  texture.colorSpace = THREE.SRGBColorSpace
  texture.wrapS = THREE.ClampToEdgeWrapping
  texture.wrapT = THREE.ClampToEdgeWrapping
  // angle 为 0 表示自下而上，等价于把贴图翻转
  if (spec.angle === 0) {
    texture.flipY = !texture.flipY
  }
  texture.needsUpdate = true
  return texture
}

/** `#rrggbb` / `rgb(r,g,b)` → `r,g,b` */
function hexToRgbCss(color: string): string {
  const c = toThreeColor(color)
  return `${Math.round(c.r * 255)}, ${Math.round(c.g * 255)}, ${Math.round(c.b * 255)}`
}

/* -------------------------------------------------------------------------- */
/*                              辅助：双端颜色                                */
/* -------------------------------------------------------------------------- */

/**
 * 取渐变的首尾颜色
 *
 * 用于需要「顶色 + 底色」的场合（垂幕顶点色、图例色块、发光色）。
 */
export function gradientEndpoints(input: ColorInput | undefined, fallback = '#4f8cff'): {
  start: THREE.Color
  end: THREE.Color
  startAlpha: number
  endAlpha: number
} {
  const spec = parseGradient(input)
  if (!spec) {
    const c = toThreeColor(input as ColorLike | undefined, fallback)
    return { start: c.clone(), end: c.clone(), startAlpha: 1, endAlpha: 1 }
  }
  const first = sampleGradientAt(spec, 0)
  const last = sampleGradientAt(spec, 1)
  return {
    start: first.color,
    end: last.color,
    startAlpha: first.alpha,
    endAlpha: last.alpha,
  }
}

/** 把渐变转成 CSS 字符串（用于图例色块/提示框小圆点等 DOM 渲染） */
export function toCssGradient(input: ColorInput | undefined, fallback = '#4f8cff'): string {
  const spec = parseGradient(input)
  if (!spec) {
    if (typeof input === 'number' || (typeof input === 'string' && !isGradient(input))) {
      return String(input)
    }
    return fallback
  }
  const stops = spec.stops
    .map((s) => `${s.color}) ${(s.offset * 100).toFixed(2)}%`.replace(/\)\s/, ') '))
    .join(', ')
  // 重新拼成浏览器可识别的 CSS
  const cssStops = spec.stops
    .map((s) => {
      const color = s.alpha !== undefined && s.alpha < 1 ? `rgba(${hexToRgbCss(s.color)}, ${s.alpha})` : s.color
      return `${color} ${(s.offset * 100).toFixed(2)}%`
    })
    .join(', ')
  void stops
  return `linear-gradient(${spec.angle}deg, ${cssStops})`
}

/** 取渐变里「最能代表整体」的中间色（图例/提示框兜底用） */
export function representativeColor(input: ColorInput | undefined, fallback = '#4f8cff'): string {
  const spec = parseGradient(input)
  if (!spec) {
    if (typeof input === 'string' && !isGradient(input)) return input
    if (typeof input === 'number') return `#${input.toString(16).padStart(6, '0')}`
    return fallback
  }
  const { color } = sampleGradientAt(spec, 0.5)
  return `#${color.getHexString()}`
}
