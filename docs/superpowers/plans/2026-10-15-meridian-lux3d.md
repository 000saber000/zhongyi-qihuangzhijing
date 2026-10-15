# Lux3D Meridian Atlas Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Replace both mannequins with the supplied detailed assets, fit visible meridians and deploy the tested result.
**Architecture:** Blender binds source textures and normalizes immutable model exports; geometry-derived anchors and curves are versioned together. React Three Fiber preserves model textures and draws a batched animated meridian overlay in surface and xray modes.
**Tech Stack:** Blender 4.3, Python, React, Three.js, TypeScript, Playwright, existing Render deployment.
**Spec:** docs/superpowers/specs/2026-10-15-meridian-lux3d-design.md

## Global Constraints
- Preserve latest main changes and existing navigation/background.
- Full source detail, 320000 triangle / 14 MB body budget; organs retain 50000 triangle / 4 MB budget.
- Y-up metre convention, floor origin; male 1.78m, female 1.70m.
- No external runtime texture/decoder requests; no additional paid generation.
- User-provided assets must not be labelled MPFB CC0.

## Review Focus
- Source GLB placeholder texture versus actual supplied detailed UV map.
- Gender switching must keep matching anchors and model during slow or failed requests.
- Fine lines and known markers must remain on the final surface, especially wrists/legs.
- Transparent body must reveal organs while markers retain front/back occlusion behavior.
- New larger files must remain lazy loaded; fallback images match the new model.

### Task 1: Prepare the paired assets and geometry records
**Files:** scripts/anatomy/prepare-lux3d.py; annotate-models.py; build-paths.py; verify-assets.py; src/assets/anatomy/*; anchors.json; paths.json; models.json; third-party/BODY-MODEL-SOURCE.md.
**Interfaces:** Export v3 manifest with source digest, actual file digest, dimensions and per-model teaching landmarks; export annotations using existing types.
- [x] Add asset tests that fail for missing v3 models, missing embedded detailed texture, invalid budgets or misplaced paths.
- [x] Run tests to confirm expected failure.
- [x] Bind source diffuse, normalize and export full-detail GLBs with real model fallback renders.
- [x] Reproject anchors and primary/secondary routes onto each actual mesh; verify all known same-meridian points are represented.
- [x] Run asset tests, registry tests and every anchor sightline; commit.

### Task 2: Render detailed surface and xray meridians
**Files:** BodyScene.tsx; MeridianNetwork.tsx; AnatomyLayers.tsx; MeridianPage.tsx; assets.ts; types.ts; tests/meridians.spec.ts; model-material.ts and tests.
**Interfaces:** Existing BodyScene props plus active meridian; reusable texture-preserving material builder; path metadata includes primary/secondary role.
- [x] Add failing material tests asserting supplied texture and UV maps survive material construction; add browser coverage for body/route version and global meridian toggle.
- [x] Run to confirm expected failures.
- [x] Preserve textured jade and clothing in body materials; render batched main/fine curves, halos and traveling particles in both modes; coordinate highlight with selected meridian.
- [x] Keep organ controls and fit organs to new trunk; correct provenance footer and provide persistent global meridian control.
- [x] Run unit/build checks and actual desktop/mobile browser checks; inspect screenshots and correct visual problems; commit.

### Task 3: Verify and publish
**Files:** tests/production/meridians.spec.ts; docs/meridian-lux3d-validation.md; docs/images/*; release files.
**Interfaces:** Existing main auto-deploy for srv-db5l3pvlk1mc73acpjpg and srv-db5lqh2d0e5s73ftnfa0.
- [x] Run focused meridian/navigation/mobile tests, production tests in both outputs, and geometry/resource checks.
- [x] Inspect male/female surface, wrist detail, back and xray screenshots; document actual limitations.
- [x] Obtain fresh whole-branch code review, resolve important issues and repeat affected checks.
- [ ] Build release outputs, commit and push branch, create/attach PR, merge after checks.
- [ ] Verify Render live commit and logs; report URL and any real limitations.
