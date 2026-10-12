# DeepSeek chat response repair

User report: saving a DeepSeek configuration succeeds, but chat does not produce a visible reply. The exact saved model and vendor failure have not been confirmed; existing production logs do not record provider failures.

Confirmed defects in the request path:

- Vendor HTTP errors are collapsed into generic errors in both chat and connection testing.
- Reasoning-only streams produce no visible progress; reaching the output limit before final text also yields only a generic failure.
- New configurations suggest `deepseek-chat`; current official documentation recommends `deepseek-flash`, and current models default to thinking mode.

Implementation:

1. Reproduce these defects using deterministic provider and route tests.
2. Suggest `deepseek-flash` for new settings; explicitly request non-thinking DeepSeek answers, except when the administrator selected the legacy `deepseek-reasoner`. Preserve existing settings, encryption key, quotas, and output limits.
3. Forward progress only, never raw reasoning. Classify vendor HTTP errors using static safe messages; record stage, provider, code, and upstream HTTP status without keys, questions, raw exceptions, or vendor bodies.
4. Verify token-limit failures refund requests without answer text; verify UI stops generating and preserves the login session.
5. Run backend and browser regression checks, build the Render-compatible release, review, and deploy. An authenticated real vendor request requires the administrator's browser session; do not claim production vendor success based on mocks.

Sources checked on 2026-10-13:

- https://api-docs.deepseek.com/zh-cn/guides/thinking_mode/
- https://api-docs.deepseek.com/quick_start/pricing/
