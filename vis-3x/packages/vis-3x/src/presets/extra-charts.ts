/**
 * vis-3x — 扩展图表示例集（`vis-3x/presets`）
 *
 * 这些图表全部使用公开的 `defineChart` / `extendChart` API 实现，
 * 与第三方使用者所能调用的能力完全一致 —— 它们既是开箱可用的图表，
 * 也是「如何自定义图表」的活文档。
 *
 * 默认不会自动注册。按需调用 `useExtraCharts()` 一次性注册，
 * 或单独导入某个 `defineXxx()` 函数。
 */
import * as THREE from 'three'
import { defineChart, extendChart, registerChart } from '../core/registry'
import type { ChartConstructor } from '../core/registry'
import { extractScalar, extractName, extractValue } from '../types/series'
import { formatLabel } from '../core/LabelManager'
import { gradientColorAt, shade } from '../utils/color'
import { catmullRomSpline, clamp, degToRad, lerp } from '../utils/math'

/* -------------------------------------------------------------------------- */
/* 1. 棒棒糖图（lollipop3D）                                                    */
/* -------------------------------------------------------------------------- */

/**
 * 3D 棒棒糖图：细杆 + 顶部圆球
 *
 * 演示最基础的 `defineChart` 用法：坐标映射 + 几何体 + 材质 + 交互。
 */
export function defineLollipop3D(): ChartConstructor {
  return defineChart({
    type: 'lollipop3D',
    render(ctx) {
      if (!ctx.series.length) return
      const series = ctx.series[0]
      const colors = series.color?.length ? series.color : ctx.theme.palette
      const plan = ctx.transition

      /**
       * 可配置尺寸
       *
       * 这两个字段以前是硬编码的，导致使用者无法调整外观。
       * 现在通过 series 上的字段暴露，并保留原来的默认值。
       */
      const style = series as {
        stemRadius?: number
        ballRadius?: number
        label?: { show?: boolean }
      }
      const stemRadius = style.stemRadius ?? 0.055
      const ballRadius = style.ballRadius ?? 0.22

      series.data.forEach((item, index) => {
        const value = extractScalar(item as never)
        if (!Number.isFinite(value)) return

        const x = ctx.coord.xAtCategory(index)
        const height = Math.max(ctx.coord.yAt(value), 0.0001)
        const color = colors[index % colors.length]

        // 细杆（圆柱几何体中心在原点，因此位置为 height/2）
        const stemGeo = ctx.geometry.cylinder(stemRadius, stemRadius, height, 12)
        const stem = new THREE.Mesh(
          stemGeo,
          ctx.material(shade(color, -0.12), {
            preset: 'standard',
            roughness: 0.4,
            metalness: 0.3,
          })
        )
        stem.position.set(x, height / 2, 0)
        stem.castShadow = true
        ctx.add(stem)

        // 顶部圆球
        const ball = new THREE.Mesh(
          ctx.geometry.sphere(ballRadius, 22),
          ctx.material(color, {
            preset: 'standard',
            roughness: 0.2,
            metalness: 0.35,
            emissive: color,
            emissiveIntensity: 0.35,
          })
        )
        ball.position.set(x, height, 0)
        ball.castShadow = true

        ctx.pickable(ball, {
          seriesIndex: 0,
          dataIndex: index,
          seriesName: series.name,
          name: extractName(item as never, ctx.coord.categoryName(index)),
          value,
          color,
        })
        ctx.add(ball)

        // 生长动画：细杆与圆球一起从底部升起
        // （圆柱几何体中心在原点，需同时调整 scale.y 与 position.y）
        plan.custom(
          (t) => {
            const h = Math.max(0.0001, height * t)
            stem.scale.y = h / height
            stem.position.y = h / 2
            ball.position.y = h
          },
          index,
          {
            finish: () => {
              stem.scale.y = 1
              stem.position.y = height / 2
              ball.position.y = height
            },
          }
        )

        // 数值标签
        if (series.label?.show) {
          ctx.anchor(
            x,
            height + ballRadius + 0.25,
            0,
            formatLabel(series.label, {
              value,
              name: ctx.coord.categoryName(index),
              seriesName: series.name,
              dataIndex: index,
              seriesIndex: 0,
            }),
            series.label
          )
        }
      })

      // 统一启动动画
      plan.run()
      ctx.keepAnimating()
    },
  })
}

/* -------------------------------------------------------------------------- */
/* 2. 3D 气泡图（bubble3D）                                                    */
/* -------------------------------------------------------------------------- */

/**
 * 3D 气泡图：位置由 [x, y, z] 决定，半径由第三维或额外数值映射
 */
export function defineBubble3D(): ChartConstructor {
  return defineChart({
    type: 'bubble3D',
    render(ctx) {
      const plan = ctx.transition

      ctx.series.forEach((series, seriesIndex) => {
        const colors = series.color?.length ? series.color : ctx.theme.palette
        const sizeRange = (series as { pointStyle?: { sizeRange?: [number, number] } })
          .pointStyle?.sizeRange ?? [0.14, 0.5]

        series.data.forEach((item, index) => {
          const raw = extractValue(item as never)
          const tuple = Array.isArray(raw) ? raw : [index, raw, 0]
          const [xv, yv, zv = 0] = tuple
          if (!Number.isFinite(yv)) return

          const x = ctx.coord.xAt(xv)
          const y = ctx.coord.yAt(yv)
          const z = ctx.coord.zAt(zv)

          // 半径由数值相对 Y 轴范围映射
          const [min, max] = ctx.coord.yDomain
          const t = clamp((yv - min) / (max - min || 1), 0, 1)
          const radius = lerp(sizeRange[0], sizeRange[1], t)
          const color = colors[index % colors.length]

          const bubble = new THREE.Mesh(
            ctx.geometry.sphere(radius, 26),
            ctx.material(color, {
              preset: 'physical',
              roughness: 0.12,
              metalness: 0.1,
              transmission: 0.35,
              thickness: radius,
              ior: 1.4,
              opacity: 0.88,
              transparent: true,
              emissive: color,
              emissiveIntensity: 0.18,
            })
          )
          bubble.position.set(x, y, z)
          bubble.castShadow = true

          ctx.pickable(bubble, {
            seriesIndex,
            dataIndex: index,
            seriesName: series.name,
            name: extractName(item as never, ctx.coord.categoryName(index)),
            value: tuple,
            color,
          })
          ctx.add(bubble)

          // 动画：气泡从零放大到目标尺寸
          plan.custom(
            (p) => {
              const s = Math.max(0.001, p)
              bubble.scale.set(s, s, s)
            },
            index,
            { finish: () => bubble.scale.set(1, 1, 1) }
          )
        })
      })

      plan.run()
      ctx.keepAnimating()
    },
  })
}

/* -------------------------------------------------------------------------- */
/* 3. 3D 柱线组合图（barLine3D）—— 演示 extendChart                             */
/* -------------------------------------------------------------------------- */

/**
 * 柱线组合图
 *
 * 复用内置 `bar3D` 的渲染逻辑，在其之上追加一条折线。
 * 这是 `extendChart` 最典型的用法：不为重写，只为增强。
 */
export function defineBarLine3D(): ChartConstructor {
  // 先确保基础类型已注册
  if (!registerChart) throw new Error('unreachable')

  return extendChart('bar3D', {
    type: 'barLine3D',
    afterRender(ctx) {
      // 复用图表当前的过渡计划（与父类柱子动画共用）
      const plan = ctx.transition

      // 找出标记为折线的系列（约定：名字以 line: 开头，或 type 为 line3D）
      const lineSeries = ctx.allSeries.filter(
        (s) => s.type === 'line3D' || /^line:/i.test(s.name ?? '')
      )
      // 没有折线系列时也要确保父类登记的柱子动画被启动
      if (!lineSeries.length) {
        plan.run()
        ctx.keepAnimating()
        return
      }

      lineSeries.forEach((series, seriesIndex) => {
        const color = series.color?.[0] ?? ctx.theme.colorAt(seriesIndex)
        const points: THREE.Vector3[] = []
        // 折线放在网格最前方（超过柱子所在的 z 范围），确保不被柱子遮挡
        const lineZ = ctx.coord.grid.gridDepth / 2 + 0.42

        series.data.forEach((item, index) => {
          const value = extractScalar(item as never)
          if (!Number.isFinite(value)) return
          points.push(
            new THREE.Vector3(
              ctx.coord.xAtCategory(index),
              ctx.coord.yAt(value),
              lineZ
            )
          )
        })

        if (points.length < 2) return
        const smooth = catmullRomSpline(points, 14, 0.5)

        const line = new THREE.Mesh(
          ctx.geometry.tube(smooth, 0.06, smooth.length * 2),
          ctx.material(color, {
            preset: 'standard',
            roughness: 0.2,
            metalness: 0.4,
            emissive: color,
            emissiveIntensity: 0.3,
          })
        )
        ctx.add(line)

        // 折线从底部向上生长（与柱子的生长动画同步）
        plan.custom(
          (t) => {
            line.scale.y = Math.max(0.001, t)
          },
          seriesIndex,
          {
            extraDelay: 120, // 略晚于柱子，形成层次
            finish: () => {
              line.scale.y = 1
            },
          }
        )

        // 折线数据点
        points.forEach((p, index) => {
          const dot = new THREE.Mesh(
            ctx.geometry.sphere(0.11, 16),
            ctx.material('#ffffff', { preset: 'standard', roughness: 0.15, metalness: 0.5 })
          )
          dot.position.copy(p)
          ctx.pickable(dot, {
            seriesIndex: ctx.allSeries.indexOf(series),
            dataIndex: index,
            seriesName: series.name,
            name: ctx.coord.categoryName(index),
            value: extractScalar(series.data[index] as never),
            color,
          })
          ctx.add(dot)
        })
      })

      plan.run()
      ctx.keepAnimating()
    },
  })
}

/* -------------------------------------------------------------------------- */
/* 4. 3D 金字塔图（pyramid3D）                                                 */
/* -------------------------------------------------------------------------- */

/**
 * 3D 金字塔图：由下至上逐层收缩的实心棱锥
 */
export function definePyramid3D(): ChartConstructor {
  return defineChart({
    type: 'pyramid3D',
    nonCartesian: true,
    render(ctx) {
      if (!ctx.series.length) return
      const plan = ctx.transition

      const totalHeight = 6
      const baseWidth = 4.4
      const depth = 3.2
      /** 多系列之间的深度间距 */
      const seriesGap = depth * 1.35
      const seriesCount = ctx.series.length

      /**
       * 每个系列画一座金字塔，沿 Z 轴依次排开。
       *
       * 之前只渲染 series[0]，多传的系列会被静默忽略，
       * 使用者会以为数据没生效。现在全部渲染。
       */
      ctx.series.forEach((series, seriesIndex) => {
        const values = series.data.map((item) => {
          const v = extractScalar(item as never)
          return Number.isFinite(v) && v > 0 ? v : 0
        })
        const maxValue = Math.max(...values, 1)
        const colors = series.color?.length ? series.color : ctx.theme.palette
        const layerHeight = totalHeight / Math.max(1, values.length)

        // 多系列时沿 Z 轴居中排开
        const zOffset = (seriesIndex - (seriesCount - 1) / 2) * seriesGap

        values.forEach((value, index) => {
          // 自上而下宽度递增
          const t = clamp(value / maxValue, 0.08, 1)
          const topT = clamp((values[index + 1] ?? value * 0.6) / maxValue, 0.06, 1)

          const topWidth = baseWidth * topT
          const bottomWidth = baseWidth * t
          const color = colors[index % colors.length]

          const shape = new THREE.Shape()
          shape.moveTo(-topWidth / 2, layerHeight / 2)
          shape.lineTo(topWidth / 2, layerHeight / 2)
          shape.lineTo(bottomWidth / 2, -layerHeight / 2)
          shape.lineTo(-bottomWidth / 2, -layerHeight / 2)
          shape.closePath()

          const geometry = ctx.geometry.extrude(shape, depth, {
            bevelEnabled: true,
            bevelThickness: 0.02,
            bevelSize: 0.02,
            bevelSegments: 1,
          })
          geometry.translate(0, 0, -depth / 2)

          const mesh = new THREE.Mesh(
            geometry,
            ctx.material(color, {
              preset: 'standard',
              roughness: 0.32,
              metalness: 0.3,
              side: 'double',
              emissive: color,
              emissiveIntensity: 0.08,
            })
          )
          // 从下往上堆叠，并按系列错开深度
          const targetY = (values.length - 1 - index) * layerHeight + layerHeight / 2
          mesh.position.set(0, targetY, zOffset)
          mesh.castShadow = true
          mesh.receiveShadow = true

          ctx.pickable(mesh, {
            seriesIndex,
            dataIndex: index,
            seriesName: series.name,
            name: extractName(series.data[index] as never, `层级 ${index + 1}`),
            value,
            color,
          })
          ctx.add(mesh)

          // 动画：各层从上方滑入，自下而上依次落位
          // 错峰索引把系列也考虑进去，避免多系列同时落位
          const staggerIndex = seriesIndex * values.length + (values.length - 1 - index)
          const startY = targetY + 2.2
          mesh.position.y = startY
          plan.custom(
            (p) => {
              mesh.position.y = startY + (targetY - startY) * p
            },
            staggerIndex, // 底层先落位
            {
              finish: () => {
                mesh.position.y = targetY
              },
            }
          )

          if (series.label?.show) {
            ctx.anchor(
              0,
              mesh.position.y + layerHeight * 0.72,
              zOffset + depth * 0.62,
              formatLabel(series.label, {
                value,
                name: extractName(series.data[index] as never, `层级 ${index + 1}`),
                seriesName: series.name,
                dataIndex: index,
                seriesIndex,
              }),
              series.label
            )
          }
        })
      })

      plan.run()
      ctx.keepAnimating()
    },
  })
}

/* -------------------------------------------------------------------------- */
/* 5. 3D 环形进度条（ringProgress3D）                                          */
/* -------------------------------------------------------------------------- */

/**
 * 多环进度图：每个数据项一圈，形成立体的嵌套环
 */
export function defineRingProgress3D(): ChartConstructor {
  return defineChart({
    type: 'ringProgress3D',
    nonCartesian: true,
    render(ctx) {
      if (!ctx.series.length) return
      const series = ctx.series[0]
      const plan = ctx.transition

      const values = series.data.map((item) => extractScalar(item as never))
      const maxValue = (series as { max?: number }).max ?? Math.max(...values, 100)
      const colors = series.color?.length ? series.color : ctx.theme.palette
      const baseRadius = 2.9
      const depth = 0.32

      /**
       * 自适应环宽与间距
       *
       * 固定环宽时最多只能放 6 环，第 7 项起会被静默丢弃。
       * 这里让环宽随数据量收缩，保证：
       * - 最少保留 0.14 的环宽（再细就看不见了）
       * - 全部数据项都能画出来，不丢数据
       */
      const count = Math.max(1, values.length)
      const innerLimit = 0.55 // 最内环的半径下限
      const usable = baseRadius - innerLimit
      // 每环占用的径向空间（环宽 + 间隙），并让间隙占其中约 26%
      const slot = usable / count
      const ringWidth = Math.max(0.14, slot * 0.74)
      const gap = Math.max(0.04, slot - ringWidth)

      values.forEach((value, index) => {
        const radius = baseRadius - index * (ringWidth + gap)
        // 数据项很多时环会细到不可见，此时停止绘制
        if (radius <= ringWidth * 0.6) return

        const color = colors[index % colors.length]
        const ratio = clamp(value / (maxValue || 1), 0, 1)

        /** 生成一段圆环（带厚度） */
        const buildArc = (fromDeg: number, toDeg: number, mat: THREE.Material) => {
          const inner = radius - ringWidth / 2
          const outer = radius + ringWidth / 2
          const shape = new THREE.Shape()
          const a0 = degToRad(fromDeg)
          const a1 = degToRad(toDeg)
          const segments = Math.max(8, Math.ceil(Math.abs(fromDeg - toDeg) / 3))

          for (let i = 0; i <= segments; i++) {
            const angle = a0 + (a1 - a0) * (i / segments)
            const px = Math.cos(angle) * outer
            const py = Math.sin(angle) * outer
            if (i === 0) shape.moveTo(px, py)
            else shape.lineTo(px, py)
          }
          for (let i = segments; i >= 0; i--) {
            const angle = a0 + (a1 - a0) * (i / segments)
            shape.lineTo(Math.cos(angle) * inner, Math.sin(angle) * inner)
          }
          shape.closePath()

          const geo = ctx.geometry.extrude(shape, depth, {
            bevelEnabled: true,
            bevelThickness: 0.012,
            bevelSize: 0.012,
            bevelSegments: 1,
          })
          const mesh = new THREE.Mesh(geo, mat)
          mesh.castShadow = true
          return mesh
        }

        // 背景轨道
        const track = buildArc(
          0,
          359.9,
          ctx.material(shade(color, -0.4), {
            preset: 'standard',
            roughness: 0.6,
            metalness: 0.2,
            opacity: 0.35,
            transparent: true,
          })
        )
        ctx.add(track)

        // 进度弧
        const sweep = 359.9 * ratio
        if (sweep > 0.5) {
          const arc = buildArc(90, 90 - sweep, ctx.material(color, {
            preset: 'standard',
            roughness: 0.25,
            metalness: 0.4,
            emissive: color,
            emissiveIntensity: 0.35,
          }))
          ctx.pickable(arc, {
            seriesIndex: 0,
            dataIndex: index,
            seriesName: series.name,
            name: extractName(series.data[index] as never, `指标 ${index + 1}`),
            value,
            color,
          })
          ctx.add(arc)

          // 动画：进度弧从中心（0 尺寸）向外扩张到完整大小
          plan.custom(
            (t) => {
              const s = Math.max(0.001, t)
              arc.scale.set(s, s, 1)
            },
            index,
            { finish: () => arc.scale.set(1, 1, 1) }
          )
        }

        // 数值标签：放在该环自身进度弧的末端，天然错开、不重叠
        if (series.label?.show !== false) {
          // 弧从 90° 顺时针扫过 sweep，标签放在末端再外扩一点
          const endAngle = degToRad(90 - sweep - 6)
          const labelRadius = radius + ringWidth * 0.9
          ctx.anchor(
            Math.cos(endAngle) * labelRadius,
            0.22,
            -Math.sin(endAngle) * labelRadius,
            series.label
              ? formatLabel(series.label, {
                  value,
                  name: extractName(series.data[index] as never, `指标 ${index + 1}`),
                  seriesName: series.name,
                  dataIndex: index,
                  seriesIndex: 0,
                })
              : `${Math.round(ratio * 100)}%`,
            series.label ?? {
              show: true,
              textStyle: { fontSize: 11, color: ctx.theme.textColor },
            }
          )
        }
      })

      plan.run()
      ctx.keepAnimating()
    },
  })
}

/* -------------------------------------------------------------------------- */
/* 6. 3D 阶梯地形图（stepTerrain3D）                                           */
/* -------------------------------------------------------------------------- */

/**
 * 阶梯地形图：把矩阵数据画成立方体阶梯，适合表现离散高度场
 */
export function defineStepTerrain3D(): ChartConstructor {
  return defineChart({
    type: 'stepTerrain3D',
    render(ctx) {
      const series = ctx.series[0] as unknown as
        | { data: number[][]; colorGradient?: string[]; name?: string }
        | undefined
      const matrix = series?.data
      if (!matrix?.length || !matrix[0]?.length) return

      const plan = ctx.transition
      const rows = matrix.length
      const cols = matrix[0].length
      const flat = matrix.flat().filter((v) => Number.isFinite(v))
      const min = Math.min(...flat)
      const max = Math.max(...flat)
      const span = max - min || 1

      const gradient =
        series?.colorGradient ??
        ['#1e3a8a', '#0ea5e9', '#22d3ee', '#34d399', '#fde047', '#fb923c', '#ef4444']

      const { gridWidth, gridDepth } = ctx.coord.grid
      const stepX = gridWidth / cols
      const stepZ = gridDepth / rows
      const maxHeight = ctx.coord.grid.gridHeight * 0.75

      for (let r = 0; r < rows; r++) {
        for (let c = 0; c < cols; c++) {
          const value = matrix[r][c]
          if (!Number.isFinite(value)) continue

          const t = clamp((value - min) / span, 0, 1)
          const height = Math.max(lerp(0.12, maxHeight, t), 0.05)
          const color = gradientColorAt(gradient, t)

          const x = -gridWidth / 2 + stepX * (c + 0.5)
          const z = gridDepth / 2 - stepZ * (r + 0.5)

          const cube = new THREE.Mesh(
            ctx.geometry.box(stepX * 0.92, height, stepZ * 0.92),
            ctx.material(color, {
              preset: 'standard',
              roughness: 0.4,
              metalness: 0.16,
              emissive: color,
              emissiveIntensity: 0.08 + t * 0.18,
            })
          )
          cube.position.set(x, height / 2, z)
          cube.castShadow = true
          cube.receiveShadow = true

          ctx.pickable(cube, {
            seriesIndex: 0,
            dataIndex: r * cols + c,
            seriesName: series?.name,
            name: `R${r + 1}C${c + 1}`,
            value,
            color,
          })
          ctx.add(cube)

          // 生长动画：色块从地面升起
          // BoxGeometry 中心在原点，需同步调整 scale.y 与 position.y
          const targetHeight = height
          cube.scale.y = 0.001
          cube.position.y = 0
          plan.custom(
            (p) => {
              const h = Math.max(0.001, targetHeight * p)
              cube.scale.y = h / targetHeight
              cube.position.y = h / 2
            },
            r * cols + c,
            {
              finish: () => {
                cube.scale.y = 1
                cube.position.y = targetHeight / 2
              },
            }
          )
        }
      }

      plan.run()
      ctx.keepAnimating()
    },
  })
}

/* -------------------------------------------------------------------------- */
/*                              批量注册                                       */
/* -------------------------------------------------------------------------- */

/** 全部扩展图表定义器 */
const extras = {
  lollipop3D: defineLollipop3D,
  bubble3D: defineBubble3D,
  barLine3D: defineBarLine3D,
  pyramid3D: definePyramid3D,
  ringProgress3D: defineRingProgress3D,
  stepTerrain3D: defineStepTerrain3D,
}

/** 扩展图表类型名 */
export type ExtraChartType = keyof typeof extras

/**
 * 一次性注册全部扩展图表
 *
 * @example
 * ```ts
 * import { useExtraCharts } from 'vis-3x/presets'
 * useExtraCharts()
 *
 * const chart = createChart('lollipop3D', el)
 * ```
 */
export function useExtraCharts(names?: ExtraChartType[]): void {
  const list = names ?? (Object.keys(extras) as ExtraChartType[])
  for (const name of list) {
    const define = extras[name]
    if (define) define()
  }
}

/** 已注册的扩展图表类型名 */
export function getExtraChartTypes(): ExtraChartType[] {
  return Object.keys(extras) as ExtraChartType[]
}

export { registerChart }
