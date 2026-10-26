import { createApp } from 'vue'
import App from './App.vue'
import Vis3x from 'vis-3x'
import 'vis-3x/style.css'
import './style.css'

/**
 * 门户首页入口
 *
 * 以「第三方使用者」的方式引入 vis-3x，
 * 并开启 extraCharts 注册 6 个示例扩展图表。
 */
createApp(App)
  .use(Vis3x, {
    extraCharts: true,
    theme: {
      palette: ['#4f8cff', '#22d3ee', '#34d399', '#a78bfa', '#fbbf24', '#fb7185'],
    },
  })
  .mount('#app')
