# 安装

## 环境要求

| 依赖 | 版本 | 说明 |
|---|---|---|
| Node.js | >= 18 | 构建工具链需要 |
| Three.js | >= 0.160 | **peerDependency**，由你的项目提供 |
| Vue | >= 3.3 | **peerDependency**，仅用组件时需要 |

`three` 与 `vue` 都是 peer 依赖，不会被重复打包进产物。这一点很重要：如果你的项目里已经有 Three.js（比如还用了别的 3D 库），不会出现两份实例互相冲突。

---

## 安装命令

::: code-group

```bash [npm]
# 完整用法（含 Vue 组件）
npm install vis-3x three vue

# 只用命令式 API（不需要 Vue）
npm install vis-3x three
```

```bash [pnpm]
pnpm add vis-3x three vue
```

```bash [yarn]
yarn add vis-3x three vue
```

:::

---

## 引入样式

库的标签、提示框、图例是 HTML 覆盖层，需要引入一次基础样式：

```ts
import 'vis-3x/style.css'
```

::: warning 别忘了这一步
漏掉样式文件的表现是：图表本体正常，但**数据标签位置错乱、提示框没有背景、图例堆成一团**。
因为 CSS2D 标签的定位依赖 `.vt-label { position: absolute }`。

在 Vue 项目里通常放在 `main.ts`；在普通网页里放在入口 JS 或 `<link>` 引入。
:::

---

## CDN 直接使用（不推荐）

::: warning 不提供 UMD 产物
`vis-3x` **没有** `dist/index.umd.js`。

原因是 `three` 自 0.150 起已经是纯 ESM 包，官方不再提供
`build/three.min.js` 这类浏览器全局构建。任何 UMD 产物都无法在真实浏览器里
拿到可用的全局 `THREE`，只会在运行时报错：

```
TypeError: THREE.WebGLRenderer is not a constructor
```

请使用构建工具（Vite / webpack / Rollup）以 ESM 方式引入：

```ts
import { createChart } from 'vis-3x'
```

如果确实想在没有构建工具的环境里试用，可以用 `<script type="module">`
配合 import map，且 `three` 必须走 ESM 版本：

```html
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

  const chart = createChart('bar3D', document.getElementById('chart'))
  chart.setOption({
    xAxis3D: { data: ['A', 'B', 'C', 'D'] },
    series: [{ type: 'bar3D', data: [30, 80, 45, 95] }],
  })
</script>
```

::: tip CDN 用法同样需要样式
用 import map 方式时，样式通过 CDN 直接引入：

```html
<link rel="stylesheet" href="https://unpkg.com/vis-3x/dist/style.css" />
```
:::

---

## 按需引入（减小打包体积）

如果只用到一两个图表，可以通过子路径导入，让打包器更好地做 tree-shaking：

```ts
import { createChart, defineChart } from 'vis-3x/core'      // 内核 + 扩展 API
import { Bar3DChart } from 'vis-3x/charts'                  // 图表实现类
import { VisBar3D } from 'vis-3x/components'                // Vue 组件
import { useVisChart } from 'vis-3x/composables'            // 组合式函数
import type { Vis3xOption } from 'vis-3x/types'             // 纯类型（编译后消失）
import { clamp, gradientColorAt } from 'vis-3x/utils'       // 工具函数
import { fromEchartsLikeOption } from 'vis-3x/adapters'     // ECharts 适配器
import { themes, useExtraCharts } from 'vis-3x/presets'     // 主题 + 示例图表
```

::: tip 子路径 = 独立入口
每个子路径都是独立的构建产物，彼此不互相牵连。
比如只导入 `vis-3x/utils` 不会把整个引擎带进来。
:::

---

## 验证安装

建一个最小文件确认能跑：

```ts
import { createChart, getBuiltinTypes } from 'vis-3x'

// 应输出 11 个内置类型（bar3D / line3D / ... / heatmap3D）
console.log(getBuiltinTypes())

// 在浏览器环境中：
const chart = createChart('bar3D', document.getElementById('chart')!)
chart.setOption({
  xAxis3D: { data: ['A', 'B'] },
  series: [{ type: 'bar3D', data: [10, 20] }],
})
```

能渲染出两根柱子就说明环境正常。

---

## 打包配置注意事项

### Vite

无需额外配置。`vis-3x` 使用 ESM 产物，Vite 会自动处理。

如果遇到 `Failed to resolve import "vis-3x/style.css"`，检查 `resolve.alias` 是否误伤了包名：

```ts
// vite.config.ts
export default defineConfig({
  resolve: {
    alias: {
      // 不要写成 'vis-3x': '/src/...'，那会拦掉 style.css
      '@': fileURLToPath(new URL('./src', import.meta.url)),
    },
  },
})
```

### webpack

```js
// webpack.config.js
module.exports = {
  resolve: {
    // 让 webpack 优先使用 ESM 产物
    mainFields: ['module', 'main'],
  },
}
```

### TypeScript

库自带完整类型声明，`moduleResolution` 建议设为 `bundler` 或 `node16`：

```json
{
  "compilerOptions": {
    "moduleResolution": "bundler",
    "skipLibCheck": true
  }
}
```

如果 TS 报找不到类型，确认 `tsconfig.json` 的 `moduleResolution` 不是 `node`（旧版解析算法不认 `exports` 字段）。

---

## 下一步

- [快速开始](./quick-start) — 画出第一个图表
- [四种使用方式](./usage-modes) — 选择适合你的方式
