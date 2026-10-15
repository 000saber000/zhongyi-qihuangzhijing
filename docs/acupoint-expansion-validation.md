# First acupoint expansion batch

The meridian atlas now contains 60 named point types: 59 points on the fourteen
meridians and the extra point Yintang. This is a curated learning subset, not the
complete set of 361 standard meridian points. Bilateral points have independent
left/right locations on each of the two user-supplied models: 110 anchors per
model, 220 total. The existing 68 anchors are preserved byte-for-byte as records.

## Interaction

- Automatic density preserves the original overview points. The additional points
  appear within 0.95 m of the camera, or when selected, explicitly requested with
  **全部穴位**, or included by a meridian filter. Hidden details cannot be hovered
  or clicked. Their hit meshes also skip raycasting, preventing a stale hover
  record when a stationary pointer is over a detail that is later revealed.
  Search by name/code narrows the directory; the meridian filter also
  filters the model markers.
- Surface mode still shows floating point glows without meridian lines.
- Xray starts with Ren, Du, Lung, and Stomach as a limited preview. Selecting a
  point renders only its associated meridian. Clearing selection restores that
  preview, or the currently filtered meridian. Extra points render no invented
  meridian. The independent organ/layer/opacity controls remain available.
- The directory reports its actual published subset and the 361-point reference
  total. New entries include standard codes, location summaries, learning context,
  related meridians, and reference links.

## Sources and geometry

`expand-point-data.py` contains the forty-entry batch. Its Chinese text is an
educational paraphrase of standard locations (WHO Western Pacific Region, 2008;
individual KMCRIC reference links), not an independent clinical validation.
Point positions use the existing model landmark convention and Blender BVH
projection onto each actual exported body. Markers sit 2.5 mm above the surface.
The atlas remains a region/relationship illustration; generated models do not
resolve all clinical bony/tendon landmarks or flexed-joint poses. Fine decorative
branches are not vessels or additional named acupoints.

`annotate-models.py` starts added front/back rays outside the actual imported body
cross section. This avoids incorrectly projecting through an interior ray origin.
LU5/LI11 separation has a regression guard after the first female projection
collapsed both points onto one location. Final female elbow separations exceed
12 mm; every distinct point center is more than 6 mm from every other center.

Reproduction (Blender source files are local working assets, not repository files):

```sh
python scripts/anatomy/expand-point-data.py
blender -b --threads 2 --python scripts/anatomy/annotate-models.py -- --root . --sources SOURCE_DIR
blender -b --threads 2 --python scripts/anatomy/build-lux3d-paths.py -- --root . --sources SOURCE_DIR
node scripts/anatomy/verify-views.mjs
server/node_modules/.bin/tsx --test src/features/meridians/__tests__/*.test.ts
```

The actual GLBs/textures and their immutable digests are unchanged. All 660
preset sightline checks (110 anchors x two models x three aspect ratios) pass.
These checks establish visibility, not anatomical accuracy or the flight path.

The forty new knowledge-card illustrations are rendered from these same model
anchors with `render-point-atlas.py`, then packed with its `--pack` option into a
5 x 8 WebP atlas. Each new entry has a distinct image cell.

## Database compatibility

Migration 006 inserts the forty new published entries with `ON CONFLICT DO
NOTHING`. It never replaces an existing draft, published version, or intentionally
unpublished record. Fresh installation also preserves seed body/keyPoint fields.
The integration test covers fresh initialization, upgrade with missing entries,
edited and unpublished entries, and a repeated migration.

## Verification

- 20 atlas unit checks pass, including coverage, immutable asset hashes, camera
  headroom, distance visibility, xray context, and distinct point separation.
- 72 service checks pass, including the database upgrade regression.
- All 16 atlas browser scenarios pass, including the distance/hidden-hit regression;
  the transparency case was rechecked independently after a timeout in the full run.
- 18 production-output checks pass. After the final asset/hover refresh, all four
  packaged atlas checks pass again across Vite dist and Render-compatible output,
  including the new card atlas decoding and expanded point article.
- Frontend/backend TypeScript checks and the configured production release build pass.
- Independent review has no unresolved findings.

### Broader regression limits

The full 125-case browser run completed with 119 passes and six failures. The
missing image coverage was fixed, and image coverage, navigation shell, and
transparency all passed a focused rerun (three of three). Three broader tests
remain red; this is not a claim that the whole suite is green:

- `tests/chapters.spec.ts`: chapter editor and reader at 1440 px and 820 px.
- `tests/contributions.spec.ts`: member comments/suggests, administrator merges and
  publishes, member reads the result.

The desktop chapter workflow and the community workflow also time out at their
reading/navigation clicks on the unchanged base commit `0b0d9a9`. The comparison
used the same dependencies and browser, a separate Vite/API port pair with matching
allowed origins, and local disposable test data. The baseline community test copy
only adapts the hardcoded local URLs. No chapter/community product code was
changed for this atlas release. Baseline navigation passes; navigation also passes
in the final feature-branch recheck. These existing reading-interaction test
failures remain separately documented rather than being hidden by timeout or
assertion changes.
