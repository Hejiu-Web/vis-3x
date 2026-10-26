import { defineConfig, type Plugin } from 'vite'
import vue from '@vitejs/plugin-vue'
import { fileURLToPath, URL } from 'node:url'
import { vis3xAlias } from './scripts/resolve-vis3x.mjs'

/**
 * 门户首页（落地页）的 Vite 配置
 *
 * 构建产物：
 * - 文档站：docs/        ->  docs/.vitepress/dist   （由 `npm run build` 产出）
 * - 首页  ：home/        ->  dist-home              （本配置产出）
 *
 * ## vis-3x 从哪来
 *
 * 见 `scripts/resolve-vis3x.mjs`：优先相邻 monorepo 源码（热更新），
 * 否则用 node_modules 里已安装的包。
 *
 * ## 关于文档链接
 *
 * 首页导航指向 `/guide/...`、`/charts/...` 等文档路径。
 * 这些页面由 VitePress 提供，**默认端口 5173**。
 *
 * 因此本配置把文档路由代理到 VitePress。若文档站没启动，
 * 会显示一个明确的提示页——而不是像以前那样被 SPA fallback
 * 悄悄返回首页 HTML（表现为「点菜单没反应」）。
 *
 * 生产环境两者同源（见 DEPLOY.md 的组装步骤），不存在这个问题。
 */

/** 文档站的路由前缀 */
const DOCS_PREFIXES = ['/guide', '/charts', '/custom', '/api', '/changelog', '/license']

/** 文档站 dev server 地址 */
const DOCS_DEV = process.env.DOCS_DEV ?? 'http://localhost:5173'

/**
 * 文档站未启动时的提示页
 *
 * Vite 默认的 SPA fallback 会把 `/guide/introduction` 也返回首页 HTML，
 * 用户会以为「链接坏了」。这里改成返回明确的提示。
 *
 * 注意：必须用 `return () => {...}` 注册为**后置**中间件，
 * 否则会在 Vite 的代理中间件之前执行，把能正常代理的请求也拦下来。
 */
function docsFallbackPlugin(): Plugin {
  return {
    name: 'vis3x-docs-fallback',
    configureServer(server) {
      // 返回一个函数 = 在 Vite 内置中间件（含 proxy）之后执行
      return () => {
        server.middlewares.use((req, res, next) => {
          const url = req.url ?? '/'
          const path = url.split('?')[0]

          const isDocsRoute = DOCS_PREFIXES.some(
            (p) => path === p || path.startsWith(p + '/')
          )
          if (!isDocsRoute) return next()

          // 能走到这里说明 proxy 没处理（文档站未启动）
          res.statusCode = 503
          res.setHeader('Content-Type', 'text/html; charset=utf-8')
          res.end(`<!doctype html>
<html lang="zh-CN">
<head>
  <meta charset="utf-8" />
  <title>文档站未启动</title>
  <style>
    body {
      margin: 0; min-height: 100vh; display: grid; place-items: center;
      background: #070b14; color: #cbd5e1;
      font: 15px/1.7 -apple-system, 'Segoe UI', 'PingFang SC', sans-serif;
    }
    .box {
      max-width: 560px; padding: 36px 40px;
      border: 1px solid #1e293b; border-radius: 14px;
      background: linear-gradient(180deg, #0d1424, #090e1a);
    }
    h1 { margin: 0 0 14px; font-size: 19px; color: #f1f5f9; }
    p { margin: 0 0 18px; color: #94a3b8; }
    code {
      display: block; padding: 12px 16px; margin: 0 0 16px;
      background: #050912; border: 1px solid #1e293b; border-radius: 8px;
      font-family: ui-monospace, Consolas, monospace; font-size: 13px; color: #7fa8e8;
    }
    .note { font-size: 13px; color: #64748b; margin: 0; }
    a { color: #4f8cff; }
  </style>
</head>
<body>
  <div class="box">
    <h1>文档站没有启动</h1>
    <p>你访问的是文档页面，但它由 VitePress 提供，需要另一个终端启动。</p>
    <code>npm run dev</code>
    <p class="note">
      文档站启动在 <a href="${DOCS_DEV}">${DOCS_DEV}</a>，
      启动后刷新本页即可正常跳转。
    </p>
  </div>
</body>
</html>`)
        })
      }
    },
  }
}

export default defineConfig(({ command }) => ({
  /**
   * 资源基准路径
   *
   * 首页最终部署在 GitHub Pages 的 `/vis-3x/` 根路径下，
   * assets 必须带这个前缀，否则线上 404。
   *
   * - `vite`（开发）：`/`，避免开发时路径错乱
   * - `vite build`（构建）：`/vis-3x/`，可用 VITE_SITE_BASE 覆盖
   */
  base: command === 'build' ? (process.env.VITE_SITE_BASE ?? '/vis-3x/') : '/',
  plugins: [vue(), docsFallbackPlugin()],
  resolve: {
    alias: vis3xAlias(),
  },
  root: fileURLToPath(new URL('./home', import.meta.url)),
  build: {
    outDir: fileURLToPath(new URL('./dist-home', import.meta.url)),
    emptyOutDir: true,
    target: 'es2019',
    sourcemap: false,
    // Three.js 本身就有 600KB+，单独拆包便于浏览器缓存，
    // 也避免主包触发 chunk 体积警告
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (id.includes('node_modules/three') || id.includes('three/build')) {
            return 'three'
          }
          if (id.includes('node_modules/vue') || id.includes('node_modules/@vue')) {
            return 'vue'
          }
          return undefined
        },
      },
    },
    chunkSizeWarningLimit: 700,
  },
  server: {
    port: 5180,
    open: true,
  },
}))
