# 许可证

vis-3x 基于 **MIT License** 发布。

---

## MIT License

```
MIT License

Copyright (c) 2025 vis-3x

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.
```

---

## 你可以做什么

MIT 是**非常宽松**的许可证。你可以：

| 行为 | 是否允许 |
|---|---|
| 商业项目中使用 | ✅ 允许 |
| 修改源码 | ✅ 允许 |
| 再发布（含闭源） | ✅ 允许 |
| 用于 SaaS / 内部系统 | ✅ 允许 |
| 作为其他库的依赖 | ✅ 允许 |
| 出售包含本库的产品 | ✅ 允许 |

**唯一要求**：保留版权声明与许可证文本。再发布时在项目里附上 `LICENSE` 文件即可。

---

## 关于依赖

本库不捆绑任何第三方运行时依赖：

| 依赖 | 关系 | 许可证 |
|---|---|---|
| `three` | peerDependency（由你的项目提供） | MIT |
| `vue` | peerDependency，仅使用组件时需要 | MIT |

因为 `three` 与 `vue` 都是 peer 依赖，它们不会被复制进本库的产物。
你只需要遵循自己项目里那两份依赖各自的许可条款。

---

## 独立性声明

::: warning 本项目为独立实现
vis-3x 是独立编写的，**未复制任何第三方图表库的源代码**。

开发过程中参考过同类库的**公开类型定义与配置项命名习惯**（用于保持 API 的易用性与可迁移性），
但所有渲染逻辑、坐标系统、动画系统、资源管理与扩展 API 均为本项目自行实现。

`ECharts` 是 Apache 软件基金会的商标；本项目与 ECharts 项目无隶属关系，
仅在文档中提及配置项的相似性以方便使用者迁移。
:::

---

## 贡献

向本项目提交代码即表示你同意以 MIT 许可证授权你的贡献。

---

## 相关链接

<script setup>
import { REPO_URL } from './.vitepress/site-config'
</script>

- <a :href="REPO_URL + '/blob/main/LICENSE'">完整许可证文本</a>
- <a :href="REPO_URL">项目仓库</a>
- [更新日志](/changelog)
