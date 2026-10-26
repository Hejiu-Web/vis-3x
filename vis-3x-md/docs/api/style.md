# 样式 Style

vis-3x 的样式类型分为三组：**线**（`LineStyle`）、**文字**（`TextStyle`）、**图形材质**（`ItemStyle`）。

材质部分暴露的是 Three.js 的 PBR 参数，而不是 2D 图表那种边框/阴影。理解这一点是调出好效果的关键。

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

## ColorLike

所有颜色字段都接受两种写法：

```ts
color: '#4f8cff'          // CSS 颜色字符串
color: 0x4f8cff           // 16 进制数字
color: 'rgba(79,140,255,0.5)'   // 带透明度
```

---

## ItemStyle — 图形材质

最重要的一组。用于 `series[].itemStyle` 和 `data[].itemStyle`。

```ts
itemStyle: {
  color: '#4f8cff',
  opacity: 0.9,
  transparent: true,
  roughness: 0.32,
  metalness: 0.25,
  emissive: '#4f8cff',
  emissiveIntensity: 0.15,
  envMapIntensity: 1.2,
  preset: 'standard',
  side: 'double',
  castShadow: true,
  receiveShadow: true,
}
```

### 基础外观

| 字段 | 类型 | 默认 | 说明 |
|---|---|---|---|
| `color` | `ColorLike` | 调色板值 | 基础颜色，覆盖调色板 |
| `opacity` | `number` | `1` | 透明度 |
| `transparent` | `boolean` | 自动 | 是否启用透明通道 |
| `preset` | `MaterialPreset` | `'standard'` | 材质预设 |
| `side` | `'front' \| 'back' \| 'double'` | `'front'` | 渲染哪些面 |

### PBR 参数

| 字段 | 类型 | 默认 | 说明 |
|---|---|---|---|
| `roughness` | `number` | `0.3` | 粗糙度 0~1，越小越光滑、高光越集中 |
| `metalness` | `number` | `0.3` | 金属度 0~1，越大越像金属 |
| `emissive` | `ColorLike` | — | 自发光颜色 |
| `emissiveIntensity` | `number` | `0` | 自发光强度 |
| `envMapIntensity` | `number` | `1` | 环境贴图强度 |

::: tip roughness / metalness 怎么调

这两个参数决定同一颜色的观感：

```ts
// 光滑塑料感（高光集中）
{ roughness: 0.1, metalness: 0.1 }

// 哑光颜料（颜色均匀，最接近 2D 图表的观感）
{ roughness: 0.9, metalness: 0.0 }

// 金属（颜色偏暗，反射环境）
{ roughness: 0.3, metalness: 0.9 }
```

**数据图表的推荐范围**：`roughness: 0.3~0.5`、`metalness: 0.15~0.35`。
在这个区间里颜色基本保持调色板的观感，同时有足够的体积感。

`metalness` 超过 0.5 后颜色会明显偏离调色板——因为金属材质的固有色本来就会被反射覆盖。
:::

### 高级材质（需 `preset: 'physical'`）

| 字段 | 类型 | 说明 |
|---|---|---|
| `clearcoat` | `number` | 清漆层强度 0~1 |
| `clearcoatRoughness` | `number` | 清漆层粗糙度 |
| `transmission` | `number` | 透射（玻璃感）0~1 |
| `ior` | `number` | 折射率，玻璃约 1.5 |
| `thickness` | `number` | 厚度，影响折射偏移 |

```ts
// 玻璃质感的气泡
itemStyle: {
  preset: 'physical',
  color: '#4f8cff',
  roughness: 0.12,
  metalness: 0.1,
  transmission: 0.35,
  thickness: 0.4,
  ior: 1.4,
  opacity: 0.88,
  transparent: true,
}
```

::: warning physical 预设开销明显更高
`MeshPhysicalMaterial` 的着色器比 `MeshStandardMaterial` 复杂得多。
数据量大时（几百个元素）会明显掉帧。

只在少量元素上使用（气泡图的几十个点可以，柱状图的几百根不行）。
:::

### 渲染控制

| 字段 | 类型 | 默认 | 说明 |
|---|---|---|---|
| `wireframe` | `boolean` | `false` | 线框渲染 |
| `flatShading` | `boolean` | `false` | 平面着色（低多边形风格） |
| `depthTest` | `boolean` | `true` | 深度测试 |
| `depthWrite` | `boolean` | `true` | 深度写入 |
| `castShadow` | `boolean` | `true` | 是否投射阴影 |
| `receiveShadow` | `boolean` | `true` | 是否接收阴影 |

::: details flatShading 的效果
开启后每个三角面用同一个法线，呈现棱角分明的低多边形风格：

```ts
itemStyle: { flatShading: true, roughness: 0.6 }
```

适合装饰性图表。数值图表里会让曲面显得破碎，不建议开。
:::

### 贴图

| 字段 | 类型 | 说明 |
|---|---|---|
| `map` | `string` | 颜色贴图 URL |
| `textureRepeat` | `[number, number]` | 重复次数 |
| `textureRotation` | `number` | 旋转角度（弧度） |

```ts
itemStyle: {
  color: '#ffffff',
  map: '/textures/grid.png',
  textureRepeat: [2, 2],
}
```

::: warning 跨域图片会导致导出失败
用外部域名的图片作贴图时，canvas 会被「污染」，
`exportImage()` 会抛 `SecurityError`。

把图片放到同源下，或确保服务器返回正确的 CORS 头。
:::

---

## MaterialPreset

| preset | 对应材质 | 特点 | 适用 |
|---|---|---|---|
| `'standard'` | `MeshStandardMaterial` | 物理正确，性能与效果平衡 | **默认**，绝大多数场景 |
| `'physical'` | `MeshPhysicalMaterial` | 支持清漆/透射/折射 | 玻璃、气泡、高质感单元素 |
| `'lambert'` | `MeshLambertMaterial` | 只有漫反射，性能最好 | 大量元素、低端设备 |
| `'basic'` | `MeshBasicMaterial` | 不受光照影响 | 纯色标记、参考线 |
| `'toon'` | `MeshToonMaterial` | 卡通分层明暗 | 趣味化展示 |

```ts
// 性能优先：几百根柱子
itemStyle: { preset: 'lambert', roughness: 0.8 }

// 纯色不参与光照：辅助标记
itemStyle: { preset: 'basic', color: '#fbbf24' }
```

---

## LineStyle — 线样式

用于折线、坐标轴、刻度、网格线。

```ts
lineStyle: {
  color: '#4f8cff',
  width: 3,
  opacity: 0.9,
  dash: [6, 4],
  emissive: '#4f8cff',
  emissiveIntensity: 0.4,
}
```

| 字段 | 类型 | 默认 | 说明 |
|---|---|---|---|
| `color` | `ColorLike` | 主题值 | 线色 |
| `width` | `number` | `1` | 线宽（像素） |
| `opacity` | `number` | `1` | 透明度 |
| `dash` | `[number, number]` | — | 虚线间隔，不传为实线 |
| `emissive` | `ColorLike` | — | 自发光颜色 |
| `emissiveIntensity` | `number` | `0` | 自发光强度 |

::: warning WebGL 的线宽限制
原生 WebGL 的 `lineWidth` 在多数平台上**只有 1 像素有效**。

vis-3x 在 `width > 1` 时会自动切换到「管状体」方案（用细圆柱模拟粗线）。
这会增加几何体数量，所以折线数据点很多时（> 200）建议保持 `width: 1~2`。
:::

### 虚线与自发光

```ts
// 目标参考线
lineStyle: { color: '#fb7185', width: 2, dash: [8, 6], opacity: 0.7 }

// 霓虹感折线
lineStyle: { color: '#22d3ee', width: 4, emissive: '#22d3ee', emissiveIntensity: 0.8 }
```

---

## TextStyle — 文字样式

用于标签、轴文字、标题、提示框。这些文字是 **HTML 元素**（CSS2D 层），不是画在 canvas 上的，所以支持完整的 CSS 能力。

```ts
textStyle: {
  color: '#e2e8f0',
  fontSize: 12,
  fontFamily: 'Inter, "PingFang SC", sans-serif',
  fontWeight: 600,
  textShadow: '0 1px 3px rgba(0,0,0,0.6)',
  backgroundColor: 'rgba(15,23,42,0.9)',
  padding: 4,
  borderRadius: 4,
  borderColor: 'rgba(148,163,184,0.3)',
  borderWidth: 1,
  lineHeight: 1.4,
}
```

| 字段 | 类型 | 默认 | 说明 |
|---|---|---|---|
| `color` | `ColorLike` | 主题值 | 文字颜色 |
| `fontSize` | `number` | 主题值 | 字号（**像素**） |
| `fontFamily` | `string` | 继承 | 字体族 |
| `fontWeight` | `string \| number` | `400` | 字重 |
| `textShadow` | `string` | — | CSS 阴影语法 |
| `backgroundColor` | `ColorLike` | — | 背景色 |
| `padding` | `number` | `0` | 内边距（像素） |
| `borderRadius` | `number` | `0` | 圆角（像素） |
| `borderColor` | `ColorLike` | — | 边框色 |
| `borderWidth` | `number` | `0` | 边框宽（像素） |
| `lineHeight` | `number` | `1.2` | 行高倍数 |

::: tip fontSize 是像素，不是世界单位
这是与 3D 几何体尺寸的重要区别：

- `axisTick.length`（刻度长度）是**世界单位**，会随缩放变化
- `textStyle.fontSize` 是**像素**，无论相机怎么缩放屏幕上都是这个大小

标签永远面向相机、大小恒定——这让文字始终可读。
:::

### 标签背景

数值标签叠在深色场景上容易看不清，加个半透明底：

```ts
label: {
  show: true,
  textStyle: {
    color: '#f1f5f9',
    fontSize: 11,
    backgroundColor: 'rgba(15,23,42,0.82)',
    padding: 3,
    borderRadius: 4,
  },
}
```

### 多行文字

字符串里的 `\n` 或真实换行都会渲染成换行：

```ts
label: {
  formatter: '{name}\n{value} 万',
  textStyle: { lineHeight: 1.35 },
}
```

---

## AreaStyle — 面样式

用于面积图、曲面图的填充面。

```ts
areaStyle: {
  color: '#4f8cff',
  opacity: 0.75,
  roughness: 0.36,
  metalness: 0.18,
  emissive: '#4f8cff',
  emissiveIntensity: 0.1,
  gradient: 'vertical',
}
```

| 字段 | 类型 | 默认 | 说明 |
|---|---|---|---|
| `color` | `ColorLike` | 系列色 | 面颜色 |
| `opacity` | `number` | `0.8` | 透明度 |
| `roughness` | `number` | — | 粗糙度 |
| `metalness` | `number` | — | 金属度 |
| `emissive` | `ColorLike` | — | 自发光 |
| `emissiveIntensity` | `number` | — | 自发光强度 |
| `gradient` | `'vertical' \| 'none'` | `'none'` | 渐变方向 |

::: tip 面积图建议半透明
`opacity: 0.7~0.85` 能让下方的网格线透出来，
空间关系更清楚。完全不透明会让面积图看起来像一块实心板。
:::

---

## 样式优先级

同一个属性可以从三个层级设置，**就近覆盖**：

```ts
{
  // ① 全局（最低优先级）
  label: { show: true, precision: 1 },

  series: [{
    // ② 系列级
    label: { precision: 2 },

    data: [
      120,
      // ③ 数据项级（最高优先级）
      { value: 200, itemStyle: { color: '#f00' } },
    ],
  }],
}
```

**数据项级 > 系列级 > 全局**

---

## 完整示例

```ts
const option: Vis3xOption = {
  series: [
    {
      type: 'bar3D',
      name: '销售额',
      data: [120, 200, 150, 80],

      // 系列级材质
      itemStyle: {
        preset: 'standard',
        roughness: 0.3,
        metalness: 0.28,
        emissive: '#4f8cff',
        emissiveIntensity: 0.1,
      },

      // 标签
      label: {
        show: true,
        precision: 0,
        formatter: '{value} 万',
        textStyle: {
          color: '#f1f5f9',
          fontSize: 11,
          fontWeight: 600,
          backgroundColor: 'rgba(15,23,42,0.82)',
          padding: 3,
          borderRadius: 4,
        },
      },
    },
  ],

  // 坐标轴用线样式
  xAxis3D: {
    data: ['Q1', 'Q2', 'Q3', 'Q4'],
    axisLine: { lineStyle: { color: '#475569', width: 1 } },
    axisLabel: { textStyle: { color: '#94a3b8', fontSize: 11 } },
    splitLine: { show: false },
  },
  yAxis3D: {
    axisLine: { lineStyle: { color: '#475569' } },
    axisLabel: { textStyle: { color: '#94a3b8', fontSize: 11 } },
    splitLine: { lineStyle: { color: '#1e293b', opacity: 0.6 } },
  },
}
```

---

## 下一步

- [光照与环境](./environment)
- [实例方法](./instance)
