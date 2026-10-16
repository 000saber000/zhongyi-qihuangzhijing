# Course CardSwap release verification

Release source: `origin/main` at `7b0adc5ac5cb9a3bd85c793f4fcea68da91f3845` (meridian idle-rotation frame-rate fix and acupoint reference links), followed by this CardSwap release commit.

## Scope

- Preserve the new mainline v4 male/female body assets and natural meridian rotation.
- Put the generated course CardSwap beside the three rotating books; on mobile, stack the scene above the cards.
- Retain course IDs, saved progress, previous-card selectors, keyboard navigation, pause control, drag handling, and the original lesson opening.
- During lazy loading of the study animation, show a status instead of a temporary interactive login form. This prevents user input disappearing when Suspense replaces its fallback.

## Checks

- `npm run release:build`: passed using `VITE_API_BASE_URL=https://qihuang-api.onrender.com`; Vite warned about existing chunks over 500 kB.
- `npm --prefix server run check`: passed.
- `npm --prefix server test`: 72/72 passed against an isolated PostgreSQL 18 database on port 55432; no production database used.
- `npm run test:production`: 18/18 passed for both Vite and Render-compatible static outputs, including v4 paired body assets, meridian interaction, mobile dimensions, guest learning, and chat.
- `npx playwright test --config playwright.courses.config.ts`: 18/18 passed for CardSwap plus the complete course-orbit suite; includes desktop and phone layout, all three generated images, dragging, keyboard navigation, live reduced-motion changes, modal handoff, and persisted progress.
- `npm test -- tests/study-loading.spec.ts`: passed. Its first run against the old fallback failed while the login button was visible during an intentionally held motion-module import; the updated status-only fallback test then passed.
- `git diff --check`: passed.
- Desktop, tablet, mobile, and v4 model resource were manually opened in Chromium. Independent code review found no remaining Important issues.

## Full-suite observations

One full `npm test` run completed 134/137 tests. Three failures were:

- `demo.spec.ts` no longer found the expected course selector after the card component class had changed. Added the existing `.course-choice-glow` class to each new card; the affected `all sections keep the same cosmos shell and canvas` regression passed afterward.
- `demo.spec.ts` and `meridians.spec.ts` did not see guest bookmark cards in the full run. The demo case passed an isolated browser rerun after waiting for the saved state and scrolling the inner study view to the saved card. A diagnostic against the same app and disposable database showed both expected IDs and cards. The model-switched meridian favorite still does not appear in the isolated existing browser test, although its bookmark ID is persisted.

The deployment proceeds with the remaining model-switched meridian bookmark browser-test failure. All 72 API tests, all 18 release-package tests, all 18 course integration tests, the targeted study-loading regression, and course/card compatibility browser checks passed.
