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
