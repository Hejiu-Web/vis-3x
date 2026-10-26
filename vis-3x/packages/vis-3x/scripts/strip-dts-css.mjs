/**
 * 从生成的 .d.ts 中移除「样式文件副作用导入」
 *
 * 为什么需要：
 * `src/index.ts` 里有一行 `import './styles/index.css'`，它的作用是让
 * Vite 把样式抽取成 `dist/style.css`。但 `vue-tsc --emitDeclarationOnly`
 * 会把**同一行**也写进 `dist/index.d.ts`。
 *
 * 后果：
 * - 使用 `moduleResolution: "bundler"` 时，TS 会在包里找 `styles/index.css.d.ts`，
 *   找不到就报 `TS2307: Cannot find module './styles/index.css'`；
 * - 开了 `noUncheckedSideEffectImports` 的项目必然报错。
 *
 * 处理：
 * 声明文件里不需要这条副作用导入，直接删掉。`.css` 文件本身仍然由
 * `dist/style.css` 提供，使用者通过 `import 'vis-3x/style.css'` 引入。
 */
import { readdirSync, readFileSync, statSync, writeFileSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const here = dirname(fileURLToPath(import.meta.url))
const distDir = resolve(here, '..', 'dist')

/** 匹配 `import './x.css';` / `import "./x.css"` 形式的副作用导入 */
const CSS_IMPORT_RE = /^\s*import\s+['"][^'"]+\.css['"];?\s*$/gm

/** 递归收集所有 .d.ts */
function collectDts(dir) {
  const out = []
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry)
    if (statSync(full).isDirectory()) out.push(...collectDts(full))
    else if (entry.endsWith('.d.ts')) out.push(full)
  }
  return out
}

let touched = 0
for (const file of collectDts(distDir)) {
  const before = readFileSync(file, 'utf8')
  if (!CSS_IMPORT_RE.test(before)) {
    CSS_IMPORT_RE.lastIndex = 0
    continue
  }
  CSS_IMPORT_RE.lastIndex = 0
  const after = before.replace(CSS_IMPORT_RE, '')
  if (after !== before) {
    writeFileSync(file, after, 'utf8')
    touched++
    console.log(`  ✓ 已从 ${file.replace(distDir + '\\', '').replace(distDir + '/', '')} 移除 CSS 导入`)
  }
}

console.log(
  touched
    ? `\n[dts] 共清理 ${touched} 个声明文件\n`
    : '\n[dts] 无需清理（声明文件中没有 CSS 副作用导入）\n'
)
