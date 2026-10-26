# 3dcharts

这个目录下有两个项目，构成 **vis-3x** 3D 图表库的完整工程：

```
3dcharts/
├── vis-3x/       组件源码（monorepo，发布到 npm 的库）
└── vis-3x-md/    官方手册（文档站 + 门户首页）
```

---

## vis-3x — 组件源码

图表库本体。pnpm monorepo 结构。

```
vis-3x/
├── packages/
│   └── vis-3x/          核心库（npm 包名 `vis-3x`）
│       ├── src/
│       │   ├── core/          引擎、基类、坐标系、扩展 API
│       │   ├── charts/        10 种内置 3D 图表
│       │   ├── components/    Vue 组件层
│       │   ├── composables/   useVisChart
│       │   ├── presets/       主题 + 6 个扩展示例图表
│       │   ├── adapters/      ECharts 配置适配器
│       │   ├── types/         完整类型定义
│       │   └── utils/         颜色 / 数学 / 缓动 / 对象池
│       └── test/              产物消费测试
├── apps/
│   └── playground/      演示与开发调试站点（26 个图表示例）
├── scripts/             构建校验脚本
├── .github/workflows/   CI + 自动发布
└── .changeset/          版本管理
```

### 常用命令

```bash
cd vis-3x

pnpm install              # 安装依赖
pnpm typecheck            # 类型检查
pnpm build                # 构建库（ESM + CJS + .d.ts）
pnpm dev                  # 启动演示站
```

---

## vis-3x-md — 官方手册

文档站与门户首页。**不在 monorepo 内**，用 npm 独立管理。

```
vis-3x-md/
├── docs/                VitePress 文档站（53 篇，构建为 54 个 HTML）
│   ├── guide/             指南（18 篇）
│   ├── charts/            图表手册（17 篇）
│   ├── custom/            自定义图表（7 篇）
│   ├── api/               API 参考（8 篇）
│   └── .vitepress/        配置与主题
├── home/                门户首页（Vite + Vue，含可交互 3D 图表）
├── scripts/             构建与校验脚本
├── CONTRIBUTING.md      文档维护指南
└── DEPLOY.md            构建与部署指南
```

### 常用命令

```bash
cd vis-3x-md
npm install

npm run dev              # 文档站      http://localhost:5173
npm run home:dev         # 门户首页    http://localhost:5180

npm run check:js         # 校验所有 JS 代码块语法
npm run build:deploy     # 构建两者 + 组装发布目录
```

> [!IMPORTANT]
> **文档站需要两个终端**
>
> `npm run dev` 与 `npm run home:dev` 是两个独立服务。
> 首页的导航链接指向文档站（开发时是 5173 端口），所以**两个都要启动**，
> 否则点导航会连不上。

---

## 两者的关系

```
vis-3x-md  ──引用──▶  vis-3x/packages/vis-3x/src
（文档站）            （库源码）
```

`vis-3x-md/scripts/resolve-vis3x.mjs` 按顺序解析库的位置：

1. 环境变量 `VIS3X_SRC` / `VIS3X_PKG`（显式指定）
2. `../vis-3x/packages/vis-3x/src` — **本地开发用这个**，改库代码文档站立刻生效
3. `node_modules/vis-3x` — 部署 / CI 场景（已构建或从 npm 安装的包）

所以**两个项目必须保持同级目录**，这就是它们放在同一个 `3dcharts/` 下的原因。

> [!TIP]
> **为什么文档站不放进 monorepo**
>
> 文档站主要消费库的构建产物，只有门户首页需要真的运行图表。
> 独立目录让它能单独部署、单独版本管理，不必和库的发布节奏绑在一起。

---

## 从零开始跑起来

```bash
# 1. 先装库的依赖并构建
cd vis-3x
pnpm install
pnpm build
pnpm dev                  # 可选：看演示站

# 2. 另开终端，装文档站依赖
cd ../vis-3x-md
npm install
npm run dev               # 文档站 http://localhost:5173

# 3. 再开一个终端看门户首页
npm run home:dev          # http://localhost:5180
```

---

## 技术栈

| 项目 | 技术栈 |
|---|---|
| 组件源码 | Vue 3 · TypeScript · Three.js · Vite · pnpm workspace |
| 官方手册 | VitePress · Vue 3 · TypeScript · Vite |

`three` 与 `vue` 都是 **peerDependencies**，由使用者的项目提供，
不会被重复打包进库的产物。
