import { createApp } from 'vue'
import App from './App.vue'
import Vis3x from 'vis-3x'
import 'vis-3x/style.css'
import './style.css'

/**
 * 演示站点入口
 *
 * 这里完全以「第三方使用者」的方式引入 vis-3x：
 * - 从包名导入（由 vite alias 指向库源码，便于开发调试）
 * - 使用 app.use 全局注册
 * - 开启 extraCharts，注册内置的示例扩展图表
 */
createApp(App)
  .use(Vis3x, {
    extraCharts: true,
    // 也可以在这里传入全局主题：
    // theme: themes.blue,
  })
  .mount('#app')
