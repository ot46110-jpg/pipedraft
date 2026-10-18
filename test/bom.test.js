// Headless check of the model and BOM: stubs the DOM and WebGL, runs the app script from index.html.
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
const text = els.bom.innerHTML.replace(/<\/tr>/g, '\n').replace(/<[^>]+>/g, ' ').replace(/ +/g, ' ');
const expect = ['Pipe, NPS 4 SCH 40, BE 8.26 m', 'Pipe, NPS 3 SCH 40, BE 0.74 m', 'Elbow 90° LR BW, NPS 4 SCH 40 2', 'Reducer concentric BW, NPS 4×3 SCH 40 1', 'Tee equal BW, NPS 4 SCH 40 1', 'Gate valve BW, NPS 4 2'];
const miss = expect.filter(e => !text.includes(e));
if (miss.length) { console.error('FAIL, missing:\n' + miss.join('\n') + '\n\nGot:\n' + text); process.exit(1); }
console.log('ok: example layout BOM matches');