# Natural idle rotation

The existing atlas now offers slow automatic overview rotation, inspired by the
delayed, eased idle spin in the user's supplied React Bits ModelViewer example.
It reuses the existing viewer and dependencies. It does not replace its camera
focus, raycasting, loading/retry, jade materials or calibrated model assets.

- Automatic rotation is enabled by default. After two idle seconds it eases
  toward 0.11 radians/second, approximately one revolution per minute.
- The camera orbits the current viewing target. The body, markers, meridians and
  fitted organ assets stay in their original shared coordinates.
- Pointer inspection, drag/zoom, a camera flight, a pending model switch, or any
  selected acupoint pauses rotation. Leaving the viewer or ending a gesture
  starts a fresh two-second delay; clearing selection permits rotation again.
- A keyboard-accessible **自动旋转** button toggles the preference. The system
  reduced-motion preference disables it and is observed dynamically.
- Hidden documents and offscreen canvases pause idle rotation. Event listeners
  and the intersection observer are removed on unmount. Frame delta is capped
  to prevent a sudden angular jump after a long frame.
- Compact controls use closer spacing below 360 px, keeping xray controls inside
  the viewer without wrapping their labels onto two rows.

The animation adapts the reference's idle behavior to an anatomy learning viewer;
it does not add its floating/tilt transforms or replace the anatomical coordinate
system. No model, anchor, path, knowledge, license or database record changes.

## Verification

The new browser regressions inspect actual rendered images: idle overview turns,
the switch holds it still, pointer inspection holds it still and resumes after
leaving, selected-point focus remains stationary, and reduced motion holds the
female xray still. Markers and animated meridian lights are hidden only for those
pixel comparisons. GPU channel differences up to 2/255 are ignored; stationary
views must have zero materially changed pixels, and rotation must change more
than 500 pixels. A 320 px xray check also verifies every control is inside the
viewer with a single-row label.

The initial missing-feature test failed because the rotation control did not
exist. The compact-layout regression failed at 34 px button height before the
spacing correction. Existing broader chapter/community test limitations remain
documented in `acupoint-expansion-validation.md`.

Final verification: all 23 atlas unit checks, all 21 atlas browser scenarios,
and all 18 production-output browser checks pass. TypeScript and the configured
release build pass; the existing large-chunk advisory remains a build warning.
Independent source review has no unresolved findings, and diff whitespace checks
pass. Browser checks use local servers and production files. The exact merged
commit's Render deployment state is verified separately before reporting.
