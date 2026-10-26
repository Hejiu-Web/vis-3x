# 事件列表

vis-3x 的事件名与负载类型的完整映射。

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

## 事件映射表

```ts
interface ChartEventMap {
  'chart:click': ChartClickPayload
  'chart:dblclick': ChartDblClickPayload
  'chart:mouseover': ChartMouseOverPayload
  'chart:mouseout': ChartMouseOutPayload
  'chart:mousemove': ChartMouseMovePayload
  'chart:mousedown': ChartMouseDownPayload
  'chart:mouseup': ChartMouseUpPayload
  'chart:rendered': RenderedPayload
  'chart:dispose': { type: string }
  'legend:toggle': LegendTogglePayload
  'camera:change': CameraChangePayload
  resize: { width: number; height: number }
}
```

| 事件名 | Vue 组件事件 | 触发时机 |
|---|---|---|
| `chart:click` | `@click` | 点击数据元素 |
| `chart:dblclick` | `@dblclick` | 双击数据元素 |
| `chart:mouseover` | `@mouseover` | 悬停进入数据元素 |
| `chart:mouseout` | `@mouseout` | 悬停离开数据元素 |
| `chart:mousemove` | `@mousemove` | 在数据元素上移动 |
| `chart:mousedown` | `@mousedown` | 在数据元素上按下 |
| `chart:mouseup` | `@mouseup` | 在数据元素上抬起 |
| `chart:rendered` | `@rendered` | 一次渲染完成 |
| `chart:dispose` | `@dispose` | 实例销毁 |
| `legend:toggle` | `@legendtoggle` | 图例项被点击 |
| `camera:change` | `@camerachange` | 相机移动（高频） |
| `resize` | `@resize` | 容器尺寸变化 |

::: warning 注意 `resize` 没有 `chart:` 前缀
这是唯一的例外。历史原因保留了 DOM 风格的名字。
:::

---

## 数据事件负载

`chart:click` / `dblclick` / `mouseover` / `mouseout` / `mousemove` / `mousedown` / `mouseup` 共用同一个基础结构：

```ts
interface ChartEventPayloadBase {
  seriesIndex: number
  dataIndex: number
  seriesName?: string
  name?: string
  value: number | number[]
  color: string
  data?: unknown
  clientX?: number
  clientY?: number
}
```

| 字段 | 类型 | 说明 |
|---|---|---|
| `seriesIndex` | `number` | 系列索引 |
| `dataIndex` | `number` | 数据项索引 |
| `seriesName` | `string?` | 系列名 |
| `name` | `string?` | 数据项名（来自 `{ name }` 或类目名） |
| `value` | `number \| number[]` | 数值。多维数据是数组 |
| `color` | `string` | 该项颜色 |
| `data` | `unknown?` | 原始数据项对象 |
| `clientX` / `clientY` | `number?` | 屏幕坐标 |

每种事件额外带一个 `type` 字段区分：

```ts
interface ChartClickPayload extends ChartEventPayloadBase {
  type: 'click'
}
interface ChartMouseOverPayload extends ChartEventPayloadBase {
  type: 'mouseover'
}
// ...
```

---

## 生命周期事件

### chart:rendered

```ts
interface RenderedPayload {
  duration: number   // 渲染耗时（毫秒）
  type: string       // 图表类型
}
```

```ts
chart.on('chart:rendered', ({ duration, type }) => {
  if (duration > 32) {
    console.warn(`${type} 渲染耗时 ${duration.toFixed(1)}ms，可能掉帧`)
  }
})
```

### resize

```ts
chart.on('resize', ({ width, height }) => {
  console.log(`容器变为 ${width}×${height}`)
})
```

### chart:dispose

```ts
chart.on('chart:dispose', ({ type }) => {
  console.log(`${type} 已销毁`)
})
```

### camera:change

```ts
interface CameraChangePayload {
  position: { x: number; y: number; z: number }
  target: { x: number; y: number; z: number }
}
```

::: warning 高频事件
拖拽时每帧触发。不要在里面做重活。

需要持久化时记得节流：

```ts
let timer: number | undefined
chart.on('camera:change', (payload) => {
  clearTimeout(timer)
  timer = window.setTimeout(() => {
    localStorage.setItem('camera', JSON.stringify(payload))
  }, 400)
})
```
:::

### legend:toggle

```ts
interface LegendTogglePayload {
  seriesIndex: number
  seriesName?: string
  visible: boolean
}
```

```ts
chart.on('legend:toggle', ({ seriesName, visible }) => {
  console.log(`${seriesName} ${visible ? '显示' : '隐藏'}`)
})
```

---

## 订阅方式

### 命令式

```ts
// 返回取消订阅函数
const off = chart.on('chart:click', handler)
off()
```

### Vue 组件

```vue
<VisBar3D
  :option="option"
  @click="onClick"
  @mouseover="onHover"
  @rendered="onRendered"
  @legendtoggle="onLegendToggle"
/>
```

事件名去掉 `chart:` 前缀并转成 kebab-case：

| 库事件 | 组件事件 |
|---|---|
| `chart:click` | `@click` |
| `chart:dblclick` | `@dblclick` |
| `chart:mouseover` | `@mouseover` |
| `chart:rendered` | `@rendered` |
| `legend:toggle` | `@legendtoggle` |
| `camera:change` | `@camerachange` |
| `resize` | `@resize` |

---

## 手动触发

```ts
chart.dispatch('chart:rendered', { duration: 12, type: 'bar3D' })
```

用于自定义图表或外部联动。

---

## 取原始数据

`payload.data` 保留了你传进 `series.data` 的原对象：

```ts
const option = {
  series: [{
    type: 'bar3D',
    data: [
      { value: 120, id: 'sku-001', stock: 45 },
      { value: 200, id: 'sku-002', stock: 12 },
    ],
  }],
}

chart.on('chart:click', (p) => {
  const raw = p.data as { id: string; stock: number }
  console.log(raw.id, raw.stock)   // 不需要另建索引表
})
```

---

## 事件与交互锁定

```ts
{ controlSettings: { interactionMode: 'fixed' } }
```

**锁定相机不影响数据事件。** 点击、悬停照常工作。

要关闭全部鼠标交互：

```ts
{ interactive: false }
```

---

## 在自定义图表里触发数据事件

用 `ctx.pickable()` 标记对象：

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

标记后该对象自动参与射线检测。

排除装饰性元素：

```ts
mesh.userData.__vtNoPick = true
```

---

## 下一步

- [类型定义](./types)
- [事件系统指南](/guide/events)
