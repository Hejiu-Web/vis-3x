# 主题与配色

vis-3x 提供 5 套预设主题，也支持完全自定义。颜色体系分两层：**调色板**（数据系列取色）与**语义色**（背景、文字、坐标轴）。

---

## 预设主题

```ts
import { themes } from 'vis-3x'

const option = {
  theme: themes.dark,   // 暗色科技风（默认）
  series: [{ type: 'bar3D', data: [1, 2, 3] }],
}
```

| 主题 | 基调 | 适用场景 |
|---|---|---|
| `dark` | 深蓝黑底 + 高饱和配色 | 大屏、数据看板（默认） |
| `light` | 白底 + 中性配色 | 文档、报表、打印 |
| `blue` | 深蓝商务 | 金融、企业后台 |
| `warm` | 暖色暗底 | 营销、活动页 |
| `mono` | 灰白极简 | 强调数据本身，弱化装饰 |

```ts
import { themes, getTheme } from 'vis-3x'

// 按名称取（适合从配置里读）
const theme = getTheme('blue')
```

---

## 自定义主题

```ts
const option = {
  theme: {
    // 数据系列调色板：按系列索引循环取色
    palette: ['#4f8cff', '#22d3ee', '#34d399', '#fbbf24'],

    // 语义色
    backgroundColor: '#0a0f1c',
    textColor: '#94a3b8',
    axisColor: '#475569',
    splitLineColor: '#1e293b',

    // 提示框
    tooltipBackgroundColor: 'rgba(15, 23, 42, 0.94)',
    tooltipTextColor: '#f1f5f9',
  },
}
```

### 基于预设做局部覆盖

```ts
import { extendTheme } from 'vis-3x'

const option = {
  theme: extendTheme('dark', {
    palette: ['#ff6b6b', '#4ecdc4', '#ffe66d'],
  }),
}
```

`extendTheme` 返回新对象，不会修改原主题。

---

## 调色板

调色板的取色规则是**按索引循环**：

```ts
series: [
  { type: 'bar3D', name: 'A', data: [...], color: ['#f00', '#0f0', '#00f'] },
  //                                            ↑ 数据项依次取这三个颜色
]
```

```ts
// 全局调色板：不同系列从不同位置开始取色
theme: { palette: ['#4f8cff', '#22d3ee', '#34d399'] }

series: [
  { type: 'bar3D', name: 'A', data: [1, 2, 3] },  // 蓝、青、绿
  { type: 'bar3D', name: 'B', data: [4, 5, 6] },  // 蓝、青、绿（同样从 0 开始）
]
```

::: tip 饼图例外
饼图、漏斗图这类「一个系列多色」的图表，颜色按**数据项索引**分配：
第一个扇区用 `palette[0]`，第二个用 `palette[1]`，以此类推。
:::

---

## 组件级快捷设置

Vue 组件提供 `palette` prop，省去写嵌套结构：

```vue
<!-- 等价于 option.theme.palette -->
<VisBar3D :option="option" :palette="['#ff6b6b', '#4ecdc4', '#ffe66d']" />
```

---

## CSS 变量覆盖

HTML 覆盖层（标签、提示框、图例、标题）支持用 CSS 变量定制，不需要改 JS 配置：

```css
.vt-container {
  --vt-font-family: 'Inter', 'PingFang SC', sans-serif;
  --vt-tooltip-bg: rgba(15, 23, 42, 0.94);
  --vt-tooltip-color: #f1f5f9;
  --vt-tooltip-border: rgba(148, 163, 184, 0.22);
  --vt-title-color: #e2e8f0;
  --vt-subtitle-color: #94a3b8;
  --vt-loading-bg: rgba(8, 13, 24, 0.55);
  --vt-loading-accent: #4f8cff;
  --vt-empty-color: #64748b;
}
```

可用变量完整列表见 `vis-3x/dist/style.css`。

---

## 配色建议

::: tip 3D 图表的配色与 2D 不同

**深色背景更容易出效果。** 3D 依赖光影塑造体积感，浅色背景下高光与阴影对比不明显，立体感会弱很多。这也是默认主题是深色的原因。

**调色板不宜过多。** 3D 图表里每个颜色还会被光照调制出多个明度层次，颜色太多会显得杂乱。6~8 个足够。

**避免高饱和纯色。** `#ff0000` 这类纯色在 PBR 材质下容易过曝。用略微降饱和的版本：`#fb7185` 而不是 `#ff0000`。

**同色系渐变适合表达「程度」。** 热力图、曲面图用同色系（如深蓝→青→黄→红）比彩虹色更容易读懂数值高低。
:::

### 库的默认调色板

```ts
import { DEFAULT_PALETTE } from 'vis-3x'
// ['#4f8cff', '#22d3ee', '#34d399', '#fbbf24', '#fb7185', '#a78bfa',
//  '#f97316', '#2dd4bf', '#f472b6', '#60a5fa', '#84cc16', '#e879f9']
```

这是一组在深色背景上有良好对比度、且相邻色相差异足够大的颜色。

### 连续色带

曲面图、热力图默认使用：

```ts
import { DEFAULT_GRADIENT } from 'vis-3x'
// ['#1e3a8a', '#0ea5e9', '#22d3ee', '#34d399', '#fde047', '#fb923c', '#ef4444']
```

从深蓝（低值）到红（高值），符合多数人对「冷→热」的直觉。

```ts
series: [{
  type: 'heatmap3D',
  colorGradient: ['#0f2a5e', '#0ea5e9', '#22d3ee', '#34d399', '#fde047', '#f97316'],
  data: [...],
}]
```

---

## 光照对颜色的影响

材质的 `roughness`（粗糙度）与 `metalness`（金属度）会明显改变同一颜色的观感：

```ts
itemStyle: {
  color: '#4f8cff',
  roughness: 0.1,    // 光滑 → 高光集中，像塑料/玻璃
  metalness: 0.9,    // 金属 → 反射环境，颜色偏暗但更有质感
}

itemStyle: {
  color: '#4f8cff',
  roughness: 0.9,    // 粗糙 → 漫反射为主，颜色均匀
  metalness: 0.0,
}
```

::: tip 数据图表推荐的材质参数
- 柱状图：`roughness: 0.32, metalness: 0.25` — 有体积感但不喧宾夺主
- 曲面图：`roughness: 0.36, metalness: 0.18` — 让顶点色主导
- 散点图：`roughness: 0.24, metalness: 0.3` + 适度 `emissive` — 点更醒目

除非要做「产品展示」风格的图表，否则不建议把 `metalness` 调超过 0.5——金属反射会让颜色严重偏离调色板。
:::

---

## 下一步

- [动画与过渡](./animation)
- [光照与环境 API](/api/environment)
