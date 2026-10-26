# 光照与环境

控制图表的观感：光照、地面、背景、后处理、相机。

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

## lights

`LightConfig[]` · 可选

不传时使用默认的三点光照。

```ts
{
  lights: [
    { type: 'ambient', intensity: 0.55 },
    {
      type: 'directional',
      position: [1, 1.6, 1],
      intensity: 1.6,
      shadow: true,
      shadowMapSize: 2048,
    },
    { type: 'directional', position: [-1.2, 0.9, 0.8], color: '#dbeafe', intensity: 0.6 },
    { type: 'directional', position: [-0.6, 0.5, -1.4], color: '#93c5fd', intensity: 0.45 },
  ],
}
```

| 字段 | 类型 | 默认 | 说明 |
|---|---|---|---|
| `type` | `LightType` | — | 光源类型 |
| `color` | `ColorLike` | `'#ffffff'` | 光色 |
| `intensity` | `number` | `1` | 强度 |
| `position` | `[number, number, number]` | `[1, 1, 1]` | 位置（环境光忽略） |
| `shadow` | `boolean` | `false` | 是否投射阴影 |
| `shadowMapSize` | `number` | `1024` | 阴影贴图分辨率 |

### 光源类型

| type | 说明 |
|---|---|
| `'ambient'` | 环境光。均匀照亮所有面，**消除明暗对比**，是让颜色接近 2D 观感的手段 |
| `'directional'` | 平行光。有明确方向，产生明暗面与阴影，是塑造立体感的主力 |
| `'point'` | 点光源。从一点向四周发散，有距离衰减 |
| `'hemisphere'` | 半球光。天空色与地面色不同，模拟自然环境光 |

### 默认三点光照的构成

```ts
[
  // ① 环境光：抬升暗部，避免死黑
  { type: 'ambient', intensity: 0.55 },

  // ② 主光：右上方向，投射阴影，决定主要明暗关系
  { type: 'directional', position: [1, 1.6, 1], intensity: 1.6, shadow: true },

  // ③ 补光：左前下方，柔和冷色，把暗部提亮
  { type: 'directional', position: [-1.2, 0.9, 0.8], color: '#dbeafe', intensity: 0.6 },

  // ④ 轮廓光：后方，勾出物体边缘，增强与背景的分离
  { type: 'directional', position: [-0.6, 0.5, -1.4], color: '#93c5fd', intensity: 0.45 },
]
```

::: tip 为什么要补光和轮廓光
只有主光时，物体背光面会暗到看不清形状，而且容易和深色背景糊在一起。

补光提亮暗部保留细节，轮廓光在边缘形成一条亮边把物体「抠」出来。
这是产品级渲染的常规做法，代价很小。
:::

### 阴影的性能代价

| 配置 | 开销 |
|---|---|
| `shadow: false` | 无 |
| `shadow: true, shadowMapSize: 1024` | 场景多渲染 1 遍 |
| `shadow: true, shadowMapSize: 2048` | 多渲染 1 遍 + 4 倍阴影贴图内存 |
| `shadow: true, shadowMapSize: 4096` | 多数集成显卡明显掉帧 |

数据看板场景建议用 `gridFloor.showShadowPlane`（接触阴影）代替真实阴影——
几乎无开销，视觉上够用。

---

## gridFloor

`GridFloorConfig` · 可选

地面网格、背景墙、阴影承接面。

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
| `color` | `ColorLike` | 主题值 | 网格线颜色 |
| `divisions` | `number` | `10` | 网格分割数 |
| `showWall` | `boolean` | `false` | 是否显示背景墙 |
| `wallOpacity` | `number` | `0.12` | 背景墙透明度 |
| `showShadowPlane` | `boolean` | `true` | 是否显示阴影承接面 |
| `shadowPlaneOpacity` | `number` | `0.55` | 承接面透明度 |
| `shadowPlaneColor` | `ColorLike` | `'#000000'` | 承接面颜色 |

::: tip 背景墙的作用
`showWall: true` 会在网格的两个远边各立起一面半透明墙。

它本身没什么信息量，但能**界定空间边界**，让观众明确感知到「这是一个有深度的盒子」，
显著提升纵深感。`wallOpacity: 0.1~0.15` 足够，太明显会喧宾夺主。
:::

::: tip 阴影承接面
`showShadowPlane` 在网格下方铺一层极淡的暗色平面。

它不产生真实阴影，只是给柱子一个「落地」的视觉暗示。
配合真实的 `lights[].shadow` 效果更好，单独用也能改善「柱子悬空」的感觉。
:::

---

## controlSettings

`ControlSettings` · 可选

相机与交互控制。

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
| `interactionMode` | `'free' \| 'rotate' \| 'fixed'` | `'free'` | 交互模式 |
| `enableRotate` | `boolean` | 按模式 | 显式覆盖：旋转 |
| `enableZoom` | `boolean` | 按模式 | 显式覆盖：缩放 |
| `enablePan` | `boolean` | 按模式 | 显式覆盖：平移 |
| `autoRotate` | `boolean` | `false` | 自动旋转 |
| `autoRotateSpeed` | `number` | `2.0` | 自动旋转速度 |
| `minDistance` | `number` | 自动 | 最近距离 |
| `maxDistance` | `number` | 自动 | 最远距离 |
| `minPolarAngle` | `number` | `0.05` | 最小极角（弧度） |
| `maxPolarAngle` | `number` | `π × 0.495` | 最大极角（弧度） |
| `minAzimuthAngle` | `number` | `-Infinity` | 最小方位角 |
| `maxAzimuthAngle` | `number` | `Infinity` | 最大方位角 |
| `enableDamping` | `boolean` | `true` | 惯性阻尼 |
| `dampingFactor` | `number` | `0.08` | 阻尼系数，越小越顺滑 |
| `cameraDirection` | `{ x, y, z }` | `{1, 1.15, 1}` | 初始视角方向 |
| `fitToScreenFactor` | `number` | `0.82` | 自适应留白系数 |

### 极角与方位角

```
极角（polar）
  0      = 正上方俯视
  π/2    = 水平视角
  π      = 正下方仰视（会看到地面背面）

方位角（azimuth）
  0      = 正前方
  π/2    = 右侧
  ±π     = 正后方
```

::: warning 默认 maxPolarAngle 是 π×0.495
略小于 90°，避免用户转到地面以下看到网格背面穿帮。

需要更严格的限制：

```ts
controlSettings: { maxPolarAngle: Math.PI / 2.4 }   // 最多俯视约 75°
```
:::

### 显式字段优先于模式

```ts
{
  controlSettings: {
    interactionMode: 'fixed',   // 模式：全部禁用
    enableZoom: true,           // 显式：允许缩放
  },
}
// 结果：不能旋转、不能平移，但可以缩放
```

详见[视角交互](/guide/interaction)。

---

## theme

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

| 字段 | 类型 | 说明 |
|---|---|---|
| `palette` | `string[]` | 数据系列调色板 |
| `backgroundColor` | `string \| null` | 画布背景 |
| `textColor` | `string` | 通用文字色 |
| `axisColor` | `string` | 坐标轴色 |
| `splitLineColor` | `string` | 分割线色 |
| `tooltipBackgroundColor` | `string` | 提示框背景 |
| `tooltipTextColor` | `string` | 提示框文字 |

---

## backgroundColor

`string | null` · 默认取主题值

```ts
{ backgroundColor: '#0a0f1c' }   // 不透明背景
{ backgroundColor: null }        // 透明，透出下层 DOM
```

设为 `null` 时画布透明，适合把图表叠在自定义背景上。

---

## postprocessing

`PostprocessingOptions` · 可选

```ts
{
  postprocessing: {
    enabled: false,
    bloom: { enabled: true, strength: 0.4, radius: 0.6, threshold: 0.85 },
    vignette: { enabled: false, offset: 0.3, darkness: 0.6 },
  },
}
```

::: warning 后处理是全屏开销
每个启用的通道都会对整幅画面做一次额外处理。

`bloom`（辉光）在深色背景上有很好的效果，但会明显降低帧率。
只在元素较少、静态展示的场景使用。
:::

---

## 各主题的环境差异

不同主题除了颜色，光照与背景也会不同：

| 主题 | 背景 | 光照特点 |
|---|---|---|
| `dark` | 深蓝黑 | 强对比，阴影明显 |
| `light` | 白色 | 环境光占比更高，阴影柔和 |
| `blue` | 深蓝 | 冷色调补光 |
| `warm` | 暖褐黑 | 暖色主光 |
| `mono` | 灰 | 几乎无彩色，靠明度区分 |

切换主题时库会自动调整这些参数，一般不需要手动覆盖 `lights`。

---

## 完整示例

```ts
const option: Vis3xOption = {
  // 光照：三点 + 阴影
  lights: [
    { type: 'ambient', intensity: 0.5 },
    {
      type: 'directional',
      position: [1, 1.6, 1],
      intensity: 1.7,
      shadow: true,
      shadowMapSize: 2048,
    },
    { type: 'directional', position: [-1.2, 0.9, 0.8], color: '#dbeafe', intensity: 0.6 },
    { type: 'directional', position: [-0.6, 0.5, -1.4], color: '#93c5fd', intensity: 0.45 },
  ],

  // 地面：网格 + 背景墙 + 承接面
  gridFloor: {
    show: true,
    color: '#33415c',
    divisions: 10,
    showWall: true,
    wallOpacity: 0.12,
    showShadowPlane: true,
    shadowPlaneOpacity: 0.5,
  },

  // 相机：可旋转，但在接近水平处停住
  controlSettings: {
    interactionMode: 'free',
    maxPolarAngle: Math.PI / 2.2,
    cameraDirection: { x: 1, y: 1.25, z: 1 },
    fitToScreenFactor: 0.85,
  },

  // 主题
  theme: themes.dark,
  backgroundColor: null,   // 透明，由父容器提供背景

  // 后处理关闭（大屏场景优先帧率）
  postprocessing: { enabled: false },
}
```

---

## 下一步

- [实例方法](./instance)
- [类型定义](./types)
