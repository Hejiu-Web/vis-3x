# 实例方法

`ChartBase` 实例的完整公开 API。通过 `createChart()` 或组件 ref 获取。

---

::: tip JavaScript 使用者怎么看这一页
本页用 TypeScript 语法描述字段类型（如 `color?: string`），
**这些标注只影响编辑器提示，不影响运行**。

在纯 JavaScript 里：

- 写成 `option.color = '#4f8cff'` 即可，不需要声明类型
- `?` 表示可选字段，JS 里直接不写就行
- 字段名、取值、默认值**完全一致**

完整的 JS 用法见[纯 JavaScript 使用](/guide/javascript)。
:::

## 获取实例

```ts
// 命令式
const chart = createChart('bar3D', el)

// Vue 组件 ref
const chartRef = ref()
// chartRef.value.getChart()  → ChartBase
```

---

## 配置

### setOption

```ts
setOption(option: Vis3xOption): void
```

设置配置并触发渲染。

::: warning 是整体替换，不是深合并
```ts
chart.setOption({ series: [...] })
chart.setOption({ title: { text: '新标题' } })
// series 没了
```

需要保留原配置时：

```ts
chart.setOption({ ...chart.getOption(), title: { text: '新标题' } })
```
:::

### getOption

```ts
getOption(): Vis3xOption
```

返回当前配置。可用于合并后重新设置。

---

## 尺寸与视角

### resize

```ts
resize(): void
```

重新计算容器尺寸。库已监听容器变化并做了节流，通常不需要手动调用。

### fitToScreen

```ts
fitToScreen(): void
```

调整相机距离，让内容完整入镜。保持当前观察方向不变。

```ts
chart.fitToScreen()
```

### resetCamera

```ts
resetCamera(): void
```

回到 `controlSettings.cameraDirection` 指定的方向。

---

## 交互模式

### setInteractionMode

```ts
setInteractionMode(mode: 'free' | 'rotate' | 'fixed'): void
```

```ts
chart.setInteractionMode('fixed')   // 锁定视角
chart.setInteractionMode('free')    // 恢复
```

### interactionMode

```ts
get interactionMode(): InteractionMode
```

读取当前模式。

### isCameraInteractive

```ts
get isCameraInteractive(): boolean
```

相机当前是否可操作。考虑到了显式覆盖的情况：

```ts
// interactionMode 是 'fixed'，但 enableZoom 显式开启
chart.isCameraInteractive   // true（因为还能缩放）
```

---

## 事件

### on

```ts
on<T extends ChartEventType>(
  event: T,
  handler: (payload: ChartEventMap[T]) => void
): () => void
```

订阅事件，返回取消订阅函数。

```ts
const off = chart.on('chart:click', (p) => {
  console.log(p.name, p.value)
})

off()   // 取消
```

### once

```ts
once<T extends ChartEventType>(event: T, handler): () => void
```

只触发一次。

### off

```ts
off<T extends ChartEventType>(event: T, handler?): void
```

取消订阅。不传 `handler` 时移除该事件的全部监听。

### dispatch

```ts
dispatch<T extends ChartEventType>(event: T, payload: ChartEventMap[T]): void
```

手动触发事件。用于自定义图表或外部联动。

```ts
chart.dispatch('chart:rendered', { duration: 12, type: 'bar3D' })
```

### onTooltip

```ts
onTooltip(callback: (data: TooltipData) => void): void
```

订阅 tooltip 内容变化。Vue 组件内部用这个渲染提示框。

### onLegend

```ts
onLegend(callback: (items: LegendItemData[]) => void): void
```

订阅图例数据。

```ts
chart.onLegend((items) => {
  // items: [{ name, color, selected }]
})
```

### eventBus

```ts
get eventBus(): EventBus
```

底层事件总线。需要通配监听时用。

---

## 导出

### exportImage

```ts
exportImage(options?: {
  scale?: number
  backgroundColor?: string | null
}): string
```

返回 dataURL。

```ts
const url = chart.exportImage({ scale: 2 })
```

---

## 渲染控制

### requestRender

```ts
requestRender(): void
```

请求一次重绘。按需渲染模式下，外部改了场景后需要调用。

### setContinuousRendering

```ts
setContinuousRendering(enabled: boolean): void
```

开启/关闭持续渲染。

```ts
chart.setContinuousRendering(true)    // 每帧重绘
chart.setContinuousRendering(false)   // 回到按需渲染
```

::: warning 持续渲染会一直占用 GPU
只在确实需要时开启（比如有自己维护的循环动画）。
用完记得关掉。
:::

---

## 主题与颜色

### currentTheme / currentPalette

```ts
get currentTheme(): ThemeConfig
get currentPalette(): string[]
```

读取当前生效的主题与调色板。

### color

```ts
color(index: number): string
```

按索引取调色板颜色（自动循环）。

```ts
chart.color(0)   // '#4f8cff'
chart.color(12)  // 索引 12，自动回绕
```

### content

```ts
get content(): THREE.Group
```

内容分组。自定义渲染时挂载元素的容器。

---

## 清理

### dispose

```ts
dispose(): void
```

销毁实例，释放 WebGL 资源、移除事件监听、断开尺寸观察。

::: danger 命令式用法务必调用
```ts
// React
useEffect(() => {
  const chart = createChart('bar3D', ref.current)
  return () => chart.dispose()
}, [])
```

不调用会导致 WebGL 上下文泄漏。
浏览器通常限制 8~16 个上下文，超出后新图表创建失败。
:::

### isDisposed

```ts
get isDisposed(): boolean
```

是否已销毁。用于避免对已销毁实例操作：

```ts
if (!chart.isDisposed) {
  chart.setOption(next)
}
```

---

## 底层访问

### eventBus

见上方[事件](#eventbus)。

### 引擎

```ts
chart.engine
```

`Engine` 实例。提供：

| 成员 | 类型 | 说明 |
|---|---|---|
| `scene` | `THREE.Scene` | 场景 |
| `camera` | `THREE.Camera` | 相机 |
| `renderer` | `THREE.WebGLRenderer` | 渲染器 |
| `labelRenderer` | `CSS2DRenderer` | HTML 标签层 |
| `onLoop(fn)` | `(fn) => () => void` | 注册每帧回调，返回取消函数 |
| `requestRender()` | `() => void` | 请求重绘 |
| `eventBus` | `EventBus` | 事件总线 |

::: warning 内部结构跨版本可能变化
`engine` 及其成员是内部实现。加自定义内容时优先用公开 API。
:::

---

## 方法速查

| 分类 | 方法 |
|---|---|
| 配置 | `setOption` `getOption` |
| 尺寸视角 | `resize` `fitToScreen` `resetCamera` |
| 交互 | `setInteractionMode` `interactionMode` `isCameraInteractive` |
| 事件 | `on` `once` `off` `dispatch` `onTooltip` `onLegend` |
| 导出 | `exportImage` |
| 渲染 | `requestRender` `setContinuousRendering` |
| 主题 | `color` `currentTheme` `currentPalette` `content` |
| 清理 | `dispose` `isDisposed` |

---

## 下一步

- [事件列表](./events)
- [类型定义](./types)
