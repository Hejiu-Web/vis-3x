# 导出图片

vis-3x 内置 PNG 导出，无需额外依赖（不依赖 `html2canvas`，因为图表本身就是 canvas）。

---

## 基础用法

```ts
const dataUrl = chart.exportImage()

const a = document.createElement('a')
a.href = dataUrl
a.download = 'chart.png'
a.click()
```

---

## 参数

```ts
chart.exportImage({
  scale: 2,              // 分辨率倍数，默认 1
  mimeType: 'image/png', // 'image/png' | 'image/jpeg' | 'image/webp'
  quality: 0.92,         // 有损格式的质量（0~1），仅 jpeg/webp 有效
  backgroundColor: null, // 覆盖背景色；null 表示用当前主题背景
  includeLabels: true,   // 是否合成 HTML 标签层，默认 true
})
```

| 参数 | 类型 | 默认 | 说明 |
|---|---|---|---|
| `scale` | `number` | `1` | 输出尺寸倍数。`2` 即 2 倍图，适合高清屏或打印 |
| `mimeType` | `string` | `'image/png'` | 输出格式 |
| `quality` | `number` | `0.92` | 有损格式质量 |
| `backgroundColor` | `string \| null` | `null` | 背景色覆盖 |
| `includeLabels` | `boolean` | `true` | 是否把数据标签、标题、图例一起合成进去 |

---

## 高清导出

```ts
// 2 倍图：适合 Retina 屏展示
chart.exportImage({ scale: 2 })

// 4 倍图：适合打印或放进 PPT
chart.exportImage({ scale: 4 })
```

::: warning scale 会显著增加内存
`scale: 4` 时一张 1200×800 的图表会渲染成 4800×3200，
canvas 占用约 **61 MB** 内存（4800 × 3200 × 4 字节）。

大多数浏览器对单个 canvas 有 16384px 的边长上限，超出会静默失败（返回空白图）。
建议不超过 `scale: 3`。
:::

---

## 导出时包含标签

`includeLabels: true`（默认）会把 HTML 覆盖层（数据标签、标题、图例）合成到图片里：

```ts
// 带标签的完整图
chart.exportImage({ scale: 2, includeLabels: true })

// 只要 WebGL 画面（适合后期自己加标注）
chart.exportImage({ scale: 2, includeLabels: false })
```

::: tip 标签是怎么合成的
库会把 `engine.labelRenderer.domElement`（CSS2D 层）离屏重绘一次，
然后按顺序叠加到 WebGL canvas 上。

这条路径不依赖外部库，但要求标签使用的字体在导出时可渲染。
:::

---

## 导出为 JPEG（体积更小）

```ts
chart.exportImage({
  scale: 2,
  mimeType: 'image/jpeg',
  quality: 0.9,
  backgroundColor: '#0a0f1c',   // JPEG 不支持透明，必须给背景色
})
```

::: warning JPEG 没有透明通道
不指定 `backgroundColor` 时透明区域会变成黑色。
深色主题图表建议显式传当前主题的背景色。
:::

---

## Vue 组件用法

```vue
<script setup lang="ts">
import { ref } from 'vue'

const chartRef = ref()

function download(scale = 2) {
  const url = chartRef.value.exportImage({ scale })
  const a = document.createElement('a')
  a.href = url
  a.download = `chart-${scale}x.png`
  a.click()
}
</script>

<template>
  <div>
    <button @click="download(1)">普通</button>
    <button @click="download(3)">高清</button>
    <div style="height: 460px">
      <VisBar3D ref="chartRef" :option="option" />
    </div>
  </div>
</template>
```

---

## 导出前先停动画

动画进行中导出会拍到中间态。两种处理方式：

```ts
// 方式 1：等动画结束再导出
chart.on('chart:rendered', () => {
  // 渲染完成，此时动画已收敛
})

// 方式 2：配置里关闭动画，专门用于导出场景
const exportOption = {
  ...option,
  animation: { enabled: false },
}
chart.setOption(exportOption)
chart.exportImage({ scale: 2 })
```

---

## 常见问题

::: details 导出的图是空白的
按可能性排列：

1. **`scale` 太大超出 canvas 上限** — 降到 2 或 3 试试
2. **跨域纹理** — 如果用了外部图片作纹理，canvas 会被污染（tainted），
   此时 `toDataURL` 抛 `SecurityError`。把图片放到同源或配置 CORS。
3. **WebGL 上下文丢失** — 页面开了太多图表实例（浏览器通常限 8~16 个），
   先 `dispose` 掉不用的图表。
:::

::: details 导出的图没有标签
检查：

- `includeLabels` 是否为 `false`
- 是否引入了 `vis-3x/style.css`（没引样式时标签层定位异常，可能被合成到画布外）
:::

::: details 想要 SVG 或 PDF
库只导出位图。

需要矢量输出的话，可以在服务端用 Puppeteer 打开页面截图，
或者用 Three.js 的 `SVGRenderer` 自行替换渲染器（不在库的支持范围内）。
:::

---

## 下一步

- [性能优化](./performance)
- [实例方法 API](/api/instance)
