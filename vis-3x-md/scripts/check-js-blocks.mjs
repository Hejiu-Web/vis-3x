/**
 * 校验文档里所有 ```js 代码块的语法正确性
 *
 * 用 esbuild 解析（能处理 ESM import/export），
 * 抓出转换脚本可能引入的语法错误。
 */
import { readFileSync, readdirSync, statSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import { createRequire } from 'node:module'

const require = createRequire(import.meta.url)
const esbuild = require('esbuild')

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..')
const DOCS = join(ROOT, 'docs')

/** 递归收集 md 文件 */
function walk(dir, out = []) {
  for (const name of readdirSync(dir)) {
    const p = join(dir, name)
    if (statSync(p).isDirectory()) {
      if (name === 'public' || name.startsWith('.')) continue
      walk(p, out)
    } else if (name.endsWith('.md')) {
      out.push(p)
    }
  }
  return out
}

/** 提取 ```js 块 */
function jsBlocks(src) {
  const out = []
  const re = /```js(?:\s+\[[^\]]*\])?\r?\n([\s\S]*?)```/g
  let m
  while ((m = re.exec(src))) {
    out.push({ code: m[1], index: m.index })
  }
  return out
}

/** 行号 */
function lineOf(src, idx) {
  return src.slice(0, idx).split('\n').length
}

let total = 0
let bad = 0

for (const file of walk(DOCS)) {
  const src = readFileSync(file, 'utf8')
  const blocks = jsBlocks(src)
  for (const b of blocks) {
    total++
    try {
      esbuild.transformSync(b.code, { loader: 'js', format: 'esm' })
    } catch (e) {
      bad++
      const rel = file.replace(ROOT + '\\', '').replace(ROOT + '/', '')
      const err = (e.errors?.[0]?.text ?? e.message ?? '').toString()
      const loc = e.errors?.[0]?.location
      console.log(`  ★ ${rel}:${lineOf(src, b.index)}`)
      console.log(`     ${err}${loc ? ` (块内第 ${loc.line} 行)` : ''}`)
    }
  }
}

console.log(`\n共校验 ${total} 个 JS 代码块，语法错误 ${bad} 个`)
process.exitCode = bad > 0 ? 1 : 0
