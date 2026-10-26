/**
 * vis-3x — 3D 仪表盘
 *
 * 由「外壳环带 + 进度弧 + 指针 + 刻度 + 中心数值」组成。
 *
 * ## 坐标约定（重要）
 *
 * 所有元素统一在 **XY 平面**上构建，沿 **+Z 方向挤出厚度**：
 *
 * - 环带：`(cos θ · r, sin θ · r)` 画在 XY，挤出到 `z ∈ [0, depth]`
 * - 刻度线：同样在 XY 平面，`z = depth + epsilon`（贴在环带前面）
 * - 指针：画在 XY 平面，绕 **Z 轴**旋转
 * - 标签：`(cos θ · r, sin θ · r, depth)`，与环带同平面
 *
 * 这样从正面（+Z 视角）看就是一个规整、平齐的仪表盘；
 * 旋转视角时所有元素一起呈现立体厚度，不会出现「指针飘在环外」的错位。
 */
import * as THREE from 'three'
import { ChartBase, type ResolvedChartOption } from '../core/ChartBase'
import type { Gauge3DSeries } from '../types/series'
import { extractScalar } from '../types/series'
import { clamp, degToRad } from '../utils/math'
import { formatNumber } from '../core/LabelManager'
import type { LabelStyle, BorderStyle } from '../types/style'
import { shade, toCssColor, createGradientSampler } from '../utils/color'
import { representativeColor } from '../utils/gradient'

/** 指针/刻度的 Z 轴抬升量，避免与环带表面 z-fighting */
const SURFACE_EPSILON = 0.012

/** 仪表盘实现 */
export class Gauge3DChart extends ChartBase {
  get chartType(): string {
    return 'gauge3D'
  }

  protected isNonCartesian(): boolean {
    return true
  }

  /**
   * 清空本图表使用到的全部标签分组
   *
   * 仪表盘的中心数值用独立分组 `'gauge-detail'`（因为它在动画期间
   * 需要每帧清空重建，不能和刻度标签混在一起）。
   *
   * 如果不把 `'gauge-detail'` 一起清掉，图例隐藏该系列后
   * `renderSeries` 会跳过绘制、`updateDetail` 不再执行，
   * 上一轮留下的数值标签就失去了 3D 锚点——DOM 元素还在，
   * 但不再有 transform，表现为「数值飘到图表左上角」。
   */
  protected clearSeriesLabels(): void {
    super.clearSeriesLabels()
    this.labels.clearGroup('gauge-detail')
  }

  protected renderSeries(option: ResolvedChartOption): void {
    const seriesList = (option.series ?? []).filter((s) => s.type === 'gauge3D') as Gauge3DSeries[]
    if (!seriesList.length) return

    // 统一过渡计划
    const plan = this.createTransitionPlan(seriesList[0])

    /**
     * 整个仪表盘放进一个分组，统一做 Z 轴居中。
     *
     * 环带沿 +Z 挤出 `depth`，几何中心在 `z = depth/2`；
     * 把分组整体后移 `depth/2`，使仪表盘厚度以原点为中心，
     * 这样相机聚焦原点时表盘不会偏到一侧。
     */
    const gaugeGroup = new THREE.Group()
    gaugeGroup.name = '__vt_gauge_root'
    this.seriesGroup.add(gaugeGroup)

    for (let seriesIndex = 0; seriesIndex < seriesList.length; seriesIndex++) {
      const series = seriesList[seriesIndex]
      if (series.visible === false) continue

      const value = extractScalar((series.data[0] ?? 0) as never)
      const min = series.min ?? 0
      const max = series.max ?? 100
      const startAngle = series.startAngle ?? 225
      const endAngle = series.endAngle ?? -45
      const radius = series.radius ?? 3.4
      const axisWidth = series.axisWidth ?? 0.55
      const depth = series.depth ?? 0.5
      const splitNumber = series.splitNumber ?? 5
      const totalSpan = Math.abs(startAngle - endAngle)

      const color = series.color?.length ? series.color[0] : this.colorAt(0)

      // 动画起始值：启用动画时从最小值起步，否则直接落到目标值
      const animStart = min
      const animatedValue = { current: plan.animationsEnabled ? animStart : value }

      // 厚度居中：整体后移半个厚度
      gaugeGroup.position.z = -depth / 2

      /* ------------------------- 外壳环带 ------------------------- */
      const bgColor = series.itemStyle?.color
        ? toSafeSolid(String(series.itemStyle.color))
        : shade(toCssColor(color), -0.36)

      const track = this.createArc({
        startAngle,
        endAngle,
        radius,
        width: axisWidth,
        depth,
        color: bgColor,
        opacity: series.itemStyle?.opacity ?? 0.55,
        preset: series.itemStyle?.preset ?? 'standard',
        // 玻璃壳：参考图里未填充段是半透明外壳
        shell: series.trackShell === true,
        // 外壳描边
        border: series.itemStyle?.border,
      })
      track.userData.__vtNoPick = true
      gaugeGroup.add(track)

      /* --------------------- 内层环带（双层设计） --------------------- */
      const innerCfg = series.innerArc
      if (innerCfg?.show !== false && innerCfg) {
        const innerRadius = innerCfg.radius ?? radius - axisWidth * 0.95
        const innerWidth = innerCfg.width ?? axisWidth * 0.42
        const innerDepth = innerCfg.depth ?? depth * 0.6
        if (innerRadius - innerWidth / 2 > 0.05) {
          const innerArc = this.createArc({
            startAngle: innerCfg.startAngle ?? startAngle,
            endAngle: innerCfg.endAngle ?? endAngle,
            radius: innerRadius,
            width: innerWidth,
            depth: innerDepth,
            color: innerCfg.color
              ? toSafeSolid(String(innerCfg.color))
              : toSafeSolid(shade(toCssColor(color), -0.1)),
            opacity: innerCfg.opacity ?? 0.18,
            preset: 'standard',
            border: innerCfg.border,
          })
          // 内环稍微后移，避免与进度弧的凸出部分穿插
          innerArc.position.z = -depth * 0.08
          innerArc.userData.__vtNoPick = true
          gaugeGroup.add(innerArc)
        }
      }

      /* --------------------- 同心刻度圆环（蛛网） --------------------- */
      const ringsCfg = series.concentricRings
      if (ringsCfg?.show !== false) {
        const ringCount = Math.max(1, Math.floor(ringsCfg?.count ?? 3))
        const maxR = ringsCfg?.maxRadius ?? radius - axisWidth
        const minR = ringsCfg?.minRadius ?? maxR * 0.32
        const ringColor = toSafeSolid(
          String(ringsCfg?.color ?? toCssColor(color))
        )
        const ringOpacity = ringsCfg?.opacity ?? 0.28
        const ringStart = ringsCfg?.startAngle ?? startAngle
        const ringEnd = ringsCfg?.endAngle ?? endAngle
        // 贴在外壳前表面，避免被环带吞掉
        const ringZ = depth + SURFACE_EPSILON * 0.6

        for (let k = 0; k < ringCount; k++) {
          const t = ringCount === 1 ? 1 : k / (ringCount - 1)
          const r = maxR - (maxR - minR) * t
          const pts: THREE.Vector3[] = []
          const arcSegments = Math.max(24, Math.ceil(Math.abs(ringStart - ringEnd) / 2))
          for (let s = 0; s <= arcSegments; s++) {
            const ang = degToRad(ringStart - (ringStart - ringEnd) * (s / arcSegments))
            pts.push(new THREE.Vector3(Math.cos(ang) * r, Math.sin(ang) * r, ringZ))
          }
          const ringGeo = new THREE.BufferGeometry().setFromPoints(pts)
          this.resources.trackGeometry(ringGeo)
          const ringMat = new THREE.LineBasicMaterial({
            color: new THREE.Color(ringColor),
            transparent: true,
            opacity: ringOpacity,
            depthWrite: false,
          })
          const ringLine = new THREE.Line(ringGeo, ringMat)
          ringLine.userData.__vtNoPick = true
          ringLine.name = '__vt_gauge_ring'
          gaugeGroup.add(ringLine)
        }
      }

      /* ------------------------- 进度弧 ------------------------- */
      const progressGroup = new THREE.Group()
      progressGroup.name = '__vt_gauge_progress'
      gaugeGroup.add(progressGroup)

      const renderProgress = (v: number) => {
        for (const child of [...progressGroup.children]) {
          progressGroup.remove(child)
          this.resources.disposeSubtree(child)
        }
        const t = clamp((v - min) / (max - min || 1), 0, 1)
        const currentEnd = startAngle - totalSpan * t
        if (Math.abs(currentEnd - startAngle) < 0.5) return

        const progressStyle = series.progressStyle ?? {}
        const arc = this.createArc({
          startAngle,
          endAngle: currentEnd,
          radius,
          width: axisWidth,
          // 进度弧略微凸出于外壳，形成层次
          depth: depth * 1.08,
          color: progressStyle.color ? String(progressStyle.color) : color,
          opacity: progressStyle.opacity ?? 1,
          preset: progressStyle.preset ?? 'standard',
          emissive: progressStyle.emissive ? String(progressStyle.emissive) : color,
          emissiveIntensity: progressStyle.emissiveIntensity ?? 0.3,
          // 沿角度渐变：优先于 CSS 渐变
          angleGradient: progressStyle.angleGradient,
          widthEnd: progressStyle.widthEnd,
          border: progressStyle.border,
        })
        arc.userData.__vtNoPick = true
        progressGroup.add(arc)
      }
      renderProgress(animatedValue.current)

      /* ------------------------- 刻度与数值 ------------------------- */
      // 刻度贴着环带外缘，绘制在 XY 平面（与环带同平面）
      if (series.axisTick?.show !== false) {
        const tickColor = toSafeSolid(series.axisTick?.color ?? '#94a3b8')
        const tickZ = depth + SURFACE_EPSILON

        // splitNumber 为 0 时 `i / splitNumber` 会得到 NaN，
        // 进而把整个几何体的 position 写成 NaN、包围盒计算失败。
        // 这里保证分母至少为 1；刻度数量为 0 时按要求直接不画刻度。
        const tickSegments = Math.max(0, Math.floor(splitNumber))
        for (let i = 0; i <= tickSegments; i++) {
          const t = tickSegments > 0 ? i / tickSegments : 0
          const angle = startAngle - totalSpan * t
          const rad = degToRad(angle)
          const inner = radius + axisWidth / 2 + 0.08
          const len = series.axisTick?.length ?? 0.22
          const outer = inner + len

          const cos = Math.cos(rad)
          const sin = Math.sin(rad)

          // ← 关键：在 XY 平面，z 为常量
          const geo = new THREE.BufferGeometry().setFromPoints([
            new THREE.Vector3(cos * inner, sin * inner, tickZ),
            new THREE.Vector3(cos * outer, sin * outer, tickZ),
          ])
          this.resources.trackGeometry(geo)
          const mat = new THREE.LineBasicMaterial({
            color: new THREE.Color(tickColor),
            transparent: true,
            opacity: 0.85,
          })
          const line = new THREE.Line(geo, mat)
          line.userData.__vtNoPick = true
          gaugeGroup.add(line)

          // 刻度数值：沿半径方向再外扩一点
          if (series.axisLabel?.show !== false) {
            const tickValue = min + (max - min) * t
            const labelRadius = outer + 0.52
            const anchor = new THREE.Object3D()
            // ← 同样在 XY 平面
            anchor.position.set(cos * labelRadius, sin * labelRadius, tickZ)
            gaugeGroup.add(anchor)
            this.createLabel(
              anchor,
              formatNumber(tickValue, { precision: series.axisLabel?.precision ?? 0 }),
              {
                show: true,
                textStyle: {
                  color: series.axisLabel?.color ?? '#94a3b8',
                  fontSize: series.axisLabel?.fontSize ?? 11,
                },
              }
            )
          }
        }
      }

      /* --------------------------- 指针 --------------------------- */
      const pointerStyle = series.pointer ?? {}
      // 注意：指针是可选项，`show: false` 时仍需保留 hub（轴心）与数值
      const showPointer = pointerStyle.show !== false
      const pointerGroup = new THREE.Group()
      pointerGroup.name = '__vt_gauge_pointer'
      gaugeGroup.add(pointerGroup)

      const pointerLength = pointerStyle.length ?? radius * 0.72
      const pointerWidth = pointerStyle.width ?? 0.14
      const pointerColor = pointerStyle.color ?? '#f8fafc'

      // 指针形状画在 XY 平面，从原点指向 +X；之后绕 Z 轴旋转定位
      const pointerShape = new THREE.Shape()
      pointerShape.moveTo(0, pointerWidth / 2)
      pointerShape.lineTo(pointerLength, pointerWidth * 0.14)
      pointerShape.lineTo(pointerLength, -pointerWidth * 0.14)
      pointerShape.lineTo(0, -pointerWidth / 2)
      pointerShape.closePath()

      const pointerGeo = new THREE.ExtrudeGeometry(pointerShape, {
        depth: 0.1,
        bevelEnabled: false,
      })
      // 让指针厚度居中于环带表面
      pointerGeo.translate(0, 0, depth + SURFACE_EPSILON - 0.05)
      pointerGeo.computeVertexNormals()
      this.resources.trackGeometry(pointerGeo)

      const pointerMat = this.resources.createMaterial(pointerColor, {
        preset: 'standard',
        roughness: 0.2,
        metalness: 0.6,
        emissive: pointerColor,
        emissiveIntensity: 0.25,
      })
      const pointer = new THREE.Mesh(pointerGeo, pointerMat)
      pointer.userData.__vtNoPick = true
      // pointer.show === false 时只隐藏网格，不加入场景
      pointer.visible = showPointer
      if (showPointer) pointerGroup.add(pointer)

      /* --------------------------- 中心轴帽 --------------------------- */
      const hubCfg = series.hub ?? {}
      const hubShape = hubCfg.shape ?? 'sphere'
      const hubSize = hubCfg.size ?? 1.6
      const hubBaseRadius = pointerWidth * hubSize
      const hubZ = depth + SURFACE_EPSILON

      if (hubShape !== 'none') {
        const hubColor = toSafeSolid(String(hubCfg.color ?? pointerColor))
        const hubMat = this.resources.createMaterial(hubColor, {
          preset: 'standard',
          roughness: hubCfg.roughness ?? 0.18,
          metalness: hubCfg.metalness ?? 0.75,
          emissive: hubColor,
          emissiveIntensity: hubCfg.emissiveIntensity ?? 0.35,
          envMapIntensity: 1.4,
        })

        if (hubShape === 'sphere') {
          // 球体轴心：更接近参考图的立体感
          const sphereGeo = new THREE.SphereGeometry(hubBaseRadius, 28, 20)
          sphereGeo.translate(0, 0, hubZ)
          this.resources.trackGeometry(sphereGeo)
          const sphere = new THREE.Mesh(sphereGeo, hubMat)
          sphere.userData.__vtNoPick = true
          sphere.castShadow = false
          pointerGroup.add(sphere)

          // 外圈描边环：让轴心有一圈清晰的轮廓
          const ringScale = hubCfg.ringScale ?? 1.9
          const ringColor = toSafeSolid(String(hubCfg.ringColor ?? '#cbd5e1'))
          const ringGeo = new THREE.TorusGeometry(hubBaseRadius * ringScale, hubBaseRadius * 0.14, 12, 40)
          ringGeo.translate(0, 0, hubZ + hubBaseRadius * 0.05)
          this.resources.trackGeometry(ringGeo)
          const ringMat = this.resources.createMaterial(ringColor, {
            preset: 'standard',
            roughness: 0.25,
            metalness: 0.8,
            emissive: ringColor,
            emissiveIntensity: 0.2,
          })
          const hubRing = new THREE.Mesh(ringGeo, ringMat)
          hubRing.userData.__vtNoPick = true
          pointerGroup.add(hubRing)
        } else {
          const hubGeo = this.resources.createCylinder(
            hubBaseRadius,
            hubBaseRadius,
            0.16,
            28
          )
          hubGeo.rotateX(Math.PI / 2)
          hubGeo.translate(0, 0, hubZ)
          this.resources.trackGeometry(hubGeo)
          const hub = new THREE.Mesh(hubGeo, hubMat)
          hub.userData.__vtNoPick = true
          pointerGroup.add(hub)
        }
      }

      /**
       * 根据数值更新指针角度
       *
       * 指针在 XY 平面指向 +X，环带从 startAngle 顺时针扫过 totalSpan。
       * 绕 Z 轴旋转时，角度为正表示逆时针，因此直接使用 `rad`。
       */
      const updatePointer = (v: number) => {
        const t = clamp((v - min) / (max - min || 1), 0, 1)
        const angle = startAngle - totalSpan * t
        pointer.rotation.z = degToRad(angle)
      }
      updatePointer(animatedValue.current)

      /* -------------------------- 中心数值 ------------------------- */
      if (series.detail?.show !== false) {
        // 数值放在表盘下方偏内的位置（XY 平面）
        const detailRadius = radius * 0.42
        const detailAnchor = new THREE.Object3D()
        // offsetY 为正表示把数值再往下移，单位为世界单位
        const detailOffsetY = series.detail?.offsetY ?? 0
        detailAnchor.position.set(
          0,
          -detailRadius * 0.55 - detailOffsetY,
          depth + SURFACE_EPSILON
        )
        gaugeGroup.add(detailAnchor)

        // 样式只算一次：动画期间逐帧复用
        const detailStyle: LabelStyle = {
          show: true,
          textStyle: {
            color: series.detail?.color ?? '#f1f5f9',
            fontSize: series.detail?.fontSize ?? 30,
            fontWeight: 700,
            ...series.detail,
          },
        }

        /**
         * 更新中心数值
         *
         * 关键：只在第一次创建 DOM，之后逐帧只改文本。
         *
         * 早期实现是每帧 `clearGroup` + `create` 重建 DOM，会有两个问题：
         * 1. 新建的元素在下一帧渲染前没有 transform，会短暂出现在左上角；
         *    动画若被打断（点图例触发 setOption 会清空动画），
         *    最后一帧新建的元素就永久停在左上角
         * 2. 每秒几十次 DOM 增删，白白浪费
         */
        const formatDetail = (v: number): string => {
          const formatter = series.detail?.formatter
          if (typeof formatter === 'function') return formatter(v)
          if (typeof formatter === 'string') {
            // 模板里没有小数位信息时，按 detail.precision 兜底，避免 78.2 被截成 78
            const precision = series.detail?.precision ?? 0
            return formatter.replace(/\{value\}/g, formatNumber(v, { precision }))
          }
          return formatNumber(v, { precision: series.detail?.precision ?? 0 })
        }

        const updateDetail = (v: number) => {
          const text = formatDetail(v)
          // 已有标签就就地改文本
          if (this.labels.update(detailAnchor, text)) return
          // 还没有（首次绘制，或被 clearSeriesLabels 清掉了）才创建
          this.labels.create({
            object: detailAnchor,
            text,
            group: 'gauge-detail',
            style: detailStyle,
          })
        }
        updateDetail(animatedValue.current)

        /* ------------------------ 数值动画 ------------------------ */
        // 指针、进度弧、中心数值三者必须同步，因此用一次 custom 动画统一驱动
        if (plan.animationsEnabled) {
          plan.custom(
            (t) => {
              const v = animStart + (value - animStart) * t
              renderProgress(v)
              updatePointer(v)
              updateDetail(v)
            },
            0,
            {
              finish: () => {
                renderProgress(value)
                updatePointer(value)
                updateDetail(value)
              },
            }
          )
        }

        // 附加数值标签
        if (series.label?.show) {
          const labelAnchor = new THREE.Object3D()
          labelAnchor.position.set(0, -radius * 0.82, depth + SURFACE_EPSILON)
          gaugeGroup.add(labelAnchor)
          this.createLabel(
            labelAnchor,
            formatNumber(value, { precision: series.label.precision }),
            series.label
          )
        }
      } else if (plan.animationsEnabled) {
        plan.custom(
          (t) => {
            const v = animStart + (value - animStart) * t
            renderProgress(v)
            updatePointer(v)
          },
          0
        )
      }
    }

    // 表盘整体居中，并预留边距给标签
    this.engine.fitToScreen(undefined, undefined, 1.2)

    // 统一启动动画并保持重绘
    plan.run()
    this.keepRenderingWhileAnimating()
  }

  /**
   * 创建一段环形带（带厚度）
   *
   * 在 **XY 平面**绘制扇环，沿 **+Z** 挤出 `depth`。
   *
   * ## 沿角度渐变
   *
   * 传入 `angleGradient`（色带数组）时，会生成**顶点色**：
   * 每个顶点按它所在的角度采样颜色，得到「沿圆周从亮到暗」的效果。
   * 这是还原设计稿双层弧的关键——竖向 UV 贴图在圆弧上方向是错的。
   *
   * ## 不等厚
   *
   * `widthEnd` 与 `width` 不同时，内半径沿角度线性过渡，
   * 形成「一头宽一头窄」的锥形弧。
   */
  private createArc(params: {
    startAngle: number
    endAngle: number
    radius: number
    width: number
    depth: number
    color: string
    opacity: number
    preset?: Gauge3DSeries['itemStyle'] extends infer T
      ? T extends { preset?: infer P }
        ? P
        : never
      : never
    emissive?: string
    emissiveIntensity?: number
    /** 沿角度渐变的色带（从起点到终点） */
    angleGradient?: string[]
    /** 终点宽度，实现不等厚 */
    widthEnd?: number
    /** 玻璃壳材质（菲涅尔边缘发光） */
    shell?: boolean
    /** 描边配置 */
    border?: BorderStyle
  }): THREE.Mesh {
    const { startAngle, endAngle, radius, width, depth, color, opacity } = params
    const widthEnd = params.widthEnd ?? width

    const shape = new THREE.Shape()
    const a0 = degToRad(startAngle)
    const a1 = degToRad(endAngle)
    const segments = Math.max(8, Math.ceil(Math.abs(startAngle - endAngle) / 1.5))

    /** 按进度 t (0~1) 计算内/外半径，支持不等厚 */
    const radiiAt = (t: number): { inner: number; outer: number } => {
      const w = width + (widthEnd - width) * t
      return { inner: radius - w / 2, outer: radius + w / 2 }
    }

    // 外弧
    for (let i = 0; i <= segments; i++) {
      const t = i / segments
      const angle = a0 + (a1 - a0) * t
      const { outer } = radiiAt(t)
      const x = Math.cos(angle) * outer
      const y = Math.sin(angle) * outer
      if (i === 0) shape.moveTo(x, y)
      else shape.lineTo(x, y)
    }
    // 内弧（反向闭合）
    for (let i = segments; i >= 0; i--) {
      const t = i / segments
      const angle = a0 + (a1 - a0) * t
      const { inner } = radiiAt(t)
      shape.lineTo(Math.cos(angle) * inner, Math.sin(angle) * inner)
    }
    shape.closePath()

    const geometry = new THREE.ExtrudeGeometry(shape, {
      depth,
      bevelEnabled: true,
      bevelThickness: 0.02,
      bevelSize: 0.02,
      bevelSegments: 3,
      curveSegments: 6,
    })
    geometry.computeVertexNormals()
    this.resources.trackGeometry(geometry)

    /* ---------------------- 沿角度渐变（顶点色） ---------------------- */
    const hasAngleGradient = params.angleGradient?.length
    if (hasAngleGradient) {
      this.applyAngleVertexColors(geometry, params.angleGradient as string[])
    }

    // 颜色可能是 CSS 渐变字符串：
    // - 传给 createMaterial 时，材质层会用首色作基色 + 生成竖向渐变贴图
    // - emissive 不能吃渐变，先降级成代表色，避免 THREE.Color 算出 NaN
    const material = this.resources.createMaterial(
      hasAngleGradient ? '#ffffff' : color,
      {
        preset: params.preset ?? 'standard',
        roughness: 0.3,
        metalness: 0.35,
        opacity,
        transparent: opacity < 1,
        emissive: toSafeSolid(params.emissive ?? color),
        emissiveIntensity: params.emissiveIntensity ?? 0.1,
        envMapIntensity: 1.2,
        color: hasAngleGradient ? '#ffffff' : color,
        side: 'double',
        // 顶点色模式下需要开启顶点色，否则颜色不生效
        ...(hasAngleGradient ? {} : {}),
      }
    )

    if (hasAngleGradient) {
      ;(material as THREE.MeshStandardMaterial).vertexColors = true
      material.needsUpdate = true
    }

    /* ------------------------- 玻璃壳材质 ------------------------- */
    if (params.shell) {
      applyShellShader(material as THREE.MeshStandardMaterial, opacity)
    }

    const mesh = new THREE.Mesh(geometry, material)
    mesh.castShadow = !params.shell
    mesh.receiveShadow = !params.shell
    mesh.name = '__vt_gauge_arc'

    /* --------------------------- 描边 --------------------------- */
    if (params.border?.show) {
      this.attachArcBorder(mesh, {
        startAngle,
        endAngle,
        radius,
        width,
        widthEnd,
        depth: depth * 1.08,
        border: params.border,
        angleGradient: params.angleGradient,
      })
    }

    return mesh
  }

  /**
   * 给弧形生成内外沿描边
   *
   * 实现方式：沿内径/外径各生成一条曲线，用 `TubeGeometry` 做成极细的管，
   * 并沿 +Z 抬升到表面之上，避免与挤出体产生 z-fighting。
   *
   * 描边作为弧的**子对象**挂载，这样动画缩放时会自动跟随。
   */
  private attachArcBorder(
    parent: THREE.Mesh,
    params: {
      startAngle: number
      endAngle: number
      radius: number
      width: number
      widthEnd: number
      depth: number
      border: BorderStyle
      angleGradient?: string[]
    }
  ): void {
    const { startAngle, endAngle, radius, width, widthEnd, border } = params
    const showInner = border.inner !== false
    const showOuter = border.outer !== false
    const showCaps = border.cap === true
    if (!showInner && !showOuter) return

    const tubeRadius = Math.max(0.004, border.width ?? 0.02)
    // 弧沿 +Z 从 0 挤出到 depth：顶面在 depth，底面在 0
    const topZ = params.depth + SURFACE_EPSILON * 2
    const bottomZ = -SURFACE_EPSILON * 2
    const segments = Math.max(16, Math.ceil(Math.abs(startAngle - endAngle) / 2))

    /** 按进度 t 取该处的内/外半径（与 createArc 的不等厚逻辑一致） */
    const radiusAt = (t: number, which: 'inner' | 'outer'): number => {
      const w = width + (widthEnd - width) * t
      return which === 'inner' ? radius - w / 2 : radius + w / 2
    }

    /** 描边颜色：可跟随角度渐变，也可用固定色 */
    const borderColorOf = (which: 'inner' | 'outer'): string => {
      if (params.angleGradient?.length) {
        const sampler = createGradientSampler(params.angleGradient)
        return `#${sampler(which === 'inner' ? 0.15 : 0.85).getHexString()}`
      }
      return toSafeSolid(border.color !== undefined ? String(border.color) : '#ffffff')
    }

    /** 建一根细管并挂到弧上 */
    const buildTube = (pts: THREE.Vector3[], color: string, name: string): void => {
      if (pts.length < 2) return
      const curve = new THREE.CatmullRomCurve3(pts, false, 'centripetal')
      const geo = new THREE.TubeGeometry(curve, Math.max(4, pts.length * 2), tubeRadius, 6, false)
      this.resources.trackGeometry(geo)

      const mat = this.resources.createMaterial(color, {
        preset: 'standard',
        roughness: 0.35,
        metalness: 0.2,
        emissive: color,
        emissiveIntensity: border.emissiveIntensity ?? 0.35,
        opacity: border.opacity ?? 1,
        transparent: (border.opacity ?? 1) < 1,
        depthWrite: false,
      })

      const line = new THREE.Mesh(geo, mat)
      line.userData.__vtNoPick = true
      line.name = name
      line.castShadow = false
      line.receiveShadow = false
      parent.add(line)
    }

    /** 沿某条半径、在指定 Z 高度采样整段弧 */
    const arcPoints = (which: 'inner' | 'outer', z: number): THREE.Vector3[] => {
      const pts: THREE.Vector3[] = []
      for (let i = 0; i <= segments; i++) {
        const t = i / segments
        const ang = degToRad(startAngle + (endAngle - startAngle) * t)
        const r = radiusAt(t, which)
        pts.push(new THREE.Vector3(Math.cos(ang) * r, Math.sin(ang) * r, z))
      }
      return pts
    }

    /* ---------------- 顶面：内沿 / 外沿 ---------------- */
    if (showInner) {
      buildTube(arcPoints('inner', topZ), borderColorOf('inner'), '__vt_gauge_border_top_inner')
    }
    if (showOuter) {
      buildTube(arcPoints('outer', topZ), borderColorOf('outer'), '__vt_gauge_border_top_outer')
    }

    /* ---------------- 底面：内沿 / 外沿 ---------------- */
    if (showInner) {
      buildTube(arcPoints('inner', bottomZ), borderColorOf('inner'), '__vt_gauge_border_bottom_inner')
    }
    if (showOuter) {
      buildTube(arcPoints('outer', bottomZ), borderColorOf('outer'), '__vt_gauge_border_bottom_outer')
    }

    /* ---------------- 两端封口：竖棱 + 径向 ---------------- */
    if (showCaps) {
      const ends: Array<{ t: number; ang: number }> = [
        { t: 0, ang: startAngle },
        { t: 1, ang: endAngle },
      ]
      for (const { t, ang } of ends) {
        const rad = degToRad(ang)
        const cos = Math.cos(rad)
        const sin = Math.sin(rad)
        const rIn = radiusAt(t, 'inner')
        const rOut = radiusAt(t, 'outer')

        // 内沿竖棱（顶面内沿 ↔ 底面内沿）
        buildTube(
          [
            new THREE.Vector3(cos * rIn, sin * rIn, bottomZ),
            new THREE.Vector3(cos * rIn, sin * rIn, topZ),
          ],
          borderColorOf('inner'),
          '__vt_gauge_border_cap_inner'
        )
        // 外沿竖棱
        buildTube(
          [
            new THREE.Vector3(cos * rOut, sin * rOut, bottomZ),
            new THREE.Vector3(cos * rOut, sin * rOut, topZ),
          ],
          borderColorOf('outer'),
          '__vt_gauge_border_cap_outer'
        )
        // 顶面径向（内沿 → 外沿）
        buildTube(
          [
            new THREE.Vector3(cos * rIn, sin * rIn, topZ),
            new THREE.Vector3(cos * rOut, sin * rOut, topZ),
          ],
          borderColorOf('outer'),
          '__vt_gauge_border_cap_top'
        )
        // 底面径向
        buildTube(
          [
            new THREE.Vector3(cos * rIn, sin * rIn, bottomZ),
            new THREE.Vector3(cos * rOut, sin * rOut, bottomZ),
          ],
          borderColorOf('outer'),
          '__vt_gauge_border_cap_bottom'
        )
      }
    }
  }

  /**
   * 按顶点所在角度写入顶点色
   *
   * `ExtrudeGeometry` 顶点的 UV 是沿截面展开的，无法直接表达「沿圆周渐变」，
   * 因此这里根据顶点在 XY 平面上的极角反算进度 t，再从色带采样。
   */
  private applyAngleVertexColors(geometry: THREE.BufferGeometry, gradient: string[]): void {
    const position = geometry.getAttribute('position')
    if (!position) return
    const count = position.count
    const colors = new Float32Array(count * 3)
    const sampler = createGradientSampler(gradient)

    for (let i = 0; i < count; i++) {
      const x = position.getX(i)
      const y = position.getY(i)
      // 极角归一到 0~1（与刻度方向一致：从起点顺时针扫到终点）
      let angleDeg = (Math.atan2(y, x) * 180) / Math.PI
      if (angleDeg < 0) angleDeg += 360
      const t = Math.min(1, Math.max(0, 1 - angleDeg / 360))
      const c = sampler(t)
      colors[i * 3] = c.r
      colors[i * 3 + 1] = c.g
      colors[i * 3 + 2] = c.b
    }

    geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3))
  }
}

/**
 * 玻璃壳材质：菲涅尔边缘发光
 *
 * 参考图里未填充的那段是「半透明玻璃外壳」——
 * 正对视线处几乎透明，掠射角边缘发亮。这里用 `onBeforeCompile`
 * 在片元着色器里叠加基于 fresnel 的自发光与透明度。
 */
function applyShellShader(material: THREE.MeshStandardMaterial, baseOpacity: number): void {
  material.onBeforeCompile = (shader) => {
    shader.fragmentShader = shader.fragmentShader.replace(
      '#include <dithering_fragment>',
      `#include <dithering_fragment>
      {
        // 视线方向与法线的夹角 -> 边缘更亮
        vec3 viewDir = normalize(vViewPosition);
        float fresnel = pow(1.0 - abs(dot(normalize(vNormal), viewDir)), 2.2);
        gl_FragColor.rgb += diffuseColor.rgb * fresnel * 0.9;
        gl_FragColor.a = clamp(gl_FragColor.a + fresnel * 0.55, 0.0, 1.0);
        gl_FragColor.a *= ${baseOpacity.toFixed(3)};
      }`
    )
  }
  material.transparent = true
  material.depthWrite = false
  material.needsUpdate = true
}

/**
 * 把任意颜色输入降级为可交给 `THREE.Color` 的纯色
 *
 * 渐变字符串会被取成代表色，避免 `new THREE.Color('linear-gradient(...)')`
 * 解析出 NaN，进而污染几何体包围球、导致整个图表消失。
 */
function toSafeSolid(input: string | number | undefined): string {
  if (input === undefined) return '#4f8cff'
  if (typeof input === 'number') return `#${input.toString(16).padStart(6, '0')}`
  return representativeColor(input)
}
