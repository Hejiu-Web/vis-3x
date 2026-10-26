# 渲染上下文 ctx

`ctx` 是 `defineChart` 的 `render` 回调收到的对象。它把 `ChartBase` 的能力以函数形式暴露出来，让你不必继承类就能完成渲染工作。

---

## 全貌

```ts
interface ChartRenderContext {
  // 数据
  option: ResolvedChartOption
  series: Series3D[]          // 已过滤 visible === false
  allSeries: Series3D[]       // 含隐藏项
  chart: ChartBase            // 底层实例，需要高级能力时用

  // 坐标映射
  coord: { /* ... */ }

  // 几何与材质
  geometry: { /* ... */ }
  material: (color, style?) => THREE.Material
  uniqueMaterial: (color, style?) => THREE.Material

  // 挂载
  add: (object: THREE.Object3D) => void
  anchor: (x, y, z, text?, style?) => THREE.Object3D
  label: (object, text, style?) => void
  pickable: (object, meta) => void

  // 主题与动画
  theme: ChartThemeTokens
  animation: AnimationManager
  transition: TransitionPlan
  keepAnimating: () => void
  phase: 'initial' | 'update'

  // 重绘
  invalidate: () => void
}
```

---

## 数据

### series / allSeries

```ts
render(ctx) {
  // 只含可见系列——绝大多数情况用这个
  ctx.series.forEach((s, i) => { /* ... */ })

  // 含 visible === false 的系列
  // 用于图例、或者你想自己处理隐藏逻辑时
  ctx.allSeries.forEach((s) => { /* ... */ })
}
```

`series` 已经过滤掉 `visible: false` 的系列。图例点击后会自动重新渲染，隐藏的系列不会出现在 `ctx.series` 里。

### option

已解析的完整配置，所有默认值都已填充：

```ts
render(ctx) {
  const depth = (ctx.option as any).gridFloor?.wallOpacity ?? 0.12
}
```

### chart

底层 `ChartBase` 实例。需要读写引擎状态时用：

```ts
render(ctx) {
  ctx.chart.engine.scene      // THREE.Scene
  ctx.chart.engine.camera     // THREE.Camera
  ctx.chart.currentTheme      // 当前主题
}
```

::: warning 直接访问内部结构有风险
`engine`、`scene` 是内部实现。跨版本可能变化。
确实需要时建议加类型断言并做好版本兼容。
:::

---

## coord — 坐标映射

把数据值转换成世界坐标。这是 3D 图表里最容易出错的部分，所以库把它封装好了。

### 数值 → 世界坐标

```ts
ctx.coord.yAt(120)     // 数据值 120 → 世界 Y 坐标（可能是 2.4）
ctx.coord.xAt(3)       // 数值轴 X：值 3 → 世界 X
ctx.coord.zAt(-1)      // 数值轴 Z：值 -1 → 世界 Z
```

::: warning yAt 返回的是世界坐标，不是高度比例
```ts
ctx.coord.yAt(120)     // 2.4 —— 世界单位
ctx.coord.yAt(0)       // 0    —— 地面
```

想得到「柱子高度」应该用 `yAt(value) - yAt(0)`，
而不是直接用 `yAt(value)`——**当 Y 轴范围不从 0 开始时两者不等**。
:::

### 类目 → 世界坐标

```ts
ctx.coord.xAtCategory(0)   // 第 1 个类目的世界 X
ctx.coord.xAtCategory(2)   // 第 3 个类目的世界 X
```

类目均匀分布，**两端各留半个步长**，保证首尾元素完整落在网格内。

### 其他

```ts
ctx.coord.xStep            // 类目步长（世界单位）
ctx.coord.yDomain          // [min, max] 数值轴范围
ctx.coord.categoryCount    // 类目数量
ctx.coord.categoryName(0)  // 'Q1' —— 类目名（无 data 时返回 '0'）
ctx.coord.grid             // { gridWidth, gridHeight, gridDepth }
```

### barSlot — 多系列槽位

多系列柱状图并排时，计算每个系列的位置与宽度：

```ts
render(ctx) {
  const count = ctx.series.length
  ctx.series.forEach((series, seriesIndex) => {
    const { width, offset } = ctx.coord.barSlot(seriesIndex, count)

    series.data.forEach((item, i) => {
      const x = ctx.coord.xAtCategory(i) + offset
      // 用 width 作为柱子宽度
    })
  })
}
```

返回的 `width` 已经考虑了系列间间隙，`offset` 是相对类目中心的偏移。

---

## geometry — 几何体

所有方法创建的几何体都会**自动登记**，图表销毁或重新渲染时统一释放。

| 方法 | 签名 | 说明 |
|---|---|---|
| `box` | `(w, h, d) => BufferGeometry` | 立方体，**中心在原点** |
| `sphere` | `(radius, segments?) => BufferGeometry` | 球体，中心在原点 |
| `cylinder` | `(rTop, rBottom, height, segments?) => BufferGeometry` | 圆柱/圆锥，**中心在原点，轴向 Y** |
| `plane` | `(w, h) => BufferGeometry` | 平面，中心在原点，朝向 +Z |
| `circle` | `(radius, segments?) => BufferGeometry` | 圆盘 |
| `extrude` | `(shape, depth, options?) => BufferGeometry` | 由 `THREE.Shape` 挤出 |
| `tube` | `(points, radius, tubularSegments?) => BufferGeometry` | 沿点集生成管状体 |
| `track` | `<T>(geo: T) => T` | 登记你自己创建的几何体 |

::: warning 几何体的原点位置
`box` 和 `cylinder` 的**中心在原点**，不是底面。

要让它们「站」在地面上，位置要设成高度的一半：

```ts
const h = 3
mesh.position.y = h / 2   // 不是 h
```

这和 `ExtrudeGeometry` 不同——后者沿 +Z 挤出 `[0, depth]`，
旋转到 Y 轴后底部天然在 0。
:::

### track — 登记自定义几何体

用 Three.js 原生构造的几何体不会被自动管理，需要显式登记：

```ts
const geo = new THREE.ExtrudeGeometry(shape, { depth: 0.5 })
ctx.geometry.track(geo)
```

---

## material — 材质

```ts
ctx.material('#4f8cff', {
  preset: 'standard',        // 'standard' | 'physical' | 'basic'
  roughness: 0.32,
  metalness: 0.25,
  emissive: '#4f8cff',
  emissiveIntensity: 0.15,
  opacity: 0.9,
  transparent: true,
  side: 'double',            // 'front' | 'back' | 'double'
  envMapIntensity: 1.2,
})
```

**相同参数只创建一个实例**（带缓存），减少 GL 状态切换。

需要独立材质（比如要单独改颜色）时用 `uniqueMaterial`：

```ts
const mat = ctx.uniqueMaterial('#f00')
mat.opacity = 0.5   // 只影响这一个
```

### 材质预设

| preset | 对应 Three.js | 适用 |
|---|---|---|
| `'standard'` | `MeshStandardMaterial` | 默认。数据图表绝大多数场景 |
| `'physical'` | `MeshPhysicalMaterial` | 需要透明/折射/镀膜时（气泡图） |
| `'basic'` | `MeshBasicMaterial` | 不受光照影响，用于纯色标记 |

---

## 挂载与标签

### add

```ts
ctx.add(mesh)   // 挂到 series 分组
```

挂进去的对象会在下次渲染前被自动清理。

### anchor

创建一个纯定位用的锚点（不渲染任何几何体），通常配合标签使用：

```ts
const anchor = ctx.anchor(x, y + 0.3, z, '数值文案', {
  show: true,
  textStyle: { color: '#f1f5f9', fontSize: 12 },
})
```

`anchor` 一步完成「创建对象 + 挂载 + 加标签」。返回的对象可以后续更新位置。

### label

已有对象需要加标签时：

```ts
const obj = new THREE.Object3D()
obj.position.set(x, y, z)
ctx.add(obj)

ctx.label(obj, '标签文字', {
  show: true,
  textStyle: { fontSize: 11, color: '#94a3b8' },
})
```

::: tip 标签支持多行
字符串里的 `\n` 或真实换行都会渲染成 `<br>`：

```ts
ctx.label(obj, '销售额\n1200 万', style)
```
:::

### 用自己的标签分组时：记得清理

`ctx.label` / `ctx.anchor` 创建的标签都在 `'series'` 分组，
每次重绘时由库自动清理。

如果你用 `this.labels` 直接建标签并指定了**自定义分组**，
比如仪表盘的中心数值用 `'gauge-detail'`：

```ts
this.labels.create({
  object: myAnchor,
  text: '73',
  group: 'my-detail', // ← 自定义分组，库不会自动清
})
```

就必须覆写 `clearSeriesLabels()`，否则会有两个问题：

1. **重绘后标签残留**：分组没被清，DOM 元素还在，但 3D 锚点已经被移出场景
2. **标签飘到左上角**：CSS2D 标签是 `position: absolute`，失去锚点后没有
   `transform`，就会停在容器左上角

```ts
class MyChart extends ChartBase {
  get chartType() {
    return 'my3D'
  }

  // 把自定义分组一起纳入清理
  protected clearSeriesLabels(): void {
    super.clearSeriesLabels() // 先清 'series'
    this.labels.clearGroup('my-detail')
  }

  protected renderSeries(option) {
    // ...
  }
}
```

::: warning 不要清 `'axis'` 分组
坐标轴标签由 `SceneEnvironment` 自己管理，清掉会导致轴线文字消失且不会重建。
:::

### 频繁更新的标签：用 `update` 而不是重建

动画期间要逐帧改标签文字时，**只更新文本，不要删了重建**：

```ts
// ✅ 只改内容
if (!this.labels.update(anchor, text)) {
  this.labels.create({ object: anchor, text, group: 'my-detail' })
}
```

```ts
// ❌ 每帧重建：新元素在下一帧渲染前没有 transform，
//    会短暂出现在左上角；动画被打断时会永久停在那里
this.labels.clearGroup('my-detail')
this.labels.create({ object: anchor, text, group: 'my-detail' })
```

`update()` 在该对象还没有标签时返回 `false`，可以据此补建。

---

## pickable — 接入交互

```ts
ctx.pickable(mesh, {
  seriesIndex: 0,
  dataIndex: i,
  seriesName: series.name,
  name: ctx.coord.categoryName(i),
  value,
  color,
})
```

标记后：

- `chart:click` / `chart:mouseover` / `chart:mouseout` 会命中它
- 组件场景下 tooltip 会显示
- 鼠标悬停时光标变化

### 排除装饰性元素

```ts
mesh.userData.__vtNoPick = true
```

用于顶盖、辅助线、背景板这类不该响应交互的元素。

---

## theme — 主题令牌

```ts
ctx.theme.palette          // string[] 调色板
ctx.theme.colorAt(3)       // 按索引取色（自动循环）
ctx.theme.textColor        // '#94a3b8'
ctx.theme.axisColor        // '#475569'
ctx.theme.splitLineColor   // '#1e293b'
ctx.theme.backgroundColor  // '#0a0f1c' | null
```

---

## 动画

### transition

```ts
const plan = ctx.transition
plan.scaleY(mesh, i)
plan.run()
ctx.keepAnimating()
```

| 方法 | 效果 |
|---|---|
| `scaleY(obj, i, from?)` | 沿 Y 轴缩放（几何体底部需在局部 `y=0`） |
| `scaleXZ(obj, i, from?)` | 沿 XZ 径向缩放 |
| `fade(obj, i, targetOpacity?)` | 淡入 |
| `custom(fn, i, opts?)` | 自定义插值，`fn(t)` 收到 0~1 |

完整说明见[动画与过渡](/guide/animation#自定义图表的动画)。

### keepAnimating

动画期间保持重绘。**按需渲染模式下必须调用**，否则画面不会更新。

```ts
plan.run()
ctx.keepAnimating()
```

### phase

区分首次渲染与数据更新：

```ts
render(ctx) {
  if (ctx.phase === 'initial') {
    // 首次入场：可以播完整的生长动画
  } else {
    // 数据更新：用更短的过渡
  }
}
```

不过大多数时候不需要手动判断——`ctx.transition` 已经根据 phase 自动选了合适的时长。

---

## invalidate — 请求重绘

按需渲染模式下，如果你在渲染函数**之外**修改了场景（比如定时器里），需要手动请求重绘：

```ts
render(ctx) {
  const mesh = new THREE.Mesh(...)
  ctx.add(mesh)

  // 一个自己维护的循环动画
  setInterval(() => {
    mesh.rotation.y += 0.02
    ctx.invalidate()      // 告诉库「需要重绘」
  }, 16)
}
```

::: warning 记得清理
`setInterval` 不会因为你重新渲染而停止。要在 hook 里清理：

```ts
defineChart({
  type: 'x',
  hooks: {
    onDispose() {
      clearInterval(timer)
    },
  },
  render(ctx) { /* ... */ },
})
```
:::

---

## 下一步

- [extendChart 继承改写](./extend-chart)
- [完整实战案例](./full-example)
