// Builds the single offline file index.html (+ sw.js) from src/index.src.html.
// Run: node build.js
const fs = require('fs'), path = require('path'), crypto = require('crypto');
const read = p => fs.readFileSync(path.join(__dirname, p), 'utf8');

let h = read('src/index.src.html');
if (!h.includes('//@@STEEL@@')) throw new Error('src/index.src.html has no //@@STEEL@@ marker');
h = h.replace('//@@STEEL@@', () => read('src/steel.part.js') + read('src/steel.ui.part.js'));   // the steel module lives in its own files and is spliced into the app script here
const three = read('vendor/three.min.js');
h = h.replace(/^<link[^\n]*fonts[^\n]*\r?\n/gm, '');
h = h.replace('<script src="https://cdnjs.cloudflare.com/ajax/libs/three.js/r128/three.min.js"></script>', () => '<script>' + three + '</script>');
h = h.split("'IBM Plex Mono', ui-monospace").join('ui-monospace').split("'IBM Plex Sans', system-ui").join('system-ui');

const head = '<!doctype html><html lang="th"><head><meta charset="utf-8">'
  + '<meta name="viewport" content="width=device-width,initial-scale=1,maximum-scale=1,user-scalable=no,viewport-fit=cover">'
  + '<meta name="apple-mobile-web-app-capable" content="yes"><meta name="mobile-web-app-capable" content="yes">'
  + '<meta name="apple-mobile-web-app-status-bar-style" content="black-translucent"><meta name="apple-mobile-web-app-title" content="PipeDraft">'
  + '<meta name="theme-color" content="#0d1418"><link rel="apple-touch-icon" href="icon-180.png"><link rel="icon" href="icon-180.png">'
  + '<link rel="manifest" href="manifest.json"><style>html{color-scheme:dark}body{margin:0}</style>';
const m = /^([\s\S]*?)(<div id="app">[\s\S]*)$/.exec(h);
if (!m) throw new Error('src/index.src.html has no <div id="app">');
const reg = '<script>if("serviceWorker"in navigator&&location.protocol.indexOf("http")==0)navigator.serviceWorker.register("sw.js").catch(function(){})</script>';
const out = head + m[1] + '</head><body>' + m[2] + reg + '</body></html>';
if (/https?:\/\/(cdnjs|fonts|cdn\.)/.test(out.replace(/https?:\/\/[^"'\s]*(three|github|w3\.org|threejs)[^"'\s]*/g, ''))) console.warn('warning: external URL found; the app must work offline');
fs.writeFileSync(path.join(__dirname, 'index.html'), out);

// New cache name on every content change, so installed copies update.
const v = crypto.createHash('sha256').update(out).digest('hex').slice(0, 8);
// Online: revalidate with the network every time, so a new build shows up on the next open.
// Offline or slow (4 s): fall back to the cached copy. Install bypasses the HTTP cache (GitHub Pages sends max-age=600).
fs.writeFileSync(path.join(__dirname, 'sw.js'),
  'const C="pd-' + v + '",F=["./","index.html","manifest.json","icon-180.png","icon-512.png"];'
  + 'self.addEventListener("install",e=>{self.skipWaiting();e.waitUntil(caches.open(C).then(c=>c.addAll(F.map(u=>new Request(u,{cache:"reload"})))))});'
  + 'self.addEventListener("activate",e=>e.waitUntil(caches.keys().then(k=>Promise.all(k.filter(n=>n!==C).map(n=>caches.delete(n)))).then(()=>self.clients.claim())));'
  + 'self.addEventListener("fetch",e=>{if(e.request.method!=="GET")return;'
  + 'const net=fetch(e.request,{cache:"no-cache"}).then(r=>{if(r.ok){const c=r.clone();caches.open(C).then(x=>x.put(e.request,c))}return r});'
  + 'const slow=new Promise((_,rej)=>setTimeout(rej,4000));'
  + 'e.respondWith(Promise.race([net,slow]).catch(()=>caches.match(e.request,{ignoreSearch:true}).then(r=>r||net)))});\n');
console.log('built index.html', Math.round(out.length / 1024) + ' KB, cache pd-' + v);