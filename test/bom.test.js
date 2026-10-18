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
