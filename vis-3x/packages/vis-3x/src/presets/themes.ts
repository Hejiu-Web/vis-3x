/**
 * vis-3x — 主题预设
 */
import type { ThemeConfig } from '../types/environment'
import { DEFAULT_PALETTE } from '../utils/color'

/** 暗色科技风（默认） */
export const darkTheme: ThemeConfig = {
  // 注意：必须拷贝一份。直接引用 DEFAULT_PALETTE 会让使用者的
  // `themes.dark.palette.push('#fff')` 污染全局默认调色板。
  palette: [...DEFAULT_PALETTE],
  backgroundColor: '#0a0f1c',
  textColor: '#94a3b8',
  axisColor: '#475569',
  splitLineColor: '#1e293b',
  tooltipBackgroundColor: 'rgba(15, 23, 42, 0.94)',
  tooltipTextColor: '#f1f5f9',
}

/** 亮色简约风 */
export const lightTheme: ThemeConfig = {
  palette: [...DEFAULT_PALETTE],
  backgroundColor: '#ffffff',
  textColor: '#475569',
  axisColor: '#94a3b8',
  splitLineColor: '#e2e8f0',
  tooltipBackgroundColor: 'rgba(255, 255, 255, 0.96)',
  tooltipTextColor: '#0f172a',
}

/** 深蓝商务风 */
export const blueTheme: ThemeConfig = {
  palette: ['#3b82f6', '#06b6d4', '#8b5cf6', '#0ea5e9', '#6366f1', '#14b8a6'],
  backgroundColor: '#0b1220',
  textColor: '#93b4d8',
  axisColor: '#3b5a80',
  splitLineColor: '#16233a',
  tooltipBackgroundColor: 'rgba(11, 18, 32, 0.95)',
  tooltipTextColor: '#dbeafe',
}

/** 暖色活力风 */
export const warmTheme: ThemeConfig = {
  palette: ['#f97316', '#fb923c', '#fbbf24', '#f59e0b', '#ef4444', '#ec4899'],
  backgroundColor: '#1a1014',
  textColor: '#d6bfae',
  axisColor: '#7c5344',
  splitLineColor: '#33201c',
  tooltipBackgroundColor: 'rgba(26, 16, 20, 0.95)',
  tooltipTextColor: '#fde7d3',
}

/** 极简灰白风 */
export const monoTheme: ThemeConfig = {
  palette: ['#64748b', '#94a3b8', '#475569', '#cbd5e1', '#334155', '#e2e8f0'],
  backgroundColor: '#f8fafc',
  textColor: '#64748b',
  axisColor: '#cbd5e1',
  splitLineColor: '#e2e8f0',
  tooltipBackgroundColor: 'rgba(15, 23, 42, 0.92)',
  tooltipTextColor: '#f8fafc',
}

/** 内置主题集合 */
export const themes = {
  dark: darkTheme,
  light: lightTheme,
  blue: blueTheme,
  warm: warmTheme,
  mono: monoTheme,
}

/** 可用主题名 */
export type ThemeName = keyof typeof themes

/** 按名称取主题 */
export function getTheme(name: ThemeName | string): ThemeConfig | undefined {
  return themes[name as ThemeName]
}

/** 基于某主题做局部覆盖，返回新对象（不修改原主题） */
export function extendTheme(
  base: ThemeConfig | ThemeName,
  overrides: Partial<ThemeConfig>
): ThemeConfig {
  const resolved = typeof base === 'string' ? (getTheme(base) ?? darkTheme) : base
  return { ...resolved, ...overrides }
}
