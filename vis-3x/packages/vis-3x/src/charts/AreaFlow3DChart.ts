/**
 * vis-3x — 3D 面积流图（块状山体）
 *
 * ## 视觉效果
 *
 * 每个数据点生成一个**有厚度的实体块**，块的高度随数值起伏，
 * 相邻块紧密拼合，整体形成连绵的山体曲面。
 * 不是「折线 + 幕布」，而是像柱状图那样真正占体积的实体。
 *
 * ```
 *        ┌─┐   ┌──┐
 *      ┌─┘ └─┬─┘  └─┐
 *      │     │      │     ← 实体块，各块高度不同
 *   ───┴─────┴──────┴───  ← 地面基准
 * ```
 *
 * ## 与 line3D 的区别
 *
 * - `line3D + curtain`：一条线 + 向下渐隐的透明面片（薄片）
 * - `areaFlow3D`：每个类目一根**实体块**，有顶面、两个侧面、正面、背面
 *
 * ## 主要能力
 *
 * | 字段 | 作用 |
 * |---|---|
 * | `blockGap` | 块之间的缝隙（0 = 完全贴合） |
 * | `blockDepth` | 块的 Z 方向厚度，默认占满网格 |
 * | `colorByValue` | 按高度调色，越高峰越亮 |
 * | `topStyle` | 顶面单独上色（描边/高光） |
 * | `layerOpacity` | 多系列层叠时的透明度 |
 */
import * as THREE from 'three'
import { ChartBase, type ResolvedChartOption } from '../core/ChartBase'
import type { AreaFlow3DSeries } from '../types/series'
import { extractScalar, extractName } from '../types/series'
import { formatLabel } from '../core/LabelManager'
import { toThreeColor, createGradientSampler, toCssColor } from '../utils/color'
import { parseGradient, sampleGradientAt, representativeColor } from '../utils/gradient'
import type { BorderStyle } from '../types/style'
import { clamp } from '../utils/math'

/** 把任意颜色降级为可交给 THREE.Color 的纯色 */
function toSafeSolid(input: string | number | undefined): string {
  if (input === undefined) return '#4f8cff'
  if (typeof input === 'number') return `#${input.toString(16).padStart(6, '0')}`
  return representativeColor(input)
}

/** 面积流图实现（块状实体） */
export class AreaFlow3DChart extends ChartBase {
  get chartType(): string {
    return 'areaFlow3D'
  }

  protected renderSeries(option: ResolvedChartOption): void {
    const seriesList = (option.series ?? []).filter(
      (s) => s.type === 'areaFlow3D'
    ) as AreaFlow3DSeries[]
    if (!seriesList.length) return

    const visible = seriesList.filter((s) => s.visible !== false)
    if (!visible.length) return
    const plan = this.createTransitionPlan(seriesList[0])
    const layerCount = Math.max(1, visible.length)

    visible.forEach((series, layerIndex) => {
      /* ---------------------- 解析数据 ---------------------- */
      const values: number[] = []
      const names: string[] = []
      series.data.forEach((item, dataIndex) => {
        const value = extractScalar(item as never)
        values.push(Number.isFinite(value) ? value : 0)
        names.push(extractName(item as never, this.cartesian.categoryName(dataIndex)) ?? '')
      })
      if (!values.length) return

      /* ---------------------- 布局参数 ---------------------- */
      const { gridWidth, gridDepth } = this.gridConfig
      const catCount = Math.max(1, this.countCategories(seriesList))
      const slotWidth = gridWidth / catCount

      // 块宽：默认占满槽位，blockGap 控制缝隙
      const gap = clamp(series.blockGap ?? 0, 0, 0.9)
      const blockWidth = slotWidth * (1 - gap)

      // 块深：多系列时按层错开 Z，单系列时占满网格
      const depthRatio = clamp(series.blockDepth ?? 1, 0.05, 1)
      const fullDepth = gridDepth * depthRatio
      const layerDepth =
        layerCount > 1 ? fullDepth / layerCount : fullDepth
      const zCenter =
        layerCount > 1
          ? -fullDepth / 2 + layerDepth * (layerIndex + 0.5)
          : 0

      /* ---------------------- 颜色策略 ---------------------- */
      const baseColor = this.resolveSeriesColor(series, layerIndex)
      const valueMin = Math.min(...values)
      const valueMax = Math.max(...values)
      const valueSpan = valueMax - valueMin || 1

      // 色带：显式 colorGradient > curtainStyle/areaStyle 的渐变 > 纯色
      const gradientSpec =
        parseGradient(series.colorGradient?.length ? undefined : series.curtainStyle?.color) ??
        null
      const colorSampler = series.colorGradient?.length
        ? createGradientSampler(series.colorGradient)
        : gradientSpec
          ? (t: number) => sampleGradientAt(gradientSpec, t).color
          : null

      /** 取某个数值对应的颜色 */
      const colorForValue = (value: number): string => {
        if (series.colorByValue && colorSampler) {
          const t = clamp((value - valueMin) / valueSpan, 0, 1)
          return `#${colorSampler(t).getHexString()}`
        }
        return baseColor
      }

      // 层叠透明度
      const minLayerOpacity = series.minLayerOpacity ?? 0.45
      const layerFactor =
        series.layerOpacity !== false && layerCount > 1
          ? 1 - (layerIndex / Math.max(1, layerCount - 1)) * (1 - minLayerOpacity)
          : 1
      const baseOpacity = (series.curtainStyle?.opacity ?? 0.85) * layerFactor

      /* ---------------------- 逐块构建 ---------------------- */
      values.forEach((value, i) => {
        const height = this.cartesian.yAt(value)
        if (!(height > 0)) return

        const x = this.cartesian.xAtCategory(i)
        const color = colorForValue(value)

        const block = this.buildBlock({
          x,
          z: zCenter,
          width: blockWidth,
          depth: layerDepth,
          height,
          color,
          series,
          opacity: baseOpacity,
          dataIndex: i,
        })
        if (!block) return

        this.makePickable(block, {
          seriesIndex: seriesList.indexOf(series),
          dataIndex: i,
          seriesName: series.name,
          name: names[i],
          value,
          color,
        })
        this.seriesGroup.add(block)

        // 入场动画：从地面向上长
        plan.scaleY(block, i, 0.001, i * 12)
      })

      /* ---------------------- 标签 ---------------------- */
      const labelStyle = series.label ?? option.label
      if (labelStyle?.show) {
        values.forEach((value, i) => {
          const text = formatLabel(labelStyle, {
            value,
            name: names[i],
            seriesName: series.name,
            dataIndex: i,
            seriesIndex: seriesList.indexOf(series),
          })
          if (!text) return
          const anchor = new THREE.Object3D()
          anchor.position.set(
            this.cartesian.xAtCategory(i),
            this.cartesian.yAt(value) + (labelStyle.distance ?? 0.3),
            zCenter
          )
          this.seriesGroup.add(anchor)
          this.createLabel(anchor, text, labelStyle)
        })
      }
    })

    plan.run()
    this.keepRenderingWhileAnimating()
  }

  /**
   * 构建单个块状实体
   *
   * 几何体为长方体，但顶部做了「按高度调色」与「顶面高光」两层处理：
   * 1. 侧面用底部到顶部的竖向渐变（顶点色）
   * 2. 顶面单独用一个薄片覆盖，可独立上色
   */
  private buildBlock(params: {
    x: number
    z: number
    width: number
    depth: number
    height: number
    color: string
    series: AreaFlow3DSeries
    opacity: number
    dataIndex: number
  }): THREE.Mesh | null {
    const { x, z, width, depth, height, color, series, opacity } = params
    if (width <= 0 || depth <= 0 || height <= 0) return null

    const style = series.curtainStyle ?? {}
    const material = new THREE.MeshStandardMaterial({
      color: toThreeColor(color),
      roughness: style.roughness ?? 0.45,
      metalness: style.metalness ?? 0.15,
      transparent: opacity < 1,
      opacity,
      side: THREE.DoubleSide,
      emissive: toThreeColor(style.emissive ?? color),
      emissiveIntensity: style.emissiveIntensity ?? 0.12,
      envMapIntensity: 1.1,
      depthWrite: opacity >= 1,
    })

    const geometry = new THREE.BoxGeometry(width, height, depth)
    // 让盒子底面贴地：几何体默认中心在原点，上移半个高度
    geometry.translate(0, height / 2, 0)
    this.resources.trackGeometry(geometry)

    const mesh = new THREE.Mesh(geometry, material)
    mesh.position.set(x, 0, z)
    mesh.castShadow = true
    mesh.receiveShadow = true
    mesh.name = '__vt_area_flow_block'

    /* ---------------------- 块状描边 ---------------------- */
    const border = style.border
    if (border?.show) {
      this.attachBlockBorder(mesh, { width, depth, height, border, color })
    }

    /* ---------------------- 顶面高光 ---------------------- */
    const topStyle = series.topStyle
    if (topStyle?.show !== false && topStyle) {
      const topColor = toThreeColor(topStyle.color ?? color)
      const topGeo = new THREE.PlaneGeometry(width, depth)
      // PlaneGeometry 默认在 XY 平面，旋转到 XZ 后贴到块顶
      topGeo.rotateX(-Math.PI / 2)
      // 几何体仍在块局部坐标系的顶部，挂成子对象后自动继承 scaleY 动画
      topGeo.translate(0, height + 0.002, 0)
      this.resources.trackGeometry(topGeo)

      const topMat = this.resources.createMaterial(`#${topColor.getHexString()}`, {
        preset: 'standard',
        roughness: topStyle.roughness ?? 0.3,
        metalness: topStyle.metalness ?? 0.25,
        emissive: topStyle.emissive ? String(topStyle.emissive) : `#${topColor.getHexString()}`,
        emissiveIntensity: topStyle.emissiveIntensity ?? 0.45,
        opacity: topStyle.opacity ?? 1,
        transparent: (topStyle.opacity ?? 1) < 1,
      })

      const topMesh = new THREE.Mesh(topGeo, topMat)
      topMesh.userData.__vtNoPick = true
      topMesh.name = '__vt_area_flow_top'
      // 子对象：位置是相对块原点的，几何体已抬到高度处，因此不再设 position
      mesh.add(topMesh)
    }

    return mesh
  }

  /**
   * 给块体加描边
   *
   * 用 `EdgesGeometry` 提取盒子的棱边，再用细管画出——比 wireframe 干净，
   * 只描外轮廓、不画内部三角面的对角线。
   *
   * @param parent 块体
   * @param params 尺寸与样式
   */
  private attachBlockBorder(
    parent: THREE.Mesh,
    params: {
      width: number
      depth: number
      height: number
      border: BorderStyle
      color: string
    }
  ): void {
    const { width, depth, height, border } = params
    const tubeRadius = Math.max(0.004, border.width ?? 0.02)

    // 以块体几何为基准提取棱边（已 translate 到贴地）
    const box = new THREE.BoxGeometry(width, height, depth)
    box.translate(0, height / 2, 0)
    const edges = new THREE.EdgesGeometry(box, 30)
    this.resources.trackGeometry(edges)
    this.resources.trackGeometry(box)

    const positions = edges.getAttribute('position')
    if (!positions) return

    const borderColor = toSafeSolid(
      border.color !== undefined ? String(border.color) : params.color
    )
    const mat = this.resources.createMaterial(borderColor, {
      preset: 'standard',
      roughness: 0.35,
      metalness: 0.2,
      emissive: borderColor,
      emissiveIntensity: border.emissiveIntensity ?? 0.35,
      opacity: border.opacity ?? 1,
      transparent: (border.opacity ?? 1) < 1,
      depthWrite: false,
    })

    // EdgesGeometry 的顶点是成对的线段端点，逐段生成极细的管
    for (let i = 0; i < positions.count; i += 2) {
      const a = new THREE.Vector3(
        positions.getX(i),
        positions.getY(i),
        positions.getZ(i)
      )
      const b = new THREE.Vector3(
        positions.getX(i + 1),
        positions.getY(i + 1),
        positions.getZ(i + 1)
      )
      // 跳过长度为 0 的退化边
      if (a.distanceToSquared(b) < 1e-9) continue

      const curve = new THREE.LineCurve3(a, b)
      const geo = new THREE.TubeGeometry(curve, 1, tubeRadius, 5, false)
      this.resources.trackGeometry(geo)
      const seg = new THREE.Mesh(geo, mat)
      seg.userData.__vtNoPick = true
      seg.name = '__vt_area_flow_border'
      seg.castShadow = false
      seg.receiveShadow = false
      // 子对象：跟随块体的 scaleY 动画
      parent.add(seg)
    }
  }
}
