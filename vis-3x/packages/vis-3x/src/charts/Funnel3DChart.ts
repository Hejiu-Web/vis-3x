/**
 * vis-3x — 3D 漏斗图 / 金字塔图
 *
 * 每一层是一个上宽下窄的梯形棱柱，使用 ExtrudeGeometry 生成。
 */
import * as THREE from 'three'
import { ChartBase, type ResolvedChartOption } from '../core/ChartBase'
import type { Funnel3DSeries } from '../types/series'
import { extractScalar, extractName } from '../types/series'
import { formatLabel } from '../core/LabelManager'
import { clamp } from '../utils/math'

/** 漏斗图实现 */
export class Funnel3DChart extends ChartBase {

  get chartType(): string {
    return 'funnel3D'
  }

  protected isNonCartesian(): boolean {
    return true
  }

  protected renderSeries(option: ResolvedChartOption): void {
    const seriesList = (option.series ?? []).filter(
      (s) => s.type === 'funnel3D'
    ) as Funnel3DSeries[]
    if (!seriesList.length) return
    const plan = this.createTransitionPlan(seriesList[0])

    for (let seriesIndex = 0; seriesIndex < seriesList.length; seriesIndex++) {
      const series = seriesList[seriesIndex]
      if (series.visible === false) continue

      let items = series.data.map((item, index) => ({
        value: extractScalar(item as never),
        name: extractName(item as never, `阶段 ${index + 1}`) ?? `阶段 ${index + 1}`,
        index,
      }))

      // 排序
      const sort = series.sort ?? 'descending'
      if (sort === 'descending') items = [...items].sort((a, b) => b.value - a.value)
      else if (sort === 'ascending') items = [...items].sort((a, b) => a.value - b.value)

      if (!items.length) continue

      const totalHeight = series.height ?? 6
      const gap = series.gap ?? 0.14
      const topWidth = series.width ?? 5
      const depth = series.depth ?? 1.6
      const minSize = clamp(series.minSize ?? 0.22, 0.02, 1)
      const isPyramid = series.shape === 'pyramid'

      const maxValue = Math.max(...items.map((i) => i.value), 1)
      const layerHeight = (totalHeight - gap * (items.length - 1)) / items.length
      const colors = this.seriesColors(series, items.length)

      // 总高度居中
      const baseY = 0

      items.forEach((item, layerIndex) => {
        const t = clamp(item.value / maxValue, 0, 1)
        // 宽度按数值线性映射，底部保证不小于 minSize
        const width = topWidth * (minSize + (1 - minSize) * t)

        // 下一层宽度
        const nextItem = items[layerIndex + 1]
        const nextT = nextItem ? clamp(nextItem.value / maxValue, 0, 1) : t * 0.6

        /**
         * 两种形状的区别：
         *
         * - `funnel`（漏斗）：每层保持梯形，上宽下窄，层与层之间留出视觉缝隙，
         *   像一个分层的漏斗。
         * - `pyramid`（金字塔）：每层收成一个三角形（底部宽度趋近于 0），
         *   整体拼成一个实心锥体。
         */
        const bottomWidth = isPyramid
          ? topWidth * minSize * 0.12
          : topWidth * (minSize + (1 - minSize) * nextT)

        const y = baseY + (items.length - 1 - layerIndex) * (layerHeight + gap)
        const color = colors[layerIndex % colors.length]

        const mesh = this.createFrustum({
          topWidth: width,
          bottomWidth,
          height: layerHeight,
          depth,
          color,
          itemStyle: series.itemStyle,
        })
        mesh.position.y = y
        mesh.name = '__vt_funnel_layer'

        this.makePickable(mesh, {
          seriesIndex,
          dataIndex: item.index,
          seriesName: series.name,
          name: item.name,
          value: item.value,
          color,
        })
        this.seriesGroup.add(mesh)

        /* ---------------------------- 标签 ---------------------------- */
        const labelStyle = series.label ?? option.label
        if (labelStyle?.show) {
          const anchor = new THREE.Object3D()
          anchor.position.set(0, y + layerHeight + (labelStyle.distance ?? 0.25), depth / 2 + 0.15)
          this.seriesGroup.add(anchor)
          const text = formatLabel(labelStyle, {
            value: item.value,
            name: item.name,
            seriesName: series.name,
            dataIndex: item.index,
            seriesIndex,
            percent: (item.value / (items.reduce((a, b) => a + b.value, 0) || 1)) * 100,
          })
          if (text) this.createLabel(anchor, text, labelStyle)
        }
        /* ---------------------------- 动画 ---------------------------- */
        // 各层从上方滑入并淡入
        const targetY = y
        const startY = targetY + 2.4
        mesh.position.y = startY
        plan.custom(
          (t) => {
            mesh.position.y = startY + (targetY - startY) * t
          },
          layerIndex,
          { finish: () => { mesh.position.y = targetY } }
        )
        plan.fade(mesh, layerIndex)
      })

      // 整体居中：让漏斗的垂直中心靠近原点
      this.seriesGroup.position.y = 0
      this.engine.fitToScreen(undefined, undefined, 0.8)
    }

    // 统一启动动画并保持重绘
    plan.run()
    this.keepRenderingWhileAnimating()
  }

  /**
   * 创建梯形棱柱
   *
   * 在 XY 平面构造梯形 Shape（上窄下宽 -> 漏斗），沿 Z 挤出后
   * 旋转并居中。
   */
  private createFrustum(params: {
    topWidth: number
    bottomWidth: number
    height: number
    depth: number
    color: string
    itemStyle?: Funnel3DSeries['itemStyle']
  }): THREE.Mesh {
    const { topWidth, bottomWidth, height, depth, color, itemStyle } = params

    const shape = new THREE.Shape()
    const hwTop = topWidth / 2
    const hwBottom = bottomWidth / 2
    const halfH = height / 2

    // 上窄下宽（漏斗形状）
    shape.moveTo(-hwTop, halfH)
    shape.lineTo(hwTop, halfH)
    shape.lineTo(hwBottom, -halfH)
    shape.lineTo(-hwBottom, -halfH)
    shape.closePath()

    const geometry = new THREE.ExtrudeGeometry(shape, {
      depth,
      bevelEnabled: true,
      bevelThickness: 0.03,
      bevelSize: 0.03,
      bevelSegments: 2,
      curveSegments: 2,
    })
    // 挤出中心对齐到 Z 轴原点
    geometry.translate(0, 0, -depth / 2)
    geometry.computeVertexNormals()
    this.resources.trackGeometry(geometry)

    const material = this.resources.createMaterial(color, {
      preset: itemStyle?.preset ?? 'standard',
      roughness: itemStyle?.roughness ?? 0.32,
      metalness: itemStyle?.metalness ?? 0.28,
      opacity: itemStyle?.opacity ?? 1,
      transparent: itemStyle?.transparent,
      emissive: itemStyle?.emissive,
      emissiveIntensity: itemStyle?.emissiveIntensity ?? 0.08,
      envMapIntensity: 1.2,
      side: 'double',
      ...itemStyle,
      color,
    })

    const mesh = new THREE.Mesh(geometry, material)
    mesh.castShadow = true
    mesh.receiveShadow = true
    // 漏斗正面朝观察者，图形本身在 XY 平面即可
    return mesh
  }
}
