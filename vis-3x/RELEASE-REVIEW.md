# vis-3x 发布前修复报告

> 审查时间：2026-10-26 · 基线版本：`vis-3x@0.1.0`
> 结论：**已修复全部阻断项，`pnpm preflight` 全绿，可以发布**

---

## 一、发布前状态对比

| 指标 | 修复前 | 修复后 |
|---|---|---|
| 打包解压体积 | 2.94 MB | **552 KB**（−81%） |
| 打包压缩体积 | 854 KB | **169 KB**（−80%） |
| 包内文件数 | 169 | **87** |
| 包内 sourcemap | 82 个（2.22 MB，75%） | **0** |
| `Vis3x.version` | 字面量 `"__VERSION__"` | **`"0.1.0"`** |
| UMD 产物 | 有（生产环境必然报错） | 已移除 |
| `app.use(Vis3x, { theme })` | 不生效 | **生效** |
| `tsc` (node16/NodeNext) | 全部类型声明报 TS2834 | **通过** |
| `import type { Vis3xOption } from 'vis-3x'` | 报 TS2724 | **通过** |
| `import 'vis-3x/style.css'`（严格模式） | 报 TS2307 | **通过** |
| `vite build` 消费者项目 | 未验证 | **通过** |

---

## 二、P0 阻断项（已全部修复）

### 1. UMD 产物在生产环境必然崩溃 ✅

**问题**：`three` 自 0.150 起是纯 ESM 包，官方已移除 `build/three.min.js`。
UMD 构建把 `three` 设为 external 并生成 `global.THREE = global.THREE || {}`，
真实浏览器里拿到的永远是空对象：

```
TypeError: THREE.WebGLRenderer is not a constructor
```

而文档还在教用户 `<script src="https://unpkg.com/three@0.160.0/build/three.min.js">`——
**该文件本身 404**。

**修复**：
- `vite.config.ts` 删除 UMD 分支，只产出 ESM + CJS
- `package.json` 移除 `unpkg` / `jsdelivr` 字段与 `--mode umd` 构建步骤
- `check-exports.mjs` 新增「废弃产物不得存在」的校验
- 文档 3 处（`installation.md` / `javascript.md` / `usage-modes.md`）+
  2 个 README 改为 **import map** 用法，并说明原因

### 2. `defaultTheme` / `defaultPalette` 是死配置 ✅

**问题**：`app.use(Vis3x, { theme, palette })` 写进了 `Vis3x.defaultTheme`，
但 `ChartBase.setOption()` 只读 `option.theme`，**从不去读它**。

**修复**：
- `ChartBase` 新增 `runtimeDefaults` + `setRuntimeDefaultTheme` / `setRuntimeDefaultPalette`
- `setOption()` 改走新增的 `resolveTheme()` / `resolvePalette()`：
  优先级 `option.theme` > 全局默认 > `DEFAULT_PALETTE`
- `Vis3x.install()` 同步写入内核
- `dist-smoke.mjs` 新增第 15 节，**实测三档优先级**

### 3. `version` 永远输出字面量 `"__VERSION__"` ✅

**问题**：源码写死 `version: '__VERSION__'`，`vite.config.ts` 里没有任何替换。

**修复**：
- `vite.config.ts` 读取 `package.json` 注入 `define: { __VERSION__ }`
- 源码新增 `export const VERSION`，用 `typeof __VERSION__ !== 'undefined'` 兜底
  （直接跑源码时回退 `0.0.0-dev`）
- `check-exports.mjs` + `dist-smoke.mjs` 双重校验注入结果

### 4. 打包体积 83% 是垃圾 sourcemap ✅

**问题**：82 个 `.map` 占 2.22 MB；且 `files` 不含 `src/`，
`.d.ts.map` 指向的源码**在安装后根本不存在**。

**修复**：`sourcemap: false`、`declarationMap: false`、
`files` 加 `!dist/**/*.map` 兜底。

### 5. 类型声明在两个关键场景下完全不可用 ✅（**最严重**）

这三条是**真实消费者验证**才发现的，`dist-smoke` 完全抓不到：

| # | 症状 | 根因 | 修复 |
|---|---|---|---|
| 5a | node16/NodeNext 下**所有**类型报 `TS2834` | tsc 生成的 `.d.ts` 相对导入不带扩展名（`from './Engine'`） | 新增 `fix-dts-extensions.mjs`，构建后补 `.js`（184 处 / 45 文件） |
| 5b | `import type { Vis3xOption } from 'vis-3x'` 报 `TS2724` | `export type * from './types'` 被原样写进 `.d.ts`，TS 解析声明文件里的 `export *` 有缺陷 | 改为**逐项显式导出** 77 个类型 |
| 5c | `import 'vis-3x/style.css'` 报 `TS2307` | 严格模式（`noUncheckedSideEffectImports`）下找不到模块声明 | 构建产出 `dist/style.css.d.ts`，并给 exports 加 `types` 条件 |

### 6. CI 里的文档 job 必然失败 ✅

**问题**：`working-directory: ../vis-3x-md` —— GitHub Actions 工作目录固定为仓库根，
`../` 会跑到 runner 家目录之外。`ci.yml` 与 `deploy-docs.yml` 都有这个问题。

**修复**：统一检出到仓库内 `_docs/vis-3x/` 与 `_docs/vis-3x-md/`（两者同级，
正好满足 `resolve-vis3x.mjs` 的要求），并加 `continue-on-error`
避免文档仓库不存在时主库 CI 变红。

### 7. 仓库卫生 ✅

- 删除误存的 `packages/vis-3x.rar`（14.7 MB）
- 新增 `.npmrc`（官方源 / access=public / 认证说明）
- `author` 从字符串改为合法的 `{ name, url }` 对象
- `publishConfig.provenance: true`（配合已有的 `id-token: write`）

---

## 三、P1 功能性问题（已全部修复）

### 8. `VisChartBase` 深度 watch 过度触发 ✅

`computed(() => ({ ...option }))` 每次求值都产生新对象 → 图表整棵重建 + 重播动画。

**修复**：新增 `signatureOf()` 结构签名去抖，内容不变直接 return。

### 9. `setOption` 重建所有标签 DOM ✅

每次更新都 `clearGroup` + 重新 `create`，新元素在下一帧前**停在左上角**且闪动。

**修复**：
- `ChartBase` 新增 `clearSeriesKeepLabels()`，更新路径**保留标签 DOM**
- `LabelManager` 新增 `pruneOrphans()` 清理新数据里已不存在锚点的孤儿标签
- `ChartBase` 新增 `isWithinContent()` 判定锚点是否仍在内容树上

### 10. 悬停引用指向已释放的材质 ✅

`setOption` 重建系列后，`InteractionManager.hovered` 仍指向被 `disposeSubtree()`
释放的网格；下次 `pointerleave` 会对野材质执行 `emissive.setHex()`。

**修复**：新增 `InteractionManager.resetHover()`，`setOption` 在 `clearSeries()` **之前**调用。

### 11. `onChartMounted` 在构造函数里同步调用 ✅

`useDefineForClassFields: true` 下，子类字段在 `super()` 返回后才初始化，
钩子拿到的是**字段全 undefined 的半成品实例**。

**修复**：改 `queueMicrotask` 延迟调用（并带 disposed 检查与 try/catch）。

### 12. `Engine.dispose()` 双重释放 + rAF 常驻空转 + 缓冲保留 ✅

| 子问题 | 修复 |
|---|---|
| 先 `scene.traverse` 手动 dispose，再 `resources.dispose()`，同批资源释放两次 | 删掉 traverse，只保留 `resources.dispose()` |
| `loop()` 无条件续排 rAF，静止时每个图表仍常驻一个 rAF | 改为**按需续排** + `scheduleLoop()` 唤醒机制 |
| `preserveDrawingBuffer` 默认 `true`，显著增加每帧开销 | 默认改 `false`（`exportImage` 同步渲染后立即取图，无需它） |

---

## 四、P2 代码清理（已完成）

| 项 | 处理 |
|---|---|
| `isChartBaseReady()` 导出但从未使用 | 删除 |
| `ChartBase.animationLoopRunning` 只写不读 | 删除 |
| `VisChartBase.buildLegend()` 与内核 `buildLegendItems()` 逻辑重复且已分叉 | 内核新增公开 `getLegendItems()`，组件改为委托 |
| `darkTheme.palette` 与 `DEFAULT_PALETTE` 共享数组引用（用户 push 会污染全局） | 改为 `[...DEFAULT_PALETTE]` |
| `styles/index.css` 首行注释写着旧名 `VisThree` | 改为 `vis-3x` |
| `index.d.ts` 里残留 `import './styles/index.css'` | 新增 `strip-dts-css.mjs` 剥离 |

---

## 五、额外发现并修复（审查中新增）

### 13. `NeutralToneMapping` 在 three 0.160 上报 Rollup 错误 ✅

`(THREE as Record<string, unknown>).NeutralToneMapping` 只是**类型断言**，
Rollup 仍编译成具名访问，在旧版 three 上直接报：

```
"NeutralToneMapping" is not exported by "three.module.js"
```

**修复**：改用 `'NeutralToneMapping' in THREE` 字符串键判断。文档站构建现在完全无警告。

---

## 六、新增的发布保障

### `scripts/verify-consumer.mjs` —— 真实消费者验证

模拟用户 `npm install vis-3x` 的完整链路：

1. `npm pack` 生成真实 tarball，校验必含/禁含文件
2. 建干净项目装 tarball + three + vue
3. `tsc --noEmit` 跑 **两种解析模式**（`bundler` / `node16`），且开启
   `noUncheckedSideEffectImports` —— 覆盖主入口、8 个子路径、样式、Vue 组件、
   `defineChart` ctx、事件负载类型
4. `vite build` 真实打包
5. Node 里跑 ESM `import` 与 CJS `require`

> **这套验证在本次审查中抓出了 3 个 dist-smoke 完全发现不了的类型级阻断问题（5a/5b/5c）。
> 如果只跑原有测试就发版，用户装完包后 TypeScript 会大面积报错。**

### 新增脚本命令

```bash
pnpm preflight          # build + verify + verify:consumer —— 发布前跑这一条
pnpm verify             # dist-smoke + check-exports
pnpm verify:consumer    # 真实 tarball 消费者验证
```

`ci.yml` 与 `release.yml` 均已接入 `verify-consumer`。

---

## 七、最终验证结果

```
✓ pnpm typecheck                        通过（无错误）
✓ pnpm build                            通过（vite + vue-tsc + 2 个后处理）
✓ dist-smoke.mjs                        22 项全过
✓ check-exports.mjs                     所有入口路径校验通过
✓ verify-consumer.mjs                   真实 TS/Vite/Node 消费全部通过
✓ playground build                      通过
✓ docs build                            通过（无 Rollup 警告）
✓ home build                            通过
```

---

## 八、发布前仍需你手动处理

以下三项是**仓库/账号层面**的操作，代码无法代劳：

1. **`git init` 并推送到 GitHub** —— 当前目录不是 git 仓库。
   changesets 自动发布、CI、`changeset publish` **全部依赖 git**，
   现在这套流程一个都跑不了。
2. **确认 GitHub 仓库地址** —— `package.json` 里的
   `homepage` / `repository` / `bugs` 都指向 `github.com/Hejiu-Web/vis-3x`。
   若实际仓库不同，npm 页面的链接会 404。
3. **配置 `NPM_TOKEN`** —— 在 GitHub 仓库 Settings → Secrets 中添加，
   供 `release.yml` 使用。

另外建议（低优先级，未改动）：

- `vis-3x-md/` 下同时存在 `package-lock.json` 与 `pnpm-lock.yaml`，
  两份锁文件会打架，建议择一删除
- `vis-3x-md` 的 `dependencies` 里没有 `vis-3x`，文档示例的裸导入依赖
  `resolve-vis3x.mjs` 的 alias 才能解析，可考虑加一个 `file:` 依赖更稳妥
