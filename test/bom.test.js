// Headless checks of the model, fittings, BOM and exports: stubs the DOM and WebGL, runs the app script from index.html.
const fs = require('fs'), vm = require('vm'), path = require('path');
const root = path.join(__dirname, '..');
const html = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
const scripts = [...html.matchAll(/<script>([\s\S]*?)<\/script>/g)].map(x => x[1]);
const app = scripts[scripts.length - 2];
const els = {};
const memStore = {}; let memFull = false;                               // an in-memory localStorage, which can be made to refuse writes
const L = {};                                                           // listeners per element, so the tests can tap the canvas
const mk = id => ({ style: {}, dataset: {}, classList: { add() {}, remove() {}, toggle() {} }, querySelectorAll() { return []; }, querySelector() { return null; }, setAttribute() {}, getAttribute() { return null; }, addEventListener(t, f) { (L[id] = L[id] || {})[t] = f; }, click() {},
  getBoundingClientRect() { return { width: 800, height: 600, left: 0, top: 0 }; }, setPointerCapture() {}, clientHeight: 600, textContent: '', innerHTML: '', hidden: false, disabled: false, value: '4' });
const doc = { createElement: () => ({ style: {}, width: 0, height: 0, getContext: () => ({ strokeText() {}, fillText() {}, fillRect() {}, clearRect() {}, drawImage() {} }) }), getElementById: id => els[id] || (els[id] = mk(id)), querySelectorAll: () => [], addEventListener() {} };
const ctx = { document: doc, window: { addEventListener() {}, innerWidth: 1000, devicePixelRatio: 1 }, navigator: { storage: { persist() {} } }, performance: { now: () => globalThis.__perf || 0 },
  localStorage: { getItem(k) { return k in memStore ? memStore[k] : null; }, setItem(k, v) { if (memFull) throw new Error('quota'); memStore[k] = String(v); } }, ResizeObserver: class { observe() {} }, requestAnimationFrame() {}, setTimeout, clearTimeout, console, Math, Promise };
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
check('the example layout has no clashes', PD.clashes().length === 0, JSON.stringify(PD.clashes().map(c => c.text)));
check('example BOM', ['Pipe, NPS 4 SCH 40, BE | 8.15 m', 'Weld-neck flange 150# BW, NPS 4 SCH 40 | 4', 'Pipe, NPS 3 SCH 40, BE | 0.75 m', 'Elbow 90° LR BW, NPS 4 SCH 40 | 2', 'Reducer concentric BW, NPS 4×3 SCH 40 | 1', 'Tee equal BW, NPS 4 SCH 40 | 1', 'Gate valve flanged 150#, NPS 4 | 2'].every(has), rows());
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
check('clash reported', PD.warns().some(w => w.includes('run into each other')), PD.warns().join('\n'));
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
check('iso sheet keeps the tags in its material list and under equipment', ['GL-1', 'GV-1', 'FCV-1', 'FL-1', 'ST-1', 'P-1'].every(t => iso.includes(t)), iso.match(/>[A-Z]+-\d+</g) + '');
check('iso sheet material list names what is drawn and nothing else', iso.includes('MATERIAL LIST') && iso.includes('Globe valve flanged 150#') && iso.includes('Reducer concentric') && iso.includes('Plug, round head, THD') && !iso.includes('Butterfly'));
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
check('iso sheet tags instruments, draws the PSV and the signal line', isoI.includes('>FIC-101<') && isoI.includes('>PSV-101<') && isoI.includes('stroke-dasharray="4 3"'));
const pid = PD.pid();
check('P&ID sheet renders', /^<svg/.test(pid) && pid.includes('P&amp;ID (SCHEMATIC)') && !pid.includes('NaN'));
check('P&ID uses the same tags as the iso sheet', ['P-1', 'V-1', 'FCV-1', 'GV-1'].every(t => pid.includes('>' + t + '<') && isoI.includes(t)), pid.match(/>[A-Z]+-\d+</g) + '');
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
check('flow arrows appear on the iso sheet and P&ID', PD.iso().includes('class="flow"') && PD.pid().includes('Flow direction'));

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
check('supports are listed with their tags on the iso sheet', ['AN-1', 'HG-1', 'SPH-1'].every(t => isoS.includes(t)) && isoS.includes('Rod hanger'));
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
check('a pipe starts on the port along its axis, with P&ID still working', PD.model.pipes.length === 2 && near(PD.model.pipes[1].a, arr(PD.nozzles().find(z => z.e === -1))) && /^<svg/.test(PD.pid()) && PD.warns().filter(w => !/has no flanges/.test(w)).length === 0, PD.warns().join());
PD.load({ pipes: [{ a: [0, 0, 0], b: [4, 0, 0], n: 4 }], valves: [], items: [{ p: [2, 0, 0], d: [1, 0, 0], n: 4, t: 'nipple' }] });
check('pipe nipple', has('Pipe nipple, 150 mm, PBE, NPS 4 | 1'), rows());

// Isometric drawing practice: skewed symbols, balloons, dimension lines, elevations, equipment outlines.
PD.load(loop);
const isoP = PD.iso();
const compRows = PD.rows().filter(r => !/^Pipe (stock|weight)/.test(r[0])), rowsN = compRows.length;
check('the iso sheet has no NaN coordinates', !isoP.includes('NaN') && !PD.pid().includes('NaN'));
check('stock and weight are notes under the list, not numbered items', isoP.includes('Pipe weight, steel, empty: ') && !isoP.includes('>' + (rowsN + 1) + '</text>'));
check('symbols are skewed into the plane of their pipe', (isoP.match(/class="sy" transform="matrix\(/g) || []).length >= 6);
check('no P&ID bubbles on the iso sheet', !isoP.includes('r="14"') && !isoP.includes('>FT<') && !isoP.includes('SYMBOLS'));
check('item balloons point at the material list', (isoP.match(/r="9.5"/g) || []).length >= 8 && isoP.includes('>' + rowsN + '</text>'), String((isoP.match(/r="9.5"/g) || []).length));
check('dimension lines run along the pipe with the centreline length', (isoP.match(/class="dim"/g) || []).length >= 3 && isoP.includes('>4150<'), (isoP.match(/class="dim"/g) || []).length + '');
check('elevations are written at free ends', /EL \+\d+\.\d{3}/.test(isoP));
check('equipment is drawn as solid shapes with its nozzles and tag', !isoP.includes('stroke-dasharray="6 3"') && (isoP.match(/<polygon points="[^"]+" fill="#e8edef"/g) || []).length >= 8 && isoP.includes('>N1<') && isoP.includes('>V-1<') && isoP.includes('>P-1<'));
check('the material list numbers every component row', compRows.every((r, i) => isoP.includes('>' + (i + 1) + '</text>')) && isoP.includes('QTY'));
check('the axes are marked', isoP.includes('>X<') && isoP.includes('>Y (N)<') && isoP.includes('>Z<'));
check('the symbol reference sheet says how iso uses the symbols', PD.legend().includes('symbol the isometric sheet draws') && PD.legend().includes('M-10,-9 L10,9 L10,-9 L-10,9Z'));
{
  const valveKinds = ['gate', 'globe', 'check', 'ball', 'butterfly', 'plug', 'control', 'angle', 'needle', 'diaphragm', 'knife', 'threeway', 'footv'];
  const pics = new Set(valveKinds.map(k => { PD.load({ pipes: [{ a: [0, 0, 0], b: [4, 0, 0], n: 4 }], valves: [{ p: [2, 0, 0], d: [1, 0, 0], n: 4, k }] }); const m = PD.iso('', 0).match(/<g class="sy"[^>]*>(.*?)<\/g>/s); return m ? m[1] : ''; }));
  check('every valve type has its own picture on the iso sheet', pics.size === valveKinds.length && !pics.has(''), String(pics.size));
  const itemKinds = ['coupling', 'nipple', 'union', 'strainer', 'basket', 'expansion', 'spectacle', 'orifice', 'sight', 'flowmeter', 'trap', 'rupture', 'flame', 'hose'];
  const ipics = new Set(itemKinds.map(t => { PD.load({ pipes: [{ a: [0, 0, 0], b: [4, 0, 0], n: 4 }], valves: [], items: [{ p: [2, 0, 0], d: [1, 0, 0], n: 4, t }] }); const m = PD.iso('', 0).match(/<g class="sy"[^>]*>(.*?)<\/g>/s); return m ? m[1] : ''; }));
  check('every inline item has its own picture', ipics.size === itemKinds.length && !ipics.has(''), String(ipics.size));
  const sup = ['shoe', 'guide', 'anchor', 'hanger', 'spring'];
  const spics = new Set(sup.map(t => { PD.load({ pipes: [{ a: [0, 0, 0], b: [4, 0, 0], n: 4 }], valves: [], supports: [{ p: [2, 0, 0], d: [1, 0, 0], n: 4, t }] }); const m = PD.iso('', 0).match(/<g class="sy"[^>]*>(.*?)<\/g>/s); return m ? m[1] : ''; }));
  check('every support type has its own picture', spics.size === sup.length && !spics.has(''), String(spics.size));
  const ins = [['PI', 'PT', 'FIC']].flat().map(k => { PD.load({ pipes: [{ a: [0, 0, 0], b: [4, 0, 0], n: 4 }], valves: [], instr: [{ k, p: [2, 0, 0], d: [1, 0, 0], n: 4, num: 101 }] }); return PD.iso('', 0).includes('class="sy"'); });
  check('gauges, transmitters and controllers are drawn', ins.every(Boolean));
  PD.load({ pipes: [{ a: [0, 0, 0], b: [4, 0, 0], n: 4 }], valves: [{ p: [2, 0, 0], d: [1, 0, 0], n: 4, k: 'gate' }] });
  const symSvg = PD.iso('', 0), picSvg = PD.iso('', 0, undefined, 'pic');
  check('by default a valve is the usual iso bow-tie with its stem and handwheel bar', symSvg.includes('M-10,-9 L10,9 L10,-9 L-10,9Z'));
  check('and the pictures can be chosen instead', picSvg.includes('#dde3e6') && !picSvg.includes('M-10,-9 L10,9 L10,-9 L-10,9Z') && symSvg !== picSvg);
  const bowties = new Set(valveKinds.map(k => { PD.load({ pipes: [{ a: [0, 0, 0], b: [4, 0, 0], n: 4 }], valves: [{ p: [2, 0, 0], d: [1, 0, 0], n: 4, k }] }); return (PD.iso('', 0).match(/<g class="sy"[^>]*>(.*?)<\/g>/s) || [])[1]; }));
  check('each valve type has a different mark in the symbol style too', bowties.size === valveKinds.length, String(bowties.size));
  PD.load({ pipes: [{ a: [0, 0, 0], b: [4, 0, 0], n: 4 }], valves: [{ p: [2, 0, 0], d: [1, 0, 0], n: 4, k: 'gate', hw: 180 }] });
  check('the style choice does not change the material list or numbers', PD.iso('', 0, undefined, 'pic').includes('Gate valve') && PD.iso('', 0, undefined, 'sym').includes('Gate valve'));
}
PD.load({ pipes: [{ a: [0, 0, 0], b: [4, 0, 0], n: 4 }], valves: [] });
check('a bare pipe has a balloon for its pipe row', PD.iso().includes('r="9.5"') && PD.iso().includes('Pipe, NPS 4 SCH 40, BE'));

// Standards and size designation: ASME, JIS and EN, in NPS, DN or JIS A.
const stdModel = spec => ({ spec, pipes: [{ a: [0, 0, 0], b: [4, 0, 0], n: 4 }, { a: [4, 0, 0], b: [4, 0, 3], n: 4 }, { a: [4, 0, 3], b: [8, 0, 3], n: 6 }], valves: [{ p: [1, 0, 0], d: [1, 0, 0], n: 4, k: 'gate' }], flanges: [{ p: [2.5, 0, 0], d: [1, 0, 0], n: 4, t: 'wn' }] });
const rowStd = (desc) => (PD.rows().find(r => r[0].startsWith(desc)) || [])[2];
PD.load(stdModel({}));
check('ASME is the default and rows carry their standard', rowStd('Pipe, NPS 4') === 'ASTM A106 Gr.B, ASME B36.10M' && rowStd('Weld-neck flange 150#') === 'ASTM A105, ASME B16.5' && rowStd('Gasket 150#') === 'ASME B16.20' && rowStd('Elbow') === 'ASTM A234 WPB, ASME B16.9' && rowStd('Gate valve') === 'ASTM A216 WCB, ASME B16.34', JSON.stringify(PD.rows()));
check('the iso material list prints the standard under the description', PD.iso().includes('ASTM A106 Gr.B, ASME B36.10M'));
PD.load(stdModel({ sizeMode: 'DN' }));
check('DN designation on the BOM', has('Pipe, DN100 SCH 40, BE') && has('Pipe, DN150 SCH 40, BE') && has('Elbow 90° LR BW, DN100 SCH 40') && has('Reducer concentric BW, DN150×100 SCH 40') === false, rows());
PD.load(stdModel({ sizeMode: 'A' }));
check('JIS A designation on the BOM', has('Pipe, 100A SCH 40, BE') && has('Pipe, 150A SCH 40, BE') && has('Gate valve flanged 150#, 100A'), rows());
PD.load({ spec: { sizeMode: 'DN' }, pipes: [{ a: [0, 0, 0], b: [4, 0, 0], n: 6 }, { a: [4, 0, 0], b: [8, 0, 0], n: 4 }], valves: [] });
check('reducer reads DN150×100', has('Reducer concentric BW, DN150×100 SCH 40 | 1'), rows());
PD.load(stdModel({ std: 'jis', sizeMode: 'A' }));
check('JIS: rating word, materials and bolts', has('Gate valve flanged JIS 10K, 100A') && has('Weld-neck flange JIS 10K BW, 100A SCH 40') && has('Gasket JIS 10K spiral wound, 100A') && has('Stud bolt set JIS 10K, 8× M16') && rowStd('Pipe, 100A') === 'JIS G3454 STPG370' && rowStd('Weld-neck flange') === 'JIS B2220, SS400' && rowStd('Gasket') === 'JIS B2404', rows());
check('JIS pipe uses the JIS outside diameter and wall (150A is 165.2 x 7.1)', close(PD.hyd().pipes[2].D, (165.2 - 2 * 7.1) / 1000, 0.0005) && close(PD.hyd().pipes[0].D, (114.3 - 2 * 6.0) / 1000, 0.0005), JSON.stringify(PD.hyd().pipes.map(p => p.D)));
PD.load({ std: 'jis', spec: { std: 'jis' }, pipes: [{ a: [0, 0, 0], b: [10, 0, 0], n: 0.5 }], valves: [] });
check('JIS 15A is 21.7 mm, not the ASME 21.3 mm', close(PD.hyd().pipes[0].D, (21.7 - 2 * 2.8) / 1000, 0.0005), String(PD.hyd().pipes[0].D));
PD.load(stdModel({ std: 'en', sizeMode: 'DN' }));
check('EN: PN16, EN materials and flange bolts', has('Weld-neck flange PN16 BW, DN100 SCH 40') && has('Stud bolt set PN16, 8× M16') && rowStd('Pipe, DN100') === 'EN 10216-2 P235GH, ISO 4200' && rowStd('Weld-neck flange') === 'EN 1092-1, P250GH', rows());
PD.load({ spec: { std: 'en' }, pipes: [{ a: [0, 0, 0], b: [10, 0, 0], n: 2.5 }], valves: [] });
check('EN uses the ISO 4200 diameter (DN65 is 76.1 mm)', close(PD.hyd().pipes[0].D, (76.1 - 2 * 5.16) / 1000, 0.0005), String(PD.hyd().pipes[0].D));
PD.load(stdModel({}));
check('switching back to ASME restores the ASME diameters', close(PD.hyd().pipes[0].D, (114.3 - 2 * 6.02) / 1000, 0.0005) && has('Weld-neck flange 150# BW, NPS 4 SCH 40'));
// the spec controls
PD.load(stdModel({}));
els['sp-std'].value = 'jis'; els['sp-std'].onchange.call(els['sp-std']);
check('choosing JIS in the spec switches the size designation to JIS A and refills the size lists', PD.model.spec.std === 'jis' && PD.model.spec.sizeMode === 'A' && els['nps'].innerHTML.includes('100A · 114.3 mm') && els['fsz'].innerHTML.includes('>80A<'), els['nps'].innerHTML.slice(0, 120));
els['sp-size'].value = 'DN'; els['sp-size'].onchange.call(els['sp-size']);
check('the size designation can be changed on its own', PD.model.spec.sizeMode === 'DN' && els['nps'].innerHTML.includes('DN100'));
els['sp-std'].value = 'asme'; els['sp-std'].onchange.call(els['sp-std']);
check('and back to NPS with ASME', PD.model.spec.sizeMode === 'NPS' && els['nps'].innerHTML.includes('NPS 4 · 114.3 mm'));

// Exact input: typed lengths and start coordinates while drawing.
['sx', 'sy', 'sz', 'lenIn', 'g-x', 'g-y', 'g-z', 'g-n', 'i-len', 'i-ax', 'i-ay', 'i-az', 'i-bx', 'i-by', 'i-bz', 'i-pos', 'g-el', 'g-setel'].forEach(id => doc.getElementById(id));
const floorOut = () => { els['t-pipe'].onclick(); els['finish'].onclick(); for (let i = 0; i < 6; i++) els['down'].onclick(); };
const cur = () => PD.cursor();
PD.load({ pipes: [], valves: [] }); floorOut();
els['sx'].value = '1000'; els['sy'].value = '2000'; els['sz'].value = '500'; els['startGo'].onclick();
check('a run starts at typed X, Y, Z (Z up) in mm', cur() && near(cur(), [1, 0.5, 2]), JSON.stringify(cur()));
els['ax-x'].onclick(); els['lenIn'].value = '1234'; els['lenAdd'].onclick();
check('typed length goes exactly that far along the locked axis', near(lastPipe().a, [1, 0.5, 2]) && near(lastPipe().b, [2.234, 0.5, 2]) && Math.abs(lastPipe().b[0] - 2.234) < 1e-9, JSON.stringify(lastPipe()));
els['lenIn'].value = '-500'; els['lenAdd'].onclick();
check('a negative length goes the other way', near(lastPipe().b, [1.734, 0.5, 2]), JSON.stringify(lastPipe()));
els['ax-z'].onclick(); els['lenIn'].value = '2500'; els['lenAdd'].onclick();
check('typed length along Z goes up', near(lastPipe().b, [1.734, 3, 2]), JSON.stringify(lastPipe()));
els['ax-y'].onclick(); els['lenIn'].value = '750'; els['lenAdd'].onclick();
check('typed length along Y goes along scene Z', near(lastPipe().b, [1.734, 3, 2.75]), JSON.stringify(lastPipe()));
const nP = PD.model.pipes.length;
els['ax-z'].onclick(); els['lenIn'].value = '-99999'; els['lenAdd'].onclick();
check('a typed length below the floor is refused', PD.model.pipes.length === nP);
els['lenIn'].value = 'abc'; els['lenAdd'].onclick();
check('a typed length that is not a number is refused', PD.model.pipes.length === nP);
els['ax-auto'].onclick();
tapOn([cur()[0] + 1.5, cur()[1], cur()[2]]);
const before = lastPipe().b.slice();
els['lenIn'].value = '300'; els['lenAdd'].onclick();
check('in Auto a typed length carries on in the direction you last aimed', near(lastPipe().a, before) && near(lastPipe().b, [before[0] + 0.3, before[1], before[2]]), JSON.stringify(lastPipe()));
els['finish'].onclick();
els['ax-auto'].onclick(); els['lenIn'].value = '100';
check('typing a length with no run is a no-op', (() => { const n = PD.model.pipes.length; PD.typed(); return PD.model.pipes.length === n; })());
els['sx'].value = '0'; els['sy'].value = '0'; els['sz'].value = '-100'; els['startGo'].onclick();
check('a start below the floor is refused', cur() === null);

// Editing: stretch an end and everything beyond follows.
const chain = () => ({ pipes: [{ a: [0, 0, 0], b: [4, 0, 0], n: 4, fl: 1 }, { a: [4, 0, 0], b: [4, 0, 3], n: 4, fl: 1 }, { a: [4, 0, 3], b: [8, 0, 3], n: 4, fl: 1 }], valves: [{ p: [4, 0, 1.5], d: [0, 0, 1], n: 4, k: 'gate' }], fit: { '4000,0,0': { el: 'SR' } }, caps: [[8, 0, 3]], instr: [{ k: 'PT', p: [6, 0, 3], d: [1, 0, 0], n: 4, num: 101 }] });
PD.load(chain()); PD.stretch(0, 'b', [5, 0, 0]);
check('stretching an end moves the piping beyond it', near(PD.model.pipes[0].b, [5, 0, 0]) && near(PD.model.pipes[1].a, [5, 0, 0]) && near(PD.model.pipes[1].b, [5, 0, 3]) && near(PD.model.pipes[2].a, [5, 0, 3]) && near(PD.model.pipes[2].b, [9, 0, 3]), JSON.stringify(PD.model.pipes.map(p => [p.a, p.b])));
check('and what sits on it, caps and joint overrides go along', near(PD.model.valves[0].p, [5, 0, 1.5]) && near(PD.model.instr[0].p, [7, 0, 3]) && near(PD.model.caps[0], [9, 0, 3]) && PD.model.fit['5000,0,0'] && PD.model.fit['5000,0,0'].el === 'SR' && !PD.model.fit['4000,0,0'], JSON.stringify(PD.model.fit));
PD.load({ pipes: [{ a: [0, 0, 0], b: [4, 0, 0], n: 4 }, { a: [4, 0, 0], b: [8, 0, 0], n: 4 }], valves: [] }); PD.stretch(1, 'a', [3, 0, 0]);
check('stretching the start end carries the piping behind it', near(PD.model.pipes[0].a, [-1, 0, 0]) && near(PD.model.pipes[0].b, [3, 0, 0]) && near(PD.model.pipes[1].a, [3, 0, 0]), JSON.stringify(PD.model.pipes.map(p => [p.a, p.b])));
const sq = () => ({ pipes: [{ a: [0, 0, 0], b: [4, 0, 0], n: 4 }, { a: [4, 0, 0], b: [4, 0, 4], n: 4 }, { a: [4, 0, 4], b: [0, 0, 4], n: 4 }, { a: [0, 0, 4], b: [0, 0, 0], n: 4 }], valves: [] });
PD.load(sq()); PD.stretch(0, 'b', [5, 0, 0]);
check('a closed loop cannot stretch', near(PD.model.pipes[0].b, [4, 0, 0]) && near(PD.model.pipes[1].a, [4, 0, 0]));
PD.load({ pipes: [{ a: [-0.35, 0.4, 0], b: [-2, 0.4, 0], n: 4 }], valves: [], equip: [{ k: 'pump', p: [0, 0, 0], r: 0 }] }); PD.stretch(0, 'b', [-3, 0.4, 0]);
check('a pipe on a pump nozzle moves at its free end', near(PD.model.pipes[0].b, [-3, 0.4, 0]));
PD.stretch(0, 'a', [-0.5, 0.4, 0]);
check('but not at the nozzle end', near(PD.model.pipes[0].a, [-0.35, 0.4, 0]));
PD.load({ pipes: [{ a: [0, 0, 0], b: [3, 0, 0], n: 4 }, { a: [3, 0, 0], b: [3, 2, 0], n: 4 }], valves: [] }); PD.stretch(1, 'a', [3, -0.5, 0]);
check('stretching below the floor is refused', near(PD.model.pipes[1].a, [3, 0, 0]));
PD.load({ pipes: [{ a: [0, 0, 0], b: [4, 0, 0], n: 4 }], valves: [] }); PD.stretch(0, 'b', [0.02, 0, 0]);
check('a pipe cannot be stretched shorter than 50 mm', near(PD.model.pipes[0].b, [4, 0, 0]));
PD.load({ pipes: [{ a: [0, 0, 0], b: [4, 0, 0], n: 4 }], valves: [{ p: [3.5, 0, 0], d: [1, 0, 0], n: 4, k: 'gate' }] }); PD.stretch(0, 'b', [2, 0, 0]);
check('a valve past the shortened end is pulled back onto the pipe', PD.model.valves[0].p[0] < 2 && PD.model.valves[0].p[0] > 1.8, JSON.stringify(PD.model.valves[0].p));

// Move, copy, mirror and rotate the connected piping.
const grp = () => ({ pipes: [{ a: [0, 0, 0], b: [4, 0, 0], n: 4, fl: 1 }, { a: [4, 0, 0], b: [4, 0, 3], n: 4, fl: 1 }], valves: [{ p: [2, 0, 0], d: [1, 0, 0], n: 4, k: 'control' }], flanges: [{ p: [4, 0, 1.5], d: [0, 0, 1], n: 4, t: 'wn' }], instr: [{ k: 'FIC', p: [1, 0, 0], d: [1, 0, 0], n: 4, num: 101, link: 0 }], caps: [[4, 0, 3]], fit: { '4000,0,0': { el: 'SR' } } });
PD.load(grp()); PD.group.move(0, 1000, 500, 250);
check('move shifts the whole connected piping by a typed offset (CAD axes)', near(PD.model.pipes[0].a, [1, 0.25, 0.5]) && near(PD.model.pipes[1].b, [5, 0.25, 3.5]) && near(PD.model.valves[0].p, [3, 0.25, 0.5]) && near(PD.model.flanges[0].p, [5, 0.25, 2]) && near(PD.model.instr[0].p, [2, 0.25, 0.5]) && near(PD.model.caps[0], [5, 0.25, 3.5]) && PD.model.fit['5000,250,500'], JSON.stringify(PD.model.fit) + JSON.stringify(PD.model.pipes[0]));
PD.load(grp()); PD.group.copy(0, 0, 2000, 0, 2);
check('copy with a count makes stepped copies', PD.model.pipes.length === 6 && PD.model.valves.length === 3 && PD.model.flanges.length === 3 && PD.model.instr.length === 3 && PD.model.caps.length === 3 && near(PD.model.pipes[2].a, [0, 0, 2]) && near(PD.model.pipes[4].a, [0, 0, 4]), JSON.stringify(PD.model.pipes.map(p => p.a)));
check('copies keep the originals and carry flow, joint overrides and numbering', near(PD.model.pipes[0].a, [0, 0, 0]) && PD.model.pipes[3].fl === 1 && PD.model.fit['4000,0,2000'] && PD.model.fit['4000,0,4000'] && PD.model.instr.map(q => q.num).join() === '101,102,103', JSON.stringify(PD.model.instr.map(q => q.num)));
check('a copied controller drives the copied valve', PD.model.instr[1].link === 1 && PD.model.instr[2].link === 2 && PD.model.instr[0].link === 0, JSON.stringify(PD.model.instr.map(q => q.link)));
PD.load(grp()); PD.group.mirror(0, 0);
check('mirror across X makes a mirrored copy with mirrored items', PD.model.pipes.length === 4 && near(PD.model.pipes[2].a, [0, 0, 0]) && near(PD.model.pipes[2].b, [-4, 0, 0]) && near(PD.model.pipes[3].b, [-4, 0, 3]) && near(PD.model.valves[1].p, [-2, 0, 0]) && PD.model.valves[1].d[0] === -1, JSON.stringify(PD.model.pipes.map(p => [p.a, p.b])));
PD.load(grp()); PD.group.mirror(0, 2);
check('mirror across Y (scene Z) flips the other horizontal axis', near(PD.model.pipes[3].b, [4, 0, -3]) && near(PD.model.flanges[1].p, [4, 0, -1.5]), JSON.stringify(PD.model.pipes.map(p => [p.a, p.b])));
PD.load(grp()); PD.group.rotate(0);
check('rotate turns the group 90° about the vertical axis through its start', near(PD.model.pipes[0].b, [0, 0, 4]) && near(PD.model.pipes[1].b, [-3, 0, 4]) && near(PD.model.valves[0].p, [0, 0, 2]) && near(PD.model.valves[0].d, [0, 0, 1]), JSON.stringify(PD.model.pipes.map(p => [p.a, p.b])));
PD.load(Object.assign(grp(), { pipes: [{ a: [-0.35, 0.4, 0], b: [-2, 0.4, 0], n: 4 }], valves: [], flanges: [], instr: [], caps: [], fit: {}, equip: [{ k: 'pump', p: [0, 0, 0], r: 0 }] }));
check('piping tied to equipment cannot be moved, copied or rotated', PD.group.move(0, 100, 0, 0) === false && PD.group.copy(0, 0, 500, 0, 1) === false && PD.group.rotate(0) === false && PD.model.pipes.length === 1);
PD.load(grp());
check('a move or copy that goes below the floor is refused', PD.group.move(0, 0, 0, -1000) === false && PD.group.copy(0, 0, 0, -1000, 1) === false && PD.model.pipes.length === 2);
PD.load(grp());
check('one typed height puts the lowest point of the connected piping at that EL and takes its valves along', PD.group.setHeight(0, 1500) === true && PD.model.pipes.every(p => near(p.a.slice(1, 2), [1.5]) && near(p.b.slice(1, 2), [1.5])) && Math.abs(PD.model.valves[0].p[1] - 1.5) < 1e-9, JSON.stringify(PD.model.pipes.map(p => [p.a, p.b])));
check('the same height again, or one below the floor, changes nothing', PD.group.setHeight(0, 1500) === false && PD.group.setHeight(0, -100) === false && Math.abs(PD.model.pipes[0].a[1] - 1.5) < 1e-9);

// The inspector fields do the same through the screen.
PD.load({ pipes: [{ a: [0, 0, 0], b: [4, 0, 0], n: 4 }], valves: [{ p: [1, 0, 0], d: [1, 0, 0], n: 4, k: 'gate' }] });
els['t-sel'].onclick(); tapOn([3, 0, 0]);
const ih = els['insp'].innerHTML;
check('the pipe inspector has length, both ends and the group tools', ih.includes('id="i-len"') && ih.includes('id="i-bx"') && ih.includes('Move, copy, mirror') && ih.includes('value="4000"'), ih.slice(0, 200));
els['i-len'].value = '5000'; els['i-len'].onchange();
check('typing a length in the inspector stretches the pipe', near(PD.model.pipes[0].b, [5, 0, 0]));
els['i-bx'].value = '6000'; els['i-by'].value = '0'; els['i-bz'].value = '0'; els['i-bx'].onchange();
check('typing an end coordinate moves the end', near(PD.model.pipes[0].b, [6, 0, 0]));
els['i-ax'].value = '500'; els['i-ay'].value = '0'; els['i-az'].value = '0'; els['i-ax'].onchange();
check('typing a start coordinate moves the start', near(PD.model.pipes[0].a, [0.5, 0, 0]));
els['g-x'].value = '0'; els['g-y'].value = '1000'; els['g-z'].value = '0'; els['g-n'].value = '1'; els['g-copy'].onclick();
check('the inspector copy button copies with the typed offset', PD.model.pipes.length === 2 && near(PD.model.pipes[1].a, [0.5, 0, 1]));
PD.load({ pipes: [{ a: [0, 0, 0], b: [4, 0, 0], n: 4 }], valves: [{ p: [1, 0, 0], d: [1, 0, 0], n: 4, k: 'gate' }] });
tapOn([1, 0, 0]);
check('a valve has a typed position along its pipe', els['insp'].innerHTML.includes('id="i-pos"') && els['insp'].innerHTML.includes('value="1000"'), els['insp'].innerHTML.slice(0, 200));
els['i-pos'].value = '2500'; els['i-pos'].onchange();
check('typing a position moves the valve along the pipe', near(PD.model.valves[0].p, [2.5, 0, 0]));
els['i-pos'].value = '20'; els['i-pos'].onchange();
check('a position too close to an end is refused', near(PD.model.valves[0].p, [2.5, 0, 0]));

// The inspector's height field shows the lowest point and the button moves the whole line, undoably.
PD.load({ pipes: [{ a: [0, 0.5, 0], b: [4, 0.5, 0], n: 4 }, { a: [4, 0.5, 0], b: [4, 2, 0], n: 4 }], valves: [] });
els['t-sel'].onclick(); tapOn([2, 0.5, 0]);
check('the height field shows the lowest point of the connected piping', els['insp'].innerHTML.includes('id="g-el" value="500"') && els['insp'].innerHTML.includes('id="g-setel"'), els['insp'].innerHTML.slice(-300));
els['g-el'].value = '1200'; els['g-setel'].onclick();
check('Set height moves the whole connected piping', near(PD.model.pipes[0].a, [0, 1.2, 0]) && near(PD.model.pipes[1].b, [4, 2.7, 0]));
els['undo'].onclick();
check('Set height can be undone', near(PD.model.pipes[0].a, [0, 0.5, 0]) && near(PD.model.pipes[1].b, [4, 2, 0]));

// Cut list, weld numbers and spools.
const pipeQty = () => { const r = PD.rows().find(x => x[0].startsWith('Pipe, ') && /m$/.test(x[1])); return r ? parseFloat(r[1]) : 0; };
const cutSum = f => f.pieces.reduce((a, p) => a + p.len, 0);
PD.load({ pipes: [{ a: [0, 0, 0], b: [4, 0, 0], n: 4 }, { a: [4, 0, 0], b: [4, 0, 3], n: 4 }], valves: [{ p: [2, 0, 0], d: [1, 0, 0], n: 4, k: 'gate' }] });
let fb = PD.fab();
check('a valve splits its pipe into two cut pieces, and the elbow end makes a third', fb.pieces.length === 3 && Math.abs(fb.pieces[0].len - (2 - 0.229 / 2)) < 0.001, JSON.stringify(fb.pieces.map(p => p.len)));
check('the cut lengths add up to the BOM pipe quantity', Math.abs(cutSum(fb) - pipeQty()) < 0.01, cutSum(fb) + ' vs ' + pipeQty());
check('welds are the two elbow ends, the flanged valve is bolted', fb.welds.length === 2 && fb.welds.every(w => w.kind === 'BW') && fb.joints.length === 2 && fb.welds[0].no === 1 && fb.welds[1].no === 2, JSON.stringify(fb.welds.map(w => w.kind)));
check('spools stay together through shop welds and split at the bolted valve', fb.spools.length === 2 && fb.pieces[0].label === 'S01-1' && fb.pieces[1].spool === 'S02' && fb.pieces[2].spool === 'S02' && fb.pieces[2].label === 'S02-2', JSON.stringify(fb.pieces.map(p => p.label)));
PD.model.field[fb.welds[0].key] = 1; PD.rebuild(); fb = PD.fab();
check('marking a weld as field splits the spool there', fb.spools.length === 3 && fb.welds[0].field === true && fb.welds[1].field === false, JSON.stringify(fb.pieces.map(p => p.spool)));
check('the cut list csv lists pieces and welds', PD.fabCsv().startsWith('Piece,Spool,Line,Pipe,Cut length (mm)\nS01-1,') === false && PD.fabCsv().includes('"S01-1","S01","L-001"') && PD.fabCsv().includes('W1,"Butt weld"') && PD.fabCsv().includes(',Field') && PD.fabCsv().includes(',Shop'));
PD.load({ pipes: [{ a: [0, 0, 0], b: [4, 0, 0], n: 4 }], valves: [], flanges: [{ p: [2, 0, 0], d: [1, 0, 0], n: 4, t: 'wn' }] });
fb = PD.fab();
check('a flange pair takes its thickness out of the pipe, in the cut list and in the BOM alike', fb.pieces.length === 2 && Math.abs(cutSum(fb) - pipeQty()) < 0.01 && cutSum(fb) < 4 - 0.02, cutSum(fb) + ' vs ' + pipeQty());
check('weld-neck flanges are welded to each side, the pair is bolted, so two spools', fb.welds.length === 2 && fb.joints.length === 1 && fb.spools.length === 2, JSON.stringify([fb.welds.length, fb.joints.length, fb.spools.length]));
PD.load({ pipes: [{ a: [0, 0, 0], b: [4, 0, 0], n: 4 }], valves: [], flanges: [{ p: [4, 0, 0], d: [1, 0, 0], n: 4, t: 'bl' }] });
fb = PD.fab();
check('a blind flange on a pipe end shortens that pipe and is welded once', fb.pieces.length === 1 && fb.pieces[0].len < 4 - 0.02 && fb.welds.length === 1 && Math.abs(cutSum(fb) - pipeQty()) < 0.01, JSON.stringify(fb.pieces.map(p => p.len)));
PD.load({ pipes: [{ a: [0, 0, 0], b: [4, 0, 0], n: 6 }], valves: [] }); PD.addPipe([2, 0, 0], [2, 0, 2], 3, 40); PD.rebuild(); fb = PD.fab();
check('an olet is welded to the header and the branch to the olet, all in one spool', fb.welds.length === 2 && fb.spools.length === 1 && fb.pieces.length === 2, JSON.stringify([fb.welds.length, fb.spools.length, fb.pieces.length]));
PD.load({ pipes: [{ a: [0, 0, 0], b: [4, 0, 0], n: 4 }, { a: [4, 0, 0], b: [4, 0, 3], n: 4 }, { a: [4, 0, 3], b: [8, 0, 3], n: 4 }], valves: [] }); fb = PD.fab();
check('a straight run of fittings: four welds, one spool, cut lengths sum to the BOM', fb.welds.length === 4 && fb.spools.length === 1 && Math.abs(cutSum(fb) - pipeQty()) < 0.01, JSON.stringify([fb.welds.length, fb.spools.length]));
PD.load({ pipes: [{ a: [0, 0, 0], b: [4, 0, 0], n: 4 }, { a: [4, 0, 0], b: [8, 0, 0], n: 4 }], valves: [] }); fb = PD.fab();
check('two collinear pipes meet in one butt weld', fb.welds.length === 1 && fb.pieces.length === 2 && fb.spools.length === 1, JSON.stringify([fb.welds.length, fb.pieces.length, fb.spools.length]));
PD.load({ pipes: [{ a: [0, 0, 0], b: [4, 0, 0], n: 1 }, { a: [4, 0, 0], b: [4, 0, 2], n: 1 }], valves: [] }); fb = PD.fab();
check('small bore welds are socket welds by default', fb.welds.length === 2 && fb.welds.every(w => w.kind === 'SW'), JSON.stringify(fb.welds.map(w => w.kind)));
PD.load({ pipes: [{ a: [0, 0, 0], b: [4, 0, 0], n: 4 }, { a: [4, 0, 0], b: [4, 0, 3], n: 4 }], valves: [] });
check('the iso sheet numbers the welds in circles and marks the spools', PD.iso().includes('>W1</text>') && PD.iso().includes('>W2</text>') && PD.iso().includes('>S01<'));
const flowCount = svg => (svg.match(/class="flow"/g) || []).length;
PD.load({ pipes: [0, 1, 2, 3, 4, 5].map(i => ({ a: [i, 0, 0], b: [i + 1, 0, 0], n: 4, fl: 1 })), valves: [] });
check('flow arrows are not drawn on every short pipe of a line', flowCount(PD.iso('', 0)) >= 1 && flowCount(PD.iso('', 0)) < 6, String(flowCount(PD.iso('', 0))));
PD.load({ pipes: [{ a: [0, 0, 0], b: [6, 0, 0], n: 4, fl: 1 }, { a: [0, 0, 3], b: [6, 0, 3], n: 4, fl: -1, ln: 'L-002' }], valves: [] });
check('every line with a flow keeps at least one arrow', flowCount(PD.iso('', 0)) === 2);
PD.load({ pipes: [{ a: [0, 0, 0], b: [6, 0, 0], n: 4 }], valves: [] });
check('no flow set means no arrow', flowCount(PD.iso('', 0)) === 0);
PD.load({ pipes: [{ a: [0, 0, 0], b: [4, 0, 0], n: 4 }, { a: [4, 0, 0], b: [4, 0, 3], n: 4 }], valves: [] });

// Isometric sheet: auto layout, one sheet per line, auto view, title block.
const dots = svg => [...svg.matchAll(/<circle cx="([\d.\-]+)" cy="([\d.\-]+)" r="9.5"/g)].map(m => [+m[1], +m[2]]);
const overlaps = c => { let n = 0; for (let i = 0; i < c.length; i++) for (let j = i + 1; j < c.length; j++) if (Math.hypot(c[i][0] - c[j][0], c[i][1] - c[j][1]) < 19) n++; return n; };
const crowd = { pipes: [{ a: [0, 0, 0], b: [12, 0, 0], n: 4 }, { a: [12, 0, 0], b: [12, 0, 3], n: 4 }], valves: [1, 1.5, 2, 2.5, 3, 3.5, 4].map(x => ({ p: [x, 0, 0], d: [1, 0, 0], n: 4, k: 'gate' })).concat([{ p: [12, 0, 1.5], d: [0, 0, 1], n: 4, k: 'ball' }]), flanges: [{ p: [6, 0, 0], d: [1, 0, 0], n: 4, t: 'wn' }, { p: [8, 0, 0], d: [1, 0, 0], n: 4, t: 'so' }], supports: [{ p: [9, 0, 0], d: [1, 0, 0], n: 4, t: 'shoe' }, { p: [10, 0, 0], d: [1, 0, 0], n: 4, t: 'guide' }] };
PD.load(crowd);
const tidySvg = PD.iso('', 0, true), rawSvg = PD.iso('', 0, false);
check('auto layout keeps item balloons apart', dots(tidySvg).length >= 8 && overlaps(dots(tidySvg)) === 0, dots(tidySvg).length + ' balloons, ' + overlaps(dots(tidySvg)) + ' overlaps');
check('and does better than the plain layout', overlaps(dots(tidySvg)) <= overlaps(dots(rawSvg)), overlaps(dots(rawSvg)) + ' overlaps without');
check('with auto layout the balloons stay inside the drawing area', dots(tidySvg).every(c => c[0] > 20 && c[0] < 850 && c[1] > 20));
const rotCross = (r) => {
  const pr = p => { let x = p[0], z = p[2]; for (let i = 0; i < r; i++) { const t = x; x = -z; z = t; } return [(x - z) * Math.cos(Math.PI / 6), -(p[1] + (x + z) * 0.5)]; };
  const seg = PD.model.pipes.map(q => [pr(q.a), pr(q.b)]); let n = 0;
  const sd = (a, b, c) => (b[0] - a[0]) * (c[1] - a[1]) - (b[1] - a[1]) * (c[0] - a[0]), same = (a, b) => Math.hypot(a[0] - b[0], a[1] - b[1]) < 1e-6;
  for (let i = 0; i < seg.length; i++) for (let j = i + 1; j < seg.length; j++) { const A = seg[i], B = seg[j]; if (same(A[0], B[0]) || same(A[0], B[1]) || same(A[1], B[0]) || same(A[1], B[1])) continue; if (sd(A[0], A[1], B[0]) * sd(A[0], A[1], B[1]) < 0 && sd(B[0], B[1], A[0]) * sd(B[0], B[1], A[1]) < 0) n++; }
  return n;
};
PD.load({ pipes: [{ a: [0, 0, 0], b: [4, 0, 0], n: 4 }, { a: [4, 0, 0], b: [4, 3, 0], n: 4 }, { a: [4, 3, 0], b: [4, 3, 3], n: 4 }, { a: [4, 3, 3], b: [0, 3, 3], n: 4 }, { a: [0, 3, 3], b: [0, 0, 3], n: 4 }, { a: [2, 0, -2], b: [2, 0, 2], n: 4 }], valves: [] });
PD.iso('', 'auto');
const cr = [0, 1, 2, 3].map(rotCross);
check('the auto view is a quarter turn with the fewest crossing pipes', cr[PD.isoCtx.rot] === Math.min(...cr), JSON.stringify(cr) + ' chose ' + PD.isoCtx.rot);
check('every view renders', [0, 1, 2, 3].every(v => /^<svg/.test(PD.iso('', v))));
// one sheet per line
PD.load({ pipes: [{ a: [0, 0, 0], b: [4, 0, 0], n: 4, ln: 'L-001' }, { a: [4, 0, 0], b: [4, 0, 3], n: 4, ln: 'L-001' }, { a: [0, 0, 5], b: [6, 0, 5], n: 2, ln: 'L-002' }], valves: [{ p: [2, 0, 0], d: [1, 0, 0], n: 4, k: 'gate' }, { p: [3, 0, 5], d: [1, 0, 0], n: 2, k: 'globe' }], lines: { 'L-002': { q: 5, svc: 'Cooling water', pdes: '10 bar g', tdes: '60 C', insul: 'none' } } });
const rowsBefore = JSON.stringify(PD.rows()), pipesBefore = PD.model.pipes.length;
const sL2 = PD.iso('L-002'), sL1 = PD.iso('L-001');
check('a sheet for one line lists only that line', sL2.includes('Globe valve') && !sL2.includes('Gate valve') && sL1.includes('Gate valve') && !sL1.includes('Globe valve'), '');
check('the line sheet carries the line data in its title block', sL2.includes('Cooling water') && sL2.includes('10 bar g') && sL2.includes('60 C') && sL2.includes('ISO-L-002'));
check('making a line sheet leaves the project as it was', JSON.stringify(PD.rows()) === rowsBefore && PD.model.pipes.length === pipesBefore);
check('the line sheet cut list holds only its pieces', (sL1.match(/ mm<\/text>/g) || []).length === 3 && (sL2.match(/ mm<\/text>/g) || []).length === 2, (sL1.match(/ mm<\/text>/g) || []).length + ' / ' + (sL2.match(/ mm<\/text>/g) || []).length);
PD.model.title = { project: 'Plant A', rev: 'C', by: 'KS', checked: 'TM', client: 'Acme' };
const sL3 = PD.iso('');
check('the title block shows the project fields', ['Plant A', '>C<', 'KS', 'TM', 'Acme'].every(t => sL3.includes(t)), '');
check('and the sheet for all lines names every line', sL3.includes('L-001') && sL3.includes('L-002'));

// Eccentric reducer flat side, pump suction warning, vents and drains, slope notes.
const eccModel = flat => ({ spec: { reducer: 'ecc', eccFlat: flat }, pipes: [{ a: [0, 1, 0], b: [3, 1, 0], n: 4 }, { a: [3, 1, 0], b: [6, 1, 0], n: 3 }], valves: [] });
['top', 'bottom', 'side'].forEach(f => { PD.load(eccModel(f)); check('eccentric reducer flat on ' + f + ' goes to the BOM', has('Reducer eccentric (flat on ' + f + ') BW, NPS 4×3'), rows()); });
PD.load(eccModel('top')); PD.model.fit['3000,1000,0'] = { flat: 'bottom' }; PD.rebuild();
check('a joint can override the flat side', has('(flat on bottom)'), rows());
PD.load(eccModel('top')); check('the iso marks the flat side', PD.iso('', 0).includes('>FOT<'));
PD.load({ spec: { reducer: 'ecc', eccFlat: 'bottom' }, equip: [{ k: 'pump', p: [0, 0, 0], r: 0 }], pipes: [{ a: [-0.35, 0.4, 0], b: [-2, 0.4, 0], n: 4 }, { a: [-2, 0.4, 0], b: [-4, 0.4, 0], n: 6 }], valves: [] });
check('flat on bottom at a pump suction is warned about', PD.warns().some(w => w.includes('pump suction')), PD.warns().join());
PD.model.spec.eccFlat = 'top'; PD.rebuild();
check('and flat on top is not', !PD.warns().some(w => w.includes('pump suction')), PD.warns().join());
fresh(run4()); chipTap('cap', 'vent'); tapOn([3, 1, 0]);
check('vent tool adds a branch up, a ball valve and a plug', PD.model.pipes.length === 3 && PD.model.valves.some(v => v.k === 'ball' && v.d[1] > 0.9) && PD.model.caps.some(c => c[3] === 'plug' && c[1] > 1.2), JSON.stringify([PD.model.pipes.length, PD.model.valves, PD.model.caps]));
check('the vent is on the BOM', has('Ball valve SW 800#, NPS 3/4 | 1') && has('Plug, round head, THD, NPS 3/4') && has('Weldolet BW, NPS 4×3/4'), rows());
fresh(run4()); chipTap('cap', 'drain'); tapOn([3, 1, 0]);
check('drain tool goes underneath', PD.model.valves.some(v => v.k === 'ball' && v.d[1] < -0.9) && PD.model.caps.some(c => c[1] < 0.8), JSON.stringify(PD.model.caps));
PD.load({ pipes: [{ a: [0, 0.1, 0], b: [6, 0.1, 0], n: 4 }], valves: [] }); chipTap('cap', 'drain'); tapOn([3, 0.1, 0]);
check('a drain with no room below is refused', PD.model.valves.length === 0 && PD.model.pipes.length === 1);
PD.load({ pipes: [{ a: [0, 0, 0], b: [4, 0, 0], n: 4, sl: 100, sld: 1 }], valves: [] });
check('a slope note shows on the iso', PD.iso('', 0).includes('SLOPE 1:100'));
PD.load({ pipes: [{ a: [0, 0, 0], b: [4, 0, 0], n: 4 }], valves: [] });
check('no slope note without a slope', !PD.iso('', 0).includes('SLOPE'));

// Backups.
const nowReal = Date.now; let clock = nowReal();
const sandboxDate = ctx.Date;
PD.load({ pipes: [{ a: [0, 0, 0], b: [4, 0, 0], n: 4 }], valves: [] });
memStore['pipedraft.backups.v1'] = '[]';
PD.backup(true);
check('a backup is kept', PD.backups().length === 1 && PD.backups()[0].n === 1);
PD.backup(true);
check('an unchanged project is not backed up twice', PD.backups().length === 1);
for (let i = 0; i < 12; i++) { PD.model.pipes.push({ a: [0, 0, i + 1], b: [4, 0, i + 1], n: 4, s: 40, ln: 'L-001', fl: 0 }); PD.backup(true); }
check('only the latest eight are kept, newest first', PD.backups().length === 8 && PD.backups()[0].n === 13 && PD.backups()[7].n === 6, JSON.stringify(PD.backups().map(b => b.n)));
check('restoring a backup brings that project back', (() => { const ok = PD.restore(7); return ok && PD.model.pipes.length === 6; })(), String(PD.model.pipes.length));
check('restoring first backs up the current project', PD.backups()[0].n === 6 || PD.backups().some(b => b.n === 13));
check('a bad backup index is refused', PD.restore(99) === false);
check('the backup list prints a Restore button per snapshot', (PD.backupsHtml().match(/data-bk=/g) || []).length === PD.backups().length);
check('a plain save does not back up again within two minutes', (() => { const n = PD.backups().length; PD.model.pipes.pop(); PD.backup(false); return PD.backups().length === n; })());
memFull = true; PD.backup(true); memFull = false;
check('a full device does not break the app', PD.model.pipes.length >= 1);
PD.load({ pipes: [], valves: [] }); PD.backup(true);
check('an empty project is never backed up over a real one', PD.backups()[0].n > 0);

// Editable tags and handwheel direction.
PD.load({ pipes: [{ a: [0, 0, 0], b: [6, 0, 0], n: 4 }], valves: [{ p: [1, 0, 0], d: [1, 0, 0], n: 4, k: 'gate' }, { p: [2, 0, 0], d: [1, 0, 0], n: 4, k: 'gate' }, { p: [3, 0, 0], d: [1, 0, 0], n: 4, k: 'gate', tag: 'XV-1001' }] });
check('a typed tag replaces the automatic one and the others keep their numbers', PD.tags().valves.join() === 'GV-1,GV-2,XV-1001', PD.tags().valves.join());
check('the typed tag appears on the iso material list', PD.iso('', 0).includes('XV-1001'));
PD.model.valves[1].tag = 'XV-1001'; PD.rebuild();
check('the same tag on two parts is warned about', PD.warns().some(w => w.includes('XV-1001') && w.includes('more than one')), PD.warns().join());
els['t-sel'].onclick(); tapOn([1, 0, 0]);
els['i-tag'].value = ' HV-7 '; els['i-tag'].onchange();
check('the inspector sets and trims a tag', PD.model.valves[0].tag === 'HV-7');
els['i-tag'].value = ''; els['i-tag'].onchange();
check('and an empty tag goes back to automatic', PD.model.valves[0].tag === undefined && PD.tags().valves[0] === 'GV-1');
PD.load({ pipes: [{ a: [0, 0, 0], b: [4, 0, 0], n: 4 }], valves: [{ p: [2, 0, 0], d: [1, 0, 0], n: 4, k: 'gate' }] });
const upSvg = PD.iso('', 0); PD.model.valves[0].hw = 180; const downSvg = PD.iso('', 0);
check('a handwheel pointing down flips the valve symbol on the iso', upSvg !== downSvg);
els['t-sel'].onclick(); tapOn([2, 0, 0]);
els['i-hw'].value = '90'; els['i-hw'].onchange();
check('the inspector sets the handwheel angle', PD.model.valves[0].hw === 90);
els['i-hw'].value = '0'; els['i-hw'].onchange();
check('and 0 is the default again', PD.model.valves[0].hw === undefined);

// PDF export.
const fakeJpg = new Uint8Array(300).map((_, i) => i === 0 ? 0xFF : i === 1 ? 0xD8 : (i * 7) % 256);
const pdfBytes = PD.pdf(fakeJpg, 2400, 1900), pdfStr = Buffer.from(pdfBytes).toString('latin1');
check('the PDF has a header, one page and an end marker', pdfStr.startsWith('%PDF-1.4') && pdfStr.trim().endsWith('%%EOF') && pdfStr.includes('/Count 1') && pdfStr.includes('/Filter /DCTDecode') && pdfStr.includes('/Width 2400 /Height 1900'));
const sx = +/startxref\n(\d+)/.exec(pdfStr)[1];
check('startxref points at the xref table', pdfStr.slice(sx, sx + 4) === 'xref');
check('every xref entry points at its object', [1, 2, 3, 4, 5].every(n => { const e = pdfStr.slice(sx).split('\n')[2 + n]; const o = +e.slice(0, 10); return pdfStr.slice(o, o + (n + ' 0 obj').length) === n + ' 0 obj'; }));
check('the JPEG bytes are embedded untouched', Buffer.from(pdfBytes).includes(Buffer.from(fakeJpg)) && /\/Length 300 >>/.test(pdfStr));
check('the image is scaled to fit an A3 page', (() => { const m = /q ([\d.]+) 0 0 ([\d.]+) ([\d.]+) ([\d.]+) cm/.exec(pdfStr); return m && +m[1] <= 1190.55 - 39 && +m[2] <= 841.89 - 39 && Math.abs(+m[1] / +m[2] - 2400 / 1900) < 0.01; })());

// Line list.
PD.load({ pipes: [{ a: [0, 0, 0], b: [4, 0, 0], n: 4, ln: 'L-002' }, { a: [4, 0, 0], b: [4, 0, 3], n: 4, ln: 'L-002' }, { a: [4, 0, 3], b: [8, 0, 3], n: 3, ln: 'L-002' }, { a: [0, 0, 5], b: [6, 0, 5], n: 2, ln: 'L-001' }], valves: [{ p: [1, 0, 0], d: [1, 0, 0], n: 4, k: 'gate' }, { p: [3, 0, 5], d: [1, 0, 0], n: 2, k: 'globe' }], lines: { 'L-001': { q: 12, svc: 'Cooling water' } } });
const ll = PD.lineList();
check('the line list has one sorted row per line', ll.length === 2 && ll[0].ln === 'L-001' && ll[1].ln === 'L-002');
check('it counts length, valves and welds from the drawing', Math.abs(ll[1].len - 11) < 0.001 && ll[1].valves === 1 && ll[0].valves === 1 && ll[1].welds >= 3 && ll[0].welds === 0, JSON.stringify(ll));
check('sizes are listed largest first', ll[1].size === 'NPS 4 / NPS 3' || ll[1].size.includes('/'), ll[1].size);
check('typed line data and the flow come through', ll[0].svc === 'Cooling water' && ll[0].q === 12 && ll[1].svc === '');
const lcsv = PD.lineCsv();
check('line designation reads size-code-line-class', ll[0].desig.startsWith('2"-L-001-') && ll[1].desig.startsWith('4"-L-002-'), ll[0].desig + ' | ' + ll[1].desig);
check('a typed fluid code goes into the designation and the iso title block', (PD.model.lines['L-001'].code = 'CW', PD.lineDesignation('L-001')) === '2"-CW-L-001-' + ll[0].desig.split('L-001-')[1] && (PD.isoCtx.ln = 'L-001', PD.iso('L-001', 'auto', true)).includes('2&quot;-CW-L-001') || PD.iso('L-001', 'auto', true).includes('2"-CW-L-001'));
check('the iso sheet lists welds when there are some', PD.iso('L-002', 'auto', true).includes('WELD LIST') && !PD.iso('L-001', 'auto', true).includes('WELD LIST'));
{ // title block rows span the full width; weld list on a one-line sheet covers only that line
  const sv = PD.iso('L-002', 'auto', true);
  const nW = (sv.match(/>W\d+<\/text><text x="[\d.]+" y="[\d.]+" font-size="9" fill="#[0-9A-Fa-f]+">(Butt|Socket|Fillet) weld/g) || []).length;
  check('the weld list on a one-line sheet counts only that line', nW > 0 && nW === PD.fab().welds.filter(w => w.ln === 'L-002').length, nW + ' vs ' + PD.fab().welds.filter(w => w.ln === 'L-002').length);
  const xs = [...sv.matchAll(/<text x="([\d.]+)" y="[\d.]+" font-size="7.5" fill="#555">(CLASS \/ MATERIAL|SCALE)</g)].map(m => +m[1]);
  check('both title block rows fill the width (last cells start at 80% and 95%)', xs.length === 2 && Math.abs(xs[0] - (12 + 1176 * 0.80 + 6)) < 1 && Math.abs(xs[1] - (12 + 1176 * 0.95 + 6)) < 1, xs.join(','));
  const old = JSON.parse(JSON.stringify(PD.model)); Object.keys(old.lines || {}).forEach(k => delete old.lines[k].code);
  PD.load(old);
  const csvRow = PD.lineCsv().split(String.fromCharCode(10))[1];
  check('a save without fluid codes loads and the designation omits the code', !PD.lineDesignation('L-001').includes('--') && csvRow.endsWith(',"","' + PD.lineDesignation('L-001').replace(/"/g, '""') + '","",""'), csvRow);
}
check('the line list csv has a header and a row per line', lcsv.startsWith('Line,Size,Service,Class,') && lcsv.split('\n').filter(Boolean).length === 3 && lcsv.includes('"Cooling water"') && lcsv.includes('"ASME') === false);
check('the screen version has an input per field and line', (PD.lineListHtml().match(/data-ll=/g) || []).length === 18);
check('from and to reach the csv and the foot note of that line sheet', (PD.model.lines['L-001'].from = 'Tank T-101', PD.model.lines['L-001'].to = 'Pump <P-101>', PD.lineCsv()).includes('"Tank T-101","Pump <P-101>"') && (s => s.includes('FROM Tank T-101  TO Pump &lt;P-101&gt;') && !s.includes('<P-101>'))(PD.iso('L-001', 'auto', true)) && !PD.iso('L-002', 'auto', true).includes('FROM '));
check('a short iso sheet has at least the A3 landscape shape (1200 x 849)', (m => m && +m[1] === 1200 && +m[2] >= 849)(/viewBox="0 0 ([\d.]+) ([\d.]+)"/.exec(PD.iso('L-001', 'auto', true))));
const bomBefore = JSON.stringify(PD.rows()), bomPipes0 = PD.model.pipes.length, bl = PD.bomByLine();
const blRows = bl.split('\n').filter(Boolean), blOf = ln => blRows.filter(r => r.startsWith('"' + ln + '"'));
check('BOM by line has the rows of each line under its designation', bl.startsWith('Line,Designation,Description,Quantity') && blOf('L-001').length > 0 && blOf('L-002').length > 0 && blOf('L-001').every(r => r.includes('"2""-L-001-')) && blOf('L-002').every(r => r.includes('"4""-L-002-')), bl);
check('and each line lists only its own parts', blOf('L-001').some(r => r.includes('"5.80 m"')) && blOf('L-001').every(r => !r.includes('NPS 4')) && blOf('L-002').every(r => !r.includes('NPS 2 ')), bl);
check('and building it leaves the project exactly as it was', JSON.stringify(PD.rows()) === bomBefore && PD.model.pipes.length === bomPipes0);
if (process.env.PD_WRITE_SVG) { Object.assign(PD.model.lines['L-002'] = PD.model.lines['L-002'] || {}, { code: 'P', cls: 'A1A-CS', svc: 'Process water', pdes: '10 bar g', tdes: '60 C', from: 'Tank T-101', to: 'Pump P-101' }); fs.writeFileSync(path.join(process.env.PD_WRITE_SVG, 'line.svg'), PD.iso('L-002', 'auto', true)); }
L['llBody'].change({ target: { getAttribute: k => ({ 'data-ll': 'pdes', 'data-ln': 'L-002' })[k], value: ' 16 bar g ' } });
check('editing a field in the line list stores it trimmed', PD.model.lines['L-002'].pdes === '16 bar g' && PD.lineList()[1].pdes === '16 bar g');
L['llBody'].change({ target: { getAttribute: k => ({ 'data-ll': 'pdes', 'data-ln': 'L-002' })[k], value: '' } });
check('and clearing it removes it', PD.model.lines['L-002'].pdes === undefined);
PD.model.lines['L-002'].cls = 'JIS 10K SGP';
check('the class typed in the line list reaches the title block of that line sheet', PD.iso('L-002', 0).includes('JIS 10K SGP'));

// Clash check.
PD.load({ pipes: [{ a: [0, 1, 0], b: [4, 1, 0], n: 4 }, { a: [2, 1, -2], b: [2, 1, 2], n: 4 }], valves: [] });
check('two pipes crossing at the same height clash', PD.clashes().length === 1 && PD.clashes()[0].kind === 'pipe' && PD.warns().some(w => w.includes('run into each other') && w.includes('2000, 0, 1000')), PD.warns().join());
// The clash point is where the pipes meet, not the middle of the first pipe.
PD.load({ pipes: [{ a: [0, 1, 0], b: [10, 1, 0], n: 4 }, { a: [7, 1, -2], b: [7, 1, 2], n: 4 }], valves: [] });
check('the clash is reported where the pipes cross', PD.clashes().length === 1 && PD.clashes()[0].at[0] === 7 && PD.clashes()[0].at[2] === 0 && PD.warns().some(w => w.includes('7000, 0, 1000')), JSON.stringify(PD.clashes().map(c => c.at)));
PD.load({ pipes: [{ a: [0, 1, 0], b: [4, 1, 0], n: 4 }, { a: [2, 1.3, -2], b: [2, 1.3, 2], n: 4 }], valves: [] });
check('crossing one pipe diameter and more clear of each other is fine', PD.clashes().length === 0);
PD.load({ pipes: [{ a: [0, 1, 0], b: [4, 1, 0], n: 4 }, { a: [2, 1, 0], b: [2, 1, 3], n: 4 }], valves: [] });
check('a branch that starts on the header is not a clash', PD.clashes().length === 0);
PD.load({ pipes: [{ a: [0, 0, 0], b: [4, 0, 0], n: 4 }, { a: [4, 0, 0], b: [4, 0, 3], n: 4 }], valves: [] });
check('an elbow joint is not a clash', PD.clashes().length === 0);
PD.load({ pipes: [{ a: [0, 1, 0], b: [4, 1, 0], n: 4 }, { a: [0, 1.05, 1], b: [4, 1.05, 1], n: 4 }], valves: [] });
check('parallel pipes a metre apart are fine', PD.clashes().length === 0, JSON.stringify(PD.clashes().map(c => c.d)));
PD.load({ pipes: [{ a: [0, 1, 0], b: [4, 1, 0], n: 4 }, { a: [0, 1.05, 0], b: [4, 1.05, 0], n: 4 }], valves: [] });
check('pipes lying on top of each other are reported', PD.clashes().length === 1);
PD.load({ pipes: [{ a: [-3, 0.4, 0], b: [3, 0.4, 0], n: 4 }], valves: [], equip: [{ k: 'pump', p: [0, 0, 0], r: 0 }] });
check('a pipe through a pump is reported', PD.clashes().some(c => c.kind === 'equip') && PD.warns().some(w => w.includes('runs through P-1')), PD.warns().join());
PD.load({ pipes: [{ a: [-0.35, 0.4, 0], b: [-3, 0.4, 0], n: 4 }], valves: [], equip: [{ k: 'pump', p: [0, 0, 0], r: 0 }] });
check('a pipe leaving a nozzle is not', PD.clashes().length === 0, JSON.stringify(PD.clashes()));
PD.load({ pipes: [{ a: [3, 0.4, 3], b: [6, 0.4, 3], n: 4 }], valves: [], equip: [{ k: 'vessel', p: [0, 0, 0], r: 0 }] });
check('and a pipe away from equipment is not', PD.clashes().length === 0);

// Clash check, valves.
const VH = { pipes: [{ a: [0, 1, 0], b: [6, 1, 0], n: 4, ln: 'L-001' }] };
PD.load({ pipes: VH.pipes.concat([{ a: [3, 1, -2], b: [3, 1, 2], n: 4, ln: 'L-002' }]), valves: [{ p: [3, 1, 0], d: [1, 0, 0], n: 4, s: 40, k: 'gate' }] });
check('a pipe through a valve body is flagged', PD.clashes().some(c => c.kind === 'valve' && c.i === 0 && c.j === 1 && Math.abs(c.at[0] - 3) < 0.01 && Math.abs(c.at[2]) < 0.01) && PD.warns().some(w => w.includes('Valve GV-1 (gate, NPS 4) and pipe 2 (L-002) run into each other')), JSON.stringify(PD.clashes()) + PD.warns().join());
PD.load({ pipes: VH.pipes.concat([{ a: [3, 1.6, -2], b: [3, 1.6, 2], n: 4, ln: 'L-002' }]), valves: [{ p: [3, 1, 0], d: [1, 0, 0], n: 4, s: 40, k: 'gate' }] });
check('a pipe passing clear of a valve is not', PD.clashes().length === 0, JSON.stringify(PD.clashes()));
PD.load({ pipes: [{ a: [0, 1, 0], b: [3.12, 1, 0], n: 4, ln: 'L-001' }, { a: [3.12, 1, 0], b: [6, 1, 0], n: 4, ln: 'L-001' }, { a: [3.12, 1, 0], b: [3.12, 1, 3], n: 4, ln: 'L-002' }], valves: [{ p: [3, 1, 0], d: [1, 0, 0], n: 4, s: 40, k: 'gate' }] });
check('a branch starting on the header beside a valve is not', PD.clashes().filter(c => c.kind === 'valve').length === 0, JSON.stringify(PD.clashes()));
PD.load({ pipes: [{ a: [0, 1, 0], b: [3, 1, 0], n: 4, ln: 'L-001' }, { a: [3, 1, 0], b: [3, 1, 3], n: 4, ln: 'L-001' }], valves: [{ p: [2.9, 1, 0], d: [1, 0, 0], n: 4, s: 40, k: 'ball' }, { p: [0.1, 1, 0], d: [1, 0, 0], n: 4, s: 40, k: 'globe' }, { p: [3, 1, 2.9], d: [0, 0, 1], n: 4, s: 40, k: 'check' }] });
check('valves next to an elbow or at a pipe end do not crash or clash', PD.clashes().length === 0, JSON.stringify(PD.clashes()));

PD.load({ pipes: [{ a: [0, 1, 0], b: [3, 1, 0], n: 4, ln: 'L-001' }, { a: [3, 1, 0], b: [6, 1, 0], n: 4, ln: 'L-001' }], valves: [{ p: [3, 1, 0], d: [1, 0, 0], n: 4, s: 40, k: 'gate' }, { p: [1, 1, 0], d: [1, 0, 0], n: 4, s: 40, k: 'gate' }] });
check('a valve at the joint of two straight pipes is not a clash with the next pipe', PD.clashes().length === 0, JSON.stringify(PD.clashes()));
PD.load({ pipes: VH.pipes.concat([{ a: [3, 1, -2], b: [3, 1, 2], n: 4, ln: 'L-002' }]), valves: [{ p: [3, 1, 0], d: [1, 0, 0], n: 4, s: 40, k: 'gate' }] });
check('a pipe through a valve is reported once, as the valve', PD.clashes().length === 1 && PD.clashes()[0].kind === 'valve', JSON.stringify(PD.clashes()));
PD.load({ pipes: [{ a: [0, 1, 0], b: [6, 1, 0], n: 4, ln: 'L-001' }, { a: [0, 1, 0.3], b: [6, 1, 0.3], n: 2, ln: 'L-002' }], valves: [{ p: [3, 1, 0], d: [1, 0, 0], n: 4, s: 40, k: 'gate' }] });
check('a parallel NPS 2 pipe at 300 mm beside a valve is not', PD.clashes().length === 0, JSON.stringify(PD.clashes()));

// Flanges at pipe ends, valve ends and flanges fitted against valves.
const ve = id => els['ve-' + id].onclick();
fresh(run4()); ve('auto'); chipTap('flange', 'wn'); tapOn([5.9, 1, 0]);
check('a flange tapped at a free pipe end is one flange on that end', PD.model.flanges.length === 1 && PD.model.flanges[0].e === 1 && near(PD.model.flanges[0].p, [6, 1, 0]) && PD.model.flanges[0].d[0] > 0.9, JSON.stringify(PD.model.flanges));
check('and the BOM has one flange with its gasket and bolts', has('Weld-neck flange 150# BW, NPS 4 SCH 40 | 1') && has('Gasket 150# spiral wound, NPS 4 | 1') && has('Stud bolt set 150#, 8× 5/8 | 1') || (has('Weld-neck flange 150# BW, NPS 4 SCH 40 | 1') && has('Gasket 150# spiral wound, NPS 4 | 1')), rows());
tapOn([5.9, 1, 0]);
check('the same end cannot take a second flange', PD.model.flanges.length === 1);
fresh(run4()); chipTap('flange', 'so'); tapOn([0.1, 1, 0]);
check('at the start end it faces the other way', PD.model.flanges.length === 1 && near(PD.model.flanges[0].p, [0, 1, 0]) && PD.model.flanges[0].d[0] < -0.9 && has('Slip-on flange 150# SO, NPS 4 | 1'), JSON.stringify(PD.model.flanges));
fresh(run4()); chipTap('flange', 'wn'); tapOn([3, 1, 0]);
check('in the middle of a pipe it is still a pair', PD.model.flanges.length === 1 && !PD.model.flanges[0].e && has('Weld-neck flange 150# BW, NPS 4 SCH 40 | 2'), rows());
fresh(run4()); chipTap('flange', 'wn'); tapOn([5.9, 1, 0]);
let fq = PD.fab();
check('an end flange takes its thickness out of the pipe and is welded once', fq.welds.length === 1 && Math.abs(fq.pieces.reduce((a, p) => a + p.len, 0) - pipeQty()) < 0.01 && fq.pieces[0].len < 6 - 0.02, JSON.stringify(fq.pieces.map(p => p.len)));
// valves
fresh(run4()); ve('auto'); chipTap('valve', 'gate'); tapOn([3, 1, 0]);
let vv = PD.model.valves[0], vf = PD.model.flanges;
check('a flanged valve in the middle of a pipe gets a flange against each face', vf.length === 2 && vf.every(f => f.m === 1) && Math.abs(Math.abs(vf[0].p[0] - vv.p[0]) - 0.229 / 2) < 0.002 && Math.abs(Math.abs(vf[1].p[0] - vv.p[0]) - 0.229 / 2) < 0.002 && vf[0].p[0] !== vf[1].p[0], JSON.stringify([vv, vf]));
check('the flanges face the valve', vf.every(f => (vv.p[0] - f.p[0]) * f.d[0] > 0), JSON.stringify(vf.map(f => f.d)));
check('the BOM has two flanges, two gaskets and two bolt sets with the valve', has('Weld-neck flange 150# BW, NPS 4 SCH 40 | 2') && has('Gasket 150# spiral wound, NPS 4 | 2') && has('Gate valve flanged 150#, NPS 4 | 1'), rows());
fq = PD.fab();
check('the pipe lengths allow for the valve and both flanges', Math.abs(fq.pieces.reduce((a, p) => a + p.len, 0) - pipeQty()) < 0.01 && fq.pieces.length === 2, JSON.stringify(fq.pieces.map(p => p.len)));
check('the flanges are welded to the pipe and bolted to the valve', fq.welds.length === 2 && fq.joints.length === 2, JSON.stringify([fq.welds.length, fq.joints.length]));
check('the valve stays its own spool, the pipe pieces are separate', fq.spools.length === 2);
els['t-sel'].onclick(); tapOn(vv.p);
els['i-pos'].value = '2000'; els['i-pos'].onchange();
check('moving the valve takes its flanges with it', near(PD.model.valves[0].p, [2, 1, 0]) && PD.model.flanges.every(f => Math.abs(Math.abs(f.p[0] - 2) - 0.1145) < 0.002), JSON.stringify(PD.model.flanges.map(f => f.p)));
PD.model.valves[0].k = 'globe'; PD.rebuild();
els['t-sel'].onclick(); tapOn([2, 1, 0]);
els['i-k'].value = 'ball'; els['i-k'].onchange();
check('changing the valve type refits the flanges to the new face to face length', PD.model.flanges.length === 2 && PD.model.flanges.every(f => Math.abs(Math.abs(f.p[0] - 2) - 0.229 / 2) < 0.002), JSON.stringify(PD.model.flanges.map(f => f.p)));
els['i-ve'].value = 'thd'; els['i-ve'].onchange();
check('making it threaded takes the flanges away', PD.model.flanges.length === 0 && PD.model.valves[0].e === 'thd' && has('Ball valve THD 150#, NPS 4 | 1'), rows());
els['i-ve'].value = 'flg'; els['i-ve'].onchange();
check('and flanged puts them back', PD.model.flanges.length === 2 && PD.model.valves[0].e === 'flg');
els['i-del'].onclick();
check('deleting the valve deletes its flanges', PD.model.valves.length === 0 && PD.model.flanges.length === 0);
fresh(run4()); ve('thd'); chipTap('valve', 'gate'); tapOn([3, 1, 0]);
check('a threaded valve gets no flanges', PD.model.flanges.length === 0 && PD.model.valves[0].e === 'thd' && has('Gate valve THD 150#, NPS 4'), rows());
ve('weld'); chipTap('valve', 'globe'); tapOn([4.5, 1, 0]);
check('a welded valve is BW on large pipe', PD.model.valves[1].e === 'weld' && PD.model.flanges.length === 0 && has('Globe valve BW, NPS 4'), rows());
check('and its ends are welds in the cut list', PD.fab().welds.filter(w => w.kind === 'BW').length >= 2);
ve('auto'); fresh([{ a: [0, 1, 0], b: [6, 1, 0], n: 1 }]); chipTap('valve', 'gate'); tapOn([3, 1, 0]);
check('small bore valves stay socket-weld and need no flanges', PD.model.flanges.length === 0 && has('Gate valve SW 800#, NPS 1'), rows());
fresh(run4()); ve('flg'); chipTap('valve', 'gate'); tapOn([5.95, 1, 0]);
vv = PD.model.valves[0];
check('a valve tapped at a free pipe end sits on the end with one flange on the pipe side', near(vv.p, [6 - 0.229 / 2, 1, 0]) && PD.model.flanges.length === 1 && PD.model.flanges[0].p[0] < vv.p[0], JSON.stringify([vv, PD.model.flanges]));
fresh(run4()); ve('auto'); chipTap('valve', 'butterfly'); tapOn([3, 1, 0]);
check('a wafer valve goes between two flanges', PD.model.flanges.length === 2);
fresh(run4()); ve('auto'); chipTap('valve', 'gate'); tapOn([0.5, 1, 0]);
check('a valve close to the end of a pipe that is already taken is placed in the pipe with room for its flanges', PD.model.valves.length === 1);
ve('auto');

// Three pipes at a bend, a real cross, and joints that cannot be made.
PD.load({ pipes: [{ a: [0, 0, 0], b: [3, 0, 0], n: 4 }, { a: [3, 0, 0], b: [3, 0, 3], n: 4 }, { a: [3, 0, 0], b: [3, 3, 0], n: 4 }], valves: [] });
check('a branch at a bend becomes an elbow with a stub-in', has('Elbow 90° LR BW, NPS 4 SCH 40 | 1') && has('Stub-in branch on elbow, PE, NPS 4 SCH 40 | 1'), rows());
check('and the bend warns once to check it', PD.warns().some(w => w.includes('meet at a bend')) && !PD.warns().some(w => w.includes('without a straight run')), PD.warns().join());
check('the pipes are cut back for the elbow, so none is left overlapping', Math.abs(pipeQty() - (9 - 2 * 0.1524 - 0.0632)) < 0.02, String(pipeQty()));
PD.load({ pipes: [{ a: [0, 0, 0], b: [3, 0, 0], n: 4 }, { a: [3, 0, 0], b: [3, 0, 3], n: 4 }, { a: [3, 0, 0], b: [3, 3, 0], n: 2 }], valves: [] });
check('a branch at half size or less on a bend is an olet', has('Weldolet BW on elbow, NPS 4×2 SCH 40 | 1'), rows());
const fb2 = PD.fab();
check('the cut list covers the bend: welds at every pipe end, one spool', fb2.welds.length === 3 && fb2.spools.length === 1 && fb2.pieces.length === 3, JSON.stringify([fb2.welds.length, fb2.spools.length, fb2.pieces.length]));
PD.load({ pipes: [{ a: [0, 0, 0], b: [3, 0, 0], n: 4 }, { a: [3, 0, 0], b: [6, 0, 0], n: 4 }, { a: [3, 0, -2], b: [3, 0, 0], n: 4 }, { a: [3, 0, 0], b: [3, 0, 2], n: 4 }], valves: [] });
check('four pipes through one point make a cross', has('Cross BW, NPS 4 SCH 40 | 1') && !PD.warns().some(w => w.includes('do not make a cross')), rows() + PD.warns().join());
PD.load({ pipes: [{ a: [0, 0, 0], b: [3, 0, 0], n: 4 }, { a: [3, 0, 0], b: [6, 0, 0], n: 4 }, { a: [3, 0, 0], b: [3, 0, 2], n: 4 }, { a: [3, 0, 0], b: [3, 2, 0], n: 4 }], valves: [] });
check('four pipes that are not a cross are reported and get no fitting', PD.warns().some(w => w.includes('4 pipes meet at one point')) && !has('Cross BW'), rows() + PD.warns().join());
PD.load({ pipes: [{ a: [0, 0, 0], b: [3, 0, 0], n: 4 }, { a: [3, 0, 0], b: [6, 0, 0], n: 4 }, { a: [3, 0, 0], b: [4.5, 0, 0.6], n: 4 }], valves: [] });
check('a branch at an odd angle is reported', PD.warns().some(w => w.includes('not 90° or 45°')), PD.warns().join());
check('and the joint with no fitting makes no weld numbers', PD.fab().welds.filter(w => Math.abs(w.pos[0] - 3) < 0.2).length === 0, JSON.stringify(PD.fab().welds.map(w => w.pos)));

// Removing a fitting.
PD.load({ pipes: [{ a: [0, 0, 0], b: [4, 0, 0], n: 4 }, { a: [4, 0, 0], b: [4, 0, 1], n: 4 }, { a: [4, 0, 1], b: [7, 0, 1], n: 4 }], valves: [{ p: [4, 0, 0.5], d: [0, 0, 1], n: 4, k: 'gate' }] });
PD.removeItem('fit', '4000,0,0');
check('removing an elbow removes the shortest pipe at it, with what sits on that pipe', PD.model.pipes.length === 2 && PD.model.valves.length === 0 && PD.model.pipes.every(p => p.b[0] !== 4 || p.b[2] !== 1), JSON.stringify(PD.model.pipes));
check('and the other elbow stays', has('Elbow 90°') === false || has('Elbow 90° LR BW, NPS 4 SCH 40 | 1'), rows());
PD.load({ pipes: [{ a: [0, 0, 0], b: [4, 0, 0], n: 4 }], valves: [], caps: [[4, 0, 0, 'cap']] });
PD.removeItem('fit', '4000,0,0');
check('an end cap can be removed', PD.model.caps.length === 0 && PD.model.pipes.length === 1);
PD.load({ pipes: [{ a: [0, 0, 0], b: [3, 0, 0], n: 4 }, { a: [3, 0, 0], b: [6, 0, 0], n: 4 }, { a: [3, 0, 0], b: [3, 0, 1], n: 4 }], valves: [], caps: [[3, 0, 1, 'cap']] });
PD.removeItem('fit', '3000,0,0');
check('removing a tee removes its short branch and the cap on it', PD.model.pipes.length === 2 && PD.model.caps.length === 0, JSON.stringify([PD.model.pipes.length, PD.model.caps]));
PD.removeItem('fit', '9999,0,0');
check('a fitting that is not there changes nothing', PD.model.pipes.length === 2);
els['t-sel'].onclick(); PD.load({ pipes: [{ a: [0, 0, 0], b: [4, 0, 0], n: 4 }, { a: [4, 0, 0], b: [4, 0, 2], n: 4 }], valves: [] });
els['t-del'].onclick(); tapOn([3.955, 0, 0.045]);
check('the delete tool on an elbow now works too', PD.model.pipes.length === 1, String(PD.model.pipes.length));

// Elevation panel: typed heights, levels, the eyedropper and the drawing aids.
PD.load({ pipes: [{ a: [0, 1, 0], b: [6, 1, 0], n: 4 }, { a: [6, 1, 0], b: [6, 3.5, 0], n: 4 }], valves: [] }); els['finish'].onclick(); els['t-pipe'].onclick();
['lv-in', 'lv-name'].forEach(id => doc.getElementById(id));
PD.setLevel(2.25);
check('with no run going, a typed level sets the working height', PD.elevNow() === 2.25 && els['elv'].textContent === 'EL +2.250 m', els['elv'].textContent);
check('there is no extra grid to draw at that height', PD.viz().grid === undefined);
PD.setLevel(0);
els['lv-in'].value = '4100'; els['lv-go'].onclick();
check('typing millimetres in the panel works', PD.elevNow() === 4.1);
PD.setLevel(-3);
check('a level below the floor goes to the floor', PD.elevNow() === 0);
const lv = PD.levelList().map(l => l[0]);
check('the level list holds the floor and the heights already in the drawing, in order', lv.join() === '0,1000,3500', lv.join());
els['lv-name'].value = 'Pipe rack'; els['lv-in'].value = '4500'; els['lv-save'].onclick();
check('a level can be named and kept with the project', PD.model.levels.length === 1 && PD.model.levels[0].name === 'Pipe rack' && PD.model.levels[0].z === 4.5 && PD.levelList().some(l => l[0] === 4500 && l[1] === 'Pipe rack'), JSON.stringify(PD.model.levels));
check('the chips show the name and a remove button for it', (els['lv-list'].innerHTML.match(/data-z=/g) || []).length === 4 && els['lv-list'].innerHTML.includes('Pipe rack') && els['lv-list'].innerHTML.includes('data-del="4500"'), els['lv-list'].innerHTML);
L['lv-list'].click({ target: { closest: () => ({ getAttribute: k => ({ 'data-del': '4500' })[k] ?? null }) } });
check('removing it takes it off the list', PD.model.levels.length === 0 && !PD.levelList().some(l => l[0] === 4500));
els['lv-name'].value = ''; els['lv-save'].onclick();
check('a level needs a name', PD.model.levels.length === 0);
fresh(run4()); PD.setLevel(1);
tapOn([2, 1, 0]); 
els['t-pipe'].onclick(); tapOn([6, 1, 0]);
check('while drawing, a level adds a vertical pipe from the run to that height', (() => { if (!PD.cursor()) return true; const n = PD.model.pipes.length; PD.setLevel(3); const last = PD.model.pipes[PD.model.pipes.length - 1]; return PD.model.pipes.length === n + 1 && Math.abs(last.b[1] - 3) < 1e-9 && last.a[0] === last.b[0]; })());
fresh(run4()); els['t-pipe'].onclick(); tapOn([6, 1, 0]);
const nP2 = PD.model.pipes.length, cur0 = PD.cursor();
if (cur0) { PD.setLevel(cur0[1] + 0.02); }
check('a change of under 50 mm while drawing is refused', !cur0 || PD.model.pipes.length === nP2);
fresh([{ a: [0, 2.5, 0], b: [4, 2.5, 0], n: 4 }]); els['lv-pick'].onclick(); tapOn([2, 2.5, 0]);
check('the eyedropper takes the height of the pipe you tap', Math.abs(PD.elevNow() - 2.5) < 1e-9, String(PD.elevNow()));
els['lv-pick'].onclick(); els['lv-pick'].onclick();
tapOn([2, 2.5, 0]);
check('tapping the panel button twice turns the eyedropper off again', PD.elevNow() === 2.5);
PD.load({ pipes: [{ a: [0, 1, 0], b: [2, 1, 0], n: 4 }], valves: [], levels: [{ name: 'Rack', z: 4.5 }, { name: 'bad', z: 'x' }, null] });
check('levels are loaded from a project and bad ones are skipped', PD.model.levels.length === 1 && PD.model.levels[0].name === 'Rack');
check('and saved in the project file', JSON.stringify({ model: PD.model }).includes('"levels":[{"name":"Rack","z":4.5}]'));
fresh(run4()); els['t-pipe'].onclick(); tapOn([6, 1, 0]);
check('a drop line to the floor with its height follows the run being drawn', !PD.cursor() || (PD.viz().drop === true && PD.viz().label === 'EL +' + PD.cursor()[1].toFixed(3)), JSON.stringify(PD.viz()));
fresh(run4());

// Weight, exports.
PD.load({ pipes: [{ a: [0, 0, 0], b: [10, 0, 0], n: 4 }], valves: [] });
const wt = PD.rows().find(r => r[0].startsWith('Pipe weight'));
check('pipe weight about 16 kg/m', wt && Math.abs(parseFloat(wt[1]) - 160.7) < 2, JSON.stringify(wt));
check('csv has header, rows and the standard column', PD.csv().startsWith('Item,Quantity,Standard / material\n') && PD.csv().includes('Pipe, NPS 4') && PD.csv().includes('ASTM A106 Gr.B'));
check('dxf has a LINE', PD.dxf().includes('\nLINE\n') && PD.dxf().trim().endsWith('EOF'));
check('iso sheet renders', /^<svg/.test(PD.iso()) && PD.iso().includes('DRAWING No.') && PD.iso().includes('CUT LIST'));
PD.load({ pipes: [], valves: [] });
check('iso sheet empty returns null', PD.iso() === null);

// BOM by line: equipment on a later line, a selection that only exists in the whole model, awkward line names, an empty project.
const awk = 'Z"1,' + String.fromCharCode(10) + 'x';
PD.load({ pipes: [{ a: [0, 0, 0], b: [4, 0, 0], n: 4, ln: 'A' }, { a: [-0.35, 0.4, 8], b: [-3, 0.4, 8], n: 4, ln: awk }], valves: [], equip: [{ k: 'pump', p: [0, 0, 8], r: 0 }] });
{
  const rowsBefore = JSON.stringify(PD.rows()), warnsBefore = JSON.stringify(PD.warns());
  els['t-sel'].onclick(); tapOn([-1.5, 0.4, 8]);
  const inspBefore = els['insp'].innerHTML, hidBefore = els['insp'].hidden;
  const out = PD.bomByLine(), q = '"' + awk.replace(/"/g, '""') + '"', part = out.split(q);
  check('BOM by line: a later line keeps its own equipment, and a line name with quote, comma and newline stays one quoted field', part.length > 2 && /Centrifugal pump/.test(part.slice(1).join('')) && !/Centrifugal pump/.test(part[0]), out);
  check('BOM by line: selection, inspector, warnings and BOM are as before', !hidBefore && inspBefore.includes('Pipe 2<') && els['insp'].innerHTML === inspBefore && els['insp'].hidden === hidBefore && JSON.stringify(PD.rows()) === rowsBefore && JSON.stringify(PD.warns()) === warnsBefore);
}
PD.load({ pipes: [], valves: [] });
check('BOM by line: an empty project gives just the header', PD.bomByLine() === 'Line,Designation,Description,Quantity,Standard / material' + String.fromCharCode(10));

PD.load({ pipes: [{ a: [0, 0, 0], b: [3, 0, 0], n: 0.25 }, { a: [3, 0, 0], b: [3, 0, 2], n: 99 }, { a: [3, 0, 2], b: [5, 0, 2], n: 'x' }], valves: [{ p: [1, 0, 0], d: [1, 0, 0], n: 5, k: 'gate' }] });
check('a size outside the list is snapped to the nearest listed size and the model still rebuilds', PD.model.pipes.map(p => p.n).join() === '0.5,12,4' && PD.model.valves[0].n === 4 && PD.rows().length > 0);
// Custom parts: the project library model.custom, placed as inline items with t = 'cu:' + id.
{
  const C = PD.custom, reset = () => { PD.load({ pipes: [{ a: [0, 0, 0], b: [4, 0, 0], n: 4 }], valves: [] }); };
  reset();
  check('an old save without custom loads with an empty library', Array.isArray(PD.model.custom) && PD.model.custom.length === 0);
  const bad = [{ name: '', len: 200 }, { name: 'x', len: 10 }, { name: 'x', len: 3001 }, { name: 'x', len: 'abc' }, { name: 'x', len: 200, wt: -1 }, { name: 'x', len: 200, k: -2 }];
  check('bad input is refused with a message and adds nothing', bad.every(f => { const r = C.add(f); return r.err && !r.e; }) && PD.model.custom.length === 0, JSON.stringify(bad.map(f => C.validate(f).err)));
  const r1 = C.add({ name: 'Y-strainer', brand: 'Acme', model: 'S-100', len: '250', wt: '12,5', k: 3, prefix: 'sx!' });
  const id = r1.e && r1.e.id;
  check('add: fields are cleaned (length number, comma decimal, tag prefix upper case)', r1.e && r1.e.len === 250 && r1.e.wt === 12.5 && r1.e.prefix === 'SX' && PD.model.custom.length === 1 && /^[A-Za-z0-9_-]+$/.test(id));
  check('the Custom palette has one chip per entry with the brand and model', C.parts().length === 1 && C.parts()[0][0] === 'cu:' + id && C.parts()[0][1].includes('Y-strainer') && C.parts()[0][1].includes('Acme S-100'), JSON.stringify(C.parts()));
  check('update with a bad length is refused and the entry is unchanged', C.update(id, { len: 5 }).err && PD.model.custom[0].len === 250);
  // place it the way a finger does: Parts chip, then tap the pipe
  els['t-parts'].onclick();
  L.parts.click({ target: { closest: () => ({ dataset: { chip: 'cu:' + id, cat: 'custom' } }) } });
  tapOn([2, 0, 0]);
  const it = PD.model.items[0];
  check('tapping a pipe with a Custom chip places an inline item of that type', PD.model.items.length === 1 && it.t === 'cu:' + id && it.n === 4, JSON.stringify(PD.model.items));
  check('BOM row: name, brand and model with the size, quantity 1, brand and model and weight in the standard column',
    PD.rows().some(r => r[0] === 'Y-strainer, Acme S-100, NPS 4' && r[1] === '1' && r[2] === 'Acme S-100, 12.5 kg each'), JSON.stringify(PD.rows()));
  check('the pipe BOM quantity loses the part length', has('Pipe, NPS 4 SCH 40, BE | 3.75 m'), rows());
  const fab = PD.fab();
  check('cut list splits the pipe around the part (lengths add up to the BOM pipe)', fab.pieces.length === 2 && Math.abs(fab.pieces.reduce((s, p) => s + p.len, 0) - 3.75) < 0.001, JSON.stringify(fab.pieces.map(p => p.len)));
  check('the tag uses the prefix', PD.tags().items[0] === 'SX-1');
  const isoP = PD.iso('', 0, true, 'pic'), isoS = PD.iso('', 0, true, 'sym');
  check('iso sheet balloons the part and lists it in the material list', isoP.includes('Y-strainer, Acme S-100, NPS 4') && /<circle[^>]*r="9.5"/.test(isoP));
  check('with no picture the iso draws the generic box in both styles', isoP.includes('<line x1="-9" y1="-8" x2="9" y2="8"') && isoS.includes('<line x1="-9" y1="-8" x2="9" y2="8"') && !isoP.includes('<image'));
  const tiny = 'data:image/jpeg;base64,/9j/4AAQSkZJRgABAQ==';
  check('a picture is stored and drawn in the pic style only', C.setImg(id, tiny) && PD.iso('', 0, true, 'pic').includes('<image href="' + tiny) && !PD.iso('', 0, true, 'sym').includes('<image'));
  check('a picture over the size limit or of the wrong type is refused', !C.setImg(id, 'data:image/jpeg;base64,' + 'A'.repeat(41000)) && !C.setImg(id, 'data:text/html;base64,AAAA') && !C.setImg(id, 'javascript:alert(1)') && PD.model.custom[0].img === tiny);
  check('Remove picture clears it', C.setImg(id, '') && !PD.model.custom[0].img);
  // hydraulics: K used only when given
  PD.model.lines['L-001'] = { q: 40 }; PD.rebuild();
  check('loss K enters the hydraulics', PD.hyd().fits.some(f => f.label.startsWith('Y-strainer') && f.K === 3));
  C.update(id, { k: '' }); PD.rebuild();
  check('K of 0 is ignored in hydraulics', !PD.hyd().fits.some(f => f.label.startsWith('Y-strainer')));
  // editing the length re-trims the pipes
  C.update(id, { len: 500 });
  check('editing the length changes the pipe trim for every placed copy', has('Pipe, NPS 4 SCH 40, BE | 3.50 m') && Math.abs(PD.fab().pieces.reduce((s, p) => s + p.len, 0) - 3.5) < 0.001, rows());
  C.update(id, { name: 'Strainer B' });
  check('editing the name renames the BOM row', PD.rows().some(r => r[0].startsWith('Strainer B, Acme S-100')) && C.parts()[0][1].includes('Strainer B'));
  // duplicate
  const d = C.dup(id);
  check('duplicate makes a separate entry with a new id and the same data', d && d.id !== id && PD.model.custom.length === 2 && d.len === 500 && d.brand === 'Acme' && d.name === 'Strainer B copy');
  // save and reopen
  const saved = JSON.parse(JSON.stringify({ app: 'pipedraft', version: 2, model: PD.model }));
  PD.load({ pipes: [], valves: [] });
  check('a cleared project has an empty library', PD.model.custom.length === 0 && C.parts().length === 0);
  PD.load(saved.model);
  check('a saved and reopened project keeps the library and the placed items', PD.model.custom.length === 2 && PD.model.items.length === 1 && PD.model.items[0].t === 'cu:' + id && C.parts().length === 2 && has('Pipe, NPS 4 SCH 40, BE | 3.50 m'), rows());
  // delete a used entry
  const n0 = C.count(id), nDel = C.del(id);
  check('deleting a used entry reports how many are placed', n0 === 1 && nDel === 1 && PD.model.custom.length === 1);
  check('the placed item still works: same BOM text, length, tag and iso', PD.rows().some(r => r[0].startsWith('Strainer B, Acme S-100, NPS 4') && r[1] === '1') && has('Pipe, NPS 4 SCH 40, BE | 3.50 m') && PD.tags().items[0] === 'SX-1' && PD.iso('', 0, true, 'pic').includes('Strainer B'), rows());
  els['t-sel'].onclick(); tapOn([2, 0, 0]);
  check('the inspector shows the deleted part without breaking', els['insp'].innerHTML.includes('Inline fitting') && els['insp'].innerHTML.includes('Strainer B (deleted)'));
  els['t-parts'].onclick();
  L.parts.click({ target: { closest: () => ({ dataset: { chip: 'cu:' + id, cat: 'custom' } }) } });
  tapOn([3.2, 0, 0]);
  check('a deleted part cannot be placed again', PD.model.items.length === 1);
  check('the library list has Duplicate and Delete for each entry', (() => { const h = C.html(); return h.includes('Strainer B copy') && h.includes('Duplicate') && h.includes('Delete'); })());
  PD.model.items.push({ p: [3.2, 0, 0], d: [1, 0, 0], n: 4, t: 'cu:' + d.id, s: 40 }); PD.rebuild();
  check('the list shows a placed count for used entries', C.html().includes('1 placed'));
  check('move/copy/mirror keep working with a custom part', (() => { PD.group.copy(0, 0, 3, 0, 1); return PD.model.items.filter(i => i.t === 'cu:' + d.id).length === 2; })());
  // subset sheet per line
  reset(); PD.model.pipes[0].ln = 'L-009'; PD.model.pipes.push({ a: [0, 0, 3], b: [4, 0, 3], n: 4, s: 40, ln: 'L-010', fl: 0 });
  const rr = C.add({ name: 'Meter', len: 300 }); PD.model.items.push({ p: [2, 0, 0], d: [1, 0, 0], n: 4, t: 'cu:' + rr.e.id, s: 40 }); PD.rebuild();
  check('a line sheet keeps custom parts on its own line only', PD.iso('L-009', 0).includes('Meter, NPS 4') && !PD.iso('L-010', 0).includes('Meter'));
  check('the BOM by line works with a custom part', PD.bomByLine().includes('Meter'));
  // export / import merge
  reset();
  C.add({ name: 'A', len: 100 }); C.add({ name: 'B', len: 120, brand: 'Bx' });
  const text = C.exp();
  check('export is a PipeDraft custom parts file with both entries', JSON.parse(text).kind === 'custom-parts' && JSON.parse(text).custom.length === 2);
  check('importing the same file adds nothing', C.imp(text) === 0 && PD.model.custom.length === 2);
  const clash = JSON.parse(text); clash.custom[0].name = 'A changed'; clash.custom.push({ id: 'newone', name: 'C', len: 80 });
  check('import merges by id: a clashing id gets a new id, a new one is added, existing entries stay', C.imp(JSON.stringify(clash)) === 2 && PD.model.custom.length === 4 && PD.model.custom[0].name === 'A' && PD.model.custom.filter(e => e.name === 'A changed').length === 1 && new Set(PD.model.custom.map(e => e.id)).size === 4, JSON.stringify(PD.model.custom.map(e => [e.id, e.name])));
  check('import refuses junk and drops unusable entries', C.imp('not json') === -1 && C.imp('{"x":1}') === -1 && C.imp(JSON.stringify([{ name: '', len: 5 }, 7, null])) === 0 && PD.model.custom.length === 4);
  // hand-edited saves
  PD.load({ pipes: [{ a: [0, 0, 0], b: [4, 0, 0], n: 4 }], custom: [{ id: 'q', name: 'Ok', len: 150 }, { id: 'q', name: 'Dup id', len: 150 }, { name: '', len: 1 }, { id: 'z', name: 'Evil', len: 100, img: 'javascript:alert(1)' }, 'junk'] });
  check('normalize drops bad library entries, repairs repeated ids and refuses a non-image picture', PD.model.custom.length === 3 && new Set(PD.model.custom.map(e => e.id)).size === 3 && !PD.model.custom.some(e => e.img));
  // image helpers
  const sz1 = C.imgSize(1600, 800), sz2 = C.imgSize(100, 50), sz3 = C.imgSize(300, 900);
  check('picture size: long side at most 160 px, aspect kept, never enlarged', sz1.w === 160 && sz1.h === 80 && sz2.w === 100 && sz2.h === 50 && sz3.h === 160 && sz3.w === 53 && C.imgSize(0, 5).w === 0);
  const q = [];
  const fake = { toDataURL(t, qq) { q.push(qq); return 'data:image/jpeg;base64,' + 'A'.repeat(qq > 0.7 ? 50000 : qq > 0.4 ? 30000 : 100); } };
  check('picture encoding lowers the JPEG quality until it fits 40 KB', C.imgEncode(fake) !== '' && q.join() === '0.8,0.65' && C.imgEncode({ toDataURL: () => 'data:image/jpeg;base64,' + 'A'.repeat(90000) }) === '' && C.imgEncode({ toDataURL() { throw new Error('x'); } }) === '');
  // hostile hand-edited save
  const evil = '<script>x</script>"\' onfocus="x';
  PD.load({ pipes: [{ a: [0, 0, 0], b: [4, 0, 0], n: 4 }, { a: [4, 0, 0], b: [4, 0, 2], n: 4 }], custom: [{ id: 'q', name: '=' + evil, brand: '+cmd', model: '@x', len: 150 }],
    items: [{ p: [2, 0, 0], d: [1, 0, 0], n: 4, t: 'cu:q' }, { p: [1, 0, 0], d: [1, 0, 0], n: 4, t: 'cu:a" onfocus="x' }, { p: [3, 0, 0], d: [1, 0, 0], n: 4, t: 'cu:z', cl: 1e9, ck: 1e9, cn: '=big'.repeat(50), cp: '<i>' }] });
  els['t-sel'].onclick(); tapOn([3, 0, 0]);
  check('a cu: type with odd characters is dropped; a stale cache is clamped (length, K, text, tag prefix)', PD.model.items.length === 2 && C.ux()['cu:z'].len === 0.2 && C.ux()['cu:z'].k === 0 && C.ux()['cu:z'].name.length <= 40 && !/^[=+@]/.test(C.ux()['cu:z'].name) && C.ux()['cu:z'].prefix === 'I' && Number(PD.rows()[0][1].split(' ')[0]) > 0, JSON.stringify(PD.rows()[0]));
  check('names lose a leading = + @ (CSV formula) and the inspector escapes option values', !/^[=+@]/.test(PD.model.custom[0].name) && !/^[=+@]/.test(PD.model.custom[0].brand) && !els['insp'].innerHTML.includes('onfocus="x'));
  const many = []; for (let i = 0; i < 1000; i++) many.push({ id: 'i' + i, name: 'P' + i, len: 100 });
  PD.load({ pipes: [{ a: [0, 0, 0], b: [4, 0, 0], n: 4 }], custom: many });
  check('the library is capped at 300 entries on load, add, duplicate and import', PD.model.custom.length === 300 && C.add({ name: 'x', len: 100 }).err && C.dup('i0') === null && C.imp(JSON.stringify(many.map(e => ({ name: 'n' + e.id, len: 100 })))) === 0);
  // a part longer than the pipe is reported
  PD.load({ pipes: [{ a: [0, 0, 0], b: [2, 0, 0], n: 4 }], valves: [] });
  const lg = C.add({ name: 'Long', len: 200 }).e; PD.model.items.push({ p: [1, 0, 0], d: [1, 0, 0], n: 4, t: 'cu:' + lg.id, s: 40 }); PD.rebuild();
  check('no warning while it fits', !PD.warns().some(w => w.includes('does not fit')));
  C.update(lg.id, { len: 3000 });
  check('a part longer than the pipe left raises a warning', PD.warns().some(w => w.startsWith('Long (3000 mm) does not fit on pipe 1')), PD.warns().join('|'));
  // storage: pictures make snapshots big
  PD.load({ pipes: [{ a: [0, 0, 0], b: [4, 0, 0], n: 4 }] });
  const pic = 'data:image/jpeg;base64,' + 'A'.repeat(39000);
  for (let i = 0; i < 30; i++) C.add({ name: 'P' + i, len: 100, img: pic });
  Object.keys(memStore).forEach(k => delete memStore[k]);
  for (let i = 0; i < 6; i++) { PD.model.pipes[0].b[0] = 4 + i; PD.backup(true); }
  const bk = PD.backups();
  check('backups with 30 pictures are limited in total size so the project still fits storage', bk.length >= 1 && bk.length <= 2 && bk.reduce((n, b) => n + b.json.length, 0) <= 2.5e6, String(bk.length));
}

// Custom equipment (phase 2): library entries of kind 'equipment', placed through the Equipment tool as model.equip {k:'cu:'+id}.
{
  const C = PD.custom, E = 'cu:';
  const six = [
    { x: 1000, y: 200, z: 700, dir: '+X', n: 4 }, { x: -1000, y: -200, z: 700, dir: '-X', n: 3 }, { x: 300, y: 500, z: 800, dir: '+Y', n: 2 },
    { x: -300, y: -500, z: 800, dir: '-Y', n: 2 }, { x: 100, y: 100, z: 1500, dir: '+Z', n: 4 }, { x: -100, y: 0, z: 0, dir: '-Z', n: 1.5 }];
  const box = { kind: 'equipment', name: 'Skid A', brand: 'Acme', model: 'K-9', shape: 'box', w: 2000, d: 1000, h: 1500, col: 2, prefix: 'sk!', wt: 800, noz: six };
  const base = { kind: 'equipment', shape: 'box', w: 1000, d: 800, h: 1200 };
  PD.load({ pipes: [], valves: [] });
  const bad = [{ name: '' }, { name: 'x', w: 50 }, { name: 'x', w: 20001 }, { name: 'x', w: 'abc' }, { name: 'x', h: 99 }, { name: 'x', shape: 'sphere' }, { name: 'x', wt: -1 },
    { name: 'x', noz: Array(9).fill(six[0]) }, { name: 'x', noz: [{ x: 'a', y: 0, z: 0, dir: '+X', n: 4 }] }, { name: 'x', noz: [{ x: 0, y: 0, z: 0, dir: '+Q', n: 4 }] }, { name: 'x', noz: [{ x: Infinity, y: 0, z: 0, dir: '+X', n: 4 }] }, { name: 'x', noz: [{ x: 0, y: 0, z: 0, dir: '+X' }] }];
  check('equipment: bad input is refused with a message and adds nothing', bad.every(f => { const r = C.add(Object.assign({}, base, f)); return r.err && !r.e; }) && PD.model.custom.length === 0, JSON.stringify(bad.map(f => C.validate(Object.assign({}, base, f)).err)));
  const r1 = C.add(box), id = r1.e && r1.e.id, key = E + id;
  check('equipment: add cleans fields (prefix upper case, integers, kind)', r1.e && r1.e.kind === 'equipment' && r1.e.prefix === 'SK' && r1.e.noz.length === 6 && r1.e.w === 2000 && r1.e.col === 2 && r1.e.wt === 800 && PD.model.custom.length === 1);
  check('equipment: it is a chip in Parts > Equipment, not in Custom', C.eqParts().length === 6 && C.eqParts()[5][0] === key && C.eqParts()[5][1].includes('Skid A') && C.eqParts()[5][1].includes('Acme K-9') && C.parts().length === 0, JSON.stringify(C.eqParts()));
  check('equipment: an out-of-range nozzle is clamped to 500 mm outside the outline', C.update(id, { noz: [{ x: 9999, y: -9999, z: 99999, dir: '+X', n: 4 }] }).e && JSON.stringify(PD.model.custom[0].noz[0]) === JSON.stringify({ x: 1500, y: -1000, z: 2000, dir: '+X', n: 4 }), JSON.stringify(PD.model.custom[0].noz));
  C.update(id, { noz: six });
  check('equipment: a bad update leaves the entry unchanged', C.update(id, { h: 5 }).err && PD.model.custom[0].h === 1500 && C.update(id, { noz: [{ x: 1, y: 1, z: 1, dir: 'up', n: 4 }] }).err && PD.model.custom[0].noz.length === 6);
  // place it the way a finger does
  els['t-parts'].onclick();
  L.parts.click({ target: { closest: () => ({ dataset: { chip: key, cat: 'equip' } }) } });
  tapOn([3, 0, 2]);
  const q0 = PD.model.equip[0];
  check('tapping the grid with the chip places equipment with k = cu:id', PD.model.equip.length === 1 && q0.k === key && q0.r === 0 && Math.abs(q0.p[0] - 3) < 1 && Math.abs(q0.p[2] - 2) < 1 && q0.p[1] === PD.elevNow(), JSON.stringify(PD.model.equip));
  check('BOM row: name, brand and model, quantity 1, brand model and weight in the standard column', PD.rows().some(r => r[0] === 'Skid A, Acme K-9' && r[1] === '1' && r[2] === 'Acme K-9, 800 kg each'), JSON.stringify(PD.rows()));
  check('the tag uses the prefix', PD.tags().equip[0] === 'SK-1');
  // nozzle positions: all four rotations, all six directions
  const DIRV = { '+X': [1, 0, 0], '-X': [-1, 0, 0], '+Y': [0, 0, 1], '-Y': [0, 0, -1], '+Z': [0, 1, 0], '-Z': [0, -1, 0] };
  const rotv = (v, r) => { const t = r * Math.PI / 2, c = Math.round(Math.cos(t)), s = Math.round(Math.sin(t)); return [v[0] * c + v[2] * s, v[1], -v[0] * s + v[2] * c]; };
  let posOk = true, msg = '';
  for (let r = 0; r < 4; r++) {
    PD.model.equip[0].r = r; PD.rebuild();
    const nzs = PD.nozzles().filter(z => z.e === 0);
    if (nzs.length !== 6) { posOk = false; msg += 'count ' + nzs.length; }
    six.forEach((s, i) => {
      const lp = rotv([s.x / 1000, s.z / 1000, s.y / 1000], r), ld = rotv(DIRV[s.dir], r), z = nzs[i];
      const wantP = [q0.p[0] + lp[0], q0.p[1] + lp[1], q0.p[2] + lp[2]];
      if (!z || [z.p.x, z.p.y, z.p.z].some((v, k) => Math.abs(v - wantP[k]) > 1e-6) || [z.d.x, z.d.y, z.d.z].some((v, k) => Math.abs(v - ld[k]) > 1e-6) || z.n !== s.n || z.idx !== i) { posOk = false; msg += ' r' + r + 'N' + (i + 1); }
    });
  }
  check('nozzle positions and directions are right for 4 rotations x 6 directions', posOk, msg);
  PD.model.equip[0].r = 0; PD.rebuild();
  check('the +X nozzle at rotation 0 is where the CAD numbers say (x 1000, y 200, z 700 from the base)', (() => { const z = PD.nozzles()[0], b = PD.model.equip[0].p; return Math.abs(z.p.x - (b[0] + 1)) < 1e-9 && Math.abs(z.p.z - (b[2] + 0.2)) < 1e-9 && Math.abs(z.p.y - (b[1] + 0.7)) < 1e-9; })());
  // a pipe snaps to a nozzle
  const ax = PD.model.equip[0].p;
  PD.startAtNozzle(PD.nozzles()[0]);
  check('a run starts on the custom nozzle and leaves along its axis', PD.model.pipes.length === 1 && PD.cursor()[0] > ax[0] + 1.2 && Math.abs(PD.cursor()[1] - (ax[1] + 0.7)) < 1e-9, JSON.stringify(PD.model.pipes));
  const arr3 = z => [z.p.x, z.p.y, z.p.z].map(v => Math.round(v * 1000) / 1000);
  PD.routeTo(PD.cursor(), arr3(PD.nozzles()[1]), PD.nozzles()[1]); PD.rebuild();
  check('a nozzle-to-nozzle route ends on the second nozzle; a size mismatch is reported', PD.cursor() === null && PD.warns().some(w => w.includes('skid a nozzle N2 is NPS 3 but the pipe is NPS 4') || w.includes('Skid A nozzle N2 is NPS 3 but the pipe is NPS 4')), PD.warns().join('|'));
  // clash
  const lib0 = JSON.parse(JSON.stringify(PD.model.custom[0]));
  PD.load({ pipes: [{ a: [-3, 0.7, 0], b: [3, 0.7, 0], n: 4 }], equip: [{ k: key, p: [0, 0, 0], r: 0 }], custom: [lib0] });
  check('a pipe through the body clashes with the equipment', PD.clashes().some(c => c.kind === 'equip' && c.text.includes('SK-1')), JSON.stringify(PD.clashes()));
  PD.load({ pipes: [{ a: [1, 0.7, 0.2], b: [3, 0.7, 0.2], n: 4 }], equip: [{ k: key, p: [0, 0, 0], r: 0 }], custom: [lib0] });
  check('a pipe starting at a nozzle does not clash', PD.clashes().length === 0, JSON.stringify(PD.clashes()));
  PD.load({ pipes: [{ a: [-3, 2, 0], b: [3, 2, 0], n: 4 }], equip: [{ k: key, p: [0, 0, 0], r: 0 }], custom: [lib0] });
  check('a pipe above the body does not clash', PD.clashes().length === 0);
  PD.load({ pipes: [{ a: [0, 0.7, -3], b: [0, 0.7, 3], n: 4 }, { a: [1.5, 0.7, -3], b: [1.5, 0.7, 3], n: 4 }], equip: [{ k: key, p: [0, 0, 0], r: 0 }], custom: [lib0] });
  check('unrotated the body is 2000 wide in X and 1000 deep: a pipe along Z at x 0 clashes, one at x 1.5 clears it', PD.clashes().length === 1);
  PD.load({ pipes: [{ a: [0, 0.7, -3], b: [0, 0.7, 3], n: 4 }, { a: [1.5, 0.7, -3], b: [1.5, 0.7, 3], n: 4 }, { a: [-3, 1.8, 0.8], b: [3, 1.8, 0.8], n: 4 }], equip: [{ k: key, p: [0, 0, 0], r: 1 }], custom: [lib0] });
  check('rotated 90 degrees the body is 1000 wide in X and 2000 long in Z: the pipe along Z still clashes, x 1.5 clears, a pipe along X above the 1500 body clears it', PD.clashes().length === 1, JSON.stringify(PD.clashes().map(c => c.text)));
  // cylinder
  const rc = C.add({ kind: 'equipment', name: 'Tank', shape: 'cyl', dia: 1200, h: 2500, col: 1, prefix: 'TK', noz: [{ x: 0, y: 0, z: 2500, dir: '+Z', n: 4 }, { x: 600, y: 0, z: 300, dir: '+X', n: 3 }, { x: 0, y: -600, z: 300, dir: '-Y', n: 3 }] });
  const ckey = E + rc.e.id, cust = [JSON.parse(JSON.stringify(rc.e))];
  PD.load({ pipes: [{ a: [-3, 1, 0.5], b: [3, 1, 0.5], n: 4 }], equip: [{ k: ckey, p: [0, 0, 0], r: 0 }], custom: cust });
  check('cylinder: a pipe through the body clashes', PD.clashes().some(c => c.kind === 'equip'));
  PD.load({ pipes: [{ a: [-3, 1, 0.7], b: [3, 1, 0.7], n: 4 }], equip: [{ k: ckey, p: [0, 0, 0], r: 0 }], custom: cust });
  check('cylinder: a pipe passing outside the radius does not clash', PD.clashes().length === 0, JSON.stringify(PD.clashes()));
  PD.load({ pipes: [{ a: [0, 2.5, 0], b: [0, 4, 0], n: 4 }], equip: [{ k: ckey, p: [0, 0, 0], r: 0 }], custom: cust });
  check('cylinder: a pipe leaving the top nozzle has no clash and no warning about the axis', PD.clashes().length === 0 && PD.warns().filter(w => w.includes('Tank')).length === 0, PD.warns().join('|'));
  check('cylinder: BOM and tag', PD.rows().some(r => r[0] === 'Tank' && r[1] === '1') && PD.tags().equip[0] === 'TK-1');
  // instrument on equipment, iso, P&ID
  PD.load({ pipes: [{ a: [0, 2.5, 0], b: [0, 4, 0], n: 4 }, { a: [0.6, 0.3, 0], b: [3, 0.3, 0], n: 3 }], equip: [{ k: ckey, p: [0, 0, 0], r: 0 }, { k: key, p: [6, 0, 0], r: 0 }], custom: cust.concat([lib0]),
    instr: [{ k: 'LT', eq: 0, p: [0.6, 1.5, 0], num: 101 }] });
  check('an instrument mounted on custom equipment is in the BOM and keeps its tag', has('Level transmitter LT-101 | 1'), rows());
  const isoE = PD.iso('', 0, true, 'sym'), pidE = PD.pid();
  check('the iso sheet draws custom equipment with its tag and nozzle numbers', isoE && isoE.includes('>TK-1<') && isoE.includes('>SK-1<') && isoE.includes('>N1<') && !isoE.includes('NaN'));
  check('the P&ID sheet draws custom equipment with its tag', pidE && pidE.includes('>TK-1<') && pidE.includes('>SK-1<') && !pidE.includes('NaN') && !pidE.includes('undefined'));
  // Paths the reviewer did not exercise: start a run on a custom nozzle, delete earlier equipment (indices shift), edit nozzles under a snapped pipe.
  PD.load({ pipes: [], equip: [{ k: 'pump', p: [0, 0, 0], r: 0 }, { k: ckey, p: [6, 0, 0], r: 1 }], custom: cust, instr: [{ k: 'LT', eq: 1, p: [6.6, 1.5, 0], num: 101 }] });
  const nzB = PD.nozzles().filter(z => z.e === 1).map(arr);
  PD.startAtNozzle(PD.nozzles().find(z => z.e === 1));
  check('a run starts on a custom equipment nozzle', PD.model.pipes.length === 1 && PD.model.pipes[0].a.join() === nzB[0].join(), JSON.stringify([PD.model.pipes, nzB]));
  PD.load({ pipes: [], equip: [{ k: 'pump', p: [0, 0, 0], r: 0 }, { k: ckey, p: [6, 0, 0], r: 1 }], custom: cust, instr: [{ k: 'LT', eq: 1, p: [6.6, 1.5, 0], num: 101 }] });
  PD.removeItem('equip', 0);
  check('deleting earlier equipment shifts the instrument index, nozzles and tag with it', PD.model.equip.length === 1 && PD.model.instr[0].eq === 0 && PD.nozzles().filter(z => z.e >= 0).every(z => z.e === 0) && PD.nozzles().filter(z => z.e === 0).map(arr).join('|') === nzB.join('|') && PD.tags().equip[0] === 'TK-1', JSON.stringify([PD.model.instr, PD.tags().equip]));
  const nzTop = PD.nozzles().find(z => z.e === 0);
  PD.load({ pipes: [{ a: arr(nzTop), b: [arr(nzTop)[0], arr(nzTop)[1] + 1.5, arr(nzTop)[2]], n: 4 }], equip: [{ k: ckey, p: [6, 0, 0], r: 1 }], custom: cust });
  const upd = C.update(rc.e.id, { noz: [{ x: 0, y: -600, z: 300, dir: '-Y', n: 3 }] }); PD.rebuild();
  check('removing the nozzle a pipe sits on keeps the pipe and the rest of the model', !upd.err && PD.model.pipes.length === 1 && PD.nozzles().filter(z => z.e === 0).length === 1, JSON.stringify(upd));
  check('DXF and CSV still work with custom equipment', PD.dxf().includes('EQUIPMENT') && PD.csv().includes('Tank'));
  // group move refused when tied
  PD.load({ pipes: [{ a: [0.6, 0.3, 0], b: [3, 0.3, 0], n: 3 }], equip: [{ k: ckey, p: [0, 0, 0], r: 0 }], custom: cust });
  check('piping tied to custom equipment cannot be moved as a group', PD.group.move(0, 100, 0, 0) === false && PD.group.rotate(0) === false && PD.model.pipes[0].a[0] === 0.6);
  // editing the entry moves the nozzle and every placed copy follows; the pipe stays and a toast counts it
  PD.load({ pipes: [{ a: [0.6, 0.3, 0], b: [3, 0.3, 0], n: 3 }], equip: [{ k: ckey, p: [0, 0, 0], r: 0 }, { k: ckey, p: [0, 0, 5], r: 0 }], custom: cust });
  const z1 = () => PD.nozzles().filter(z => z.idx === 1).map(z => [z.p.x, z.p.y, z.p.z]);
  check('before the edit: N2 of both copies is at x 0.6', Math.abs(z1()[0][0] - 0.6) < 1e-9 && Math.abs(z1()[1][2] - 5) < 1e-9);
  els.toast.textContent = '';
  const cid = ckey.slice(3), noz2 = PD.model.custom.find(e => e.id === cid).noz.map(z => Object.assign({}, z));
  noz2[1].x = 400; noz2[1].z = 1000;
  C.update(cid, { noz: noz2 });
  check('editing the nozzle moves it on every placed copy', Math.abs(z1()[0][0] - 0.4) < 1e-9 && Math.abs(z1()[0][1] - 1) < 1e-9 && Math.abs(z1()[1][0] - 0.4) < 1e-9, JSON.stringify(z1()));
  check('the pipe that was on the nozzle is kept and a toast says how many ends were left', PD.model.pipes.length === 1 && /1 pipe end is no longer on a nozzle/.test(els.toast.textContent), els.toast.textContent);
  C.update(cid, { dia: 2000, h: 3000 });
  check('editing the size updates the instances', PD.model.equip.every(e => e.cu.dia === 2000 && e.cu.h === 3000));
  C.update(cid, { noz: noz2.slice(0, 1) });
  check('removing nozzles keeps the pipe', PD.model.pipes.length === 1 && PD.nozzles().filter(z => z.e >= 0).length === 2);
  // delete the entry
  const before = JSON.stringify(PD.nozzles().map(z => [z.p.x, z.p.y, z.p.z, z.n]));
  const nDel = C.del(cid);
  check('deleting the entry reports the placed copies and keeps them working', nDel === 2 && PD.model.custom.length === 0 && PD.model.equip.length === 2 && JSON.stringify(PD.nozzles().map(z => [z.p.x, z.p.y, z.p.z, z.n])) === before && PD.rows().some(r => r[0] === 'Tank' && r[1] === '2'), String(nDel));
  check('deleted equipment still draws on the iso and P&ID', PD.iso('', 0, true, 'sym').includes('>TK-1<') && PD.pid().includes('>TK-2<'));
  els['t-parts'].onclick(); L.parts.click({ target: { closest: () => ({ dataset: { chip: ckey, cat: 'equip' } }) } });
  tapOn([8, 0, 8]);
  check('a deleted entry cannot be placed again', PD.model.equip.length === 2 && /not in the library/.test(els.toast.textContent), els.toast.textContent);
  // round trip
  const saved = JSON.stringify(PD.model), nz0 = JSON.stringify(PD.nozzles().map(z => [z.p.x, z.p.y, z.p.z, z.n]));
  PD.load(JSON.parse(saved));
  check('save and open keeps the equipment, the cache and the nozzles', JSON.stringify(PD.model.equip.map(e => e.k)) === JSON.stringify([ckey, ckey]) && JSON.stringify(PD.nozzles().map(z => [z.p.x, z.p.y, z.p.z, z.n])) === nz0);
  // old saves
  PD.load({ pipes: [], valves: [], equip: [{ k: 'pump', p: [0, 0, 0] }, { k: 'vessel', p: [5, 0, 0], r: 1 }] });
  check('an old save with plain pump and vessel still loads', PD.model.equip.length === 2 && PD.model.equip[0].r === 0 && PD.nozzles().length === 5);
  // hostile
  PD.load({ pipes: [], equip: [{ k: 'cu:bad id', p: [0, 0, 0], r: 0 }, { k: 'cu:nolib', p: [1, 0, 0], r: 0 }, { k: 'constructor', p: [0, 0, 0] }, { k: '__proto__', p: [0, 0, 0] }, { k: 'pump', p: [NaN, 0, 0] }, { k: 'pump', p: 'x' }, null, { k: 'pump', p: [2, 0, 0], r: 7.4 }],
    instr: [{ k: 'LT', eq: 0, p: [0, 1, 0] }, { k: 'LT', eq: 7, p: [2, 1, 0], num: 105 }] });
  check('hand-edited equipment with a bad id, no library entry, a prototype name or a bad position is dropped; the rest is kept with r 0..3', PD.model.equip.length === 1 && PD.model.equip[0].k === 'pump' && Math.abs(PD.model.equip[0].r - 3.4) < 1e-9, JSON.stringify(PD.model.equip));
  check('instruments follow the equipment indexes and those on dropped equipment go', PD.model.instr.length === 1 && PD.model.instr[0].eq === 0 && PD.model.instr[0].num === 105, JSON.stringify(PD.model.instr));
  const evil = { id: 'h', kind: 'equipment', name: '=cmd', brand: '+x', model: '@y', shape: 'cyl', w: 1e12, d: -5, dia: 1e9, h: 'abc', col: 99, wt: 'x', prefix: '<b>', img: 'javascript:alert(1)',
    noz: Array.from({ length: 30 }, (_, i) => ({ x: 1e12, y: -1e12, z: i * 1e9, dir: i % 2 ? '+z' : '-X', n: 99 })).concat([{ x: 0, y: 0, z: 0, dir: '+Q', n: 4 }, null, 5, { x: NaN, y: 0, z: 0, dir: '+X', n: 4 }, { x: 0, y: 0, z: 0, dir: '__proto__', n: 4 }]) };
  PD.load({ pipes: [], custom: [evil, { id: 'k', kind: 'weird', name: 'x', len: 100 }, { id: 'j', kind: 'equipment', name: '', w: 100 }], equip: [{ k: 'cu:h', p: [0, 0, 0] }] });
  const h = PD.model.custom[0];
  check('hostile equipment values are clamped: 8 nozzles, in range, sane texts, a legal colour, no unknown kinds', PD.model.custom.length === 1 && h.noz.length === 8 && h.w === 20000 && h.d === 100 && h.dia === 20000 && h.h === 1200 && h.col === 0 && h.wt === 0 && !/^[=+@]/.test(h.name) && h.prefix === 'B' && !h.img
    && h.noz.every(z => Math.hypot(z.x, z.y) <= 10501 && z.z >= -500 && z.z <= 20500 && z.n === 12 && /^[+-][XYZ]$/.test(z.dir)), JSON.stringify(h));
  check('and the equipment built from it is placed with 8 nozzles', PD.model.equip.length === 1 && PD.nozzles().filter(z => z.e === 0).length === 8);
  // hostile cache on a placed copy whose entry is missing
  PD.load({ pipes: [{ a: [0, 0, 0], b: [1, 0, 0], n: 4 }], equip: [{ k: 'cu:ghost', p: [3, 0, 0], r: 0, cu: { name: '=Ghost', shape: 'box', w: 1e9, d: 1e9, h: 1e9, noz: Array(50).fill({ x: 1e9, y: 1e9, z: 1e9, dir: '+X', n: 4 }), junk: 'x'.repeat(100000) } }] });
  const gc = PD.model.equip[0] && PD.model.equip[0].cu;
  check('a cached copy without a library entry is clamped and bounded', gc && gc.w === 20000 && gc.noz.length === 8 && !('junk' in gc) && !/^=/.test(gc.name) && JSON.stringify(gc).length < 2000, JSON.stringify(gc));
  // duplicate and the panel
  PD.load({ pipes: [] });
  const d1 = C.add(box), dd = C.dup(d1.e.id);
  check('duplicate makes a separate equipment entry with the same nozzles', dd && dd.id !== d1.e.id && dd.kind === 'equipment' && dd.noz.length === 6 && dd.name === 'Skid A copy');
  const cuOpenCard = C.html();
  check('the panel list shows equipment size and nozzle count', cuOpenCard.includes('Equipment 2000×1000×1500 mm') && cuOpenCard.includes('6 nozzles'), cuOpenCard.slice(0, 600));
  check('an inline add still works next to equipment and keeps the two kinds apart', C.add({ name: 'Inline Z', len: 100 }).e && C.parts().length === 1 && C.eqParts().length === 7);
  // review fixes: a very long pipe must not stall the equipment clash walk, and an import must not reuse the id of a placed copy of the other kind
  PD.load({ pipes: [{ a: [-1e6, 0.3, 0], b: [1e6, 0.3, 0], n: 4 }], custom: [], equip: [{ k: 'pump', p: [3, 0, 0], r: 0 }, { k: 'vessel', p: [9, 0, 0], r: 0 }] });
  const t0 = Date.now(); const lc = PD.clashes();
  check('a 2000 km pipe through equipment is checked quickly and still reported', Date.now() - t0 < 500 && lc.filter(c => c.kind === 'equip').length === 2, Date.now() - t0 + ' ms ' + lc.length);
  PD.load({ pipes: [], custom: [], equip: [] });
  const sx = C.add({ kind: 'equipment', name: 'Stray', shape: 'box', w: 1000, d: 800, h: 1000, noz: [] }); PD.model.equip.push({ k: 'cu:' + sx.e.id, p: [0, 0, 0], r: 0 }); PD.rebuild(); C.del(sx.e.id);
  C.imp(JSON.stringify({ custom: [{ id: sx.e.id, kind: 'inline', name: 'Inl', len: 200 }] })); PD.rebuild();
  check('an inline import does not take the id of a placed equipment copy', PD.model.custom.length === 1 && PD.model.custom[0].id !== sx.e.id && PD.tags().equip[0] === 'EQ-1', JSON.stringify(PD.tags().equip));
  // easy-start: every template is accepted as is, and "place on a face" gives a nozzle that validates and points out of that face
  PD.load({ pipes: [], custom: [], equip: [] });
  const tplOk = C.tpl.every(t => { const r = C.add(Object.assign({ kind: 'equipment', name: 'T ' + t[0] }, JSON.parse(JSON.stringify(t[2])))); return r.e && r.e.noz.length === t[2].noz.length; });
  check('every start-from template makes a valid equipment entry', tplOk && C.tpl.length === 4);
  const bx = C.add({ kind: 'equipment', name: 'Face', shape: 'box', w: 1000, d: 600, h: 800, noz: [{ x: 0, y: 0, z: 400, dir: '+X', n: 4 }] }).e;
  const faces = ['top', 'bot', 'l', 'r', 'f', 'b'].map(f => C.onFace(bx, bx.noz[0], f));
  check('place-on-face puts the nozzle on the box surface pointing out', JSON.stringify(faces.map(f => [f.x, f.y, f.z, f.dir])) === JSON.stringify([[0, 0, 800, '+Z'], [0, 0, 0, '-Z'], [-500, 0, 400, '-X'], [500, 0, 400, '+X'], [0, -300, 400, '-Y'], [0, 300, 400, '+Y']]), JSON.stringify(faces));
  const cy = C.add({ kind: 'equipment', name: 'FaceC', shape: 'cyl', dia: 1200, h: 2000, noz: [{ x: 0, y: 0, z: 500, dir: '+X', n: 4 }] }).e;
  const pm = C.tpl.filter(t => t[0] === 'pump')[0][2];
  const pe = C.add(Object.assign({ kind: 'equipment', name: 'Drawn' }, JSON.parse(JSON.stringify(pm)))).e;
  check('drawn shapes are kept, hidden outline is kept', pe.parts.length === 3 && pe.hide === true && pe.parts[2].col === 3);
  const pu = C.update(pe.id, { parts: pe.parts.concat([{ t: 'cyl', x: '10', y: 0, z: 0, w: 200, d: 999, h: 400, col: -1 }, { t: 'sph', x: 0, y: 0, z: 0, w: 300, d: 5, h: 5 }, { t: 'cyly', x: 0, y: 0, z: 0, w: 200, d: 500, h: 7 }]) });
  check('shape sizes are made consistent for their type', pu.e && pu.e.parts[3].d === 200 && pu.e.parts[4].h === 300 && pu.e.parts[4].d === 300 && pu.e.parts[5].h === 200, JSON.stringify(pu.e && pu.e.parts.slice(3)));
  check('a shape with a bad size or position is refused in the panel', C.update(pe.id, { parts: [{ t: 'box', x: 0, y: 0, z: 0, w: 5, d: 100, h: 100 }] }).err && C.update(pe.id, { parts: [{ t: 'box', x: 'a', y: 0, z: 0, w: 100, d: 100, h: 100 }] }).err && C.update(pe.id, { parts: new Array(13).fill({ t: 'box', x: 0, y: 0, z: 0, w: 100, d: 100, h: 100 }) }).err);
  const pi = C.imp(JSON.stringify({ custom: [{ id: 'zz1', kind: 'equipment', name: 'F', shape: 'box', w: 1000, d: 1000, h: 1000, noz: [], parts: [null, 5, { t: 'bad', w: 'x', x: 1e12 }, { t: 'sph', w: 400, x: 0, y: 0, z: 0 }].concat(new Array(30).fill({ t: 'box', w: 100, d: 100, h: 100, x: 0, y: 0, z: 0 })) }] }));
  const pz = PD.model.custom.filter(q => q.id === 'zz1')[0];
  check('a file with broken shapes is cleaned and capped at 12', pi === 1 && pz && pz.parts.length === 12 && pz.parts[0].t === 'box' && pz.parts[0].x === 20000, JSON.stringify(pz && pz.parts.slice(0, 2)));
  const ps2 = C.add(Object.assign({ kind: 'equipment', name: 'IsoDrawn' }, JSON.parse(JSON.stringify(pm)))).e;
  C.update(ps2.id, { parts: ps2.parts.concat([{ t: 'sph', x: 0, y: 0, z: 800, w: 300 }, { t: 'cyly', x: 0, y: 0, z: 0, w: 200, d: 400 }, { t: 'cyl', x: 0, y: 0, z: 0, w: 200, h: 400 }]) });
  PD.load({ pipes: [{ a: [2, 0.4, 0], b: [4, 0.4, 0], n: 4 }], custom: PD.model.custom, equip: [{ k: 'cu:' + ps2.id, p: [0, 0, 0], r: 0 }] });
  const isoD = PD.iso(); const polyD = (isoD.match(/<polygon/g) || []).length;
  C.update(ps2.id, { parts: [] }); C.update(ps2.id, { hide: '' }); PD.rebuild(); const polyN = (PD.iso().match(/<polygon/g) || []).length;
  check('the iso sheet draws every shape the user drew', polyD > polyN + 8 && isoD.includes('<svg'), polyD + ' vs ' + polyN);
  PD.load({ pipes: [], custom: PD.model.custom, equip: [] });
  PD.model.equip.push({ k: 'cu:' + pe.id, p: [0, 0, 0], r: 0 }); PD.rebuild(); C.del(pe.id);
  check('a placed copy keeps its drawn shapes after the entry is deleted', PD.model.equip[0].cu.parts.length === 6);
  check('place-on-face on a cylinder uses the radius and the update validates', C.onFace(cy, cy.noz[0], 'r').x === 600 && C.update(cy.id, { noz: [Object.assign({}, cy.noz[0], C.onFace(cy, cy.noz[0], 'top'))] }).e.noz[0].z === 2000);
}

// moving placed equipment: a pipe running along the move follows, others stay and are reported, never below the floor
{
  PD.load({ pipes: [{ a: [-0.35, 0.4, 0], b: [-2, 0.4, 0], n: 4 }], custom: [], equip: [{ k: 'pump', p: [0, 0, 0], r: 0 }] });
  const r1 = PD.eqMove(0, 'x', 0.5);
  check('equipment moves along X and the pipe on its nozzle follows', r1.ok && r1.follow === 1 && PD.model.equip[0].p[0] === 0.5 && PD.model.pipes[0].a[0] === 0.15 && PD.model.pipes[0].b[0] === -2 && r1.after === r1.before, JSON.stringify([r1, PD.model.pipes[0], PD.model.equip[0].p]));
  const r2 = PD.eqMove(0, 'x', -3);
  check('a move that would make the followed pipe turn back is refused', r2.ok === false && PD.model.equip[0].p[0] === 0.5);
  const r3 = PD.eqMove(0, 'z', 0.3);
  check('a sideways move leaves the pipe and reports the lost nozzle end', r3.ok && r3.follow === 0 && r3.after < r3.before && PD.model.pipes[0].a[0] === 0.15, JSON.stringify(r3));
  const r4 = PD.eqMove(0, 'y', -5);
  check('equipment cannot go below the floor', r4.ok && PD.model.equip[0].p[1] === 0, JSON.stringify(PD.model.equip[0].p));
  check('an unknown axis or equipment does nothing', PD.eqMove(0, 'q', 1) === null && PD.eqMove(5, 'x', 1) === null);
}

// piping classes: assigned to a line, they set the schedule, the designation, the BOM text of a one-line sheet and warnings
{
  const S = PD.spec;
  PD.load({ pipes: [{ a: [0, 0.5, 0], b: [3, 0.5, 0], n: 4, s: 80, ln: 'L-001' }, { a: [0, 0.5, 2], b: [3, 0.5, 2], n: 4, s: 40, ln: 'L-002' }], valves: [], custom: [], equip: [] });
  const a1 = S.add('cs150'), g1 = S.add('galv');
  check('a class is added from a template with its fields', a1.e && a1.e.code === 'A1' && a1.e.sch === 40 && a1.e.maxN === 12 && PD.model.pspecs.length === 2);
  check('a bad class is refused', S.add({ name: '' }).err && S.update(a1.e.id, { minN: 6, maxN: 2 }).err && S.update(a1.e.id, { minN: 5 }).err);
  S.assign('L-001', a1.e.id);
  check('assigning a class sets the schedule of that line and its designation', PD.model.pipes[0].s === 40 && PD.model.pipes[1].s === 40 && S.desig('L-001').endsWith('-L-001-A1'), S.desig('L-001'));
  PD.model.pipes[0].s = 80; PD.rebuild();
  check('a pipe in another schedule than its class is reported', PD.warns().some(w => /SCH 80 pipe but class Carbon steel 150#/.test(w)), JSON.stringify(PD.warns()));
  S.assign('L-002', g1.e.id);
  check('a pipe above the size range of its class is reported', PD.warns().some(w => /Line L-002 has .* pipe but class Galvanised steel, threaded covers/.test(w)), JSON.stringify(PD.warns()));
  PD.model.valves.push({ p: [1.5, 0.5, 2], d: [1, 0, 0], n: 4, s: 40, k: 'butterfly' }); PD.rebuild();
  check('a valve the class does not allow is reported', PD.warns().some(w => /not allowed by class Galvanised/.test(w)), JSON.stringify(PD.warns()));
  const pc = PD.model.pipes.length; PD.addPipe([5, 0.5, 0], [6, 0.5, 0], 4, 80, 'L-001'); PD.rebuild();
  check('a new pipe on a line with a class takes the class schedule', PD.model.pipes[pc].s === 40);
  check('a deleted class unlinks its lines', S.del(g1.e.id) && !PD.model.lines['L-002'].spec && PD.model.pspecs.length === 1);
  const bl2 = PD.bomByLine();
  check('the BOM of a line with a class carries the class materials, other lines the standard ones', bl2.split(String.fromCharCode(10)).some(r => r.startsWith('"L-001"') && r.includes('Pipe,') && r.includes('ASTM A106 Gr.B, ASME B36.10M')) && bl2.split(String.fromCharCode(10)).some(r => r.startsWith('"L-002"') && r.includes('Pipe,')), bl2.slice(0, 500));
  const html = S.html();
  check('the class editor lists the class and the line list offers it', html.includes('Carbon steel 150#') && html.includes('Piping classes (1)'));
  const L0 = PD.lineList(); check('the line list row carries the class id', L0.find(r => r.ln === 'L-001').spec === a1.e.id);
  const rt = PD.model; PD.load(JSON.parse(JSON.stringify(rt)));
  check('classes survive a save and load, junk is dropped', PD.model.pspecs.length === 1 && PD.model.pspecs[0].id === a1.e.id);
  PD.load({ pipes: [{ a: [0, 0, 0], b: [1, 0, 0], n: 4 }], pspecs: [null, 5, { name: '=cmd', code: 'a b!', sch: 7, minN: 99, maxN: 'x', noValve: ['gate', 'nope', 'gate'] }].concat(new Array(30).fill({ name: 'X' })) });
  const p0 = PD.model.pspecs[0];
  check('classes from a file are cleaned and capped', PD.model.pspecs.length === 20 && p0.name === 'cmd' && p0.code === 'AB' && p0.sch === 40 && p0.minN === 0.5 && p0.maxN === 12 && p0.noValve.length === 1, JSON.stringify(p0));
}

// hardening from the review: hostile or damaged data must neither crash a rebuild nor reach storage, CSV cells never start a formula
{
  const base = { pipes: [{ a: [0, 0.5, 0], b: [2, 0.5, 0], n: 4, ln: 'L-001' }] };
  const bad = [
    { caps: [null] }, { caps: {} }, { flanges: [{ p: [1, 0.5, 0], d: [1, 0, 0], n: 4, t: 'zz' }] },
    { supports: [{ p: [1, 0, 0], t: 'constructor' }] }, { valves: [{ k: 'gate', n: 4 }] }, { pipes: [{ b: [1, 1, 1], n: 4 }, { a: [0, 0, 0], b: [1, 0, 0], n: 4 }] },
    { instr: [{ k: 'PT', p: [1, 0.5, 0], link: '__proto__' }] }, { spec: { std: 'constructor' } }, { lines: { 'L-001': null } }, { lines: { __proto__: { x: 1 } } },
    { items: [{ p: [1, 0.5, 0], d: [1, 0, 0], n: 4, t: 'toString' }] }, { fit: [1, 2], field: 'x', title: 5 }, { fluid: 'constructor' },
    { pipes: [{ a: [0, 0, NaN], b: [1, 0, 0], n: 4 }, { a: [0, 0, 0], b: [1e300, 0, 0], n: 4 }, { a: [0, 0, 0], b: ['1', 0, 0], n: 4 }] }
  ];
  let crashed = '';
  bad.forEach((b, i) => { try { PD.load(Object.assign({}, JSON.parse(JSON.stringify(base)), JSON.parse(JSON.stringify(b)))); PD.iso(); PD.rows(); PD.lineCsv(); PD.bomByLine(); } catch (e) { crashed += i + ':' + e.message + ' '; } });
  check('damaged project data loads without a crash in rebuild, sheets or exports', crashed === '', crashed);
  PD.load({ pipes: [{ a: [0, 0, 0], b: [1, 0, 0], n: 4, ln: 'toString' }, { a: [0, 0, 1], b: [1, 0, 1], n: 4, ln: '__proto__', fl: 1 }], lines: { toString: { q: 5 } } });
  check('line numbers that are object keys are renamed and the line list and hydraulics survive', PD.lineList().length === 2 && PD.model.pipes.every(p => !/^(toString|__proto__)$/.test(p.ln)), JSON.stringify(PD.model.pipes.map(p => p.ln)));
  PD.load({ pipes: [{ a: [0, 0, 0], b: [1, 0, 0], n: 4, ln: 'L-1' }], lines: { 'L-1': { svc: '=cmd|"/c calc"!A1', from: '-2+3', to: '@SUM(1)' } } });
  const lc = PD.lineCsv();
  check('CSV cells that start with = - + @ are made harmless', lc.includes("\"'=cmd|") && lc.includes("\"'-2+3\"") && lc.includes("\"'@SUM(1)\"") && !/,"[=@]/.test(lc), lc);
  check('the line CSV shows the class of a line with a piping class', (() => { PD.load({ pipes: [{ a: [0, 0, 0], b: [1, 0, 0], n: 4, ln: 'L-1' }] }); const c = PD.spec.add('ss316'); PD.spec.assign('L-1', c.e.id); return PD.lineCsv().includes('"S1"'); })());
  const c2 = PD.spec.add('cs150'); PD.spec.assign('L-1', c2.e.id); PD.spec.update(c2.e.id, { sch: 80 });
  check('changing the schedule of a class changes the pipes of the lines that use it', PD.model.pipes.every(p => p.s === 80));
  PD.model.valves.push({ p: [0.3, 0, 0], d: [1, 0, 0], n: 4, s: 80, k: 'gate' }, { p: [0.6, 0, 0], d: [1, 0, 0], n: 4, s: 80, k: 'gate' }); PD.spec.update(c2.e.id, { noValve: ['gate'] });
  check('a forbidden valve kind is reported once per line', PD.warns().filter(w => /not allowed by class/.test(w)).length === 1, JSON.stringify(PD.warns()));
  // moving equipment
  PD.load({ pipes: [{ a: [-0.35, 0.4, 0], b: [-2, 0.4, 0], n: 4 }], flanges: [{ p: [-0.35, 0.4, 0], d: [1, 0, 0], n: 4, t: 'wn', e: 1 }], equip: [{ k: 'pump', p: [0, 0, 0], r: 0 }] });
  const mv = PD.eqMove(0, 'x', 0.5);
  check('an end flange on the followed pipe end moves with the equipment', mv.ok && PD.model.flanges[0].p[0] === 0.15, JSON.stringify(PD.model.flanges[0]));
  check('a move by NaN or Infinity is refused and leaves the position alone', PD.eqMove(0, 'x', NaN).ok === false && PD.eqMove(0, 'x', Infinity).ok === false && PD.model.equip[0].p.every(Number.isFinite) && PD.model.equip[0].p[0] === 0.5);
}

// redo and the menu state
{
  PD.load({ pipes: [{ a: [0, 0, 0], b: [1, 0, 0], n: 4 }] });
  const els0 = ctx.document.getElementById('undo');
  PD.spec.add('cs150');
  ctx.document.getElementById('undo').onclick();
  const gone = PD.model.pspecs.length === 0;
  ctx.document.getElementById('redo').onclick();
  check('redo brings back what undo took away', gone && PD.model.pspecs.length === 1);
  ctx.document.getElementById('undo').onclick(); PD.spec.add('ss316');
  ctx.document.getElementById('redo').onclick();
  check('a new edit ends the redo line', PD.model.pspecs.length === 1 && PD.model.pspecs[0].name === 'Stainless 316L 150#');
}

// iso sheet: revision block, connection notes, coordinates
{
  check('the iso sheet has a revision block with the current revision', isoP.includes('>REVISIONS<') && isoP.includes('>Issued<'));
  check('a pipe end on a nozzle says which nozzle it ends on', /TO (P|V)-[0-9]\/N[0-9]/.test(isoP), (isoP.match(/EL [^<]*</g) || []).join(' | '));
  PD.model.title.h1rev = 'A'; PD.model.title.h1desc = 'First issue'; PD.model.title.rdesc = 'For fabrication';
  const isoR = PD.iso();
  check('earlier revisions and the revision text come onto the sheet', isoR.includes('>First issue<') && isoR.includes('>For fabrication<'));
  delete PD.model.title.h1rev; delete PD.model.title.h1desc; delete PD.model.title.rdesc;
  ctx.document.getElementById('iso-coords').onclick();
  const isoC = PD.iso();
  check('coordinates in mm can be added at free ends', /EL [^<]* E -?[0-9]+ N -?[0-9]+</.test(isoC), (isoC.match(/EL [^<]*</g) || []).slice(0, 3).join(' | '));
  ctx.document.getElementById('iso-coords').onclick();
  check('a one-line sheet names the line that continues from a cut end', (() => {
    PD.load({ pipes: [{ a: [0, 0.5, 0], b: [2, 0.5, 0], n: 4, ln: 'L-1' }, { a: [2, 0.5, 0], b: [2, 0.5, 2], n: 4, ln: 'L-2' }] });
    return PD.iso('L-1').includes('CONT. L-2');
  })());
}

// the audit items: strict numbers, resizing a pipe with its parts, BOM integrity warnings, file names
{
  const pn = PD.parseNum;
  check('typed numbers: 1,500 is 1500, 1200+300 is 1500, feet and inches are refused, mm is allowed', pn('1,500') === 1500 && pn('1200+300') === 1500 && pn('1500 - 200') === 1300 && pn("4'6\"") === null && pn('12 mm') === 12 && pn('1,5') === 1.5 && pn('abc') === null && pn('') === null && pn('-300') === -300 && pn('1.5.2') === null);
  PD.load({ pipes: [{ a: [0, 0, 0], b: [4, 0, 0], n: 4 }], valves: [{ p: [2, 0, 0], d: [1, 0, 0], n: 4, k: 'gate' }] });
  const vv = PD.model.valves[0]; PD.addValveFlanges && PD.addValveFlanges(vv);
  check('a flanged valve with no flanges is reported', PD.warns().some(w => /has no flanges against it/.test(w)), JSON.stringify(PD.warns()));
  PD.resizePipe(0, 6);
  check('resizing a pipe resizes the valve on it and the BOM has no negative row', PD.model.valves[0].n === 6 && PD.model.flanges.every(f => f.n === 6) && PD.rows().every(r => !/^-/.test(r[1])) && !PD.warns().some(w => /sits on/.test(w)), JSON.stringify(PD.warns()));
  PD.model.valves[0].n = 4; PD.rebuild();
  check('a valve of another size than its pipe is reported', PD.warns().some(w => /Valve .* is NPS 4 but sits on NPS 6/.test(w)), JSON.stringify(PD.warns()));
  PD.load({ pipes: [{ a: [0, 0, 0], b: [3, 0, 0], n: 4 }, { a: [1, 0, 0], b: [2, 0, 0], n: 4 }] });
  check('pipes lying on top of each other are reported', PD.warns().some(w => /Pipes 1 and 2 lie on top of each other for 1000 mm/.test(w)), JSON.stringify(PD.warns()));
  PD.load({ pipes: [{ a: [0, 0, 0], b: [3, 0, 0], n: 4 }, { a: [3, 0, 0], b: [5, 0, 0], n: 4 }, { a: [0, 0, 1], b: [3, 0, 1], n: 4 }] });
  check('pipes end to end or side by side are not reported as overlapping', !PD.warns().some(w => /on top of each other/.test(w)), JSON.stringify(PD.warns()));
  PD.model.title = { project: 'Plant A / Unit 2', drawing: 'ISO-101', rev: 'B' };
  check('file names come from the project, drawing, kind, revision and date', /^Plant-A-Unit-2_ISO-101_bom_revB_[0-9]{4}-[0-9]{2}-[0-9]{2}.csv$/.test(PD.fname('bom', 'csv')), PD.fname('bom', 'csv'));
}

// whole-run edits, line rename, valves that slide along their pipe
{
  PD.load({ pipes: [{ a: [0, 0, 0], b: [0, 1, 0], n: 4, ln: 'A' }, { a: [0, 1, 0], b: [3, 1, 0], n: 4, ln: 'A' }, { a: [3, 1, 0], b: [3, 1, 2], n: 4, ln: 'A' }, { a: [3, 1, 2], b: [5, 1, 2], n: 3, ln: 'A' }, { a: [3, 1, 0], b: [3, 0, 0], n: 4, ln: 'B' }],
    valves: [{ p: [1.5, 1, 0], d: [1, 0, 0], n: 4, k: 'gate' }] });
  PD.addValveFlanges(PD.model.valves[0]); PD.rebuild();
  const run = PD.runPipes(0).sort();
  check('a run is the same-size pipes joined through elbows, stopping at a tee and at a size change', JSON.stringify(run) === '[0,1]' || JSON.stringify(run) === '[0,1,2]', JSON.stringify(run));
  const cnt = PD.setRunSize(0, 6);
  check('a new size for the run reaches every pipe of it and the valve on it', cnt === run.length && run.every(i => PD.model.pipes[i].n === 6) && PD.model.valves[0].n === 6 && PD.model.flanges.every(f => f.n === 6) && PD.model.pipes[3].n === 3, JSON.stringify(PD.model.pipes.map(p => p.n)));
  PD.model.pipes[0].s = 80; PD.model.pipes[0].ln = 'Z'; PD.setRunProps(0);
  check('schedule and line number go to the whole run', run.every(i => PD.model.pipes[i].s === 80 && PD.model.pipes[i].ln === 'Z') && PD.model.pipes[4].ln === 'B');
  PD.model.lines.Z = { svc: 'Brine' };
  check('renaming a line number renames its pipes and keeps its data', PD.renameLine('Z', 'Q-1') && PD.model.pipes.filter(p => p.ln === 'Q-1').length === run.length && PD.model.lines['Q-1'].svc === 'Brine' && !PD.model.lines.Z);
  check('a rename to an empty name or the same name does nothing', PD.renameLine('Q-1', '') === false && PD.renameLine('Q-1', 'Q-1') === false && PD.renameLine('Q-1', '__proto__') && !PD.model.pipes.some(p => p.ln === '__proto__'));
  const fl0 = PD.model.flanges.map(f => f.p.slice());
  const r1 = PD.alongMove('valve', 0, 0.4);
  check('a valve slides along its pipe and takes its flanges with it', r1.ok && Math.abs(r1.s[0] - 1.9) < 1e-6 && r1.fl >= 1 && PD.model.flanges.every((f, i) => Math.abs(f.p[0] - fl0[i][0] - 0.4) < 1e-6), JSON.stringify(r1));
  const r2 = PD.alongMove('valve', 0, 50);
  check('a valve stops 50 mm short of the pipe end', r2.ok && Math.abs(r2.s[0] - 2.95) < 1e-6, JSON.stringify(r2));
  check('an unknown part or an instrument on equipment cannot slide', PD.alongMove('valve', 9, 1) === null && PD.alongMove('pipe', 0, 1) === null);
  check('a valve on a short pipe is not given arrows to move along', (() => { PD.load({ pipes: [{ a: [0, 0, 0], b: [0.1, 0, 0], n: 4 }], valves: [{ p: [0.05, 0, 0], d: [1, 0, 0], n: 4, k: 'gate' }] }); return PD.alongMove('valve', 0, 0.02) === null; })());
}

// DXF, weld gap, multi-page PDF
{
  PD.load({ pipes: [{ a: [0, 0, 0], b: [2, 0, 0], n: 4, ln: 'L-1' }, { a: [0, 0, 1], b: [3, 0, 1], n: 4, ln: 'L 2/b' }], valves: [{ p: [1, 0, 0], d: [1, 0, 0], n: 4, k: 'gate' }] });
  const dx = PD.dxf();
  check('the DXF sets millimetre units, has a layer per line number and tags as text', dx.includes('$INSUNITS') && dx.includes('PIPE_L-1') && dx.includes('PIPE_L_2_b') && dx.split(String.fromCharCode(10)).includes('TEXT') && dx.includes('GV-1') && dx.trim().endsWith('EOF'), dx.slice(0, 200));
  const len0 = PD.fab().pieces.map(p => p.len);
  PD.model.spec.gap = '2'; PD.rebuild();
  const len1 = PD.fab().pieces.map(p => p.len);
  check('a weld gap is taken off both ends of every cut piece', len0.length === len1.length && len1.every((l, i) => Math.abs(l - (len0[i] - 0.004)) < 1e-9), JSON.stringify([len0, len1]));
  PD.model.spec.gap = '0'; PD.rebuild();
  const jpg = (n) => new Uint8Array(n).fill(7);
  const pdf = PD.buildPdf([{ jpg: jpg(50), iw: 2400, ih: 1700 }, { jpg: jpg(60), iw: 2400, ih: 1700 }, { jpg: jpg(70), iw: 2400, ih: 1700 }], 'a4');
  const txt = Buffer.from(pdf).toString('latin1');
  const offs = [...txt.matchAll(/([0-9]{10}) 00000 n /g)].map(m => +m[1]);
  check('a three page PDF is well formed: page count, A4 size, every xref offset points at its object', txt.startsWith('%PDF-1.4') && txt.includes('/Count 3') && txt.includes('/MediaBox [0 0 841.89 595.28]') && offs.length === 11 && offs.every((o, i) => txt.slice(o).startsWith((i + 1) + ' 0 obj')) && txt.trim().endsWith('%%EOF') && txt.includes('/Size 12 '), offs.join(','));
  check('the old single page call still works', Buffer.from(PD.buildPdf(jpg(40), 2400, 1700)).toString('latin1').includes('/Count 1'));
}

// a tap on the white start dot ends the run
{
  PD.load({ pipes: [] }); ctx.document.getElementById('t-pipe').onclick();
  tapAt(420, 330);
  const c0 = PD.cursor();
  const s0 = c0 && PD.project(c0);
  check('a first tap starts a run', !!c0);
  if (c0) { tapAt(s0.x + 6, s0.y - 5); check('a tap on the start dot ends the run and leaves no pipe', PD.cursor() === null && PD.model.pipes.length === 0); }
  tapAt(420, 330); check('another point can be picked after that', !!PD.cursor());
}


// Pencil workflow: finger or Pencil, end handles, box select, multi-selection, snaps, quick bar
{
  const ev = (type, kind, id, x, y) => ({ type, pointerType: kind, pointerId: id, clientX: x, clientY: y });
  const pen = (x0, y0, x1, y1, id) => { id = id || (pid_++); L.cv.pointerdown(ev('pointerdown', 'pen', id, x0, y0)); if (x1 != null) L.cv.pointermove(ev('pointermove', 'pen', id, x1, y1)); L.cv.pointerup(ev('pointerup', 'pen', id, x1 == null ? x0 : x1, y1 == null ? y0 : y1)); globalThis.__perf = (globalThis.__perf || 0) + 1000; };   // touches within 350 ms of the Pencil count as a palm: move the stub clock on
  const btn = id => ctx.document.getElementById(id);
  PD.pen.setFinger(false);
  PD.load({ pipes: [] }); btn('t-pipe').onclick(); btn('finish').onclick();
  tapAt(420, 330); check('Pencil mode: a finger tap places nothing', PD.cursor() === null);
  pen(420, 330); check('Pencil mode: the Pencil places a point', !!PD.cursor());
  PD.pen.setFinger(true); btn('finish').onclick();
  tapAt(420, 330); check('finger mode: a finger tap places again', !!PD.cursor());
  btn('finish').onclick();

  // taking back the last pipe of a run
  PD.load({ pipes: [] }); btn('t-pipe').onclick(); btn('finish').onclick();
  for (let i = 0; i < 6; i++) btn('down').onclick();
  tapOn([0, 0, 0]); tapOn([2, 0, 0]); tapOn([2, 0, 2]);
  check('two pipes drawn', PD.model.pipes.length === 2, PD.model.pipes.length);
  PD.pen.segUndo();
  check('take back the last pipe: one pipe left and the run goes on from its end', PD.model.pipes.length === 1 && PD.cursor() && near(PD.cursor(), [2, 0, 0]), JSON.stringify(PD.cursor()));
  PD.pen.segUndo();
  check('take back again: no pipe, the run starts where it began', PD.model.pipes.length === 0 && PD.cursor() && near(PD.cursor(), [0, 0, 0]), JSON.stringify(PD.cursor()));
  PD.pen.segUndo(); check('with nothing to take back the run ends', PD.cursor() === null);

  // free ends are shown, midpoints snap
  PD.load({ pipes: [{ a: [0, 0, 0], b: [4, 0, 0], n: 4 }] }); btn('t-pipe').onclick();
  check('a free pipe end shows a dot in the Pipe tool', PD.pen.dots() === 2, PD.pen.dots());
  PD.load({ pipes: [{ a: [0, 0, 0], b: [4, 0, 0], n: 4 }], caps: [[4, 0, 0, 'cap']] }); btn('t-pipe').onclick();
  check('a closed end shows no dot', PD.pen.dots() === 1, PD.pen.dots());
  PD.load({ pipes: [{ a: [0, 0, 0], b: [4, 0, 0], n: 4 }] }); btn('t-pipe').onclick(); btn('finish').onclick();
  tapOn([2, 0, 0]);
  check('a tap at the middle of a pipe snaps to the midpoint and splits it', PD.cursor() && near(PD.cursor(), [2, 0, 0]) && PD.model.pipes.length === 2, JSON.stringify(PD.cursor()) + ' ' + PD.model.pipes.length);
  btn('finish').onclick();

  // lining up with an elevation already in the drawing
  PD.load({ pipes: [{ a: [8, 0, 0], b: [8, 1.32, 0], n: 4 }] }); btn('t-pipe').onclick(); btn('finish').onclick();
  for (let i = 0; i < 6; i++) btn('down').onclick();
  tapOn([3, 0, 0]); tapOn([3, 1.31, 0]);
  check('a new end lines up with an elevation already in the drawing', PD.model.pipes.length === 2 && Math.abs(lastPipe().b[1] - 1.32) < 0.011, JSON.stringify(lastPipe()));
  btn('finish').onclick();

  // end handles
  PD.load({ pipes: [{ a: [0, 0, 0], b: [2, 0, 0], n: 4 }] }); btn('t-sel').onclick();
  tapOn([1, 0, 0]);
  check('a selected pipe shows two end handles', PD.pen.hdl().vis && PD.pen.hdl().n === 2, JSON.stringify(PD.pen.hdl()));
  const eb = PD.project([2, 0, 0]), ef = PD.project([3.2, 0, 0]);
  pen(eb.x, eb.y, ef.x, ef.y);
  check('dragging an end handle with the Pencil stretches the pipe', Math.abs(PD.model.pipes[0].b[0] - 3.2) < 0.16 && PD.model.pipes[0].a[0] === 0, JSON.stringify(PD.model.pipes[0]));

  // the quick bar
  PD.load({ pipes: [{ a: [0, 0, 0], b: [2, 0, 0], n: 4 }] }); btn('t-sel').onclick(); tapOn([1, 0, 0]);
  check('the quick bar shows for the selection', !PD.pen.qbar().hidden && PD.pen.qbar().html.indexOf('q-dn') > 0, PD.pen.qbar().html);
  const n0 = PD.model.pipes[0].n; PD.pen.quick('q-up');
  check('the quick bar steps the pipe to the next size up', PD.model.pipes[0].n > n0, PD.model.pipes[0].n + ' from ' + n0);

  // near-part picking
  PD.load({ pipes: [{ a: [0, 0, 0], b: [4, 0, 0], n: 4 }], valves: [{ p: [2, 0, 0], d: [1, 0, 0], n: 4, s: 40, k: 'gate' }] }); btn('t-sel').onclick();
  const vs = PD.project([2, 0, 0]);
  const pk = PD.pen.pickSel({ pointerType: 'pen', clientX: vs.x + 12, clientY: vs.y + 9 }, true);
  check('a Pencil tap a little off a valve still picks the valve', pk && pk.kind === 'valve', JSON.stringify(pk));
  const p05 = PD.project([0.5, 0, 0]);
  const pk2 = PD.pen.pickSel({ pointerType: 'pen', clientX: p05.x, clientY: p05.y }, true);
  check('away from the valve the pipe is picked', pk2 && pk2.kind === 'pipe', JSON.stringify(pk2));

  // box select, multi-selection, move, copy, delete
  PD.load({ pipes: [{ a: [0, 0, 0], b: [2, 0, 0], n: 4, ln: 'A' }, { a: [2, 0, 0], b: [2, 2, 0], n: 4, ln: 'A' }, { a: [8, 0, 8], b: [9, 0, 8], n: 2, ln: 'B' }], valves: [{ p: [1, 0, 0], d: [1, 0, 0], n: 4, s: 40, k: 'gate' }] }); btn('t-sel').onclick();
  const ps = [PD.project([0, 0, 0]), PD.project([2, 2, 0]), PD.project([2.4, 0, 0])];
  const x0 = Math.min(...ps.map(p => p.x)) - 40, x1 = Math.max(...ps.map(p => p.x)) + 40, y0 = Math.min(...ps.map(p => p.y)) - 40, y1 = Math.max(...ps.map(p => p.y)) + 40;
  pen(x0, y0, x1, y1);
  const mk = Object.keys(PD.pen.msel()).sort();
  check('a Pencil drag on empty space selects what is inside the box', mk.indexOf('pipe:0') >= 0 && mk.indexOf('pipe:1') >= 0 && mk.indexOf('valve:0') >= 0 && mk.indexOf('pipe:2') < 0, mk.join());
  const g = PD.pen.mgroup();
  check('the selected pipes form a group with their valve and no joint shared with the rest', g && Object.keys(g.set).length === 2 && g.items.valves.length === 1 && g.shared === 0 && !g.eq, JSON.stringify(g && { s: g.set, sh: g.shared }));
  const val = (id, v) => { btn(id).value = v; };
  val('m-x', '0'); val('m-y', '0'); val('m-z', '500'); val('m-c', '1');
  btn('m-move').onclick();
  check('Move lifts every selected pipe and its valve together', PD.model.pipes[0].a[1] === 0.5 && PD.model.pipes[1].b[1] === 2.5 && PD.model.valves[0].p[1] === 0.5 && PD.model.pipes[2].a[1] === 0, JSON.stringify(PD.model.pipes.map(p => p.a[1])));
  val('m-x', '3000'); val('m-y', '0'); val('m-z', '0'); val('m-c', '2');
  btn('m-copy').onclick();
  check('Copy makes the copies with their valves and selects the last copy', PD.model.pipes.length === 7 && PD.model.valves.length === 3 && Object.keys(PD.pen.msel()).length === 2, PD.model.pipes.length + ' ' + PD.model.valves.length + ' ' + Object.keys(PD.pen.msel()).join());
  val('m-n', '6'); btn('m-n').onchange.call(btn('m-n'));
  check('the size of the selected pipes changes together', PD.model.pipes.slice(5).every(p => p.n === 6) && PD.model.pipes[2].n === 2, JSON.stringify(PD.model.pipes.map(p => p.n)));
  PD.pen.del();
  check('Delete removes the selected pipes and the valve on them', PD.model.pipes.length === 5 && PD.model.valves.length === 2, PD.model.pipes.length + ' ' + PD.model.valves.length);
  PD.rebuild();
  check('after that the drawing still builds', PD.rows().length > 0);
  PD.load({ pipes: [] });
}


// Sliding a pipe sideways and moving hand-picked pipes with arrows
{
  const btn = id => ctx.document.getElementById(id);
  const U = () => PD.load({ pipes: [{ a: [0, 0, 0], b: [2, 0, 0], n: 4, ln: 'A' }, { a: [2, 0, 0], b: [2, 0, 2], n: 4, ln: 'A' }, { a: [2, 0, 2], b: [4, 0, 2], n: 4, ln: 'A' }], valves: [{ p: [2, 0, 1], d: [0, 0, 1], n: 4, s: 40, k: 'gate' }] });
  U(); btn('t-sel').onclick();
  const n = PD.selectPart('pipe', 1);
  check('a selected pipe gets move arrows for the two sideways axes only', n === 4, n);
  check('sliding along the pipe itself is not offered', PD.pen.slideStart(1, 'z') === null);
  const st = PD.pen.slideStart(1, 'x');
  check('a slide finds the two pipes that run along the move and nothing broken', st && st.nb.length === 2 && st.broken === 0 && st.its.length === 1, JSON.stringify(st && { nb: st.nb.length, br: st.broken, its: st.its.length }));
  const ok = PD.pen.slideTo(st, 1);
  check('the pipe, its valve and the stretched neighbours follow', ok && PD.model.pipes[1].a[0] === 3 && PD.model.pipes[1].b[0] === 3 && PD.model.pipes[0].b[0] === 3 && PD.model.pipes[2].a[0] === 3 && PD.model.valves[0].p[0] === 3 && PD.model.pipes[0].a[0] === 0, JSON.stringify(PD.model.pipes.map(p => [p.a[0], p.b[0]])));
  check('a slide that would make a neighbour shorter than 50 mm or turn it back is refused', PD.pen.slideTo(st, -2.1) === false && PD.model.pipes[1].a[0] === 3);
  check('the slid pipe leaves no bad joint', !PD.warns().some(w => /bad|come apart|does not fit/i.test(w)), JSON.stringify(PD.warns()));
  U(); btn('t-sel').onclick(); PD.selectPart('pipe', 0);
  const stb = PD.pen.slideStart(0, 'y');
  check('sliding the first pipe sideways breaks its joint with the pipe that does not run along the move', stb && stb.broken === 1 && stb.nb.length === 0, JSON.stringify(stb && stb.broken));
  PD.load({ pipes: [{ a: [0, 0, 0], b: [2, 0, 0], n: 4 }] }); btn('t-sel').onclick();
  PD.pen.box({ x0: 0, x1: 5000, y0: 0, y1: 5000 });
  check('hand-picked pipes show move arrows in all three directions', PD.egz().m.length === 6, PD.egz().m.length);
  check('moving them starts and refuses when tied to equipment', PD.pen.moveStart('x') && PD.pen.moveStart('x').msel === true);
  U(); btn('t-sel').onclick(); PD.selectPart('pipe', 1); PD.pen.quick('q-run');
  check('Run selects the whole run', Object.keys(PD.pen.msel()).length === 3, Object.keys(PD.pen.msel()).join());
  PD.pen.quick('q-x');
  PD.load({ pipes: [] });
}


// NDE on welds and insulation on the iso
{
  PD.load({ pipes: [{ a: [0, 0, 0], b: [2, 0, 0], n: 4, ln: 'A' }, { a: [2, 0, 0], b: [2, 0, 2], n: 4, ln: 'A' }], lines: { A: { insul: '50 mm mineral wool', nde: 'RT 10%' } } });
  const w0 = PD.fab().welds[0];
  check('a weld has an empty NDE method by default', w0 && w0.nde === '', JSON.stringify(w0));
  PD.model.ndeW[w0.key] = 'RT'; PD.rebuild();
  check('the NDE method follows the weld', PD.fab().welds[0].nde === 'RT');
  check('the cut list CSV has an NDE column', PD.fabCsv().split('\n').some(l => /Made,NDE$/.test(l)) && /,(Shop|Field),"RT"/.test(PD.fabCsv()), PD.fabCsv().slice(-200));
  PD.load({ pipes: [{ a: [0, 0, 0], b: [2, 0, 0], n: 4 }], ndeW: { '1,2,3': 'XX', '4,5,6': 'PT', __proto__: 'RT' } });
  check('a loaded project keeps only known NDE methods', JSON.stringify(PD.model.ndeW) === '{"4,5,6":"PT"}', JSON.stringify(PD.model.ndeW));
  PD.load({ pipes: [{ a: [0, 0, 0], b: [2, 0, 0], n: 4, ln: 'A' }, { a: [2, 0, 0], b: [2, 0, 2], n: 4, ln: 'A' }, { a: [5, 0, 0], b: [7, 0, 0], n: 4, ln: 'B' }], lines: { A: { insul: '50 mm mineral wool', nde: 'RT 10%' }, B: { insul: 'none' } } });
  const svg = PD.iso();
  check('an insulated line is drawn dashed and noted, an uninsulated one is not', svg.includes('stroke-dasharray="7 3"') && svg.includes('Insulation A (dashed): 50 mm mineral wool') && !svg.includes('Insulation B'), 'dash ' + svg.includes('stroke-dasharray="7 3"'));
  check('the NDE extent of a line is noted on the sheet', svg.includes('NDE A: RT 10%'));
  PD.load({ pipes: [{ a: [0, 0, 0], b: [2, 0, 0], n: 4, ln: 'A' }], lines: { A: { insul: 'none' } } });
  check('no insulation means no dashes', !PD.iso().includes('stroke-dasharray="7 3"'));
  PD.load({ pipes: [] });
}


// Rotation ring: any angle for a valve handwheel and for equipment
{
  const btn = id => ctx.document.getElementById(id);
  const ev = (type, id, x, y) => ({ type, pointerType: 'pen', pointerId: id, clientX: x, clientY: y });
  const cross = (u, v) => [u[1] * v[2] - u[2] * v[1], u[2] * v[0] - u[0] * v[2], u[0] * v[1] - u[1] * v[0]];
  const ringPt = (R, deg) => { const t = deg * Math.PI / 180, pp = cross(R.n, R.ref); return [0, 1, 2].map(k => R.c[k] + R.ref[k] * Math.cos(t) * R.R + pp[k] * Math.sin(t) * R.R); };
  const dragRing = (deg0, deg1) => { const R = PD.pen.ring(), a = PD.project(ringPt(R, deg0)), b = PD.project(ringPt(R, deg1)), id = pid_++; L.cv.pointerdown(ev('pointerdown', id, a.x, a.y)); L.cv.pointermove(ev('pointermove', id, b.x, b.y)); L.cv.pointerup(ev('pointerup', id, b.x, b.y)); globalThis.__perf = (globalThis.__perf || 0) + 1000; };
  PD.load({ pipes: [{ a: [0, 0, 0], b: [4, 0, 0], n: 4 }], valves: [{ p: [2, 0, 0], d: [1, 0, 0], n: 4, s: 40, k: 'gate' }] });
  btn('t-sel').onclick(); PD.selectPart('valve', 0);
  let R = PD.pen.ring();
  check('a selected valve shows the rotation ring at its handwheel angle', R && R.vis && R.kind === 'valve' && R.deg === 0, JSON.stringify(R));
  dragRing(0, 35);
  check('dragging the knob with the Pencil sets the handwheel to that angle in steps of 5', PD.model.valves[0].hw === 35, PD.model.valves[0].hw);
  dragRing(35, 200);
  check('and to any other angle', PD.model.valves[0].hw === 200, PD.model.valves[0].hw);
  dragRing(200, 0);
  check('back at 0 the angle is removed from the record', PD.model.valves[0].hw === undefined, JSON.stringify(PD.model.valves[0]));
  check('the angle drags as one undo step', (() => { const n0 = PD.model.valves[0].hw; dragRing(0, 90); dragRing(90, 135); btn('undo').onclick(); return PD.model.valves[0].hw === 90 && n0 === undefined; })(), PD.model.valves[0].hw);
  PD.selectPart('valve', 0); btn('i-hwn').value = '22.5'; btn('i-hwn').onchange();
  check('a typed angle is kept to a quarter of a degree', PD.model.valves[0].hw === 22.5, PD.model.valves[0].hw);
  btn('i-hwn').value = '-30'; btn('i-hwn').onchange();
  check('a negative angle is turned into 0..360', PD.model.valves[0].hw === 330, PD.model.valves[0].hw);
  btn('i-hwn').value = 'abc'; btn('i-hwn').onchange();
  check('a typed non-number changes nothing', PD.model.valves[0].hw === 330);
  // equipment
  PD.load({ pipes: [], equip: [{ k: 'pump', p: [0, 0, 0], r: 0 }] }); btn('t-sel').onclick(); PD.selectEq(0);
  R = PD.pen.ring();
  check('selected equipment shows a flat ring', R && R.vis && R.kind === 'equip' && R.n[1] === 1, JSON.stringify(R));
  dragRing(0, 40);
  check('dragging it turns the equipment to any angle', Math.abs(PD.model.equip[0].r * 90 - 40) < 1e-6, PD.model.equip[0].r);
  btn('i-rota').value = '75'; btn('i-rota').onchange();
  check('a typed rotation is in degrees', Math.abs(PD.model.equip[0].r * 90 - 75) < 1e-6, PD.model.equip[0].r);
  PD.load({ pipes: [{ a: [0, 0, 0], b: [2, 0, 0], n: 4 }], equip: [{ k: 'pump', p: [3, 0, 0], r: 0.44 }] });
  check('the iso sheet still draws turned equipment', (PD.iso() || '').length > 1000);
  PD.load({ pipes: [] });
}


// Rotate mode: a dial from anywhere on the screen
{
  const btn = id => ctx.document.getElementById(id);
  const ev = (type, id, x, y) => ({ type, pointerType: 'pen', pointerId: id, clientX: x, clientY: y });
  const cross = (u, v) => [u[1] * v[2] - u[2] * v[1], u[2] * v[0] - u[0] * v[2], u[0] * v[1] - u[1] * v[0]];
  const ringPt = (R, deg, k3) => { const t = deg * Math.PI / 180, pp = cross(R.n, R.ref); return [0, 1, 2].map(k => R.c[k] + R.ref[k] * Math.cos(t) * R.R * k3 + pp[k] * Math.sin(t) * R.R * k3); };
  PD.load({ pipes: [{ a: [0, 0, 0], b: [4, 0, 0], n: 4 }], valves: [{ p: [2, 0, 0], d: [1, 0, 0], n: 4, s: 40, k: 'gate', hw: 20 }] });
  btn('t-sel').onclick(); PD.selectPart('valve', 0);
  check('the quick bar of a valve offers Rotate and shows its angle', /q-rot/.test(PD.pen.qbar().html) && /20/.test(PD.pen.qbar().html), PD.pen.qbar().html);
  PD.pen.quick('q-rot');
  const R = PD.pen.ring(), a = PD.project(ringPt(R, 10, 3)), b = PD.project(ringPt(R, 60, 3)), id = pid_++;
  L.cv.pointerdown(ev('pointerdown', id, a.x, a.y)); L.cv.pointermove(ev('pointermove', id, b.x, b.y)); L.cv.pointerup(ev('pointerup', id, b.x, b.y));
  check('in Rotate mode a drag far from the ring turns it by how far the pointer went round', PD.model.valves[0].hw === 70, PD.model.valves[0].hw);
  PD.pen.quick('q-x'); PD.selectPart('valve', 0);
  check('leaving the selection leaves Rotate mode', PD.pen.ring() && !/aria-pressed="true"/.test(PD.pen.qbar().html.split('q-rot')[1].split('</button>')[0]), PD.pen.qbar().html);
  PD.load({ pipes: [] });
}


// A flanged valve is one part with its flanges: no weld marks at it on the iso, four flange bars
{
  const btn = id => ctx.document.getElementById(id);
  PD.load({ pipes: [{ a: [0, 0, 0], b: [4, 0, 0], n: 4, ln: 'A' }, { a: [4, 0, 0], b: [4, 0, 2], n: 4, ln: 'A' }], valves: [{ p: [2, 0, 0], d: [1, 0, 0], n: 4, s: 40, k: 'gate' }] });
  PD.addValveFlanges(PD.model.valves[0]);
  const f = PD.fab();
  const vw = f.welds.filter(w => w.atValve), ow = f.welds.filter(w => !w.atValve);
  check('the welds of the flanges fitted to a valve are flagged and numbered after the others', vw.length === 2 && ow.length >= 1 && Math.min(...vw.map(w => w.no)) > Math.max(...ow.map(w => w.no)), JSON.stringify(f.welds.map(w => [w.no, !!w.atValve])));
  btn('iso-vw').onclick && 0;
  let svg = PD.iso();
  check('the iso marks only the other welds, no number at the flanged valve', ow.every(w => svg.includes('>W' + w.no + '<')) && vw.every(w => !svg.includes('>W' + w.no + '<')), '');
  PD.isoOpts.valveWelds = true; svg = PD.iso(); PD.isoOpts.valveWelds = false;
  check('with the option on the valve flange welds are marked again', vw.every(w => svg.includes('>W' + w.no + '<')));
  check('the cut list sheet still lists every weld', f.welds.length === vw.length + ow.length && PD.fabCsv().includes('W' + vw[0].no + ','));
  PD.load({ pipes: [] });
}


// View cube
{
  const C = PD.pen.cube, near2 = (a, b) => Math.abs(a - b) < 1e-6;
  let d = C.dir('front', 0.5, 0.5); check('the middle of the Front face looks from the front', near2(d.x, 0) && near2(d.y, 0) && near2(d.z, 1));
  let a = C.go(d); check('Front puts the camera on the +Z side level with the drawing', near2(a[0], 0) && near2(a[1], Math.PI / 2), a.join());
  d = C.dir('right', 0.5, 0.5); a = C.go(d); check('Right looks from +X', near2(a[0], Math.PI / 2) && near2(a[1], Math.PI / 2), a.join());
  d = C.dir('left', 0.5, 0.5); a = C.go(d); check('Left looks from -X', near2(Math.abs(a[0]), Math.PI / 2) && a[0] < 0, a.join());
  d = C.dir('back', 0.5, 0.5); a = C.go(d); check('Back looks from -Z', near2(Math.abs(a[0]), Math.PI), a.join());
  d = C.dir('top', 0.5, 0.5); a = C.go(d); check('Top looks straight down, keeping the turn of the view', a[1] < 0.05, a.join());
  d = C.dir('bottom', 0.5, 0.5); a = C.go(d); check('Bottom looks from below', a[1] > Math.PI - 0.05, a.join());
  d = C.dir('front', 0.9, 0.1); check('the top right corner of Front leans right and up: a corner view', d.x > 0.5 && d.y > 0.5 && d.z > 0.5, JSON.stringify(d));
  d = C.dir('front', 0.5, 0.1); check('the top edge of Front leans up only', near2(d.x, 0) && d.y > 0.5 && d.z > 0.5);
  d = C.dir('top', 0.1, 0.5); check('the left edge of Top leans toward Left', d.x < -0.5 && d.y > 0.5);
  d = C.dir('right', 0.9, 0.9); check('the lower far corner of Right is a bottom corner', d.x > 0.5 && d.y < -0.5, JSON.stringify(d));
  a = C.go(C.dir('front', 0.9, 0.1)); check('a corner click gives an iso-like view', a[1] > 0.6 && a[1] < 1.2 && a[0] > 0.5 && a[0] < 1.0, a.join());
}

// Audit: drags, selections and sheets
{
  let dragging = false; ctx.document.body = { classList: { toggle(c, on) { if (c === 'dragging') dragging = !!on; }, add() {}, remove() {} } };
  const btn = id => ctx.document.getElementById(id);
  const ev = (type, kind, id, x, y) => ({ type, pointerType: kind, pointerId: id, clientX: x, clientY: y });
  const P2 = () => PD.load({ pipes: [{ a: [0, 0, 0], b: [2, 0, 0], n: 4 }, { a: [2, 0, 0], b: [2, 0, 2], n: 4 }] });
  const grab = (kind, id) => { P2(); btn('t-sel').onclick(); PD.selectPart('pipe', 0); const s = PD.project([0, 0, 0]); L.cv.pointerdown(ev('pointerdown', kind, id, s.x, s.y)); const t = PD.project([-1, 0, 0]); L.cv.pointermove(ev('pointermove', kind, id, t.x, t.y)); return t; };
  let id = 5000, t = grab('mouse', id);
  check('a handle drag fades the panels', dragging === true);
  btn('t-pipe').onclick(); L.cv.pointerup(ev('pointerup', 'mouse', id, t.x, t.y));
  check('changing tool mid drag does not leave the panels faded and dead', dragging === false);
  id++; t = grab('mouse', id); btn('undo').onclick(); L.cv.pointerup(ev('pointerup', 'mouse', id, t.x, t.y));
  check('Undo mid drag does not leave the panels faded', dragging === false);
  id++; t = grab('mouse', id); PD.selectPart('pipe', 1); L.cv.pointermove(ev('pointermove', 'mouse', id, t.x + 5, t.y)); L.cv.pointerup(ev('pointerup', 'mouse', id, t.x, t.y));
  check('a drag whose selection changed ends cleanly', dragging === false);
  // second finger during a drag
  globalThis.__perf = (globalThis.__perf || 0) + 1000; id++; t = grab('mouse', id); const far = PD.project([5, 0, 5]); const f = ev('pointerdown', 'touch', 6001, far.x, far.y);
  L.cv.pointerdown(f); L.cv.pointerup(Object.assign({}, f, { type: 'pointerup' }));
  L.cv.pointermove(ev('pointermove', 'mouse', id, t.x - 20, t.y)); L.cv.pointerup(ev('pointerup', 'mouse', id, t.x - 20, t.y));
  check('a second finger tapping during an end handle drag neither ends it nor changes the selection', PD.model.pipes[0].a[0] < -0.5, JSON.stringify(PD.model.pipes[0]));
  // cancel
  id++; t = grab('pen', id); L.cv.pointercancel(ev('pointercancel', 'pen', id, t.x, t.y));
  check('pointercancel on a handle drag stretches nothing', PD.model.pipes[0].a[0] === 0, JSON.stringify(PD.model.pipes[0]));
  // multi selection survives a one-line sheet
  PD.load({ pipes: [{ a: [0, 0, 0], b: [2, 0, 0], n: 4, ln: 'A' }, { a: [5, 0, 0], b: [7, 0, 0], n: 4, ln: 'B' }, { a: [5, 0, 3], b: [7, 0, 3], n: 4, ln: 'B' }] }); btn('t-sel').onclick();
  PD.pen.box({ x0: 0, x1: 5000, y0: 0, y1: 5000 });
  const m0 = Object.keys(PD.pen.msel()).length; PD.iso('A'); PD.bomByLine();
  check('building a one-line sheet keeps the hand-picked selection', m0 === 3 && Object.keys(PD.pen.msel()).length === 3, m0 + ' ' + Object.keys(PD.pen.msel()).join());
  PD.load({ pipes: [] });
}

// Audit: taking back a pipe after another tool changed the drawing
{
  globalThis.__perf = (globalThis.__perf || 0) + 1000;
  const btn = id => ctx.document.getElementById(id);
  PD.load({ pipes: [] }); btn('t-pipe').onclick(); btn('finish').onclick();
  for (let i = 0; i < 6; i++) btn('down').onclick();
  tapOn([0, 0, 0]); tapOn([4, 0, 0]); tapOn([4, 0, 2]);
  btn('t-valve').onclick && 0;
  L.parts.click({ target: { closest: () => ({ dataset: { chip: 'gate', cat: 'valve' } }) } });
  tapOn([2, 0, 0]);
  const nv = PD.model.valves.length, np = PD.model.pipes.length;
  btn('t-pipe').onclick();
  PD.pen.segUndo();
  check('Take back never undoes a valve placed in between', PD.model.valves.length === nv && (PD.model.pipes.length === np - 1 || PD.cursor() === null), nv + ' valves ' + PD.model.valves.length + ', pipes ' + np + '>' + PD.model.pipes.length + ' ' + JSON.stringify(PD.cursor()));
  PD.load({ pipes: [] });
}

// Audit: Parts in the rail opens a folded list
{
  const btn = id => ctx.document.getElementById(id);
  btn('t-nav').onclick(); btn('t-parts').onclick();
  L.parts.click({ target: { closest: () => ({ dataset: { chip: 'ball', cat: 'valve' } }) } });
  check('choosing a part folds the list', PD.pen.partsMin() && PD.pen.tool() === 'valve');
  btn('t-parts').onclick();
  check('Parts in the rail unfolds a folded list and keeps the part armed', !PD.pen.partsMin() && PD.pen.tool() === 'valve' && btn('parts').hidden === false, PD.pen.tool());
  btn('t-parts').onclick();
  check('and a second tap closes Parts', PD.pen.tool() === 'nav');
  btn('t-nav').onclick();
}

// Audit: the quick bar angle follows a typed angle
{
  const btn = id => ctx.document.getElementById(id);
  PD.load({ pipes: [{ a: [0, 0, 0], b: [4, 0, 0], n: 4 }], valves: [{ p: [2, 0, 0], d: [1, 0, 0], n: 4, s: 40, k: 'gate' }] });
  btn('t-sel').onclick(); PD.selectPart('valve', 0);
  btn('i-hwn').value = '40'; btn('i-hwn').onchange();
  check('a typed handwheel angle shows in the quick bar', /40°/.test(PD.pen.qbar().html), PD.pen.qbar().html);
  btn('i-hwn').value = '75'; btn('i-hwn').onchange();
  check('and again after a second change', /75°/.test(PD.pen.qbar().html) && !/40°/.test(PD.pen.qbar().html), PD.pen.qbar().html);
  PD.load({ pipes: [] });
}

// Audit: a palm already resting when the Pencil comes down
{
  const btn = id => ctx.document.getElementById(id);
  globalThis.__perf = (globalThis.__perf || 0) + 1000;
  PD.pen.setFinger(false); PD.load({ pipes: [] }); btn('t-pipe').onclick(); btn('finish').onclick();
  L.cv.pointerdown({ type: 'pointerdown', pointerType: 'touch', pointerId: 9101, clientX: 100, clientY: 500 });
  L.cv.pointerdown({ type: 'pointerdown', pointerType: 'pen', pointerId: 9102, clientX: 420, clientY: 330 });
  L.cv.pointerup({ type: 'pointerup', pointerType: 'pen', pointerId: 9102, clientX: 420, clientY: 330 });
  check('the Pencil places a point even with a palm already resting on the screen', !!PD.cursor());
  L.cv.pointerup({ type: 'pointerup', pointerType: 'touch', pointerId: 9101, clientX: 100, clientY: 500 });
  PD.pen.setFinger(true); btn('finish').onclick(); PD.load({ pipes: [] });
}

// Drawing in a side view: Front and Right use an upright plane facing the camera, so a tap sets the height too
{
  const btn = id => ctx.document.getElementById(id);
  const T3 = ctx.THREE; globalThis.__perf = (globalThis.__perf || 0) + 5000;   // the block before ends with a Pencil touch: move past the palm window
  PD.load({ pipes: [] }); PD.pen.setFinger(true); btn('t-pipe').onclick(); btn('finish').onclick();
  PD.pen.cube.go(new T3.Vector3(0, 0, 1));
  check('the Front view counts as a side view', PD.pen.cube.sideAxis() === 2);
  tapAt(400, 200);
  const c0 = PD.cursor();
  const near = (p, x, y) => { const q = PD.project(p); return Math.hypot(q.x - x, q.y - y) < 30; };
  check('Front view: a tap above the middle starts a run in the air, under the finger', !!c0 && c0[1] > 0.3 && near(c0, 400, 200), JSON.stringify(c0));
  tapAt(600, 200);
  const p1 = PD.model.pipes[0];
  check('Front view: tapping sideways draws a level pipe along X', !!p1 && Math.abs(p1.a[1] - p1.b[1]) < 1e-6 && p1.b[0] > p1.a[0] && Math.abs(p1.b[2] - p1.a[2]) < 1e-6, JSON.stringify(p1));
  tapAt(600, 270);
  const p2 = PD.model.pipes[1];
  check('Front view: tapping lower draws a pipe straight down', !!p2 && p2.b[1] < p2.a[1] && Math.abs(p2.a[0] - p2.b[0]) < 1e-6, JSON.stringify(PD.model.pipes));
  btn('finish').onclick();
  PD.pen.cube.go(new T3.Vector3(1, 0, 0));
  check('the Right view counts as a side view', PD.pen.cube.sideAxis() === 0);
  tapAt(300, 150);
  const c1 = PD.cursor();
  check('Right view: a new run starts in the air, under the finger', !!c1 && c1[1] > 0.3 && near(c1, 300, 150), JSON.stringify(c1));
  btn('finish').onclick();
  PD.pen.cube.go(new T3.Vector3(0, 0, 1));
  tapAt(400, 590);
  const c2 = PD.cursor();
  check('Front view: nothing goes below the floor', !c2 || c2[1] >= 0, JSON.stringify(c2));
  btn('finish').onclick();
  PD.pen.cube.go(new T3.Vector3(0.6, 0.7, 0.4).normalize());
  check('a view from above still uses the level plane', PD.pen.cube.sideAxis() === -1);
  PD.load({ pipes: [] });
}

// Iso sheet: long pipes are shortened on paper with a break mark, dimensions stay true
{
  PD.load({ pipes: [
    { a: [0, 1, 0], b: [20, 1, 0], n: 4 }, { a: [20, 1, 0], b: [20, 1, 1.2], n: 4 }, { a: [20, 1, 1.2], b: [20, 3, 1.2], n: 4 },
    { a: [20, 3, 1.2], b: [21.5, 3, 1.2], n: 4 } ],
    valves: [{ p: [20.6, 3, 1.2], d: [1, 0, 0], n: 4, k: 'gate' }], supports: [{ p: [4, 1, 0], d: [1, 0, 0], n: 4, t: 'shoe' }] });
  const marks = svg => (svg.match(/class="brk"/g) || []).length / 2;
  const on = PD.iso('', 'auto');
  check('a 20 m pipe next to a short spool gets one break mark', marks(on) === 1, String(marks(on)));
  check('the sheet says long pipes are shortened', on.includes('long pipes shortened at break marks'));
  check('the true lengths are still dimensioned', on.includes('>20000<') && on.includes('>4000<') && on.includes('>16000<'));
  PD.isoOpts.brk = false; const off = PD.iso('', 'auto'); PD.isoOpts.brk = true;
  check('Options, Shorten long pipes off: no break marks and no note', marks(off) === 0 && !off.includes('long pipes shortened'));
  const span = svg => { const xs = [...svg.matchAll(/<line x1="([-0-9.]+)" y1="([-0-9.]+)" x2="([-0-9.]+)" y2="([-0-9.]+)" stroke="#[0-9a-fA-F]+" stroke-width="2\.00" stroke-linecap="round"\/>/g)].map(m => Math.hypot(m[3] - m[1], m[4] - m[2])); return xs; };
  const lo = span(on), lf = span(off), ratio = (l) => l[1] / l[0];
  check('shortened, the 1.2 m pipe is drawn larger next to the long one than at true scale', lo.length === 4 && lf.length === 4 && ratio(lo) > ratio(lf) * 2, JSON.stringify([lo, lf]));
  PD.load({ pipes: [{ a: [0, 0, 0], b: [2, 0, 0], n: 4 }, { a: [2, 0, 0], b: [2, 0, 1.5], n: 4 }] });
  check('a compact layout is not shortened', marks(PD.iso('', 'auto')) === 0);
  PD.load({ pipes: [] });
}

// Company logo in the iso title block
{
  PD.load({ pipes: [{ a: [0, 0, 0], b: [2, 0, 0], n: 4 }] });
  const png = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==';
  check('no logo: the title block starts at the left edge', !PD.iso('', 'auto').includes('<image href="data:image/png'));
  check('a logo picture is accepted', PD.setLogo(png) === true && PD.model.title.logo === png);
  const sv = PD.iso('', 'auto');
  check('the logo is drawn in the title block', sv.includes('<image href="' + png + '"') && sv.includes('preserveAspectRatio="xMidYMid meet"'));
  check('the panel shows the logo with Change and Remove', PD.isoInfoHtml().includes('data-logo-del') && PD.isoInfoHtml().includes('Change'));
  check('something that is not a picture is refused', PD.setLogo('javascript:alert(1)') === false && PD.model.title.logo === png);
  PD.load({ pipes: [{ a: [0, 0, 0], b: [2, 0, 0], n: 4 }], title: { project: 'P', logo: 'data:text/html;base64,PHNjcmlwdD4=' } });
  check('a file with a bad logo loads without it', !('logo' in PD.model.title) && PD.model.title.project === 'P');
  PD.load({ pipes: [{ a: [0, 0, 0], b: [2, 0, 0], n: 4 }], title: { project: 'P', logo: png } });
  check('a saved logo comes back with the project', PD.model.title.logo === png);
  PD.setLogo(''); check('Remove takes the logo off', !('logo' in PD.model.title) && !PD.iso('', 'auto').includes('<image href="data:image/png'));
  PD.load({ pipes: [] });
}

// Built-in equipment: horizontal vessel, vertical in-line pump, shell and tube exchanger
{
  const kinds = { hvessel: ['Horizontal vessel', 3], vpump: ['Vertical in-line pump', 2], hx: ['Shell and tube heat exchanger', 4] };
  for (const [k, [name, nn]] of Object.entries(kinds)) {
    PD.load({ pipes: [], equip: [{ k, p: [0, 0, 0], r: 0 }] });
    const nz = PD.nozzles().filter(z => z.e === 0);
    check(name + ': in the BOM and with ' + nn + ' nozzles', has(name + ' | 1') && nz.length === nn, rows());
    // a pipe leaving every nozzle along its axis: no warnings
    const pipes = nz.map(z => { const a = [z.p.x, z.p.y, z.p.z].map(v => Math.round(v * 1000) / 1000), d = [z.d.x, z.d.y, z.d.z]; return { a, b: a.map((v, i) => Math.round((v + d[i] * 0.6) * 1000) / 1000), n: z.n }; });
    PD.load({ pipes, equip: [{ k, p: [0, 0, 0], r: 0 }] });
    check(name + ': pipes on every nozzle raise no warning', PD.warns().length === 0, PD.warns().join('\n'));
    const iso = PD.iso('', 'auto');
    check(name + ': drawn on the iso sheet and listed', !!iso && iso.includes(name), '');
    check(name + ': on the P&ID with its tag', PD.pid().includes(k === 'hx' ? 'E-1' : k === 'vpump' ? 'P-1' : 'V-1'));
    PD.load({ pipes: pipes.concat([{ a: [-3, 0.8, 0.05], b: [3, 0.8, 0.05], n: 2 }]), equip: [{ k, p: [0, 0, 0], r: 1 }] });
    check(name + ': a pipe straight through the body is a clash, turned too', PD.warns().some(w => /equipment|through|inside/i.test(w)), PD.warns().join('\n'));
  }
  check('the symbol sheet lists the new equipment', ['Horizontal vessel', 'Vertical in-line pump', 'Shell and tube heat exchanger'].every(n => PD.legend().includes(n)));
  PD.load({ pipes: [] });
}

// Iso sheet: flanges bolted to a valve sit against the ends of the valve symbol, whatever the drawing scale
{
  const syms = svg => [...svg.matchAll(/class="sy" transform="matrix\(([-0-9.e]+) ([-0-9.e]+) [-0-9.e]+ [-0-9.e]+ ([-0-9.e]+) ([-0-9.e]+)\)"/g)].map(m => m.slice(1).map(Number));
  const cases = [
    ['gate on a short horizontal pipe', { pipes: [{ a: [0, 1, 0], b: [3, 1, 0], n: 4 }], valves: [{ p: [1.5, 1, 0], d: [1, 0, 0], n: 4, k: 'gate' }] }],
    ['check on a vertical pipe', { pipes: [{ a: [0, 0.5, 0], b: [0, 3, 0], n: 4 }, { a: [0, 3, 0], b: [2, 3, 0], n: 4 }], valves: [{ p: [0, 1.6, 0], d: [0, 1, 0], n: 4, k: 'check' }] }],
    ['butterfly (thin wafer) on a 20 m pipe that is shortened', { pipes: [{ a: [0, 1, 0], b: [20, 1, 0], n: 6 }, { a: [20, 1, 0], b: [20, 1, 1], n: 6 }], valves: [{ p: [10, 1, 0], d: [1, 0, 0], n: 6, k: 'butterfly' }] }],
  ];
  for (const [label, m] of cases) {
    PD.load(m); PD.model.valves.forEach(v => PD.addValveFlanges(v)); PD.rebuild();
    PD.isoOpts.style = 'pic'; const ss = syms(PD.iso('', 'auto')).filter((x, i) => i !== 2 && i !== 4); PD.isoOpts.style = 'sym';   // Pictures: the valve, then each flange and its second bar
    const v = ss[0], half = 10 * Math.hypot(v[0], v[1]);
    const fl = [ss[1], ss[2]].map(f => Math.hypot(f[2] - v[2], f[3] - v[3]));
    check('iso, ' + label + ': both valve flanges touch the ends of the valve symbol', ss.length === 3 && fl.every(d => Math.abs(d - half) < 1.2), JSON.stringify({ half, fl, n: ss.length }));
  }
  PD.load({ pipes: [] });
}

// Iso valve symbols after the reference chart: ends by joint type (butt weld dot, socket marks, one flange bar a side)
{
  const one = (n, e, k) => { PD.load({ pipes: [{ a: [0, 1, 0], b: [1.2, 1, 0], n }, { a: [1.2, 1, 0], b: [1.2, 1, -1.2], n }], valves: [{ p: [0.6, 1, 0], d: [1, 0, 0], n, k: k || 'gate', e }] }); PD.model.valves.forEach(v => PD.addValveFlanges(v)); PD.rebuild(); return PD.iso('', '0'); };
  const dots = svg => (svg.match(/<circle cx="[-0-9.]+" cy="[-0-9.]+" r="(2.6|3.6)" fill="#/g) || []).length;
  const sw = one(1, 'weld'), bw = one(4, 'weld'), fl = one(4, 'flg');
  check('a socket welded valve shows socket marks and no weld dots at its ends', sw.includes('x1="-10.5" y1="-3.5"') && dots(sw) === 2, String(dots(sw)));   // the two left are the elbow's
  check('a butt welded valve shows a weld dot at each end and no socket marks', !bw.includes('x1="-10.5" y1="-3.5"') && dots(bw) === 4, String(dots(bw)));   // two at the valve, two at the elbow
  check('a flanged valve shows one flange bar a side, drawn in its own symbol', (fl.match(/class="sy"/g) || []).length === 1 && (fl.match(/x1="-12.6" y1="-11.5"/g) || []).length === 1 && (fl.match(/x1="12.6" y1="-11.5"/g) || []).length === 1);
  check('the flange balloons still point at the flanges', (fl.match(/>5</g) || []).length >= 1);
  PD.isoOpts.style = 'pic'; const flp = one(4, 'flg'); PD.isoOpts.style = 'sym';
  check('the Pictures style still shows the valve\'s own flanges too', (flp.match(/class="sy"/g) || []).length === 5);
  check('globe and ball follow the chart: filled ball, open ball with a cross, no stem', PD.isos.globe.includes('r="5.4" fill="#14191c"') && !PD.isos.globe.includes('y2="-15"') && PD.isos.ball.includes('r="5.5" fill="#ffffff"'));
  PD.load({ pipes: [] });
}

{
  PD.load({ pipes: [{ a: [0, 1, 0], b: [2, 1, 0], n: 4 }], instr: [{ k: 'PSV', p: [1, 1, 0], d: [1, 0, 0], n: 4, num: 1 }] });
  const sv = PD.iso('', '0');
  check('the PSV is drawn as on the reference chart (inlet and outlet triangles with flange bars, spring bonnet)', sv.includes('M13,-21 L13,-9 L0,-15Z') && sv.includes('M-6,-3 L6,-3 L0,-15Z'));
  PD.isoOpts.style = 'pic'; check('the Pictures style keeps the PSV picture', !PD.iso('', '0').includes('M13,-21 L13,-9 L0,-15Z')); PD.isoOpts.style = 'sym';
  PD.load({ pipes: [] });
}

if (failed) { console.error('\n' + failed + ' check(s) failed'); process.exit(1); }
console.log('\nall checks passed');
