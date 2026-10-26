# 面积图 · area3D

`area3D` 在折线的基础上生成一块**有实际面片**的区域：上边界是数据曲线，下边界是 `baseValue`（默认 0），中间填充成一张网格，并可选在顶部保留一条描边管。它适合表现"累积量""占比""总量随时间的变化"这类关注**面积大小**而不是**点位精确值**的数据。和 `line3D` 最本质的区别就在这：`line3D` 渲染的是一根有半径的管，`area3D` 渲染的是一张面，并且面片带"上亮下暗"的顶点色渐变。

---

## 最简示例

<LiveChart
  type="area3D"
  :height="400"
  caption="单系列面积图。面片的上边界是数据曲线、下边界是基线 0，拖拽旋转可以看到面片的厚度与上下两条边界。"
  :option="{
    xAxis3D: { data: ['1月', '2月', '3月', '4月', '5月', '6月', '7月', '8月'], name: '月份' },
    yAxis3D: { name: '销量' },
    series: [
      {
        type: 'area3D',
        name: '销量',
        data: [120, 168, 141, 210, 195, 240, 218, 265],
      },
    ],
  }"
/>

::: code-group

```ts [TypeScript]
import type { Vis3xOption } from 'vis-3x'

const option: Vis3xOption = {
  xAxis3D: { data: ['1月', '2月', '3月', '4月', '5月', '6月', '7月', '8月'], name: '月份' },
  yAxis3D: { name: '销量' },
  series: [
    {
      type: 'area3D',
      name: '销量',
      data: [120, 168, 141, 210, 195, 240, 218, 265],
    },
  ],
}
```

```js [JavaScript]
// 纯 JavaScript：去掉类型标注即可
const option = {
  xAxis3D: { data: ['1月', '2月', '3月', '4月', '5月', '6月', '7月', '8月'], name: '月份' },
  yAxis3D: { name: '销量' },
  series: [
    {
      type: 'area3D',
      name: '销量',
      data: [120, 168, 141, 210, 195, 240, 218, 265],
    },
  ],
}
```

:::

```vue
<template>
  <div style="height: 460px">
    <VisArea3D :option="option" />
  </div>
</template>
```

`area3D` 的 `smooth` 同样默认是 `true`——上下两条边界都会经过样条平滑。

---

## 专属配置项

只列 `Area3DSeries` 独有的字段。

| 字段 | 类型 | 默认值 | 说明 |
|---|---|---|---|
| `areaStyle` | `AreaStyle` | — | 面片样式：`color` / `opacity` / `roughness` / `metalness` / `emissive` / `emissiveIntensity` / `gradient` / `gradientOpacity` / `side` |
| `baseValue` | `number` | `0` | 面积的下边界数值。设为非 0 可以做"带状区间"（上下浮动带） |
| `showLine` | `boolean` | `true` | 是否在顶部画描边管，**只有显式设 `false` 才会关掉** |
| `lineStyle` | `LineStyle` | — | 顶部描边样式，管半径 = `(lineStyle.width ?? 3) * 0.011` |
| `smooth` | `boolean` | `true` | 上下边界是否平滑 |

::: tip areaStyle.opacity 是唯一的"手感"旋钮
默认 `0.72`。这个值在深色背景下刚好能看清面片、又不至于遮住后排系列。

- **`0.9 ~ 1.0`**：接近不透明，适合单系列。多系列时后排会被完全挡住。
- **`0.6 ~ 0.75`（推荐区间）**：多系列叠加时能看出层叠关系。
- **`< 0.4`**：面片变得像雾，适合做背景层或"参考区间"。

注意面片材质固定带 `transparent: true` 和 `depthWrite: false`，所以**不需要**再手动设 `transparent`。半透明面片之间不做深度排序，`opacity` 高于 0.9 时斜视角下容易出现前后片穿插的观感。
:::

::: warning 顶部描边和面片是两套几何体
`showLine !== false` 时，每条面积系列会额外创建一个 `TubeGeometry`。它的管半径由 `lineStyle.width` 控制（系数 `0.011`）。如果同时给了 `areaStyle.color` 和 `lineStyle.color`，面片和描边可以用不同颜色——这是做出"亮边暗面"效果的常用手法。
:::

---

## 数据格式

`Area3DSeries['data']` 的类型是 `Array<number | SingleValueDataItem>`，和 `bar3D` / `line3D` 完全一致：

```ts
series: [
  {
    type: 'area3D',

    // 写法 1：纯数字数组
    data: [120, 168, 141, 210],

    // 写法 2：对象数组
    // data: [
    //   { value: 120, name: '1月' },
    //   { value: 168, name: '2月', itemStyle: { opacity: 0.4 } },
    // ],
  },
]
```

X 坐标同样由数组下标决定，需要和 `xAxis3D.data` 对齐。**至少需要 2 个数据点**——少于 2 个时该系列会被直接跳过，不渲染任何内容。

`stack` 也可以用在 `area3D` 上（继承自 `BaseSeries`），同名 stack 的系列会在 Y 方向上累加，做出堆叠面积图。

---

## 完整示例

堆叠面积 + 自定义下边界 + 分离面片与描边配色：

```ts
const option: Vis3xOption = {
  title: { show: true, text: '流量来源构成', subtext: '单位：万次' },
  xAxis3D: { data: ['1月', '2月', '3月', '4月', '5月', '6月'], name: '月份' },
  yAxis3D: { name: '访问量', min: 0 },
  zAxis3D: { name: '渠道' },
  legend: { show: true, position: 'bottom' },
  tooltip: { show: true, trigger: 'item' },
  series: [
    {
      type: 'area3D',
      name: '自然流量',
      stack: 'traffic',               // 同名 stack 在 Y 方向累加
      data: [320, 302, 341, 374, 390, 450],
      smooth: true,
      areaStyle: {
        color: '#4f8cff',
        opacity: 0.7,                 // 堆叠层用中等透明度
        roughness: 0.45,
        metalness: 0.15,
        emissive: '#4f8cff',
        emissiveIntensity: 0.1,       // 微弱自发光，让底层不至于发黑
        gradient: 'vertical',         // 沿高度渐变（默认）
      },
      lineStyle: { color: '#93c5fd', width: 4 },  // 描边比面片亮，勾出边界
    },
    {
      type: 'area3D',
      name: '付费流量',
      stack: 'traffic',
      data: [120, 132, 101, 134, 90, 120],
      areaStyle: { color: '#34d399', opacity: 0.7 },
      lineStyle: { color: '#6ee7b7', width: 4 },
    },
    {
      type: 'area3D',
      name: '波动区间（不堆叠）',
      data: [90, 60, 130, 110, 80, 150],
      baseValue: 40,                  // 下边界不是 0，而是一条带状参考区间
      smooth: false,                  // 区间边界要精确，关掉样条
      showLine: false,                // 纯色带，不要描边
      areaStyle: {
        color: '#fbbf24',
        opacity: 0.28,                // 参考区间用低透明度，不与主数据争视觉焦点
        gradient: 'none',             // 纯色，避免渐变与"区间"语义冲突
      },
    },
  ],
}
```

几个容易踩的点：

- **堆叠系列的 `baseValue` 会被忽略。** 堆叠时每条系列的下边界由前序累加结果决定，`baseValue` 只在非堆叠时起作用。
- **多系列自动沿 Z 轴错开**，定位是 `zAt((i + 0.5) / seriesCount)`。堆叠面积在深度方向会形成"层层后退"的层次感，这正是它比 2D 堆叠面积更好看的原因。
- **`showLine: false` 是真正的静默模式**，这时该系列只剩一张面片，顶边完全靠面片自身的边界，斜视角下边缘会有点"软"。要锐利的边界就保留描边。

---

## 使用建议

1. **`line3D` 还是 `area3D`？看你想强调什么。** 关心"某月的具体数值"用 `line3D`——管状线条精确落点、可加数据点。关心"总量规模、占比、累积效果"用 `area3D`——面片面积本身就是信息。两者默认都平滑，切换成本很低，但视觉语义完全不同。

2. **`areaStyle.opacity` 不要超过 0.85。** 面片材质固定 `depthWrite: false`，多次叠加时 GPU 不会做正确的深度排序。透明度越高，斜视角下前后片穿插的瑕疵越明显。

3. **数据点在 100 以内。** 平滑开启时上下边界各加密 12 倍点，生成的三角形数量是 `(点数 × 12 - 1) × 2`。100 个点就是约 2400 个三角形，单条还行，堆 5 条就会明显吃 GPU。

4. **带状区间用法要配 `gradient: 'none'`。** 默认的 `'vertical'` 渐变会让区间上下浓度不同，视觉上暗示"下面更重要"，而区间图的语义是上下边界等价。关掉渐变更符合直觉。
