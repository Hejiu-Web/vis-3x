# 更新日志

本项目遵循 [语义化版本](https://semver.org/lang/zh-CN/) 与 [Keep a Changelog](https://keepachangelog.com/zh-CN/1.1.0/) 规范。

---

## [0.1.0] — 首个公开版本

### 新增

**10 种内置 3D 图表**

- 笛卡尔坐标系：`bar3D` 柱状图、`line3D` 折线图、`area3D` 面积图、`scatter3D` 散点图、`surface3D` 曲面图、`heatmap3D` 热力图
- 非笛卡尔坐标系：`pie3D` 饼图、`radar3D` 雷达图、`funnel3D` 漏斗图、`gauge3D` 仪表盘

**6 个扩展示例图表**

通过 `useExtraCharts()` 注册，全部使用公开 API 实现：

- `lollipop3D` 棒棒糖图
- `bubble3D` 气泡图
- `barLine3D` 柱线组合图（`extendChart` 实现）
- `pyramid3D` 金字塔图
- `ringProgress3D` 多环进度图
- `stepTerrain3D` 阶梯地形图

**四种使用方式**

- Vue 3 组件（全局注册或按需引入）
- 组合式 API（`useVisChart`）
- 命令式 API（`createChart`，不依赖 Vue）
- CDN（UMD 产物）

**自定义图表 API**

- `defineChart` — 函数式定义，只写一个 `render` 函数
- `extendChart` — 继承内置图表，追加内容
- `registerChart` — 注册完整的 `ChartBase` 子类
- `useChartPlugin` — 插件系统，打包分发

**渲染能力**

- PBR 材质（`standard` / `physical` / `lambert` / `basic` / `toon` 五种预设）
- 三点光照 + 可配置阴影
- 地面网格、背景墙、阴影承接面
- 顶点色映射与连续色带
- HTML 覆盖层标签（CSS2D），文字始终清晰
- 按需渲染，静止时停止重绘
- 资源自动登记与释放，材质按参数缓存

**动画系统**

- 统一的过渡计划（`TransitionPlan`），所有图表共用
- 入场动画与数据更新动画分离，更新时使用更短时长
- 逐项错峰（`stagger`）
- 10 种缓动函数
- 自定义图表通过 `ctx.transition` 使用同一套系统

**交互**

- 相机交互与数据交互分离
- 三种交互模式：`free` / `rotate` / `fixed`
- 射线拾取、悬停高亮、点击事件
- 可配置的俯仰角、方位角、缩放范围限制

**主题**

- 5 套预设主题：`dark` / `light` / `blue` / `warm` / `mono`
- 可自定义调色板与语义色
- CSS 变量覆盖 HTML 覆盖层样式

**工程化**

- TypeScript 完整类型声明，`series` 是可辨识联合
- ESM + CJS + UMD 三种产物
- 多入口导出：`/core` `/charts` `/components` `/composables` `/types` `/utils` `/adapters` `/presets`
- `three` 与 `vue` 作为 peer 依赖，不重复打包

**其他**

- `exportImage()` 导出 PNG，支持多倍分辨率与标签合成
- ECharts 配置适配器（`fromEchartsLikeOption`）
- 资源管理器，正确释放 WebGL 资源
- 尊重 `prefers-reduced-motion`（需使用方自行判断）

### 修复

- 柱状图柱子底部与地面平面不贴合的问题
  - 移除了多余的 `geometry.translate(0, height / 2, 0)`——`rotateX(-90°)` 后几何体底部已在局部 `y = 0`
  - `mesh.position.y` 从 `y + height / 2` 改为 `y`，避免二次抬升
  - 顶盖位置从 `height / 2` 修正为 `height`
  - 生长动画改用 `scale.y`，底部固定、顶部上升

- 仪表盘各元素不在同一平面的问题
  - 环带在 XY 平面构建，而刻度、指针、标签此前按 XZ 平面布局，导致错位
  - 现统一为：所有元素在 XY 平面构建，沿 **+Z** 挤出厚度
  - 指针改为绕 Z 轴旋转，轴帽改为沿 Z 轴的圆柱
  - 分组整体后移 `depth / 2`，使厚度以原点为中心

- 数据更新时没有过渡动画的问题
  - 此前各图表用 `hasAnimated` 标志锁定，只在首次渲染播放动画
  - 引入 `TransitionPlan` 与渲染计数，更新时同样播放过渡（时长更短）

- `TransitionPlan.enabled` 的自锁死问题
  - 该 getter 要求「已登记目标」，但在登记前判断永远为 `false`
  - 新增 `animationsEnabled`（只看配置）用于守卫登记代码

- 漏斗图 `shape: 'pyramid'` 无效的问题
  - `bottomWidth` 的三元表达式两个分支代码完全相同
  - 现在 `pyramid` 会让每层收成三角形

- 棒棒糖图的几何尺寸硬编码问题
  - 新增 `stemRadius` 与 `ballRadius` 字段（保留原默认值 `0.055` / `0.22`）

- 多环进度图超过 6 项时静默丢数据的问题
  - 此前环宽固定为 `0.34`、间隙固定 `0.12`，半径递减 `0.46`，
    第 7 项起半径小于环宽被整环跳过——不报错、不出图、不进 tooltip
  - 现在环宽与间隙按数据量自适应（`slot = usable / count`），
    所有数据项都会绘制；环宽下限 `0.14`，数据特别多时才会细到不可见

- 金字塔图只渲染第一个系列的问题
  - 此前渲染函数只取 `ctx.series[0]`，传入的第二个及之后的系列无任何输出
  - 现在每个系列画一座金字塔，沿 Z 轴并排居中（间距 `depth × 1.35`），
    动画错峰索引把系列也计入

- 图表用鼠标交互失效的问题
  - `OrbitControls` 此前绑定在标签层 DOM 上，而该层是 `pointer-events: none`
  - 改为绑定到 canvas

- `fixed` 模式下视角仍会漂移的问题
  - 阻尼惯性导致松手后继续移动
  - `fixed` 模式现在会关闭 `enableDamping`

- 非笛卡尔图表绘制多余坐标轴与网格的问题
  - `showCoordinate` 现在会被正确解析并传递给场景构建

- 多入口构建被 tree-shaking 清空的问题
  - 开启 `preserveEntrySignatures: 'strict'`，UMD 使用独立构建流程

---

## 关于版本号

`0.x` 阶段 API 可能发生不兼容变更，但会遵循以下原则：

- 破坏性变更会提升次版本号（`0.1.x` → `0.2.0`）
- 新增功能提升修订号（`0.1.0` → `0.1.1`）
- 每次发版都会在本文档记录变更

`1.0.0` 发布后遵循标准语义化版本。

---

## 反馈

<script setup>
import { REPO_URL } from './.vitepress/site-config'
</script>

- <a :href="REPO_URL + '/issues'">提交 Issue</a>
- <a :href="REPO_URL">查看源码</a>
