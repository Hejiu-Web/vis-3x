import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'
import { fileURLToPath, URL } from 'node:url'

export default defineConfig({
  /**
   * 部署基准路径
   *
   * GitHub Pages 项目站点部署在 `https://<user>.github.io/<repo>/` 下，
   * 资源必须带上 `/vis-3x/` 前缀，否则线上会全部 404。
   * 开发时保持 `/`，构建时由环境变量注入。
   *
   * 用法：PLAYGROUND_BASE=/vis-3x/playground/ pnpm build
   */
  base: process.env.PLAYGROUND_BASE ?? '/',
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
