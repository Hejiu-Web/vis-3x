# 常见问题

---

## 图表不显示

::: details 容器高度是 0
**最常见的原因。**

图表铺满父容器。如果父元素高度未定义，渲染出来就是 0 高。

```vue
<!-- ✗ 不显示 -->
<div>
  <VisBar3D :option="option" />
</div>

<!-- ✓ 显式高度 -->
<div style="height: 460px">
  <VisBar3D :option="option" />
</div>
```

在 flex 布局里也要注意：`flex: 1` 的父元素若没有确定高度，子元素仍是 0。

可以用 `<VisBar3D :option="option" height="460px" />` 直接给组件设高。
:::

::: details 没引入样式文件
症状：图表本体正常，但**标签位置错乱、提示框没背景**。

```ts
import 'vis-3x/style.css'   // 别漏
```
:::

::: details WebGL 上下文耗尽
页面里创建过太多图表实例且没销毁。浏览器通常限制 8~16 个。

```ts
// 检查
console.log(document.querySelectorAll('canvas').length)
```

命令式用法下离开页面必须：

```ts
chart.dispose()
```
:::

::: details 浏览器不支持 WebGL 2
用这个确认：

```ts
const canvas = document.createElement('canvas')
const gl = canvas.getContext('webgl2')
console.log(gl ? '支持' : '不支持')
```

不支持时库会抛出明确错误。老旧设备或禁用了硬件加速的环境可能不支持。
:::

---

## 图表能显示但交互不了

::: details 视角转不动
检查 `interactionMode`：

```ts
option.controlSettings = { interactionMode: 'free' }   // 确认不是 'fixed'
```

或读一下当前状态：

```ts
console.log(chart.interactionMode, chart.isCameraInteractive)
```
:::

::: details 点击柱子没反应
1. 确认数据元素确实被标记为可拾取（内置图表已自动处理）
2. 用 `chart.on('chart:click', ...)` 而不是 DOM 的 `click`
3. 检查是否有透明元素盖住了 canvas

```ts
// 快速验证事件系统是否工作
chart.on('chart:mouseover', (p) => console.log('hover', p))
```
:::

::: details 滚轮缩放时页面跟着滚
```css
.vt-container {
  overscroll-behavior: contain;
}
```
:::

---

## 数据与渲染

::: details 数据更新后图表没变
`setOption` 是**整体替换**，不是深合并：

```ts
chart.setOption({ title: { text: '新标题' } })
// series 被清空了！
```

正确做法：

```ts
chart.setOption({
  ...chart.getOption(),
  title: { text: '新标题' },
})
```
:::

::: details 柱子顶到天花板 / 被裁切
Y 轴范围紧贴数据最大值。显式给 `max`：

```ts
yAxis3D: { max: 300 }
```
:::

::: details 柱子之间重叠
显式设了 `barWidth` 但没有相应调整类目数量。

数据项多时不要手动设 `barWidth`，让库按步长自动计算。
:::

::: details 曲面图看起来是个平面
数据矩阵必须是**二维数组**：

```ts
// ✓ 正确
data: [
  [1, 2, 3],
  [4, 5, 6],
  [7, 8, 9],
]

// ✗ 错误：一维数组不会生成曲面
data: [1, 2, 3, 4, 5, 6, 7, 8, 9]
```
:::

::: details 标签重叠在一起
类目多时标签会挤。可以：
- 设置 `label.interval` 控制显示间隔
- 关闭标签，靠 tooltip 展示
- 调大容器

```ts
label: { show: true, interval: 2 }   // 每隔 2 个显示一次
```
:::

---

## 动画

::: details 没有动画
按顺序检查：

1. `animation.enabled` 是否为 `false`
2. 是否开启了系统的「减少动态效果」（如果代码里判断了这个）
3. 数据量是否过大导致动画被跳过

```ts
// 确认动画配置生效
console.log(chart.getOption().animation)
```
:::

::: details 更新数据时动画太久
默认更新时长是入场时长的 0.6 倍。可以调更短：

```ts
animation: { duration: 900, updateDuration: 300 }
```
:::

::: details 动画播完画面就停了
这是**正常的**——按需渲染模式下，静止时停止重绘以省电。

如果需要持续渲染：

```ts
{ onDemandRendering: false }
```
:::

---

## 自定义图表

::: details `ctx.coord.yAt()` 返回的值不对
`yAt(value)` 把**数据值**映射到世界坐标 Y，不是像素。

```ts
const worldY = ctx.coord.yAt(120)   // 数据 120 → 世界坐标（可能是 2.4）
```

需要原始范围时读：

```ts
const [min, max] = ctx.coord.yDomain
```
:::

::: details 自定义的元素无法点击
必须用 `ctx.pickable()` 标记：

```ts
ctx.pickable(mesh, {
  seriesIndex: 0,
  dataIndex: i,
  value,
  color,
})
```

装饰性元素反而要排除：

```ts
mesh.userData.__vtNoPick = true
```
:::

::: details 几何体/材质报内存警告
用 `ctx.geometry.*` 与 `ctx.material()` 创建，库会自动登记并在销毁时释放：

```ts
// ✓ 会被自动管理
const geo = ctx.geometry.box(1, 1, 1)

// ✗ 不会被登记，需要自己 dispose
const geo = new THREE.BoxGeometry(1, 1, 1)
```
:::

---

## 与 Three.js 相关

::: details 能量到 `.vt-container` 但拿不到场景
可以访问底层引擎：

```ts
const engine = chart.engine
engine.scene      // THREE.Scene
engine.camera     // THREE.Camera
engine.renderer   // THREE.WebGLRenderer
```

::: warning 直接改场景有风险
这些是内部结构。直接操作可以用于调试或加自定义内容，
但库的数据更新会重建 `seriesGroup`，你加进去的东西可能被清掉。

要持久存在的自定义内容，挂到 `engine.scene` 上而非 `seriesGroup`。
:::
:::

::: details 项目里已有 Three.js，会不会冲突
不会。`three` 是 peer 依赖，库使用你项目里的那一份实例，
不会打包第二份。这也是 `three` 必须是 peer 依赖的原因——
两份 Three.js 会导致 `instanceof` 判断失效。
:::

::: details 能不能把图表渲染进已有的 Three.js 场景
不直接支持。库管理自己的 renderer 和 camera。

可行做法：用 `exportImage()` 导出后作为纹理贴进去。
:::

---

## 构建与打包

::: details `Cannot find module 'vis-3x'`
1. 确认已安装：`npm ls vis-3x`
2. 确认 `tsconfig.json` 的 `moduleResolution` 是 `bundler` / `node16` / `nodenext`
   （旧的 `node` 解析算法不认 `exports` 字段）
3. 清缓存重装：删掉 `node_modules/.vite` 或 `.cache`
:::

::: details SSR 报 `window is not defined`
图表依赖浏览器 API。在 Nuxt / Next 里需要客户端专属渲染：

```vue
<!-- Nuxt -->
<ClientOnly>
  <VisBar3D :option="option" />
</ClientOnly>
```

```tsx
// Next.js
const VisBar3D = dynamic(() => import('vis-3x').then(m => m.VisBar3D), {
  ssr: false,
})
```
:::

::: details 打包体积太大
1. 用子路径按需引入（见[安装](./installation#按需引入-减小打包体积)）
2. 确认 `three` 没被打进产物（检查构建分析）

```ts
// 只导入用到的部分
import { createChart } from 'vis-3x/core'
import { Bar3DChart } from 'vis-3x/charts'
```
:::

---

## 还是没有解决？

<script setup>
import { PLAYGROUND_URL, REPO_URL } from '../.vitepress/site-config'
</script>

1. 打开浏览器控制台，看有没有报错
2. 用最小配置复现（只保留 `series`）
3. 对照 <a :href="PLAYGROUND_URL">Playground</a> 里相同图表的配置
4. 提 <a :href="REPO_URL + '/issues'">Issue</a>，附上：
   - 最小复现代码
   - 浏览器与版本
   - 控制台完整报错
