/**
 * 解析 vis-3x 的实际来源路径
 *
 * 本目录不在 monorepo 内，所以不能用 `workspace:*`。
 * 按以下顺序取第一个存在的：
 *
 * 1. 环境变量 `VIS3X_SRC` / `VIS3X_PKG` 显式指定
 * 2. 相邻的 monorepo 源码 `../vis-3x/packages/vis-3x/src`
 *    —— 开发时用这个，改库代码文档站立刻生效
 * 3. 本目录 `node_modules/vis-3x`
 *    —— 部署 / CI 场景
 *
 * 文档站与门户首页共用这一份逻辑，避免两处不一致。
 *
 * 注意：本文件可能被 `docs/.vitepress/config.mts` 与
 * `vite.home.config.ts` 从不同深度导入，因此**不能靠 `../` 的数量**
 * 定位项目根目录，而是从本文件自身的路径向上查找 `package.json`。
 */
import { existsSync, readFileSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

/** 本文件所在目录（scripts/） */
const HERE = dirname(fileURLToPath(import.meta.url))

/** 向上查找项目根目录（含 package.json 且 name 为 vis-3x-md 的那层） */
function findProjectRoot(start) {
  let dir = start
  for (let i = 0; i < 5; i++) {
    const pkg = join(dir, 'package.json')
    if (existsSync(pkg)) {
      try {
        const json = JSON.parse(readFileSync(pkg, 'utf8'))
        if (json.name === 'vis-3x-md') return dir
      } catch {
        /* 解析失败继续向上 */
      }
    }
    const parent = resolve(dir, '..')
    if (parent === dir) break
    dir = parent
  }
  return resolve(start, '..')
}

const PROJECT_ROOT = findProjectRoot(HERE)

/** 相邻 monorepo 的库源码：<root>/../vis-3x/packages/vis-3x/src */
const MONOREPO_ROOT = resolve(PROJECT_ROOT, '..', 'vis-3x', 'packages', 'vis-3x')
const MONOREPO_SRC = join(MONOREPO_ROOT, 'src')

/** 本目录已安装的包 */
const LOCAL_PKG = join(PROJECT_ROOT, 'node_modules', 'vis-3x')

/**
 * @typedef {object} Vis3xPaths
 * @property {string} entry  主入口（TS 源码或已构建的 ESM）
 * @property {string} style  样式文件
 * @property {string} base   子路径解析的根（src 目录或包目录）
 * @property {'env-src'|'env-pkg'|'monorepo'|'installed'|'missing'} from  来源类型
 */

/** 包支持的子路径入口（与 packages/vis-3x/package.json 的 exports 对应） */
export const SUBPATHS = [
  'core',
  'charts',
  'components',
  'composables',
  'types',
  'utils',
  'adapters',
  'presets',
]

/**
 * 解析 vis-3x 的入口与样式路径
 * @returns {Vis3xPaths}
 */
export function resolveVis3x() {
  if (process.env.VIS3X_SRC) {
    const src = process.env.VIS3X_SRC.replace(/\\/g, '/')
    return {
      entry: `${src}/index.ts`,
      style: `${src}/styles/index.css`,
      base: src,
      from: 'env-src',
    }
  }

  if (process.env.VIS3X_PKG) {
    const pkg = process.env.VIS3X_PKG.replace(/\\/g, '/')
    return {
      entry: `${pkg}/dist/index.js`,
      style: `${pkg}/dist/style.css`,
      base: pkg,
      from: 'env-pkg',
    }
  }

  if (existsSync(join(MONOREPO_SRC, 'index.ts'))) {
    const src = MONOREPO_SRC.replace(/\\/g, '/')
    return {
      entry: `${src}/index.ts`,
      style: `${src}/styles/index.css`,
      base: src,
      from: 'monorepo',
    }
  }

  if (existsSync(join(LOCAL_PKG, 'dist', 'index.js'))) {
    const pkg = LOCAL_PKG.replace(/\\/g, '/')
    return {
      entry: `${pkg}/dist/index.js`,
      style: `${pkg}/dist/style.css`,
      base: pkg,
      from: 'installed',
    }
  }

  // 找不到时不要抛错——文档站其余部分仍应能构建
  return { entry: 'vis-3x', style: 'vis-3x/style.css', base: '', from: 'missing' }
}

/**
 * 供 vite / vitepress 使用的 alias 数组
 *
 * 除主入口与样式外，还要处理 8 个子路径（`vis-3x/presets` 等），
 * 否则文档站里 `import { useExtraCharts } from 'vis-3x/presets'` 会解析失败。
 */
export function vis3xAlias() {
  const { entry, style, base, from } = resolveVis3x()

  const alias = [
    { find: /^vis-3x\/style\.css$/, replacement: style },
    { find: /^vis-3x$/, replacement: entry },
  ]

  // 源码模式：子路径指向 src/<name>/index.ts
  // 包模式：交给包自身的 exports 字段，不拦截
  if (from === 'monorepo' || from === 'env-src') {
    for (const name of SUBPATHS) {
      alias.push({
        find: new RegExp(`^vis-3x/${name}$`),
        replacement: `${base}/${name}/index.ts`,
      })
    }
  }

  return alias
}

/** 供构建脚本打印诊断信息 */
export function describeVis3x() {
  const { from, entry } = resolveVis3x()
  const label = {
    'env-src': '环境变量 VIS3X_SRC',
    'env-pkg': '环境变量 VIS3X_PKG',
    monorepo: 'monorepo 源码（热更新）',
    installed: 'node_modules/vis-3x（已安装的包）',
    missing: '★ 未找到',
  }[from]
  return { from, label, entry, projectRoot: PROJECT_ROOT }
}
