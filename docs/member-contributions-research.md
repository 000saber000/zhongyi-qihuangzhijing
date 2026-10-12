# 典籍评论与成员修改建议：GitHub 复用调研

调研日期：2026-10-12。本文记录已查阅的项目和适配判断；不是已实现功能。

## 用户需求

- 使用本站注册账号，在每部典籍下发表评论。
- 注册成员可以提出典籍内容修改建议。
- 修改建议交给管理员审核，由管理员决定是否合并。
- 优先复用现成实现，减少重复开发。

## GitHub 候选与结论

| 项目 | 已核对的功能 | 与本站的适配判断 |
| --- | --- | --- |
| [jsdiff](https://github.com/kpdecker/jsdiff) | 文本比较、按字符或行生成差异；ESM 和 TypeScript 类型；BSD-3-Clause | 推荐直接使用 npm 包 `diff`，展示修改前后差异。中文正文可按字符比较。它不提供账号、审核队列或事务性内容合并。 |
| [MediaWiki Moderation](https://github.com/edwardspec/mediawiki-moderation) | 新用户编辑进入审核；审核通过及拒绝；避免重复合并 | 审核流程与需求相似，但属于 PHP/MediaWiki 扩展，要求 MediaWiki >=1.43，GPL-3.0+。参考流程，避免把扩展代码直接搬进本站。 |
| [Remark42](https://github.com/umputun/remark42) | 页面评论、嵌套回复、管理员删除/封禁、通知；MIT | 完整评论服务，需单独部署；支持社交、邮箱及自定义 OAuth2 登录，不能直接使用本站现有会话。适合作为未来复杂评论社区的候选。 |
| [giscus](https://github.com/giscus/giscus) | 按页面映射 GitHub Discussions 评论；React 组件；MIT | 接入页面较快，但发表评论需要 GitHub OAuth，无法满足只用本站注册账号的体验，也不提供典籍内容审核合并。 |

以上来自项目说明和代码，不代表已完成集成、性能或运行验证。

## 已核对的源码依据

- jsdiff：[README](https://github.com/kpdecker/jsdiff/blob/master/README.md)、[package.json](https://github.com/kpdecker/jsdiff/blob/master/package.json)、[LICENSE](https://github.com/kpdecker/jsdiff/blob/master/LICENSE)。
- MediaWiki Moderation：[README](https://github.com/edwardspec/mediawiki-moderation/blob/master/README.md)、[运行依赖和许可证](https://github.com/edwardspec/mediawiki-moderation/blob/master/extension.json)、[审核及重复合并检查](https://github.com/edwardspec/mediawiki-moderation/blob/master/lib/entry/ModerationApprovableEntry.php)。
- Remark42：[README](https://github.com/umputun/remark42/blob/master/README.md)、[LICENSE](https://github.com/umputun/remark42/blob/master/LICENSE)。
- giscus：[README](https://github.com/giscus/giscus/blob/main/README.md)、[LICENSE](https://github.com/giscus/giscus/blob/main/LICENSE)。

## 本站已有能力

本站采用 React / TypeScript、Express 和 PostgreSQL。已有注册登录、管理员权限、典籍正文编辑、草稿预览、发布和版本冲突检查。

- `src/features/study/useStudy.ts`：登录会话与当前账号。
- `server/src/app.ts`：服务端验证会话、账号禁用和临时密码限制。
- `server/src/knowledge.ts`：典籍草稿、发布及版本校验。
- `src/features/admin/ClassicsAdmin.tsx`：管理员编辑、预览和发布界面。
- `src/App.tsx`：典籍详情页，可承载评论区和修改建议入口。

## 推荐的最小实现

复用现有账号、数据库和典籍管理；使用 jsdiff 处理差异展示。只新增本站需要的评论数据和建议审核流程。这一适配判断基于当前代码与上述项目的登录、部署要求，并非已测得的工时或 token 数量。

1. 在已发布典籍详情页下显示评论区。推荐游客可以阅读，注册登录成员可以提交；管理员可隐藏不适当评论。
2. 增加“建议修改”入口，允许成员修改正文、简介、出处及学习要点，并填写理由或文献依据。
3. 建议保存提交者、典籍、原内容快照、修改内容和处理状态。成员提交不修改公开正文。
4. 管理员在典籍管理中查看“待审核建议”和待处理数量；展示提交者、理由、原文与建议差异。
5. 管理员可采纳或拒绝；提交者可查看自己的处理状态和处理说明。
6. 推荐采纳后合并到草稿，再复用现有预览、发布。只合并建议改变的字段；发现相同字段已被管理员或其他建议修改时，先提示冲突，防止覆盖已有修改。审核与写入应在同一数据库事务中完成，防止重复采纳。

“发给管理员”第一版建议解释为站内审核队列和待处理提示。邮箱、微信等外部通知需另外明确渠道；本调研未发送任何通知。

## 尚待确认

- 用户已确认：采纳后先合并到草稿，再由管理员预览并手动发布。
- 评论可读范围、评论提交是否先审核，以及是否需要外部通知，目前是推荐项，不是用户已经明确的要求。

## 后续验证重点

成员不能直接修改典籍或审核建议；退出/禁用账号后不能继续提交；评论安全显示；采纳、拒绝和重复采纳状态一致；并发建议不覆盖现有草稿；发布后公开内容与建议状态对应；兼容 Render 实际发布的 `public/` 产物。
