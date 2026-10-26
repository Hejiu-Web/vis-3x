/**
 * vis-3x — 场景环境（地面网格、背景墙、坐标轴、刻度与标签）
 *
 * 这部分决定了图表的「空间感」：没有环境时，3D 柱状图会像漂浮在虚空里。
 */
import * as THREE from 'three'
import type { GridFloorConfig } from '../types/environment'
import type { Axis3D, SplitLine } from '../types/axis'
import type { Cartesian3D } from './Cartesian3D'
import type { ResourceManager } from './ResourceManager'
import type { LabelManager } from './LabelManager'
import type { ThemeConfig } from '../types/environment'
import { formatNumber } from './LabelManager'
import { toCssColor, withAlpha } from '../utils/color'
import { niceTicks, clamp } from '../utils/math'

/** 环境构建参数 */
export interface SceneEnvironmentOptions {
  cartesian: Cartesian3D
  resources: ResourceManager
  labels: LabelManager
  gridFloor?: GridFloorConfig
  theme?: ThemeConfig
  axisStyle?: {
    axisLine?: Axis3D['axisLine']
    axisLabel?: Axis3D['axisLabel']
    splitLine?: Axis3D['splitLine']
  }
  showCoordinate?: boolean
  xAxis?: Axis3D
  yAxis?: Axis3D
  zAxis?: Axis3D
}

const LABEL_GROUP = 'axis'

/**
 * 场景环境构建器
 */
export class SceneEnvironment {
  /** 环境对象统一挂载于此 */
  readonly group = new THREE.Group()

  private cartesian: Cartesian3D
  private resources: ResourceManager
  private labels: LabelManager
  private theme: ThemeConfig
  private options: SceneEnvironmentOptions

  constructor(options: SceneEnvironmentOptions) {
    this.options = options
    this.cartesian = options.cartesian
    this.resources = options.resources
    this.labels = options.labels
    this.theme = options.theme ?? {}
    this.group.name = '__vt_environment'
  }

  /**
   * 构建全部环境内容（会先清空）
   *
   * @param overrides 本次构建使用的配置（由 ChartBase 传入解析后的配置）
   */
  build(overrides?: Partial<SceneEnvironmentOptions> & { showCoordinate?: boolean }): void {
    this.clear()
    if (overrides) {
      this.options = { ...this.options, ...overrides }
      this.theme = this.options.theme ?? this.theme
    }

    const gridFloor = this.options.gridFloor ?? {}
    const showCoordinate = this.options.showCoordinate ?? true

    if (showCoordinate) {
      this.buildGridFloor(gridFloor)
      this.buildAxes()
    } else if (gridFloor.show) {
      // 即使不显示坐标轴，也可以只显示地面网格
      this.buildGridFloor(gridFloor)
    }
  }

  /* ------------------------------------------------------------------ */
  /*                              地面网格                               */
  /* ------------------------------------------------------------------ */

  private buildGridFloor(config: GridFloorConfig): void {
    const { gridWidth, gridDepth } = this.cartesian.config
    const show = config.show ?? true
    const wallColor = config.wallColor ?? this.theme.splitLineColor ?? '#2a3550'

    // 阴影承接面：接收阴影，让柱子「站」在地面上
    if (config.showShadowPlane ?? true) {
      const planeGeo = this.resources.createPlane(gridWidth * 1.02, gridDepth * 1.02)
      const planeMat = this.resources.createMaterial('#0b1220', {
        preset: 'standard',
        opacity: config.shadowPlaneOpacity ?? 0.55,
        transparent: true,
        roughness: 1,
        metalness: 0,
        color: config.shadowPlaneColor ?? '#0b1220',
        depthWrite: false,
      })
      const plane = new THREE.Mesh(planeGeo, planeMat)
      plane.rotation.x = -Math.PI / 2
      plane.position.y = 0.002
      plane.receiveShadow = true
      plane.name = '__vt_shadow_plane'
      this.group.add(plane)
    }

    if (!show) return

    const color = toCssColor(config.color ?? this.theme.splitLineColor ?? '#33415c')
    const divisions = config.divisions ?? 10

    // 使用自定义 GridHelper 以精确匹配网格宽深
    const grid = this.createGrid(gridWidth, gridDepth, divisions, color)
    grid.position.y = 0.004
    grid.name = '__vt_grid'
    this.group.add(grid)

    // 背景墙：提升空间纵深感
    if (config.showWall) {
      const wallOpacity = config.wallOpacity ?? 0.16
      const wallMat = this.resources.createMaterial(wallColor, {
        preset: 'basic',
        transparent: true,
        opacity: wallOpacity,
        side: 'double',
        depthWrite: false,
      })
      // 左后墙
      const backGeo = this.resources.createPlane(gridWidth, this.cartesian.config.gridHeight)
      const backWall = new THREE.Mesh(backGeo, wallMat)
      backWall.position.set(0, this.cartesian.config.gridHeight / 2, -gridDepth / 2)
      backWall.name = '__vt_wall_back'
      this.group.add(backWall)

      // 左侧墙
      const leftGeo = this.resources.createPlane(gridDepth, this.cartesian.config.gridHeight)
      const leftWall = new THREE.Mesh(leftGeo, wallMat)
      leftWall.rotation.y = Math.PI / 2
      leftWall.position.set(-gridWidth / 2, this.cartesian.config.gridHeight / 2, 0)
      leftWall.name = '__vt_wall_left'
      this.group.add(leftWall)
    }
  }

  /**
   * 生成地面网格线
   *
   * 不使用 GridHelper：其尺寸为正方形，无法匹配非等比的网格宽深。
   */
  private createGrid(
    width: number,
    depth: number,
    divisions: number,
    color: string
  ): THREE.LineSegments {
    const positions: number[] = []
    const halfW = width / 2
    const halfD = depth / 2
    const xStep = width / divisions
    const zStep = depth / divisions

    // 沿 Z 方向的线（平行于 Z 轴）
    for (let i = 0; i <= divisions; i++) {
      const x = -halfW + i * xStep
      positions.push(x, 0, -halfD, x, 0, halfD)
    }
    // 沿 X 方向的线（平行于 X 轴）
    for (let i = 0; i <= divisions; i++) {
      const z = -halfD + i * zStep
      positions.push(-halfW, 0, z, halfW, 0, z)
    }

    const geometry = new THREE.BufferGeometry()
    geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3))
    this.resources.trackGeometry(geometry)

    const material = new THREE.LineBasicMaterial({
      color: new THREE.Color(color),
      transparent: true,
      opacity: 0.55,
      depthWrite: false,
    })
    const lines = new THREE.LineSegments(geometry, material)
    // 材质登记到资源管理器
    this.resources.createUniqueMaterial(color, { preset: 'basic' })
    return lines
  }

  /* ------------------------------------------------------------------ */
  /*                                坐标轴                               */
  /* ------------------------------------------------------------------ */

  private buildAxes(): void {
    const { gridWidth, gridHeight, gridDepth } = this.cartesian.config
    const halfW = gridWidth / 2
    const halfD = gridDepth / 2

    const axisColor =
      this.theme.axisColor ?? this.options.axisStyle?.axisLine?.lineStyle?.color ?? '#64748b'

    const xAxis = { ...this.options.axisStyle, ...this.options.xAxis }
    const yAxis = { ...this.options.axisStyle, ...this.options.yAxis }
    const zAxis = { ...this.options.axisStyle, ...this.options.zAxis }

    const showX = xAxis.show !== false
    const showY = yAxis.show !== false
    const showZ = zAxis.show !== false

    /* ------------------------ 轴线（网格边框） ------------------------ */
    const lineMat = this.resources.createUniqueMaterial(axisColor, {
      preset: 'basic',
      opacity: 0.85,
      transparent: true,
    }) as THREE.LineBasicMaterial
    const lineMatColor = new THREE.Color(toCssColor(axisColor))

    const makeLine = (
      from: [number, number, number],
      to: [number, number, number],
      color = lineMatColor,
      opacity = 0.85
    ): THREE.Line => {
      const geometry = new THREE.BufferGeometry().setFromPoints([
        new THREE.Vector3(...from),
        new THREE.Vector3(...to),
      ])
      this.resources.trackGeometry(geometry)
      const material = new THREE.LineBasicMaterial({
        color,
        transparent: opacity < 1,
        opacity,
        depthWrite: false,
      })
      return new THREE.Line(geometry, material)
    }

    void lineMat

    // X 轴线（沿前边缘）
    if (showX) {
      this.group.add(makeLine([-halfW, 0, halfD], [halfW, 0, halfD]))
    }
    // Z 轴线（沿右边缘）
    if (showZ) {
      this.group.add(makeLine([halfW, 0, halfD], [halfW, 0, -halfD]))
    }
    // Y 轴竖线（左前角）
    if (showY) {
      const yLine = makeLine([-halfW, 0, halfD], [-halfW, gridHeight, halfD])
      this.group.add(yLine)
      // Y 轴背面竖线，增强立体框架感
      this.group.add(makeLine([halfW, 0, -halfD], [halfW, gridHeight, -halfD], lineMatColor, 0.35))
    }

    /* --------------------------- Y 轴刻度 --------------------------- */
    const yTicks = this.getYTicks(yAxis)
    for (const tick of yTicks) {
      const y = this.cartesian.yAt(tick)
      if (y < -1e-6 || y > gridHeight + 1e-6) continue

      // 刻度线
      if (yAxis.axisTick?.show !== false) {
        const tickLen = yAxis.axisTick?.length ?? 0.12
        this.group.add(makeLine([-halfW, y, halfD], [-halfW - tickLen, y, halfD], lineMatColor, 0.7))
      }

      // 数值标签
      if (yAxis.axisLabel?.show !== false) {
        const text = this.formatAxisValue(tick, yAxis)
        const anchor = new THREE.Object3D()
        anchor.position.set(-halfW - 0.45, y, halfD)
        anchor.name = `__vt_ylabel_${tick}`
        this.group.add(anchor)
        this.labels.create({
          object: anchor,
          text,
          group: LABEL_GROUP,
          style: {
            show: true,
            textStyle: {
              color: yAxis.axisLabel?.textStyle?.color ?? this.theme.textColor ?? '#94a3b8',
              fontSize: yAxis.axisLabel?.textStyle?.fontSize ?? 11,
              ...yAxis.axisLabel?.textStyle,
            },
            offset: [-(yAxis.axisLabel?.margin ?? 0), 0],
          },
        })
      }
    }

    /* --------------------------- X 轴刻度和标签 --------------------- */
    if (showX && xAxis.axisLabel?.show !== false) {
      const count = this.cartesian.categoryCount
      // 类目太多时自动抽稀，避免标签重叠
      const stride = Math.max(1, Math.ceil(count / 14))
      const showTick = xAxis.axisTick?.show !== false
      const tickLen = xAxis.axisTick?.length ?? 0.16

      for (let i = 0; i < count; i += stride) {
        const x = this.cartesian.xAtCategory(i)

        // 刻度线：从网格前边缘向外伸出，让标签与类目产生视觉关联
        if (showTick) {
          this.group.add(
            makeLine([x, 0, halfD], [x, 0, halfD + tickLen], lineMatColor, 0.55)
          )
        }

        const anchor = new THREE.Object3D()
        anchor.position.set(x, 0, halfD + 0.5)
        anchor.name = `__vt_xlabel_${i}`
        this.group.add(anchor)
        const raw = this.cartesian.categoryName(i)
        const text = xAxis.axisLabel?.formatter
          ? xAxis.axisLabel.formatter(raw, i)
          : String(raw)
        this.labels.create({
          object: anchor,
          text,
          group: LABEL_GROUP,
          style: {
            show: true,
            textStyle: {
              color: xAxis.axisLabel?.textStyle?.color ?? this.theme.textColor ?? '#94a3b8',
              fontSize: xAxis.axisLabel?.textStyle?.fontSize ?? 11,
              ...xAxis.axisLabel?.textStyle,
            },
          },
        })
      }
    }

    /* --------------------------- Z 轴标签 -------------------------- */
    if (showZ && zAxis.axisLabel?.show !== false && this.cartesian.zAxis.categories.length) {
      const zCount = this.cartesian.zAxis.categories.length
      for (let i = 0; i < zCount; i++) {
        const z = this.cartesian.zAt(i)
        const anchor = new THREE.Object3D()
        anchor.position.set(halfW + 0.55, 0, z)
        anchor.name = `__vt_zlabel_${i}`
        this.group.add(anchor)
        const raw = this.cartesian.zAxis.categories[i]
        const text = zAxis.axisLabel?.formatter ? zAxis.axisLabel.formatter(raw, i) : String(raw)
        this.labels.create({
          object: anchor,
          text,
          group: LABEL_GROUP,
          style: {
            show: true,
            textStyle: {
              color: zAxis.axisLabel?.textStyle?.color ?? this.theme.textColor ?? '#94a3b8',
              fontSize: zAxis.axisLabel?.textStyle?.fontSize ?? 11,
              ...zAxis.axisLabel?.textStyle,
            },
          },
        })
      }
    }

    /* --------------------------- 轴名称 ---------------------------- */
    this.addAxisName(xAxis, 'x')
    this.addAxisName(yAxis, 'y')
    this.addAxisName(zAxis, 'z')

    /* ------------------------ 分割线（水平网格面） ------------------- */
    this.buildSplitLines(yAxis.splitLine, xAxis.splitLine)
  }

  /** 生成 Y 轴刻度值 */
  private getYTicks(yAxis: Axis3D): number[] {
    const [min, max] = this.cartesian.yAxis.domain
    const splitLine: SplitLine | undefined = yAxis.splitLine
    const count = splitLine?.splitNumber ?? 5
    if (yAxis.interval && yAxis.interval > 0) {
      const out: number[] = []
      const start = Math.ceil(min / yAxis.interval) * yAxis.interval
      for (let v = start; v <= max + 1e-9 && out.length < 200; v += yAxis.interval) {
        out.push(Math.round(v * 1e6) / 1e6)
      }
      return out
    }
    return niceTicks(min, max, count)
  }

  /** 格式化轴数值 */
  private formatAxisValue(value: number, axis: Axis3D): string {
    if (axis.axisLabel?.formatter) return axis.axisLabel.formatter(value, 0)
    return formatNumber(value, {
      precision: axis.axisLabel?.precision,
      abbreviate: axis.axisLabel?.abbreviate ?? Math.abs(value) >= 10000,
    })
  }

  /** 轴名称标签 */
  private addAxisName(axis: Axis3D, dimension: 'x' | 'y' | 'z'): void {
    const name = axis.nameStyle?.text ?? axis.name
    if (!name || axis.nameStyle?.show === false) return

    const { gridWidth, gridHeight, gridDepth } = this.cartesian.config
    // 偏移量按网格尺度自适应，避免在窄网格上标签飞出画布
    const gapX = Math.max(0.7, gridWidth * 0.09)
    const gapY = Math.max(0.45, gridHeight * 0.08)
    const anchor = new THREE.Object3D()
    if (dimension === 'x') {
      anchor.position.set(gridWidth / 2 + gapX, 0, gridDepth / 2 + gapY)
    } else if (dimension === 'y') {
      // 放在最高刻度之上，避免与顶部刻度数值标签重叠
      const topTickY = Math.max(
        this.cartesian.yAt(this.cartesian.yAxis.domain[1]),
        gridHeight
      )
      anchor.position.set(-gridWidth / 2 - gapX * 0.9, topTickY + gapY * 1.5, gridDepth / 2)
    } else {
      anchor.position.set(gridWidth / 2 + gapX, 0, -gridDepth / 2 - gapY)
    }
    anchor.name = `__vt_axisname_${dimension}`
    this.group.add(anchor)

    const ts = axis.nameStyle?.textStyle ?? {}
    this.labels.create({
      object: anchor,
      text: name,
      group: LABEL_GROUP,
      style: {
        show: true,
        textStyle: {
          color: ts.color ?? this.theme.textColor ?? '#cbd5e1',
          fontSize: ts.fontSize ?? 12,
          fontWeight: ts.fontWeight ?? 600,
          ...ts,
        },
      },
    })
  }

  /* ------------------------------------------------------------------ */
  /*                               分割线面                              */
  /* ------------------------------------------------------------------ */

  private buildSplitLines(splitLine?: SplitLine, xSplitLine?: SplitLine): void {
    const config = splitLine ?? xSplitLine
    if (config?.show === false) return
    if (!config) return

    const { gridWidth, gridDepth } = this.cartesian.config
    const halfW = gridWidth / 2
    const halfD = gridDepth / 2
    const color = toCssColor(config.lineStyle?.color ?? this.theme.splitLineColor ?? '#334155')
    const opacity = config.lineStyle?.opacity ?? 0.32

    const yTicks = this.getYTicks(this.options.yAxis ?? {})

    for (const tick of yTicks) {
      const y = this.cartesian.yAt(tick)
      if (y <= 1e-6) continue // 地面已有网格
      const geometry = new THREE.BufferGeometry().setFromPoints([
        new THREE.Vector3(-halfW, y, -halfD),
        new THREE.Vector3(halfW, y, -halfD),
        new THREE.Vector3(halfW, y, halfD),
        new THREE.Vector3(-halfW, y, halfD),
        new THREE.Vector3(-halfW, y, -halfD),
      ])
      this.resources.trackGeometry(geometry)
      const material = new THREE.LineBasicMaterial({
        color: new THREE.Color(color),
        transparent: true,
        opacity,
        depthWrite: false,
      })
      const line = new THREE.Line(geometry, material)
      line.name = `__vt_splitline_${tick}`
      this.group.add(line)
    }

    // 交替背景色带（可选）
    if (config.showSplitArea && config.splitAreaColors?.length) {
      const colors = config.splitAreaColors
      for (let i = 0; i < yTicks.length - 1; i++) {
        const y0 = this.cartesian.yAt(yTicks[i])
        const y1 = this.cartesian.yAt(yTicks[i + 1])
        const h = Math.abs(y1 - y0)
        if (h < 1e-6) continue
        const geo = this.resources.createPlane(gridWidth, h)
        const colorCss = toCssColor(colors[i % colors.length])
        const mat = this.resources.createMaterial(colorCss, {
          preset: 'basic',
          transparent: true,
          opacity: 0.6,
          side: 'double',
          depthWrite: false,
        })
        const band = new THREE.Mesh(geo, mat)
        band.rotation.x = -Math.PI / 2
        band.position.set(0, Math.min(y0, y1) + h / 2, 0)
        band.name = `__vt_splitarea_${i}`
        this.group.add(band)
      }
    }
  }

  /* ------------------------------------------------------------------ */
  /*                                清理                                 */
  /* ------------------------------------------------------------------ */

  /** 清空环境对象与标签 */
  clear(): void {
    this.labels.clearGroup(LABEL_GROUP)
    for (const child of [...this.group.children]) {
      this.group.remove(child)
      this.disposeObject(child)
    }
  }

  /** 递归释放对象资源 */
  private disposeObject(object: THREE.Object3D): void {
    object.traverse((node) => {
      const mesh = node as THREE.Mesh
      if (mesh.geometry) {
        this.resources.disposeGeometry(mesh.geometry as THREE.BufferGeometry)
      }
      const material = mesh.material
      if (material) {
        const mats = Array.isArray(material) ? material : [material]
        for (const m of mats) {
          this.resources.disposeMaterial(m)
        }
      }
    })
  }

  dispose(): void {
    this.clear()
  }
}

/** 生成地面阴影承接面的颜色（供外部复用） */
export function shadowPlaneColor(base: string): string {
  return withAlpha(base, clamp(0.5, 0, 1))
}
