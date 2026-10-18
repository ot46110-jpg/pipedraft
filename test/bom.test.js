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
