# AI Learning Assistant Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [x]`) syntax for tracking.

**Goal:** Deliver an integrated Chinese learning chat and owner-only model settings.

**Architecture:** Express owns model secrets, knowledge retrieval, quotas and streaming. React keeps conversation state in memory and consumes a bounded SSE protocol. PostgreSQL stores encrypted settings and atomic usage reservations.

**Tech Stack:** Existing React 18, TypeScript, Express 5, PostgreSQL, Node 24 crypto/fetch, Playwright; no new runtime libraries.

**Spec:** docs/superpowers/specs/2026-10-12-ai-learning-assistant.md

## Global Constraints

- Owner username aidejiasinuo AND database admin role; existing accounts remain unchanged.
- Fixed HTTPS endpoints for deepseek/qwen/openai; AES-256-GCM with 32-byte base64 AI_CONFIG_ENCRYPTION_KEY.
- Default daily limits 10 per user, 200 global; max_tokens 1024 with range 128–2048.
- Eight messages maximum, 3000 characters per message, 12000 total; 90-second upstream deadline.
- Beijing daily reset; one concurrent request per account; no cloud conversation persistence.

## Review Focus

- Forged frontend roles and another administrator must never manage keys (Task 1).
- Fragmented SSE and upstream failure must terminate or refund appropriately (Task 2).
- Concurrent requests and cross-process quotas must not overspend caps (Task 2).
- Route/account changes and late responses must not leak previous chats (Task 3).
- Small screens, keyboard focus, cancellation and errors must leave chat usable (Task 3).

### Task 1: Owner-only encrypted model settings

**Files:** server/migrations/005-ai.sql, server/src/ai/config.ts, server/src/ai/routes.ts, server/src/db.ts, server/src/app.ts, server/tests/ai.test.ts.

**Interfaces:** installAiRoutes(app,pool,options) installs authenticated /api/admin/ai and /api/ai endpoints. AiOptions provides encryptionKey and injectable fetch for deterministic tests. Config public view contains enabled, provider, model, dailyLimit, globalDailyLimit, maxTokens, hasKey, encryptionReady, version; no key material.

- [x] Add tests rejecting guests, normal users, forged role, another admin; check encrypted-at-rest secret and no response disclosure, invalid config, key retention and version conflict.
- [x] Run `TEST_DATABASE_URL=postgres://postgres:qihuang_test@127.0.0.1:55432/qihuang_test npm --prefix server test` and observe new routes fail.
- [x] Implement versioned settings with fixed provider URLs and admin audit. Add migration 5 and install routes after existing auth/password middleware.
- [x] Run the new integration tests and server typecheck; expected exit 0.

### Task 2: Published knowledge, quotas and streaming

**Files:** server/src/ai/retrieval.ts, server/src/ai/quota.ts, server/src/ai/provider.ts, server/src/ai/routes.ts, server/tests/ai.test.ts.

**Interfaces:** reserve(pool,userId,config) returns reservation {id,day,remaining}; release(pool,reservation,refund) releases lease and optionally restores counters. streamModel(config,key,messages,signal,onDelta,fetch) forwards bounded deltas. retrieve(pool,question,contextId) returns published Knowledge[] only.

- [x] Add integration tests for unpublished rejection, real reference metadata, chunked Chinese streaming, early failure refund, personal/global limits, overlapping calls, test connection owner permission and low token use.
- [x] Run the focused tests and observe failures before implementing.
- [x] Implement atomic daily usage plus expiring activity leases; sanitize upstream errors and abort requests. Implement input bounds and published-only retrieval.
- [x] Run all server tests and typecheck; expected exit 0.

### Task 3: Chat and model settings UI

**Files:** src/features/ai/{types.ts,client.ts,ChatPanel.tsx,ModelSettings.tsx,ai.css}, src/App.tsx, src/features/account/AccountPanel.tsx, src/features/universe/Universe.tsx, tests/ai.spec.ts.

**Interfaces:** ChatPanel takes Study, context Knowledge|null, onNavigate, open/close controls; ModelSettings takes Study/back and uses admin configuration endpoints. Client streamChat dispatches discriminated meta/delta/done/error events with AbortSignal.

- [x] Add browser tests for guest/login, owner-only settings, mocked chat stream, references/multi-turn, account clearing, network error/retry, cancellation and mobile focus/layout.
- [x] Run tests to observe missing controls fail, then implement reusable accessible panels matching the starfield palette.
- [x] Connect detail/lesson/universe explanation buttons and persistent global launcher; keep discussions explicit across navigation.
- [x] Run browser tests, production build and server checks; expected exit 0.

### Task 4: Verification and release preparation

**Files:** docs/DEVELOPMENT.md, .env.example, render.yaml, public/assets/*, qihuang-unified.html.

- [x] Document encrypted key setup and owner workflow, quota semantics and source limits; never set INITIAL_ADMIN_USERNAME as part of AI setup.
- [x] Run server suite, selected existing account/content tests, `npm run release:build`, `npm run test:production`; expected exit 0.
- [x] Review security/data/UX boundaries; resolve findings and record results. Verified implementation committed; release proceeds under the user’s instruction to start and confirmed Render target, with AI disabled until an administrator supplies the provider key.

Validation: 50 backend tests, 53 development browser tests and 6 production browser checks passed. Frontend build and backend typecheck passed. Two independent-review findings were reproduced and repaired; re-review found no remaining P1/P2 issue. Existing main commit 799ba6a was integrated before final validation.
