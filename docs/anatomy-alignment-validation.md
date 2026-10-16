# Abdominal landmarks and fitted organ layers

This correction addresses two reported defects in the v4 model atlas: abdominal
markers below their visible landmarks, and organs protruding through the body in
side views. Body meshes, textures, knowledge records and publication state are
unchanged.

## Landmark correction

The previous umbilical plane used 59% of total model height. On the actual
exported, textured bodies it was about 46 mm too low for the male model and
50 mm too low for the female model. Direct centerline mesh sampling and textured
orthographic renders identify the navel dimples at Y=1.096 m and Y=1.053 m.
Shenque (CV8) and the bilateral Tianshu (ST25) now share those measured planes.
Qihai (CV6), Guanyuan (CV4) and Zhongwan (CV12) use regional proportional units
between the navel and estimated pubic/xiphoid landmarks, instead of total height.
The ST25 transverse offset uses half the estimated midclavicular distance.

`surface-landmarks.json` binds these measurements to the exact body digests.
The navel is visible and directly measured. The covered pubic landmark and other
bony landmarks remain teaching estimates; this is not clinical validation of all
60 point types. Existing surface projection, elevated marker normals and camera
visibility checks do not themselves establish anatomical correctness.

The anchor generator, affected meridian paths and the ST25/CV8 card images have
been regenerated. Regression checks independently assert the measured umbilical
planes and lower-abdominal ordering/proportions.

## Organ containment

The previous shared organ GLB used a fixed runtime scale/offset for each gender.
It was not fitted to the replacement body contours. `fit-organs.py` now bakes a
separate organ asset for each immutable body, using measured torso widths and
local front/back depth, with an 8 mm fitting inset. The runtime applies no further
position or scale transform. The manifest records exact body and organ digests.
This is a fitted educational organ illustration, not segmented patient anatomy.

`verify-organ-fit.py` independently reads the exported GLBs and checks every
organ vertex and polygon center against front/back and lateral body envelopes:

| Asset layout | Male outside / samples | Female outside / samples |
| --- | ---: | ---: |
| Previous runtime transforms | 1,886 / 65,095 | 2,695 / 65,095 |
| New fitted exports | 0 / 65,095 | 0 / 65,095 |

Only degenerate rays whose two hits collapse to one wall are retried with parallel
probes up to 0.1 mm away (four male and five female axis checks). Valid outside
intervals are never widened or retried. These finite sample/envelope checks are
not a mathematical proof of a watertight interior. Independent review also probed
ten oblique envelope directions across the same samples. Five male and seven
female direction/sample misses appeared; five representative misses had nearby
0.1 mm probes showing containment, consistent with seam-ray artifacts. This
review was supplementary, not a zero-miss oblique or ray-parity proof. Actual
front, back and both side screenshots were inspected for each body.

Organ downloads are cached separately per variant. While a new body loads, the
previous body and its matching organs remain together. Once the displayed body
changes, the previous organs are hidden until its matching layer loads. Failed
downloads evict their own cache entry and can be retried without reloading the
page. The browser regression aborts the female organ download, compares the
failed-layer view with the explicitly hidden-layer view, then verifies retry.

## Reproduction

```sh
blender -b --python-exit-code 1 --python scripts/anatomy/fit-organs.py -- --root .
mkdir -p .superpowers/alignment
blender -b --python-exit-code 1 --python scripts/anatomy/verify-organ-fit.py -- --root .
# Expected failure when checking the previous layout:
blender -b --python-exit-code 1 --python scripts/anatomy/verify-organ-fit.py -- --root . --legacy
server/node_modules/.bin/tsx --test src/features/meridians/__tests__/*.test.ts
node scripts/anatomy/verify-views.mjs
npx playwright test --config playwright.meridians.config.ts
VITE_API_BASE_URL=https://qihuang-api.onrender.com npm run release:build
npm run test:production
```

## Final validation

- 23 atlas unit checks pass; TypeScript and the configured production release
  build pass. The existing large-chunk advisory remains a build warning.
- All 660 preset marker sightlines pass. The exported organ geometry check
  passes with the counts above.
- The 16 existing atlas browser scenarios pass. The new organ failure/retry
  scenario passes after correcting an overly strict byte-identical screenshot
  comparison: eight background pixels differed by only 1/255 on the first run.
  The final comparison ignores channel differences up to 2/255, requires zero
  materially changed pixels for failed versus hidden organs, and more than 500
  changed pixels when retry successfully displays the fitted female layer.
- All 18 packaged browser checks pass across Vite dist and compatible release
  output, including mobile layout, lazy scene failure and both atlas workflows.
- Independent review has no unresolved actionable findings. Diff whitespace
  checks pass.

Historical broader browser-suite limits remain documented in
`acupoint-expansion-validation.md`; this correction does not change the chapter
or community workflows. These browser runs use local servers and packaged files;
Render deployment state is checked separately after merging.
