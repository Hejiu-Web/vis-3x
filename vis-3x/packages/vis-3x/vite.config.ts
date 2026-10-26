import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'
import { fileURLToPath, URL } from 'node:url'
import { resolve } from 'node:path'
import { readFileSync } from 'node:fs'

const root = fileURLToPath(new URL('.', import.meta.url))

/** 读取自身 package.json，用于注入版本号（构建期替换 __VERSION__） */
const pkg = JSON.parse(readFileSync(resolve(root, 'package.json'), 'utf8')) as {
  version: string
}

/** 子路径入口（对应 package.json 的 exports 字段） */
const subEntries = ['core', 'charts', 'components', 'composables', 'types', 'utils', 'adapters', 'presets']

/** 子入口的 input 映射 */
const subInputs = Object.fromEntries(
  subEntries.map((name) => [name, resolve(root, `src/${name}/index.ts`)])
)

/** 共享的 external 声明 */
const external = ['vue', 'three', /^three\/.*/]

const assetFileNames = (assetInfo: { names?: string[]; name?: string }): string => {
  const name = assetInfo.names?.[0] ?? assetInfo.name ?? ''
  return name.endsWith('.css') ? 'style.css' : 'assets/[name][extname]'
}

/**
 * 构建期替换的常量
 *
 * `__VERSION__` 在 `src/index.ts` 中以字面量形式出现，
 * 如果不替换，使用者拿到的 `Vis3x.version` 就是字符串 "__VERSION__"。
 */
const define = {
  __VERSION__: JSON.stringify(pkg.version),
}

const terserOptions = {
  compress: {
    // 保留 console.warn / console.error，便于使用者排错
    drop_console: false,
    drop_debugger: true,
    pure_funcs: ['console.debug'],
  },
  format: { comments: false },
}

/**
 * 多入口构建配置
 *
 * 产出：
 * - dist/index.js / index.cjs                主入口（ESM + CJS，支持 tree-shaking 与按需引入）
 * - dist/<name>/index.{js,cjs}               子路径入口（core / charts / ...）
 * - dist/style.css                           样式（需使用者手动引入）
 *
 * 为什么没有 UMD：
 * UMD 需要把 `three` 映射到全局变量 `THREE`，但 three 自 0.150 起已是纯 ESM 包，
 * 官方不再提供 `build/three.min.js` 这类浏览器全局构建。任何 UMD 产物都无法在
 * 真实浏览器里拿到可用的全局 THREE，只会得到一个空对象并抛出
 * `WebGLRenderer is not a constructor`。因此这里只发布 ESM + CJS。
 *
 * 为什么关掉 sourcemap：
 * 发布包里不含 `src/`，sourcemap 指向的源码在安装后并不存在，属于纯体积负担
 * （实测占打包体积的 75% 以上）。排查问题请以仓库源码为准。
 */
export default defineConfig({
  plugins: [vue()],
  define,
  resolve: {
    alias: {
      '@': resolve(root, 'src'),
    },
  },
  build: {
    outDir: 'dist',
    emptyOutDir: true,
    target: 'es2019',
    cssCodeSplit: false,
    sourcemap: false,
    minify: 'terser',
    terserOptions,
    rollupOptions: {
      external,
      // 关键：保留入口的导出签名
      // 多入口 + 库模式下，Rollup 默认会把「未被静态引用」的 re-export 摇掉，
      // 导致 dist/index.js 只剩副作用导入、所有具名导出丢失。
      preserveEntrySignatures: 'strict',
      input: {
        index: resolve(root, 'src/index.ts'),
        ...subInputs,
      },
      output: [
        /* ------------------------------ ESM ------------------------------ */
        {
          format: 'es',
          exports: 'named',
          dir: 'dist',
          entryFileNames: (chunkInfo) =>
            chunkInfo.name === 'index' ? 'index.js' : `${chunkInfo.name}/index.js`,
          chunkFileNames: 'chunks/[name]-[hash].js',
          assetFileNames,
        },
        /* ------------------------------ CJS ------------------------------ */
        {
          format: 'cjs',
          exports: 'named',
          dir: 'dist',
          entryFileNames: (chunkInfo) =>
            chunkInfo.name === 'index' ? 'index.cjs' : `${chunkInfo.name}/index.cjs`,
          chunkFileNames: 'chunks/[name]-[hash].cjs',
          assetFileNames,
        },
      ],
    },
  },
})
