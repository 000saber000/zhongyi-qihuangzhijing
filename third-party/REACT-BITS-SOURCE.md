# React Bits 代码来源

- 上游：<https://github.com/DavidHDev/react-bits>
- 核验版本：`496968c4117e21278f13917201b7d615bc5e7450`（2026-10-14，`git ls-remote` 核验主分支）
- 原文件：`src/ts-default/Components/SpotlightCard/SpotlightCard.tsx` 和 `SpotlightCard.css`
- 本项目位置：`src/components/react-bits/SpotlightCard.tsx` 和 `SpotlightCard.css`
- 复用范围：鼠标柔光、边缘高亮、邻近感应、离屏暂停与动画清理；仅增加来源注释，视觉参数由固定选课按钮传入。
- 许可：Copyright (c) 2026 David Haz，MIT + Commons Clause License Condition v1.0，完整原文见 [REACT-BITS-LICENSE.md](REACT-BITS-LICENSE.md)。网站构建附带 `licenses/react-bits.txt`。

本站将组件用于学习路径的固定选课按钮，不作为独立组件库、付费组件包或移植版本分发。实体三维古籍、光照、订线、公转、缩小星云、翻开与学习窗口转场为本站独立实现，不引入 React Bits 的星云渲染器，也不改变已有知识星海。

## CardSwap（2026-10-16）

- 来源：用户提供的 React Bits CardSwap JavaScript + CSS 完整导出；上游同为 DavidHDev/react-bits，适用上述 MIT + Commons Clause 许可。
- 项目位置：`src/components/react-bits/CardSwap.jsx`、`CardSwap.css`、`CardSwap.d.ts`；课程接入在 `src/features/courses/CourseDeck.tsx`。
- 保留卡片堆叠、拖拽、轮播和前后切换机制；移除未使用的示例照片和图标依赖，适配墨绿配色、嵌套课程按钮、键盘和动态减少动画偏好，开启减少动画时取消正在进行的拖拽。
- 三张课程图使用内置 imagegen 生成，原图、生成提示词和 WebP 资源说明见 `art/course-card-swap/README.md`。课程卡片继续使用已有课程和学习进度，不替换人体模型或经络内容。

## GooeyNav（2026-10-16）

- 来源：用户提供的 JavaScript + CSS 完整导出，已逐字比对上游 `496968c4117e21278f13917201b7d615bc5e7450` 的 `GooeyNav-JS-CSS` registry；不新增运行依赖，沿用本文件记录的 MIT + Commons Clause 许可。
- 项目位置：`src/components/react-bits/GooeyNav.jsx`、`GooeyNav.css`、`GooeyNav.d.ts`；知识库分类栏接入在 `src/components/LibraryNavigation.tsx`。
- 保留 WebGL 液滴融合和文字遮罩；仅适配分类按钮的受控状态、`aria-pressed`、焦点恢复和墨绿配色。分类栏保留既有导航 landmark，组件内部改为普通容器，避免嵌套导航。
- 缺少 WebGL 时立即显示静态选中背景；开启减少动画时停止液滴动画，并响应运行中的系统偏好变化。切换路由时清理动画、事件和图形资源。
- 修改基线：已核实前端/API 同时运行的 `723a28ec2fcb6bf5359a8db350f2087fbed49125`；保留该版本的课程 CardSwap、经络和导航布局。

## PillNav（2026-10-16）

- 来源：用户提供的 React Bits PillNav JavaScript + CSS 完整导出（860 行 JSX、460 行 CSS）。此导出不同于技能固定上游 `496968c4117e21278f13917201b7d615bc5e7450` 的旧版 PillNav，未混用旧版 GSAP/router 实现；当前导出仅使用 React、CSS 和浏览器动画 API，不新增依赖，沿用上述许可。
- 项目位置：`src/components/react-bits/PillNav.jsx`、`PillNav.css`、`PillNav.d.ts`；知识宇宙左侧领域栏接入在 `src/features/universe/DomainNavigation.tsx`。
- 竖排使用填充悬停与文字翻动，保留原有简写、完整可访问名称和分类回调；增加受控按钮选中索引及 `aria-pressed`，支持外部搜索选中知识后重置分类。保留原版 CSS 减少动画处理，并防止字体异步加载在组件卸载后重启动画。
- 修改基线：线上与远端 `main` 的 `ff071b8e42316e59a40ac5a6ffa85616085cbf8c`；保留已上线的知识库 GooeyNav 及滚轮修复。

## ClickSpark（2026-10-17）

- 来源：用户提供的 React Bits ClickSpark JavaScript 完整导出；上游同为 DavidHDev/react-bits，沿用上述 MIT + Commons Clause 许可。组件只依赖 React 和 Canvas 2D，不新增运行依赖。
- 项目位置：`src/components/react-bits/ClickSpark.jsx`、`ClickSpark.d.ts`；收藏按钮接入在 `src/App.tsx`（知识详情页）和 `src/features/universe/KnowledgePanel.tsx`（知识宇宙面板）。
- 用法：组件以视口大小的透明层挂在 App 根部，通过 `ref.spark(x, y)` 在收藏点击处触发。没有包住按钮，避免破坏 `.detail-header>button`、`.detail-header>.outline` 等直系子元素样式，也让宇宙面板 `overflow` 和 `backdrop-filter` 不裁剪火花。
- 保留星形的爆发、淡出、spring 缓动与系统减少动画处理；配色改用本站的米金 `#ded6a3` 与苔绿 `#9db187`。

## AnimatedList（2026-10-17，仅交互语言）

- 来源：用户提供的 React Bits AnimatedList JavaScript + CSS 导出；上游同为 DavidHDev/react-bits，沿用上述 MIT + Commons Clause 许可。
- 未复制组件本体，也未引入 `@hugeicons/react`、`@hugeicons/core-free-icons`：它要求的纵向可选列表结构与「我的书斋」里大小不一的卡片不同构。
- 只搬运其交互语言到现有卡片：`src/components/JadePageMotion.tsx` 把书斋卡片（继续学习、账号、三项统计、修改建议）的上浮淡入换成 `translateY(18px) + scale(.94)` 的弹入（`back.out(1.6)`，错峰 0.05s）；`src/features/universe/jade.css` 增加悬停/键盘焦点时的米金色选中环（`::after`，`inset:-1px`，跟随 `border-radius`）。
- 保留减少动画偏好处理：`prefers-reduced-motion` 下不播放弹入，选中环也不做过渡。
