# defineChart 函数式定义

`defineChart` 是推荐的扩展方式。你只写「怎么画」，库负责坐标、光照、动画、交互、资源回收。

---

## 最小示例

::: code-group

```ts [TypeScript]
import * as THREE from 'three'
import { defineChart, createChart } from 'vis-3x'

defineChart({
  type: 'lollipop3D',
  render(ctx) {
    ctx.series[0].data.forEach((item, i) => {
      const value = typeof item === 'number' ? item : item.value
      const x = ctx.coord.xAtCategory(i)
      const h = ctx.coord.yAt(value)

      const stem = new THREE.Mesh(
        ctx.geometry.cylinder(0.06, 0.06, h, 12),
        ctx.material(ctx.theme.colorAt(i))
      )
      stem.position.set(x, h / 2, 0)
      ctx.add(stem)
    })
  },
})

createChart('lollipop3D', document.getElementById('el')!)
```

```js [JavaScript]
import * as THREE from 'three'
import { defineChart, createChart } from 'vis-3x'

defineChart({
  type: 'lollipop3D',
  render(ctx) {
    ctx.series[0].data.forEach((item, i) => {
      const value = typeof item === 'number' ? item : item.value
      const x = ctx.coord.xAtCategory(i)
      const h = ctx.coord.yAt(value)

      const stem = new THREE.Mesh(
        ctx.geometry.cylinder(0.06, 0.06, h, 12),
        ctx.material(ctx.theme.colorAt(i))
      )
      stem.position.set(x, h / 2, 0)
      ctx.add(stem)
    })
  },
})

createChart('lollipop3D', document.getElementById('el'))
```

:::

注册完成后，这个类型就能像内置图表一样使用：`createChart('lollipop3D', el)`、`<VisChart type="lollipop3D" />`、`series: [{ type: 'lollipop3D' }]` 都可以。

---

## 配置项

```ts
defineChart({
  /** 类型名，全局唯一。重复注册会覆盖并给出警告 */
  type: 'my3D',

  /** 渲染函数。每次 setOption 都会调用 */
  render(ctx) {
    // ...
  },

  /**
   * 是否非笛卡尔图表
   *
   * true 时不渲染坐标轴与网格，showCoordinate 默认 false。
   * 饼图、雷达图、仪表盘这类设 true。
   */
  nonCartesian: false,

  /**
   * 生命周期钩子
   */
  hooks: {
    /** 渲染前调用，可以修改 option */
    beforeRender(ctx) {},
    /** 渲染后调用，适合加装饰元素 */
    afterRender(ctx) {},
    /** 数据更新时调用（区别于首次渲染） */
    onUpdate(ctx) {},
    /** 销毁时调用，清理你自己创建的额外资源 */
    onDispose() {},
  },

  /**
   * 配置预处理
   *
   * 给 series 补默认值，或把用户的简写展开成完整结构。
   */
  resolveOption(option) {
    return option
  },
})
```

| 字段 | 类型 | 必填 | 说明 |
|---|---|---|---|
| `type` | `string` | ✅ | 类型名 |
| `render` | `(ctx) => void` | ✅ | 渲染函数 |
| `nonCartesian` | `boolean` | — | 是否非笛卡尔（默认 `false`） |
| `hooks` | `object` | — | 生命周期钩子 |
| `resolveOption` | `(option) => option` | — | 配置预处理 |

---

## 完整示例：环形进度条

这个例子覆盖了坐标映射、几何体、动画、交互、标签。

```ts
import * as THREE from 'three'
import { defineChart, degToRad } from 'vis-3x'

defineChart({
  type: 'ringProgress3D',
  nonCartesian: true,

  // 给 series 补默认值
  resolveOption(option) {
    option.series?.forEach((s) => {
      ;(s as any).max ??= 100
    })
    return option
  },

  render(ctx) {
    const series = ctx.series[0]
    const values = series.data.map((d) =>
      typeof d === 'number' ? d : (d as any).value
    )
    const maxValue = (series as any).max ?? 100
    const colors = series.color?.length ? series.color : ctx.theme.palette

    const ringWidth = 0.34
    const gap = 0.12
    const baseRadius = 2.9
    const depth = 0.32

    // ① 拿到本轮渲染的过渡计划
    const plan = ctx.transition

    values.forEach((value, index) => {
      const radius = baseRadius - index * (ringWidth + gap)
      if (radius <= ringWidth) return

      const color = colors[index % colors.length]
      const ratio = Math.min(Math.max(value / maxValue, 0), 1)

      // ② 构建一段扇环几何体
      const buildArc = (fromDeg: number, toDeg: number, mat: THREE.Material) => {
        const inner = radius - ringWidth / 2
        const outer = radius + ringWidth / 2
        const a0 = degToRad(fromDeg)
        const a1 = degToRad(toDeg)
        const segments = Math.max(8, Math.ceil(Math.abs(fromDeg - toDeg) / 3))

        const shape = new THREE.Shape()
        for (let i = 0; i <= segments; i++) {
          const a = a0 + (a1 - a0) * (i / segments)
          const px = Math.cos(a) * outer
          const py = Math.sin(a) * outer
          i === 0 ? shape.moveTo(px, py) : shape.lineTo(px, py)
        }
        for (let i = segments; i >= 0; i--) {
          const a = a0 + (a1 - a0) * (i / segments)
          shape.lineTo(Math.cos(a) * inner, Math.sin(a) * inner)
        }
        shape.closePath()

        // ③ 用 ctx.geometry 创建，自动登记资源
        return new THREE.Mesh(
          ctx.geometry.extrude(shape, depth, {
            bevelEnabled: true,
            bevelThickness: 0.012,
            bevelSize: 0.012,
            bevelSegments: 1,
          }),
          mat
        )
      }

      // 背景轨道
      ctx.add(
        buildArc(
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
      )

      // 进度弧
      const sweep = 359.9 * ratio
      if (sweep > 0.5) {
        const arc = buildArc(
          90,
          90 - sweep,
          ctx.material(color, {
            preset: 'standard',
            roughness: 0.25,
            metalness: 0.4,
            emissive: color,
            emissiveIntensity: 0.35,
          })
        )

        // ④ 标记为可交互
        ctx.pickable(arc, {
          seriesIndex: 0,
          dataIndex: index,
          name: `指标 ${index + 1}`,
          value,
          color,
        })
        ctx.add(arc)

        // ⑤ 登记动画：从中心向外扩张
        plan.custom(
          (t) => {
            const s = Math.max(0.001, t)
            arc.scale.set(s, s, 1)
          },
          index,
          { finish: () => arc.scale.set(1, 1, 1) }
        )
      }

      // ⑥ 标签
      if ((series as any).label?.show !== false) {
        const endAngle = degToRad(90 - sweep - 6)
        const labelRadius = radius + ringWidth * 0.9
        ctx.anchor(
          Math.cos(endAngle) * labelRadius,
          0.22,
          -Math.sin(endAngle) * labelRadius,
          `${Math.round(ratio * 100)}%`
        )
      }
    })

    // ⑦ 启动动画
    plan.run()
    ctx.keepAnimating()
  },
})
```

::: tip 上面用到的 `shade` 工具
`import { shade } from 'vis-3x'` — 把颜色调亮或调暗：

```ts
shade('#4f8cff', -0.4)   // 变暗 40%
shade('#4f8cff', 0.3)    // 变亮 30%
```
:::

---

## 渲染函数的执行时机

`render` 会在**每次 `setOption` 时**完整执行一遍。

这意味着：

- 不需要手动清理上一轮的网格——库在调用 `render` 前已经清空了 series 分组
- 每次执行都创建新的几何体与网格，所以**不要在 `render` 外面缓存网格对象**
- `ctx.transition` 每次都是新的（所以数据更新时也能播动画）

```ts
// ✗ 错误：在闭包外缓存
let cachedMesh: THREE.Mesh | null = null

defineChart({
  type: 'bad',
  render(ctx) {
    if (!cachedMesh) cachedMesh = new THREE.Mesh(...)
    ctx.add(cachedMesh)   // 第二次渲染时这个网格已被销毁
  },
})

// ✓ 正确：每次重新创建
defineChart({
  type: 'good',
  render(ctx) {
    const mesh = new THREE.Mesh(...)
    ctx.add(mesh)
  },
})
```

---

## 非笛卡尔图表

饼图、雷达图这类不使用 X/Y/Z 直角坐标系的图表，设 `nonCartesian: true`：

```ts
defineChart({
  type: 'myPie3D',
  nonCartesian: true,   // 不渲染坐标轴、网格、地面
  render(ctx) {
    // 自己用极坐标计算位置
  },
})
```

设为 `true` 后：

- 不渲染坐标轴
- 不渲染地面网格
- `showCoordinate` 默认为 `false`（用户仍可显式开启）
- `ctx.coord` 仍然可用，但映射结果没有实际意义

---

## 错误处理

`defineChart` 会在注册时校验必填字段：

```ts
defineChart({ type: 'x' })
// Error: [vis-3x] defineChart("x"): render 必须是函数

defineChart({ render() {} })
// Error: [vis-3x] defineChart: 缺少 type
```

`render` 内部抛出的异常会被库捕获并打印，**不会导致整个页面崩溃**——但该图表的这一帧渲染会中断。

建议在开发阶段不要吞掉异常，方便定位：

```ts
render(ctx) {
  try {
    // ...
  } catch (e) {
    console.error('[my3D] 渲染失败', e)
    throw e
  }
}
```

---

## 下一步

- [渲染上下文 ctx 完整参考](./render-context)
- [完整实战案例](./full-example)
- [插件系统](./plugins)
