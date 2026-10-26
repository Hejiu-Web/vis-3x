# 类型定义

vis-3x 的类型都可以从包根导入。这一页列出主要类型及其用途。

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

## 导入方式

```ts
// 全部类型
import type {
  Vis3xOption,
  Series3D,
  Bar3DSeries,
  Axis3D,
  ItemStyle,
  ChartRenderContext,
} from 'vis-3x'

// 或从子路径（纯类型，编译后消失）
import type { Vis3xOption } from 'vis-3x/types'
```

---

## 顶层类型

### Vis3xOption

图表配置。唯一必填字段是 `series`。

```ts
import type { Vis3xOption } from 'vis-3x'

const option: Vis3xOption = {
  series: [{ type: 'bar3D', data: [1, 2, 3] }],
}
```

详见 [配置项 Option](./option)。

### ChartType

```ts
type BuiltinChartType =
  | 'bar3D' | 'line3D' | 'area3D' | 'pie3D' | 'scatter3D'
  | 'surface3D' | 'radar3D' | 'funnel3D' | 'gauge3D' | 'heatmap3D'

type ChartType = BuiltinChartType | 'auto' | (string & {})
```

`(string & {})` 让自定义类型名也能通过类型检查，同时保留内置类型的自动补全。

### Series3D

```ts
type Series3D =
  | Bar3DSeries
  | Line3DSeries
  | Area3DSeries
  | Pie3DSeries
  | Scatter3DSeries
  | Surface3DSeries
  | Radar3DSeries
  | Funnel3DSeries
  | Gauge3DSeries
  | Heatmap3DSeries
  | CustomSeries
```

可辨识联合。按 `type` 收窄：

```ts
function handle(series: Series3D) {
  if (series.type === 'bar3D') {
    series.borderRadius    // ✓
  }
}
```

详见 [Series 参考](./series)。

### SeriesOf

按类型名取对应的系列接口：

```ts
type SeriesOf<T extends BuiltinSeriesType> =
  T extends 'bar3D' ? Bar3DSeries :
  T extends 'line3D' ? Line3DSeries :
  // ...
```

```ts
type MyBar = SeriesOf<'bar3D'>   // Bar3DSeries
```

---

## 数据项类型

```ts
type DataItem = number | number[] | SingleValueDataItem | MultiValueDataItem

interface BaseDataItem {
  name?: string
  itemStyle?: ItemStyle
  label?: LabelStyle
}

interface SingleValueDataItem extends BaseDataItem {
  value: number
}

interface MultiValueDataItem extends BaseDataItem {
  value: number[]
}
```

---

## 样式类型

| 类型 | 用途 | 详见 |
|---|---|---|
| `ItemStyle` | 图形材质（PBR 参数） | [样式 Style](./style) |
| `LineStyle` | 线样式 | [样式 Style](./style) |
| `TextStyle` | 文字样式 | [样式 Style](./style) |
| `AreaStyle` | 面样式 | [样式 Style](./style) |
| `PointStyle` | 数据点样式 | [Series 参考](./series) |
| `LabelStyle` | 标签样式 | [Series 参考](./series) |
| `ColorLike` | `string \| number` | [样式 Style](./style) |

---

## 坐标轴类型

| 类型 | 用途 |
|---|---|
| `Axis3D` | 单个轴的配置 |
| `AxisLine` | 轴线 |
| `AxisTick` | 刻度线 |
| `AxisLabel` | 刻度文字 |
| `SplitLine` | 分割线 |
| `AxisName` | 轴名称 |
| `RadarConfig` | 雷达图坐标系 |
| `RadarIndicator` | 雷达图维度定义 |

详见 [坐标轴 Axis](./axis)。

---

## 环境类型

| 类型 | 用途 |
|---|---|
| `LightConfig` | 光源 |
| `GridFloorConfig` | 地面网格 |
| `ControlSettings` | 相机与交互 |
| `ThemeConfig` | 主题 |
| `AnimationConfig` | 动画 |
| `InteractionMode` | `'free' \| 'rotate' \| 'fixed'` |
| `PostprocessingOptions` | 后处理 |

详见 [光照与环境](./environment)。

---

## 事件类型

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

type ChartEventType = keyof ChartEventMap
type ChartEventPayload<T extends ChartEventType> = ChartEventMap[T]
```

负载基类：

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

详见 [事件列表](./events)。

---

## 扩展 API 类型

| 类型 | 用途 |
|---|---|
| `ChartRenderContext` | `defineChart` 的 `render` 回调参数 |
| `ChartRenderFn` | `(ctx) => void` |
| `DefineChartOptions` | `defineChart` 的参数 |
| `ChartLifecycleHooks` | 生命周期钩子 |
| `ChartConstructor` | 图表类构造函数 |
| `ChartPlugin` | 插件接口 |
| `ChartPluginContext` | 插件的 `install` 参数 |
| `ChartThemeTokens` | `ctx.theme` 的结构 |

```ts
import type {
  ChartRenderContext,
  DefineChartOptions,
  ChartPlugin,
} from 'vis-3x'
```

详见[自定义图表](/custom/)。

---

## 组件类型

| 类型 | 用途 |
|---|---|
| `ChartComponentProps` | 所有图表组件的 props |
| `ChartComponentExposed` | 组件 ref 暴露的方法 |
| `CreateChartComponentOptions` | `createChartComponent` 的参数 |
| `BaseChartProps` | `VisChartBase` 的 props |

```ts
import type { ChartComponentExposed } from 'vis-3x'

const chartRef = ref<ChartComponentExposed>()
chartRef.value?.exportImage({ scale: 2 })
```

---

## 组合式与适配器类型

| 类型 | 用途 |
|---|---|
| `UseVisChartOptions` | `useVisChart` 的参数 |
| `UseVisChartReturn` | `useVisChart` 的返回值 |
| `EchartsLikeOption` | ECharts 风格的配置 |
| `ThemeName` | `'dark' \| 'light' \| 'blue' \| 'warm' \| 'mono'` |
| `ExtraChartType` | 6 个扩展示例图表的类型名 |

---

## 核心类类型

| 类型 | 用途 |
|---|---|
| `ResolvedChartOption` | 已解析的配置（默认值已填充） |
| `LegendItemData` | 图例项数据 |
| `CartesianConfig` | 坐标系配置 |
| `AxisMapping` | 单轴映射配置 |
| `DataExtent` | 数值范围 |
| `EngineOptions` | 引擎参数 |
| `EasingFn` | 缓动函数 |

---

## 泛型用法示例

```ts
import type { Vis3xOption, SeriesOf } from 'vis-3x'

// 把某个图表的 series 抽成可复用类型
type RevenueSeries = SeriesOf<'bar3D'>

function makeSeries(name: string, data: number[]): RevenueSeries {
  return {
    type: 'bar3D',
    name,
    data,
    borderRadius: 0.08,
  }
}

const option: Vis3xOption = {
  xAxis3D: { data: ['Q1', 'Q2', 'Q3'] },
  series: [makeSeries('2024', [120, 200, 150])],
}
```

---

## 类型检查建议

`tsconfig.json` 推荐配置：

```json
{
  "compilerOptions": {
    "strict": true,
    "moduleResolution": "bundler",
    "skipLibCheck": true
  }
}
```

::: tip 为什么需要 bundler / node16
库的 `package.json` 用 `exports` 字段声明入口。
旧的 `moduleResolution: "node"` 不认这个字段，会找不到类型声明。
:::

::: details 写配置时用 as const 还是显式标注
两者都可。显式标注 `Vis3xOption` 的好处是**能提前发现字段拼写错误**：

```ts
// 标注类型 → 拼错会报错
const option: Vis3xOption = {
  series: [{ type: 'bar3D', borderRaidus: 0.1 }],  // ✗ 报错
}

// as const → 不报错，但传到组件时才暴露问题
const option = {
  series: [{ type: 'bar3D', borderRaidus: 0.1 }],
} as const
```

建议在定义配置的地方显式标注类型。
:::

---

## 下一步

- [配置项 Option](./option)
- [Series 参考](./series)
- [实例方法](./instance)
