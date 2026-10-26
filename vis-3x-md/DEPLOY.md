# 站点构建与部署

`vis-3x-md` 包含两个独立的站点，构建后合并成一个发布目录。

## 位置

本目录 **不在 `vis-3x` monorepo 内**，是同级目录：

```
F:\hejiu45\3dcharts\
├── vis-3x\                 ← 图表库 monorepo（packages/vis-3x 发布到 npm）
└── vis-3x-md\              ← 本目录：文档站 + 门户首页
```

**为什么独立**：文档站主要消费图表库的**构建产物**，
只有门户首页需要运行图表来展示效果。独立目录让文档站可以单独部署、
单独版本管理，不必和库的发布节奏绑在一起。

---

## 结构

```
vis-3x-md/
├── home/                      门户首页（Vite + Vue）
│   ├── index.html
│   ├── main.ts
│   ├── App.vue
│   ├── site-config.ts         ← 首页的链接与版本配置
│   └── components/
├── docs/                      文档站（VitePress）
│   ├── index.md
│   ├── .vitepress/
│   │   ├── config.mts
│   │   ├── site-config.ts     ← 文档站的链接配置
│   │   └── theme/
│   └── guide/ charts/ custom/ api/
├── dist-home/                 首页构建产物
├── vite.home.config.ts
└── DEPLOY.md
```

**两个站点分工**：

| 路径 | 内容 | 产物目录 |
|---|---|---|
| `/` | 门户首页（落地页 + 可交互 3D 图表） | `dist-home/` |
| `/guide/` `/charts/` `/custom/` `/api/` | 文档站 | `docs/.vitepress/dist/` |

---

## vis-3x 从哪来

本目录不能用 `workspace:*`，`vite.home.config.ts` 按以下顺序自动解析：

1. **相邻的 monorepo 源码** `../vis-3x/packages/vis-3x/src`
   → 改库的代码，首页热更新立刻生效（日常开发用这个）
2. **本目录已安装的包** `node_modules/vis-3x`
   → 部署 / CI 场景（库已构建好，或从 npm 装）

也可以用环境变量强制指定：

```bash
VIS3X_SRC=F:/path/to/vis-3x/src npm run home:dev   # 指定源码
VIS3X_PKG=F:/path/to/vis-3x      npm run home:dev   # 指定已构建的包
```

::: tip 文档站不依赖库源码
VitePress 只读 Markdown 里的**代码文本**，不会真的执行。
所以构建文档站不需要 `vis-3x` 存在。
:::

---

## 本地开发

```bash
cd vis-3x-md
npm install
```

**需要开两个终端**——文档站与首页是两个独立的服务：

```bash
# 终端 1：文档站（5173）
npm run dev

# 终端 2：门户首页（5180）
npm run home:dev
```

### 首页的文档链接怎么跳转

首页导航指向 `/guide/...`、`/charts/...` 等文档路径，但本地开发时两者端口不同。

`home/site-config.ts` 里的 `docsUrl()` 会自动处理：

```ts
export const DOCS_BASE =
  import.meta.env.VITE_DOCS_BASE ??
  (import.meta.env.DEV ? 'http://localhost:5173' : '')

export function docsUrl(path: string): string {
  return `${DOCS_BASE}${path}`
}
```

- **开发时**（`npm run home:dev`）：链接指向 `http://localhost:5173/guide/...`
  → 所以**必须先启动文档站**，否则点导航会连不上
- **生产时**（`npm run home:build`）：`DOCS_BASE` 为空字符串，用相对路径
  → 两者同源，不存在跨端口问题

::: warning 没启动文档站会怎样
首页能正常打开，但点导航会显示「无法访问此网站」。
这不是 bug——文档站确实没在运行。启动 `npm run dev` 即可。

（早期版本这里有个坑：Vite 的 SPA fallback 会对任意路径返回首页 HTML，
表现为「点了菜单没反应」。现在改成显式跨端口链接，问题不存在了。）
:::

::: tip 想用别的地址
设环境变量即可：

```bash
VITE_DOCS_BASE=https://docs.example.com npm run home:dev
```
:::

---

## 构建

```bash
# 分别构建
npm run build         # 文档站
npm run home:build    # 门户首页

# 一起构建
npm run build:all
```

::: warning 先构建库
门户首页会读取 `../vis-3x/packages/vis-3x/src`（源码模式），
改动库以后不需要重新构建库，首页直接生效。

但如果你用的是 `node_modules/vis-3x`（包模式），需要先在 monorepo 里：

```bash
cd ../vis-3x
pnpm --filter vis-3x build
```
:::

---

## 组装发布目录

文档站与首页的产物需要合并：**首页占据根路径，文档站保留在子路径下**。

```bash
DIST=docs/.vitepress/dist
PORTAL=dist-home

# 只覆盖 index.html 与 assets/，不要递归覆盖整个目录
cp "$PORTAL/index.html" "$DIST/index.html"
cp -r "$PORTAL/assets/." "$DIST/assets/"
```

::: danger 不要用 `cp -r $PORTAL/* $DIST/`
那样虽不会清掉文档站，但 **`dist-home` 里的 `favicon.svg` 等文件会覆盖文档站同名文件**，
且如果 `dist-home` 有多余目录会一起带进去。

按上面的方式只覆盖确定要覆盖的两个位置，结果可控。
:::

::: tip 已提供便捷脚本
上面的命令可以直接用 npm script 执行：

```bash
npm run build:all      # 构建两者
npm run assemble       # 组装（如果已添加该脚本）
```

或手动执行上面的两行 `cp`。组装后可自检：

```bash
grep -q '<div id="app"></div>' docs/.vitepress/dist/index.html \
  && echo "根路径是门户首页 ✓" || echo "★ 根路径不是首页"
test -f docs/.vitepress/dist/guide/quick-start.html \
  && echo "文档页存在 ✓" || echo "★ 文档页缺失"
```
:::

组装后的目录结构：

```
dist/
├── index.html          ← 门户首页
├── assets/
│   ├── index-xxx.js    ← 首页业务代码
│   ├── three-xxx.js    ← Three.js（单独分包，便于缓存）
│   ├── vue-xxx.js
│   └── style-xxx.css   ← 文档站样式
├── guide/*.html        ← 文档站
├── charts/*.html
├── custom/*.html
├── api/*.html
├── 404.html
└── favicon.svg
```

---

## 自动部署（GitHub Pages）

::: warning 文档站不在库的仓库里
`vis-3x` 仓库的 `.github/workflows/deploy-docs.yml` **默认不会被触发**——
GitHub Actions 只检出当前仓库，而 `vis-3x-md` 是同级目录 / 独立仓库。

有两种接法，选一种：

### 方案 A：文档站独立仓库（推荐）

1. 把 `vis-3x-md` 初始化成独立仓库并推到 GitHub
2. 在**文档站仓库**的 Settings → Pages 里把 Source 设为 `GitHub Actions`
3. 在文档站仓库里建 `.github/workflows/deploy.yml`：

```yaml
name: Deploy Docs

on:
  push:
    branches: [main]
  workflow_dispatch:

permissions:
  contents: read
  pages: write
  id-token: write

concurrency:
  group: pages
  cancel-in-progress: false

jobs:
  build:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4

      - uses: actions/setup-node@v4
        with:
          node-version: 20

      - run: npm install
      - run: npm run build
      - run: npm run home:build

      - name: 组装
        run: |
          set -e
          DIST=docs/.vitepress/dist
          cp dist-home/index.html "$DIST/index.html"
          cp -r dist-home/assets/. "$DIST/assets/"

      - uses: actions/upload-pages-artifact@v3
        with:
          path: docs/.vitepress/dist

  deploy:
    needs: build
    runs-on: ubuntu-latest
    environment:
      name: github-pages
      url: ${{ steps.deployment.outputs.page_url }}
    steps:
      - uses: actions/deploy-pages@v4
```

::: tip 这种模式下 vis-3x 从哪来
CI 里没有 `../vis-3x` 源码，`vite.home.config.ts` 会自动回退到
`node_modules/vis-3x`。所以需要在文档站仓库里把 `vis-3x` 加进依赖：

```bash
npm install vis-3x three vue
```
:::

### 方案 B：与库同仓库

把 `vis-3x-md` 放进 `vis-3x` 仓库内（例如 `apps/vis-3x-md`），
然后 `deploy-docs.yml` 里的 `working-directory: vis-3x-md` 改成实际路径即可。
这种情况下 CI 能同时看到库和文档站。

:::

### 部署到子路径

如果站点不在域名根路径下（比如 `example.com/vis-3x/`），需要设置 `base`：

```ts
// apps/vis-3x-md/docs/.vitepress/site-config.ts
export const BASE_PATH = '/vis-3x/'
```

首页的 `vite.home.config.ts` 也要同步：

```ts
export default defineConfig({
  base: '/vis-3x/',
  // ...
})
```

::: warning 首页里的文档链接
首页中 `/guide/quick-start` 这类绝对路径在子路径部署下会失效。

这种情况下改成相对路径（`./guide/quick-start`），或者在 `home/site-config.ts`
里定义完整的 `DOCS_BASE` 并在组件里拼接。
:::

---

## 部署到其他平台

产物是纯静态文件，任何静态托管都能用：

```bash
# 组装后直接上传 dist 目录
DIST=apps/vis-3x-md/docs/.vitepress/dist

# Vercel
npx vercel deploy "$DIST" --prod

# Netlify
npx netlify deploy --dir="$DIST" --prod

# 或同步到自己的服务器
rsync -avz "$DIST/" user@host:/var/www/vis-3x/
```

需要 SPA 回退时（首页是 Vue SPA），配置 `404` 重写到 `index.html`。
不过文档站的 `404.html` 已经存在，直接把 404 指向它即可。

---

## 发布前检查清单

- [ ] `docs/.vitepress/site-config.ts` 里的 `REPO_URL` 改为真实仓库地址
- [ ] `docs/.vitepress/site-config.ts` 里的 `PLAYGROUND_URL` 改为演示站真实地址
- [ ] `home/site-config.ts` 里的 `REPO_URL` 与 `PLAYGROUND_URL` 同步修改
- [ ] 两处 `VERSION` 与 `packages/vis-3x/package.json` 的 `version` 一致
- [ ] 部署到子路径时设置了 `BASE_PATH`
- [ ] `pnpm typecheck` 通过
- [ ] `pnpm build` 通过
- [ ] `pnpm --filter vis-3x-md build:all` 通过
- [ ] 组装后 `dist/index.html` 含 `<div id="app"></div>`（确认是首页而非文档站）
- [ ] 组装后 `dist/guide/quick-start.html` 存在

---

## 配置项集中管理

所有需要改的链接都在两个文件里：

**`docs/.vitepress/site-config.ts`**

```ts
export const REPO_URL = 'https://github.com/Hejiu-Web/vis-3x'
export const PLAYGROUND_URL = 'http://localhost:5178/'
export const BASE_PATH = '/'
export const VERSION = '0.1.0'
```

**`home/site-config.ts`**

```ts
export const REPO_URL = 'https://github.com/Hejiu-Web/vis-3x'
export const PLAYGROUND_URL = 'http://localhost:5178/'
export const DOCS_URL = '/guide/introduction'
export const VERSION = '0.1.0'
```

文档站的配置通过 `config.mts` 引用，页面里通过 `<script setup>` 导入。
首页组件直接 import，全站没有硬编码的 URL 散落在各处。

---

## 故障排查

::: details 根路径显示的是文档站而不是首页
组装步骤没执行，或顺序反了。确认先构建文档站、再构建首页、最后执行组装。

验证方式：

```bash
grep -q '<div id="app"></div>' dist/index.html && echo "是首页" || echo "不是首页"
```
:::

::: details 首页能打开但样式全无
`assets/` 没复制过去。首页的 CSS 与 JS 都在 `dist-home/assets/`，需要合并进 `dist/assets/`。
:::

::: details 文档页 404
文档站的产物被覆盖了。检查组装时是否用了 `cp -r $PORTAL/* $DIST/`——
应该只复制 `index.html` 与 `assets/`。
:::

::: details 首页的图表不显示
首页从源码引入 `vis-3x`，如果库本身有类型或构建错误，首页也会失败。
先单独跑 `pnpm --filter vis-3x build` 确认库是好的。
:::
