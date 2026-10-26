# Changelog

本文件记录 `vis-3x` 的重要变更。

格式参考 [Keep a Changelog](https://keepachangelog.com/zh-CN/1.1.0/)，
版本号遵循 [语义化版本](https://semver.org/lang/zh-CN/)。

---

## [0.1.0] - 初始版本

### 新增

**10 种内置 3D 图表**

- `bar3D` — 柱状图：多系列、堆叠、圆角、按值渐变、顶盖高光
- `line3D` — 折线图：Catmull-Rom 平滑、垂幕纵深效果、数据点
- `area3D` — 面积图：带厚度的实体面片、顶部描边
- `pie3D` — 饼图 / 环形图 / 南丁格尔玫瑰图：逐块高度、选中外移、中心总量
- `scatter3D` — 散点图：`[x,y]` / `[x,y,z]` 坐标、多种 symbol、尺寸映射
- `surface3D` — 曲面图：顶点色高度映射、线框叠加、marching squares 等高线、侧壁
- `radar3D` — 雷达图：多层立体蛛网、分割区域填充
- `funnel3D` — 漏斗图 / 金字塔图
- `gauge3D` — 仪表盘：环带、指针、刻度、中心数值
- `heatmap3D` — 热力图：高度与颜色双映射

**灵活的图表扩展 API**

- `registerChart(type, Ctor)` — 注册已有图表类，支持类型别名
- `defineChart({ type, render })` — 函数式定义图表，无需继承类
- `extendChart(base, { type, beforeRender, afterRender })` — 继承并改写内置图表
- `useChartPlugin(plugin)` — 插件系统，支持跨图表复用能力，幂等安装
- `ChartRenderContext` — 渲染上下文，提供坐标映射、几何体、材质、标签、交互等能力

**三套使用方式**

- Vue 组件：`<VisBar3D>` 等 11 个语义化组件 + `<VisChart>` 通用组件
- 组合式 API：`useVisChart()`
- 纯 JS 命令式：`createChart()`（不依赖 Vue 运行时）

**完整的 TypeScript 类型**

- `Vis3xOption` 顶层配置类型
- 系列类型可辨识联合，`series[].type` 自动收窄
- 事件负载类型推导 `ChartEventMap`
- 导出 35+ 个 `.d.ts` 声明文件

**渲染能力**

- 专业三点光照 + ACES 色调映射 + PCF 软阴影
- 按需渲染：场景静止时停止重绘
- 资源管理器：几何体/材质/贴图统一登记释放，材质参数化缓存
- CSS2D 数据标签：多行、格式化、自动避让
- 相机自适应、射线拾取、悬停高亮、提示框、可点击图例
- 导出 PNG（支持缩放与背景色）

**工程化**

- pnpm workspace monorepo 结构
- 多入口构建：ESM + CJS，8 个子路径按需导入
- 5 套主题预设：`dark` / `light` / `blue` / `warm` / `mono`
- ECharts 配置适配器 `fromEchartsLikeOption()`
- 6 个扩展图表示例：棒棒糖图、气泡图、柱线组合、金字塔、多环进度、阶梯地形

[0.1.0]: https://github.com/Hejiu-Web/vis-3x/releases/tag/v0.1.0
