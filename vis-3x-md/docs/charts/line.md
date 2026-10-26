# 折线图 · line3D

`line3D` 用来表现**沿类目的连续趋势**。每个类目一个数据点，点之间连成一条有粗细的管线（`TubeGeometry`），可以沿 Catmull-Rom 样条平滑。它适合时间序列、指标走势这类"顺序有意义"的数据；类目之间没有顺序关系时应该用 `bar3D`。多系列时折线会自动沿 Z 轴分层排开，再叠加 `curtain` 垂幕就能把每条线"钉"在地面上，解决 3D 折线最容易出现的"浮在空中不知道对应哪个深度"的问题。

---

## 最简示例

<LiveChart
  type="line3D"
  :height="400"
  caption="12 个月的访问量趋势。smooth 让折线走成样条曲线，curtain 从曲线向下拉出垂幕，把它钉在地面上。"
  :option="{
    xAxis3D: {
      data: ['1月', '2月', '3月', '4月', '5月', '6月', '7月', '8月', '9月', '10月', '11月', '12月'],
      name: '月份',
    },
    yAxis3D: { name: '访问量' },
    series: [
      {
        type: 'line3D',
        name: 'PV',
        smooth: true,
        curtain: true,
        data: [820, 932, 901, 1290, 1330, 1450, 1320, 1180, 1560, 1720, 1680, 1930],
      },
    ],
  }"
/>

::: code-group

```ts [TypeScript]
import type { Vis3xOption } from 'vis-3x'

const option: Vis3xOption = {
  xAxis3D: {
    data: ['1月', '2月', '3月', '4月', '5月', '6月', '7月', '8月', '9月', '10月', '11月', '12月'],
    name: '月份',
  },
  yAxis3D: { name: '访问量' },
  series: [
    {
      type: 'line3D',
      name: 'PV',
      smooth: true,
      curtain: true,
      data: [820, 932, 901, 1290, 1330, 1450, 1320, 1180, 1560, 1720, 1680, 1930],
    },
  ],
}
```

```js [JavaScript]
// 纯 JavaScript：去掉类型标注即可
const option = {
  xAxis3D: {
    data: ['1月', '2月', '3月', '4月', '5月', '6月', '7月', '8月', '9月', '10月', '11月', '12月'],
    name: '月份',
  },
  yAxis3D: { name: '访问量' },
  series: [
    {
      type: 'line3D',
      name: 'PV',
      smooth: true,
      curtain: true,
      data: [820, 932, 901, 1290, 1330, 1450, 1320, 1180, 1560, 1720, 1680, 1930],
    },
  ],
}
```

:::

```vue
<template>
  <div style="height: 460px">
    <VisLine3D :option="option" />
  </div>
</template>
```

注意 `smooth` 的默认值就是 `true`——上面这条线已经是平滑曲线。要折线原样连接，必须显式写 `smooth: false`。

---

## 专属配置项

只列 `Line3DSeries` 独有的字段。

| 字段 | 类型 | 默认值 | 说明 |
|---|---|---|---|
| `smooth` | `boolean` | `true` | 是否用 Catmull-Rom 样条平滑。**默认开启**，想要硬折线需显式设 `false` |
| `smoothTension` | `number` | `0.5` | 平滑张力，`0~1`。越小越贴近原折线，越大越饱满 |
| `lineStyle` | `LineStyle` | — | 线条样式：`color` / `width` / `opacity` / `dash` / `emissive` / `emissiveIntensity` |
| `showSymbol` | `boolean` | `false` | 是否在原始数据点位置画标记球 |
| `symbolSize` | `number` | `0.12` | 数据点大小（`pointStyle.size` 优先） |
| `pointStyle` | `PointStyle` | — | 数据点样式：`color` / `size` / `opacity` / `roughness` / `metalness` / `emissive` |
| `curtain` | `boolean` | `false` | 是否从折线向下生成垂直"幕布"投影到地面 |
| `curtainStyle` | `AreaStyle` | — | 幕布样式：`color` / `opacity`（默认 `0.22`）/ `roughness` / `metalness` / `emissive` / `gradient` |
| `z` | `number` | 多系列自动错开 | 该折线所在的世界 Z 坐标，单系列时用来把线从中心挪开 |

### lineStyle.width 的单位

`width` 是**像素级的相对值，不是世界单位**。实现里管线的半径是 `(lineStyle.width ?? 3) * 0.012`。

| `width` | 实际管半径（世界单位） |
|---|---|
| `1` | 0.012（几乎看不见，别用） |
| `3`（默认） | 0.036 |
| `5` | 0.060 |
| `8` | 0.096（粗壮，适合单条线做视觉主体） |

::: warning 平滑是"额外生成"的点，不是原始数据点插值
`smooth: true` 时，折线会先经过 `catmullRomSpline(points, 14, ...)` 加密到约 14 倍点数，再用这些点重建曲线。
这意味着**样条可能过冲出数据的真实极值**——比如 `[0, 10, 0]` 平滑后峰值可能超过 10。做财务、精度敏感的数据展示时用 `smooth: false`。
:::

---

## 数据格式

`Line3DSeries['data']` 的类型是 `Array<number | SingleValueDataItem>`：

```ts
series: [
  {
    type: 'line3D',

    // 写法 1：纯数字数组
    data: [820, 932, 901, 1290],

    // 写法 2：对象数组，name 会进入 tooltip 与标签
    // data: [
    //   { value: 820, name: '1月' },
    //   { value: 932, name: '2月', itemStyle: { color: '#f43f5e' } },
    // ],
  },
]
```

X 坐标由**数组下标**决定（`xAtCategory(dataIndex)`），与 `xAxis3D.data` 的类目顺序一一对应。所以 `data` 长度和类目数不一致时，多出的点会落在类目范围之外，缺的点不会补——**保持两者长度一致**。

`line3D` 的 Z 由系列级 `z` 决定，数据项里的第三个数字**不会**被当作 Z 坐标读取（那需要 `scatter3D`）。

---

## 完整示例

两条折线 + 垂幕 + 数据点 + 虚线与辉光：

```ts
const option: Vis3xOption = {
  title: { show: true, text: '双端访问趋势', subtext: '单位：万次' },
  xAxis3D: { data: ['1月', '2月', '3月', '4月', '5月', '6月'], name: '月份' },
  yAxis3D: { name: '访问量', min: 0 },
  zAxis3D: { name: '端' },            // 两条线沿 Z 轴分层
  legend: { show: true, position: 'bottom' },
  tooltip: { show: true, trigger: 'item' },
  series: [
    {
      type: 'line3D',
      name: '移动端',
      data: [820, 932, 901, 1290, 1330, 1450],
      smooth: true,
      smoothTension: 0.35,            // 张力调小，减少过冲
      curtain: true,                  // 垂幕：把线"钉"回地面，标明它所在的深度
      curtainStyle: { color: '#4f8cff', opacity: 0.22, gradient: 'vertical', emissive: '#4f8cff' },
      lineStyle: {
        color: '#4f8cff',
        width: 5,
        emissive: '#4f8cff',          // 自发光让线条在暗背景下"亮"起来
        emissiveIntensity: 0.3,
      },
      showSymbol: true,               // 显示原始数据点
      pointStyle: {
        color: '#ffffff',             // 数据点用白色，与线形成对比
        size: 0.13, roughness: 0.15, metalness: 0.5,
      },
    },
    {
      type: 'line3D',
      name: '桌面端（基线）',
      data: [420, 402, 431, 480, 465, 510],
      smooth: false,                  // 这条刻意不平滑，做对照
      curtain: false,                 // 只在需要定位的线上开垂幕
      lineStyle: {
        color: '#34d399',
        width: 3,
        dash: [6, 4],                 // 虚线：[实线长度, 间隔]
        opacity: 0.85,                // 透明度 < 1 时库自动开启 transparent
      },
    },
  ],
}
```

关键点说明：

- **`curtain` 只给需要强调深度的系列开**。每条垂幕都是一块独立的半透明网格（`depthWrite: false`），全开会让画面糊成一团。
- **垂幕的透明度上限**：`curtainStyle.opacity` 超过 `0.4` 后排的折线就基本看不见了。默认 `0.22` 是经过权衡的值。
- **数据点的 `dataIndex` 是原始下标**：开启 `showSymbol` 后射线检测命中的是原始点，不受平滑加密影响，tooltip 取值正确。

---

## 使用建议

1. **单系列时关掉 `curtain`。** 只有一条线时它本来就在网格中心，垂幕除了制造视觉噪声没有定位价值。垂幕真正的用武之地是 3~5 条线并排、深度难以分辨的时候。

2. **`showSymbol` 打开后数据点数量要控制。** 每个点是独立的 `SphereGeometry` 网格。200 个点就有 200 个额外对象；点数超过 60 时建议关掉，只靠线条表达趋势。

3. **数据量上限约单系列 200 点。** 折线用 `TubeGeometry` 构建，几何细分是 `max(24, renderPoints.length * 2)` 段；`smooth: true` 时 `renderPoints` 又是原始点数的 14 倍。一个 200 点的平滑折线会产生上千段管体，是折线图最主要的性能开销来源。

4. **想要"面积感"而不是细线，换 `area3D`。** `line3D` 无论怎么调 `lineStyle.width` 都只是一根管；需要填充到基线的实心面片得用 `area3D`。反过来，`area3D` 做不出 `line3D` 那种细而亮的高光线。
