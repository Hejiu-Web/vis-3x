# 自定义图表 · 概览

vis-3x 提供四种扩展方式，覆盖从「改一点」到「从零实现」的全部场景。

| 方式 | 改动量 | 适用场景 |
|---|---|---|
| [`defineChart`](#definechart) | 小 | 从零定义一个全新图表 |
| [`extendChart`](#extendchart) | 最小 | 在内置图表基础上加东西 |
| [`registerChart`](#registerchart) | 中 | 已有 ChartBase 子类，想注册进去 |
| [插件](#插件) | 打包用 | 把一组图表 + 主题 + 适配器打成一个包 |

---

## defineChart

**函数式定义**。只写一个 `render` 函数，库负责其余一切。

::: code-group

```ts [TypeScript]
import * as THREE from 'three'
import { defineChart, createChart } from 'vis-3x'

defineChart({
  type: 'lollipop3D',
  render(ctx) {
    const series = ctx.series[0]

    series.data.forEach((item, i) => {
      const value = typeof item === 'number' ? item : item.value
      const x = ctx.coord.xAtCategory(i)     // 类目索引 → 世界 X
      const h = ctx.coord.yAt(value)         // 数值 → 世界 Y
      const color = ctx.theme.colorAt(i)

      // 细杆
      const stem = new THREE.Mesh(
        ctx.geometry.cylinder(0.06, 0.06, h, 12),
        ctx.material(color)
      )
      stem.position.set(x, h / 2, 0)
      ctx.add(stem)

      // 顶部圆球
      const ball = new THREE.Mesh(ctx.geometry.sphere(0.22, 20), ctx.material(color))
      ball.position.set(x, h, 0)
      ctx.pickable(ball, { seriesIndex: 0, dataIndex: i, value, color })
      ctx.add(ball)
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
    const series = ctx.series[0]

    series.data.forEach((item, i) => {
      const value = typeof item === 'number' ? item : item.value
      const x = ctx.coord.xAtCategory(i)     // 类目索引 → 世界 X
      const h = ctx.coord.yAt(value)         // 数值 → 世界 Y
      const color = ctx.theme.colorAt(i)

      // 细杆
      const stem = new THREE.Mesh(
        ctx.geometry.cylinder(0.06, 0.06, h, 12),
        ctx.material(color)
      )
      stem.position.set(x, h / 2, 0)
      ctx.add(stem)

      // 顶部圆球
      const ball = new THREE.Mesh(ctx.geometry.sphere(0.22, 20), ctx.material(color))
      ball.position.set(x, h, 0)
      ctx.pickable(ball, { seriesIndex: 0, dataIndex: i, value, color })
      ctx.add(ball)
    })
  },
})

createChart('lollipop3D', document.getElementById('el'))
```

:::

就这么简单。`ctx` 提供了坐标映射、几何体、材质、标签、交互标记的全部能力。

→ 详见 [defineChart 函数式定义](./define-chart)

---

## extendChart

**继承改写**。在内置图表的基础上追加内容，复用父类的全部绘制逻辑。

```ts
import { extendChart } from 'vis-3x'

extendChart('bar3D', {
  type: 'barWithTrend3D',

  // 父类画完柱子后调用
  afterRender(ctx) {
    // 在柱顶连一条趋势线
    const points = ctx.series[0].data.map((item, i) => {
      const v = typeof item === 'number' ? item : item.value
      return new THREE.Vector3(ctx.coord.xAtCategory(i), ctx.coord.yAt(v) + 0.3, 0)
    })

    const line = new THREE.Mesh(
      ctx.geometry.tube(points, 0.05, 60),
      ctx.material('#fbbf24')
    )
    ctx.add(line)
  },
})
```

→ 详见 [extendChart 继承改写](./extend-chart)

---

## registerChart

**注册类**。适合已经有 `ChartBase` 子类、需要精细控制渲染流程的场景。

```ts
import { ChartBase, registerChart } from 'vis-3x'

class MyChart extends ChartBase {
  get chartType() {
    return 'my3D'
  }

  protected renderSeries(option: ResolvedChartOption): void {
    // 完全控制渲染流程
  }
}

registerChart('my3D', MyChart, { aliases: ['my'] })
```

→ 详见 [registerChart 注册类](./register-chart)

---

## 插件

把一组相关的图表、主题、适配器打成一个可复用单元：

```ts
import { useChartPlugin } from 'vis-3x'

useChartPlugin({
  name: 'my-suite',
  install(api) {
    api.registerChart('a3D', AChart)
    api.registerChart('b3D', BChart)
    api.themes.myTheme = myTheme
  },
})
```

→ 详见 [插件系统](./plugins)

---

## 什么时候用哪个

::: tip 决策建议

**要加的东西 > 50 行，且与父类逻辑无关** → 用 `defineChart` 从零写。继承反而更难维护。

**在内置图表上补一点东西**（标注、辅助线、第二个坐标系）→ 用 `extendChart`。父类的坐标计算、动画、交互全部白送。

**需要控制渲染顺序、分组、资源生命周期** → 用 `registerChart` 继承 `ChartBase`。

**要做成可分发的包** → 用插件。
:::

---

## 关键概念

### ctx.transition — 统一的动画

自定义图表**不需要自己写动画循环**。用 `ctx.transition` 登记，与内置图表共用同一套系统：

```ts
const plan = ctx.transition
plan.scaleY(mesh, dataIndex)    // 从底部生长
plan.fade(mesh, dataIndex)      // 淡入
plan.custom(fn, dataIndex)      // 自定义插值

plan.run()                      // 统一启动
ctx.keepAnimating()             // 动画期间保持重绘
```

### ctx.geometry / ctx.material — 自动资源管理

```ts
// ✓ 自动登记，销毁时释放
ctx.geometry.box(1, 1, 1)
ctx.material('#4f8cff', { roughness: 0.3 })

// ✗ 需要自己 dispose
new THREE.BoxGeometry(1, 1, 1)
```

材质还带**参数缓存**：相同参数只创建一个实例，减少 GL 状态切换。

### ctx.pickable — 接入事件系统

```ts
ctx.pickable(mesh, {
  seriesIndex: 0,
  dataIndex: i,
  name: ctx.coord.categoryName(i),
  value,
  color,
})
```

标记后，这个对象会自动参与射线检测，`chart:click` / `chart:mouseover` 都能命中，tooltip 也会显示。

---

## 下一步

- [defineChart 函数式定义](./define-chart)
- [渲染上下文 ctx 完整参考](./render-context)
- [完整实战案例](./full-example)
