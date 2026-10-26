/**
 * vis-3x — 3D 雷达图
 *
 * 多层数据以不同 Z 轴高度堆叠，形成「立体雷达」效果，
 * 每一层是一个多边形面片，带描边与顶点标记。
 */
import * as THREE from 'three'
import { ChartBase, type ResolvedChartOption } from '../core/ChartBase'
import type { Radar3DSeries } from '../types/series'
import type { RadarConfig } from '../types/axis'
import { formatLabel } from '../core/LabelManager'
import { degToRad, clamp } from '../utils/math'
import { splitAlpha, toThreeColor } from '../utils/color'

/** 雷达图实现 */
export class Radar3DChart extends ChartBase {

  get chartType(): string {
    return 'radar3D'
  }

  protected isNonCartesian(): boolean {
    return true
  }

  protected renderSeries(option: ResolvedChartOption): void {
    const seriesList = (option.series ?? []).filter((s) => s.type === 'radar3D') as Radar3DSeries[]
    if (!seriesList.length) return

    const radarConfig: RadarConfig = option.radar ?? {}
    const indicators = radarConfig.indicator ?? []

    // 若未提供 indicator，则从数据长度推断
    const dim =
      indicators.length ||
      Math.max(
        ...seriesList.map((s) => (s.data[0] ? (s.data[0].value?.length ?? 0) : 0)),
        0
      )
    if (dim < 3) return

    const radius = radarConfig.radius ?? 3.6
    const startAngle = radarConfig.startAngle ?? 90
    const splitNumber = radarConfig.splitNumber ?? 4
    const plan = this.createTransitionPlan(seriesList[0])

    /* --------------------------- 绘制蛛网 --------------------------- */
    this.buildGrid(radarConfig, indicators, dim, radius, startAngle, splitNumber)

    /* -------------------------- 绘制数据层 -------------------------- */
    const visible = seriesList.filter((s) => s.visible !== false)
    const layerGap = visible[0]?.layerGap ?? 0

    visible.forEach((series, seriesIndex) => {
      const colors = this.seriesColors(series, series.data.length)
      const zBase = visible.length > 1 ? seriesIndex * layerGap : 0

      series.data.forEach((item, dataIndex) => {
        const values = item.value ?? []
        if (values.length < 3) return
        const color = colors[dataIndex % colors.length]

        // 计算顶点
        const outerPoints: THREE.Vector3[] = values.map((value, i) => {
          const indicator = indicators[i]
          const max = indicator?.max ?? Math.max(...values, 1)
          const min = indicator?.min ?? 0
          const t = clamp((value - min) / (max - min || 1), 0, 1)
          const angle = degToRad(startAngle - (360 / dim) * i)
          const r = radius * t
          return new THREE.Vector3(Math.cos(angle) * r, 0, -Math.sin(angle) * r)
        })

        const centerPoint = new THREE.Vector3(0, 0, 0)

        /* ------------------------ 面片 ------------------------ */
        const faceGeo = this.buildFanGeometry(centerPoint, outerPoints, zBase)
        const areaStyle = series.areaStyle ?? {}
        const faceMat = new THREE.MeshStandardMaterial({
          color: toThreeColor(areaStyle.color ?? color),
          roughness: areaStyle.roughness ?? 0.4,
          metalness: areaStyle.metalness ?? 0.15,
          transparent: true,
          opacity: areaStyle.opacity ?? 0.5,
          side: THREE.DoubleSide,
          emissive: toThreeColor(areaStyle.emissive ?? color),
          emissiveIntensity: areaStyle.emissiveIntensity ?? 0.14,
          depthWrite: false,
        })
        this.resources.createUniqueMaterial(color, { preset: 'standard' })
        const face = new THREE.Mesh(faceGeo, faceMat)
        face.userData.__vtNoPick = true
        face.name = '__vt_radar_face'
        this.seriesGroup.add(face)

        /* ------------------------ 描边 ------------------------ */
        const loopPoints = [...outerPoints, outerPoints[0]]
        const lineGeo = new THREE.BufferGeometry().setFromPoints(loopPoints)
        this.resources.trackGeometry(lineGeo)
        const lineMat = new THREE.LineBasicMaterial({
          color: toThreeColor(series.lineStyle?.color ?? color),
          transparent: true,
          opacity: series.lineStyle?.opacity ?? 1,
          linewidth: series.lineStyle?.width ?? 2,
        })
        const outline = new THREE.Line(lineGeo, lineMat)
        outline.position.y = zBase + 0.004
        outline.userData.__vtNoPick = true
        this.seriesGroup.add(outline)

        /* ------------------------ 顶点 ------------------------ */
        if (series.showPoint !== false) {
          const pointSize = series.pointStyle?.size ?? 0.09
          outerPoints.forEach((point, i) => {
            const geo = this.resources.createSphere(pointSize, 12)
            const mat = this.resources.createMaterial(
              series.pointStyle?.color ? String(series.pointStyle.color) : color,
              {
                preset: 'standard',
                roughness: 0.2,
                metalness: 0.4,
                emissive: color,
                emissiveIntensity: 0.4,
              }
            )
            const sphere = new THREE.Mesh(geo, mat)
            sphere.position.copy(point)
            sphere.position.y = zBase
            sphere.name = '__vt_radar_point'
            this.makePickable(sphere, {
              seriesIndex,
              dataIndex: i,
              seriesName: series.name,
              name: indicators[i]?.name ?? `维度 ${i + 1}`,
              value: values[i],
              color,
            })
            this.seriesGroup.add(sphere)

            // 维度标签
            const labelStyle = series.label ?? option.label
            if (labelStyle?.show) {
              const anchor = new THREE.Object3D()
              anchor.position.set(point.x * 1.12, zBase, point.z * 1.12)
              this.seriesGroup.add(anchor)
              const text = formatLabel(labelStyle, {
                value: values[i],
                name: indicators[i]?.name ?? `维度 ${i + 1}`,
                seriesName: series.name,
                dataIndex: i,
                seriesIndex,
              })
              if (text) this.createLabel(anchor, text, labelStyle)
            }
          })
        }
        /* ------------------------ 动画 ------------------------ */
        // 雷达面片从中心向外扩张
        plan.scaleXZ(face, dataIndex, 0.001)
      })
    })

    // 统一启动动画并保持重绘
    plan.run()
    this.keepRenderingWhileAnimating()
  }

  /** 构建蛛网坐标系与维度名称 */
  private buildGrid(
    config: RadarConfig,
    indicators: Array<{ name?: string; max?: number }>,
    dim: number,
    radius: number,
    startAngle: number,
    splitNumber: number
  ): void {
    const group = new THREE.Group()
    group.name = '__vt_radar_grid'
    group.userData.__vtNoPick = true

    const axisColor = config.axisLine?.lineStyle?.color ?? this.theme.splitLineColor ?? '#334155'
    const splitColor = config.splitLine?.lineStyle?.color ?? this.theme.splitLineColor ?? '#1e293b'

    // 同心多边形（蛛网层）
    if (config.splitLine?.show !== false) {
      for (let level = 1; level <= splitNumber; level++) {
        const r = (radius * level) / splitNumber
        const pts: THREE.Vector3[] = []
        for (let i = 0; i < dim; i++) {
          const angle = degToRad(startAngle - (360 / dim) * i)
          pts.push(new THREE.Vector3(Math.cos(angle) * r, 0, -Math.sin(angle) * r))
        }
        pts.push(pts[0].clone())
        const geo = new THREE.BufferGeometry().setFromPoints(pts)
        this.resources.trackGeometry(geo)
        const mat = new THREE.LineBasicMaterial({
          color: toThreeColor(splitColor),
          transparent: true,
          opacity: config.splitLine?.lineStyle?.opacity ?? (level === splitNumber ? 0.7 : 0.3),
        })
        group.add(new THREE.Line(geo, mat))
      }
    }

    // 分割区域交替填充
    if (config.splitArea?.show) {
      const colors = config.splitArea.colors ?? ['rgba(255,255,255,0.03)', 'rgba(255,255,255,0.07)']
      for (let level = 0; level < splitNumber; level++) {
        const r0 = (radius * level) / splitNumber
        const r1 = (radius * (level + 1)) / splitNumber
        const positions: number[] = []
        const indices: number[] = []
        for (let i = 0; i < dim; i++) {
          const angle = degToRad(startAngle - (360 / dim) * i)
          positions.push(Math.cos(angle) * r0, 0, -Math.sin(angle) * r0)
          positions.push(Math.cos(angle) * r1, 0, -Math.sin(angle) * r1)
        }
        for (let i = 0; i < dim; i++) {
          const next = (i + 1) % dim
          const a = i * 2
          const b = a + 1
          const c = next * 2
          const d = c + 1
          indices.push(a, c, b)
          indices.push(b, c, d)
        }
        const geo = new THREE.BufferGeometry()
        geo.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3))
        geo.setIndex(indices)
        this.resources.trackGeometry(geo)
        const colorCss = colors[level % colors.length]
        // rgba() 的 alpha 需要交给材质 opacity，否则 Color 会忽略并告警
        const { color: areaColor, alpha } = splitAlpha(colorCss)
        const mat = this.resources.createMaterial(areaColor, {
          preset: 'basic',
          transparent: true,
          opacity: (config.splitArea.opacity ?? 1) * alpha,
          side: 'double',
          depthWrite: false,
        })
        const mesh = new THREE.Mesh(geo, mat)
        mesh.position.y = -0.01
        group.add(mesh)
      }
    }

    // 轴线与维度名称
    for (let i = 0; i < dim; i++) {
      const angle = degToRad(startAngle - (360 / dim) * i)
      const outer = new THREE.Vector3(Math.cos(angle) * radius, 0, -Math.sin(angle) * radius)

      if (config.axisLine?.show !== false) {
        const geo = new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(0, 0, 0), outer])
        this.resources.trackGeometry(geo)
        const mat = new THREE.LineBasicMaterial({
          color: toThreeColor(axisColor),
          transparent: true,
          opacity: config.axisLine?.lineStyle?.opacity ?? 0.5,
        })
        group.add(new THREE.Line(geo, mat))
      }

      // 维度名
      const indicator = indicators[i]
      const name = indicator?.name ?? `维度 ${i + 1}`
      if (config.axisLabel?.show !== false) {
        const anchor = new THREE.Object3D()
        anchor.position.set(
          Math.cos(angle) * (radius + 0.55),
          0.1,
          -Math.sin(angle) * (radius + 0.55)
        )
        group.add(anchor)
        this.createLabel(anchor, name, {
          show: true,
          textStyle: {
            color: config.nameStyle?.color ?? config.axisLabel?.textStyle?.color ?? '#cbd5e1',
            fontSize: config.nameStyle?.fontSize ?? 12,
            fontWeight: config.nameStyle?.fontWeight ?? 600,
            ...config.nameStyle,
            ...config.axisLabel?.textStyle,
          },
        })
      }
    }

    this.seriesGroup.add(group)
  }

  /** 由中心点与外围顶点构造扇形面片 */
  private buildFanGeometry(
    center: THREE.Vector3,
    outer: THREE.Vector3[],
    y: number
  ): THREE.BufferGeometry {
    const positions: number[] = []
    const indices: number[] = []

    positions.push(center.x, y, center.z)
    for (const p of outer) {
      positions.push(p.x, y, p.z)
    }
    for (let i = 0; i < outer.length; i++) {
      const next = (i + 1) % outer.length
      indices.push(0, i + 1, next + 1)
    }

    const geometry = new THREE.BufferGeometry()
    geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3))
    geometry.setIndex(indices)
    geometry.computeVertexNormals()
    return this.resources.trackGeometry(geometry)
  }
}
