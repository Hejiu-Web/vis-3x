# 完整实战案例

这一页从零构建一个真实可用的图表类型：**3D 阶梯地形图**。

它覆盖自定义图表会遇到的全部关键问题：二维矩阵数据、坐标映射、颜色映射、几何体创建、生长动画、交互标记。

---

## 需求

把二维矩阵画成立方体阶梯，用高度和颜色双重编码数值。

```
矩阵              渲染结果
[[12, 45, 30],    ██████
 [28, 60, 15],    ██████████
 [40, 22, 55]]    ████████
```

适合表现离散高度场：地理高程网格、热力矩阵、传感器阵列读数。

---

## 第 1 步：确定数据格式

```ts
interface StepTerrainSeries {
  type: 'stepTerrain3D'
  data: number[][]           // 二维矩阵，行 × 列
  colorGradient?: string[]   // 覆盖默认色带
  name?: string
}
```

矩阵的行对应深度方向（Z），列对应宽度方向（X）。

---

## 第 2 步：确定坐标映射

矩阵元素 `[r][c]` 要映射到网格上的位置：

```ts
const rows = matrix.length
const cols = matrix[0].length

const { gridWidth, gridDepth, gridHeight } = ctx.coord.grid

const stepX = gridWidth / cols      // 每列的宽度
const stepZ = gridDepth / rows      // 每行的深度

// 第 r 行第 c 列的中心坐标
const x = -gridWidth / 2 + stepX * (c + 0.5)
const z = gridDepth / 2 - stepZ * (r + 0.5)
```

::: tip 为什么是 (c + 0.5)
`gridWidth / 2` 是网格左边缘。`stepX * c` 是第 c 列的**左边缘**。
加 `0.5` 才是这一列的**中心**——立方体应该以列中心为原点。

不加 `0.5` 会让所有立方体整体偏移半格。
:::

---

## 第 3 步：数值 → 高度与颜色

```ts
const flat = matrix.flat().filter(Number.isFinite)
const min = Math.min(...flat)
const max = Math.max(...flat)
const span = max - min || 1

const t = clamp((value - min) / span, 0, 1)   // 归一化到 0~1

// 高度：映射到网格高度的 75%，保证不顶到天花板
const maxHeight = gridHeight * 0.75
const height = Math.max(lerp(0.12, maxHeight, t), 0.05)

// 颜色：连续色带取样
const color = gradientColorAt(gradient, t)
```

`height` 的下限 `0.05` 是为了让接近最小值的立方体仍然可见。

---

## 第 4 步：创建几何体

```ts
const cube = new THREE.Mesh(
  ctx.geometry.box(stepX * 0.92, height, stepZ * 0.92),
  ctx.material(color, {
    preset: 'standard',
    roughness: 0.4,
    metalness: 0.16,
    emissive: color,
    emissiveIntensity: 0.08 + t * 0.18,   // 越高越亮，强化层次
  })
)

// BoxGeometry 中心在原点，所以要抬到高度的一半
cube.position.set(x, height / 2, z)
cube.castShadow = true
cube.receiveShadow = true
```

`0.92` 的系数留出 8% 间隙，让相邻立方体之间有一条可见的缝，避免糊成一片。

::: warning BoxGeometry 的中心在原点
这是最容易踩的坑。`ctx.geometry.box(w, h, d)` 创建的几何体中心在 `(0, 0, 0)`，
所以 `position.y` 必须是 `height / 2` 而不是 `0` 或 `height`。

如果是用 `ExtrudeGeometry` 沿 +Z 挤出再旋转到 Y 轴，底部天然在 `y = 0`，
那时 `position.y` 应该是 `0`。**两种几何体的基准点不同。**
:::

---

## 第 5 步：交互标记

```ts
ctx.pickable(cube, {
  seriesIndex: 0,
  dataIndex: r * cols + c,          // 用行列索引合成唯一 dataIndex
  seriesName: series.name,
  name: `R${r + 1}C${c + 1}`,
  value,
  color,
})
```

`dataIndex` 用 `r * cols + c` 合成，这样点击事件里能反推出是哪一行哪一列：

```ts
const r = Math.floor(p.dataIndex / cols)
const c = p.dataIndex % cols
```

---

## 第 6 步：生长动画

```ts
const targetHeight = height

// 起始状态：压扁在地面上
cube.scale.y = 0.001
cube.position.y = 0

plan.custom(
  (t) => {
    const h = Math.max(0.001, targetHeight * t)
    cube.scale.y = h / targetHeight   // ← 缩放到 h/targetHeight
    cube.position.y = h / 2           // ← 位置同步抬升
  },
  r * cols + c,                        // 逐格错峰
  {
    finish: () => {
      cube.scale.y = 1
      cube.position.y = targetHeight / 2
    },
  }
)
```

::: tip 为什么 scale.y 要除以 targetHeight
因为几何体本身的高度就是 `targetHeight`。
`scale.y = 1` 表示原始高度。

要让实际高度变成 `h`，缩放比例应该是 `h / targetHeight`。

可以直接写 `cube.scale.y = t`（数学上等价，因为 `h = targetHeight * t`）。
写成 `h / targetHeight` 只是让「实际高度」这个意图更明确。
:::

---

## 完整代码

```ts
import * as THREE from 'three'
import { defineChart, clamp, lerp, gradientColorAt } from 'vis-3x'

defineChart({
  type: 'stepTerrain3D',

  render(ctx) {
    const series = ctx.series[0] as unknown as {
      data: number[][]
      colorGradient?: string[]
      name?: string
    }
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
      series.colorGradient ??
      ['#1e3a8a', '#0ea5e9', '#22d3ee', '#34d399', '#fde047', '#fb923c', '#ef4444']

    const { gridWidth, gridDepth, gridHeight } = ctx.coord.grid
    const stepX = gridWidth / cols
    const stepZ = gridDepth / rows
    const maxHeight = gridHeight * 0.75

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

        // 生长动画
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
```

---

## 使用

```ts
import { createChart } from 'vis-3x'
import './step-terrain'   // 触发 defineChart

// 生成一组高程数据
const rows = 12
const cols = 14
const matrix = Array.from({ length: rows }, (_, r) =>
  Array.from({ length: cols }, (_, c) => {
    const x = (c / cols) * Math.PI * 2
    const z = (r / rows) * Math.PI * 2
    return 40 + Math.sin(x) * Math.cos(z) * 30 + Math.sin(x * 2) * 12
  })
)

const chart = createChart('stepTerrain3D', document.getElementById('el')!)

chart.setOption({
  type: 'stepTerrain3D',
  xAxis3D: { show: false },
  zAxis3D: { show: false },
  yAxis3D: { name: '高程', show: true },
  series: [
    {
      type: 'stepTerrain3D',
      name: '高程场',
      data: matrix,
      colorGradient: ['#0f2a5e', '#0ea5e9', '#22d3ee', '#34d399', '#fde047', '#f97316'],
    },
  ],
  gridFloor: { show: true, showWall: true, wallOpacity: 0.1 },
  controlSettings: {
    interactionMode: 'free',
    cameraDirection: { x: 1, y: 1.4, z: 1 },
  },
  animation: { enabled: true, duration: 1000, stagger: 14 },
})
```

---

## 从案例中提炼的经验

**先算坐标，再画图。** 把 `x`、`z` 的推导逻辑写在循环开头，
确认首尾元素都落在网格边界内，再去创建几何体。

**几何体的基准点决定了 position 怎么写。**

| 几何体 | 基准点 | position.y |
|---|---|---|
| `ctx.geometry.box(w, h, d)` | 中心 | `h / 2` |
| `ctx.geometry.cylinder(r, r, h, n)` | 中心 | `h / 2` |
| `ctx.geometry.sphere(r)` | 中心 | `h`（球心在顶端时） |
| `ExtrudeGeometry` 旋转到 Y 轴后 | 底部 | `0` |

**颜色和高度用同一个 `t`。** 这样色带和高度严格对应，
视觉上「越高越暖」的关系是自洽的。

**装饰元素记得排除拾取。** 如果加了顶盖、描边这类元素，
设 `userData.__vtNoPick = true`，否则射线会命中它们而不是主体。

---

## 下一步

- [插件系统](./plugins) — 把这个图表打包分发
- [API · 实例方法](/api/instance)
