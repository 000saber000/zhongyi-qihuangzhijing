# Qihuang account administration

The owner accepted account management and selected the existing username `aidejiasinuo` as administrator. Implement and publish within the current account system, preserving the site, study records and deployment. No password supplied in chat is used in code, configuration, test fixtures, logs or documentation.

## Permission and bootstrap

Migration 2 adds users.role (`user` by default, or `admin`), disabled and must_change_password flags and a transactional audit table. Normal registration never accepts privileged fields. Every authenticated request reads role/status from PostgreSQL; disabled or revoked sessions are rejected. Administrative endpoints require an active administrator whose password is not pending change.

Startup can promote exactly one already-registered account selected by INITIAL_ADMIN_USERNAME. It never creates an account or elevates an account on registration. Missing/invalid bootstrap usernames or a different existing administrator fail initialization. Repeating the same bootstrap is safe and does not reset passwords, status or study records. Configure the chosen username only on the existing Render API; do not expose database credentials.

## Operations

- GET /api/admin/users?q=&page=1: case-insensitive literal substring search, 20 users per page; return id, username, role, disabled, mustChangePassword, createdAt, bookmarkCount, completedCount and activeSessions plus total/page/pageSize. Never return password or token hashes.
- GET /api/admin/audit: newest 20 actions; actor/target username snapshots, action and time. No credentials, tokens or request bodies.
- PUT /api/admin/users/:id/status {disabled:boolean}: disable/restore an ordinary account; disabling revokes all sessions. Repeated status updates are idempotent.
- POST /api/admin/users/:id/revoke-sessions: revoke all ordinary-account sessions without changing credentials or learning data.
- POST /api/admin/users/:id/reset-password {adminPassword}: revalidate the administrator password with authentication rate limiting; generate a random temporary password, store only its scrypt hash, revoke all target sessions and require a password change. Return the temporary password once, for the administrator to convey manually. Do not persist it in the browser.
- DELETE /api/admin/users/:id {confirmUsername,adminPassword}: exact target-name confirmation and administrator reauthentication; delete an ordinary account and cascade its sessions/learning records. Audit snapshots survive deletion.
- All target IDs must be UUIDs. Missing targets return 404; administrator accounts cannot be disabled, force-logged-out, reset by administrative action, or deleted. No role-assignment endpoint.
- Every administrative mutation and audit entry commits or rolls back together. Use parameterized SQL and row locks, including login and password changes, so resetting/disabling cannot race with login to issue an old-credential session afterward.

## Password change and frontend

POST /api/auth/password {currentPassword,newPassword} checks the current password, validates a different new password of 10–128 characters, hashes it, clears the change-required flag, revokes all sessions and issues a fresh session atomically. Invalid current passwords are 400 with a specific error, not session expiry. This endpoint is authentication-rate-limited. Required-change sessions can access only me, logout and password change; all learning/admin access is blocked until completion.

Add an administrator-only Account management button in My Study and an #admin page in the existing cosmos shell. Provide search, pagination, registration time, status/role and study/session counts, refresh/retry, operation confirmation and recent audit actions. Password reset/delete dialogs request the administrator's current password; deletion also requires typing the exact target username. Destructive actions run only when the user explicitly submits the dialog. There is no production deletion/disable/reset during verification.

Add Change password for signed-in users and a mandatory password-change dialog after reset. Preserve guest state and old-account/write/read race defenses. Forced-change users cannot dismiss the dialog to gain access; logout is available. Errors never display false success. Account switches/logout hide administrative data and temporary passwords; no automatic retries of mutations.

## Verification and delivery

Use isolated local PostgreSQL schemas for server tests and the disposable database for browser tests. Verify bootstrap, forged roles, every operation, protected administrator, revoked/disabled sessions, forced password change, audit rollback, login/reset serialization, list bounds/redaction and ordinary user access denial. Verify browser administration, reset/change, deletion confirmation, operation failure and logout isolation, plus existing account/guest flows.

Run build/type checks and complete suites, then one fresh whole-branch security review. Export the standalone HTML with https://qihuang-api.onrender.com and verify the packaged artifact locally. Publish reviewed code to main and set INITIAL_ADMIN_USERNAME through Render's merged env update. Confirm both deployments and administrator initialization logs, without live destructive tests. Direct online HTTP verification remains subject to the existing network policy. Keep free database expiry (2026-11-10) documented.
