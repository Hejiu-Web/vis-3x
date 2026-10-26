# 性能优化

3D 图表比 2D 消耗更多 GPU 资源。这一页列出实际有效的优化手段，按收益排序。

---

## 1. 按需渲染（默认已开启）

场景静止时停止重绘。这是收益最大的一项，且**默认就是开的**。

```ts
{
  onDemandRendering: true,   // 默认值
}
```

只有三种情况会重绘：

- 相机移动
- 动画进行中
- 显式调用 `chart.requestRender()`

::: warning 什么时候该关掉
需要**持续**动态效果时：旋转的装饰元素、每帧变化的着色器。
比如 `autoRotate: true` 时库会自动切到持续渲染。

手动关闭：

```ts
{ onDemandRendering: false }
```

除非有明确需求，否则不要关。
:::

### 数据大屏场景

一个页面上放多个图表时，让它们错开刷新：

```ts
// 只让可见的图表渲染
const observer = new IntersectionObserver((entries) => {
  for (const e of entries) {
    const chart = chartMap.get(e.target)
    if (!chart) continue
    // 不可见时关闭重绘触发
    chart.setOption({ onDemandRendering: true })
  }
})
```

---

## 2. 控制数据量

| 图表 | 建议上限 | 说明 |
|---|---|---|
| 柱状图 | 单系列 50 根 | 再多柱子会细到看不清，考虑改用热力图 |
| 折线图 | 单系列 200 点 | 超过后视觉上已经分辨不出差异 |
| 散点图 | 3000 点 | 主要受绘制调用次数影响 |
| 曲面图 | 60 × 60 网格 | 3600 个顶点，`smoothSubdivision` 会成倍放大 |
| 热力图 | 30 × 30 | 色块太小就失去意义 |

```ts
// 曲面图：控制网格密度
series: [{
  type: 'surface3D',
  data: matrix,              // 保持 40×40 左右
  smoothSubdivision: 1,      // 默认 0；设为 2 会把顶点数变成 9 倍
}]
```

::: warning smoothSubdivision 是顶点数放大器
`2` 表示每个方向插值成 3 段，总顶点数变成 **9 倍**。
60×60 的曲面加上 `smoothSubdivision: 2` 会有 32 万个顶点，明显卡顿。

需要平滑效果时，更好的做法是**提高输入数据的密度**而不是事后插值。
:::

---

## 3. 关闭不需要的渲染特性

每一项都有开销，用不到就关：

```ts
{
  // 阴影：需要额外渲染一遍场景
  lights: [
    { type: 'ambient', intensity: 0.6 },
    { type: 'directional', position: [1, 1.6, 1], intensity: 1.5, shadow: false },
  ],

  // 后处理：全屏通道，代价较高
  postprocessing: { enabled: false },

  // 网格墙：额外的几何体
  gridFloor: { show: true, showWall: false },

  // 阴影承接面
  gridFloor: { showShadowPlane: false },
}
```

### 阴影的代价

| 设置 | 开销 |
|---|---|
| `shadow: false` | 无额外开销 |
| `shadow: true, shadowMapSize: 1024` | 场景多渲染 1 遍 |
| `shadow: true, shadowMapSize: 2048` | 场景多渲染 1 遍 + 4 倍阴影贴图内存 |
| `shadow: true, shadowMapSize: 4096` | 多数集成显卡会明显掉帧 |

数据看板场景下，用 `showShadowPlane`（假的接触阴影）代替真实阴影通常够用，且几乎无开销。

---

## 4. 减少材质与几何体数量

库内部对材质做了**按参数缓存**：相同参数只创建一个材质实例。

但几何体是逐个创建的（每个柱子形状不同）。可以通过降低细节来减少顶点：

```ts
itemStyle: {
  // 圆角柱子的圆角分段数，默认 4；设为 1 就是直角柱
  bevelSegments: 1,
}

// 散点：球体分段数
pointStyle: { segments: 12 }   // 默认 24
```

| 元素 | 默认分段 | 可降到 |
|---|---|---|
| 柱子圆角 | 4 | 1（直角） |
| 散点球体 | 24 | 8~12 |
| 曲面 tube | 8 | 6 |
| 饼图弧 | 每 3° 一段 | 每 6° 一段 |

::: tip 视觉上分辨不出来
在 2 倍屏以下，球体从 24 段降到 12 段几乎看不出差别，但顶点数减半。
:::

---

## 5. 及时销毁实例

WebGL 上下文是有限资源，浏览器通常限制 **8~16 个**。超出后新图表创建失败。

```ts
// 命令式用法：务必在离开时销毁
chart.dispose()
```

Vue 组件会在 `onBeforeUnmount` 自动调用，不需要手动处理。

::: danger 动态创建图表的场景最容易泄漏
弹窗里创建图表、路由切换、Tabs 切换——这些场景下如果忘记 `dispose`，
几十次操作后就会耗尽 WebGL 上下文。

可以用这个方式监控：

```ts
console.log(document.querySelectorAll('canvas').length)
// 数字持续增长 = 有泄漏
```
:::

---

## 6. 响应式尺寸的正确做法

不要用 `ResizeObserver` 频繁调用 `resize()`：

```ts
// 不好：拖拽窗口时每像素都触发
new ResizeObserver(() => chart.resize()).observe(el)
```

库内部已经监听了容器尺寸变化，并对 `resize` 做了节流。直接用即可：

```ts
chart.resize()   // 手动触发时才需要调用
```

---

## 性能检查清单

上线前逐项确认：

- [ ] `onDemandRendering` 保持默认 `true`
- [ ] 数据量在建议上限内
- [ ] 不需要的阴影 / 后处理 / 网格墙已关闭
- [ ] `smoothSubdivision` 不超过 1（除非数据本身稀疏）
- [ ] 离开页面时调用 `dispose()`（命令式用法）
- [ ] 页面内同时存在的图表实例不超过 8 个

---

## 测量

想知道实际帧率与渲染耗时：

```ts
chart.on('chart:rendered', ({ duration }) => {
  if (duration > 32) {
    console.warn(`渲染耗时 ${duration.toFixed(1)}ms，可能掉帧`)
  }
})
```

超过 **16ms** 意味着达不到 60fps，超过 **32ms** 会明显感觉到卡顿。

也可以直接用 Chrome DevTools 的 Performance 面板录制，查看 `render` 阶段耗时。

---

## 下一步

- [从 ECharts 迁移](./migrate-from-echarts)
- [常见问题](./faq)
