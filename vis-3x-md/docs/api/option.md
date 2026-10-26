# 配置项 Option

`Vis3xOption` 的完整字段参考。

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

## 顶层结构

```ts
interface Vis3xOption {
  type?: ChartType
  series?: Series3D[]
  xAxis3D?: Axis3D
  yAxis3D?: Axis3D
  zAxis3D?: Axis3D
  radar?: RadarConfig
  showCoordinate?: boolean
  lights?: LightConfig[]
  postprocessing?: PostprocessingOptions
  gridFloor?: GridFloorConfig
  controlSettings?: ControlSettings
  theme?: ThemeConfig
  backgroundColor?: string | null
  animation?: AnimationConfig
  interactive?: boolean
  onDemandRendering?: boolean
  legend?: LegendStyle
  tooltip?: TooltipStyle
  label?: LabelStyle
  title?: TitleStyle
  loading?: boolean
}
```

---

## type

`ChartType` · 可选

图表类型名。**通常不需要写**：

- `<VisBar3D>` 由组件注入
- `createChart('bar3D', el)` 由第一个参数指定
- `<VisChart>` 且不写时按 `series[0].type` 推断

需要显式指定的场景是**多类型混排**：

```ts
{ type: 'barLine3D', series: [/* bar3D + line3D */] }
```

| 值 | 说明 |
|---|---|
| `'bar3D'` `'line3D'` `'area3D'` | 笛卡尔图表 |
| `'scatter3D'` `'surface3D'` `'heatmap3D'` | 笛卡尔图表 |
| `'pie3D'` `'radar3D'` `'funnel3D'` `'gauge3D'` | 非笛卡尔图表 |
| `'auto'` | 强制按 `series[0].type` 推断 |
| 任意自定义字符串 | 通过 `defineChart` 等注册的类型 |

---

## series

`Series3D[]` · **唯一必填字段**

数据系列数组。详见 [Series 参考](./series)。

```ts
series: [
  { type: 'bar3D', name: '2024', data: [120, 200, 150] },
  { type: 'bar3D', name: '2025', data: [150, 230, 190] },
]
```

---

## 坐标系

### xAxis3D / yAxis3D / zAxis3D

`Axis3D` · 可选

```ts
{
  xAxis3D: { data: ['Q1', 'Q2', 'Q3'], name: '季度' },
  yAxis3D: { name: '销售额', min: 0, max: 300 },
  zAxis3D: { data: ['北区', '南区'], name: '区域' },
}
```

详见 [坐标轴 Axis](./axis)。

### radar

`RadarConfig` · 可选

仅 `radar3D` 使用：

```ts
{
  radar: {
    indicator: [
      { name: '性能', max: 100 },
      { name: '易用性', max: 100 },
      { name: '生态', max: 100 },
    ],
    splitNumber: 4,
    startAngle: 90,
    shape: 'polygon',
    splitArea: { show: true, opacity: 0.5 },
  },
}
```

| 字段 | 类型 | 默认 | 说明 |
|---|---|---|---|
| `indicator` | `{ name, max, min? }[]` | — | 维度定义，顺序对应 `data[].value` |
| `splitNumber` | `number` | `4` | 同心环数量 |
| `startAngle` | `number` | `90` | 起始角度（度） |
| `shape` | `'polygon' \| 'circle'` | `'polygon'` | 网格形状 |
| `splitArea` | `{ show, opacity }` | — | 环带填充 |

### showCoordinate

`boolean` · 默认 `true`（非笛卡尔图表为 `false`）

是否渲染坐标轴。

```ts
// 想要纯图形、不要坐标轴
{ showCoordinate: false }
```

---

## 渲染环境

### lights

`LightConfig[]` · 可选

不传时使用默认三点光照：

```ts
{
  lights: [
    { type: 'ambient', intensity: 0.55 },
    { type: 'directional', position: [1, 1.6, 1], intensity: 1.6, shadow: true },
    { type: 'directional', position: [-1.2, 0.9, 0.8], color: '#dbeafe', intensity: 0.6 },
    { type: 'directional', position: [-0.6, 0.5, -1.4], color: '#93c5fd', intensity: 0.45 },
  ],
}
```

| 字段 | 类型 | 默认 | 说明 |
|---|---|---|---|
| `type` | `'ambient' \| 'directional' \| 'point' \| 'hemisphere'` | — | 光源类型 |
| `color` | `string` | `'#ffffff'` | 光色 |
| `intensity` | `number` | `1` | 强度 |
| `position` | `[x, y, z]` | `[1, 1, 1]` | 位置（环境光忽略） |
| `shadow` | `boolean` | `false` | 是否投射阴影 |
| `shadowMapSize` | `number` | `1024` | 阴影贴图分辨率 |

### gridFloor

`GridFloorConfig` · 可选

```ts
{
  gridFloor: {
    show: true,
    color: '#33415c',
    divisions: 10,
    showWall: true,
    wallOpacity: 0.12,
    showShadowPlane: true,
    shadowPlaneOpacity: 0.55,
    shadowPlaneColor: '#000000',
  },
}
```

| 字段 | 类型 | 默认 | 说明 |
|---|---|---|---|
| `show` | `boolean` | `true` | 是否显示地面网格 |
| `color` | `string` | 主题相关 | 网格线颜色 |
| `divisions` | `number` | `10` | 网格分割数 |
| `showWall` | `boolean` | `false` | 是否显示背景墙 |
| `wallOpacity` | `number` | `0.12` | 背景墙透明度 |
| `showShadowPlane` | `boolean` | `true` | 是否显示阴影承接面 |
| `shadowPlaneOpacity` | `number` | `0.55` | 承接面透明度 |

### controlSettings

`ControlSettings` · 可选

```ts
{
  controlSettings: {
    interactionMode: 'free',
    enableRotate: true,
    enableZoom: true,
    enablePan: true,
    autoRotate: false,
    autoRotateSpeed: 2.0,
    minDistance: 8,
    maxDistance: 40,
    minPolarAngle: 0.05,
    maxPolarAngle: Math.PI * 0.495,
    minAzimuthAngle: -Infinity,
    maxAzimuthAngle: Infinity,
    enableDamping: true,
    dampingFactor: 0.08,
    cameraDirection: { x: 1, y: 1.15, z: 1 },
    fitToScreenFactor: 0.82,
  },
}
```

| 字段 | 类型 | 默认 | 说明 |
|---|---|---|---|
| `interactionMode` | `'free' \| 'rotate' \| 'fixed'` | `'free'` | 交互模式总开关 |
| `enableRotate` | `boolean` | 按模式 | 显式覆盖：是否可旋转 |
| `enableZoom` | `boolean` | 按模式 | 显式覆盖：是否可缩放 |
| `enablePan` | `boolean` | 按模式 | 显式覆盖：是否可平移 |
| `autoRotate` | `boolean` | `false` | 自动旋转 |
| `autoRotateSpeed` | `number` | `2.0` | 自动旋转速度 |
| `minDistance` / `maxDistance` | `number` | 自动 | 缩放范围 |
| `minPolarAngle` / `maxPolarAngle` | `number` | `0.05` / `π×0.495` | 俯仰角范围（弧度） |
| `minAzimuthAngle` / `maxAzimuthAngle` | `number` | `±Infinity` | 方位角范围（弧度） |
| `enableDamping` | `boolean` | `true` | 是否启用惯性 |
| `dampingFactor` | `number` | `0.08` | 阻尼系数 |
| `cameraDirection` | `{ x, y, z }` | `{1, 1.15, 1}` | 初始视角方向 |
| `fitToScreenFactor` | `number` | `0.82` | 自适应留白系数 |

::: tip 显式字段优先于模式
```ts
{ interactionMode: 'fixed', enableZoom: true }
// 结果：不能旋转、不能平移，但可以缩放
```
:::

### theme

`ThemeConfig` · 可选

```ts
{
  theme: {
    palette: ['#4f8cff', '#22d3ee', '#34d399'],
    backgroundColor: '#0a0f1c',
    textColor: '#94a3b8',
    axisColor: '#475569',
    splitLineColor: '#1e293b',
    tooltipBackgroundColor: 'rgba(15, 23, 42, 0.94)',
    tooltipTextColor: '#f1f5f9',
  },
}
```

也可以用预设：`theme: themes.dark`。

### animation

`AnimationConfig` · 可选

```ts
{
  animation: {
    enabled: true,
    duration: 900,
    updateDuration: 540,
    delay: 0,
    easing: 'cubicOut',
    stagger: 0,
  },
}
```

| 字段 | 类型 | 默认 | 说明 |
|---|---|---|---|
| `enabled` | `boolean` | `true` | 是否启用动画 |
| `duration` | `number` | `900` | 入场时长（ms） |
| `updateDuration` | `number` | `duration × 0.6` | 数据更新时长 |
| `delay` | `number` | `0` | 整体延迟 |
| `easing` | `EasingName` | `'cubicOut'` | 缓动函数 |
| `stagger` | `number` | `0` | 逐项错峰步长 |

### 其他开关

| 字段 | 类型 | 默认 | 说明 |
|---|---|---|---|
| `interactive` | `boolean` | `true` | 是否响应鼠标交互 |
| `onDemandRendering` | `boolean` | `true` | 静止时停止重绘 |
| `backgroundColor` | `string \| null` | 主题值 | 画布背景色，`null` 为透明 |
| `loading` | `boolean` | `false` | 显示加载遮罩 |

---

## 周边组件

### title

```ts
{
  title: {
    show: true,
    text: '销售概览',
    subtext: '单位：万元',
    left: 'left',      // 'left' | 'center' | 'right'
    top: 'top',
  },
}
```

### legend

```ts
{
  legend: {
    show: true,
    position: 'bottom',   // 'top' | 'bottom' | 'left' | 'right'
    selectable: true,
  },
}
```

### tooltip

```ts
{
  tooltip: {
    show: true,
    trigger: 'item',      // 只支持 'item'
    formatter: (p) => `${p.name}: ${p.value}`,
  },
}
```

### label

全局标签配置，可被 `series[].label` 覆盖：

```ts
{
  label: {
    show: true,
    precision: 1,
    formatter: '{value} 万',
    distance: 0.3,
    interval: 0,
  },
}
```

---

## 完整示例

```ts
const option: Vis3xOption = {
  type: 'bar3D',

  // 数据
  series: [
    {
      type: 'bar3D',
      name: '2024 年',
      data: [120, 200, 150, 80],
      label: { show: true, precision: 0 },
      itemStyle: { roughness: 0.3, metalness: 0.3 },
    },
    {
      type: 'bar3D',
      name: '2025 年',
      data: [150, 230, 190, 120],
      label: { show: true, precision: 0 },
    },
  ],

  // 坐标系
  xAxis3D: { data: ['Q1', 'Q2', 'Q3', 'Q4'], name: '季度' },
  yAxis3D: { name: '销售额', min: 0, max: 260 },

  // 环境
  theme: themes.dark,
  lights: [
    { type: 'ambient', intensity: 0.55 },
    { type: 'directional', position: [1, 1.6, 1], intensity: 1.6, shadow: true },
  ],
  gridFloor: { show: true, showWall: true, wallOpacity: 0.12 },
  controlSettings: {
    interactionMode: 'free',
    cameraDirection: { x: 1, y: 1.2, z: 1 },
  },

  // 动画
  animation: { enabled: true, duration: 900, stagger: 60, easing: 'cubicOut' },

  // 组件
  title: { show: true, text: '季度销售额', subtext: '单位：万元' },
  legend: { show: true, position: 'bottom' },
  tooltip: { show: true },
  onDemandRendering: true,
  interactive: true,
}
```

---

## 下一步

- [Series 参考](./series)
- [坐标轴 Axis](./axis)
- [类型定义](./types)
