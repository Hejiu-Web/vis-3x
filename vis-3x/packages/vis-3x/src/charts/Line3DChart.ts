/**
 * vis-3x — 3D 折线图
 *
 * 特性：
 * - 支持平滑曲线（Catmull-Rom 样条）
 * - 可选「垂幕」效果：折线向下投影到地面，极大增强 3D 空间感
 * - 数据点标记
 * - 描边生长动画
 */
import * as THREE from 'three'
import { ChartBase, type ResolvedChartOption } from '../core/ChartBase'
import type { Line3DSeries } from '../types/series'
import { extractScalar, extractName } from '../types/series'
import { formatLabel } from '../core/LabelManager'
import { catmullRomSpline } from '../utils/math'
import { toThreeColor } from '../utils/color'
import { parseGradient, sampleGradientAt, representativeColor } from '../utils/gradient'
import type { ColorLike } from '../types/style'

/** 折线图实现 */
export class Line3DChart extends ChartBase {

  get chartType(): string {
    return 'line3D'
  }

  protected renderSeries(option: ResolvedChartOption): void {
    const seriesList = (option.series ?? []).filter((s) => s.type === 'line3D') as Line3DSeries[]
    if (!seriesList.length) return

    const visible = seriesList.filter((s) => s.visible !== false)
    const seriesCount = Math.max(1, visible.length)
    const plan = this.createTransitionPlan(seriesList[0])

    visible.forEach((series, visibleIndex) => {
      const points: THREE.Vector3[] = []
      const values: number[] = []
      const names: string[] = []

      // Z 方向错开：多折线并排展示
      const zOffset =
        series.z !== undefined
          ? series.z
          : seriesCount > 1
            ? this.cartesian.zAt((visibleIndex + 0.5) / seriesCount)
            : 0

      series.data.forEach((item, dataIndex) => {
        const value = extractScalar(item as never)
        if (!Number.isFinite(value)) return
        const x = this.cartesian.xAtCategory(dataIndex)
        const y = this.cartesian.yAt(value)
        points.push(new THREE.Vector3(x, y, zOffset))
        values.push(value)
        names.push(extractName(item as never, this.cartesian.categoryName(dataIndex)) ?? '')
      })

      if (points.length < 2) return

      const rawLineColor = series.lineStyle?.color
      // 折线主体是 TubeGeometry，竖向贴图会在曲线走向上扭曲，
      // 因此渐变取代表色（中间色）作为主体颜色，上下渐变交由垂幕表现。
      const color = rawLineColor
        ? representativeColor(rawLineColor as never, this.seriesColors(series, 1)[0])
        : this.seriesColors(series, 1)[0]

      // 平滑处理
      const smooth = series.smooth !== false
      const renderPoints = smooth
        ? catmullRomSpline(points, 14, series.smoothTension ?? 0.5)
        : points

      const curve = new THREE.CatmullRomCurve3(renderPoints, false, 'centripetal')

      /* ------------------------------ 主线 ------------------------------ */
      const segments = Math.max(24, renderPoints.length * 2)
      const tubeRadius = (series.lineStyle?.width ?? 3) * 0.012
      const geometry = new THREE.TubeGeometry(curve, segments, tubeRadius, 8, false)
      this.resources.trackGeometry(geometry)

      const material = this.resources.createMaterial(color, {
        preset: 'standard',
        roughness: series.lineStyle?.emissive ? 0.18 : 0.3,
        metalness: 0.35,
        emissive: series.lineStyle?.emissive ?? color,
        emissiveIntensity: series.lineStyle?.emissiveIntensity ?? 0.16,
        opacity: series.lineStyle?.opacity ?? 1,
        transparent: (series.lineStyle?.opacity ?? 1) < 1,
        envMapIntensity: 1.3,
      })

      const line = new THREE.Mesh(geometry, material)
      line.castShadow = false
      line.receiveShadow = false
      line.name = '__vt_line'
      this.makePickable(line, {
        seriesIndex: seriesList.indexOf(series),
        dataIndex: 0,
        seriesName: series.name,
        name: series.name,
        value: values[0] ?? 0,
        color,
      })
      this.seriesGroup.add(line)

      /* ---------------------------- 垂幕效果 ---------------------------- */
      if (series.curtain) {
        this.buildCurtain(points, color, series)
      }

      /* ---------------------------- 数据点 ------------------------------ */
      const showSymbol = series.showSymbol ?? false
      if (showSymbol) {
        const pointStyle = series.pointStyle
        const size = pointStyle?.size ?? series.symbolSize ?? 0.12
        points.forEach((point, i) => {
          const pointColor = pointStyle?.color ? String(pointStyle.color) : color
          const geo = this.resources.createSphere(size, 16)
          const mat = this.resources.createMaterial(pointColor, {
            preset: 'standard',
            roughness: pointStyle?.roughness ?? 0.2,
            metalness: 0.3,
            emissive: pointStyle?.emissive ?? pointColor,
            emissiveIntensity: pointStyle?.emissiveIntensity ?? 0.3,
            opacity: pointStyle?.opacity ?? 1,
            transparent: (pointStyle?.opacity ?? 1) < 1,
          })
          const sphere = new THREE.Mesh(geo, mat)
          sphere.position.copy(point)
          sphere.castShadow = false
          sphere.name = '__vt_line_point'
          this.makePickable(sphere, {
            seriesIndex: seriesList.indexOf(series),
            dataIndex: i,
            seriesName: series.name,
            name: names[i],
            value: values[i] ?? 0,
            color: pointColor,
          })
          this.seriesGroup.add(sphere)
        })
      }

      /* ------------------------------ 标签 ------------------------------ */
      const labelStyle = series.label ?? option.label
      if (labelStyle?.show) {
        points.forEach((point, i) => {
          const text = formatLabel(labelStyle, {
            value: values[i] ?? 0,
            name: names[i],
            seriesName: series.name,
            dataIndex: i,
            seriesIndex: seriesList.indexOf(series),
          })
          if (!text) return
          const anchor = new THREE.Object3D()
          const distance = labelStyle.distance ?? 0.3
          anchor.position.set(point.x, point.y + distance, point.z)
          this.seriesGroup.add(anchor)
          this.createLabel(anchor, text, labelStyle)
        })
      }
      /* ------------------------------ 动画 ------------------------------ */
      // 折线从底部向上生长
      plan.scaleY(line, visibleIndex, 0.001, visibleIndex * 60)
    })

    // 统一启动动画并保持重绘
    plan.run()
    this.keepRenderingWhileAnimating()
  }

  /**
   * 构建垂幕：从折线每个点向下（到地面）生成渐变面片
   *
   * 这是 3D 折线图最有效的「空间定位」手段。
   *
   * ## 渐变支持
   *
   * `curtainStyle.color` 可以是纯色，也可以是 CSS 渐变：
   *
   * ```ts
   * curtainStyle: {
   *   color: 'linear-gradient(180deg, #1EE793 0%, rgba(0, 0, 0, 0.1) 110.42%)'
   * }
   * ```
   *
   * 实现方式：顶部与底部两个顶点分别写入**颜色 + alpha**（顶点属性为 4 分量），
   * 再通过 `onBeforeCompile` 把 alpha 注入片元着色器，得到真正的「往下渐隐」效果。
   *
   * alpha 的优先级：
   * 1. `curtainStyle.gradientOpacity`（显式指定起止透明度）
   * 2. 渐变字符串里各色标自带的 alpha
   * 3. 纯色默认 `[0.06, 1]`（底部几乎透明、顶部实色）
   */
  private buildCurtain(points: THREE.Vector3[], color: string, series: Line3DSeries): void {
    if (points.length < 2) return
    const style = series.curtainStyle ?? {}
    const baseY = this.cartesian.yAt(0)

    const positions: number[] = []
    const colors: number[] = []
    const indices: number[] = []

    const isVerticalGradient = style.gradient !== 'none'
    const rawColor = style.color ?? color

    // 显式给了 endColor，等价于 color -> endColor 的竖向渐变
    const explicitGradient =
      style.endColor !== undefined
        ? `linear-gradient(180deg, ${resolveColorToken(rawColor as ColorLike)}, ${resolveColorToken(style.endColor as ColorLike)})`
        : rawColor

    const spec = isVerticalGradient ? parseGradient(explicitGradient) : null

    const topColor = new THREE.Color()
    const bottomColor = new THREE.Color()
    let topAlpha = 1
    let bottomAlpha = 0.06

    if (spec) {
      const top = sampleGradientAt(spec, 0)
      const bottom = sampleGradientAt(spec, 1)
      topColor.copy(top.color)
      bottomColor.copy(bottom.color)
      const ga = style.gradientOpacity
      topAlpha = ga ? Math.min(1, Math.max(0, ga[1])) : top.alpha
      bottomAlpha = ga ? Math.min(1, Math.max(0, ga[0])) : bottom.alpha
    } else {
      topColor.copy(toThreeColor(rawColor as ColorLike))
      bottomColor.copy(topColor)
      const ga = style.gradientOpacity
      topAlpha = ga ? Math.min(1, Math.max(0, ga[1])) : 1
      bottomAlpha = ga ? Math.min(1, Math.max(0, ga[0])) : 0.06
    }

    for (let i = 0; i < points.length; i++) {
      const p = points[i]
      // 上顶点
      positions.push(p.x, p.y, p.z)
      colors.push(topColor.r, topColor.g, topColor.b, topAlpha)
      // 下顶点
      positions.push(p.x, baseY, p.z)
      colors.push(bottomColor.r, bottomColor.g, bottomColor.b, bottomAlpha)
    }

    for (let i = 0; i < points.length - 1; i++) {
      const a = i * 2
      const b = i * 2 + 1
      const c = (i + 1) * 2
      const d = (i + 1) * 2 + 1
      indices.push(a, b, c)
      indices.push(c, b, d)
    }

    const geometry = new THREE.BufferGeometry()
    geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3))
    // 4 分量：xyz 为 RGB，w 为 alpha
    geometry.setAttribute('color', new THREE.Float32BufferAttribute(colors, 4))
    geometry.setIndex(indices)
    geometry.computeVertexNormals()
    this.resources.trackGeometry(geometry)

    const material = new THREE.MeshStandardMaterial({
      vertexColors: true,
      transparent: true,
      opacity: style.opacity ?? 0.42,
      roughness: style.roughness ?? 0.6,
      metalness: style.metalness ?? 0.1,
      side: THREE.DoubleSide,
      depthWrite: false,
      emissive: topColor.clone(),
      emissiveIntensity: style.emissiveIntensity ?? 0.1,
    })
    // 顶点色第 4 分量（alpha）注入
    applyVertexAlpha(material)
    this.resources.createUniqueMaterial(topColor.getStyle(), { preset: 'standard' })

    const curtain = new THREE.Mesh(geometry, material)
    curtain.userData.__vtNoPick = true
    curtain.name = '__vt_curtain'
    this.seriesGroup.add(curtain)

    // 底部投影线，让垂幕「落地」
    const baseLinePoints = points.map((p) => new THREE.Vector3(p.x, baseY + 0.002, p.z))
    const baseGeo = new THREE.BufferGeometry().setFromPoints(baseLinePoints)
    this.resources.trackGeometry(baseGeo)
    const baseMat = new THREE.LineBasicMaterial({
      color: bottomColor.clone(),
      transparent: true,
      opacity: 0.45,
    })
    const baseLine = new THREE.Line(baseGeo, baseMat)
    baseLine.userData.__vtNoPick = true
    this.seriesGroup.add(baseLine)
  }
}

/* -------------------------------------------------------------------------- */
/*                              顶点 alpha 注入                                */
/* -------------------------------------------------------------------------- */

/**
 * 让 `MeshStandardMaterial` 支持「顶点色 4 分量」里的 alpha
 *
 * Three.js 的顶点色默认只有 RGB，这里通过 `onBeforeCompile` 注入：
 * - 顶点着色器：把 `color` 的 w 分量传给 varying
 * - 片元着色器：用 varying 乘以 `diffuseColor.a`
 */
function applyVertexAlpha(material: THREE.MeshStandardMaterial): void {
  material.onBeforeCompile = (shader) => {
    shader.vertexShader = shader.vertexShader
      .replace(
        '#include <common>',
        `#include <common>
varying float vVertexAlpha;`
      )
      .replace(
        '#include <color_vertex>',
        `#include <color_vertex>
vVertexAlpha = color.a;`
      )

    shader.fragmentShader = shader.fragmentShader
      .replace(
        '#include <common>',
        `#include <common>
varying float vVertexAlpha;`
      )
      .replace(
        '#include <alphamap_fragment>',
        `#include <alphamap_fragment>
diffuseColor.a *= vVertexAlpha;`
      )
  }
  material.needsUpdate = true
}

/** 把任意颜色输入转换成能嵌入 CSS 渐变的颜色 token */
function resolveColorToken(input: ColorLike | undefined): string {
  if (input === undefined) return '#4f8cff'
  if (typeof input === 'number') return `#${input.toString(16).padStart(6, '0')}`
  return input
}
