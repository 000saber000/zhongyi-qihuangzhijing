# Member Contributions Implementation Plan

> **For agentic workers:** Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** 本站成员可以评论典籍并提交修改建议，管理员审核后合并草稿，再手动发布。

**Architecture:** 新增评论与建议表，复用现有会话、管理员权限及典籍发布。前端成员组件与审核组件分开，jsdiff仅用于差异展示。

**Tech Stack:** React / TypeScript、Express、PostgreSQL、diff、Node test、Playwright。

**Spec:** ../specs/2026-10-12-member-contributions.md

## Global Constraints

- 评论和理由最多2000字符；仅已发布的经类典籍可贡献。
- 采纳只修改草稿，不能修改 published；同字段变化必须报冲突。
- 数据分页；贡献提交按账号限流；使用现有会话与服务端权限。
- 发布 public/，执行 release:build；保留 diff 许可证。

## Review Focus

- 两次并发采纳应只有一次成功。
- 管理员已有草稿不应被旧建议覆盖。
- 未登录、禁用和需改密码的账号不能贡献或审核。
- 删除账号后保留作者名称，评论隐藏后不再公开。
- 中文差异和手机页面可用，切换账号不会保留其他人的私有建议。

### Task 1: Contribution API and migrations

Files: server/migrations/004-contributions.sql, server/src/contributions.ts, server/src/app.ts, server/src/db.ts, server/tests/contributions.test.ts.

Interfaces: public GET /api/classics/:id/comments; authenticated POST at same path; POST /api/classics/:id/suggestions; GET /api/suggestions/mine; admin GET /api/admin/suggestions, POST /api/admin/suggestions/:id/review, DELETE /api/admin/comments/:id.

- [x] Write API tests for comments, validation, permission gates, private suggestions, draft-only acceptance, rejection, conflict and concurrent acceptance.
- [x] Run tests before implementation; expect missing endpoints to fail.
- [x] Add migration and transactional routes using existing authentication and SQL parameterization.
- [x] Run contribution tests and complete server suite; expect zero failures.

### Task 2: Member and admin UI

Files: src/features/contributions/{types.ts,ClassicCommunity.tsx,MySuggestions.tsx,SuggestionReview.tsx,contributions.css}, src/App.tsx, src/features/admin/ClassicsAdmin.tsx, tests/contributions.spec.ts, package files and third-party license.

Interfaces: classic community consumes Knowledge and Study; MySuggestions consumes authenticated Study; SuggestionReview consumes token, authorization and an onMerged callback to refresh draft entries.

- [x] Write browser tests for member commenting and suggesting, admin comparison and merge, manual publishing, guest prompts, hidden comments and mobile layout.
- [x] Run tests before UI implementation; expect missing controls to fail.
- [x] Install diff, retain license, implement components and wire them to existing details/study/admin views.
- [x] Run browser tests and existing suite; compile client and server.

### Task 3: Review and publish

- [x] Review permissions, identity transitions, conflict and duplicate processing against the spec.
- [x] Build compatible release with production API URL and run production tests.
- [ ] Commit and push final change to existing main, wait for API and frontend deployment to be live; check deployment logs.
- [ ] Report usable member/admin entrypoints and any actual limitations.

## Verification record

2026-10-12: 35 server tests, 44 browser tests and 6 production tests passed. One independent review found in-flight draft editing and shrinking-page issues; both have failing-to-passing regressions in contributions.spec.ts. A 50,000-character Chinese snapshot/revision regression passes with the bounded 512 KiB JSON limit. Published artifacts include the production API base and jsdiff license.
