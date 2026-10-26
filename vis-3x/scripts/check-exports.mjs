/**
 * 校验 package.json 的 exports / main / module / types 等字段
 * 所指的文件是否都真实存在于 dist 中。
 *
 * 在 CI 中运行，避免「发布出去的包无法被正确解析」这类问题。
 */
import { readFileSync, existsSync } from 'node:fs'
import { dirname, resolve, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const pkgPath = join(root, 'packages', 'vis-3x', 'package.json')
const pkg = JSON.parse(readFileSync(pkgPath, 'utf8'))
const pkgDir = dirname(pkgPath)

let failures = 0

/** 解析 ./dist/xxx 形式的包内路径 */
const resolveInPackage = (p) => resolve(pkgDir, p)

function check(label, relPath) {
  const abs = resolveInPackage(relPath)
  const ok = existsSync(abs)
  if (!ok) {
    console.error(`  ✗ ${label} -> ${relPath}`)
    failures++
  } else {
    console.log(`  ✓ ${label} -> ${relPath}`)
  }
}

console.log(`\n校验 ${pkg.name}@${pkg.version} 的入口路径\n`)

/* ------------------------- 顶层字段 ------------------------- */
for (const field of ['main', 'module', 'types', 'unpkg', 'jsdelivr']) {
  if (pkg[field]) check(field, pkg[field])
}

/* ------------------------- exports 字段 ------------------------- */
console.log('\nexports:')

const walkExports = (value, path) => {
  if (typeof value === 'string') {
    check(path, value)
    return
  }
  if (value && typeof value === 'object') {
    for (const [key, sub] of Object.entries(value)) {
      walkExports(sub, key === '.' ? path : `${path}${key === '.' ? '' : key}`)
    }
  }
}

for (const [key, value] of Object.entries(pkg.exports ?? {})) {
  // 跳过通配符条目（如 "./dist/*"）
  if (key.includes('*')) continue
  walkExports(value, key)
}

/* ------------------------- files 字段 ------------------------- */
console.log('\nfiles 字段包含的目录:')
for (const entry of pkg.files ?? []) {
  const abs = resolveInPackage(entry)
  if (entry.includes('*')) continue
  if (existsSync(abs)) {
    console.log(`  ✓ ${entry}`)
  } else {
    // README / CHANGELOG / LICENSE 允许暂缺
    if (/README|CHANGELOG|LICENSE/i.test(entry)) {
      console.log(`  ~ ${entry}（可选文件，暂未提供）`)
    } else {
      console.error(`  ✗ ${entry}`)
      failures++
    }
  }
}

/* ------------------------- 关键产物检查 ------------------------- */
console.log('\n关键产物:')
const requiredArtifacts = [
  'dist/index.js',
  'dist/index.cjs',
  'dist/index.d.ts',
  'dist/style.css',
]
for (const art of requiredArtifacts) {
  const abs = resolveInPackage(art)
  if (existsSync(abs)) {
    console.log(`  ✓ ${art}`)
  } else {
    console.error(`  ✗ ${art} 缺失`)
    failures++
  }
}

/* ----------------------- 已废弃产物不应再出现 ----------------------- */
console.log('\n已废弃产物:')
const forbiddenArtifacts = [
  // three 自 0.150 起为纯 ESM 包，UMD 产物在真实浏览器里无法工作（详见 vite.config.ts）
  'dist/index.umd.js',
]
for (const art of forbiddenArtifacts) {
  if (existsSync(resolveInPackage(art))) {
    console.error(`  ✗ ${art} 仍存在，应从构建中移除`)
    failures++
  } else {
    console.log(`  ✓ ${art} 已移除`)
  }
}

/* -------------------- package.json 元数据一致性 -------------------- */
console.log('\n元数据:')
const metaChecks = [
  ['unpkg', pkg.unpkg, (v) => v === undefined, 'three 为 ESM-only，不应声明 unpkg'],
  ['jsdelivr', pkg.jsdelivr, (v) => v === undefined, 'three 为 ESM-only，不应声明 jsdelivr'],
  ['sideEffects', pkg.sideEffects, (v) => Array.isArray(v), '应声明 sideEffects'],
  ['author', pkg.author, (v) => !!v, '应声明 author'],
  ['license', pkg.license, (v) => v === 'MIT', '应为 MIT'],
  [
    'files',
    pkg.files,
    (v) => Array.isArray(v) && v.includes('LICENSE'),
    'files 应包含 LICENSE',
  ],
]
for (const [field, value, ok, hint] of metaChecks) {
  if (ok(value)) {
    console.log(`  ✓ ${field}`)
  } else {
    console.error(`  ✗ ${field} 不合规：${hint}`)
    failures++
  }
}

/* ----------------- 声明文件不应含 CSS 副作用导入 ----------------- */
console.log('\n声明文件:')
{
  const dts = resolveInPackage('dist/index.d.ts')
  if (existsSync(dts)) {
    const text = readFileSync(dts, 'utf8')
    if (/^\s*import\s+['"][^'"]+\.css['"]/m.test(text)) {
      console.error('  ✗ dist/index.d.ts 含 CSS 副作用导入（TS 会报 TS2307）')
      failures++
    } else {
      console.log('  ✓ 不含 CSS 副作用导入')
    }
    if (/^\s*\/\/# sourceMappingURL=/m.test(text)) {
      console.error('  ✗ dist/index.d.ts 仍带有 sourceMappingURL（对应 .map 不会随包发布）')
      failures++
    } else {
      console.log('  ✓ 不含悬空 sourceMappingURL')
    }
  }
}

/* ---------------- 构建产物里不应残留版本占位符 ---------------- */
console.log('\n版本注入:')
{
  const entry = resolveInPackage('dist/index.js')
  if (existsSync(entry)) {
    const text = readFileSync(entry, 'utf8')
    if (text.includes('__VERSION__')) {
      console.error('  ✗ dist/index.js 中残留 __VERSION__ 占位符')
      failures++
    } else if (!text.includes(JSON.stringify(pkg.version))) {
      console.error(`  ✗ dist/index.js 中找不到版本号 ${pkg.version}`)
      failures++
    } else {
      console.log(`  ✓ 版本号已注入（${pkg.version}）`)
    }
  }
}

/* ------------------------------ 结果 ------------------------------ */
if (failures > 0) {
  console.error(`\n校验失败：发现 ${failures} 个问题\n`)
  process.exit(1)
}
console.log('\n所有入口路径校验通过\n')
