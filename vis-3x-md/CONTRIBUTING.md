# 文档站开发

本目录是 vis-3x 的官方文档站与门户首页。这一页说明如何维护它。

---

## 结构

```
vis-3x-md/
├── docs/                      VitePress 文档站
│   ├── .vitepress/
│   │   ├── config.mts         导航、侧边栏、搜索、构建配置
│   │   ├── theme/
│   │   │   ├── index.ts       主题入口（注册 LiveChart、扩展图表）
│   │   │   ├── LiveChart.vue  ★ 文档内嵌的实时图表组件
│   │   │   └── custom.css     视觉定制
│   │   └── site-config.ts     链接与版本（发布前改这里）
│   ├── guide/                 指南
│   ├── charts/                图表手册（每个页面都带实时示例）
│   ├── custom/                自定义图表
│   ├── api/                   API 参考
│   ├── index.md               文档站首页
│   ├── changelog.md
│   └── license.md
├── home/                      门户首页（Vite + Vue）
├── scripts/
│   ├── resolve-vis3x.mjs      解析 vis-3x 来源（两个站点共用）
│   └── assemble.mjs           组装发布目录
└── vite.home.config.ts
```

---

## 在文档里嵌入实时图表

文档站注册了一个全局组件 `LiveChart`。**任何 Markdown 页面**都可以直接用它渲染真实图表：

````md
<LiveChart
  type="bar3D"
  :height="420"
  caption="一句说明，显示在图表下方。"
  :option="{
    xAxis3D: { data: ['Q1', 'Q2', 'Q3', 'Q4'], name: '季度' },
    yAxis3D: { name: '销售额' },
    series: [
      { type: 'bar3D', name: '2025', data: [120, 200, 150, 80] },
    ],
  }"
/>
````

### 参数

| 参数 | 类型 | 默认 | 说明 |
|---|---|---|---|
| `type` | `string` | — | 图表类型。省略时按 `option.series[0].type` 推断 |
| `option` | `Vis3xOption` | 必填 | 图表配置 |
| `height` | `number \| string` | `420` | 容器高度 |
| `theme` | `ThemeName` | `'dark'` | 主题 |
| `interaction` | `'free' \| 'rotate' \| 'fixed'` | `'free'` | 视角交互模式 |
| `caption` | `string` | — | 图表下方的说明文字 |
| `plain` | `boolean` | `false` | 隐藏「重置视角 / 适应窗口 / 导出」工具条 |

### 内置行为

- **进入视口才创建实例**——长文档里不会一次性创建几十个 WebGL 上下文
- **组件卸载时自动 `dispose()`**——不会泄漏显存
- **自带工具条**——悬停时出现「重置视角 / 适应窗口 / 导出 PNG」
- **`option` 变化会自动更新图表**

---

## 写示例的硬性规则

::: warning `:option` 必须是纯字面量
Vue 模板里 `:option="{...}"` 是**表达式**，不是代码块。它只能包含纯 JSON 字面量：

- ✅ 数字、字符串、数组、对象、布尔值
- ❌ 注释（`//` 会被当成语法错误）
- ❌ 函数（`formatter: (v) => ...`）
- ❌ 变量引用（`data: myData`）
- ❌ 模板字符串中的复杂表达式

需要函数时（比如 `formatter`），在下面的代码块里展示，组件里省略该字段。
:::

::: tip 组件里的数据要和代码块完全一致
读者会对照着看。两处数字不同会让人困惑。

`charts/` 下的页面都遵循这个约定：`<LiveChart>` 的 `option` 与紧随其后的
` ```ts ` 代码块内容逐字对齐（只差 `import` 与 `const option =` 外壳）。
:::

---

## TypeScript / JavaScript 双写法

库用 TypeScript 写，但**完全支持纯 JavaScript**。文档里凡是「配置」「用法」类的
主示例，都要用 `::: code-group` 同时给出两种写法。

### 格式

````md
::: code-group

```ts [TypeScript]
import type { Vis3xOption } from 'vis-3x'

const option: Vis3xOption = {
  xAxis3D: { data: ['A', 'B'] },
  series: [{ type: 'bar3D', data: [1, 2] }],
}
```

```js [JavaScript]
// 纯 JavaScript：去掉类型标注即可
const option = {
  xAxis3D: { data: ['A', 'B'] },
  series: [{ type: 'bar3D', data: [1, 2] }],
}
```

:::
````

### 转换规则

| TypeScript | JavaScript |
|---|---|
| `import type { X } from 'y'` | 删掉整行 |
| `import { a, type B } from 'y'` | `import { a } from 'y'` |
| `const x: Foo = ...` | `const x = ...` |
| `ref<HTMLDivElement>()` | `ref()` |
| `render(ctx: ChartRenderContext)` | `render(ctx)` |
| `x as SomeType` | `x` |
| `getElementById('el')!` | `getElementById('el')` |
| `<script setup lang="ts">` | `<script setup>` |
| `protected foo()` | `foo()` |

::: danger `import * as THREE` 不是类型断言
转换时**不要**把 `as` 一律删掉：

```js
import * as THREE from 'three'   // ✅ 正确
import * from 'three'            // ❌ 语法错误
```

`as` 只有出现在**表达式里**才是类型断言（`foo as Bar`）。
处理时逐行跳过以 `import` 开头的行。
:::

### 哪些地方需要双写法

| 位置 | 是否必须 | 说明 |
|---|---|---|
| `charts/*.md` 的「最简示例」 | ✅ 必须 | 读者第一眼看到的地方 |
| `guide/quick-start` `usage-modes` `introduction` | ✅ 必须 | 入门必读 |
| `custom/*.md` 的主要示例 | ✅ 必须 | 扩展 API 的核心用法 |
| `api/*.md` | ❌ 不必 | 字段参考，页首有 JS 阅读提示即可 |
| 两三行的字段说明片段 | ❌ 不必 | 翻倍没有收益 |

### 校验

改完代码块后必须跑这两项：

```bash
# 1. 所有 ```js 块的语法是否合法（用 esbuild 解析）
node scripts/check-js-blocks.mjs

# 2. 构建
npm run build
```

`check-js-blocks.mjs` 会抓出转换脚本可能引入的语法错误——
比如漏删的 `!`、残留的 `: Type` 标注、被误删的 `as`。

### 各图表类型的注意事项

| 类型 | 要点 |
|---|---|
| `bar3D` `line3D` `area3D` | 需要 `xAxis3D.data` 作为类目轴 |
| `scatter3D` | 数据是 `[[x, y, z], ...]`，轴要设 `type: 'value'` 与 `min`/`max` |
| `surface3D` | 数据是**二维矩阵**，必须矩形，不能有 `NaN` |
| `heatmap3D` | 数据是 `[[x索引, z索引, 值], ...]`，需 `xAxis3D.data` + `zAxis3D.data` |
| `pie3D` `funnel3D` `gauge3D` `radar3D` | **非笛卡尔，必须加 `showCoordinate: false`** |
| `lollipop3D` `bubble3D` `pyramid3D` `ringProgress3D` `stepTerrain3D` | 扩展示例图表，已在主题里注册 |
| `barLine3D` | **必须显式写 `type="barLine3D"`**，否则会按 `series[0]` 推断成 `bar3D` 而丢掉折线 |

---

## 扩展示例图表的注册

`lollipop3D` / `bubble3D` / `barLine3D` / `pyramid3D` / `ringProgress3D` / `stepTerrain3D`
**默认不注册**。主题入口已经统一注册了：

```ts
// docs/.vitepress/theme/index.ts
import { useExtraCharts } from 'vis-3x/presets'

useExtraCharts()   // 注册全部 6 个

export default {
  extends: DefaultTheme,
  enhanceApp({ app }) {
    app.component('LiveChart', LiveChart)
  },
}
```

新增扩展图表时，记得确认它是否在这个列表里——否则 `<LiveChart>` 会抛
`[vis-3x] 未知的图表类型`。

---

## vis-3x 从哪来

文档站与门户首页共用 `scripts/resolve-vis3x.mjs`，按顺序解析：

1. 环境变量 `VIS3X_SRC` / `VIS3X_PKG`
2. 相邻的 monorepo 源码 `../vis-3x/packages/vis-3x/src`（开发时用）
3. `node_modules/vis-3x`（部署时用）

```bash
# 查看当前用的是哪个
node -e "import('./scripts/resolve-vis3x.mjs').then(m => console.log(m.describeVis3x()))"
```

`vis3xAlias()` 同时处理主入口、样式与 **8 个子路径**（`vis-3x/core`、`vis-3x/presets` 等），
文档站里 `import { useExtraCharts } from 'vis-3x/presets'` 才能解析。

---

## 本地开发

```bash
npm install

npm run dev          # 文档站      http://localhost:5173
npm run home:dev     # 门户首页    http://localhost:5180
```

改 `LiveChart.vue` 或主题文件会触发热更新，无需重启。

---

## 验证

改完文档后跑一遍：

```bash
# 构建（能发现 :option 里的语法错误）
npm run build

# 全量验证：22 个实时图表是否都画出了像素
cd ../vis-3x
node scripts/verify-all-livecharts.mjs
```

验证脚本会逐页滚动触发懒加载，然后对每个 canvas 采样像素，
确认不是空白。输出形如：

```
  /charts/surface              1       1   ✓
  /charts/extra                4       4   ✓

  图表总数: 22
  成功渲染: 22
  页面异常: 0
```

---

## 新增一个图表页

1. 在 `docs/charts/` 建 `<type>.md`
2. 按[现有页面](https://github.com/Hejiu-Web/vis-3x)的结构写：场景说明 → 最简示例 → 专属配置项 → 数据格式 → 完整示例 → 使用建议
3. 在 `docs/.vitepress/config.mts` 的 `/charts/` 侧边栏加入条目
4. 跑 `npm run build` 与验证脚本

::: tip 最简示例一定要有 LiveChart
纯文字 + 代码块的文档读起来很抽象。一个能拖拽的实例能省掉大量解释。
:::

---

## 下一步

- [部署指南](./DEPLOY.md)
- [架构](/guide/architecture)
