import { defineConfig } from 'vitepress'
import { REPO_URL, PLAYGROUND_URL, BASE_PATH } from './site-config'
import { vis3xAlias } from '../../scripts/resolve-vis3x.mjs'

export default defineConfig({
  title: 'vis-3x',
  description:
    'vis-3x — 基于 Vue 3 + TypeScript + Three.js 的 3D 数据可视化图表库。支持 Vue 组件、组合式 API 与纯 JavaScript，并提供 ECharts 风格的灵活扩展能力。',
  lang: 'zh-CN',
  base: BASE_PATH,
  cleanUrls: true,
  lastUpdated: true,
  ignoreDeadLinks: true,

  // 文档里内嵌的 <LiveChart> 需要真正 import vis-3x
  vite: {
    resolve: { alias: vis3xAlias() },
    // 图表用到 Three.js，预打包避免 dev 时反复优化
    optimizeDeps: { include: ['vis-3x', 'three'] },
  },

  head: [
    ['link', { rel: 'icon', href: '/favicon.svg' }],
    ['meta', { name: 'theme-color', content: '#0a0f1c' }],
    ['meta', { property: 'og:type', content: 'website' }],
    ['meta', { property: 'og:title', content: 'vis-3x · 3D 图表库' }],
    [
      'meta',
      {
        property: 'og:description',
        content: '基于 Vue 3 + TypeScript + Three.js 的 3D 数据可视化图表库',
      },
    ],
  ],

  themeConfig: {
    logo: '/logo.svg',
    siteTitle: 'vis-3x',

    nav: [
      { text: '指南', link: '/guide/introduction', activeMatch: '^/guide/' },
      { text: '图表', link: '/charts/bar', activeMatch: '^/charts/' },
      { text: '自定义图表', link: '/custom/define-chart', activeMatch: '^/custom/' },
      { text: 'API', link: '/api/option', activeMatch: '^/api/' },
      {
        text: '相关链接',
        items: [
          { text: '在线演示 Playground', link: PLAYGROUND_URL },
          { text: '更新日志', link: '/changelog' },
          { text: '许可证', link: '/license' },
        ],
      },
    ],

    sidebar: {
      '/guide/': [
        {
          text: '开始使用',
          items: [
            { text: '简介', link: '/guide/introduction' },
            { text: '安装', link: '/guide/installation' },
            { text: '快速开始', link: '/guide/quick-start' },
            { text: '四种使用方式', link: '/guide/usage-modes' },
            { text: '纯 JavaScript 使用', link: '/guide/javascript' },
            { text: '配置速查', link: '/guide/cheatsheet' },
          ],
        },
        {
          text: '核心概念',
          items: [
            { text: '配置项结构', link: '/guide/option-structure' },
            { text: '坐标系与网格', link: '/guide/coordinate-system' },
            { text: '主题与配色', link: '/guide/theme' },
            { text: '动画与过渡', link: '/guide/animation' },
            { text: '视角交互', link: '/guide/interaction' },
            { text: '事件系统', link: '/guide/events' },
            { text: '导出图片', link: '/guide/export' },
            { text: '性能优化', link: '/guide/performance' },
          ],
        },
        {
          text: '进阶',
          items: [
            { text: '架构', link: '/guide/architecture' },
            { text: '从 ECharts 迁移', link: '/guide/migrate-from-echarts' },
            { text: 'ECharts 配置适配器', link: '/guide/echarts-adapter' },
            { text: '常见问题', link: '/guide/faq' },
          ],
        },
      ],

      '/charts/': [
        {
          text: '笛卡尔坐标系',
          items: [
            { text: '柱状图 bar3D', link: '/charts/bar' },
            { text: '折线图 line3D', link: '/charts/line' },
            { text: '面积图 area3D', link: '/charts/area' },
            { text: '散点图 scatter3D', link: '/charts/scatter' },
            { text: '曲面图 surface3D', link: '/charts/surface' },
            { text: '热力图 heatmap3D', link: '/charts/heatmap' },
          ],
        },
        {
          text: '非笛卡尔坐标系',
          items: [
            { text: '饼图 pie3D', link: '/charts/pie' },
            { text: '雷达图 radar3D', link: '/charts/radar' },
            { text: '漏斗图 funnel3D', link: '/charts/funnel' },
            { text: '仪表盘 gauge3D', link: '/charts/gauge' },
          ],
        },
        {
          text: '扩展示例图表',
          items: [
            { text: '总览', link: '/charts/extra' },
            { text: '棒棒糖图 lollipop3D', link: '/charts/lollipop' },
            { text: '气泡图 bubble3D', link: '/charts/bubble' },
            { text: '柱线组合图 barLine3D', link: '/charts/bar-line' },
            { text: '金字塔图 pyramid3D', link: '/charts/pyramid' },
            { text: '多环进度图 ringProgress3D', link: '/charts/ring-progress' },
            { text: '阶梯地形图 stepTerrain3D', link: '/charts/step-terrain' },
          ],
        },
      ],

      '/custom/': [
        {
          text: '自定义图表',
          items: [
            { text: '概览', link: '/custom/' },
            { text: 'defineChart 函数式定义', link: '/custom/define-chart' },
            { text: 'extendChart 继承改写', link: '/custom/extend-chart' },
            { text: 'registerChart 注册类', link: '/custom/register-chart' },
            { text: '渲染上下文 ctx', link: '/custom/render-context' },
            { text: '插件系统', link: '/custom/plugins' },
            { text: '完整实战案例', link: '/custom/full-example' },
          ],
        },
      ],

      '/api/': [
        {
          text: 'API 参考',
          items: [
            { text: '配置项 Option', link: '/api/option' },
            { text: '系列 Series', link: '/api/series' },
            { text: '坐标轴 Axis', link: '/api/axis' },
            { text: '样式 Style', link: '/api/style' },
            { text: '光照与环境', link: '/api/environment' },
            { text: '实例方法', link: '/api/instance' },
            { text: '事件列表', link: '/api/events' },
            { text: '类型定义', link: '/api/types' },
          ],
        },
      ],
    },

    outline: {
      level: [2, 3],
      label: '本页目录',
    },

    docFooter: {
      prev: '上一篇',
      next: '下一篇',
    },

    lastUpdated: {
      text: '最后更新于',
      formatOptions: { dateStyle: 'short', timeStyle: 'short' },
    },

    returnToTopLabel: '回到顶部',
    sidebarMenuLabel: '目录',
    darkModeSwitchLabel: '主题',
    lightModeSwitchTitle: '切换到浅色模式',
    darkModeSwitchTitle: '切换到深色模式',

    search: {
      provider: 'local',
      options: {
        translations: {
          button: {
            buttonText: '搜索文档',
            buttonAriaLabel: '搜索文档',
          },
          modal: {
            noResultsText: '无法找到相关结果',
            resetButtonTitle: '清除查询条件',
            footer: {
              selectText: '选择',
              navigateText: '切换',
              closeText: '关闭',
            },
          },
        },
      },
    },

    footer: {
      message: '基于 MIT 许可证发布 · 本项目为独立实现',
      copyright: 'Copyright © 2025 vis-3x',
    },

    socialLinks: [{ icon: 'github', link: REPO_URL }],
  },

  markdown: {
    theme: {
      light: 'github-light',
      dark: 'github-dark',
    },
    lineNumbers: true,
  },
})
