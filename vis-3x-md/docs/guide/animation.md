# 动画与过渡

vis-3x 有三种动画，由库统一调度，你只需要配置参数。

| 类型 | 触发时机 | 表现 |
|---|---|---|
| **入场** | 首次渲染 | 元素从「零状态」生长出来 |
| **更新** | 数据变化（`setOption`） | 从旧状态平滑过渡到新状态 |
| **交互** | 悬停 / 选中 | 高亮、放大 |

---

## 基础配置

```ts
{
  animation: {
    enabled: true,        // 默认 true
    duration: 900,        // 入场时长（毫秒）
    delay: 0,             // 整体延迟
    easing: 'cubicOut',   // 缓动函数
    stagger: 60,          // 每个数据项错开的时间（毫秒）
    updateDuration: 500,  // 数据更新时长，默认是 duration 的 0.6 倍
  },
}
```

| 字段 | 默认 | 说明 |
|---|---|---|
| `enabled` | `true` | 设为 `false` 则直接落到终态 |
| `duration` | `900` | 入场动画时长 |
| `delay` | `0` | 整体延迟，用于多图表协同 |
| `easing` | `'cubicOut'` | 见下方缓动表 |
| `stagger` | `0` | 错峰步长，做出「依次生长」的效果 |
| `updateDuration` | `duration × 0.6` | 数据更新时的时长 |

### 可用缓动函数

```ts
type EasingName =
  | 'linear'
  | 'quadraticIn' | 'quadraticOut' | 'quadraticInOut'
  | 'cubicIn' | 'cubicOut' | 'cubicInOut'
  | 'elasticOut'      // 弹性，适合强调
  | 'backOut'         // 回弹
  | 'bounceOut'       // 弹跳
  | 'exponentialOut'
```

::: tip 缓动选择建议
- **`cubicOut`（默认）** — 快进慢出，绝大多数场景都合适
- **`quadraticOut`** — 数据更新时的柔和过渡，不抢注意力
- **`elasticOut` / `backOut`** — 用于仪表盘指针、强调单一数值，别用在几十个元素上
- **`linear`** — 持续旋转、匀速循环动画
:::

---

## 逐项错峰（stagger）

`stagger` 让每个数据项依次启动动画，形成「依次生长」的节奏：

```ts
{
  animation: { duration: 800, stagger: 80 },
  series: [{ type: 'bar3D', data: [120, 200, 150, 80, 170, 140] }],
}
// 第 1 根柱子：0ms 开始
// 第 2 根柱子：80ms 开始
// 第 3 根柱子：160ms 开始
// ...
// 全部结束：800 + 5×80 = 1200ms
```

::: warning stagger 不要设太大
`总时长 = duration + (数据项数 - 1) × stagger`

30 个数据项、`stagger: 100` 时总时长会到 **3.7 秒**，用户会觉得卡。
数据项多时调小 `stagger`（10~20），或者设为 0。
:::

---

## 系列级覆盖

每个系列可以有自己的动画配置：

```ts
series: [
  {
    type: 'bar3D',
    name: '主系列',
    data: [...],
    animation: { duration: 1200, stagger: 100 },  // 慢一点，强调
  },
  {
    type: 'bar3D',
    name: '对比系列',
    data: [...],
    animation: { duration: 600, delay: 400 },     // 晚 400ms 开始
  },
]
```

优先级：**系列级 > 全局**。

---

## 关闭动画

```ts
// 全局关闭
{ animation: { enabled: false } }

// 单个系列关闭
series: [{ type: 'bar3D', data: [...], animation: { enabled: false } }]
```

关闭后元素直接出现在终态，没有过渡。适合：
- 数据量大（几百个点）且不需要动画
- 生成静态截图
- 用户开启了系统的「减少动态效果」

---

## 尊重用户的动效偏好

如果你的应用需要尊重系统级的「减少动态效果」设置：

```ts
const prefersReduced =
  typeof window !== 'undefined' &&
  window.matchMedia('(prefers-reduced-motion: reduce)').matches

const option = {
  animation: { enabled: !prefersReduced },
  // ...
}
```

库本身不会自动读取这个设置——因为有些产品（比如数据大屏）即使在减少动效模式下也希望保留动画。这个判断交给使用者。

---

## 自定义图表的动画

用 `defineChart` 定义图表时，`ctx.transition` 提供统一的动画能力，**与内置图表使用同一套系统**：

```ts
import { defineChart } from 'vis-3x'

defineChart({
  type: 'my3D',
  render(ctx) {
    const plan = ctx.transition        // 拿到本轮渲染的过渡计划

    ctx.series[0].data.forEach((item, i) => {
      const value = typeof item === 'number' ? item : item.value
      const mesh = new THREE.Mesh(...)
      mesh.position.set(x, ctx.coord.yAt(0), 0)
      ctx.add(mesh)

      // 登记动画：从底部向上生长
      plan.scaleY(mesh, i)
    })

    plan.run()              // 统一启动
    ctx.keepAnimating()     // 动画期间保持重绘
  },
})
```

### 可用的动画方法

| 方法 | 效果 | 适用 |
|---|---|---|
| `plan.scaleY(obj, i)` | 沿 Y 轴从 0 缩放到 1 | 柱子、面积、曲面（几何体底部需在局部 `y=0`） |
| `plan.scaleXZ(obj, i)` | 沿 XZ 平面径向缩放 | 雷达面片、饼图（从中心向外扩） |
| `plan.fade(obj, i)` | 透明度从 0 到目标值 | 散点、面片、任意材质 |
| `plan.custom(fn, i)` | 自定义属性插值 | 数值滚动、位置移动等 |

`custom` 收到的参数是缓动后的进度 `t`（0~1）：

```ts
plan.custom(
  (t) => {
    const v = startValue + (targetValue - startValue) * t
    pointer.rotation.z = degToRad(v)
    updateDetailText(v)
  },
  dataIndex,
  {
    extraDelay: 120,                       // 额外延迟
    finish: () => { /* 动画结束时的收尾 */ },
  }
)
```

::: warning 几何体基准点很重要
`scaleY` 假设几何体底部位于局部 `y = 0`，这样缩放时底部固定、顶部上升。

如果用 `BoxGeometry`（中心在原点），需要自己同步 `position.y`：

```ts
const h = targetHeight * t
mesh.scale.y = h / targetHeight
mesh.position.y = h / 2
```

或者直接用 `plan.custom` 处理。
:::

---

## 动画期间的重绘

库默认是**按需渲染**：场景静止时停止重绘以省电。

动画期间必须保持重绘，否则画面不会更新。这一点由 `ctx.keepAnimating()`（自定义图表）或 `keepRenderingWhileAnimating()`（继承 ChartBase）处理，内置图表已自动调用。

如果你在自己的图表里用了 `this.animations.add(...)` 但画面不动，检查是否漏了这一步：

```ts
// 继承 ChartBase 时
this.keepRenderingWhileAnimating()
```

---

## 与数据更新配合

数据更新时动画会**自动播放**，不需要额外操作：

```ts
chart.setOption({
  series: [{ type: 'bar3D', data: [50, 120, 200] }],  // 新数据
})
// 柱子从旧高度平滑过渡到新高度
```

时长由 `updateDuration` 控制：

```ts
{
  animation: {
    duration: 900,          // 入场 900ms
    updateDuration: 300,    // 更新只用 300ms，避免等待
  },
}
```

::: tip 为什么更新要更快
入场动画是「第一次见面」，可以慢一点展示细节。
数据更新通常是用户主动操作（点了按钮、切了筛选条件），需要**快速反馈**。
900ms 的等待会让人觉得卡顿，300ms 左右比较合适。
:::

---

## 下一步

- [视角交互](./interaction) — 相机与交互模式
- [自定义图表 · 渲染上下文](/custom/render-context) — `ctx` 完整参考
