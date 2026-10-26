import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'
import { fileURLToPath, URL } from 'node:url'

export default defineConfig({
  plugins: [vue()],
  resolve: {
    alias: [
      // 样式：直接指向源码 CSS（开发模式下没有 dist/style.css）
      {
        find: /^vis-3x\/style\.css$/,
        replacement: fileURLToPath(
          new URL('../../packages/vis-3x/src/styles/index.css', import.meta.url)
        ),
      },
      // 子路径入口：vis-3x/core -> src/core/index.ts
      {
        find: /^vis-3x\/(core|charts|components|composables|types|utils|adapters|presets)$/,
        replacement: fileURLToPath(
          new URL('../../packages/vis-3x/src/$1/index.ts', import.meta.url)
        ),
      },
      // 主入口：开发时直接指向库源码，获得 HMR 与完整类型
      {
        find: /^vis-3x$/,
        replacement: fileURLToPath(
          new URL('../../packages/vis-3x/src/index.ts', import.meta.url)
        ),
      },
    ],
  },
  server: {
    port: 5178,
    open: true,
  },
})
