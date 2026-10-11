# 典籍管理实施计划

> **For agentic workers:** Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** 让管理员通过网页新增、编辑、预览和发布典籍。

**Architecture:** PostgreSQL 保存草稿与发布快照，Express 校验权限和版本，React 共用动态发布目录。保留内置内容作为 API 不可用时的阅读回退。

**Tech Stack:** React 18、TypeScript、Express 5、PostgreSQL 16、Playwright。

**Spec:** ../specs/2026-10-11-classics-admin-design.md

## Global Constraints

- 不引入新产品依赖；公开注册不能授予权限。
- 只管理 type=经；正文为纯文本，不使用 HTML 注入。
- 草稿不影响发布内容；更新使用整数 version 防止覆盖。

## Review Focus

- API 失败时保留编辑内容，提供重试。
- 过期会话和撤销权限不得继续保存。
- 多窗口版本冲突必须明确告知，不覆盖内容。
- 草稿关联不能指向未发布知识。
- 新发布内容必须可搜索、阅读和收藏。

### Task 1: 数据与接口

Files: server/migrations/003-knowledge.sql, server/src/db.ts, server/src/knowledge.ts, server/src/app.ts, server/src/auth.ts, server/tests/api.test.ts, 现有账号管理代码（复用，不另加 CLI）。

Interfaces: GET /api/knowledge -> {items:Knowledge[]}; GET /api/admin/classics -> {entries:Entry[]}; POST /api/admin/classics -> Entry; PUT /api/admin/classics/:id -> Entry; POST /api/admin/classics/:id/publish -> Entry. Entry={draft,published,version,updatedAt}; writes={content,version}, publish={version}.

- [x] 添加并运行失败的接口集成测试。
- [x] 实现版本化迁移、幂等种子、权限校验、草稿和发布快照、冲突与数据验证。
- [x] 复用现有管理员启动配置，检查服务器类型并运行完整 API 测试。

### Task 2: 管理和阅读

Files: src/data/catalog.ts, src/features/content/useKnowledge.ts, src/features/admin/ClassicsAdmin.tsx, src/features/admin/admin.css, src/features/study/useStudy.ts, src/App.tsx, src/three/knowledgeSpace.ts, related scene components, tests/classics-admin.spec.ts.

Interfaces: Knowledge extends existing fields with optional body/keyPoints; useKnowledge exposes reactive catalog/loading/error/refresh; study exposes existing sessionToken and user.role. setKnowledge replaces catalog and notifies subscriptions, rebuilding space nodes from the current items.

- [x] 浏览器测试新增/保存/预览/发布/阅读、普通用户受限、失败保留输入。
- [x] 实现动态目录、管理员入口、表单与预览、正文显示和同步星海。
- [x] 运行浏览器全套与前端构建，检查窄屏。

### Task 3: 交付

Files: README.md, docs/DEVELOPMENT.md, qihuang-unified.html.

- [x] 记录管理员授予、后台路径、发布和恢复办法。
- [x] 导出单文件，检查差异及验证记录。

## 执行记录

用户已同意增加后台，并指定 aidejiasinuo 为管理员；本次在现有云工作目录直接实施。

Ruling: 同步主分支新上线的账号管理和密码重置功能，复用 role / sessionToken / INITIAL_ADMIN_USERNAME，典籍迁移编号为 3，页面路径为 /#classics — 保留用户的并行更新，不引入第二套权限。

独立审查的三项问题已追加浏览器回归：学习要点空数组回退、首页同步失败重试、登录到期时保留草稿。

Ruling: 冲突提示在同一管理员重新登录时保留，避免只保留 conflict 状态而丢失重新载入入口；新增回归已先失败后通过。
