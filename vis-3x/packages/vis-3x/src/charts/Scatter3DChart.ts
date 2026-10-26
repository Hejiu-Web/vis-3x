/**
 * vis-3x — 3D 散点图
 *
 * 支持三种数据格式：
 * - `[x, y]`：x 为类目索引或数值，y 为高度
 * - `[x, y, z]`：完整三维直角坐标
 * - `number`：仅高度，x 自动递增
 */
import * as THREE from 'three'
import { ChartBase, type ResolvedChartOption } from '../core/ChartBase'
import type { Scatter3DSeries } from '../types/series'
import { extractValue, extractValueArray, extractName } from '../types/series'
import { formatLabel } from '../core/LabelManager'
import { clamp, lerp } from '../utils/math'

const SYMBOL_GEOMETRY: Record<string, string> = {
  circle: 'sphere',
  sphere: 'sphere',
  square: 'box',
  cube: 'box',
  diamond: 'octahedron',
  ring: 'torus',
}

/** 散点图实现 */
export class Scatter3DChart extends ChartBase {

  get chartType(): string {
    return 'scatter3D'
  }

  protected renderSeries(option: ResolvedChartOption): void {
    const seriesList = (option.series ?? []).filter(
      (s) => s.type === 'scatter3D'
    ) as Scatter3DSeries[]
    if (!seriesList.length) return

    const visible = seriesList.filter((s) => s.visible !== false)
    const plan = this.createTransitionPlan(seriesList[0])
    const seriesCount = Math.max(1, visible.length)

    visible.forEach((series, visibleIndex) => {
      const style = series.pointStyle ?? {}
      const symbol = style.symbol ?? 'sphere'
      const geometryKind = SYMBOL_GEOMETRY[symbol] ?? 'sphere'
      const baseSize = style.size ?? series.symbolSize ?? 0.14

      // 统计尺寸映射范围
      const allValues = series.data
        .map((item) => extractValue(item as never))
        .map((v) => (Array.isArray(v) ? (v[1] ?? v[0] ?? 0) : v))
        .filter((v) => Number.isFinite(v))
      const minVal = allValues.length ? Math.min(...allValues) : 0
      const maxVal = allValues.length ? Math.max(...allValues) : 1
      const sizeRange = style.sizeRange

      const zDefault =
        seriesCount > 1 ? this.cartesian.zAt((visibleIndex + 0.5) / seriesCount) : 0

      series.data.forEach((item, dataIndex) => {
        const raw = extractValue(item as never)
        const arr = Array.isArray(raw) ? raw : [raw]

        // 解析坐标
        let x: number
        let yValue: number
        let z: number

        if (arr.length >= 3) {
          // [x, y, z]
          x = this.cartesian.xAxis.type === 'value'
            ? this.cartesian.xAt(arr[0])
            : this.cartesian.xAtCategory(
                clamp(Math.round(arr[0]), 0, Math.max(0, this.cartesian.categoryCount - 1))
              )
          yValue = arr[1]
          z = this.cartesian.zAt(arr[2])
        } else if (arr.length === 2) {
          // [x, y]
          x = this.cartesian.xAxis.type === 'value'
            ? this.cartesian.xAt(arr[0])
            : this.cartesian.xAtCategory(
                clamp(Math.round(arr[0]), 0, Math.max(0, this.cartesian.categoryCount - 1))
              )
          yValue = arr[1]
          z = zDefault
        } else {
          // number：仅高度
          x = this.cartesian.xAtCategory(dataIndex)
          yValue = arr[0]
          z = zDefault
        }

        if (!Number.isFinite(yValue)) return
        const y = this.cartesian.yAt(yValue)

        // 尺寸映射
        let size = baseSize
        if (sizeRange) {
          const t = clamp((yValue - minVal) / (maxVal - minVal || 1), 0, 1)
          size = lerp(sizeRange[0], sizeRange[1], t)
        } else if (series.sizeByValue) {
          const t = clamp((yValue - minVal) / (maxVal - minVal || 1), 0, 1)
          size = lerp(baseSize * 0.5, baseSize * 1.8, t)
        }

        const color = style.color
          ? String(style.color)
          : this.seriesColors(series, series.data.length)[dataIndex]

        const mesh = this.createSymbol(geometryKind, size, color, style)
        mesh.position.set(x, y, z)
        mesh.name = '__vt_scatter'

        this.makePickable(mesh, {
          seriesIndex: seriesList.indexOf(series),
          dataIndex,
          seriesName: series.name,
          name: extractName(item as never, this.cartesian.categoryName(dataIndex)),
          value: extractValueArray(item as never),
          color,
        })
        this.seriesGroup.add(mesh)

        // 标签
        const labelStyle = series.label ?? option.label
        if (labelStyle?.show) {
          const text = formatLabel(labelStyle, {
            value: yValue,
            name: extractName(item as never, this.cartesian.categoryName(dataIndex)),
            seriesName: series.name,
            dataIndex,
            seriesIndex: seriesList.indexOf(series),
          })
          if (text) {
            const anchor = new THREE.Object3D()
            anchor.position.set(x, y + size + (labelStyle.distance ?? 0.18), z)
            this.seriesGroup.add(anchor)
            this.createLabel(anchor, text, labelStyle)
          }
        }
        // 动画：从地面升起
        const startY = this.cartesian.yAt(0)
        const targetY = y
        mesh.position.y = startY
        plan.custom(
          (t) => {
            mesh.position.y = startY + (targetY - startY) * t
          },
          dataIndex,
          { finish: () => { mesh.position.y = targetY } }
        )
      })
    })

    // 统一启动动画并保持重绘
    plan.run()
    this.keepRenderingWhileAnimating()
  }

  /** 根据 symbol 创建几何体 */
  private createSymbol(
    kind: string,
    size: number,
    color: string,
    style: NonNullable<Scatter3DSeries['pointStyle']>
  ): THREE.Mesh {
    let geometry: THREE.BufferGeometry
    switch (kind) {
      case 'box':
        geometry = new THREE.BoxGeometry(size * 1.7, size * 1.7, size * 1.7)
        this.resources.trackGeometry(geometry)
        break
      case 'octahedron':
        geometry = new THREE.OctahedronGeometry(size * 1.35)
        this.resources.trackGeometry(geometry)
        break
      case 'torus':
        geometry = new THREE.TorusGeometry(size * 1.2, size * 0.35, 10, 24)
        this.resources.trackGeometry(geometry)
        break
      case 'sphere':
      default:
        geometry = this.resources.createSphere(size, 20)
        break
    }

    const material = this.resources.createMaterial(color, {
      preset: 'standard',
      roughness: style.roughness ?? 0.24,
      metalness: style.metalness ?? 0.3,
      emissive: style.emissive ?? color,
      emissiveIntensity: style.emissiveIntensity ?? 0.34,
      opacity: style.opacity ?? 1,
      transparent: (style.opacity ?? 1) < 1 || style.transparent,
      envMapIntensity: 1.4,
    })

    const mesh = new THREE.Mesh(geometry, material)
    mesh.castShadow = false
    mesh.receiveShadow = false
    return mesh
  }
}
