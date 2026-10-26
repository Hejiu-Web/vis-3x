# registerChart 注册类

`registerChart` 用于注册一个完整的 `ChartBase` 子类。适合需要控制渲染流程、分组结构、资源生命周期的场景。

这是最底层、也最灵活的扩展方式。

---

## 基本用法

::: code-group

```ts [TypeScript]
import * as THREE from 'three'
import {
  ChartBase,
  registerChart,
  type ResolvedChartOption,
} from 'vis-3x'

class MyChart extends ChartBase {
  get chartType(): string {
    return 'my3D'
  }

  protected renderSeries(option: ResolvedChartOption): void {
    const seriesList = (option.series ?? []).filter((s) => s.type === 'my3D')
    if (!seriesList.length) return

    const plan = this.createTransitionPlan(seriesList[0])

    seriesList.forEach((series) => {
      series.data.forEach((item, i) => {
        const value = extractScalar(item as never)
        const x = this.cartesian.xAtCategory(i)
        const h = this.cartesian.yAt(value)

        const mesh = new THREE.Mesh(
          this.resources.createBox(0.8, h, 0.8),
          this.resources.createMaterial(this.colorAt(i))
        )
        mesh.position.set(x, h / 2, 0)
        this.seriesGroup.add(mesh)

        plan.custom(
          (t) => {
            mesh.scale.y = Math.max(0.001, t)
          },
          i,
          { finish: () => { mesh.scale.y = 1 } }
        )
      })
    })

    plan.run()
    this.keepRenderingWhileAnimating()
  }
}

registerChart('my3D', MyChart, {
  aliases: ['mine'],
  builtin: false,
})
```

```js [JavaScript]
import * as THREE from 'three'
import { ChartBase, registerChart } from 'vis-3x'

class MyChart extends ChartBase {
  // 纯 JavaScript：去掉类型标注与 protected 修饰符
  get chartType() {
    return 'my3D'
  }

  renderSeries(option) {
    const seriesList = (option.series ?? []).filter((s) => s.type === 'my3D')
    if (!seriesList.length) return

    const plan = this.createTransitionPlan(seriesList[0])

    seriesList.forEach((series) => {
      series.data.forEach((item, i) => {
        const value = extractScalar(item)
        const x = this.cartesian.xAtCategory(i)
        const h = this.cartesian.yAt(value)

        const mesh = new THREE.Mesh(
          this.resources.createBox(0.8, h, 0.8),
          this.resources.createMaterial(this.colorAt(i))
        )
        mesh.position.set(x, h / 2, 0)
        this.seriesGroup.add(mesh)

        plan.custom(
          (t) => {
            mesh.scale.y = Math.max(0.001, t)
          },
          i,
          { finish: () => { mesh.scale.y = 1 } }
        )
      })
    })

    plan.run()
    this.keepRenderingWhileAnimating()
  }
}

registerChart('my3D', MyChart, {
  aliases: ['mine'],
  builtin: false,
})
```

:::

---

## registerChart 签名

```ts
registerChart(
  type: string,
  Ctor: ChartConstructor,
  options?: {
    aliases?: string[]
    builtin?: boolean
    /** 覆盖已存在的同名类型。默认 false（会警告并跳过） */
    override?: boolean
  }
): void
```

| 参数 | 说明 |
|---|---|
| `type` | 类型名，全局唯一 |
| `Ctor` | `ChartBase` 的子类构造函数 |
| `aliases` | 别名数组，可以用别名创建图表 |
| `builtin` | 标记为内置。影响 `getBuiltinTypes()` 的返回值 |
| `override` | 是否覆盖同名类型。默认 `false` |

注册后：

```ts
createChart('my3D', el)
createChart('mine', el)     // 别名也能用
```

---

## ChartBase 提供的受保护成员

继承后可以访问这些能力：

### 坐标与配置

| 成员 | 类型 | 说明 |
|---|---|---|
| `this.cartesian` | `Cartesian3D` | 坐标映射（`xAt` / `yAt` / `zAt` / `yDomain` 等） |
| `this.gridConfig` | `{ gridWidth, gridHeight, gridDepth }` | 网格尺寸 |
| `this.option` | `ResolvedChartOption` | 已解析的配置 |
| `this.theme` | `ThemeTokens` | 当前主题 |

### 资源管理

| 成员 | 说明 |
|---|---|
| `this.resources` | 资源管理器。创建的几何体/材质会被登记，销毁时统一释放 |
| `this.resources.createBox(w, h, d)` | 创建立方体 |
| `this.resources.createSphere(r, seg)` | 创建球体 |
| `this.resources.createCylinder(rt, rb, h, seg)` | 创建圆柱 |
| `this.resources.createMaterial(color, style)` | 创建材质（带缓存） |
| `this.resources.trackGeometry(geo)` | 登记自定义几何体 |
| `this.resources.disposeSubtree(obj)` | 释放一个对象及其子树的资源 |

### 场景挂载

| 成员 | 说明 |
|---|---|
| `this.seriesGroup` | 系列分组（每次渲染前自动清空） |
| `this.labels` | 标签管理器（`create` / `update` / `remove` / `clearGroup` / `clear`） |
| `this.engine` | 引擎实例（`scene` / `camera` / `renderer` / `onLoop`） |
| `this.animations` | 动画管理器 |

### 辅助方法

| 方法 | 说明 |
|---|---|
| `this.colorAt(i)` | 按索引取调色板颜色 |
| `this.seriesColors(series, n)` | 取系列的颜色列表 |
| `this.createTransitionPlan(series)` | 创建过渡计划 |
| `this.keepRenderingWhileAnimating()` | 动画期间保持重绘 |
| `this.makePickable(obj, meta)` | 标记可交互对象 |
| `this.createLabel(obj, text, style)` | 创建标签 |
| `this.seriesAnimation(series)` | 取解析后的动画配置 |
| `this.isNonCartesian()` | 覆写以声明非笛卡尔 |

### 需要覆写的方法

| 方法 | 必须 | 说明 |
|---|---|---|
| `get chartType()` | ✅ | 返回类型名 |
| `renderSeries(option)` | ✅ | 绘制逻辑 |
| `isNonCartesian()` | — | 非笛卡尔图表返回 `true` |
| `onChartMounted()` | — | 图表挂载完成时调用 |

---

## 生命周期

```
constructor()
  ↓
onChartMounted()          ← 引擎就绪
  ↓
（首次）setOption()
  ↓
resolveOption()           ← 默认实现在 ChartBase
  ↓
environment.build()       ← 重建坐标轴与网格
  ↓
clearSeries()             ← 清空上一轮
  ↓
renderSeries(option)      ← 你的绘制逻辑
  ↓
fitToScreen()             ← 仅首次
```

数据更新时重复 `setOption` 之后的部分。

---

## 完整示例

```ts
import * as THREE from 'three'
import {
  ChartBase,
  registerChart,
  extractScalar,
  type ResolvedChartOption,
  type Bar3DSeries,
} from 'vis-3x'

class StepPyramidChart extends ChartBase {
  get chartType(): string {
    return 'stepPyramid3D'
  }

  protected isNonCartesian(): boolean {
    return false
  }

  protected renderSeries(option: ResolvedChartOption): void {
    const seriesList = (option.series ?? []).filter(
      (s) => s.type === 'stepPyramid3D'
    ) as Bar3DSeries[]
    if (!seriesList.length) return

    const plan = this.createTransitionPlan(seriesList[0])
    const { gridWidth } = this.gridConfig

    seriesList.forEach((series) => {
      const values = series.data.map((d) => {
        const v = extractScalar(d as never)
        return Number.isFinite(v) && v > 0 ? v : 0
      })
      const maxValue = Math.max(...values, 1)
      const baseWidth = gridWidth * 0.7
      const layerHeight = 0.9

      values.forEach((value, index) => {
        const ratio = Math.max(value / maxValue, 0.1)
        const width = baseWidth * ratio

        // 用资源管理器创建，自动登记
        const geo = this.resources.createBox(width, layerHeight * 0.92, 2.4)
        const mat = this.resources.createMaterial(this.colorAt(index), {
          preset: 'standard',
          roughness: 0.32,
          metalness: 0.28,
        })

        const mesh = new THREE.Mesh(geo, mat)
        const targetY = (values.length - 1 - index) * layerHeight + layerHeight / 2
        mesh.position.set(0, targetY, 0)
        mesh.castShadow = true
        mesh.receiveShadow = true

        this.makePickable(mesh, {
          seriesIndex: 0,
          dataIndex: index,
          seriesName: series.name,
          name: `第 ${index + 1} 层`,
          value,
          color: this.colorAt(index),
        })

        this.seriesGroup.add(mesh)

        // 错峰入场：底层先落位
        plan.custom(
          (t) => {
            mesh.position.y = targetY + (1 - t) * 2.2
          },
          values.length - 1 - index,
          { finish: () => { mesh.position.y = targetY } }
        )
      })
    })

    plan.run()
    this.keepRenderingWhileAnimating()
  }
}

registerChart('stepPyramid3D', StepPyramidChart, {
  aliases: ['pyramid'],
})
```

---

## 与 defineChart 的选择

| | `defineChart` | `registerChart` |
|---|---|---|
| 写法 | 一个函数 | 一个类 |
| 代码量 | 少 | 多 |
| 控制粒度 | 中 | 完全 |
| 能自定义分组结构 | 否 | 是 |
| 能覆写坐标解析 | 否 | 是 |
| 能用于 `extendChart` 的基类 | 可以 | 可以 |

::: tip 建议
**90% 的场景用 `defineChart` 就够了。** 它在内部就是一个 `ChartBase` 子类，只是把常用能力包装成了 `ctx`。

需要 `registerChart` 的信号：
- 你要自定义 `resolveOption` 的解析逻辑
- 你要覆写 `isNonCartesian()` 之外的其他受保护方法
- 你要控制 `seriesGroup` 之外的分组结构
:::

---

## 下一步

- [插件系统](./plugins)
- [完整实战案例](./full-example)
