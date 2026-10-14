# Three-dimensional Course Books Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [x]`) syntax for tracking.

**Goal:** Replace the CSS book simulation with actual Three.js bound books and real cover hinges while preserving course behavior.

**Architecture:** A lazy standalone Three.js renderer owns three book meshes and a particle nebula. Its canvas stays in the same dialog shell while that shell enters the native top layer, without allocating a third WebGL context. Transparent accessible buttons follow projected mesh bounds; stable course selectors and the existing lesson state remain in React.

**Tech Stack:** Existing React 18, TypeScript, Three.js, Web Animations, Playwright; no new runtime dependencies.

**Spec:** `docs/superpowers/specs/2026-10-14-three-course-books.md`

## Global Constraints

- Real mesh geometry for cover, spine, paper and thread; no CSS book transforms or image-only course cards.
- Preserve homepage galaxy state/camera and existing learning, AI, admin and classic-opening callbacks.
- Course renderer pauses offscreen, in the background, on hover/focus and in reduced motion; release its resources on unmount.
- Use the existing main/Render compatible release flow; fetch latest main before publishing.

## Review Focus

- Cancel native opening or navigate away: restore the stable canvas shell and prevent late lesson reveal.
- Keyboard restored after cancellation/reading: pause the book beneath focus.
- Reduced-motion preference changes live: finish handoff safely and stop orbit.
- WebGL unavailable or lost: keep stable course selectors usable.
- Narrow viewport and depth sorting: books, caption nodes and selection controls remain readable; homepage canvas persists.

### Task 1: Physical book model

**Files:** Create `src/features/courses/bookModel.ts`.

**Interfaces:** `createCourseBook(course: Course, image: HTMLImageElement): CourseBookModel` produces `root: Group`, `cover: Group` hinged at the right edge, `materials: MeshStandardMaterial[]`, `setOpacity(value:number):void`, `setGlow(value:number):void`, `dispose():void`. Closed dimensions: 1.5 × 2.0 × ~0.38 world units; front faces +Z.

- [x] Verify actual geometry with Three.js bounds and a browser render from front/side/open poses.
- [x] Build cloth covers, page block/layers, spine, four tube-thread stitches and paper inside; paint vertical title into the cover texture.
- [x] Confirm CPU geometry and texture disposal; no CSS depth/hinge code.

### Task 2: Three.js course scene and real opening

**Files:** Create `CourseScene.tsx`, `sceneTypes.ts`, `courseTitle.ts`; modify `CourseOrbit.tsx`, `CourseOpening.tsx`, `courses.css`, `src/App.tsx`; remove CSS-only `CourseBook.tsx` and `MiniNebula.tsx`.

**Interfaces:** `CourseVisualHandle.open(selection:CourseSelection, slot:HTMLElement):{finished:Promise<void>;cancel():void}` makes the stable course dialog shell modal and animates book position/orientation and real cover rotation. React owns modal handoff and completion.

- [x] Add failing browser assertion requiring a genuine course canvas before implementation.
- [x] Implement perspective camera, lighting, physical orbit and nebula points; project mesh bounds to keyboard/touch controls.
- [x] Use a cancelable animation clock for the mesh pose; preserve focus, live reduced motion and route cancellation.
- [x] Run `tests/course-orbit.spec.ts`, inspect desktop/mobile and open/side screenshots.

### Task 3: Regression and release

**Files:** Update canvas selectors in existing tests to target `.universe-stage canvas`; update README/development/source attribution to describe the true 3D scene.

- [x] Run complete browser regression using the isolated PostgreSQL test database; investigate the old contribution-list loading timeout without unrelated product changes.
- [x] Request independent review and fix confirmed findings.
- [x] Run production-compatible release and production tests; fetch main, integrate any new changes and regenerate if needed.
- Release completion: commit source plus compatible output, push HEAD to main, confirm Render commit is live and report accurately in Chinese. The final result is recorded in Git history and Render deployment status.

## Validation record

- Final full regression: 96/99 passed; three transition-handoff checks exceeded the default five-second assertion wait under software WebGL. Independent natural opening/reopening/closing and live reduced-motion probes completed correctly.
- Those checks now await the actual handoff within the existing test deadline; focused recheck, including natural timed playback: 4/4 passed. No application-source change was needed for these waits.
- TypeScript and compatible release build passed. Standard Vite and Render-compatible production tests: 8/8 passed.
- Independent review findings (outward cover hinge and focus restoration target) were fixed and verified. Desktop/mobile and real open-cover visuals were inspected.
