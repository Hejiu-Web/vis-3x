/**
 * vis-3x — 3D 曲面图
 *
 * 特性：
 * - 高度按色带映射（顶点色，无需逐点材质）
 * - 可选平滑细分（双线性插值加密网格）
 * - 可选线框叠加 / 地面等高线投影
 * - 升起动画
 */
import * as THREE from 'three'
import { ChartBase, type ResolvedChartOption } from '../core/ChartBase'
import type { Surface3DSeries } from '../types/series'
import { DEFAULT_GRADIENT, createGradientSampler, toThreeColor } from '../utils/color'
import { catmullRomSpline, extent } from '../utils/math'

/** 曲面图实现 */
export class Surface3DChart extends ChartBase {

  get chartType(): string {
    return 'surface3D'
  }

  protected renderSeries(option: ResolvedChartOption): void {
    const seriesList = (option.series ?? []).filter(
      (s) => s.type === 'surface3D'
    ) as Surface3DSeries[]
    if (!seriesList.length) return
    const plan = this.createTransitionPlan(seriesList[0])

    for (let seriesIndex = 0; seriesIndex < seriesList.length; seriesIndex++) {
      const series = seriesList[seriesIndex]
      if (series.visible === false) continue
      const matrix = series.data
      if (!matrix.length || !matrix[0]?.length) continue

      const rows = matrix.length
      const cols = matrix[0].length

      // 数值范围
      const flat = matrix.flat().filter((v) => Number.isFinite(v))
      const [dataMin, dataMax] = extent(flat)
      const min = series.min ?? dataMin
      const max = series.max ?? dataMax
      const span = max - min || 1

      const gradient = series.colorGradient?.length ? series.colorGradient : DEFAULT_GRADIENT
      const sampler = createGradientSampler(gradient)

      // 网格尺寸
      const { gridWidth, gridDepth, gridHeight } = this.gridConfig
      const xStep = gridWidth / Math.max(1, cols - 1)
      const zStep = gridDepth / Math.max(1, rows - 1)

      // 高度缩放：让曲面最高点占据网格高度
      const heightScale = gridHeight / span

      // 构建几何体
      const subdivision = Math.max(1, series.smoothSubdivision ?? 1)
      const geometry = this.buildSurfaceGeometry({
        matrix,
        rows,
        cols,
        gridWidth,
        gridDepth,
        heightScale,
        min,
        sampler,
        subdivision,
        maxHeight: gridHeight,
      })

      const material = new THREE.MeshStandardMaterial({
        vertexColors: true,
        roughness: series.itemStyle?.roughness ?? 0.36,
        metalness: series.itemStyle?.metalness ?? 0.18,
        transparent: true,
        opacity: series.itemStyle?.opacity ?? 0.96,
        side: series.itemStyle?.side === 'front' ? THREE.FrontSide : THREE.DoubleSide,
        envMapIntensity: 1.15,
        flatShading: series.itemStyle?.flatShading ?? false,
        emissive: new THREE.Color(series.itemStyle?.emissive ? String(series.itemStyle.emissive) : '#000000'),
        emissiveIntensity: series.itemStyle?.emissiveIntensity ?? 0,
      })
      this.resources.createUniqueMaterial('#ffffff', { preset: 'standard' })

      const mesh = new THREE.Mesh(geometry, material)
      mesh.castShadow = true
      mesh.receiveShadow = true
      mesh.name = '__vt_surface'
      mesh.userData.__vtNoPick = true

      // 侧壁：让曲面看起来像一块「实体地形」
      const skirt = this.buildSkirtGeometry(matrix, {
        rows,
        cols,
        xStep,
        zStep,
        gridWidth,
        gridDepth,
        heightScale,
        min,
        sampler,
      })
      const skirtMat = new THREE.MeshStandardMaterial({
        color: new THREE.Color('#0f172a'),
        roughness: 0.7,
        metalness: 0.05,
        transparent: true,
        opacity: 0.78,
        side: THREE.DoubleSide,
      })
      const skirtMesh = new THREE.Mesh(skirt, skirtMat)
      skirtMesh.userData.__vtNoPick = true
      mesh.add(skirtMesh)

      this.seriesGroup.add(mesh)

      /* ---------------------------- 线框 ---------------------------- */
      if (series.wireframe?.show) {
        const step = Math.max(1, series.wireframe.step ?? 2)
        const wireGeo = this.buildWireframe({
          matrix,
          rows,
          cols,
          gridWidth,
          gridDepth,
          heightScale,
          min,
          step,
        })
        const wireMat = new THREE.LineBasicMaterial({
          color: toThreeColor(series.wireframe.color ?? '#e2e8f0'),
          transparent: true,
          opacity: series.wireframe.opacity ?? 0.22,
          depthWrite: false,
        })
        const wire = new THREE.LineSegments(wireGeo, wireMat)
        wire.userData.__vtNoPick = true
        wire.position.y = 0.012
        mesh.add(wire)
      }

      /* --------------------------- 等高线 --------------------------- */
      if (series.contour?.show) {
        this.buildContours({
          matrix,
          rows,
          cols,
          gridWidth,
          gridDepth,
          heightScale,
          min,
          span,
          levels: series.contour.levels ?? 6,
          opacity: series.contour.opacity ?? 0.35,
          gradient,
        })
      }

      /* ---------------------------- 动画 ---------------------------- */
      if (plan.animationsEnabled) {
        // 曲面从扁平状态升起
        plan.scaleY(mesh, 0, 0.001)
      }

      /* ---------------------------- 标签 ---------------------------- */
      const labelStyle = series.label ?? option.label
      if (labelStyle?.show) {
        const stride = Math.max(1, Math.ceil(cols / 8))
        for (let r = 0; r < rows; r += stride) {
          for (let c = 0; c < cols; c += stride) {
            const value = matrix[r][c]
            if (!Number.isFinite(value)) continue
            const x = -gridWidth / 2 + c * xStep
            const z = -gridDepth / 2 + (rows - 1 - r) * zStep
            const y = (value - min) * heightScale
            const anchor = new THREE.Object3D()
            anchor.position.set(x, y + 0.3, z)
            this.seriesGroup.add(anchor)
            this.createLabel(
              anchor,
              labelStyle.formatter
                ? typeof labelStyle.formatter === 'function'
                  ? labelStyle.formatter({
                      value,
                      dataIndex: r * cols + c,
                      seriesIndex,
                      seriesName: series.name,
                    })
                  : String(labelStyle.formatter).replace(/\{value\}/g, String(value))
                : String(Math.round(value * 100) / 100),
              labelStyle
            )
          }
        }
      }
    }

    // 统一启动动画并保持重绘
    plan.run()
    this.keepRenderingWhileAnimating()
  }

  /** 构建曲面几何体（含顶点色） */
  private buildSurfaceGeometry(params: {
    matrix: number[][]
    rows: number
    cols: number
    gridWidth: number
    gridDepth: number
    heightScale: number
    min: number
    sampler: (t: number) => THREE.Color
    subdivision: number
    maxHeight: number
  }): THREE.BufferGeometry {
    const {
      matrix,
      rows,
      cols,
      gridWidth,
      gridDepth,
      heightScale,
      min,
      sampler,
      subdivision,
      maxHeight,
    } = params

    // 细分：对原始矩阵做双线性插值
    const rCount = (rows - 1) * subdivision + 1
    const cCount = (cols - 1) * subdivision + 1

    const sampleAt = (r: number, c: number): number => {
      const r0 = Math.min(rows - 1, Math.floor(r / subdivision))
      const c0 = Math.min(cols - 1, Math.floor(c / subdivision))
      const r1 = Math.min(rows - 1, r0 + 1)
      const c1 = Math.min(cols - 1, c0 + 1)
      const fr = (r / subdivision) - r0
      const fc = (c / subdivision) - c0
      const v00 = Number.isFinite(matrix[r0]?.[c0]) ? matrix[r0][c0] : min
      const v01 = Number.isFinite(matrix[r0]?.[c1]) ? matrix[r0][c1] : min
      const v10 = Number.isFinite(matrix[r1]?.[c0]) ? matrix[r1][c0] : min
      const v11 = Number.isFinite(matrix[r1]?.[c1]) ? matrix[r1][c1] : min
      const top = v00 + (v01 - v00) * fc
      const bottom = v10 + (v11 - v10) * fc
      return top + (bottom - top) * fr
    }

    const positions: number[] = []
    const colors: number[] = []
    const indices: number[] = []
    const uvs: number[] = []

    for (let r = 0; r < rCount; r++) {
      for (let c = 0; c < cCount; c++) {
        const value = sampleAt(r, c)
        const x = -gridWidth / 2 + (c / (cCount - 1)) * gridWidth
        // 行索引 0 对应 Z 轴正方向（靠近观察者）
        const z = gridDepth / 2 - (r / (rCount - 1)) * gridDepth
        const y = (value - min) * heightScale
        positions.push(x, y, z)

        const t = (value - min) / (this.surfaceSpan(matrix) || 1)
        const color = sampler(Math.min(1, Math.max(0, t)))
        colors.push(color.r, color.g, color.b)
        uvs.push(c / (cCount - 1), r / (rCount - 1))
      }
    }

    for (let r = 0; r < rCount - 1; r++) {
      for (let c = 0; c < cCount - 1; c++) {
        const a = r * cCount + c
        const b = a + 1
        const cc = a + cCount
        const d = cc + 1
        indices.push(a, cc, b)
        indices.push(b, cc, d)
      }
    }

    const geometry = new THREE.BufferGeometry()
    geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3))
    geometry.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3))
    geometry.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2))
    geometry.setIndex(indices)
    geometry.computeVertexNormals()
    void maxHeight
    return this.resources.trackGeometry(geometry)
  }

  /** 计算矩阵数值跨度 */
  private surfaceSpan(matrix: number[][]): number {
    const flat = matrix.flat().filter((v) => Number.isFinite(v))
    const [min, max] = extent(flat)
    return max - min
  }

  /** 构建侧壁（四周垂下的裙边） */
  private buildSkirtGeometry(
    matrix: number[][],
    params: {
      rows: number
      cols: number
      xStep: number
      zStep: number
      gridWidth: number
      gridDepth: number
      heightScale: number
      min: number
      sampler: (t: number) => THREE.Color
    }
  ): THREE.BufferGeometry {
    const { rows, cols, gridWidth, gridDepth, heightScale, min, sampler } = params
    const span = this.surfaceSpan(matrix) || 1
    const positions: number[] = []
    const colors: number[] = []
    const indices: number[] = []
    let vertexCount = 0

    const pushVertex = (x: number, y: number, z: number, t: number) => {
      positions.push(x, y, z)
      const c = sampler(Math.min(1, Math.max(0, t)))
      colors.push(c.r * 0.45, c.g * 0.45, c.b * 0.45)
      return vertexCount++
    }

    const valueAt = (r: number, c: number): number =>
      Number.isFinite(matrix[r]?.[c]) ? matrix[r][c] : min

    // 四条边分别生成条带
    const edges: Array<Array<[number, number]>> = [
      // 前排（r = rows-1）
      Array.from({ length: cols }, (_, c) => [rows - 1, c] as [number, number]),
      // 后排（r = 0）
      Array.from({ length: cols }, (_, c) => [0, cols - 1 - c] as [number, number]),
      // 左边（c = 0）
      Array.from({ length: rows }, (_, r) => [rows - 1 - r, 0] as [number, number]),
      // 右边（c = cols-1）
      Array.from({ length: rows }, (_, r) => [r, cols - 1] as [number, number]),
    ]

    for (const edge of edges) {
      const startIndex = vertexCount
      for (const [r, c] of edge) {
        const value = valueAt(r, c)
        const x = -gridWidth / 2 + (c / Math.max(1, cols - 1)) * gridWidth
        const z = gridDepth / 2 - (r / Math.max(1, rows - 1)) * gridDepth
        const y = (value - min) * heightScale
        const t = (value - min) / span
        pushVertex(x, y, z, t)
        pushVertex(x, 0, z, t * 0.2)
      }
      for (let i = 0; i < edge.length - 1; i++) {
        const a = startIndex + i * 2
        const b = a + 1
        const c2 = a + 2
        const d = a + 3
        indices.push(a, b, c2)
        indices.push(c2, b, d)
      }
    }

    const geometry = new THREE.BufferGeometry()
    geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3))
    geometry.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3))
    geometry.setIndex(indices)
    geometry.computeVertexNormals()
    return this.resources.trackGeometry(geometry)
  }

  /** 构建线框 */
  private buildWireframe(params: {
    matrix: number[][]
    rows: number
    cols: number
    gridWidth: number
    gridDepth: number
    heightScale: number
    min: number
    step: number
  }): THREE.BufferGeometry {
    const { matrix, rows, cols, gridWidth, gridDepth, heightScale, min, step } = params
    const positions: number[] = []

    const coord = (r: number, c: number): THREE.Vector3 => {
      const value = Number.isFinite(matrix[r]?.[c]) ? matrix[r][c] : min
      return new THREE.Vector3(
        -gridWidth / 2 + (c / Math.max(1, cols - 1)) * gridWidth,
        (value - min) * heightScale,
        gridDepth / 2 - (r / Math.max(1, rows - 1)) * gridDepth
      )
    }

    // 横向线
    for (let r = 0; r < rows; r += step) {
      const pts: THREE.Vector3[] = []
      for (let c = 0; c < cols; c++) pts.push(coord(r, c))
      const smooth = catmullRomSpline(pts, 4, 0.5)
      for (let i = 0; i < smooth.length - 1; i++) {
        positions.push(smooth[i].x, smooth[i].y, smooth[i].z)
        positions.push(smooth[i + 1].x, smooth[i + 1].y, smooth[i + 1].z)
      }
    }
    // 纵向线
    for (let c = 0; c < cols; c += step) {
      const pts: THREE.Vector3[] = []
      for (let r = 0; r < rows; r++) pts.push(coord(r, c))
      const smooth = catmullRomSpline(pts, 4, 0.5)
      for (let i = 0; i < smooth.length - 1; i++) {
        positions.push(smooth[i].x, smooth[i].y, smooth[i].z)
        positions.push(smooth[i + 1].x, smooth[i + 1].y, smooth[i + 1].z)
      }
    }

    const geometry = new THREE.BufferGeometry()
    geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3))
    return this.resources.trackGeometry(geometry)
  }

  /** 构建地面等高线投影 */
  private buildContours(params: {
    matrix: number[][]
    rows: number
    cols: number
    gridWidth: number
    gridDepth: number
    heightScale: number
    min: number
    span: number
    levels: number
    opacity: number
    gradient: string[]
  }): void {
    const {
      matrix,
      rows,
      cols,
      gridWidth,
      gridDepth,
      min,
      span,
      levels,
      opacity,
      gradient,
    } = params

    for (let level = 1; level < levels; level++) {
      const threshold = min + (span * level) / levels
      const positions: number[] = []

      // Marching squares 简化版：只处理边相交
      const get = (r: number, c: number) =>
        Number.isFinite(matrix[r]?.[c]) ? matrix[r][c] : min

      for (let r = 0; r < rows - 1; r++) {
        for (let c = 0; c < cols - 1; c++) {
          const v00 = get(r, c)
          const v01 = get(r, c + 1)
          const v10 = get(r + 1, c)
          const v11 = get(r + 1, c + 1)

          const edges: Array<[THREE.Vector3, THREE.Vector3]> = []

          const interp = (
            v1: number,
            v2: number,
            p1: THREE.Vector3,
            p2: THREE.Vector3
          ): THREE.Vector3 | null => {
            if ((v1 - threshold) * (v2 - threshold) > 0) return null
            const t = (threshold - v1) / (v2 - v1 || 1)
            return p1.clone().lerp(p2, t)
          }

          const p00 = new THREE.Vector3(
            -gridWidth / 2 + (c / (cols - 1)) * gridWidth,
            0,
            gridDepth / 2 - (r / (rows - 1)) * gridDepth
          )
          const p01 = new THREE.Vector3(
            -gridWidth / 2 + ((c + 1) / (cols - 1)) * gridWidth,
            0,
            gridDepth / 2 - (r / (rows - 1)) * gridDepth
          )
          const p10 = new THREE.Vector3(
            -gridWidth / 2 + (c / (cols - 1)) * gridWidth,
            0,
            gridDepth / 2 - ((r + 1) / (rows - 1)) * gridDepth
          )
          const p11 = new THREE.Vector3(
            -gridWidth / 2 + ((c + 1) / (cols - 1)) * gridWidth,
            0,
            gridDepth / 2 - ((r + 1) / (rows - 1)) * gridDepth
          )

          const points: THREE.Vector3[] = []
          const e1 = interp(v00, v01, p00, p01)
          if (e1) points.push(e1)
          const e2 = interp(v01, v11, p01, p11)
          if (e2) points.push(e2)
          const e3 = interp(v11, v10, p11, p10)
          if (e3) points.push(e3)
          const e4 = interp(v10, v00, p10, p00)
          if (e4) points.push(e4)

          if (points.length >= 2) {
            edges.push([points[0], points[1]])
          }
          for (const [a, b] of edges) {
            positions.push(a.x, a.y, a.z, b.x, b.y, b.z)
          }
        }
      }

      if (!positions.length) continue
      const geometry = new THREE.BufferGeometry()
      geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3))
      this.resources.trackGeometry(geometry)
      const material = new THREE.LineBasicMaterial({
        color: new THREE.Color(gradient[Math.min(gradient.length - 1, level)] ?? '#94a3b8'),
        transparent: true,
        opacity,
        depthWrite: false,
      })
      const line = new THREE.LineSegments(geometry, material)
      line.position.y = 0.01
      line.userData.__vtNoPick = true
      this.seriesGroup.add(line)
    }
  }
}
