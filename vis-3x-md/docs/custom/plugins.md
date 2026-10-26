# 插件系统

插件把一组相关的图表类型打成一个可分发的单元。适合把自己写的扩展图表整理成独立的 npm 包，或者在公司内部共享图表库。

---

## 插件结构

```ts
interface ChartPlugin {
  /** 插件名，必须唯一。用于去重 */
  name: string
  /** 安装函数 */
  install(ctx: ChartPluginContext): void
}

interface ChartPluginContext {
  registerChart: typeof registerChart
  defineChart: typeof defineChart
  extendChart: typeof extendChart
  getRegisteredTypes: typeof getRegisteredTypes
}
```

---

## 最小插件

```ts
import { useChartPlugin } from 'vis-3x'

useChartPlugin({
  name: 'my-charts',
  install({ defineChart }) {
    defineChart({
      type: 'lollipop3D',
      render(ctx) {
        // ...
      },
    })
  },
})
```

安装后 `lollipop3D` 就是一个可用类型了。

---

## 安装方式

### 手动安装

```ts
import { useChartPlugin } from 'vis-3x'
import { myPlugin } from './my-plugin'

useChartPlugin(myPlugin)
```

### 作为 Vue 插件选项

```ts
import { createApp } from 'vue'
import Vis3x from 'vis-3x'
import { myPlugin } from './my-plugin'

createApp(App)
  .use(Vis3x, {
    plugins: [myPlugin],
  })
  .mount('#app')
```

---

## 幂等性

同名插件只安装一次：

```ts
useChartPlugin(myPlugin)
useChartPlugin(myPlugin)   // 直接返回，不会重复注册
```

这让插件可以被多处安全引入——比如两个组件各自 `import` 了同一个插件模块。

---

## 完整示例：一个图表包

```ts
// my-charts-plugin.ts
import * as THREE from 'three'
import type { ChartPlugin } from 'vis-3x'

export const myChartsPlugin: ChartPlugin = {
  name: 'my-charts',

  install({ defineChart, extendChart }) {
    // ① 函数式定义的图表
    defineChart({
      type: 'lollipop3D',
      render(ctx) {
        const series = ctx.series[0]
        const plan = ctx.transition

        series.data.forEach((item, i) => {
          const value = typeof item === 'number' ? item : (item as any).value
          const x = ctx.coord.xAtCategory(i)
          const h = Math.max(ctx.coord.yAt(value), 0.0001)
          const color = ctx.theme.colorAt(i)

          const stem = new THREE.Mesh(
            ctx.geometry.cylinder(0.055, 0.055, h, 12),
            ctx.material(color, { roughness: 0.4, metalness: 0.3 })
          )
          stem.position.set(x, h / 2, 0)
          ctx.add(stem)

          const ball = new THREE.Mesh(
            ctx.geometry.sphere(0.22, 22),
            ctx.material(color, {
              roughness: 0.2,
              metalness: 0.35,
              emissive: color,
              emissiveIntensity: 0.35,
            })
          )
          ball.position.set(x, h, 0)
          ctx.pickable(ball, {
            seriesIndex: 0,
            dataIndex: i,
            name: ctx.coord.categoryName(i),
            value,
            color,
          })
          ctx.add(ball)

          plan.custom(
            (t) => {
              const hh = Math.max(0.0001, h * t)
              stem.scale.y = hh / h
              stem.position.y = hh / 2
              ball.position.y = hh
            },
            i,
            {
              finish: () => {
                stem.scale.y = 1
                stem.position.y = h / 2
                ball.position.y = h
              },
            }
          )
        })

        plan.run()
        ctx.keepAnimating()
      },
    })

    // ② 继承内置图表
    extendChart('bar3D', {
      type: 'barWithTrend3D',
      afterRender(ctx) {
        // 加趋势线
      },
    })
  },
}
```

使用：

```ts
import { createChart, useChartPlugin } from 'vis-3x'
import { myChartsPlugin } from './my-charts-plugin'

useChartPlugin(myChartsPlugin)

createChart('lollipop3D', document.getElementById('el')!)
```

---

## 打包成 npm 包

如果要把插件发布出去，`package.json` 参考：

```json
{
  "name": "vis-3x-charts-extra",
  "version": "1.0.0",
  "type": "module",
  "main": "./dist/index.cjs",
  "module": "./dist/index.js",
  "types": "./dist/index.d.ts",
  "exports": {
    ".": {
      "types": "./dist/index.d.ts",
      "import": "./dist/index.js",
      "require": "./dist/index.cjs"
    }
  },
  "peerDependencies": {
    "vis-3x": ">=0.1.0",
    "three": ">=0.160.0"
  }
}
```

::: warning 把 vis-3x 和 three 设为 peerDependencies
不要打包进产物。原因：

1. **`three` 出现两份实例会导致 `instanceof` 判断失效**，库内部的类型检查会失灵
2. **`vis-3x` 出现两份会导致注册表不共享**，插件注册的图表在主库里找不到

构建配置里记得 external：

```ts
// vite.config.ts
build: {
  rollupOptions: {
    external: ['vis-3x', 'three', /^three\/.*/],
  },
}
```
:::

---

## 用插件共享主题

插件上下文没有直接的 `themes` 注册入口，但可以导出一个配置对象：

```ts
// my-plugin.ts
export const myTheme = {
  palette: ['#ff6b6b', '#4ecdc4', '#ffe66d'],
  backgroundColor: '#12121a',
  textColor: '#a8a8b3',
}

export const myPlugin: ChartPlugin = {
  name: 'my-charts',
  install({ defineChart }) {
    /* 注册图表 */
  },
}
```

使用者自行组合：

```ts
import { myTheme, myPlugin } from 'vis-3x-charts-extra'
import { useChartPlugin } from 'vis-3x'

useChartPlugin(myPlugin)

const option = {
  theme: myTheme,
  series: [{ type: 'lollipop3D', data: [30, 60, 45] }],
}
```

---

## 检查已注册的类型

```ts
import { getRegisteredTypes, hasChartType } from 'vis-3x'

console.log(getRegisteredTypes())
// ['bar3D', 'line3D', ..., 'lollipop3D']

console.log(hasChartType('lollipop3D'))   // true
```

用于调试插件是否正确安装。

---

## 官方示例：presets 插件

库里自带的 6 个扩展示例图表就是一个插件式模块：

```ts
import { useExtraCharts } from 'vis-3x/presets'

useExtraCharts()   // 一次性注册 6 个图表
```

它的实现就是把这些 `defineChart` 调用包在一个 `install` 函数里。

**这 6 个图表的源码在 `presets/extra-charts.ts`，是学习自定义图表最好的材料**——它们全部用公开 API 实现，没有任何内部特权。

---

## 下一步

- [完整实战案例](./full-example)
- [API · 实例方法](/api/instance)
