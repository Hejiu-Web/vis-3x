# vis-3x

> 3D 数据可视化图表库 · monorepo

基于 **Vue 3 + TypeScript + Three.js** 的 3D 图表库，支持 Vue 组件、组合式 API 与纯 JavaScript 三种用法，并提供 ECharts 风格的灵活图表扩展能力。

---

## 📁 仓库结构

```
vis-3x/
├── packages/
│   └── vis-3x/              # 核心库（发布到 npm）
│       ├── src/
│       │   ├── index.ts         主入口
│       │   ├── core/            引擎、基类、坐标系、扩展 API
│       │   ├── charts/          10 种内置图表实现
│       │   ├── components/      Vue 组件
│       │   ├── composables/     useVisChart
│       │   ├── presets/         主题预设 + 示例扩展图表
│       │   ├── adapters/        ECharts 配置适配器
│       │   ├── types/           完整类型定义
│       │   ├── utils/           数学 / 颜色 / 缓动 / 对象池
│       │   └── styles/          基础样式
│       ├── test/
│       │   └── dist-smoke.mjs   产物消费测试（18 项）
│       └── dist/                构建产物（ESM + CJS + .d.ts）
│
├── apps/
│   ├── playground/          # 演示与开发调试站点
│   │   └── src/App.vue          10 内置 + 6 自定义图表全量示例
│   │
│   └── vis-3x-md/           # 官方文档站 + 门户首页
│       ├── docs/                VitePress 文档站（53 篇）
│       │   ├── guide/             指南（18 篇）
│       │   ├── charts/            图表手册（17 篇）
│       │   ├── custom/            自定义图表（7 篇）
│       │   ├── api/               API 参考（8 篇）
│       │   └── .vitepress/        配置与主题定制
│       ├── home/                门户首页（Vite + Vue，含可交互 3D 图表 Hero）
│       └── DEPLOY.md            构建与部署指南
│
├── scripts/
│   ├── check-exports.mjs         校验 package.json 导出路径
│   ├── verify-playground.mjs     浏览器渲染验证（CDP）
│   ├── verify-docs.mjs           文档站页面验证
│   ├── verify-animations.mjs     动画系统验证
│   ├── screenshot-playground.mjs 截图
│   └── diagnose-*.mjs            各类专项诊断
│
├── .github/workflows/
│   ├── ci.yml                   类型检查 / 构建 / 产物校验 / 文档构建
│   ├── deploy-docs.yml          文档站与首页发布到 GitHub Pages
│   └── release.yml              changesets 自动发布
│
├── .changeset/               # 版本管理配置
└── pnpm-workspace.yaml
```

---

## 📚 文档

官方文档位于 `apps/vis-3x-md`，包含完整的指南、图表手册、扩展教程与 API 参考。

```bash
# 文档站（默认 5173）
pnpm --filter vis-3x-md dev

# 门户首页（默认 5180）
pnpm --filter vis-3x-md home:dev

# 构建两者
pnpm --filter vis-3x-md build:all
```

部署方式见 [apps/vis-3x-md/DEPLOY.md](./apps/vis-3x-md/DEPLOY.md)。

---

## 🚀 开发

```bash
# 安装依赖（需要 pnpm >= 9）
pnpm install

# 启动演示站点（含 HMR）
pnpm dev
# → http://localhost:5178

# 类型检查
pnpm typecheck

# 构建库（ESM + CJS + 类型声明）
pnpm build

# 校验构建产物
node packages/vis-3x/test/dist-smoke.mjs
node scripts/check-exports.mjs
```

---

## 📦 发布流程

本项目使用 [changesets](https://github.com/changesets/changesets) 管理版本。

### 1. 记录变更

```bash
pnpm changeset
```

选择变更类型：

- `patch` — 修 bug、文档调整
- `minor` — 新增图表类型 / 配置项（向后兼容）
- `major` — 破坏性变更

### 2. 更新版本

```bash
pnpm version-packages   # 消费 changeset，更新版本号与 CHANGELOG
```

### 3. 发布

```bash
pnpm build
pnpm release            # changeset publish
```

或本地预演：

```bash
pnpm --filter vis-3x publish:dry   # npm publish --dry-run
```

### 自动化（CI）

推送到 `main` 后，`.github/workflows/release.yml` 会：

1. 跑类型检查、构建、产物校验
2. 有未消费的 changeset → 自动创建「版本发布」PR
3. 该 PR 被合并 → 自动发布到 npm

**需要在 GitHub 仓库配置密钥**：`NPM_TOKEN`（npm 访问令牌）。

---

## 🧪 测试与验证

| 命令 | 作用 |
|---|---|
| `pnpm --filter vis-3x typecheck` | 类型检查（vue-tsc） |
| `node packages/vis-3x/test/dist-smoke.mjs` | 产物消费测试：54 个导出符号、8 个子路径、扩展 API、插件系统、CJS 入口 |
| `node scripts/check-exports.mjs` | 校验 package.json 所有导出路径真实存在 |
| `node scripts/verify-playground.mjs` | 用 CDP 驱动无头 Chrome，验证真实渲染 + 交互 |
| `node scripts/screenshot-playground.mjs` | 截图，用于人工视觉核对 |

---

## 🎨 快速上手

```bash
npm install vis-3x three vue
```

```vue
<script setup lang="ts">
import type { Vis3xOption } from 'vis-3x'

const option: Vis3xOption = {
  xAxis3D: { data: ['Q1', 'Q2', 'Q3', 'Q4'] },
  series: [{ type: 'bar3D', data: [120, 200, 150, 80] }],
}
</script>

<template>
  <div style="height: 400px">
    <VisBar3D :option="option" />
  </div>
</template>
```

完整文档见 [packages/vis-3x/README.md](./packages/vis-3x/README.md)。

---

## ✨ 核心能力：自定义图表

三种方式，任选其一：

```ts
// A. 函数式定义（推荐）
defineChart({ type: 'my3D', render(ctx) { /* 用 ctx 画 */ } })

// B. 继承内置图表
extendChart('bar3D', { type: 'barLine3D', afterRender(ctx) { /* 追加 */ } })

// C. 注册完整类
registerChart('my3D', class extends ChartBase { /* ... */ })
```

`ctx` 提供坐标映射、几何体、材质、标签、交互、动画、主题等全套能力。
内置的 6 个示例扩展图表（`src/presets/extra-charts.ts`）就是活文档。

---

## 📄 许可证

[MIT](./LICENSE)
