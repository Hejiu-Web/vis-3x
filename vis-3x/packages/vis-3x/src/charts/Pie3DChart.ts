/**
 * vis-3x — 3D 饼图 / 环形图 / 玫瑰图
 *
 * 实现要点：
 * - 使用 ExtrudeGeometry + 环形扇区 Shape 生成有厚度的扇块
 * - 支持内半径（环形）、padAngle 间隙、玫瑰图半径映射
 * - 支持逐块高度（depthByValue）
 * - 支持选中块外移、中心总量文字
 */
import * as THREE from 'three'
import { ChartBase, type ResolvedChartOption } from '../core/ChartBase'
import type { Pie3DSeries } from '../types/series'
import { extractScalar, extractName } from '../types/series'
import { formatLabel, formatNumber } from '../core/LabelManager'
import { degToRad, sum } from '../utils/math'
import { shade } from '../utils/color'

/** 饼图实现 */
export class Pie3DChart extends ChartBase {

  get chartType(): string {
    return 'pie3D'
  }

  /** 饼图不是笛卡尔图表，不需要坐标轴 */
  protected isNonCartesian(): boolean {
    return true
  }

  protected renderSeries(option: ResolvedChartOption): void {
    const seriesList = (option.series ?? []).filter((s) => s.type === 'pie3D') as Pie3DSeries[]
    if (!seriesList.length) return
    const plan = this.createTransitionPlan(seriesList[0])

    for (let seriesIndex = 0; seriesIndex < seriesList.length; seriesIndex++) {
      const series = seriesList[seriesIndex]
      if (series.visible === false) continue

      const values = series.data.map((item) => {
        const v = extractScalar(item as never)
        return Number.isFinite(v) && v > 0 ? v : 0
      })
      const total = sum(values)
      if (total <= 0) continue

      const colors = this.seriesColors(series, series.data.length)
      const radius = series.radius ?? 3.4
      const innerRadius = series.innerRadius ?? 0
      const depth = series.depth ?? 0.85
      const startAngle = series.startAngle ?? 90
      const padAngle = series.padAngle ?? 1.2
      const roseType = series.roseType ?? false
      const maxValue = Math.max(...values)

      let currentAngle = startAngle

      values.forEach((value, dataIndex) => {
        if (value <= 0) return
        const angleSpan = (value / total) * 360
        // padAngle 会从两端各切掉一半，保持总角度不变
        const effectiveSpan = Math.max(0.4, angleSpan - padAngle)
        const start = currentAngle - padAngle / 2
        const end = start - effectiveSpan
        currentAngle -= angleSpan

        // 玫瑰图：按半径映射
        let outerRadius = radius
        if (roseType === 'radius') {
          outerRadius = radius * (0.35 + 0.65 * (value / maxValue))
        } else if (roseType === 'area') {
          outerRadius = radius * Math.sqrt(0.12 + 0.88 * (value / maxValue))
        }

        // 高度
        let blockDepth = depth
        if (series.depthByValue) {
          const range = series.depthRange ?? [depth * 0.5, depth * 1.6]
          const t = maxValue > 0 ? value / maxValue : 0
          blockDepth = range[0] + (range[1] - range[0]) * t
        }

        const color = colors[dataIndex % colors.length]
        const isSelected = series.selectedIndex === dataIndex
        const offsetDistance = isSelected ? (series.selectedOffset ?? 0.32) : 0

        const mesh = this.createSector({
          startAngle: start,
          endAngle: end,
          innerRadius,
          outerRadius,
          depth: blockDepth,
          color,
          itemStyle: series.itemStyle,
          offsetDistance,
        })

        this.makePickable(mesh, {
          seriesIndex,
          dataIndex,
          seriesName: series.name,
          name: extractName(series.data[dataIndex] as never, `数据 ${dataIndex + 1}`),
          value,
          color,
        })
        this.seriesGroup.add(mesh)

        /* ---------------------------- 标签 ---------------------------- */
        const labelStyle = series.label ?? option.label
        if (labelStyle?.show) {
          const midAngle = degToRad((start + end) / 2)
          const labelRadius = outerRadius + (labelStyle.distance ?? 0.55)
          const anchor = new THREE.Object3D()
          anchor.position.set(
            Math.cos(midAngle) * labelRadius + Math.cos(midAngle) * offsetDistance,
            blockDepth + 0.15,
            -Math.sin(midAngle) * labelRadius - Math.sin(midAngle) * offsetDistance
          )
          this.seriesGroup.add(anchor)
          const text = formatLabel(labelStyle, {
            value,
            name: extractName(series.data[dataIndex] as never, `数据 ${dataIndex + 1}`),
            seriesName: series.name,
            dataIndex,
            seriesIndex,
            percent: (value / total) * 100,
          })
          if (text) this.createLabel(anchor, text, labelStyle)
        }
        /* ---------------------------- 动画 ---------------------------- */
        // 扇块从扁平逐渐长出厚度
        plan.scaleY(mesh, dataIndex, 0.001)
      })

      /* -------------------------- 中心文字 -------------------------- */
      const centerLabel = series.centerLabel
      if (centerLabel?.show) {
        const text = centerLabel.text ?? (centerLabel.total !== false ? formatNumber(total) : '')
        if (text) {
          const anchor = new THREE.Object3D()
          anchor.position.set(0, depth + 0.35, 0)
          this.seriesGroup.add(anchor)
          this.createLabel(anchor, text, {
            show: true,
            textStyle: {
              fontSize: centerLabel.textStyle?.fontSize ?? 22,
              fontWeight: centerLabel.textStyle?.fontWeight ?? 700,
              color: centerLabel.textStyle?.color ?? '#f1f5f9',
              ...centerLabel.textStyle,
            },
          })
        }
      }

      // 饼图居中
      this.seriesGroup.position.set(0, 0, 0)
      void shade
    }

    // 统一启动动画并保持重绘
    plan.run()
    this.keepRenderingWhileAnimating()
  }

  /**
   * 创建一个扇形块
   *
   * 先在 XY 平面构造环形扇区 Shape，沿 +Z 挤出后再旋转为 +Y 方向。
   */
  private createSector(params: {
    startAngle: number
    endAngle: number
    innerRadius: number
    outerRadius: number
    depth: number
    color: string
    itemStyle?: Pie3DSeries['itemStyle']
    offsetDistance: number
  }): THREE.Mesh {
    const {
      startAngle,
      endAngle,
      innerRadius,
      outerRadius,
      depth,
      color,
      itemStyle,
      offsetDistance,
    } = params

    const shape = new THREE.Shape()
    const a0 = degToRad(startAngle)
    const a1 = degToRad(endAngle)
    const segments = Math.max(8, Math.ceil(Math.abs(startAngle - endAngle) / 4))

    // 外弧（从 start 到 end，逆时针在数值上递减，所以用负步长遍历）
    for (let i = 0; i <= segments; i++) {
      const t = i / segments
      const angle = a0 + (a1 - a0) * t
      const x = Math.cos(angle) * outerRadius
      const y = Math.sin(angle) * outerRadius
      if (i === 0) shape.moveTo(x, y)
      else shape.lineTo(x, y)
    }

    // 内弧（反向返回）
    if (innerRadius > 0) {
      for (let i = segments; i >= 0; i--) {
        const t = i / segments
        const angle = a0 + (a1 - a0) * t
        shape.lineTo(Math.cos(angle) * innerRadius, Math.sin(angle) * innerRadius)
      }
    } else {
      shape.lineTo(0, 0)
    }
    shape.closePath()

    const geometry = new THREE.ExtrudeGeometry(shape, {
      depth,
      bevelEnabled: true,
      bevelThickness: 0.02,
      bevelSize: 0.02,
      bevelSegments: 2,
      curveSegments: 6,
    })
    // 挤出方向 +Z -> 旋转为 +Y
    geometry.rotateX(-Math.PI / 2)
    geometry.computeVertexNormals()
    this.resources.trackGeometry(geometry)

    const material = this.resources.createMaterial(color, {
      preset: itemStyle?.preset ?? 'standard',
      roughness: itemStyle?.roughness ?? 0.3,
      metalness: itemStyle?.metalness ?? 0.22,
      opacity: itemStyle?.opacity ?? 1,
      transparent: itemStyle?.transparent,
      emissive: itemStyle?.emissive ?? shade(color, -0.25),
      emissiveIntensity: itemStyle?.emissiveIntensity ?? 0.06,
      envMapIntensity: 1.2,
      flatShading: itemStyle?.flatShading,
      ...itemStyle,
      color,
    })

    const mesh = new THREE.Mesh(geometry, material)
    mesh.castShadow = true
    mesh.receiveShadow = true
    mesh.name = '__vt_pie_sector'

    // 选中块向外偏移
    if (offsetDistance > 0) {
      const midAngle = degToRad((startAngle + endAngle) / 2)
      mesh.position.set(
        Math.cos(midAngle) * offsetDistance,
        0,
        -Math.sin(midAngle) * offsetDistance
      )
    }

    return mesh
  }
}
