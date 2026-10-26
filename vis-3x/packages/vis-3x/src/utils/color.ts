/**
 * vis-3x — 颜色工具
 *
 * 支持 CSS 颜色字符串与 16 进制数字，统一转换为 Three.js 可用的 Color 实例。
 */
import * as THREE from 'three'
import type { ColorLike } from '../types/style'

/**
 * 从渐变字符串里取一个代表色
 *
 * 这里**内联实现**而不是从 `./gradient` 导入，是为了避免循环依赖
 * （`gradient.ts` 依赖本文件的 `toThreeColor` / `splitAlpha`）。
 *
 * 取值策略：
 * 1. 优先选**不透明**的色标（alpha ≥ 0.5），避免取到 `rgba(0,0,0,0.1)`
 *    这类渐变末端颜色导致整个物体变黑
 * 2. 在候选里取中间那个，视觉上最能代表整体
 * 3. 都不透明时退回首个色标，最后才用 fallback
 */
function pickGradientFallback(text: string, fallback: string): string {
  const hexes = text.match(/#[0-9a-f]{3,8}\b/gi) ?? []
  const rgbs = text.match(/rgba?\([^)]*\)/gi) ?? []
  const named = text.match(/\b(?:red|blue|green|white|black|yellow|orange|purple|cyan|magenta)\b/gi) ?? []
  const tokens = [...hexes, ...rgbs, ...named]
  if (!tokens.length) return fallback

  // 优先不透明的色标
  const opaque = tokens.filter((t) => {
    const { alpha } = splitAlpha(t)
    return alpha >= 0.5
  })
  const pool = opaque.length ? opaque : tokens
  return pool[Math.floor(pool.length / 2)]
}

/** 默认调色板：高饱和、在深色背景上表现良好 */
export const DEFAULT_PALETTE: string[] = [
  '#4f8cff',
  '#22d3ee',
  '#34d399',
  '#fbbf24',
  '#fb7185',
  '#a78bfa',
  '#f97316',
  '#2dd4bf',
  '#f472b6',
  '#60a5fa',
  '#84cc16',
  '#e879f9',
]

/** 连续色带（热力图 / 曲面图默认使用） */
export const DEFAULT_GRADIENT: string[] = [
  '#1e3a8a',
  '#0ea5e9',
  '#22d3ee',
  '#34d399',
  '#fde047',
  '#fb923c',
  '#ef4444',
]

/** 把 ColorLike 转成 CSS 字符串 */
export function toCssColor(color: ColorLike | undefined, fallback = '#4f8cff'): string {
  if (color === undefined || color === null) return fallback
  if (typeof color === 'number') {
    // 注意：Three 的 setHex 默认按 sRGB 处理，这里输出标准 CSS
    return `#${color.toString(16).padStart(6, '0')}`
  }
  return color
}

/** 把 ColorLike 转成 THREE.Color */
export function toThreeColor(color: ColorLike | undefined, fallback = '#4f8cff'): THREE.Color {
  const c = new THREE.Color()
  if (color === undefined || color === null) {
    c.set(fallback)
    return c
  }
  if (typeof color === 'number') {
    c.setHex(color)
    return c
  }
  const text = String(color).trim()

  // 渐变字符串不能交给 THREE.Color（会算出 NaN 并打印警告），
  // 取渐变的代表色作为纯色兜底。
  if (/^(linear|radial)-gradient\s*\(/i.test(text)) {
    const picked = pickGradientFallback(text, fallback)
    const { color } = splitAlpha(picked)
    c.set(color)
    return c
  }

  c.set(text)
  return c
}

/** 把颜色写入已有的 THREE.Color，避免频繁创建对象 */
export function setThreeColor(
  target: THREE.Color,
  color: ColorLike | undefined,
  fallback = '#4f8cff'
): THREE.Color {
  if (color === undefined || color === null) {
    target.set(fallback)
    return target
  }
  if (typeof color === 'number') target.setHex(color)
  else {
    // 同样需要拦截渐变字符串
    const text = String(color).trim()
    if (/^(linear|radial)-gradient\s*\(/i.test(text)) {
      const picked = pickGradientFallback(text, fallback)
      target.set(splitAlpha(picked).color)
    } else {
      target.set(text)
    }
  }
  return target
}

/**
 * 按索引从调色板取色（循环）
 */
export function pickColor(palette: string[], index: number): string {
  if (!palette.length) return DEFAULT_PALETTE[0]
  const i = ((index % palette.length) + palette.length) % palette.length
  return palette[i]
}

/**
 * 颜色变亮 / 变暗
 *
 * @param color 基础颜色
 * @param amount -1~1，正数变亮，负数变暗
 */
export function shade(color: ColorLike, amount: number): string {
  const c = toThreeColor(color)
  const hsl = { h: 0, s: 0, l: 0 }
  c.getHSL(hsl)
  const l = Math.min(1, Math.max(0, hsl.l + amount))
  c.setHSL(hsl.h, hsl.s, l)
  return `#${c.getHexString()}`
}

/** 调整透明度，返回 rgba() 字符串 */
export function withAlpha(color: ColorLike, alpha: number): string {
  const c = toThreeColor(color)
  const r = Math.round(c.r * 255)
  const g = Math.round(c.g * 255)
  const b = Math.round(c.b * 255)
  return `rgba(${r}, ${g}, ${b}, ${alpha})`
}

/**
 * 在色带上按 t(0~1) 取色
 *
 * @param gradient 色带
 * @param t 归一化位置
 */
export function gradientColorAt(gradient: string[], t: number): string {
  if (!gradient.length) return DEFAULT_PALETTE[0]
  if (gradient.length === 1) return gradient[0]
  const clamped = Math.min(1, Math.max(0, t))
  const scaled = clamped * (gradient.length - 1)
  const i = Math.floor(scaled)
  const f = scaled - i
  if (i >= gradient.length - 1) return gradient[gradient.length - 1]
  const c1 = toThreeColor(gradient[i])
  const c2 = toThreeColor(gradient[i + 1])
  c1.lerp(c2, f)
  return `#${c1.getHexString()}`
}

/**
 * 生成色带顶点颜色采样函数（性能更好，避免反复字符串转换）
 */
export function createGradientSampler(gradient: string[]): (t: number) => THREE.Color {
  const colors = (gradient.length ? gradient : DEFAULT_GRADIENT).map((c) => toThreeColor(c))
  const last = colors.length - 1
  return (t: number) => {
    const clamped = Math.min(1, Math.max(0, t))
    if (last <= 0) return colors[0].clone()
    const scaled = clamped * last
    const i = Math.floor(scaled)
    const f = scaled - i
    if (i >= last) return colors[last].clone()
    return colors[i].clone().lerp(colors[i + 1], f)
  }
}

/**
 * 生成沿 Y 轴的垂直渐变 Canvas 贴图
 *
 * 用于柱状图/面积图的渐变填充。
 */
export function createVerticalGradientTexture(
  color: ColorLike,
  options: { fromAlpha?: number; toAlpha?: number; steps?: number } = {}
): THREE.Texture {
  const { fromAlpha = 0.15, toAlpha = 1, steps = 2 } = options
  void steps
  const canvas = document.createElement('canvas')
  canvas.width = 4
  canvas.height = 64
  const ctx = canvas.getContext('2d')
  if (ctx) {
    const grad = ctx.createLinearGradient(0, canvas.height, 0, 0)
    grad.addColorStop(0, withAlpha(color, fromAlpha))
    grad.addColorStop(1, withAlpha(color, toAlpha))
    ctx.fillStyle = grad
    ctx.fillRect(0, 0, canvas.width, canvas.height)
  }
  const texture = new THREE.CanvasTexture(canvas)
  texture.colorSpace = THREE.SRGBColorSpace
  texture.needsUpdate = true
  return texture
}

/** 判断颜色是否偏亮（用于自动选择前景文字色） */
export function isLightColor(color: ColorLike): boolean {
  const c = toThreeColor(color)
  // 相对亮度（sRGB 近似）
  const luminance = 0.2126 * c.r + 0.7152 * c.g + 0.0722 * c.b
  return luminance > 0.6
}

/**
 * 从 CSS 颜色中拆出「不含透明度的颜色」与「透明度」
 *
 * Three.js 的 `Color` 会忽略 alpha 通道并打印警告，
 * 因此需要把 `rgba(r,g,b,a)` 拆成 `rgb(r,g,b)` + a，
 * 透明度交由材质的 `opacity` 处理。
 */
export function splitAlpha(color: ColorLike): { color: string; alpha: number } {
  if (typeof color === 'number') {
    return { color: `#${color.toString(16).padStart(6, '0')}`, alpha: 1 }
  }
  const text = String(color).trim()

  // rgba(r, g, b, a)
  const rgbaMatch = text.match(
    /^rgba?\(\s*([\d.]+)\s*,\s*([\d.]+)\s*,\s*([\d.]+)\s*(?:,\s*([\d.]+)\s*)?\)$/i
  )
  if (rgbaMatch) {
    const [, r, g, b, a] = rgbaMatch
    const alpha = a !== undefined ? parseFloat(a) : 1
    return {
      color: `rgb(${Math.round(parseFloat(r))}, ${Math.round(parseFloat(g))}, ${Math.round(parseFloat(b))})`,
      alpha: Number.isFinite(alpha) ? Math.min(1, Math.max(0, alpha)) : 1,
    }
  }

  // #rrggbbaa / #rgba
  const hexMatch = text.match(/^#([0-9a-f]{4}|[0-9a-f]{8})$/i)
  if (hexMatch) {
    const hex = hexMatch[1]
    const expanded =
      hex.length === 4
        ? hex
            .split('')
            .map((ch) => ch + ch)
            .join('')
        : hex
    const alpha = parseInt(expanded.slice(6, 8), 16) / 255
    return { color: `#${expanded.slice(0, 6)}`, alpha }
  }

  return { color: text, alpha: 1 }
}
