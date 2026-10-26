/**
 * 门户首页站点配置
 *
 * 发布前只需修改这个文件，首页链接会自动更新。
 * （文档站有对应的 docs/.vitepress/site-config.ts，两处保持同步）
 */

/** 代码仓库地址 */
export const REPO_URL = 'https://github.com/Hejiu-Web/vis-3x'

/** 在线演示（Playground）地址 */
export const PLAYGROUND_URL = '/playground/'

/** 当前版本号 */
export const VERSION = '0.1.0'

/**
 * 站点部署基准路径
 *
 * 与文档站保持一致（`docs/.vitepress/site-config.ts` 的 `BASE_PATH`）。
 * GitHub Pages 项目站点必须带仓库名前缀。
 */
export const BASE_PATH = import.meta.env.VITE_SITE_BASE ?? '/vis-3x/'

/**
 * 文档站地址前缀
 *
 * - 生产环境：文档站与首页**同源且同前缀**，直接用 BASE_PATH
 * - 本地开发：文档站跑在 5173，首页跑在 5180，需要跨端口跳转
 *
 * 用 Vite 的 `import.meta.env.DEV` 自动判断，不需要手动改。
 * 如需指向别的地址（比如预发布环境），设环境变量 `VITE_DOCS_BASE`。
 */
export const DOCS_BASE =
  import.meta.env.VITE_DOCS_BASE ?? (import.meta.env.DEV ? 'http://localhost:5173' : BASE_PATH)

/**
 * 拼接文档链接
 *
 * 首页里的导航、页脚、CTA 按钮都用它，
 * 保证开发与生产两种环境下的路径都正确。
 */
export function docsUrl(path: string): string {
  const p = path.startsWith('/') ? path : `/${path}`
  // 避免出现 '//' 双斜杠
  const base = DOCS_BASE.endsWith('/') ? DOCS_BASE.slice(0, -1) : DOCS_BASE
  return `${base}${p}`
}
