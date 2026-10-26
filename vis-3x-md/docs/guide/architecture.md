# 架构

这一页说明 vis-3x 的内部结构。理解它有助于定位问题，也解释了为什么扩展 API 能写得这么短。

---

## 分层

```
  入口层
  createChart / <VisBar3D> / useVisChart / defineChart
                          │
                ┌─────────▼──────────┐
                │     ChartBase      │  生命周期 · 配置解析 · 事件 · 导出
                └─────────┬──────────┘
                          │
     ┌────────────┬───────┴────────┬──────────────┐
     ▼            ▼                ▼              ▼
 Cartesian3D  SceneEnvironment  Interaction  LabelManager
  坐标映射      轴 / 网格 / 光照   射线拾取     CSS2D 标签
     └────────────┴───────┬────────┴──────────────┘
                          ▼
                       Engine
          场景 · 相机 · 渲染器 · 光照 · OrbitControls · 按需渲染
                          │
                  ResourceManager
            几何体 / 材质 / 贴图 统一登记与释放
```

每一层只依赖它下面的一层，可以独立替换。

---

## 各模块职责

| 模块 | 源码行数 | 职责 |
|---|---|---|
| `Engine` | ~915 | Three.js 场景、透视相机、WebGLRenderer、CSS2DRenderer、OrbitControls、光照、按需渲染调度 |
| `ChartBase` | ~652 | 图表基类。解析配置、协调子系统、派发事件、管理生命周期 |
| `Cartesian3D` | ~448 | 数据值 ↔ 世界坐标的双向映射、网格尺寸推导、Y 轴范围计算 |
| `SceneEnvironment` | ~526 | 坐标轴、地面网格、背景墙、阴影承接面的构建与更新 |
| `InteractionManager` | ~374 | 射线拾取、悬停态、点击事件、光标管理 |
| `LabelManager` | ~228 | HTML 标签（CSS2D）的创建、定位、分组与文本格式化 |
| `ResourceManager` | ~421 | 几何体/材质/贴图的登记与释放，材质按参数缓存 |
| `registry` | ~782 | 类型注册表、`createChart`、`defineChart` / `extendChart` / `registerChart`、插件 |
| `EventBus` | ~134 | 类型安全的事件订阅与派发 |

---

## 继承链

```
ChartBase
   ├── Bar3DChart        ← registerChart('bar3D', ...)
   ├── Line3DChart
   ├── Area3DChart
   ├── Pie3DChart
   ├── Scatter3DChart
   ├── Surface3DChart
   ├── Radar3DChart
   ├── Funnel3DChart
   ├── Gauge3DChart
   ├── Heatmap3DChart
   └── DefinedChart      ← defineChart() 动态生成的子类
        └── （extendChart 再继承它）
```

::: tip `defineChart` 不是"另一套系统"
它内部会动态创建一个 `ChartBase` 子类，然后把常用能力包装成 `ctx` 对象传给你的 `render` 函数。

所以 `defineChart` 定义的图表和内置图表**完全等价**：可以被 `extendChart` 继承，
也会出现在 `getRegisteredTypes()` 里，交互、动画、资源管理的行为一致。
:::

---

## 一次渲染发生了什么

```
setOption(option)
  │
  ├─ resolveOption()            填充默认值、推导网格尺寸
  │
  ├─ environment.build()        重建坐标轴 / 网格 / 光照
  │
  ├─ clearSeries()              清空上一轮的对象
  ├─ animations.clear()         清空上一轮的动画
  │
  ├─ renderSeries()             ← 你的绘制逻辑（或内置图表的）
  │     ├─ createTransitionPlan()   创建过渡计划
  │     ├─ 创建几何体 / 材质 / 标签
  │     ├─ makePickable()           标记可交互对象
  │     └─ plan.run()               启动动画
  │
  ├─ legendCallback()           通知图例更新
  │
  ├─ fitToScreen()              仅首次渲染时调整相机
  │
  └─ emit('chart:rendered')     派发渲染完成事件
```

数据更新时重复 `clearSeries` 之后的部分。这解释了一个常见疑问：

::: details 为什么自定义的网格每次渲染都会被清掉
`clearSeries()` 会清空 `seriesGroup` 的全部子对象。

所以 `render` 里**不要缓存网格对象**——每次都是从零创建。
库会在渲染前释放上一轮的几何体与材质（通过 `ResourceManager`）。

需要跨渲染保持的对象（比如装饰性外框）请挂到 `engine.scene` 而不是 `seriesGroup`。
:::

---

## 按需渲染

默认 `onDemandRendering: true`。渲染只在三种情况下发生：

1. 相机移动
2. 动画进行中
3. 显式调用 `chart.requestRender()`

`ChartBase.keepRenderingWhileAnimating()` 会在动画期间注册一个每帧回调，
动画结束后自动注销。这就是自定义图表必须调用 `ctx.keepAnimating()` 的原因。

---

## 资源管理

`ResourceManager` 追踪三类资源：

| 类型 | 登记方式 |
|---|---|
| 几何体 | `ctx.geometry.*` 自动登记；自建的用 `ctx.geometry.track(geo)` |
| 材质 | `ctx.material()` 自动登记，且**按参数缓存复用** |
| 贴图 | 随材质登记 |

释放时机：图表 `dispose()` 时全部释放；物体被移出场景时通过 `disposeSubtree()` 单独释放。

::: tip 材质缓存的意义
相同参数的材质只创建一个实例。100 根同色柱子共享 1 个材质，
而不是 100 个——大幅减少 GL 状态切换。

需要独立材质（要单独改颜色/透明度）时用 `ctx.uniqueMaterial()`。
:::

---

## 依赖方向

```
charts/*  ──┐
presets/* ──┼──► ChartBase ──► Engine ──► three
components/*┘         │
                      ├──► Cartesian3D
                      ├──► SceneEnvironment
                      ├──► ResourceManager
                      ├──► LabelManager
                      └──► InteractionManager
```

图表实现只依赖 `ChartBase`，不直接接触 Three.js 的渲染流程——除了创建几何体与材质。

这也是**不用 Vue 也能跑**的原因：Vue 组件层（`components/`）是包在 `ChartBase` 外面的一层薄封装，
命令式 API 直接使用 `ChartBase`，不引入 Vue 运行时。

---

## 目录结构

```
packages/vis-3x/src/
├── core/
│   ├── ChartBase.ts          图表基类
│   ├── Engine.ts             Three.js 封装
│   ├── Cartesian3D.ts        坐标映射
│   ├── SceneEnvironment.ts   轴/网格/光照
│   ├── InteractionManager.ts 射线拾取
│   ├── LabelManager.ts       CSS2D 标签
│   ├── ResourceManager.ts    资源追踪
│   ├── registry.ts           类型注册 + 扩展 API
│   ├── TransitionPlan.ts     过渡动画
│   ├── EventBus.ts           事件总线
│   ├── CSS2DRenderer.ts      标签渲染器
│   └── chart-base-ref.ts     破解循环依赖的中立桥接
├── charts/                   10 个内置图表实现
├── components/               Vue 组件层
├── composables/              useVisChart
├── presets/                  主题 + 6 个扩展示例图表
├── adapters/                 ECharts 配置适配器
├── types/                    全部类型定义
└── utils/                    颜色 / 数学 / 缓动 / 对象池
```

::: details 为什么需要 chart-base-ref.ts
`ChartBase` 需要调用 `registry` 的函数，而 `registry` 需要 `ChartBase` 的构造函数类型。
两者互相引用会形成 ESM 循环依赖，导致 `Cannot access 'X' before initialization`。

`chart-base-ref.ts` 是一个不含任何 import 的中立模块：
`ChartBase` 在模块末尾把类注册进去，`registry` 在运行时取出。
这样把循环依赖变成了运行时的单向查找。
:::

---

## 可替换性

各层之间是组合而非硬编码依赖，所以：

```ts
// 只用引擎，不要任何图表逻辑
import { Engine } from 'vis-3x'
const engine = new Engine(container, { /* ... */ })
// 自己往 engine.scene 里加东西
```

```ts
// 不要 Vue 组件层
import { createChart } from 'vis-3x'   // 不触发 Vue 运行时加载
```

```ts
// 只用一个图表实现类
import { Bar3DChart } from 'vis-3x/charts'
```

子路径入口让打包器可以只包含用到的部分。

---

## 下一步

- [自定义图表](/custom/) — 基于这套架构做扩展
- [性能优化](/guide/performance)
- [类型定义](/api/types)
