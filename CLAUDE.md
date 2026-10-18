# PipeDraft 3D

Offline 3D piping layout tool for the owner's iPad (Safari, installed to the Home Screen). Single user, no App Store. Inspired by the data model of AutoCAD Plant 3D: spec-driven fittings, ports, branch table, BOM.

## Layout
- `src/index.src.html` is the source. Edit this file only.
- `vendor/three.min.js` is Three.js r128, inlined into the build.
- `build.js` writes `index.html` (one self-contained file) and `sw.js` (new cache name per build).
- `test/bom.test.js` runs the app headless and checks the example BOM.
- `manifest.json`, `icon-180.png`, `icon-512.png` are static.
- GitHub Pages serves the repo root from `main`. Pushing `index.html` and `sw.js` publishes the app.

## Commands
- `npm run build` then `npm test`. Run both before every commit, and commit the generated `index.html` and `sw.js` with the source.

## Rules
- The app must work with no network. No CDN scripts, web fonts or fetches in `src/index.src.html` other than the Three.js tag that `build.js` inlines.
- Never edit `index.html` or `sw.js` by hand.
- Units: scene is metres, UI shows millimetres. Pipe sizes are NPS 2, 3, 4, 6 with ASME B36.10 OD and schedules 40 and 80.
- Model: `{ pipes: [{a, b, n, s}], valves: [{p, d, n, s}] }`, saved in `localStorage` under `pipedraft.model.v1`. Keep old saves loadable (`s` defaults to 40).
- Fittings are not stored. `rebuild()` derives them from joints: elbow (long radius 1.5D, real torus bend), reducer, equal or reducing tee, weldolet when the branch is at most half the header, cross. Pipes are trimmed back to each fitting. Valves are inline and their face-to-face length comes off the pipe in the BOM.
- Catalogue dimensions are written from ASME B16.9 and B16.10 from memory. Treat them as unverified until checked against the standard.
- Do not copy Autodesk spec or catalog data into this repo. It is public.

## Features
- Tools: Navigate, Select (inspector edits size, schedule, line number, valve type, equipment rotation), Pipe, Valve (gate, globe, check, ball), Flange pair, Cap, Equipment (pump, vessel with nozzles as pipe start points), Measure, Delete.
- Pipe tool: snap 50, 100 or 250 mm; optional 45° turns; start a run on a pipe end, a nozzle, or the middle of a pipe (the pipe is split and a tee appears); a new end landing on a pipe splits it too.
- Views: Iso, Top, Front, Right, Fit, orthographic toggle, dimension labels. Iso sheet is generated as SVG with centreline lengths and a line-number summary.
- Checks: clash detection between pipes that share no joint, size changes at elbows or tee headers, pipes shorter than their fittings.
- File: save and open project JSON, BOM CSV, DXF centrelines (mm, Z up), PNG image. On iPad these go through the share sheet.
- Model arrays: `pipes`, `valves`, `flanges`, `caps` (pipe end points), `equip` (`{k, p, r}`). `normalize()` fills defaults so old saves load.
- `window.PipeDraft` exists only for the headless tests.

## iPad input
- Finger: one-finger drag orbits, two fingers pan and zoom, tap places.
- Apple Pencil in Pipe, Valve and Delete tools: touch and drag to aim, lift to place. Touches within 350 ms of the pen are ignored as palm contact.
- Hover preview works only where Safari reports pen hover.
- Keyboard: P pipe, V valve, D delete, N navigate, Esc or Enter finish run, arrow up and down for vertical pipe, Cmd+Z undo.
- Not verified on a real iPad: pen aim-and-lift, palm rejection, standalone full screen.
