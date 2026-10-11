# Qihuang accounts and cloud study implementation plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox syntax for tracking.

**Goal:** Ship username/password accounts and isolated, cross-device bookmarks and lesson progress while preserving guest usage and the live site.

**Architecture:** Restore the matching React source into the published repository. An Express API uses PostgreSQL and hashed opaque sessions; the frontend maintains guest and authenticated study states separately. The existing Render static site continues publishing the committed standalone export so its URL and configuration remain intact; the reproducible export script builds that artifact from source.

**Tech Stack:** React 18, TypeScript, Vite, Node 24, Express 5, node:crypto scrypt, PostgreSQL 16, pg, Playwright, node:test.

**Spec:** ../specs/2026-10-11-qihuang-backend-design.md

## Global Constraints

- Username is 3–32 ASCII letters/digits/underscore; comparison is case insensitive.
- Password is 10–128 characters; never trim it or persist plaintext.
- Session tokens contain 32 random bytes, hashes only in PostgreSQL, lifetime 7 days.
- Session token is in sessionStorage; guest keys remain qihuang-bookmarks and qihuang-completed.
- JSON body limit is 64 KB; import arrays each have at most 500 elements.
- Authentication limit is 20 requests per IP per 15 minutes.
- Study endpoints are per-item and idempotent; unknown IDs reject the entire import.
- Use only explicitly permitted frontend origins and parameterized SQL.
- Never create paid Render resources without permission.
- Preserve upstream notices, LICENSE link correction and existing visual design.

## Review Focus

- Delayed old-account responses must not populate a new account or guest state (Task 3/4).
- A read started before a write must not overwrite its acknowledged result (Task 3/4).
- Unavailable storage or backend must not display a false synchronized/empty success (Task 3/4).
- Login abuse and forged forwarded headers must not bypass the chosen limiter boundary (Task 2).
- Malformed import or repeated startup must neither partially import nor erase existing records (Task 2).

### Task 1: Restore reproducible frontend and baseline

**Files:** restore src/, tests/demo.spec.ts, third-party/, package.json, package-lock.json, index.html, tsconfig.json, vite.config.ts, playwright.config.ts and scripts/export-demo.mjs from the verified source checkout.

**Interfaces:** Produces shared catalog IDs and npm run build / npm run release:export. Existing standalone artifact remains the static deployment input.

- [x] Copy matching source and licenses; preserve deployment docs and original HTML.
- [x] Run npm ci and npm run build; expected successful TypeScript and Vite output.
- [x] Check a focused existing guest browser flow; expected search/bookmark/refresh succeeds.
- [x] Commit restored source and the deterministic release export command.

### Task 2: Database-backed API and authenticated study contracts

**Files:** server/package.json, server/tsconfig.json, server/src/{app,db,security,catalog,index}.ts, server/migrations/001-accounts.sql, server/tests/api.test.ts.

**Interfaces:** createApp(pool: Pool, allowedOrigins: string[], options?) produces an Express application; migrate(pool: Pool): Promise<void>; API paths and response shapes follow the spec. Server loads IDs directly from root src/data files and catalog course IDs.

- [x] Write real PostgreSQL HTTP integration tests: register auto-login, wrong credentials, case-insensitive duplicates, hashes only, revoke/expire sessions, two-account isolation, idempotent per-item writes, valid lesson IDs, import union/atomic rejection, concurrent devices, CORS, unavailable DB, 429 limiter.
- [x] Run npm --prefix server test against the disposable PostgreSQL instance. Expected RED due to missing API modules.
- [x] Implement migrations, scrypt/password helpers, session creation/authentication and parameterized routes with bounded body parsing, CORS and rate limiting.
- [x] Run server typecheck and the integration suite. Expected GREEN; commit.

### Task 3: Account/session and guest/cloud study state

**Files:** src/lib/api.ts, src/features/study/useStudy.ts, src/features/account/AccountPanel.tsx, src/App.tsx, src/features/universe/content.css.

**Interfaces:** useStudy() provides user, bookmarks, completed, status, error, pending IDs, authenticate(), logout(), toggleBookmark(), completeLesson(), importGuest(), refresh(), and retryable import prompt. AccountPanel renders those operations without coupling to the cosmos canvas.

- [x] Write browser assertions before code: account controls exist in study, register/login work, two browser contexts synchronize, importing is opt-in, logout restores guest records.
- [x] Run the new browser suite; expected RED because account controls do not exist.
- [x] Implement bounded-time API requests, session restoration, isolated guest storage and cloud fetching; acknowledge writes only after API success, reject stale responses using identity and generation checks.
- [x] Add account dialog and import controls in the existing dark reading layout; preserve source navigation, notices and cosmos.
- [x] Run production build and main browser account flow. Expected GREEN; commit.

### Task 4: Failure, race and existing visual regressions

**Files:** tests/account.spec.ts, tests/demo.spec.ts, playwright.config.ts and code from Task 3 when a demonstrated failure needs fixing.

**Interfaces:** Uses the real test API plus intercepted responses for delayed/error cases. Existing guest flows still call the same App actions.

- [x] Add assertions for 401 expiry, write failure without false progress, delayed old-account response, read/write race, import rejection, session storage failure and mobile dialog bounds.
- [x] Observe new tests fail for uncovered behavior, fix only demonstrated failures and rerun.
- [x] Run full frontend production build, real database server tests and applicable guest/account browser suites. Expected GREEN; commit verified changes.

### Task 5: Review, cloud deployment and live verification

**Files:** render.yaml, README.md, .env.example, generated qihuang-unified.html and deployment notes.

**Interfaces:** Free Node service connects to same-region free PostgreSQL; existing static service publishes release export configured with the actual API URL. API config uses DATABASE_URL and ALLOWED_ORIGINS only through environment settings.

- [x] Request one independent whole-branch review; address significant findings with regression tests.
- [x] Document free database expiry and export/migration steps; preserve the original artifact in Git history.
- [x] Push the reviewed feature branch; provision free PostgreSQL and API after local tests pass.
- [x] Configure actual API URL, export frontend, run build/tests and publish authorized changes to main.
- [ ] Verify Render deploys match published commits and are live; check API health, registration/login and two-context synchronization when network permits, explicitly reporting any blocked check.
- [ ] Commit final deployment notes and record completed tasks and verification in the execution ledger.

Deployment progress: reviewed code is on main. Free PostgreSQL dpg-db5lq0ss728c7388r170-a is available (expires 2026-11-10 09:55 UTC). API srv-db5lqh2d0e5s73ftnfa0 builds successfully, but requires DATABASE_URL from the Dashboard before startup; the connector does not expose connection strings. Frontend release targets https://qihuang-api.onrender.com.
