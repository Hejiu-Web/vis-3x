/**
 * vis-3x — 数据标签系统
 *
 * 基于 CSS2D 渲染，保证文字在任何分辨率下都清晰锐利，
 * 同时也让使用者可以用 CSS 完全自定义标签外观。
 */
import * as THREE from 'three'
import type { LabelStyle, LabelFormatterParams, TextStyle } from '../types/style'
import type { CSS2DRenderer } from './CSS2DRenderer'
import { toCssColor, withAlpha } from '../utils/color'

/** 标签管理器创建参数 */
export interface LabelManagerOptions {
  renderer: CSS2DRenderer
  container: HTMLElement
  /** 默认文字样式 */
  defaultTextStyle?: TextStyle
}

/** 创建标签所用的数据 */
export interface LabelCreateParams {
  object: THREE.Object3D
  /** 显示文本（已格式化） */
  text: string
  /** 样式 */
  style?: LabelStyle
  /** 分组名（便于批量清理） */
  group?: string
  /** 是否始终可见 */
  alwaysVisible?: boolean
}

/** 单个标签记录 */
interface LabelRecord {
  object: THREE.Object3D
  element: HTMLElement
  group: string
}

/**
 * 标签管理器
 *
 * 负责标签 DOM 的创建、样式应用、分组清理与显隐控制。
 */
export class LabelManager {
  private renderer: CSS2DRenderer
  private container: HTMLElement
  private records = new Map<THREE.Object3D, LabelRecord>()
  private defaultTextStyle: TextStyle

  constructor(options: LabelManagerOptions) {
    this.renderer = options.renderer
    this.container = options.container
    this.defaultTextStyle = options.defaultTextStyle ?? {}
  }

  /** 更新默认文字样式 */
  setDefaultTextStyle(style?: TextStyle): void {
    this.defaultTextStyle = style ?? {}
  }

  /**
   * 创建一个标签
   *
   * @returns 创建的 DOM 元素；若标签被禁用则返回 null
   */
  create(params: LabelCreateParams): HTMLElement | null {
    const { object, text, style, group = 'default', alwaysVisible } = params
    if (style?.show === false) return null
    if (text === '' || text === undefined || text === null) return null

    const element = document.createElement('div')
    element.className = 'vt-label'
    // 支持多行标签：把换行符转换为 <br>，同时兼容字面量 "\n"（两个字符）
    // 这样无论是 formatter 里的真实换行还是 JSON 中的转义写法都能正确换行。
    const lines = String(text).split(/\r?\n|\\n/)
    if (lines.length > 1) {
      lines.forEach((line, index) => {
        if (index > 0) element.appendChild(document.createElement('br'))
        element.appendChild(document.createTextNode(line))
      })
    } else {
      element.textContent = String(text)
    }
    element.setAttribute('data-vt-label', group)
    this.applyStyle(element, style)

    this.renderer.add(object, element, { alwaysVisible: alwaysVisible ?? false })
    this.records.set(object, { object, element, group })
    return element
  }

  /** 应用样式到元素 */
  private applyStyle(element: HTMLElement, style?: LabelStyle): void {
    const ts = { ...this.defaultTextStyle, ...(style?.textStyle ?? {}) }
    const s = element.style

    s.position = 'absolute'
    // pre-line 让 \n 生效，同时保留自动换行能力
    s.whiteSpace = 'pre-line'
    s.textAlign = 'center'
    s.pointerEvents = 'none'
    s.userSelect = 'none'
    s.color = toCssColor(ts.color, '#e6edf7')
    s.fontSize = `${ts.fontSize ?? 12}px`
    s.fontFamily =
      ts.fontFamily ??
      '-apple-system, BlinkMacSystemFont, "Segoe UI", "PingFang SC", "Microsoft YaHei", sans-serif'
    s.fontWeight = String(ts.fontWeight ?? 500)
    s.lineHeight = String(ts.lineHeight ?? 1.25)
    s.textShadow = ts.textShadow ?? '0 1px 3px rgba(0, 0, 0, 0.65)'
    s.opacity = String(style?.opacity ?? 1)
    s.transition = 'opacity 0.18s ease'

    if (ts.backgroundColor !== undefined && ts.backgroundColor !== null) {
      s.backgroundColor = toCssColor(ts.backgroundColor)
      s.padding = `${ts.padding ?? 2}px ${(ts.padding ?? 2) + 3}px`
      s.borderRadius = `${ts.borderRadius ?? 4}px`
    }
    if (ts.borderWidth) {
      s.border = `${ts.borderWidth}px solid ${toCssColor(ts.borderColor, 'transparent')}`
    }
    if (style?.offset) {
      s.marginLeft = `${style.offset[0]}px`
      s.marginTop = `${style.offset[1]}px`
    }
  }

  /** 该对象是否已有标签 */
  has(object: THREE.Object3D): boolean {
    return this.records.has(object)
  }

  /**
   * 批量移除「锚点已不在场景中的」标签
   *
   * 这是 `setOption` 数据更新路径的收尾步骤：
   * 更新时我们刻意**不**重建标签 DOM（避免下一帧前停在左上角、也避免闪烁），
   * 但旧数据可能比新数据多，多出来的锚点已被销毁、元素却还挂在 DOM 里。
   * 这里统一扫描一遍，把这类「孤儿标签」摘掉。
   *
   * @param isValid 判断锚点是否仍然有效（通常检查 `object.parent` 与可见性）
   * @returns 移除的标签数量
   */
  pruneOrphans(isValid: (object: THREE.Object3D) => boolean): number {
    let removed = 0
    for (const [object] of [...this.records]) {
      if (isValid(object)) continue
      this.remove(object)
      removed++
    }
    return removed
  }

  /**
   * 就地更新已有标签的文本（只改内容，不重建 DOM）
   *
   * 为什么需要它：重建 DOM 会让新元素在下一帧渲染前处于「无 transform」
   * 状态——CSS2D 元素是 `position: absolute`，没有 transform 就落在容器
   * 左上角。动画期间逐帧 `clear` + `create` 时，一旦动画被打断
   * （例如点图例触发 setOption 清空动画），最后那一帧新建的元素
   * 就永远停在左上角。
   *
   * @returns 是否更新成功；该对象还没有标签时返回 `false`
   */
  update(object: THREE.Object3D, text: string): boolean {
    const record = this.records.get(object)
    if (!record) return false

    // 文本变空等价于隐藏
    if (text === '' || text === undefined || text === null) {
      this.remove(object)
      return true
    }

    const element = record.element
    const lines = String(text).split(/\r?\n|\\n/)
    if (lines.length > 1) {
      element.textContent = ''
      lines.forEach((line, index) => {
        if (index > 0) element.appendChild(document.createElement('br'))
        element.appendChild(document.createTextNode(line))
      })
    } else {
      element.textContent = String(text)
    }
    return true
  }

  /** 移除某个对象的标签 */
  remove(object: THREE.Object3D): void {
    const record = this.records.get(object)
    if (!record) return
    this.renderer.remove(object)
    this.records.delete(object)
  }

  /** 按分组清理标签 */
  clearGroup(group: string): void {
    for (const [object, record] of [...this.records]) {
      if (record.group !== group) continue
      this.renderer.remove(object)
      this.records.delete(object)
    }
  }

  /** 清空全部标签 */
  clear(): void {
    for (const object of [...this.records.keys()]) {
      this.renderer.remove(object)
    }
    this.records.clear()
  }

  /** 设置分组可见性 */
  setGroupVisible(group: string, visible: boolean): void {
    for (const record of this.records.values()) {
      if (record.group === group) this.renderer.setVisible(record.object, visible)
    }
  }

  get count(): number {
    return this.records.size
  }
}

/* -------------------------------------------------------------------------- */
/*                                 格式化工具                                  */
/* -------------------------------------------------------------------------- */

/** 大数字缩写：12000 -> 1.2万 */
export function abbreviateNumber(value: number): string {
  const abs = Math.abs(value)
  if (abs >= 1e8) return `${(value / 1e8).toFixed(abs >= 1e9 ? 0 : 1)}亿`
  if (abs >= 1e4) return `${(value / 1e4).toFixed(abs >= 1e5 ? 0 : 1)}万`
  return String(value)
}

/** 数值格式化 */
export function formatNumber(
  value: number | number[],
  options: { precision?: number; abbreviate?: boolean; prefix?: string; suffix?: string } = {}
): string {
  const { precision, abbreviate, prefix = '', suffix = '' } = options
  const fmt = (v: number): string => {
    if (!Number.isFinite(v)) return '-'
    if (abbreviate) return abbreviateNumber(v)
    if (precision !== undefined) return v.toFixed(precision)
    // 默认最多保留 2 位小数且去掉尾随 0
    return String(Math.round(v * 100) / 100)
  }
  const body = Array.isArray(value) ? value.map(fmt).join(', ') : fmt(value)
  return `${prefix}${body}${suffix}`
}

/**
 * 依据标签配置格式化文本
 */
export function formatLabel(
  style: LabelStyle | undefined,
  params: LabelFormatterParams
): string {
  if (!style) return ''
  const { formatter } = style

  if (typeof formatter === 'function') {
    return formatter(params)
  }

  const valueText = formatNumber(params.value, {
    precision: style.precision,
    abbreviate: style.abbreviate,
    prefix: style.prefix,
    suffix: style.suffix,
  })

  if (typeof formatter === 'string' && formatter.length) {
    return formatter
      .replace(/\{value\}/g, valueText)
      .replace(/\{name\}/g, params.name ?? '')
      .replace(/\{series\}/g, params.seriesName ?? '')
      .replace(/\{percent\}/g, params.percent !== undefined ? `${params.percent.toFixed(1)}%` : '')
  }

  // 未指定 formatter 时，默认只显示数值
  return valueText
}

/** 生成标签背景色（基于数据颜色，带透明底） */
export function labelBackgroundFor(color: string): string {
  return withAlpha(color, 0.16)
}
