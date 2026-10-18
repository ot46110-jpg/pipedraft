// Headless checks of the model, fittings, BOM and exports: stubs the DOM and WebGL, runs the app script from index.html.
const fs = require('fs'), vm = require('vm'), path = require('path');
const root = path.join(__dirname, '..');
const html = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
const scripts = [...html.matchAll(/<script>([\s\S]*?)<\/script>/g)].map(x => x[1]);
const app = scripts[scripts.length - 2];
const els = {};
const mk = () => ({ style: {}, dataset: {}, classList: { add() {}, remove() {} }, setAttribute() {}, getAttribute() { return null; }, addEventListener() {}, click() {},
  getBoundingClientRect() { return { width: 800, height: 600, left: 0, top: 0 }; }, setPointerCapture() {}, clientHeight: 600, textContent: '', innerHTML: '', hidden: false, disabled: false, value: '4' });
const doc = { getElementById: id => els[id] || (els[id] = mk()), querySelectorAll: () => [], addEventListener() {} };
const ctx = { document: doc, window: { addEventListener() {}, innerWidth: 1000, devicePixelRatio: 1 }, navigator: { storage: { persist() {} } }, performance: { now: () => 0 },
  localStorage: { getItem() { return null; }, setItem() {} }, ResizeObserver: class { observe() {} }, requestAnimationFrame() {}, setTimeout, clearTimeout, console, Math, Promise };
vm.createContext(ctx);
vm.runInContext(fs.readFileSync(path.join(root, 'vendor/three.min.js'), 'utf8'), ctx);
vm.runInContext('THREE.WebGLRenderer=function(){return{setPixelRatio(){},setSize(){},render(){}}}', ctx);
vm.runInContext(app, ctx);
const PD = ctx.window.PipeDraft;

let failed = 0;
function check(name, cond, extra) { if (cond) console.log('ok   ' + name); else { failed++; console.error('FAIL ' + name + (extra ? '\n' + extra : '')); } }
const rows = () => PD.rows().map(r => r[0] + ' | ' + r[1]).join('\n');
const has = s => rows().includes(s);

// Example layout shown on first open.
check('example BOM', ['Pipe, NPS 4 SCH 40, BE | 8.26 m', 'Pipe, NPS 3 SCH 40, BE | 0.74 m', 'Elbow 90° LR BW, NPS 4 SCH 40 | 2', 'Reducer concentric BW, NPS 4×3 SCH 40 | 1', 'Tee equal BW, NPS 4 SCH 40 | 1', 'Gate valve flanged 150#, NPS 4 | 2'].every(has), rows());
check('example has no warnings', PD.warns().length === 0, PD.warns().join('\n'));

// Branch from the middle of a pipe makes a tee.
PD.load({ pipes: [{ a: [0, 0, 0], b: [4, 0, 0], n: 4 }], valves: [] });
PD.addPipe([2, 0, 0], [2, 0, 3], 4, 40, 'L-002'); PD.rebuild();
check('mid-pipe branch splits the header', PD.model.pipes.length === 3);
check('mid-pipe branch gives a tee', has('Tee equal BW, NPS 4 SCH 40 | 1'), rows());

// Smaller branch: reducing tee, then weldolet at half size or less.
PD.load({ pipes: [{ a: [0, 0, 0], b: [4, 0, 0], n: 6 }], valves: [] });
PD.addPipe([2, 0, 0], [2, 0, 2], 4, 40); PD.rebuild();
check('reducing tee', has('Tee reducing BW, NPS 6×4'), rows());
PD.load({ pipes: [{ a: [0, 0, 0], b: [4, 0, 0], n: 6 }], valves: [] });
PD.addPipe([2, 0, 0], [2, 0, 2], 3, 40); PD.rebuild();
check('weldolet at half size', has('Weldolet BW, NPS 6×3'), rows());

// 45 degree elbow.
PD.load({ pipes: [{ a: [0, 0, 0], b: [2, 0, 0], n: 4 }, { a: [2, 0, 0], b: [3, 0, 1], n: 4 }], valves: [] });
check('45 degree elbow', has('Elbow 45° LR BW, NPS 4 SCH 40 | 1'), rows());

// Clash between unconnected pipes.
PD.load({ pipes: [{ a: [0, 0, 0], b: [4, 0, 0], n: 4 }, { a: [2, -1, 0], b: [2, 1, 0], n: 4 }], valves: [] });
check('clash reported', PD.warns().some(w => w.startsWith('Clash')), PD.warns().join('\n'));
PD.load({ pipes: [{ a: [0, 0, 0], b: [4, 0, 0], n: 4 }, { a: [2, 0, 1], b: [2, 2, 1], n: 4 }], valves: [] });
check('no clash when apart', !PD.warns().some(w => w.startsWith('Clash')));

// Cap, flange pair, valve kinds.
PD.load({ pipes: [{ a: [0, 0, 0], b: [2, 0, 0], n: 4 }], valves: [{ p: [0.5, 0, 0], d: [1, 0, 0], n: 4, k: 'globe' }], caps: [[2, 0, 0]], flanges: [{ p: [1.2, 0, 0], d: [1, 0, 0], n: 4, s: 40 }] });
check('cap in BOM', has('Cap BW, NPS 4 SCH 40 | 1'), rows());
check('flange pair in BOM', has('Weld-neck flange 150# BW, NPS 4 SCH 40 | 2') && has('Gasket 150# spiral wound, NPS 4 | 1') && has('Stud bolt set 150#, 8× 5/8" | 1'), rows());
check('globe valve in BOM', has('Globe valve flanged 150#, NPS 4 | 1'), rows());

// Equipment nozzles are start points.
PD.load({ pipes: [], valves: [], equip: [{ k: 'pump', p: [0, 0, 0], r: 0 }, { k: 'vessel', p: [5, 0, 0], r: 1 }] });
check('equipment in BOM', has('Centrifugal pump | 1') && has('Vertical vessel | 1'), rows());
check('equipment nozzles', PD.nozzles().length === 5);
const n0 = PD.nozzles()[0];
check('pump suction nozzle position', Math.abs(n0.p.x + 0.35) < 1e-6 && Math.abs(n0.p.y - 0.4) < 1e-6);

// Spec options and per-joint overrides.
const elb = { pipes: [{ a: [0, 0, 0], b: [2, 0, 0], n: 4 }, { a: [2, 0, 0], b: [2, 0, 2], n: 4 }], valves: [] };
PD.load(Object.assign({ spec: { elbow: 'SR' } }, elb));
check('short radius elbow from spec', has('Elbow 90° SR BW, NPS 4 SCH 40 | 1'), rows());
PD.load(Object.assign({ fit: { '2000,0,0': { el: '3D' } } }, elb));
check('3D bend from a joint override', has('Elbow 90° 3D BW, NPS 4 SCH 40 | 1'), rows());
const red = { pipes: [{ a: [0, 0, 0], b: [2, 0, 0], n: 4 }, { a: [2, 0, 0], b: [4, 0, 0], n: 3 }], valves: [] };
PD.load(Object.assign({ spec: { reducer: 'ecc' } }, red));
check('eccentric reducer', has('Reducer eccentric (flat on bottom) BW, NPS 4×3 SCH 40 | 1'), rows());
const hdr6 = () => ({ pipes: [{ a: [0, 0, 0], b: [4, 0, 0], n: 6 }], valves: [] });
PD.load(Object.assign({ spec: { olet: 'sockolet' } }, hdr6())); PD.addPipe([2, 0, 0], [2, 0, 2], 3, 40); PD.rebuild();
check('sockolet from spec', has('Sockolet SW, NPS 6×3 SCH 40 | 1'), rows());
PD.load(Object.assign({ spec: { olet: 'sweepolet' } }, hdr6())); PD.addPipe([2, 0, 0], [2, 0, 2], 3, 40); PD.rebuild();
check('sweepolet from spec', has('Sweepolet BW, NPS 6×3'), rows());
PD.load(Object.assign({ spec: { branch: 'tee' } }, hdr6())); PD.addPipe([2, 0, 0], [2, 0, 2], 3, 40); PD.rebuild();
check('always-tee spec', has('Tee reducing BW, NPS 6×3 SCH 40 | 1'), rows());
PD.load(Object.assign({ fit: { '2000,0,0': { br: 'stub' } } }, hdr6())); PD.addPipe([2, 0, 0], [2, 0, 2], 4, 40); PD.rebuild();
check('stub-in override', has('Stub-in branch, PE, NPS 6×4 SCH 40 | 1'), rows());
PD.load(Object.assign({ fit: { '2000,0,0': { br: 'olet', olet: 'threadolet' } } }, hdr6())); PD.addPipe([2, 0, 0], [2, 0, 2], 4, 40); PD.rebuild();
check('olet override on a large branch', has('Threadolet THD, NPS 6×4 SCH 40 | 1'), rows());

// Lateral 45 degrees.
const hdr4 = () => ({ pipes: [{ a: [0, 0, 0], b: [4, 0, 0], n: 4 }], valves: [] });
PD.load(hdr4()); PD.addPipe([2, 0, 0], [3, 0, 1], 4, 40); PD.rebuild();
check('lateral 45°', has('Lateral 45° BW, NPS 4 SCH 40 | 1') && PD.warns().length === 0, rows() + PD.warns().join('\n'));
PD.load(hdr4()); PD.addPipe([2, 0, 0], [3.732, 0, 1], 4, 40); PD.rebuild();
check('odd branch angle is reported', PD.warns().some(w => w.includes('not 90° or 45°')), PD.warns().join('\n'));

// New valve types, inline fittings, flange types, plug.
const run = extra => Object.assign({ pipes: [{ a: [0, 0, 0], b: [4, 0, 0], n: 4 }], valves: [] }, extra);
PD.load(run({ valves: [{ p: [0.6, 0, 0], d: [1, 0, 0], n: 4, k: 'butterfly' }, { p: [1.4, 0, 0], d: [1, 0, 0], n: 4, k: 'plug' }, { p: [2.4, 0, 0], d: [1, 0, 0], n: 4, k: 'control' }] }));
check('butterfly, plug and control valves', has('Butterfly valve wafer 150#, NPS 4 | 1') && has('Plug valve flanged 150#, NPS 4 | 1') && has('Control valve flanged 150#, NPS 4 | 1'), rows());
PD.load(run({ items: [{ p: [0.5, 0, 0], d: [1, 0, 0], n: 4, t: 'coupling' }, { p: [1, 0, 0], d: [1, 0, 0], n: 4, t: 'union' }, { p: [1.6, 0, 0], d: [1, 0, 0], n: 4, t: 'strainer' }, { p: [2.4, 0, 0], d: [1, 0, 0], n: 4, t: 'expansion' }, { p: [3, 0, 0], d: [1, 0, 0], n: 4, t: 'spectacle' }, { p: [3.5, 0, 0], d: [1, 0, 0], n: 4, t: 'orifice' }] }));
check('inline fittings', ['Coupling, full, SW 3000#, NPS 4', 'Union, SW 3000#, NPS 4', 'Y-strainer, flanged 150#, NPS 4', 'Expansion joint, bellows, flanged 150#, NPS 4', 'Spectacle blind 150#, NPS 4', 'Orifice plate assembly 150#, NPS 4'].every(has), rows());
const fl = t => ({ p: [2, 0, 0], d: [1, 0, 0], n: 4, s: 40, t });
PD.load(run({ flanges: [fl('so')] }));
check('slip-on flange pair', has('Slip-on flange 150# SO, NPS 4 | 2') && has('Gasket 150# spiral wound, NPS 4 | 1'), rows());
PD.load(run({ flanges: [fl('lj')] }));
check('lap-joint pair with stub ends', has('Lap-joint flange 150#, NPS 4 | 2') && has('Stub end BW, NPS 4 SCH 40 | 2'), rows());
PD.load(run({ flanges: [{ p: [4, 0, 0], d: [1, 0, 0], n: 4, s: 40, t: 'bl' }] }));
check('blind flange on a pipe end', has('Blind flange 150#, NPS 4 | 1') && has('Stud bolt set 150#, 8× 5/8" | 1'), rows());
PD.load(run({ caps: [[4, 0, 0, 'plug']] }));
check('plug closure', has('Plug, round head, THD, NPS 4 SCH 40 | 1'), rows());
PD.load(run({ caps: [[4, 0, 0]] }));
check('plain cap still works', has('Cap BW, NPS 4 SCH 40 | 1'), rows());

// Connecting pipes to equipment: start along the nozzle axis, route into another nozzle.
const arr = z => [z.p.x, z.p.y, z.p.z].map(v => Math.round(v * 1000) / 1000);
PD.load({ pipes: [], valves: [], equip: [{ k: 'pump', p: [0, 0, 0], r: 0 }, { k: 'vessel', p: [5, 0, 0], r: 0 }] });
const nz = PD.nozzles();
PD.startAtNozzle(nz[0]);
check('run starts on the nozzle', PD.model.pipes.length === 1 && PD.model.pipes[0].a.join() === arr(nz[0]).join());
check('first pipe leaves along the nozzle axis', PD.cursor()[0] < -0.6 && Math.abs(PD.cursor()[1] - 0.4) < 1e-9);
PD.routeTo(PD.cursor(), arr(nz[4]), nz[4]);
PD.rebuild();
const last = PD.model.pipes[PD.model.pipes.length - 1];
check('route ends on the vessel nozzle', last.b.join() === arr(nz[4]).join() && PD.cursor() === null, JSON.stringify(PD.model.pipes));
check('connected equipment has no warnings', PD.warns().length === 0, PD.warns().join('\n'));
PD.load({ pipes: [], valves: [], equip: [{ k: 'pump', p: [0, 0, 0], r: 0 }] });
PD.routeTo([-2, 0.7, -1], arr(PD.nozzles()[1]), PD.nozzles()[1]);    // NPS 4 pipe into an NPS 3 nozzle
PD.rebuild();
check('size mismatch at a nozzle is reported', PD.warns().some(w => w.includes('NPS 3 but the pipe is NPS 4')), PD.warns().join('\n'));

// Weight, exports.
PD.load({ pipes: [{ a: [0, 0, 0], b: [10, 0, 0], n: 4 }], valves: [] });
const wt = PD.rows().find(r => r[0].startsWith('Pipe weight'));
check('pipe weight about 16 kg/m', wt && Math.abs(parseFloat(wt[1]) - 160.7) < 2, JSON.stringify(wt));
check('csv has header and rows', PD.csv().startsWith('Item,Quantity\n') && PD.csv().includes('Pipe, NPS 4'));
check('dxf has a LINE', PD.dxf().includes('\nLINE\n') && PD.dxf().trim().endsWith('EOF'));
check('iso sheet renders', /^<svg/.test(PD.iso()) && PD.iso().includes('PIPEDRAFT 3D'));
PD.load({ pipes: [], valves: [] });
check('iso sheet empty returns null', PD.iso() === null);

if (failed) { console.error('\n' + failed + ' check(s) failed'); process.exit(1); }
console.log('\nall checks passed');
