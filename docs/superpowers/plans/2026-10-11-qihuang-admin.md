# Qihuang administration implementation plan

Spec: ../specs/2026-10-11-qihuang-admin-design.md
Execution: inline, using the user's accepted feature scope and selected existing administrator. Continue through tests and authorized publication without repeated approvals.

## Global constraints

Existing registration/study/session compatibility; password hashes only; no production mutations against other users during verification; existing admin account only; all account authority comes from PostgreSQL; preserve shared data, URLs and free plans. Never use the owner's chat password.

## Review focus

Login/reset/disable races must not recreate revoked old-credential sessions. Stored frontend roles must never grant server authority. Forced-change sessions must not access study or administration. Bootstrap must not elevate a future signup. Audit failure must roll back destructive operations. Old-account responses and one-time temporary passwords must not leak after logout/account changes. Search must treat underscore literally. Protected administrator must remain usable.

### Task 1: Database, authorization and administrative API

- [x] Write real PostgreSQL admin tests and observe expected missing-feature failures.
- [x] Add migration, existing-account bootstrap, role/disabled checks, locked login/password change, admin routes and audit.
- [x] Run server typecheck and complete API suite; commit.

Interfaces: user {id,username,role,mustChangePassword}; session {user,token,expiresAt}; bounded admin list and actions as specified; password change returns replacement session.

### Task 2: Management and password-change UI

- [x] Write admin browser flows before UI and observe missing-entry failures.
- [x] Add admin page, reauthentication/confirmation dialogs and password-change UI; consume new flags in study state without weakening races.
- [x] Verify focused browser flows and build; commit.

### Task 3: Regression and independent review

- [x] Run complete server/frontend suites and production checks.
- [x] Dispatch one fresh whole-branch review; address Important/Critical findings via reproducing tests and green suites.
- [x] Document usage and bootstrap; export production standalone artifact and verify packaged management UI.

### Task 4: Publication and Render verification

- [x] Configure INITIAL_ADMIN_USERNAME=aidejiasinuo by merging this non-secret env setting only.
- [ ] Publish the reviewed source and exported frontend to main; preserve database connection and other settings.
- [ ] Confirm both deploys live at published commit and configured administrator initialization succeeded; record any blocked online checks.
- [ ] Complete deployment notes/ledger and clean up the owned implementation worktree.
