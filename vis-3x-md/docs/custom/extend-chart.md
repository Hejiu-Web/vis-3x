# extendChart 继承改写

`extendChart` 在**内置图表的基础上**创建新类型。父类的绘制逻辑全部保留，你只追加或微调。

这比 `defineChart` 从零写省事得多——坐标计算、动画、交互、资源管理都是白送的。

---

## 基本用法

::: code-group

```ts [TypeScript]
import * as THREE from 'three'
import { extendChart } from 'vis-3x'

extendChart('bar3D', {
  type: 'barWithTrend3D',

  // 父类（柱状图）绘制完成后调用
  afterRender(ctx) {
    const series = ctx.series[0]
    const points = series.data.map((item, i) => {
      const v = typeof item === 'number' ? item : (item as any).value
      return new THREE.Vector3(
        ctx.coord.xAtCategory(i),
        ctx.coord.yAt(v) + 0.35,
        0
      )
    })

    if (points.length < 2) return

    const line = new THREE.Mesh(
      ctx.geometry.tube(points, 0.05, 80),
      ctx.material('#fbbf24', {
        preset: 'standard',
        roughness: 0.2,
        metalness: 0.5,
        emissive: '#fbbf24',
        emissiveIntensity: 0.3,
      })
    )
    line.userData.__vtNoPick = true   // 装饰元素，不参与拾取
    ctx.add(line)
  },
})
```

```js [JavaScript]
import * as THREE from 'three'
import { extendChart } from 'vis-3x'

extendChart('bar3D', {
  type: 'barWithTrend3D',

  // 父类（柱状图）绘制完成后调用
  afterRender(ctx) {
    const series = ctx.series[0]
    const points = series.data.map((item, i) => {
      const v = typeof item === 'number' ? item : (item).value
      return new THREE.Vector3(
        ctx.coord.xAtCategory(i),
        ctx.coord.yAt(v) + 0.35,
        0
      )
    })

    if (points.length < 2) return

    const line = new THREE.Mesh(
      ctx.geometry.tube(points, 0.05, 80),
      ctx.material('#fbbf24', {
        preset: 'standard',
        roughness: 0.2,
        metalness: 0.5,
        emissive: '#fbbf24',
        emissiveIntensity: 0.3,
      })
    )
    line.userData.__vtNoPick = true   // 装饰元素，不参与拾取
    ctx.add(line)
  },
})
```

:::

用法与内置图表完全一致：

```vue
<VisChart type="barWithTrend3D" :option="option" />
```

---

## 配置项

```ts
extendChart('bar3D', {
  /** 新类型名 */
  type: 'myChart3D',

  /** 渲染前。可以改 option，或画底层内容 */
  beforeRender(ctx) {},

  /** 父类渲染完成后。适合加装饰、标注、辅助元素 */
  afterRender(ctx) {},

  /** 覆盖「是否非笛卡尔」的判定 */
  nonCartesian: false,

  /** 配置预处理 */
  resolveOption(option) {
    return option
  },

  /** 类型别名 */
  aliases: ['myChart'],
})
```

| 字段 | 类型 | 说明 |
|---|---|---|
| `type` | `string` | 必填，新类型名 |
| `beforeRender` | `(ctx) => void` | 父类渲染**前**调用 |
| `afterRender` | `(ctx) => void` | 父类渲染**后**调用 |
| `nonCartesian` | `boolean` | 覆盖父类的判定 |
| `resolveOption` | `(option) => option` | 配置预处理 |
| `aliases` | `string[]` | 别名 |

---

## 执行顺序

```
setOption()
  ↓
beforeRender(ctx)      ← 你可以在父类画之前动手
  ↓
父类 renderSeries()    ← 内置图表的绘制逻辑
  ↓
afterRender(ctx)       ← 你在父类画完之后追加
```

::: tip 动画是共享的
`beforeRender` / `afterRender` 里的 `ctx.transition` 与父类用的是**同一个 plan**。

这意味着你登记的动画会和父类的动画同步启动，不会各跑各的：

```ts
afterRender(ctx) {
  const plan = ctx.transition       // 复用父类的 plan
  plan.custom((t) => { /* ... */ }, 0, { extraDelay: 120 })
  plan.run()                        // 幂等，重复调用安全
  ctx.keepAnimating()
}
```
:::

---

## 实战：柱线组合图

这是库内置的扩展示例（`barLine3D`）的实现思路——用柱状图打底，叠加折线。

```ts
import * as THREE from 'three'
import { extendChart, catmullRomSpline } from 'vis-3x'

extendChart('bar3D', {
  type: 'barLine3D',

  afterRender(ctx) {
    const plan = ctx.transition

    // 约定：type 为 line3D 的系列画成折线，其余由父类画成柱子
    const lineSeries = ctx.allSeries.filter((s) => s.type === 'line3D')
    if (!lineSeries.length) {
      plan.run()
      ctx.keepAnimating()
      return
    }

    lineSeries.forEach((series, seriesIndex) => {
      const color = series.color?.[0] ?? ctx.theme.colorAt(seriesIndex)
      const lineZ = ctx.coord.grid.gridDepth / 2 + 0.42   // 放在网格最前方

      const points: THREE.Vector3[] = []
      series.data.forEach((item, i) => {
        const v = typeof item === 'number' ? item : (item as any).value
        if (!Number.isFinite(v)) return
        points.push(
          new THREE.Vector3(ctx.coord.xAtCategory(i), ctx.coord.yAt(v), lineZ)
        )
      })

      if (points.length < 2) return

      // 平滑插值
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

      // 折线从底部向上生长，比柱子晚一点，形成层次
      plan.custom(
        (t) => {
          line.scale.y = Math.max(0.001, t)
        },
        seriesIndex,
        {
          extraDelay: 120,
          finish: () => {
            line.scale.y = 1
          },
        }
      )

      // 数据点（可交互）
      points.forEach((p, i) => {
        const dot = new THREE.Mesh(
          ctx.geometry.sphere(0.11, 16),
          ctx.material('#ffffff', { roughness: 0.15, metalness: 0.5 })
        )
        dot.position.copy(p)
        ctx.pickable(dot, {
          seriesIndex: ctx.allSeries.indexOf(series),
          dataIndex: i,
          seriesName: series.name,
          name: ctx.coord.categoryName(i),
          value: typeof series.data[i] === 'number' ? (series.data[i] as number) : 0,
          color,
        })
        ctx.add(dot)
      })
    })

    plan.run()
    ctx.keepAnimating()
  },
})
```

用法：

```ts
const option = {
  xAxis3D: { data: ['Q1', 'Q2', 'Q3', 'Q4'] },
  series: [
    // 这根是柱子（父类处理）
    { type: 'bar3D', name: '销量', data: [120, 200, 150, 180] },
    // 这根是折线（afterRender 处理）
    { type: 'line3D', name: '趋势', data: [130, 180, 165, 195] },
  ],
}
```

::: tip 用 series.type 区分处理方式
`extendChart` 的常见模式是：**父类处理一种 series 类型，你处理另一种**。

这样同一个图表就能混合多种视觉形式，而不需要写完整的渲染逻辑。
:::

---

## 什么时候用 extendChart

::: tip 适合

- 在内置图表上**追加**元素（趋势线、标注、目标线、分界线）
- 组合两种图表（柱 + 线、柱 + 散点）
- 微调父类的某个视觉细节
- 想复用父类的坐标计算，但换一套几何体

:::

::: warning 不适合

- **要改父类的核心绘制方式**（比如把柱子换成圆锥）——这种情况 `defineChart` 从零写更清楚
- **要改坐标映射规则**——`beforeRender` 里改 option 效果有限，容易出意外
- **要删掉父类画的东西**——`afterRender` 只能追加，删不掉

:::

---

## 只改配置不改绘制

如果只是想给内置图表换个默认值，用 `resolveOption` 就够了：

```ts
extendChart('bar3D', {
  type: 'thickBar3D',
  resolveOption(option) {
    option.series?.forEach((s) => {
      const bar = s as { barCategoryGap?: number }
      bar.barCategoryGap ??= 0.15   // 空隙更小 = 柱子更粗
    })
    return option
  },
})
```

这比 `afterRender` 更轻量——不额外创建任何几何体。

---

## 与 registerChart 的区别

| | `extendChart` | `registerChart` |
|---|---|---|
| 输入 | 已有类型的名字 | 一个 `ChartBase` 子类 |
| 复用 | 父类的全部渲染逻辑 | 自己写 |
| 能改什么 | 只能追加 | 全部 |
| 代码量 | 少 | 多 |
| 适合 | 组合、标注 | 全新渲染流程 |

`extendChart` 内部就是创建一个继承父类的新类并注册。需要更深控制时用 [`registerChart`](./register-chart)。

---

## 下一步

- [registerChart 注册类](./register-chart)
- [插件系统](./plugins)
- [完整实战案例](./full-example)
