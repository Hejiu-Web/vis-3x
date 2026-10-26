/**
 * vis-3x — 3D 热力图
 *
 * 在 XZ 平面网格上按数值映射色块高度与颜色，
 * 是展示「二维相关性 / 密度分布」最直观的 3D 形式。
 */
import * as THREE from 'three'
import { ChartBase, type ResolvedChartOption } from '../core/ChartBase'
import type { Heatmap3DSeries } from '../types/series'
import { DEFAULT_GRADIENT, gradientColorAt } from '../utils/color'
import { formatNumber } from '../core/LabelManager'
import { clamp, lerp } from '../utils/math'

/** 热力图实现 */
export class Heatmap3DChart extends ChartBase {

  get chartType(): string {
    return 'heatmap3D'
  }

  protected renderSeries(option: ResolvedChartOption): void {
    const seriesList = (option.series ?? []).filter(
      (s) => s.type === 'heatmap3D'
    ) as Heatmap3DSeries[]
    if (!seriesList.length) return
    const plan = this.createTransitionPlan(seriesList[0])

    for (let seriesIndex = 0; seriesIndex < seriesList.length; seriesIndex++) {
      const series = seriesList[seriesIndex]
      if (series.visible === false) continue

      // 解析数据
      const cells: Array<{ x: number; z: number; value: number }> = []
      let valueMin = Infinity
      let valueMax = -Infinity

      for (const item of series.data) {
        const tuple = Array.isArray(item) ? item : item.value
        if (!tuple || tuple.length < 3) continue
        const [x, z, value] = tuple
        if (!Number.isFinite(value)) continue
        cells.push({ x, z, value })
        if (value < valueMin) valueMin = value
        if (value > valueMax) valueMax = value
      }
      if (!cells.length) continue

      const range = series.valueRange ?? [valueMin, valueMax]
      const [vMin, vMax] = range
      const span = vMax - vMin || 1
      const heightRange = series.heightRange ?? [0.15, this.gridConfig.gridHeight * 0.9]
      const gradient = series.colorGradient?.length ? series.colorGradient : DEFAULT_GRADIENT

      // 网格单元尺寸
      const xCount = series.xAxisData?.length ?? Math.max(...cells.map((c) => c.x)) + 1
      const zCount = series.zAxisData?.length ?? Math.max(...cells.map((c) => c.z)) + 1
      const stepX = this.gridConfig.gridWidth / Math.max(1, xCount)
      const stepZ = this.gridConfig.gridDepth / Math.max(1, zCount)
      const ratio = clamp(series.tileRatio ?? 0.86, 0.1, 1)
      const tileW = stepX * ratio
      const tileD = stepZ * ratio

      const { gridWidth, gridDepth } = this.gridConfig

      cells.forEach((cell, cellIndex) => {
        const t = clamp((cell.value - vMin) / span, 0, 1)
        const height = lerp(heightRange[0], heightRange[1], t)
        const color = gradientColorAt(gradient, t)

        const x = -gridWidth / 2 + stepX * (cell.x + 0.5)
        const z = gridDepth / 2 - stepZ * (cell.z + 0.5)

        const geometry = this.resources.createBox(tileW, height, tileD)
        const material = this.resources.createMaterial(color, {
          preset: 'standard',
          roughness: 0.35,
          metalness: 0.2,
          emissive: color,
          emissiveIntensity: 0.1 + t * 0.25,
          envMapIntensity: 1.1,
          ...series.itemStyle,
          color,
        })

        const mesh = new THREE.Mesh(geometry, material)
        mesh.position.set(x, height / 2, z)
        mesh.castShadow = true
        mesh.receiveShadow = true
        mesh.name = '__vt_heatmap_tile'

        this.makePickable(mesh, {
          seriesIndex,
          dataIndex: cellIndex,
          seriesName: series.name,
          name: this.cellName(series, cell.x, cell.z),
          value: cell.value,
          color,
        })
        this.seriesGroup.add(mesh)

        // 数值标签
        if (series.showValue || series.label?.show) {
          const anchor = new THREE.Object3D()
          anchor.position.set(x, height + 0.22, z)
          this.seriesGroup.add(anchor)
          const text = series.label?.formatter
            ? typeof series.label.formatter === 'function'
              ? series.label.formatter({
                  value: cell.value,
                  name: this.cellName(series, cell.x, cell.z),
                  dataIndex: cellIndex,
                  seriesIndex,
                  seriesName: series.name,
                })
              : String(series.label.formatter).replace(/\{value\}/g, String(cell.value))
            : formatNumber(cell.value, { precision: series.label?.precision })
          if (text) this.createLabel(anchor, text, series.label ?? { show: true })
        }
        // 生长动画：色块从地面升起
        const targetHeight = height
        mesh.scale.y = 0.001
        mesh.position.y = 0
        plan.custom(
          (t) => {
            const h = Math.max(0.001, targetHeight * t)
            mesh.scale.y = h / targetHeight
            mesh.position.y = h / 2
          },
          cellIndex,
          {
            extraDelay: 0,
            finish: () => {
              mesh.scale.y = 1
              mesh.position.y = targetHeight / 2
            },
          }
        )
      })
    }

    // 统一启动动画并保持重绘
    plan.run()
    this.keepRenderingWhileAnimating()
  }

  /** 生成单元格名称 */
  private cellName(series: Heatmap3DSeries, x: number, z: number): string {
    const xName = series.xAxisData?.[x] ?? String(x)
    const zName = series.zAxisData?.[z] ?? String(z)
    return `${xName} / ${zName}`
  }
}
