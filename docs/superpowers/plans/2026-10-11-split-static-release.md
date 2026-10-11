# Split Static Release Implementation Plan

> **For agentic workers:** Use superpowers:executing-plans to implement this plan task-by-task in this session.

**Goal:** Publish HTML, JavaScript and CSS separately, and let the site navigation load before the three-dimensional scene.

**Architecture:** Keep the existing React/TypeScript source and Vite build. Introduce a lazy boundary around the Canvas and scene. Use Vite's `dist` directory for static publication, retaining compatibility with the current Render service until its build settings can be changed.

**Tech Stack:** React 18, Vite 6, TypeScript, Three.js, Render Static Sites.

**Spec:** The user's request and the in-chat design: split the existing production file without changing the URL, accounts, published content, bookmarks or progress.

## Global Constraints

- Preserve the current website and API URLs.
- Do not change database schemas or users.
- Serve built files locally for production browser checks; use a disposable database for existing integration tests.
- Do not claim the live build settings changed unless confirmed by Render.

## Review Focus

- Slow scene downloads: navigation must remain usable.
- Failed scene downloads: the existing knowledge-library fallback must remain usable.
- Hash routes: direct detail links must work after refresh.
- Guest records: bookmarks and lesson completion must survive reload.
- Existing Render settings: the active build must still have every referenced asset.

### Task 1: Separate the scene from the initial page

**Files:** `src/three/UniverseCanvas.tsx`, `src/features/universe/Universe.tsx`, production Playwright configuration and tests.

- [x] Run production tests against the current build and confirm slow/failed scene checks fail.
- [x] Move Canvas creation into a lazily imported component, preserving props, fallback and scene lifetime.
- [x] Build and run the production checks for external resources, delayed/failed downloads and guest learning.

### Task 2: Publish split resources

**Files:** `render.yaml`, package scripts, release tooling and `docs/DEVELOPMENT.md`.

- [x] Set the standard Render build to `npm ci --include=dev && npm run build`, publishing `dist` with the public API build variable.
- [x] Determine whether the existing service can switch settings with available credentials. Keep a compatible split release if it cannot.
- [x] Document the final commands and directory layout; avoid presenting historical single-file instructions as current.
- [ ] Run the existing browser suite with a disposable database, inspect the final diff, push and check the actual deployment status.

## Verification and deployment decision

- Production tests: 6/6 pass across standard `dist` and compatible `public` output.
- Existing browser suite: 37/37 pass with a disposable PostgreSQL database.
- Backend TypeScript check passes after installing its declared dependencies.
- Independent review: no actionable findings; both output directories have identical assets and all chunk imports resolve.
- Ruling: retain the lightweight historical entry and committed `public/assets` because the connected Render tools cannot update the existing service's build command or publish directory. This preserves automatic publication at the current URL. The standard `dist` settings are documented for a later migration; the cost is continuing to commit generated release resources until that migration.
- HTML entry reduced from 1,249,654 to 917 bytes. JavaScript is split into a 259,160-byte entry and a 923,724-byte scene module; this changes loading order, not the total scene download size.
