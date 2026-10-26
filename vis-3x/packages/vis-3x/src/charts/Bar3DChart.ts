/**
 * vis-3x — 3D 柱状图
 *
 * 特性：
 * - 圆角柱子（ExtrudeGeometry + 圆角 Shape）
 * - 顶部高光顶盖，增强材质层次
 * - 支持负数（向下延伸）
 * - 支持堆叠
 * - 逐柱生长动画（首次入场为完整生长，数据更新为平滑过渡）
 * - 数值渐变色带
 */
import * as THREE from 'three'
import { ChartBase, type ResolvedChartOption } from '../core/ChartBase'
import type { Bar3DSeries, Series3D } from '../types/series'
import { extractScalar, extractName } from '../types/series'
import type { ItemStyle } from '../types/style'
import { gradientColorAt, shade, toThreeColor } from '../utils/color'
import { formatLabel } from '../core/LabelManager'
import { roundedRectShape, clamp } from '../utils/math'

/** 柱状图实现 */
export class Bar3DChart extends ChartBase {
  get chartType(): string {
    return 'bar3D'
  }

  protected renderSeries(option: ResolvedChartOption): void {
    const seriesList = (option.series ?? []).filter((s) => s.type === 'bar3D') as Bar3DSeries[]
    if (!seriesList.length) return

    const visible = seriesList.filter((s) => s.visible !== false)
    const seriesCount = Math.max(1, visible.length)
    // 统一过渡计划：首次为入场生长，更新时为平滑过渡
    const plan = this.createTransitionPlan(seriesList[0])

    const { gridDepth } = this.gridConfig
    const step = this.cartesian.xStep

    // 堆叠累加器
    const stackPositive = new Map<string, number[]>()
    const stackNegative = new Map<string, number[]>()

    visible.forEach((series, visibleIndex) => {
      const data = series.data
      const colors = this.seriesColors(series, data.length)
      const barGap = series.barGap ?? 0.08
      const categoryGap = series.barCategoryGap ?? 0.32
      const slot = this.cartesian.getBarSlot(visibleIndex, seriesCount, barGap, categoryGap)

      // 柱子尺寸：优先使用显式配置，否则按槽位自动计算
      const barWidth =
        typeof series.barWidth === 'number'
          ? series.barWidth
          : series.barWidth
            ? (parseFloat(series.barWidth) / 100) * step
            : slot.width
      const barDepth =
        typeof series.barDepth === 'number'
          ? series.barDepth
          : series.barDepth
            ? (parseFloat(series.barDepth) / 100) * gridDepth
            : Math.min(gridDepth * 0.42, barWidth * 1.6)

      // Z 方向定位：多系列时在深度上略微错开，增强立体感
      const zBase =
        seriesCount > 1 ? this.cartesian.zAt((visibleIndex + 0.5) / seriesCount) : 0

      data.forEach((item, dataIndex) => {
        const value = extractScalar(item as never)
        if (!Number.isFinite(value)) return

        const baseX = this.cartesian.xAtCategory(dataIndex)
        const x = baseX + (seriesCount > 1 ? slot.offset : 0)

        // 堆叠：计算基准高度
        let stackBase = 0
        if (series.stack) {
          const map = value >= 0 ? stackPositive : stackNegative
          const arr = map.get(series.stack) ?? []
          stackBase = arr[dataIndex] ?? 0
          arr[dataIndex] = stackBase + value
          map.set(series.stack, arr)
        }

        const y0 = this.cartesian.yAt(stackBase)
        const y1 = this.cartesian.yAt(stackBase + value)
        const height = Math.abs(y1 - y0)

        const color = this.resolveColor(series, dataIndex, colors[dataIndex], value, option)

        const mesh = this.createBar({
          x,
          z: zBase,
          y: Math.min(y0, y1),
          width: barWidth,
          depth: barDepth,
          height: Math.max(height, 1e-4),
          color,
          itemStyle: this.resolveItemStyle(series, dataIndex),
          radius: series.borderRadius ?? 0.06,
          capStyle: series.capStyle,
        })

        this.makePickable(mesh, {
          seriesIndex: seriesList.indexOf(series),
          dataIndex,
          seriesName: series.name,
          name: extractName(item as never, this.cartesian.categoryName(dataIndex)),
          value,
          color,
        })

        this.seriesGroup.add(mesh)

        // 标签
        const labelStyle = series.label ?? series.topLabel ?? option.label
        if (labelStyle?.show) {
          const text = formatLabel(labelStyle, {
            value,
            name: extractName(item as never, this.cartesian.categoryName(dataIndex)),
            seriesName: series.name,
            dataIndex,
            seriesIndex: seriesList.indexOf(series),
          })
          if (text) {
            const anchor = new THREE.Object3D()
            const distance = labelStyle.distance ?? 0.28
            const top = Math.max(y0, y1)
            anchor.position.set(x, top + distance, zBase)
            mesh.add(anchor)
            // 把锚点从柱子缩放的动画中解耦：柱子不缩放，改为动画高度
            this.createLabel(anchor, text, labelStyle)
          }
        }

        // 生长动画：几何体底部在局部 y=0，直接缩放 scale.y 即可
        // 让柱底固定、柱顶上升。多系列时按系列错开，避免同时弹出。
        plan.scaleY(mesh, dataIndex, 0.001, visibleIndex * 40)
      })
    })

    // 统一启动本帧登记的全部动画
    plan.run()
    this.keepRenderingWhileAnimating()
  }

  /** 解析柱子颜色（支持按值渐变） */
  private resolveColor(
    series: Bar3DSeries,
    dataIndex: number,
    paletteColor: string,
    value: number,
    option: ResolvedChartOption
  ): string {
    const itemStyle = this.resolveItemStyle(series, dataIndex)
    if (itemStyle?.color) return itemStyle.color as string
    if (series.colorByValue) {
      const [min, max] = this.cartesian.yAxis.domain
      const t = clamp((value - min) / (max - min || 1), 0, 1)
      const gradient = option.theme?.palette ?? []
      if (gradient.length > 1) return gradientColorAt(gradient, t)
      return gradientColorAt([shade(paletteColor, -0.25), paletteColor, shade(paletteColor, 0.2)], t)
    }
    return paletteColor
  }

  /** 解析数据项的 itemStyle（支持数组形式） */
  private resolveItemStyle(series: Bar3DSeries, dataIndex: number): ItemStyle | undefined {
    const dataItem = series.data[dataIndex]
    if (typeof dataItem === 'object' && dataItem !== null && 'itemStyle' in dataItem) {
      return dataItem.itemStyle as ItemStyle
    }
    return series.itemStyle
  }

  /**
   * 创建一根柱子
   *
   * 使用 ExtrudeGeometry 实现圆角，挤出方向为 Y 轴：
   * 先在 XY 平面画圆角矩形，再旋转使挤出方向朝上。
   *
   * 坐标约定：几何体经 `translate` 后其**底部位于局部 y = 0**，
   * 因此 `mesh.position.y` 直接等于柱子底面的世界高度（即 `yAt(value)`），
   * 不能再加 `height / 2`，否则柱子会整体悬空。
   */
  private createBar(params: {
    x: number
    y: number
    z: number
    width: number
    depth: number
    height: number
    color: string
    itemStyle?: ItemStyle
    radius: number
    capStyle?: ItemStyle
  }): THREE.Mesh {
    const { x, y, z, width, depth, height, color, itemStyle, radius, capStyle } = params

    const shape = roundedRectShape(width, depth, radius * Math.min(width, depth))
    const geometry = new THREE.ExtrudeGeometry(shape, {
      depth: height,
      bevelEnabled: false,
      curveSegments: 4,
    })
    // ExtrudeGeometry 沿 +Z 挤出，z 范围为 [0, height]
    // rotateX(-90°) 后 (x,y,z) → (x, z, -y)：
    //   y 范围变为 [0, height]  ← 底部天然对齐 y = 0
    //   z 范围变为 [-depth/2, depth/2]
    // 因此这里**不需要**再 translate(0, height/2, 0)，
    // 否则柱子会被整体抬高半个柱高（造成柱底参差不齐的观感）。
    geometry.rotateX(-Math.PI / 2)
    geometry.computeVertexNormals()
    this.resources.trackGeometry(geometry)

    const material = this.resources.createMaterial(color, {
      preset: itemStyle?.preset ?? 'standard',
      roughness: itemStyle?.roughness ?? 0.32,
      metalness: itemStyle?.metalness ?? 0.25,
      opacity: itemStyle?.opacity ?? 1,
      transparent: itemStyle?.transparent,
      emissive: itemStyle?.emissive,
      emissiveIntensity: itemStyle?.emissiveIntensity,
      envMapIntensity: itemStyle?.envMapIntensity ?? 1.1,
      flatShading: itemStyle?.flatShading,
      side: itemStyle?.side,
      wireframe: itemStyle?.wireframe,
      ...itemStyle,
      color,
    })

    const mesh = new THREE.Mesh(geometry, material)
    // 几何体底部已在局部 y = 0，所以 mesh.position.y 就是柱底的世界高度。
    // 这里传进来的 `y` 是柱底坐标（Math.min(y0, y1)），不能再加 height/2。
    mesh.position.set(x, y, z)
    mesh.castShadow = itemStyle?.castShadow !== false
    mesh.receiveShadow = itemStyle?.receiveShadow !== false
    mesh.name = '__vt_bar'

    // 顶盖：稍微放大的一层薄片，模拟高光/发光顶面
    if (capStyle || (itemStyle?.metalness ?? 0.25) > 0.2) {
      const capColor = (capStyle?.color as string) ?? shade(color, 0.18)
      const capGeo = new THREE.BoxGeometry(width * 1.005, Math.min(height * 0.04, 0.06), depth * 1.005)
      this.resources.trackGeometry(capGeo)
      const capMat = this.resources.createMaterial(capColor, {
        preset: capStyle?.preset ?? 'standard',
        roughness: capStyle?.roughness ?? 0.1,
        metalness: capStyle?.metalness ?? 0.6,
        emissive: capStyle?.emissive ?? toThreeColor(capColor).getHex(),
        emissiveIntensity: capStyle?.emissiveIntensity ?? 0.12,
        opacity: capStyle?.opacity ?? 1,
        transparent: capStyle?.transparent,
        ...capStyle,
        color: capColor,
      })
      const cap = new THREE.Mesh(capGeo, capMat)
      // mesh 的原点现在位于柱底，顶盖应贴在柱顶（局部 y = height）
      cap.position.y = height
      cap.castShadow = false
      cap.receiveShadow = false
      cap.userData.__vtNoPick = false
      mesh.add(cap)
    }

    return mesh
  }
}
