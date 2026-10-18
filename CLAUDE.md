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
- Symbols: `SYM` holds every isometric symbol (valve kinds, flange pairs, inline fittings, reducer, cap, plug, olet, weld dot, pump, vessel) with a name and a tag prefix. `isoSvg()` draws only the symbols in use, numbers each placed item (GV-1, FL-2, P-1), and lists them in a legend. `legendSvg()` is the full reference sheet in the ⋯ menu. A new part type needs a `SYM` entry.
- Instruments: `model.instr` holds `{k, p, d, n, num, link?, eq?}`. `INSTR` lists the types (PI, TI, FI, PT, TT, FT, LT, PIC, TIC, FIC, LIC, PSV). They sit on a pipe (`d`, `n`) or on equipment (`eq` index). A controller gets the loop number of a transmitter of the same variable that has no controller yet (`nextNum`), and `link` is the index of a control valve it drives. A pipe-mounted instrument whose point is no longer on a pipe is reported in Check.
- Tags: `assignTags()` gives valves, flanges, inline fittings and equipment one tag list, used by both the isometric and the P&ID sheet. Instrument tags come from `instrTag()`.
- P&ID sheet: `pidSvg()` builds a schematic from the joints. Nodes are equipment, branches and free ends. Runs are the pipe between two nodes, and each run is a horizontal line with its valves, flanges, inline fittings, reducers and instruments in order. The straight-through leg continues on the row and a branch drops to a new row. Not to scale, flow direction not shown, signal lines are dashed.
- Flow: each pipe has `fl` (1 = from A to B, -1 = from B to A, 0 = not set). New pipes take the "Flow on new pipe" setting, splitting a pipe keeps it, `setRunFlow` carries one direction through elbows and reducers, and Select edits one pipe. Arrows show in 3D (toggle in ⋯), on the isometric sheet and on the P&ID. Check `valves` have `rev` to flip them, and a check valve against the flow is reported. Two pipes whose flow meets head-on at a joint are reported.
- Supports: `model.supports` holds `{p, d, n, t}` with `t` one of shoe, guide, anchor, hanger, spring. Horizontal pipe takes all five, vertical pipe takes a guide or an anchor (a clamp ring with a bracket). `SPAN` gives the rough maximum unsupported span per size, from memory of an MSS SP-69 style table, and long gaps are reported (pipe ends count as supported). Supports are tagged (SH, GD, AN, HG, SPH) and drawn on the isometric sheet, not on the P&ID.
- Hydraulics: `model.fluid` (key into `FLUIDS`) and `model.lines` (`{ 'L-001': { q: m³/h } }`) feed `hydraulics()`. It works per line number: velocity, Reynolds number and Darcy-Weisbach friction (Churchill friction factor, 0.045 mm roughness) on each trimmed pipe length (`pipeLen`, with valve and inline item lengths taken off), fittings by Crane TP-410 style K (`FT`, `ELBOW_K`, `VALVE_K`, `ITEM_K`, control valve from `CV`), reducers as contraction or expansion by flow direction (small-bore velocity), and an elevation term when every pipe of the line has a flow direction. Velocity above 3 m/s is reported in Check. Equipment nozzle losses and flow splits at tees are not included. The tests compare against the Python `fluids` package, so keep those reference numbers if the formulas change.
- Drawing axes follow CAD: X and Y horizontal, Z up (the scene itself has Y up, so CAD Y is scene Z). Pipes are drawn by aiming: `aim()` picks the axis whose screen direction best matches the pointer (or the locked axis from the Auto, X, Y, Z buttons) and measures the length where the pointer ray passes closest to that axis line. Status shows X, Y, Z in mm; the guide line takes the axis colour (X red, Y green, Z blue). The ▲ ▼ buttons still add fixed 0.5 m vertical steps, and move the start plane when no run is active.
- Checks: clash detection between pipes that share no joint, size changes at elbows or tee headers, pipes shorter than their fittings.
- File: save and open project JSON, BOM CSV, DXF centrelines (mm, Z up), PNG image. On iPad these go through the share sheet.
- Fitting catalogue, all derived from joints by `rebuild()`: elbow (LR 1.5D, SR 1.0D, 3D, any angle), reducer (concentric, eccentric), tee, reducing tee, lateral 45°, weldolet, sockolet, threadolet, sweepolet, stub-in, cross, cap, plug. Pipes are cut back to each fitting.
- `model.spec` holds project defaults (`elbow`, `reducer`, `olet`, `branch`). `model.fit` maps a joint key (`"x,y,z"` in mm) to overrides (`el`, `red`, `br`, `olet`). Select a fitting to edit its override; the Spec button edits the defaults.
- Placed items: valves (gate, globe, check, ball, butterfly, plug, control), flange pairs (weld-neck, slip-on, lap-joint with stub ends), blind flange on a pipe end (`flanges` with `t: 'bl'`), inline fittings in `items` (coupling, union, Y-strainer, expansion joint, spectacle blind, orifice plate), end closures in `caps` (`[x, y, z, 'cap' | 'plug']`).
- Eccentric reducers are drawn concentric in a different colour. The centrelines stay on the pipe axis.
- Inline item lengths and the lateral dimensions are rough figures, not from a standard.
- Model arrays: `pipes`, `valves`, `flanges`, `caps` (pipe end points), `equip` (`{k, p, r}`). `normalize()` fills defaults so old saves load.
- `window.PipeDraft` exists only for the headless tests.

## Screen layout (keep it uncluttered)
- Header: view buttons (Iso, Top, Front, Right), Fit, Undo, BOM, and the ⋯ menu (isometric sheet, project spec, orthographic, pipe lengths, file actions).
- Left rail: six tools only: View, Select, Pipe, Parts, Measure, Delete. Parts opens a narrow scrolling list (218 px) with one folding section per category (Valves, Flanges, Inline, Ends, Equipment, Supports, Instruments), one section open at a time. Choosing a row arms that part, then tap the canvas. The list is built once by `buildParts()` and `syncParts()` only changes classes, so the scroll position survives every tap.
- The ⋯ menu has three folding groups (Sheets, Project, File), one open at a time. Put new menu actions into a group, do not add loose buttons.
- Bottom centre: context bar shown only for Pipe (settings summary, 45° turns, Finish run) and Equipment (Rotate). The summary button opens the pipe settings sheet (size, schedule, line number, snap).
- Right column: inspector, project spec and BOM, shown only when opened. Elevation up and down sit bottom right.
- Do not add toolbar buttons. New parts go into `PARTS` as chips, new actions into the ⋯ menu, new per-item settings into the inspector.
- Touch targets are at least 48 px. Tapping the canvas closes the pipe settings and the ⋯ menu.

## iPad input
- Finger: one-finger drag orbits, two fingers pan and zoom, tap places.
- Apple Pencil in Pipe, Valve and Delete tools: touch and drag to aim, lift to place. Touches within 350 ms of the pen are ignored as palm contact.
- Smoothness rules: pen and hover moves go through `queueGhost`, which runs the preview once per frame. Preview lines reuse one buffer (`setLine`). Object matrices are refreshed only after a rebuild (`matDirty`). The marker turns white and larger when it locks onto a pipe end or nozzle. Keep per-event work in the pointer handlers close to zero.
- Hover preview works only where Safari reports pen hover.
- Keyboard: P pipe, V valve, D delete, N navigate, Esc or Enter finish run, arrow up and down for vertical pipe, Cmd+Z undo.
- Not verified on a real iPad: pen aim-and-lift, palm rejection, standalone full screen.
