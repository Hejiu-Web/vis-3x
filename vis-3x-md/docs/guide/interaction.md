# 视角交互

3D 图表的视角控制是最容易被忽略、也最容易出问题的地方。这一页讲清楚 vis-3x 的交互模型。

---

## 交互模式

用一个语义化开关决定用户能否调整视角：

```ts
{
  controlSettings: {
    interactionMode: 'free',   // 默认：旋转 + 缩放 + 平移
  },
}
```

| 模式 | 旋转 | 缩放 | 平移 | 适用场景 |
|---|---|---|---|---|
| `'free'`（默认） | ✅ | ✅ | ✅ | 探索性数据展示 |
| `'rotate'` | ✅ | ❌ | ❌ | 允许换角度但保持构图稳定 |
| `'fixed'` | ❌ | ❌ | ❌ | 大屏看板、导出、演示 |

### 各模式的取舍

**`free`** — 默认。用户可以全方位探索数据，但也可能把视角转到很别扭的位置。

**`rotate`** — 只能转动角度，远近与位置锁定。适合「同一组数据要对比多个图表」的场景：用户转动一个，其他图表的构图不会跑偏。

**`fixed`** — 完全锁定。适合：
- 投屏展示，不希望观众误触
- 生成一致的视觉稿
- 移动端，避免手势与页面滚动冲突

::: tip 固定视角 ≠ 关闭交互
`interactionMode: 'fixed'` **只锁定相机**。
悬停高亮、点击事件、提示框**依然完全可用**。

如果连数据交互也要关闭：

```ts
{ interactive: false }
```
:::

---

## Vue 组件用法

```vue
<VisBar3D :option="option" interaction-mode="fixed" />
```

---

## 运行时切换

```ts
chart.setInteractionMode('fixed')   // 锁定
chart.setInteractionMode('free')    // 恢复

chart.interactionMode               // 读取当前模式
chart.isCameraInteractive           // 相机当前是否可操作
```

典型用法是做一个「锁定视角」按钮：

```ts
const locked = ref(false)

function toggleLock() {
  locked.value = !locked.value
  chartRef.value?.getChart()?.setInteractionMode(locked.value ? 'fixed' : 'free')
}
```

---

## 精细控制

`interactionMode` 是总开关，具体行为还可以用细粒度字段调整。**显式字段优先级高于模式默认值**：

```ts
{
  controlSettings: {
    interactionMode: 'fixed',   // 模式说「全禁用」
    enableZoom: true,           // 但显式开启缩放 → 最终可缩放
  },
}
```

### 限制俯仰角

防止用户转到「地面以下」看到穿帮：

```ts
{
  controlSettings: {
    minPolarAngle: 0.15,              // 最多俯视 ~8.6°
    maxPolarAngle: Math.PI / 2.1,     // 最少俯视 ~85.7°
    // 默认值：min 0.05，max π×0.495（略小于 90°）
  },
}
```

极角的定义：`0` 是正上方俯视，`π/2` 是水平视角。

### 限制方位角

把可旋转的水平范围限制在一个区间：

```ts
{
  controlSettings: {
    minAzimuthAngle: -Math.PI / 3,   // -60°
    maxAzimuthAngle: Math.PI / 3,    // 60°
  },
}
```

### 限制缩放范围

```ts
{
  controlSettings: {
    minDistance: 8,    // 最近
    maxDistance: 40,   // 最远
    // 不设时由相机自适应自动计算
  },
}
```

### 调整默认视角

```ts
{
  controlSettings: {
    cameraDirection: { x: 1, y: 1.5, z: 1 },
    // y 越大，初始视角越偏俯视
    // 默认 { x: 1, y: 1.15, z: 1 }
  },
}
```

### 自动旋转

```ts
{
  controlSettings: {
    autoRotate: true,
    autoRotateSpeed: 0.6,   // 默认 2.0，建议调小
  },
}
```

::: warning autoRotate 会持续重绘
开启后库会切到持续渲染模式，不再省电。
数据大屏上长时间运行要注意 GPU 占用。

用户交互（拖拽）时会自动暂停，松手后继续。
:::

### 阻尼（惯性）

```ts
{
  controlSettings: {
    enableDamping: true,      // 默认 true
    dampingFactor: 0.08,      // 越小越顺滑，但停得越慢
  },
}
```

::: tip fixed 模式会自动关闭阻尼
否则松手后相机会继续漂移一段，看起来像「锁不住」。
:::

---

## 触屏与移动端

OrbitControls 原生支持触摸：

| 手势 | 行为 |
|---|---|
| 单指拖动 | 旋转 |
| 双指捏合 | 缩放 |
| 双指拖动 | 平移 |

如果图表嵌在可滚动的页面里，建议在移动端锁定或限制交互，避免手势冲突：

```ts
const isMobile = /Mobi|Android/i.test(navigator.userAgent)

const option = {
  controlSettings: {
    interactionMode: isMobile ? 'fixed' : 'free',
  },
}
```

---

## 相机自适应

图表首次渲染时会自动调整相机，让内容完整入镜：

```ts
chart.fitToScreen()   // 手动触发
```

内部逻辑：计算内容的包围盒 → 根据相机 FOV 与宽高比算出合适距离 → 保持当前观察方向不变，只调整距离与目标点。

可以控制留白程度：

```ts
{
  controlSettings: {
    fitToScreenFactor: 0.82,
    // 0.5 = 内容占满画面（可能贴边）
    // 1.0 = 大量留白（内容显得小）
  },
}
```

::: warning 数据更新时不会自动重新适配
这是有意设计：用户调整过视角后，数据更新不应该打断他。

只有**首次渲染**会调用 `fitToScreen`。需要重新适配时手动调用。
:::

---

## 重置视角

```ts
chart.resetCamera()
```

会回到 `cameraDirection` 指定的方向，距离保持不变。

```ts
// Vue 组件
chartRef.value?.resetCamera()
```

---

## 相机事件

```ts
chart.on('camera:change', (payload) => {
  console.log(payload.position)   // { x, y, z }
  console.log(payload.target)     // { x, y, z }
})
```

高频触发（每帧移动都触发）。如果需要做持久化，建议节流：

```ts
let timer: number | undefined
chart.on('camera:change', (payload) => {
  clearTimeout(timer)
  timer = window.setTimeout(() => {
    localStorage.setItem('camera', JSON.stringify(payload))
  }, 400)
})
```

---

## 常见问题

::: details 为什么拖不动？
按可能性排列：

1. `interactionMode` 是 `'fixed'`，或 `enableRotate` 被显式设为 `false`
2. 图表没渲染成功（检查控制台报错）
3. 容器上有别的元素盖住（检查 z-index 与 `pointer-events`）

可以读取 `chart.isCameraInteractive` 判断当前是否可交互。
:::

::: details 为什么转到某些角度会「穿帮」？
默认允许俯视到接近水平（`maxPolarAngle = π × 0.495`），
再往下就会看到地面网格的背面。

限制俯角即可：

```ts
controlSettings: { maxPolarAngle: Math.PI / 2.4 }
```
:::

::: details 滚轮缩放会带着页面一起滚
OrbitControls 阻止了滚轮默认行为，但某些嵌套布局下可能失效。

可以显式加样式：

```css
.vt-container {
  overscroll-behavior: contain;
}
```
:::

---

## 下一步

- [事件系统](./events)
- [ControlSettings API](/api/environment)
