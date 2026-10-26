/**
 * vis-3x 文档站自定义主题
 *
 * 目标：把文档站做成与库本身同一视觉语言（dark tech / 数据可视化），
 * 而不是默认的 VitePress 绿。
 *
 * 另外注册 `LiveChart` 组件，让任意 Markdown 页面都能内嵌真实可交互的图表。
 */
import DefaultTheme from 'vitepress/theme'
import type { Theme } from 'vitepress'
import LiveChart from './LiveChart.vue'
import './custom.css'

// 注意：扩展示例图表的注册放在 LiveChart.vue 里，不在这里。
//
// 早期版本在这里 `import { useExtraCharts } from 'vis-3x/presets'`，
// 而 LiveChart.vue 用 `import { createChart } from 'vis-3x'`。
// 两个不同的入口会被打包成两份模块，各自持有独立的注册表 Map，
// 结果就是注册生效了但 createChart 读不到——控制台报「未知的图表类型」。
//
// 现在统一由 LiveChart.vue 从包根导入并注册，保证是同一个模块实例。

export default {
  extends: DefaultTheme,
  enhanceApp({ app }) {
    // 全局注册，Markdown 里可直接写 <LiveChart :option="..." />
    app.component('LiveChart', LiveChart)
  },
} satisfies Theme
