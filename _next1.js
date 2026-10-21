const fs = require('fs'); let h = fs.readFileSync('src/index.src.html', 'utf8');
function rep(a, b) { const n = h.split(a).length - 1; if (n !== 1) throw new Error('count ' + n + ': ' + a.slice(0, 100)); h = h.replace(a, () => b); }

// ---- 3. strict number parsing: 1,500 is 1500, 1200+300 is 1500, 4'6" is refused ----
rep("  function numField(id) { var v = parseFloat(String($(id).value).replace(',', '.')); return isFinite(v) ? v : null; }",
`  function parseNum(s) {                                            // a typed number: digits, one decimal separator, + and - between terms, optional mm; anything else is refused
    var t = String(s == null ? '' : s).trim().toLowerCase().replace(/\\s*mm$/, '').replace(/\\s+/g, '');
    if (t === '') return null;
    if (/^[+-]?[0-9]{1,3}(,[0-9]{3})+(\\.[0-9]+)?$/.test(t)) t = t.replace(/,/g, '');   // 1,500 is fifteen hundred
    else t = t.replace(',', '.');
    if (!/^[+-]?([0-9]+\\.?[0-9]*|\\.[0-9]+)([+-]([0-9]+\\.?[0-9]*|\\.[0-9]+))*$/.test(t)) return null;
    var sum = 0; t.replace(/[+-]?([0-9]+\\.?[0-9]*|\\.[0-9]+)/g, function (m) { sum += parseFloat(m); return m; });
    return isFinite(sum) ? sum : null;
  }
  function numField(id) { return parseNum($(id).value); }`);
rep("    if (val == null || val === 0) { toast('Type a length in mm'); return; }\n    var dir = null;", "    if (val == null || val === 0) { toast('Type a length in mm, for example 1500 or 1200+300'); return; }\n    if (Math.abs(val) < 50) { toast('A pipe shorter than 50 mm is not drawn'); return; }\n    var dir = null;");

// ---- 2. a run that starts on an existing pipe end carries that pipe's size, schedule and line ----
rep("  function startAtNozzle(z) {", `  function adoptFrom(pt) {                                          // start of a run on a pipe end: continue as that pipe, so the size and line do not change by accident
    var k = key(pt), p = null; model.pipes.forEach(function (q) { if (!p && (key(q.a) === k || key(q.b) === k)) p = q; });
    if (!p || (p.n === curN && (p.s || 40) === curS && p.ln === curL)) return;
    curN = p.n; curS = p.s || 40; curL = p.ln; $('nps').value = String(curN); $('sched').value = String(curS); $('ln').value = curL;
    toast('Run continues as ' + sz(curN) + ', SCH ' + curS + ', line ' + curL);
  }
  function startAtNozzle(z) {`);
rep("          cursor = st; elev = st[1]; updateUi();", "          cursor = st; elev = st[1]; adoptFrom(st); updateUi();");

// ---- 1. changing a pipe's size takes its valves, flanges and parts with it ----
rep("    if ($('i-n')) $('i-n').onchange = edit(function (v) { it.n = +v; });", `    if ($('i-n')) $('i-n').onchange = edit(function (v) {
      var nn = +v; it.n = nn;
      if (sel.kind === 'pipe') {                                    // what sits on this pipe is the same size as the pipe
        var pi = sel.i;
        model.valves.forEach(function (vv) { if (hostOf(vv.p) !== pi) return; var had = valveFaceFlanges(vv).length > 0; dropValveFlanges(vv); vv.n = nn; if (had) addValveFlanges(vv); });
        ['flanges', 'items', 'supports'].forEach(function (g) { model[g].forEach(function (x) { if (hostOf(x.p) === pi) x.n = nn; }); });
      }
    });`);

// ---- 4, 5 and the size / negative checks: warnings ----
rep("    hydroWarnings(); spWarnings();\n    matDirty = true;", "    hydroWarnings(); spWarnings(); partWarnings();\n    matDirty = true;");
rep("  function spWarnings() {", `  function partWarnings() {                                         // things that make the bill of materials wrong without looking wrong on screen
    var tg1 = assignTags(), n = 0;
    model.valves.forEach(function (v, i) {
      var hi = hostOf(v.p); if (hi < 0) return;
      if (model.pipes[hi].n !== v.n) warns.push('Valve ' + tg1.valves[i] + ' is ' + sz(v.n) + ' but sits on ' + sz(model.pipes[hi].n) + ' pipe (pipe ' + (hi + 1) + '). Select the pipe and set the size again.');
      var t = endType(VALVE_FF[v.k] ? v.k : 'gate', v.n, v.e);
      if ((t === 'flg' || t === 'wafer') && !valveFaceFlanges(v).length) warns.push('Flanged valve ' + tg1.valves[i] + ' has no flanges against it, so the list has no flanges, gaskets or bolts. Select it and use Add flanges.');
    });
    ['items', 'flanges'].forEach(function (g) { model[g].forEach(function (x) { var hi = hostOf(x.p); if (hi >= 0 && model.pipes[hi].n !== x.n && n++ < 6) warns.push((g === 'items' ? 'An inline part' : 'A flange') + ' is ' + sz(x.n) + ' but sits on ' + sz(model.pipes[hi].n) + ' pipe (pipe ' + (hi + 1) + ').'); }); });
    var P = model.pipes, found = 0;                                 // pipes lying on top of each other are counted twice
    for (var i = 0; i < P.length && found < 6; i++) for (var j = i + 1; j < P.length && found < 6; j++) {
      var a = P[i].a, b = P[i].b, c = P[j].a, d = P[j].b, ux = b[0] - a[0], uy = b[1] - a[1], uz = b[2] - a[2], L = Math.hypot(ux, uy, uz); if (L < 1e-6) continue;
      ux /= L; uy /= L; uz /= L;
      var s0 = (c[0] - a[0]) * ux + (c[1] - a[1]) * uy + (c[2] - a[2]) * uz, s1 = (d[0] - a[0]) * ux + (d[1] - a[1]) * uy + (d[2] - a[2]) * uz;
      var dc = Math.hypot(c[0] - a[0] - ux * s0, c[1] - a[1] - uy * s0, c[2] - a[2] - uz * s0), dd = Math.hypot(d[0] - a[0] - ux * s1, d[1] - a[1] - uy * s1, d[2] - a[2] - uz * s1);
      if (dc > 0.002 || dd > 0.002) continue;
      var ov = Math.min(L, Math.max(s0, s1)) - Math.max(0, Math.min(s0, s1));
      if (ov > 0.01) { found++; warns.push('Pipes ' + (i + 1) + ' and ' + (j + 1) + ' lie on top of each other for ' + Math.round(ov * 1000) + ' mm, so that length is counted twice. Delete one of them.'); }
    }
    Object.keys(lines).forEach(function (k) { if (lines[k].qty < -0.0005) warns.push('The list has a negative quantity for "' + lines[k].desc + '": a part is longer than its pipe.'); });
  }
  function spWarnings() {`);
fs.writeFileSync('src/index.src.html', h);
console.log('ok next1');
