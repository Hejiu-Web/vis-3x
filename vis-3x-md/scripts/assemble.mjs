/**
 * 组装发布目录
 *
 * 把门户首页的产物合并进文档站的产物目录：
 * - 首页的 index.html 覆盖文档站的根 index.html（让 / 变成落地页）
 * - 首页的 assets/ 合并进 dist/assets/
 *
 * **只覆盖这两个位置**，不递归覆盖整个目录，
 * 否则文档站的 guide/ charts/ api/ 等页面会被清掉。
 *
 * 用法：
 *   node scripts/assemble.mjs
 *   # 或
 *   npm run assemble
 */
import { existsSync, copyFileSync, mkdirSync, readdirSync, readFileSync, statSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..')
const DIST = join(ROOT, 'docs', '.vitepress', 'dist')
const PORTAL = join(ROOT, 'dist-home')

/** 彩色输出（Windows 终端也支持 ANSI） */
const ok = (s) => `\x1b[32m${s}\x1b[0m`
const err = (s) => `\x1b[31m${s}\x1b[0m`
const dim = (s) => `\x1b[2m${s}\x1b[0m`

function fail(msg) {
  console.error(err('✗ ' + msg))
  process.exit(1)
}

/* ---------------------------- 1. 前置检查 ---------------------------- */

if (!existsSync(DIST)) {
  fail(`找不到文档站产物：${DIST}\n  请先运行 npm run build`)
}
if (!existsSync(join(DIST, 'index.html'))) {
  fail('文档站产物缺少 index.html，构建可能未完成')
}
if (!existsSync(PORTAL)) {
  fail(`找不到首页产物：${PORTAL}\n  请先运行 npm run home:build`)
}
if (!existsSync(join(PORTAL, 'index.html'))) {
  fail('首页产物缺少 index.html')
}

console.log('组装发布目录')
console.log(dim(`  文档站: ${DIST}`))
console.log(dim(`  门户页: ${PORTAL}`))

/* ------------------------- 2. 覆盖根 index.html ------------------------- */

copyFileSync(join(PORTAL, 'index.html'), join(DIST, 'index.html'))
console.log('  ✓ 根 index.html ← 门户首页')

/* --------------------------- 3. 合并 assets ---------------------------- */

const portalAssets = join(PORTAL, 'assets')
if (existsSync(portalAssets)) {
  const targetAssets = join(DIST, 'assets')
  mkdirSync(targetAssets, { recursive: true })

  let copied = 0
  for (const name of readdirSync(portalAssets)) {
    const src = join(portalAssets, name)
    if (!statSync(src).isFile()) continue
    copyFileSync(src, join(targetAssets, name))
    copied++
  }
  console.log(`  ✓ assets/ 合并 ${copied} 个文件`)
} else {
  console.log(dim('  - 首页没有 assets 目录，跳过'))
}

/* ---------------------------- 4. 校验结果 ----------------------------- */

console.log('\n校验：')

const distIndex = readFileSync(join(DIST, 'index.html'), 'utf8')

// 根路径必须是门户首页（Vue 挂载点），而不是文档站
if (!distIndex.includes('<div id="app"></div>')) {
  fail('根路径不是门户首页——index.html 可能被文档站覆盖了')
}
console.log('  ✓ 根路径是门户首页')

// 文档页必须还在
const mustHave = [
  'guide/quick-start.html',
  'charts/bar.html',
  'api/option.html',
  '404.html',
]
for (const f of mustHave) {
  if (!existsSync(join(DIST, f))) {
    fail(`文档页缺失：${f}`)
  }
}
console.log(`  ✓ 文档页完好（抽查 ${mustHave.length} 个）`)

// 首页引用的资源必须都能找到
const refs = [...distIndex.matchAll(/(?:src|href)="\.?\/?(assets\/[^"]+)"/g)].map(
  (m) => m[1]
)
const missing = []
for (const ref of new Set(refs)) {
  if (!existsSync(join(DIST, ref.replace(/\//g, '\\')))) missing.push(ref)
}
if (missing.length) {
  fail(`首页引用的资源缺失：\n    ${missing.join('\n    ')}`)
}
console.log(`  ✓ 首页资源全部就位（${new Set(refs).size} 个）`)

// 统计
function countHtml(dir) {
  let n = 0
  for (const name of readdirSync(dir)) {
    const p = join(dir, name)
    if (statSync(p).isDirectory()) n += countHtml(p)
    else if (name.endsWith('.html')) n++
  }
  return n
}

console.log(`\n${ok('组装完成')} — HTML 页面共 ${countHtml(DIST)} 个`)
console.log(dim(`  发布目录：${DIST}`))
