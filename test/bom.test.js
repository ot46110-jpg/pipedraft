// Headless checks of the model, fittings, BOM and exports: stubs the DOM and WebGL, runs the app script from index.html.
const fs = require('fs'), vm = require('vm'), path = require('path');
const root = path.join(__dirname, '..');
const html = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
const scripts = [...html.matchAll(/<script>([\s\S]*?)<\/script>/g)].map(x => x[1]);
const app = scripts[scripts.length - 2];
const els = {};
const L = {};                                                           // listeners per element, so the tests can tap the canvas
const mk = id => ({ style: {}, dataset: {}, classList: { add() {}, remove() {}, toggle() {} }, querySelectorAll() { return []; }, querySelector() { return null; }, setAttribute() {}, getAttribute() { return null; }, addEventListener(t, f) { (L[id] = L[id] || {})[t] = f; }, click() {},
  getBoundingClientRect() { return { width: 800, height: 600, left: 0, top: 0 }; }, setPointerCapture() {}, clientHeight: 600, textContent: '', innerHTML: '', hidden: false, disabled: false, value: '4' });
const doc = { getElementById: id => els[id] || (els[id] = mk(id)), querySelectorAll: () => [], addEventListener() {} };
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
check('example BOM', ['Pipe, NPS 4 SCH 40, BE | 8.27 m', 'Pipe, NPS 3 SCH 40, BE | 0.75 m', 'Elbow 90° LR BW, NPS 4 SCH 40 | 2', 'Reducer concentric BW, NPS 4×3 SCH 40 | 1', 'Tee equal BW, NPS 4 SCH 40 | 1', 'Gate valve flanged 150#, NPS 4 | 2'].every(has), rows());
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
check('connected equipment has no warnings', PD.warns().filter(w => !w.includes('without a support')).length === 0, PD.warns().join('\n'));
PD.load({ pipes: [], valves: [], equip: [{ k: 'pump', p: [0, 0, 0], r: 0 }] });
PD.routeTo([-2, 0.7, -1], arr(PD.nozzles()[1]), PD.nozzles()[1]);    // NPS 4 pipe into an NPS 3 nozzle
PD.rebuild();
check('size mismatch at a nozzle is reported', PD.warns().some(w => w.includes('NPS 3 but the pipe is NPS 4')), PD.warns().join('\n'));

// Isometric sheet symbols, tags and legend.
PD.load({
  pipes: [{ a: [0, 0, 0], b: [3, 0, 0], n: 4 }, { a: [3, 0, 0], b: [6, 0, 0], n: 4 }, { a: [6, 0, 0], b: [8, 0, 0], n: 3 }, { a: [3, 0, 0], b: [3, 0, 2], n: 2 }],
  valves: [{ p: [0.6, 0, 0], d: [1, 0, 0], n: 4, k: 'globe' }, { p: [1.2, 0, 0], d: [1, 0, 0], n: 4, k: 'gate' }, { p: [1.8, 0, 0], d: [1, 0, 0], n: 4, k: 'control' }],
  flanges: [{ p: [2.4, 0, 0], d: [1, 0, 0], n: 4, t: 'so' }],
  items: [{ p: [4.2, 0, 0], d: [1, 0, 0], n: 4, t: 'strainer' }],
  caps: [[8, 0, 0, 'plug']], equip: [{ k: 'pump', p: [-2, 0, 0], r: 0 }]
});
const iso = PD.iso();
check('iso sheet tags each item', ['GL-1', 'GV-1', 'FCV-1', 'FL-1', 'ST-1', 'P-1'].every(t => iso.includes('>' + t + '<')), iso.match(/>[A-Z]+-\d+</g) + '');
check('iso sheet legend lists used symbols only', iso.includes('Globe valve') && iso.includes('Reducer') && iso.includes('Plug, threaded') && iso.includes('Olet or stub-in') && !iso.includes('Butterfly valve'));
check('symbol reference sheet lists everything', PD.legend().includes('PIPING SYMBOLS') && ['Butterfly valve', 'Lap-joint flange pair', 'Expansion joint', 'Spectacle blind', 'Vertical vessel', 'Butt weld'].every(n => PD.legend().includes(n)));
if (process.env.PD_WRITE_SVG) {                                        // optional: write the sheets out for a visual check
  fs.writeFileSync(path.join(process.env.PD_WRITE_SVG, 'sheet.svg'), iso);
  fs.writeFileSync(path.join(process.env.PD_WRITE_SVG, 'legend.svg'), PD.legend());
}

// Instruments and the P&ID sheet.
const loop = {
  equip: [{ k: 'pump', p: [0, 0, 0], r: 0 }, { k: 'vessel', p: [9, 0, 0], r: 0 }],
  pipes: [{ a: [-0.15, 0.7, 0], b: [-0.15, 2, 0], n: 3 }, { a: [-0.15, 2, 0], b: [4, 2, 0], n: 3 }, { a: [4, 2, 0], b: [7, 2, 0], n: 3 }, { a: [4, 2, 0], b: [4, 2, 3], n: 3 }],
  valves: [{ p: [1.5, 2, 0], d: [1, 0, 0], n: 3, k: 'control' }, { p: [5.5, 2, 0], d: [1, 0, 0], n: 3, k: 'gate' }],
  instr: [
    { k: 'FT', p: [0.9, 2, 0], d: [1, 0, 0], n: 3, num: 101 },
    { k: 'FIC', p: [2.6, 2, 0], d: [1, 0, 0], n: 3, num: 101, link: 0 },
    { k: 'PSV', p: [4, 2, 1.5], d: [0, 0, 1], n: 3, num: 101 },
    { k: 'LT', eq: 1, p: [9.6, 1, 0], num: 101 }
  ]
};
PD.load(loop);
check('instruments in BOM', has('Flow transmitter FT-101 | 1') && has('Flow controller FIC-101 | 1') && has('Pressure safety valve PSV-101 | 1') && has('Level transmitter LT-101 | 1'), rows());
const isoI = PD.iso();
check('iso sheet draws bubbles, PSV symbol and the signal line', isoI.includes('>FIC<') && isoI.includes('>PSV-101<') && isoI.includes('stroke-dasharray="4 3"') && isoI.includes('Signal line') && isoI.includes('Field instrument'));
const pid = PD.pid();
check('P&ID sheet renders', /^<svg/.test(pid) && pid.includes('P&amp;ID (SCHEMATIC)') && !pid.includes('NaN'));
check('P&ID uses the same tags as the iso sheet', ['P-1', 'V-1', 'FCV-1', 'GV-1'].every(t => pid.includes('>' + t + '<') && isoI.includes('>' + t + '<')), pid.match(/>[A-Z]+-\d+</g) + '');
check('P&ID shows instrument bubbles, loop numbers and a signal line', pid.includes('>FT<') && pid.includes('>FIC<') && pid.includes('>LT<') && pid.includes('>101<') && pid.includes('Signal line'));
check('P&ID shows line number and size', pid.includes('L-001 · NPS 3'));
check('P&ID puts the branch on its own row', new Set([...pid.matchAll(/<line x1="[\d.]+" y1="([\d.]+)" x2="[\d.]+" y2="\1" stroke="#14191c" stroke-width="1.8"/g)].map(m => m[1])).size >= 2);
PD.load({ pipes: [{ a: [0, 0, 0], b: [4, 0, 0], n: 4 }], valves: [], instr: [{ k: 'PT', p: [2, 1, 1], d: [1, 0, 0], n: 4, num: 101 }] });
check('instrument off the pipe is reported', PD.warns().some(w => w.includes('PT-101 is not on a pipe')), PD.warns().join('\n'));
PD.load({ pipes: [], valves: [] });
check('P&ID empty returns null', PD.pid() === null);

// Flow direction.
PD.load({ pipes: [{ a: [0, 0, 0], b: [2, 0, 0], n: 4, fl: 1 }, { a: [4, 0, 0], b: [2, 0, 0], n: 4, fl: 1 }], valves: [] });
check('head-on flow is reported', PD.warns().some(w => w.includes('Flow meets head-on')), PD.warns().join('\n'));
PD.load({ pipes: [{ a: [0, 0, 0], b: [2, 0, 0], n: 4, fl: 1 }, { a: [2, 0, 2], b: [2, 0, 0], n: 4 }, { a: [2, 0, 2], b: [2, 0, 5], n: 4 }], valves: [] });
PD.setRunFlow(0, 1);
check('flow carries along a run through elbows', PD.model.pipes.map(p => p.fl).join() === '1,-1,1', PD.model.pipes.map(p => p.fl).join());
check('consistent flow gives no warning', !PD.warns().some(w => w.includes('Flow meets')), PD.warns().join('\n'));
const chk = rev => ({ pipes: [{ a: [0, 0, 0], b: [4, 0, 0], n: 4, fl: 1 }], valves: [{ p: [2, 0, 0], d: [1, 0, 0], n: 4, k: 'check', rev }] });
PD.load(chk(true));
check('check valve against the flow is reported', PD.warns().some(w => w.includes('CV-1 faces against the flow')), PD.warns().join('\n'));
PD.load(chk(false));
check('check valve with the flow is fine', !PD.warns().some(w => w.includes('faces against')));
PD.load(Object.assign(chk(false), { pipes: [{ a: [0, 0, 0], b: [4, 0, 0], n: 4, fl: 1 }, { a: [4, 0, 0], b: [4, 0, 3], n: 4, fl: 1 }] }));
check('flow arrows appear on the iso sheet and P&ID', PD.iso().includes('Flow direction') && PD.pid().includes('Flow direction'));

// Supports.
const longPipe = sup => ({ pipes: [{ a: [0, 1, 0], b: [9, 1, 0], n: 4 }], valves: [], supports: sup });
PD.load(longPipe([]));
check('long unsupported span is reported', PD.warns().some(w => w.includes('spans 9.0 m without a support')), PD.warns().join('\n'));
PD.load(longPipe([{ p: [3, 1, 0], d: [1, 0, 0], n: 4, t: 'shoe' }, { p: [6, 1, 0], d: [1, 0, 0], n: 4, t: 'guide' }]));
check('supports clear the span warning', !PD.warns().some(w => w.includes('without a support')), PD.warns().join('\n'));
check('support BOM names', has('Pipe shoe, NPS 4 | 1') && has('Pipe guide, NPS 4 | 1'), rows());
PD.load(longPipe([{ p: [3, 1, 0], d: [1, 0, 0], n: 4, t: 'anchor' }, { p: [6, 1, 0], d: [1, 0, 0], n: 4, t: 'hanger' }, { p: [8, 1, 0], d: [1, 0, 0], n: 4, t: 'spring' }]));
check('anchor, hanger and spring hanger', has('Pipe anchor, NPS 4 | 1') && has('Rod hanger, NPS 4 | 1') && has('Spring hanger, NPS 4 | 1'), rows());
const isoS = PD.iso();
check('supports are tagged on the iso sheet', ['AN-1', 'HG-1', 'SPH-1'].every(t => isoS.includes('>' + t + '<')) && isoS.includes('Rod hanger'), isoS.match(/>[A-Z]+-\d+</g) + '');
PD.load({ pipes: [{ a: [0, 0, 0], b: [0, 3, 0], n: 4 }], valves: [], supports: [{ p: [0, 1.5, 0], d: [0, 1, 0], n: 4, t: 'guide' }] });
check('guide on a vertical pipe', has('Pipe guide, NPS 4 | 1'), rows());
PD.load({ pipes: [{ a: [0, 0, 0], b: [2, 0, 0], n: 4 }], valves: [], supports: [{ p: [1, 0, 0], d: [1, 0, 0], n: 4, t: 'bogus' }] });
check('unknown support types are dropped on load', PD.model.supports.length === 0);

// Hydraulics, checked against the Python `fluids` package (Clamond friction factor, Crane reducer K).
const close = (a, b, tol) => Math.abs(a - b) <= tol * Math.abs(b);
const refF = [[1000, 0.0004, 0.064], [1500, 0, 0.042666667], [1e4, 0.0004, 0.031493946], [5e4, 0.0004, 0.022250309], [1e5, 0.0004, 0.019908649], [1e6, 0.0004, 0.016487589], [2e5, 0.0005, 0.01881979]];
check('friction factor matches fluids across laminar and turbulent', refF.every(([Re, eD, f]) => close(PD.friction(Re, eD), f, 0.03)), refF.map(([Re, eD, f]) => PD.friction(Re, eD).toFixed(5) + '/' + f.toFixed(5)).join('  '));
const hy = (extra, q) => { PD.load(Object.assign({ valves: [], fluid: 'water20', lines: { 'L-001': { q: q == null ? 50 : q } } }, extra)); return PD.hyd(); };
let H = hy({ pipes: [{ a: [0, 0, 0], b: [100, 0, 0], n: 4, fl: 1 }] });
check('NPS 4 line: velocity and Reynolds number', close(H.pipes[0].v, 1.69109, 0.001) && close(H.pipes[0].Re, 172585, 0.002), JSON.stringify(H.pipes[0]));
check('NPS 4 line: friction drop matches fluids (26.2 kPa per 100 m)', close(H.lines['L-001'].dpF, 26219, 0.015), String(H.lines['L-001'].dpF));
const dyn = 998 * Math.pow(50 / 3600 / (Math.PI * 0.10226 * 0.10226 / 4), 2) / 2;
H = hy({ pipes: [{ a: [0, 0, 0], b: [2, 0, 0], n: 4, fl: 1 }, { a: [2, 0, 0], b: [2, 0, 2], n: 4, fl: 1 }] });
check('LR elbow drop is 14 fT x velocity head', close(H.fits.find(f => f.label.startsWith('Elbow')).dp, 14 * 0.017 * dyn, 0.01), JSON.stringify(H.fits));
const redu = fl => ({ pipes: [{ a: [0, 0, 0], b: [3, 0, 0], n: 4, fl }, { a: [3, 0, 0], b: [6, 0, 0], n: 3, fl }] });
H = hy(redu(1));
const dsm = 998 * Math.pow(50 / 3600 / (Math.PI * 0.07792 * 0.07792 / 4), 2) / 2;
check('reducer contraction K matches the Crane value in fluids (0.0397)', close(H.fits.find(f => f.label.startsWith('Reducer')).K, 0.039749, 0.02) && H.fits[0].label.includes('contraction'), JSON.stringify(H.fits));
check('reducer drop uses the small-bore velocity head', close(H.fits[0].dp, 0.039749 * dsm, 0.03));
H = hy(redu(-1));
check('reducer expansion K matches the Crane value in fluids (0.0542)', close(H.fits.find(f => f.label.startsWith('Reducer')).K, 0.054178, 0.02) && H.fits[0].label.includes('expansion'), JSON.stringify(H.fits));
H = hy({ pipes: [{ a: [0, 0, 0], b: [4, 0, 0], n: 4, fl: 1 }], valves: [{ p: [2, 0, 0], d: [1, 0, 0], n: 4, k: 'control' }] });
check('control valve K from Cv (4.43 for NPS 4)', close(H.fits[0].K, 4.425, 0.01), JSON.stringify(H.fits));
H = hy({ pipes: [{ a: [0, 0, 0], b: [4, 0, 0], n: 4, fl: 1 }], valves: [{ p: [2, 0, 0], d: [1, 0, 0], n: 4, k: 'globe' }, { p: [3, 0, 0], d: [1, 0, 0], n: 4, k: 'gate' }] });
check('globe and gate valve K', close(H.fits.find(f => f.label.startsWith('Globe')).K, 340 * 0.017, 0.001) && close(H.fits.find(f => f.label.startsWith('Gate')).K, 8 * 0.017, 0.001));
check('valve length comes off the pipe length', close(H.pipes[0].len, 4 - 0.292 - 0.229, 0.001), String(H.pipes[0].len));
H = hy({ pipes: [{ a: [0, 0, 0], b: [0, 10, 0], n: 4, fl: 1 }] });
check('static head of a 10 m rise', close(H.lines['L-001'].dpZ, 998 * 9.81 * 10, 0.001) && H.lines['L-001'].useZ, JSON.stringify(H.lines['L-001']));
H = hy({ pipes: [{ a: [0, 0, 0], b: [0, 10, 0], n: 4 }] });
check('no elevation term when flow is not set', !H.lines['L-001'].useZ);
H = hy({ pipes: [{ a: [0, 0, 0], b: [20, 0, 0], n: 4, fl: 1 }] }, 150);
check('velocity above 3 m/s is reported', PD.warns().some(w => w.includes('Line L-001: velocity 5.1 m/s')), PD.warns().join('\n'));
H = hy({ pipes: [{ a: [0, 0, 0], b: [20, 0, 0], n: 4, fl: 1 }] }, 0);
check('no flow entered means no hydraulics warning', !PD.warns().some(w => w.includes('velocity')));
PD.load({ pipes: [{ a: [0, 0, 0], b: [10, 0, 0], n: 4, fl: 1 }], valves: [], fluid: 'oil', lines: { 'L-001': { q: 2 } } });
H = PD.hyd();
check('viscous oil at low flow is laminar and uses 64/Re', H.lines['L-001'].Remin < 2300 && close(H.pipes[0].f, 64 / H.pipes[0].Re, 0.01), JSON.stringify(H.pipes[0]));
PD.load({ pipes: [{ a: [0, 0, 0], b: [10, 0, 0], n: 4, ln: 'L-001' }, { a: [0, 0, 5], b: [10, 0, 5], n: 4, ln: 'L-002' }], valves: [], lines: { 'L-001': { q: 40 }, 'L-002': { q: 20 } } });
H = PD.hyd();
check('each line number has its own flow and drop', H.lines['L-001'].dpF > H.lines['L-002'].dpF && H.lines['L-002'].dpF > 0);
PD.load({ pipes: [{ a: [0, 0, 0], b: [10, 0, 0], n: 4 }], valves: [], fluid: 'unobtainium' });
check('unknown fluid falls back to water', PD.model.fluid === 'water20');

// Drawing by aiming: the axis comes from where you point, and up the screen is Z.
let pid_ = 1;
const tapAt = (x, y) => { const e = { pointerId: pid_++, pointerType: 'touch', clientX: x, clientY: y }; L.cv.pointerdown(Object.assign({ type: 'pointerdown' }, e)); L.cv.pointerup(Object.assign({ type: 'pointerup' }, e)); };
const tapOn = p => { const s = PD.project(p); tapAt(s.x, s.y); };
const lastPipe = () => PD.model.pipes[PD.model.pipes.length - 1];
const near = (a, b) => a.every((v, i) => Math.abs(v - b[i]) < 0.011);
PD.load({ pipes: [], valves: [] });
els['t-pipe'].onclick(); els['ax-auto'].onclick(); els['finish'].onclick();
for (let i = 0; i < 6; i++) els['down'].onclick();                      // with no run active this lowers the start plane to the floor
tapOn([0, 0, 0]);
tapOn([0, 2.3, 0]);
check('tap straight up the screen draws a vertical pipe', PD.model.pipes.length === 1 && near(lastPipe().b, [0, 2.3, 0]), JSON.stringify(PD.model.pipes));
tapOn([3, 2.3, 0]);
check('tap along X draws along X from the new height', near(lastPipe().a, [0, 2.3, 0]) && near(lastPipe().b, [3, 2.3, 0]), JSON.stringify(lastPipe()));
tapOn([3, 2.3, -2]);
check('tap along Y (scene Z) draws horizontally', near(lastPipe().b, [3, 2.3, -2]), JSON.stringify(lastPipe()));
tapOn([3, 0.5, -2]);
check('and straight down again, at the same spot', near(lastPipe().a, [3, 2.3, -2]) && near(lastPipe().b, [3, 0.5, -2]), JSON.stringify(lastPipe()));
tapOn([3, -1, -2]);
check('nothing is drawn below the floor', PD.model.pipes.length === 4, String(PD.model.pipes.length));
els['finish'].onclick();
for (let i = 0; i < 6; i++) els['down'].onclick();
tapOn([-3, 0, 3]);
els['ax-z'].onclick();
const s1 = PD.project([-3, 1.5, 3]);                                     // above the start, but 60 px to the side
tapAt(s1.x + 60, s1.y);
check('locking Z keeps the pipe vertical wherever you tap', near(lastPipe().a, [-3, 0, 3]) && lastPipe().b[0] === -3 && lastPipe().b[2] === 3 && lastPipe().b[1] > 0, JSON.stringify(lastPipe()));
els['ax-auto'].onclick();
els['finish'].onclick();

// Sizes from NPS 1/2 to 12.
const hyd = (pipes, q, extra) => { PD.load(Object.assign({ pipes, valves: [], lines: { 'L-001': { q } } }, extra)); return PD.hyd(); };
H = hyd([{ a: [0, 0, 0], b: [10, 0, 0], n: 0.5, fl: 1 }], 1);
check('NPS 1/2 line: drop matches fluids (19.75 kPa per 10 m)', close(H.lines['L-001'].dpF, 19751.8, 0.03) && close(H.pipes[0].v, 1.42395, 0.002), JSON.stringify(H.pipes[0]));
H = hyd([{ a: [0, 0, 0], b: [10, 0, 0], n: 12, fl: 1 }], 300);
check('NPS 12 line: drop matches fluids (340 Pa per 10 m)', close(H.lines['L-001'].dpF, 340.4, 0.04) && close(H.pipes[0].v, 1.15356, 0.002), JSON.stringify(H.pipes[0]));
PD.load({ pipes: [{ a: [0, 0, 0], b: [10, 0, 0], n: 12 }], valves: [] });
check('NPS 12 pipe weight about 79.7 kg/m', close(parseFloat(PD.rows().find(r => r[0].startsWith('Pipe weight'))[1]), 797.3, 0.005));
PD.load({ pipes: [{ a: [0, 0, 0], b: [9, 0, 0], n: 6 }, { a: [9, 0, 0], b: [12, 0, 0], n: 4 }], valves: [], lines: { 'L-001': { q: 80 } } });
H = PD.hyd();
check('6 x 4 reducer is 140 mm long and its K matches fluids', close(H.fits[0].K, 0.081459, 0.02) && H.pipes[0].len > 8.9 - 0.141 && H.pipes[0].len < 9 - 0.069, JSON.stringify(H.fits) + ' ' + H.pipes[0].len);
check('all twelve sizes have a full catalogue row', [0.5, 0.75, 1, 1.5, 2, 2.5, 3, 4, 6, 8, 10, 12].every(n => {
  PD.load({ pipes: [{ a: [0, 0, 0], b: [8, 0, 0], n }, { a: [8, 0, 0], b: [8, 0, 8], n }, { a: [8, 0, 4], b: [14, 0, 4], n }], valves: [{ p: [3, 0, 0], d: [1, 0, 0], n, k: 'gate' }], items: [{ p: [5, 0, 0], d: [1, 0, 0], n, t: 'coupling' }], flanges: [{ p: [6, 0, 0], d: [1, 0, 0], n, t: 'wn' }], lines: { 'L-001': { q: 1 } } });
  return PD.rows().length > 6 && !PD.rows().some(r => /NaN|undefined/.test(r[0] + r[1])) && PD.hyd().lines['L-001'].total >= 0;
}));
PD.load({ pipes: [{ a: [0, 0, 0], b: [2, 0, 0], n: 1.5 }, { a: [2, 0, 0], b: [2, 0, 2], n: 1.5 }, { a: [2, 0, 2], b: [4, 0, 2], n: 2.5 }], valves: [] });
check('size labels read as 1-1/2 and 2-1/2', has('Pipe, NPS 1-1/2 SCH 40, PE') && has('Pipe, NPS 2-1/2 SCH 40, BE') && has('Elbow 90° LR SW 3000#, NPS 1-1/2 SCH 40'), rows());
const small = sp => ({ spec: sp, pipes: [{ a: [0, 0, 0], b: [2, 0, 0], n: 1 }, { a: [2, 0, 0], b: [2, 0, 2], n: 1 }], valves: [], caps: [[2, 0, 2]] });
PD.load(small({ small: 'THD' }));
check('threaded small bore', has('Pipe, NPS 1 SCH 40, TE') && has('Elbow 90° LR THD 3000#, NPS 1 SCH 40') && has('Cap THD 3000#, NPS 1 SCH 40'), rows());
PD.load(small({ small: 'BW' }));
check('butt-weld small bore', has('Pipe, NPS 1 SCH 40, BE') && has('Elbow 90° LR BW, NPS 1 SCH 40'), rows());
PD.load({ pipes: [{ a: [0, 0, 0], b: [2, 0, 0], n: 4 }, { a: [2, 0, 0], b: [2, 0, 2], n: 4 }], valves: [] });
check('large bore stays butt-weld whatever the small bore setting', has('Elbow 90° LR BW, NPS 4 SCH 40'));
PD.load({ pipes: [{ a: [0, 0, 0], b: [3, 0, 0], n: 12 }, { a: [3, 0, 0], b: [3, 0, 3], n: 12 }], valves: [] });
check('large elbow takes 1.5 x 12 inches of radius', close(PD.hyd().pipes[0].len, 3 - 1.5 * 12 * 0.0254, 0.001), String(PD.hyd().pipes[0].len));

// More valves, inline fittings, flanges, branches.
const kinds = { angle: 'Angle valve flanged 150#, NPS 4', needle: 'Needle valve SW 800#, NPS 1', diaphragm: 'Diaphragm valve flanged 150#, NPS 4', knife: 'Knife gate valve wafer 150#, NPS 4', threeway: 'Three-way valve flanged 150#, NPS 4', footv: 'Foot valve flanged 150#, NPS 4' };
Object.keys(kinds).forEach(k => {
  const n = k === 'needle' ? 1 : 4;
  PD.load({ pipes: [{ a: [0, 0, 0], b: [3, 0, 0], n }], valves: [{ p: [1.5, 0, 0], d: [1, 0, 0], n, k }] });
  check(k + ' valve', has(kinds[k] + ' | 1'), rows());
});
const items = { sight: 'Sight glass, flanged 150#, NPS 4', flowmeter: 'Flow meter, magnetic, flanged 150#, NPS 4', basket: 'Basket strainer, flanged 150#, NPS 4', trap: 'Steam trap, thermodynamic, SW, NPS 4', rupture: 'Rupture disc assembly 150#, NPS 4', flame: 'Flame arrestor, flanged 150#, NPS 4', hose: 'Flexible hose, camlock, NPS 4' };
PD.load({ pipes: [{ a: [0, 0, 0], b: [14, 0, 0], n: 4 }], valves: [], items: Object.keys(items).map((t, i) => ({ p: [1 + i * 1.8, 0, 0], d: [1, 0, 0], n: 4, t })) });
check('seven more inline fittings', Object.keys(items).every(t => has(items[t] + ' | 1')), rows());
check('their lengths come off the pipe', PD.hyd().pipes[0].len < 14 - 1, String(PD.hyd().pipes[0].len));
const fls = { th: 'Threaded flange 150# THD, NPS 4 | 2', sw: 'Socket-weld flange 150# SW, NPS 4 SCH 40 | 2', ro: 'Orifice flange 150# WN with taps, NPS 4 SCH 40 | 2' };
Object.keys(fls).forEach(t => { PD.load({ pipes: [{ a: [0, 0, 0], b: [4, 0, 0], n: 4 }], valves: [], flanges: [{ p: [2, 0, 0], d: [1, 0, 0], n: 4, t }] }); check(t + ' flange pair', has(fls[t]), rows()); });
check('orifice flange pair brings its plate', has('Orifice plate, NPS 4 | 1'));
PD.load({ spec: { reducer: 'swage' }, pipes: [{ a: [0, 0, 0], b: [2, 0, 0], n: 2 }, { a: [2, 0, 0], b: [4, 0, 0], n: 1 }], valves: [] });
check('swage nipple', has('Swage nipple concentric, PBE, NPS 2×1 SCH 40 | 1'), rows());
const br = (extra, nb) => { PD.load(Object.assign({ pipes: [{ a: [0, 0, 0], b: [4, 0, 0], n: 6 }], valves: [] }, extra)); PD.addPipe([2, 0, 0], [2, 0, 2], nb, 40); PD.rebuild(); };
br({ spec: { olet: 'halfcoupling' } }, 2);
check('half coupling branch', has('Half coupling SW 3000#, NPS 6×2 SCH 40 | 1'), rows());
br({ spec: { olet: 'nippolet' } }, 2);
check('nippolet branch', has('Nippolet BW, NPS 6×2 SCH 40 | 1'), rows());
br({ fit: { '2000,0,0': { br: 'stubpad' } } }, 4);
check('stub-in with reinforcing pad', has('Stub-in branch with reinforcing pad, PE, NPS 6×4 SCH 40 | 1'), rows());

// Branch, reducer and return bend tools, driven by taps.
const chipTap = (cat, val) => L.parts.click({ target: { closest: () => ({ dataset: { cat, chip: val } }) } });
const setSize = n => { els['fsz'].value = String(n); els['fsz'].onchange(); };
const fresh = (pipes, extra) => { PD.load(Object.assign({ pipes, valves: [] }, extra)); els['finish'].onclick(); };
const run4 = () => [{ a: [0, 1, 0], b: [6, 1, 0], n: 4 }];
els['bd-up'].onclick();
fresh(run4()); chipTap('branch', 'tee'); tapOn([3, 1, 0]);
check('tee tool splits the pipe and starts a same-size branch', PD.model.pipes.length === 3 && near(lastPipe().b, [3, 1.3, 0]) && has('Tee equal BW, NPS 4 SCH 40 | 1') && PD.cursor() !== null, rows() + JSON.stringify(PD.model.pipes));
fresh(run4()); setSize(2); chipTap('branch', 'rtee'); tapOn([3, 1, 0]);
check('reducing tee tool uses the size you set', has('Tee reducing BW, NPS 4×2 SCH 40 | 1') && lastPipe().n === 2, rows());
fresh(run4()); setSize(1); chipTap('branch', 'sockolet'); tapOn([3, 1, 0]);
check('sockolet tool', has('Sockolet SW, NPS 4×1 SCH 40 | 1'), rows());
fresh(run4()); setSize(2); chipTap('branch', 'weldolet'); tapOn([3, 1, 0]);
check('weldolet tool on a branch half the size', has('Weldolet BW, NPS 4×2 SCH 40 | 1'), rows());
fresh(run4()); setSize(3); chipTap('branch', 'weldolet'); tapOn([3, 1, 0]);
check('olet tool takes any branch smaller than the pipe, even over half size', has('Weldolet BW, NPS 4×3 SCH 40 | 1'), rows());
fresh(run4()); setSize(4); chipTap('branch', 'weldolet'); const nBefore = PD.model.pipes.length; tapOn([3, 1, 0]);
check('olet tool refuses a branch the size of the pipe', PD.model.pipes.length === nBefore);
fresh(run4()); setSize(3); chipTap('branch', 'stubpad'); tapOn([3, 1, 0]);
check('stub-in with pad tool', has('Stub-in branch with reinforcing pad, PE, NPS 4×3 SCH 40 | 1'), rows());
fresh(run4()); setSize(4); chipTap('branch', 'lat'); tapOn([3, 1, 0]);
check('lateral tool leaves at 45°', has('Lateral 45° BW, NPS 4 SCH 40 | 1') && !PD.warns().some(w => w.includes('angle')), rows() + PD.warns().join());
fresh(run4()); setSize(4); chipTap('branch', 'cross'); tapOn([3, 1, 0]);
check('cross tool makes two opposite branches', has('Cross BW, NPS 4 SCH 40 | 1') && PD.model.pipes.length === 4, rows());
fresh(run4()); setSize(6); chipTap('branch', 'rtee'); const nB2 = PD.model.pipes.length; tapOn([3, 1, 0]);
check('a branch larger than the pipe is refused', PD.model.pipes.length === nB2);
fresh(run4()); setSize(2); chipTap('branch', 'tee'); tapOn([0.01, 1, 0]);
check('tapping at the very end of a pipe does not branch', PD.model.pipes.length === 1, JSON.stringify(PD.model.pipes));

fresh(run4()); setSize(3); chipTap('reduce', 'conc'); tapOn([1, 1, 0]);
check('reducer tool changes the size toward the nearer end', PD.model.pipes.map(p => p.n).join() === '3,4' && has('Reducer concentric BW, NPS 4×3 SCH 40 | 1'), rows() + PD.model.pipes.map(p => p.n).join());
fresh(run4()); setSize(3); chipTap('reduce', 'conc'); tapOn([5, 1, 0]);
check('and toward the other end when you tap there', PD.model.pipes.map(p => p.n).join() === '4,3', PD.model.pipes.map(p => p.n).join());
fresh(run4()); setSize(3); chipTap('reduce', 'ecc'); tapOn([1, 1, 0]);
check('eccentric reducer tool', has('Reducer eccentric (flat on bottom) BW, NPS 4×3'), rows());
fresh([{ a: [0, 1, 0], b: [2, 1, 0], n: 2 }]); setSize(1); chipTap('reduce', 'swage'); tapOn([1.8, 1, 0]);
check('swage nipple tool', has('Swage nipple concentric, PBE, NPS 2×1'), rows());
fresh([{ a: [0, 1, 0], b: [2, 1, 0], n: 2 }]); setSize(1); chipTap('reduce', 'bushing'); tapOn([1.8, 1, 0]);
check('reducing bushing tool', has('Reducing bushing, THD 3000#, NPS 2×1'), rows());
fresh([{ a: [0, 1, 0], b: [2, 1, 0], n: 2 }]); setSize(1); chipTap('reduce', 'rcoupling'); tapOn([1.8, 1, 0]);
check('reducing coupling tool', has('Reducing coupling SW 3000#, NPS 2×1'), rows());
fresh([{ a: [0, 0, 0], b: [3, 0, 0], n: 4 }, { a: [3, 0, 0], b: [3, 0, 3], n: 4 }], { valves: [{ p: [3, 0, 1.5], d: [0, 0, 1], n: 4, k: 'gate' }] });
setSize(3); chipTap('reduce', 'conc'); tapOn([2.4, 0, 0]);
check('the new size runs on through elbows to the next node, and valves follow', PD.model.pipes.map(p => p.n).join() === '4,3,3' && PD.model.valves[0].n === 3 && !PD.warns().some(w => w.includes('Size change at an elbow')), PD.model.pipes.map(p => p.n).join() + PD.warns().join());
fresh(run4()); setSize(4); chipTap('reduce', 'conc'); const nB3 = PD.model.pipes.length; tapOn([3, 1, 0]);
check('reducer to the same size is refused', PD.model.pipes.length === nB3);

fresh(run4()); chipTap('cap', 'ret'); els['bd-near'].onclick(); tapOn([5.95, 1, 0]);
check('return bend tool builds a U and reports one fitting', PD.model.pipes.length === 3 && has('Return bend 180° LR BW, NPS 4 SCH 40 | 1') && !has('Elbow 90°') && !PD.warns().some(w => w.includes('shorter than the fittings')), rows() + PD.warns().join());
els['bd-up'].onclick();
fresh(run4()); chipTap('cap', 'ret'); els['bd-up'].onclick(); tapOn([5.95, 1, 0]);
check('return bend can go up', near(PD.model.pipes[1].b, [6, 1 + 2 * 1.5 * 4 * 0.0254, 0]) && has('Return bend 180°'), JSON.stringify(PD.model.pipes[1]));

// Three-way valve with a real side port.
PD.load({ pipes: [{ a: [0, 0, 0], b: [4, 0, 0], n: 4 }], valves: [{ p: [2, 0, 0], d: [1, 0, 0], n: 4, k: 'threeway' }] });
const port = PD.nozzles().find(z => z.e === -1);
check('three-way valve has a side port you can connect to', port && near(arr(port), [2, 0, -0.1955]) && Math.abs(port.d.z + 1) < 1e-6 && port.n === 4, JSON.stringify(PD.nozzles().map(arr)));
PD.model.valves[0].rot = 1; PD.rebuild();
check('turning the port moves it around the pipe', Math.abs(PD.nozzles().find(z => z.e === -1).d.y - 1) < 1e-6);
PD.startAtNozzle(PD.nozzles().find(z => z.e === -1)); PD.rebuild();
check('a pipe starts on the port along its axis, with P&ID still working', PD.model.pipes.length === 2 && near(PD.model.pipes[1].a, arr(PD.nozzles().find(z => z.e === -1))) && /^<svg/.test(PD.pid()) && PD.warns().length === 0, PD.warns().join());
PD.load({ pipes: [{ a: [0, 0, 0], b: [4, 0, 0], n: 4 }], valves: [], items: [{ p: [2, 0, 0], d: [1, 0, 0], n: 4, t: 'nipple' }] });
check('pipe nipple', has('Pipe nipple, 150 mm, PBE, NPS 4 | 1'), rows());

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
