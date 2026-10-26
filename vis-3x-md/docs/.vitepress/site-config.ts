/**
 * vis-3x 站点配置
 *
 * 发布前只需修改这个文件，全站链接会自动更新。
 */

/** 代码仓库地址 */
export const REPO_URL = 'https://github.com/Hejiu-Web/vis-3x'

/**
 * 在线演示（Playground）地址
 *
 * 已与文档站一起部署到 GitHub Pages 的 `/playground/` 子路径。
 */
export const PLAYGROUND_URL = '/playground/'

/**
 * 站点基准路径
 *
 * GitHub Pages **项目站点**部署在 `https://<user>.github.io/<repo>/`，
 * 必须把仓库名带上，否则所有静态资源（CSS / JS / 图片）都会 404。
 *
 * - 项目站点：`/vis-3x/`
 * - 用户 / 组织站点（仓库名 = `<user>.github.io`）：`/`
 * - 自定义域名（根路径）：`/`
 *
 * 支持环境变量覆盖，方便本地预览或切换域名：
 *   DOCS_BASE=/ npm run build
 */
export const BASE_PATH = process.env.DOCS_BASE ?? '/vis-3x/'

/** 当前版本号（与 packages/vis-3x/package.json 保持一致） */
export const VERSION = '0.1.0'
