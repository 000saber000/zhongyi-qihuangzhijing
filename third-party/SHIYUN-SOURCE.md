# 诗云代码来源与许可依据

本项目复用的诗云软件代码以以下 MIT 授权版本为依据：

- 项目：Cohenjikan/shiyun（诗云 / Poetry Cloud）
- 完整提交：`928c79ed554204b0033300ecd6c2529cc4e55764`
- 提交日期：2026-06-27
- [固定版本源码](https://github.com/Cohenjikan/shiyun/tree/928c79ed554204b0033300ecd6c2529cc4e55764)
- [该版本的 MIT 许可证](https://github.com/Cohenjikan/shiyun/blob/928c79ed554204b0033300ecd6c2529cc4e55764/LICENSE)
- Copyright (c) 2026 Cohenjikan

## 复用范围

| 本项目文件 | 上游文件 | 本项目修改 |
| --- | --- | --- |
| `src/three/Galaxy.tsx` | `src/three/Galaxy.tsx` | 中医主题配色、粒子预算、部分渲染参数与阅读时的暂停控制 |
| `src/three/galaxyParams.ts` | `src/three/galaxyParams.ts` | 保留星系参数与共享旋转辅助实现；补充来源和许可说明 |
| `src/three/disc.ts` | `src/three/disc.ts` | 保留柔和光点纹理实现；补充来源和许可说明 |
| `src/three/RelationLight.tsx` | `src/three/GiftLines.tsx` | 将诗人赠诗关系改为中医知识关系，改写曲线生成、筛选、颜色及动画控制 |

`KnowledgeClouds.tsx` 的知识星团分层设计受到诗云诗人及诗歌云结构的启发。

## 版本核验

2026-10-13 核验了上述四个上游文件。它们在 MIT 版本
`928c79ed554204b0033300ecd6c2529cc4e55764` 与本项目前期注明的
`771591fe53f1761976fc84c0f0f0beaedc402ff7` 中逐字相同，Git blob 标识如下：

| 上游文件 | 两个版本共同的 Git blob |
| --- | --- |
| `Galaxy.tsx` | `574ef9b5f7f514ec214596d66385aab9aee3deae` |
| `galaxyParams.ts` | `988d401b59f61896f7b06bc5f077778e3755ee8c` |
| `disc.ts` | `efdeb18f9cec550019877c70c476e8d11cdef2cb` |
| `GiftLines.tsx` | `acf950eece0ab56d60bdda02a7d52e0eb8ac5998` |

因此本项目将上述复用部分的许可依据明确固定到已附带 MIT 许可证的
`928c79e`，保留原作者版权和 MIT 完整许可；渲染算法与既有功能不因这次
来源及许可整理而改变。后续如引入其他版本的代码，须核验该代码的来源和许可。

## 发布与权利范围

完整上游许可保存在 `third-party/SHIYUN-LICENSE.md`，并随网站发布为
`public/licenses/shiyun-MIT.txt`。页面保留诗云署名与许可链接。

本项目未导入诗云的诗歌语料或整理性元数据。上游许可文件末尾的数据权利
说明仍原样保留；软件 MIT 授权不覆盖这些数据的独立权利。本记录仅说明
诗云复用部分的许可依据，不将整站其他代码、图像、字体、数据或第三方依赖
统一改为 MIT，也不将复用代码认定为本项目的原创贡献。
