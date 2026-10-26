# 四种使用方式

同一套渲染内核，四种接入方式。选哪个取决于你的项目形态，不取决于功能——**它们能力完全等价**。

| 方式 | 适用场景 | 是否依赖 Vue |
|---|---|---|
| [Vue 组件](#vue-组件) | 常规 Vue 3 项目 | 是 |
| [组合式 API](#组合式-api) | 需要精细控制挂载/卸载时机 | 是 |
| [命令式 API](#命令式-api) | 非 Vue 项目、动态创建图表 | 否 |
| [CDN 引入](#cdn-引入) | 静态页面、快速原型 | 可选 |

::: tip TypeScript 与 JavaScript 通用
下面每种方式都给的是 TypeScript 写法。**去掉类型标注就是合法的 JavaScript**，
两者运行时行为完全一致。

- `import type { Vis3xOption } from 'vis-3x'` → 删掉整行
- `const option: Vis3xOption = {...}` → `const option = {...}`
- `ref<HTMLDivElement>()` → `ref()`
- `<script setup lang="ts">` → `<script setup>`

完整的 JS 说明见[纯 JavaScript 使用](./javascript)。
:::

---

## Vue 组件

最常用的方式。全局注册后直接用：

::: code-group

```ts [main.ts]
import { createApp } from 'vue'
import Vis3x from 'vis-3x'
import 'vis-3x/style.css'

createApp(App).use(Vis3x).mount('#app')
```

```js [main.js]
// 纯 JavaScript：文件名换成 .js，内容一模一样
import { createApp } from 'vue'
import Vis3x from 'vis-3x'
import 'vis-3x/style.css'

createApp(App).use(Vis3x).mount('#app')
```

:::

```vue
<template>
  <VisBar3D :option="option" />
</template>
```

或者按需引入单个组件：

```vue
<script setup lang="ts">
import { VisLine3D } from 'vis-3x'
import 'vis-3x/style.css'

const option = {
  xAxis3D: { data: ['A', 'B', 'C'] },
  // 用 VisLine3D 时 series[].type 可以省略，组件会自动补全为 'line3D'
  series: [{ data: [10, 40, 25] }],
}
</script>
```

### 组件 props

| prop | 类型 | 默认 | 说明 |
|---|---|---|---|
| `option` | `Vis3xOption` | 必填 | 图表配置 |
| `width` | `string \| number` | `'100%'` | 容器宽度 |
| `height` | `string \| number` | `'100%'` | 容器高度 |
| `palette` | `string[]` | — | 调色板快捷设置 |
| `interactionMode` | `'free' \| 'rotate' \| 'fixed'` | — | 相机交互模式 |
| `loading` | `boolean` | `false` | 显示加载遮罩 |
| `containerStyle` | `CSSProperties` | — | 额外容器样式 |

### 通过 ref 调用实例方法

```vue
<script setup lang="ts">
import { ref } from 'vue'

const chartRef = ref()

function handleExport() {
  const url = chartRef.value.exportImage({ scale: 2 })
  const a = document.createElement('a')
  a.href = url
  a.download = 'chart.png'
  a.click()
}
</script>

<template>
  <div>
    <button @click="handleExport">导出</button>
    <button @click="chartRef?.resetCamera()">重置视角</button>
    <div style="height: 460px">
      <VisBar3D ref="chartRef" :option="option" />
    </div>
  </div>
</template>
```

完整方法列表见[实例方法](/api/instance)。

---

## 组合式 API

适合需要自己掌控挂载时机、或模板结构特殊的场景。

::: code-group

```vue [TypeScript]
<script setup lang="ts">
import { ref } from 'vue'
import { useVisChart, type Vis3xOption } from 'vis-3x'
import 'vis-3x/style.css'

const container = ref<HTMLDivElement>()

const option = ref<Vis3xOption>({
  xAxis3D: { data: ['A', 'B', 'C'] },
  series: [{ type: 'bar3D', data: [10, 20, 30] }],
})

const { chart, isReady, exportImage, resize, fitToScreen, resetCamera, setOption } =
  useVisChart({
    container,
    option,
    // 可选：指定图表类型。不传则按 series[0].type 推断
    // type: 'bar3D',
    // 可选：是否自动监听 option 变化，默认 true
    // autoUpdate: true,
  })
</script>

<template>
  <div>
    <div class="toolbar">
      <span v-if="!isReady">加载中…</span>
      <button @click="exportImage({ scale: 2 })">导出</button>
      <button @click="fitToScreen()">适应屏幕</button>
      <button @click="resetCamera()">重置视角</button>
    </div>
    <div ref="container" style="height: 460px" />
  </div>
</template>
```

```vue [JavaScript]
<script setup>
// 纯 JavaScript：ref() 不传泛型，也不 import type
import { ref } from 'vue'
import { useVisChart } from 'vis-3x'
import 'vis-3x/style.css'

const container = ref()

const option = ref({
  xAxis3D: { data: ['A', 'B', 'C'] },
  series: [{ type: 'bar3D', data: [10, 20, 30] }],
})

const { chart, isReady, exportImage, resize, fitToScreen, resetCamera, setOption } =
  useVisChart({
    container,
    option,
    // 可选：指定图表类型。不传则按 series[0].type 推断
    // type: 'bar3D',
    // 可选：是否自动监听 option 变化，默认 true
    // autoUpdate: true,
  })
</script>

<template>
  <div>
    <div class="toolbar">
      <span v-if="!isReady">加载中…</span>
      <button @click="exportImage({ scale: 2 })">导出</button>
      <button @click="fitToScreen()">适应屏幕</button>
      <button @click="resetCamera()">重置视角</button>
    </div>
    <div ref="container" style="height: 460px" />
  </div>
</template>
```

:::

### useVisChart 返回值

| 字段 | 类型 | 说明 |
|---|---|---|
| `chart` | `Ref<ChartBase \| null>` | 底层图表实例 |
| `isReady` | `Ref<boolean>` | 是否已就绪 |
| `exportImage` | `(opts?) => string` | 导出 PNG |
| `resize` | `() => void` | 重算尺寸 |
| `fitToScreen` | `() => void` | 相机自适应 |
| `resetCamera` | `() => void` | 重置视角 |
| `setOption` | `(o) => void` | 手动更新配置 |
| `on` | `(event, cb) => Unsubscribe` | 订阅事件 |
| `remount` | `() => void` | 重新挂载 |

---

## 命令式 API

**不需要 Vue**。适合在 React / Svelte / 原生页面里使用。

```js
import { createChart } from 'vis-3x'
import 'vis-3x/style.css'

const chart = createChart('bar3D', document.getElementById('chart'))

chart.setOption({
  xAxis3D: { data: ['A', 'B', 'C', 'D'] },
  series: [{ type: 'bar3D', data: [30, 80, 45, 95] }],
})

// 订阅事件
const off = chart.on('chart:click', (payload) => {
  console.log(payload.name, payload.value)
})

// 数据更新（带过渡动画）
chart.setOption({
  xAxis3D: { data: ['A', 'B', 'C', 'D'] },
  series: [{ type: 'bar3D', data: [60, 40, 90, 55] }],
})

// 不再使用时销毁，释放 WebGL 资源
// off()
// chart.dispose()
```

::: warning 记得 dispose
命令式用法下，**库无法感知组件生命周期**。如果图表是在路由切换时创建的，
离开页面必须手动调用 `chart.dispose()`，否则 WebGL 上下文会累积，
浏览器通常限制在 8~16 个，超出后新图表会创建失败。
:::

### 在 React 中使用

```tsx
import { useEffect, useRef } from 'react'
import { createChart } from 'vis-3x'
import 'vis-3x/style.css'

export function BarChart({ data }: { data: number[] }) {
  const ref = useRef<HTMLDivElement>(null)
  const chartRef = useRef<ReturnType<typeof createChart> | null>(null)

  useEffect(() => {
    if (!ref.current) return

    const chart = createChart('bar3D', ref.current)
    chartRef.current = chart

    return () => {
      chart.dispose()
      chartRef.current = null
    }
  }, [])

  // 数据变化时更新（不重建实例）
  useEffect(() => {
    chartRef.current?.setOption({
      xAxis3D: { data: data.map((_, i) => `第 ${i + 1} 项`) },
      series: [{ type: 'bar3D', data }],
    })
  }, [data])

  return <div ref={ref} style={{ height: 420 }} />
}
```

---

## CDN 引入

适合静态页面或快速验证。

::: warning 需要 import map，不能用 `<script src>` 直引
`three` 自 0.150 起是纯 ESM 包，没有 `build/three.min.js` 这类浏览器全局构建。
因此 `vis-3x` **不发布 UMD 产物**，浏览器里必须走 ESM + import map。
:::

```html
<!doctype html>
<html>
  <head>
    <link rel="stylesheet" href="https://unpkg.com/vis-3x/dist/style.css" />
  </head>
  <body>
    <div id="chart" style="width: 100%; height: 460px"></div>

    <script type="importmap">
    {
      "imports": {
        "three": "https://esm.sh/three@0.160.0",
        "three/": "https://esm.sh/three@0.160.0/",
        "vue": "https://esm.sh/vue@3.5.13",
        "vis-3x": "https://esm.sh/vis-3x"
      }
    }
    </script>

    <script type="module">
      import { createChart } from 'vis-3x'

      const chart = createChart('pie3D', document.getElementById('chart'))
      chart.setOption({
        series: [
          {
            type: 'pie3D',
            innerRadius: 1.3,
            data: [
              { value: 1048, name: '搜索引擎' },
              { value: 735, name: '直接访问' },
              { value: 580, name: '邮件营销' },
            ],
          },
        ],
        showCoordinate: false,
      })
    </script>
  </body>
</html>
```

---

## 该选哪个？

::: tip 决策建议

**Vue 3 项目** → 用组件。少写代码，生命周期自动管理。

**需要精细控制** → 用 `useVisChart`。比如图表在弹窗里延迟挂载、或需要根据数据决定是否创建。

**React / Svelte / 原生** → 用 `createChart`。记得在卸载时 `dispose()`。

**没有构建工具** → 用 CDN + import map（见上）。
:::

---

## 下一步

- [配置项结构](./option-structure) — 系统理解 option
- [事件系统](./events) — 处理用户交互
