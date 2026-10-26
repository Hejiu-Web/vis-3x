/**
 * vis-3x — 3D 面积图
 *
 * 与折线图的区别：面积图会生成一个真正有厚度的「面」，
 * 并可在顶部保留一条描边线。
 */
import * as THREE from 'three'
import { ChartBase, type ResolvedChartOption } from '../core/ChartBase'
import type { Area3DSeries } from '../types/series'
import { extractScalar, extractName } from '../types/series'
import { formatLabel } from '../core/LabelManager'
import { catmullRomSpline } from '../utils/math'
import { toThreeColor } from '../utils/color'
import { parseGradient, sampleGradientAt, representativeColor } from '../utils/gradient'
import type { ColorLike } from '../types/style'

/** 面积图实现 */
export class Area3DChart extends ChartBase {

  get chartType(): string {
    return 'area3D'
  }

  protected renderSeries(option: ResolvedChartOption): void {
    const seriesList = (option.series ?? []).filter((s) => s.type === 'area3D') as Area3DSeries[]
    if (!seriesList.length) return

    const visible = seriesList.filter((s) => s.visible !== false)
    const seriesCount = Math.max(1, visible.length)
    const plan = this.createTransitionPlan(seriesList[0])

    visible.forEach((series, visibleIndex) => {
      const values: number[] = []
      const names: string[] = []
      const baseValues: number[] = []

      series.data.forEach((item, dataIndex) => {
        const value = extractScalar(item as never)
        values.push(Number.isFinite(value) ? value : 0)
        names.push(extractName(item as never, this.cartesian.categoryName(dataIndex)) ?? '')
        baseValues.push(series.baseValue ?? 0)
      })

      if (values.length < 2) return

      // 颜色可能是渐变字符串：面积面片走顶点色，取首色作为材质基色与描边色
      const rawAreaColor = series.areaStyle?.color
      const color = rawAreaColor
        ? representativeColor(rawAreaColor as never, this.seriesColors(series, 1)[0])
        : this.seriesColors(series, 1)[0]

      // Z 方向错开
      const zOffset =
        seriesCount > 1 ? this.cartesian.zAt((visibleIndex + 0.5) / seriesCount) : 0

      const points: THREE.Vector3[] = values.map((v, i) =>
        new THREE.Vector3(this.cartesian.xAtCategory(i), this.cartesian.yAt(v), zOffset)
      )
      const basePoints: THREE.Vector3[] = baseValues.map((v, i) =>
        new THREE.Vector3(this.cartesian.xAtCategory(i), this.cartesian.yAt(v), zOffset)
      )

      const smooth = series.smooth !== false
      const topPoints = smooth ? catmullRomSpline(points, 12, 0.5) : points
      const bottomPoints = smooth ? catmullRomSpline(basePoints, 12, 0.5) : basePoints

      // 生成面积面片（顶点色：顶亮底暗，或按 areaStyle.color 的渐变）
      const style = series.areaStyle ?? {}
      const gradientRange = resolveAreaGradient(style, color)
      const geometry = this.buildAreaGeometry(topPoints, bottomPoints, gradientRange)
      const material = new THREE.MeshStandardMaterial({
        vertexColors: true,
        color: new THREE.Color(0xffffff),
        roughness: style.roughness ?? 0.42,
        metalness: style.metalness ?? 0.15,
        transparent: true,
        opacity: style.opacity ?? 0.72,
        side: THREE.DoubleSide,
        emissive: style.emissive
          ? toThreeColor(style.emissive as ColorLike)
          : gradientRange.topColor.clone(),
        emissiveIntensity: style.emissiveIntensity ?? 0.1,
        envMapIntensity: 1.1,
        depthWrite: false,
      })
      applyVertexAlpha(material)
      this.resources.createUniqueMaterial(color, { preset: 'standard' })

      const mesh = new THREE.Mesh(geometry, material)
      mesh.castShadow = true
      mesh.receiveShadow = true
      mesh.name = '__vt_area'
      this.makePickable(mesh, {
        seriesIndex: seriesList.indexOf(series),
        dataIndex: 0,
        seriesName: series.name,
        name: series.name,
        value: values[0] ?? 0,
        color,
      })
      this.seriesGroup.add(mesh)

      /* ---------------------------- 顶部描边 ---------------------------- */
      if (series.showLine !== false) {
        const curve = new THREE.CatmullRomCurve3(topPoints, false, 'centripetal')
        const tubeGeo = new THREE.TubeGeometry(
          curve,
          Math.max(24, topPoints.length * 2),
          (series.lineStyle?.width ?? 3) * 0.011,
          8,
          false
        )
        this.resources.trackGeometry(tubeGeo)
        const tubeMat = this.resources.createMaterial(
          series.lineStyle?.color ? String(series.lineStyle.color) : color,
          {
            preset: 'standard',
            roughness: 0.25,
            metalness: 0.4,
            emissive: color,
            emissiveIntensity: 0.2,
          }
        )
        const line = new THREE.Mesh(tubeGeo, tubeMat)
        line.userData.__vtNoPick = true
        this.seriesGroup.add(line)
      }

      /* ------------------------------ 标签 ------------------------------ */
      const labelStyle = series.label ?? option.label
      if (labelStyle?.show) {
        points.forEach((point, i) => {
          const text = formatLabel(labelStyle, {
            value: values[i],
            name: names[i],
            seriesName: series.name,
            dataIndex: i,
            seriesIndex: seriesList.indexOf(series),
          })
          if (!text) return
          const anchor = new THREE.Object3D()
          anchor.position.set(point.x, point.y + (labelStyle.distance ?? 0.3), point.z)
          this.seriesGroup.add(anchor)
          this.createLabel(anchor, text, labelStyle)
        })
      }
      /* ------------------------------ 动画 ------------------------------ */
      // 面积面片从底部向上生长（几何体基准在 y=0）
      plan.scaleY(mesh, visibleIndex, 0.001, visibleIndex * 60)
    })

    // 统一启动动画并保持重绘
    plan.run()
    this.keepRenderingWhileAnimating()
  }

  /**
   * 由上边界与下边界构造面片几何体
   *
   * 顶点色为 4 分量（RGB + alpha），配合 `applyVertexAlpha` 实现上下渐变：
   * 顶部使用 `topColor`，底部使用 `bottomColor`，alpha 同步过渡。
   */
  private buildAreaGeometry(
    topPoints: THREE.Vector3[],
    bottomPoints: THREE.Vector3[],
    gradient: AreaGradientRange
  ): THREE.BufferGeometry {
    const count = Math.min(topPoints.length, bottomPoints.length)
    const positions: number[] = []
    const colors: number[] = []
    const indices: number[] = []

    for (let i = 0; i < count; i++) {
      const t = topPoints[i]
      const b = bottomPoints[i]
      positions.push(t.x, t.y, t.z)
      colors.push(gradient.topColor.r, gradient.topColor.g, gradient.topColor.b, gradient.topAlpha)
      positions.push(b.x, b.y, b.z)
      colors.push(
        gradient.bottomColor.r,
        gradient.bottomColor.g,
        gradient.bottomColor.b,
        gradient.bottomAlpha
      )
    }

    for (let i = 0; i < count - 1; i++) {
      const a = i * 2
      const b = i * 2 + 1
      const c = (i + 1) * 2
      const d = (i + 1) * 2 + 1
      indices.push(a, b, c)
      indices.push(c, b, d)
    }

    const geometry = new THREE.BufferGeometry()
    geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3))
    geometry.setAttribute('color', new THREE.Float32BufferAttribute(colors, 4))
    geometry.setIndex(indices)
    geometry.computeVertexNormals()
    return this.resources.trackGeometry(geometry)
  }
}

/* -------------------------------------------------------------------------- */
/*                              渐变解析与注入                                 */
/* -------------------------------------------------------------------------- */

/** 面积面片的上下两端颜色与透明度 */
interface AreaGradientRange {
  topColor: THREE.Color
  bottomColor: THREE.Color
  topAlpha: number
  bottomAlpha: number
}

/**
 * 解析面积图渐变色
 *
 * 优先级：
 * 1. `areaStyle.endColor`：用 `color → endColor` 构造竖向渐变
 * 2. `areaStyle.color` 是渐变字符串：按色标首尾取色
 * 3. 纯色：顶部实色、底部调暗（模拟被地面遮挡），保持原有观感
 * 4. `areaStyle.gradientOpacity` 可覆盖两端 alpha
 */
function resolveAreaGradient(
  style: { color?: ColorLike; endColor?: ColorLike; gradient?: string; gradientOpacity?: [number, number] },
  fallbackColor: string
): AreaGradientRange {
  const base = style.color ?? fallbackColor

  // 1. 显式 endColor
  if (style.endColor !== undefined && style.gradient !== 'none') {
    const spec = parseGradient(
      `linear-gradient(180deg, ${resolveColorToken(base)}, ${resolveColorToken(style.endColor)})`
    )
    if (spec) return fromSpec(spec, style.gradientOpacity)
  }

  // 2. color 本身就是渐变
  if (style.gradient !== 'none') {
    const spec = parseGradient(base)
    if (spec) return fromSpec(spec, style.gradientOpacity)
  }

  // 3. 纯色：顶白底灰的顶点色调制（保留原有效果），并给底部一点透明度
  const top = toThreeColor(base)
  const ga = style.gradientOpacity
  return {
    topColor: top.clone(),
    bottomColor: top.clone().multiplyScalar(0.55),
    topAlpha: ga ? Math.min(1, Math.max(0, ga[1])) : 1,
    bottomAlpha: ga ? Math.min(1, Math.max(0, ga[0])) : 0.35,
  }
}

function fromSpec(
  spec: { stops: Array<{ color: string; alpha?: number }> },
  gradientOpacity?: [number, number]
): AreaGradientRange {
  const top = sampleGradientAt(spec as never, 0)
  const bottom = sampleGradientAt(spec as never, 1)
  const ga = gradientOpacity
  return {
    topColor: top.color,
    bottomColor: bottom.color,
    topAlpha: ga ? Math.min(1, Math.max(0, ga[1])) : top.alpha,
    bottomAlpha: ga ? Math.min(1, Math.max(0, ga[0])) : bottom.alpha,
  }
}

/** 把任意颜色输入转换成能嵌入 CSS 渐变的颜色 token */
function resolveColorToken(input: ColorLike | undefined): string {
  if (input === undefined) return '#4f8cff'
  if (typeof input === 'number') return `#${input.toString(16).padStart(6, '0')}`
  return input
}

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
