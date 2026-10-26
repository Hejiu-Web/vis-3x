/**
 * 为生成的 .d.ts 补全相对导入的显式扩展名
 *
 * 问题背景
 * ---------
 * `vue-tsc --emitDeclarationOnly` 产出的声明文件里，相对路径是**不带扩展名**的：
 *
 *   export * from './style';
 *   export { Engine } from './Engine';
 *
 * 这在使用 `moduleResolution: "bundler"` 的项目里没问题，但在
 * `moduleResolution: "node16"` / `"nodenext"` 下是**硬错误**：
 *
 *   error TS2834: Relative import paths need explicit file extensions in
 *   ECMAScript imports when '--moduleResolution' is 'node16' or 'nodenext'.
 *
 * 而且因为声明文件属于依赖包，`skipLibCheck` 也挡不住这类「解析失败」错误
 * （skipLibCheck 只跳过类型检查，不跳过模块解析）。
 * TS 5.6 也没有 `rewriteRelativeImportExtensions` 这类自动改写开关。
 *
 * 解决办法
 * ---------
 * 构建后把所有 `.d.ts` 里的相对导入改写成带 `.js` 扩展名的形式：
 *
 *   from './Engine'   →  from './Engine.js'
 *
 * 这是 ESM 的规范写法（指向编译产物，TS 会自动映射到同名 `.d.ts`），
 * 对 `bundler` 解析模式同样兼容，两边都能过。
 */
import { readdirSync, readFileSync, statSync, writeFileSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const here = dirname(fileURLToPath(import.meta.url))
const distDir = resolve(here, '..', 'dist')
/**
 * 匹配声明文件里的相对模块说明符
 *
 * 覆盖：
 * - `import ... from './x'`
 * - `import type ... from './x'`
 * - `export ... from './x'`
 * - `export type ... from './x'`
 * - `import('./x')` 动态类型导入
 *
 * 只处理以 `./` 或 `../` 开头、且**没有**扩展名的说明符。
 */
const RELATIVE_SPECIFIER_RE =
  /((?:from\s+|import\s*\(\s*)['"])(\.{1,2}\/[^'"]*?)(['"])/g

/** 判断说明符是否已经带扩展名 */
function hasExtension(spec) {
  // 只看最后一段
  const last = spec.slice(spec.lastIndexOf('/') + 1)
  return last.includes('.')
}

/** 递归收集 .d.ts */
function collectDts(dir) {
  const out = []
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry)
    if (statSync(full).isDirectory()) out.push(...collectDts(full))
    else if (entry.endsWith('.d.ts')) out.push(full)
  }
  return out
}

let changedFiles = 0
let changedSpecifiers = 0

for (const file of collectDts(distDir)) {
  const before = readFileSync(file, 'utf8')
  const after = before.replace(RELATIVE_SPECIFIER_RE, (match, pre, spec, post) => {
    if (hasExtension(spec)) return match
    changedSpecifiers++
    return `${pre}${spec}.js${post}`
  })
  if (after !== before) {
    writeFileSync(file, after, 'utf8')
    changedFiles++
  }
}

console.log(
  changedFiles
    ? `[dts] 已为 ${changedFiles} 个声明文件中的 ${changedSpecifiers} 处相对导入补全 .js 扩展名\n`
    : '[dts] 无需补全扩展名\n'
)

/* -------------------------------------------------------------------------- */
/*                  生成 dist/style.css.d.ts（样式子路径的类型）               */
/* -------------------------------------------------------------------------- */
/**
 * 为什么需要这个文件，以及为什么是这种写法
 * ----------------------------------------
 * `package.json` 的 exports 里有 `"./style.css": "./dist/style.css"`。
 * 使用者写 `import 'vis-3x/style.css'` 时，TypeScript 会为这个说明符
 * 找一个同目录同名的声明文件（`dist/style.css.d.ts`）。
 *
 * 找不到会报：
 *   error TS2307: Cannot find module 'vis-3x/style.css'
 *     or its corresponding type declarations.
 *
 * ⚠️ 关键在于 TS 5.6 的 `noUncheckedSideEffectImports`（新项目默认建议开启）：
 * 即便有 `style.css.d.ts`，如果它**只是**一个空模块，TS 仍会因为
 * "该模块没有可解析的类型形状" 而报 TS2307。
 * 所以这里必须写成真正的**模块声明**（而不是空文件）。
 *
 * 注意：本文件必须保持在 `dist/` 里与 `style.css` 同目录同名，
 * 并且会被 `files` 白名单自动带上。
 */
const styleDts = `/**
 * vis-3x — 样式文件（\`vis-3x/style.css\`）的模块声明
 *
 * 仅用于让 TypeScript 接受这条副作用导入，运行时由打包器处理成真实的 CSS。
 * 与 \`vite/client\` 对 \`*.css\` 的声明保持一致的形状（默认导出一个字符串）。
 */
declare const css: string
export default css
`
const styleDtsPath = join(distDir, 'style.css.d.ts')
writeFileSync(styleDtsPath, styleDts, 'utf8')
console.log('[dts] 已生成 dist/style.css.d.ts（样式子路径类型）\n')
