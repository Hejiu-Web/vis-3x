# 事件系统

vis-3x 的事件分两类：**数据交互事件**（点击、悬停数据元素）与**生命周期事件**（渲染完成、相机变化）。

---

## 订阅事件

### Vue 组件

事件名会转成 kebab-case 的组件事件：

```vue
<VisBar3D
  :option="option"
  @click="onClick"
  @mouseover="onHover"
  @mouseout="onOut"
  @rendered="onRendered"
/>
```

### 命令式 / 组合式

```ts
const off = chart.on('chart:click', (payload) => {
  console.log(payload)
})

// 取消订阅
off()
```

`chart.on()` 返回一个取消函数。

---

## 数据交互事件

| 事件名 | 组件事件 | 触发时机 |
|---|---|---|
| `chart:click` | `@click` | 点击数据元素 |
| `chart:dblclick` | `@dblclick` | 双击数据元素 |
| `chart:mouseover` | `@mouseover` | 悬停进入数据元素 |
| `chart:mouseout` | `@mouseout` | 悬停离开数据元素 |
| `chart:mousemove` | `@mousemove` | 在数据元素上移动 |
| `chart:mousedown` | `@mousedown` | 在数据元素上按下 |
| `chart:mouseup` | `@mouseup` | 在数据元素上抬起 |
| `legend:toggle` | `@legendtoggle` | 图例项被点击 |

### 事件负载结构

```ts
interface ChartEventPayloadBase {
  /** 系列索引 */
  seriesIndex: number
  /** 数据项索引 */
  dataIndex: number
  /** 系列名称 */
  seriesName?: string
  /** 数据项名称（来自 { name } 或类目名） */
  name?: string
  /** 数值。多维数据（散点、曲面）是数组 */
  value: number | number[]
  /** 该项的颜色 */
  color: string
  /** 原始数据项（保留用户传进来的完整对象） */
  data?: unknown
  /** 屏幕坐标 */
  clientX?: number
  clientY?: number
}
```

每种事件额外带一个 `type` 字段（`'click'`、`'mouseover'` 等）用于区分。

### 示例

```vue
<script setup lang="ts">
import type { ChartEventPayloadBase } from 'vis-3x'

function onClick(p: ChartEventPayloadBase) {
  // 类目轴图表
  console.log(`${p.seriesName} · ${p.name} = ${p.value}`)
  // 输出：2024 年 · Q2 = 200
}
</script>

<template>
  <VisBar3D :option="option" @click="onClick" />
</template>
```

::: tip 拿原始数据对象
`payload.data` 保留了你传进 `series.data` 的原对象。
如果数据项是 `{ value: 120, id: 42, extra: {...} }`，可以从 `payload.data` 取回全部字段，
不需要另建索引表。
:::

---

## 生命周期事件

| 事件名 | 触发时机 | 负载 |
|---|---|---|
| `chart:rendered` | 一次渲染完成 | `{ duration, type }` |
| `resize` | 容器尺寸变化 | `{ width, height }` |
| `camera:change` | 相机移动（高频） | `{ position, target }` |
| `chart:dispose` | 实例销毁 | `{ type }` |

::: warning `resize` 没有 `chart:` 前缀
这是唯一的例外，保留 `resize` 这个 DOM 风格的名字。

因此相机事件是 `camera:change`（不带 `chart:` 前缀），
而销毁事件是 `chart:dispose`（带前缀）。
:::

```ts
chart.on('chart:rendered', ({ duration, type }) => {
  console.log(`${type} 渲染耗时 ${duration.toFixed(1)}ms`)
})
```

::: warning camera:change 是高频事件
拖拽时每帧都会触发。不要在里面做重活（DOM 操作、网络请求）。
需要持久化时记得节流。
:::

---

## 事件与视角锁定

这是一个容易踩的坑：

```ts
{
  controlSettings: { interactionMode: 'fixed' },
}
```

**锁定相机不影响数据事件。** 点击、悬停照常工作。

如果确实要关闭全部交互：

```ts
{ interactive: false }
```

---

## 在自定义图表里触发事件

用 `defineChart` 时，通过 `ctx.pickable()` 把对象标记为可拾取：

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

标记后这个对象就会自动参与射线检测，`chart:click` / `chart:mouseover` 都能命中它。

### 让某些对象不参与拾取

装饰性元素（顶盖、连接线、辅助标记）用：

```ts
mesh.userData.__vtNoPick = true
```

---

## 事件转发到组件

Vue 组件内部用 raycasting 检测，然后把负载冒泡出来。组件事件是标准 Vue 事件，可以配合 `.once`、`.stop` 等修饰符：

```vue
<VisBar3D :option="option" @click.once="handleFirstClick" />
```

---

## 完整示例：联动多个图表

```vue
<script setup lang="ts">
import { ref } from 'vue'
import type { ChartEventPayloadBase } from 'vis-3x'

const selected = ref<ChartEventPayloadBase | null>(null)
const barRef = ref()

function onAnyChartClick(p: ChartEventPayloadBase) {
  selected.value = p

  // 把点击的类目传给另一个图表做数据筛选
  const categoryName = p.name
  const chart = barRef.value?.getChart()
  if (chart && categoryName) {
    chart.setOption({
      ...chart.getOption(),
      title: { show: true, text: `已选中：${categoryName}` },
    })
  }
}
</script>

<template>
  <div class="grid">
    <VisBar3D ref="barRef" :option="barOption" @click="onAnyChartClick" />
    <VisLine3D :option="lineOption" @click="onAnyChartClick" />
  </div>
</template>
```

::: tip 库不提供 highlight API
vis-3x 没有 ECharts 那种 `highlight()` / `downplay()` 方法。

需要高亮效果时，通过数据项级样式实现——重新 `setOption` 并给选中项设置不同的 `itemStyle`：

```ts
const next = structuredClone(option)
const item = next.series[0].data[p.dataIndex]
if (typeof item === 'object') {
  item.itemStyle = { color: '#fbbf24', emissiveIntensity: 0.6 }
}
chart.setOption(next)
```
:::

---

## 下一步

- [导出图片](./export)
- [事件 API 参考](/api/events)
