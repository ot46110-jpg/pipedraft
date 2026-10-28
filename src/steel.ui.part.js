
  // ---------- steel inspector and panel (spliced after steel.part.js) ----------
  function stInspHtml(it, i) {
    var a = cadOf(it.a), b = cadOf(it.b), s = SSEC[it.s], L = stLen(it), co = function (id, v) { return '<input type="text" inputmode="decimal" id="' + id + '" value="' + mmText(v) + '" autocomplete="off">'; };
    return '<h2>Steel member ' + (i + 1) + '</h2>'
      + '<div class="row"><label class="field">Section<select id="st-isec">' + opts(SSEC_KEYS.map(function (k) { return [k, SSEC[k].name]; }), it.s) + '</select></label></div>'
      + '<div class="grid2"><label class="field">Mark<input type="text" id="st-imk" value="' + esc(it.k) + '" maxlength="20" autocomplete="off"></label><label class="field">Roll, degrees<input type="text" inputmode="numeric" id="st-ir" value="' + it.r + '" autocomplete="off"></label></div>'
      + '<div class="field">Start, mm (X · Y · Z up)<div class="coord">' + co('st-ia0', a[0]) + co('st-ia1', a[1]) + co('st-ia2', a[2]) + '</div></div>'
      + '<div class="field">End, mm<div class="coord">' + co('st-ib0', b[0]) + co('st-ib1', b[1]) + co('st-ib2', b[2]) + '</div></div>'
      + '<p>Length ' + Math.round(L * 1000) + ' mm, ' + (stKgm(s) * L).toFixed(1) + ' kg (' + stKgm(s).toFixed(1) + ' kg/m)</p>'
      + '<div class="field">Move or copy by, mm<div class="coord"><input type="text" inputmode="decimal" id="st-ox" value="0"><input type="text" inputmode="decimal" id="st-oy" value="0"><input type="text" inputmode="decimal" id="st-oz" value="0"></div></div>'
      + '<div class="row"><button id="st-imove">Move</button><button id="st-icopy">Copy</button><button id="st-idel">Delete</button></div>';
  }
  function stOffs() { var f = function (id) { var v = parseNum($(id).value); return v == null ? 0 : v / 1000; }; return sceneOf([f('st-ox'), f('st-oy'), f('st-oz')]); }
  function stBindInsp() {
  $('insp').addEventListener('change', function (e) {
    var t = e.target; if (!t || !t.id || t.id.indexOf('st-i') !== 0 || !sel || sel.kind !== 'steel') return;
    var p = model.steel.m[sel.i]; if (!p) return;
    if (t.id === 'st-isec') { pushHist(); p.s = t.value; changed(); }
    else if (t.id === 'st-imk') { pushHist(); p.k = t.value.slice(0, 20); changed(); }
    else if (t.id === 'st-ir') { var r = parseNum(t.value); if (r == null) { showInsp(); return; } pushHist(); p.r = ((Math.round(r) % 360) + 360) % 360; changed(); }
    else if (/^st-i[ab][012]$/.test(t.id)) {
      var rd3 = function (k) { return [0, 1, 2].map(function (j) { var v = parseNum($('st-i' + k + j).value); return v == null ? null : v / 1000; }); }, A = rd3('a'), B = rd3('b');
      if (A.concat(B).some(function (v) { return v == null || Math.abs(v) > 5000; })) { toast('That is not a position'); showInsp(); return; }
      pushHist(); p.a = sceneOf(A).map(st3); p.b = sceneOf(B).map(st3); changed();
    }
  });
  $('insp').addEventListener('click', function (e) {
    var id = e.target && e.target.id; if (!id || id.indexOf('st-i') !== 0 || !sel || sel.kind !== 'steel') return;
    if (id === 'st-idel') removeItem('steel', sel.i);
    else if (id === 'st-imove') stMove([sel.i], stOffs(), false);
    else if (id === 'st-icopy') { var n0 = model.steel.m.length; stMove([sel.i], stOffs(), true); sel = { kind: 'steel', i: n0 }; changed(); toast('Copied'); }
  });
  }

  var stA = { x: 0, y: 0, z: 0, r: 0 };
  function stPanel() {
    var el = $('steel'); if (el.hidden) return;
    var T0 = stTotals(), R = stRows(), PR = stPlateRows(), BR = stBoltRows(), line = function (a, b) { return '<div class="row" style="justify-content:space-between"><span>' + a + '</span><span>' + b + '</span></div>'; };
    var F = function (l, id, v, t) { return '<label class="field">' + l + '<input type="text" inputmode="' + (t || 'decimal') + '" id="' + id + '" value="' + esc(v) + '" autocomplete="off"></label>'; };
    var S = function (l, id, cur) { return '<label class="field">' + l + '<select id="' + id + '">' + opts(SSEC_KEYS.map(function (k) { return [k, SSEC[k].name]; }), cur) + '</select></label>'; };
    var O = function (l, id, cur, list) { return '<label class="field">' + l + '<select id="' + id + '">' + opts(list, cur) + '</select></label>'; };
    var h = '<h2>Steel</h2>';
    h += '<div class="row" style="justify-content:space-between"><b>' + T0.n + ' members' + (PR.length ? ', ' + model.steel.pl.length + ' plates' : '') + '</b><b>' + Math.round(T0.kg) + ' kg</b></div>';
    h += R.map(function (r) { return line(esc(r.name) + ' × ' + r.q, r.L.toFixed(1) + ' m, ' + Math.round(r.kg) + ' kg'); }).join('');
    h += PR.map(function (r) { return line(esc(r.name) + ' × ' + r.q, Math.round(r.kg) + ' kg'); }).join('') + (BR.length ? line('Anchor bolts', BR.map(function (r) { return r.q + ' × ' + r.bolt; }).join(', ')) : '');
    if (T0.n) h += '<p class="dim" style="margin:6px 0;font-size:11.5px">Paint area about ' + T0.paint.toFixed(1) + ' m². Weights come from the section shape at ' + ST_RHO + ' kg/m³, without bolts or welds.</p><div class="row"><button id="st-csv">Export steel list (.csv)</button></div>';
    var GR = stGroups(), gk = Object.keys(GR);
    if (gk.length) h += '<h2 style="margin-top:14px">Groups</h2><div class="field">Move or copy a group by, mm<div class="coord"><input type="text" inputmode="decimal" id="stg-x" value="0"><input type="text" inputmode="decimal" id="stg-y" value="0"><input type="text" inputmode="decimal" id="stg-z" value="0"></div></div>' + gk.map(function (x) { return '<div class="row" style="justify-content:space-between"><span>' + esc(x) + ' · ' + GR[x].length + '</span><span><button data-stgm="' + esc(x) + '">Move</button> <button data-stgc="' + esc(x) + '">Copy</button> <button data-stgd="' + esc(x) + '">Delete</button></span></div>'; }).join('') + '<p class="dim" style="margin:6px 0;font-size:11.5px">A group is every member with the same mark before the first dash, such as a rack (PR1) or a frame (E-1 has its own tag). Equipment does not move with its frame.</p>';
    h += '<h2 style="margin-top:14px">Equipment layout</h2>';
    h += model.equip.map(function (e, i) {
      return '<div class="row" style="justify-content:space-between"><button data-steq="' + i + '" style="flex:1;text-align:left">' + esc(stTag(i)) + ' · ' + esc(eqLabel(e.k)) + '<small> ' + Math.round(e.p[0] * 1000) + ', ' + Math.round(e.p[2] * 1000) + '</small></button><input type="text" inputmode="decimal" data-stcl="' + i + '" value="' + Math.round(stClear(e) * 1000) + '" style="width:64px" aria-label="Maintenance clearance, mm" title="Maintenance clearance, mm"><button data-stfr="' + i + '">Frame</button></div>';
    }).join('') || '<p class="dim" style="margin:0;font-size:12px">No equipment yet. Pick one under Parts, Equipment.</p>';
    h += '<div class="grid2">' + F('Place ' + esc(eqLabel(eqk)) + ' at X, mm', 'sta-x', stA.x) + F('Y, mm', 'sta-y', stA.y) + F('Base level, mm', 'sta-z', stA.z) + F('Turn, degrees', 'sta-r', stA.r) + '</div><div class="row"><button id="sta-go">Place equipment</button></div>';
    h += '<p class="dim" style="margin:6px 0;font-size:11.5px">Frame builds four legs and a beam ring under that equipment at the top of steel below and sets the equipment on top. The box beside each name is its maintenance clearance in mm, drawn as a dashed outline.</p>';
    h += '<div class="grid2">' + F('Frame top of steel, mm', 'stp-fh', stP.fh) + F('Set in, mm', 'stp-finset', stP.finset) + S('Legs', 'stp-fleg', stP.fleg) + S('Beams', 'stp-fbeam', stP.fbeam) + O('Bracing', 'stp-fbrace', stP.fbrace, [['none', 'None'], ['x', 'X on every side']]) + '</div>';
    h += '<h2 style="margin-top:14px">Pipe rack</h2><div class="grid2">' + F('Start X, mm', 'stp-x', stP.x) + F('Start Y, mm', 'stp-y', stP.y) + O('Runs along', 'stp-dir', stP.dir, [['x', 'X'], ['y', 'Y']]) + F('Bays', 'stp-bays', stP.bays, 'numeric') + F('Bay length, mm', 'stp-bay', stP.bay) + F('Width, mm', 'stp-w', stP.w) + F('Tier levels, top of steel, mm', 'stp-tiers', stP.tiers, 'text') + O('Middle column line', 'stp-mid', stP.mid, [['no', 'No'], ['yes', 'Yes']]) + S('Columns', 'stp-col', stP.col) + S('Cross beams', 'stp-beam', stP.beam) + S('Struts', 'stp-strut', stP.strut) + S('Bracing', 'stp-brace', stP.brace) + O('Bracing in', 'stp-bracing', stP.bracing, [['end', 'End bays'], ['all', 'Every bay'], ['none', 'None']]) + F('Mark prefix', 'stp-mk', stP.mk, 'text') + '</div><div class="row"><button id="stp-go">Build pipe rack</button></div>';
    h += '<h2 style="margin-top:14px">Base plates</h2><div class="grid2">' + F('Thickness, mm', 'stp-pt', stP.pt) + F('Overhang, mm', 'stp-pove', stP.pove) + O('Anchor bolt', 'stp-pbolt', stP.pbolt, Object.keys(ST_BOLTS).map(function (k) { return [k, k]; })) + O('Bolts each', 'stp-pn', stP.pn, [['4', '4'], ['6', '6'], ['8', '8']]) + '</div><div class="row"><button id="stpl-go">Add under every column</button><button id="stpl-clr">Remove</button></div>';
    h += '<h2 style="margin-top:14px">Drawing</h2><div class="row"><button id="stv-plan" aria-pressed="' + (stView === 'plan') + '">Plan</button><button id="stv-front" aria-pressed="' + (stView === 'front') + '">Front</button><button id="stv-side" aria-pressed="' + (stView === 'side') + '">Side</button><button id="stv-lab" aria-pressed="' + stLab + '">Labels</button></div>';
    var cl = stCutList(); if (stCut != null && cl.indexOf(stCut) < 0) stCut = null;
    if (stView !== 'plan') h += '<div class="row"><label class="field">Section on a frame line<select id="stv-cut"><option value="">Whole</option>' + cl.map(function (v) { return '<option value="' + v + '"' + (v === stCut ? ' selected' : '') + '>' + (stView === 'side' ? 'X' : 'Y') + ' = ' + Math.round(v * 1000) + '</option>'; }).join('') + '</select></label></div>';
    h += '<div class="row"><button id="stv-go">Open the drawing</button></div>';
    var keep = document.activeElement && document.activeElement.id, sc0 = el.scrollTop;
    el.innerHTML = h; el.scrollTop = sc0;
    if (keep && keep.indexOf('st') === 0 && $(keep)) { try { $(keep).focus(); } catch (x) {} }
  }
  function stBind() {
  $('steel').addEventListener('change', function (e) {
    var t = e.target; if (!t) return;
    if (t.id && t.id.indexOf('stp-') === 0) { var k = t.id.slice(4); stP[k] = typeof stP[k] === 'number' ? stNum(parseNum(t.value), stP[k]) : t.value; return; }
    if (t.id && t.id.indexOf('sta-') === 0) { var q = t.id.slice(4), v = parseNum(t.value); stA[q] = v == null ? stA[q] : v; return; }
    if (t.id === 'stv-cut') { stCut = t.value === '' ? null : Number(t.value); return; }
    if (t.getAttribute && t.getAttribute('data-stcl') != null) { var ei = Number(t.getAttribute('data-stcl')), cm = parseNum(t.value), E = model.equip[ei]; if (!E) return; pushHist(); if (cm != null && cm > 0 && cm <= 20000) E.cl = st3(cm / 1000); else delete E.cl; changed(); }
  });
  $('steel').addEventListener('click', function (e) {
    var b = e.target && e.target.closest ? e.target.closest('button') : null; if (!b) return;
    if (b.getAttribute('data-steq') != null) { if (tool !== 'sel') setTool('sel'); sel = { kind: 'equip', i: Number(b.getAttribute('data-steq')) }; msel = {}; rebuild(); updateUi(); return; }
    if (b.getAttribute('data-stfr') != null) { var nf = stFrame(Number(b.getAttribute('data-stfr'))); if (nf) toast(nf + ' members added'); return; }
    var gm = b.getAttribute('data-stgm'), gc = b.getAttribute('data-stgc'), gd = b.getAttribute('data-stgd');
    if (gm != null || gc != null || gd != null) {
      var go = function (id) { var v = parseNum($(id).value); return v == null ? 0 : v / 1000; }, off = sceneOf([go('stg-x'), go('stg-y'), go('stg-z')]);
      if (gd != null) { var nd = stGroupDelete(gd); toast(nd + ' members deleted'); } else if (gm != null) { stGroupMove(gm, off, false); toast('Moved'); } else { var nc = stGroupMove(gc, off, true); toast(nc + ' members copied'); }
      return;
    }
    var id = b.id;
    if (id === 'st-csv') saveBlob(fname('steel-list', 'csv'), new Blob([stCsv()], { type: 'text/csv' }));
    else if (id === 'stp-go') { var nr = stRack(); if (nr) { toast(nr + ' members added'); fit(); } else toast('Check the rack sizes and levels'); }
    else if (id === 'stpl-go') { var np = stPlates({ t: stP.pt, ove: stP.pove, bolt: stP.pbolt, n: Number(stP.pn) }); toast(np ? np + ' plates added' : 'No column stands on the floor, or the sizes are out of range'); }
    else if (id === 'stpl-clr') { pushHist(); model.steel.pl = []; changed(); }
    else if (id === 'sta-go') {
      if (!eqDef(eqk) || (isCu(eqk) && !CEQ[eqk].lib)) { toast('That equipment is not in the library any more'); return; }
      pushHist(); model.equip.push({ k: eqk, p: sceneOf([stA.x / 1000, stA.y / 1000, stA.z / 1000]), r: ((stA.r / 90) % 4 + 4) % 4 }); changed();
    }
    else if (id === 'stv-plan' || id === 'stv-front' || id === 'stv-side') { stView = id.slice(4); stPanel(); stShowSheet(); }
    else if (id === 'stv-lab') { stLab = !stLab; stPanel(); }
    else if (id === 'stv-go') stShowSheet();
  });
  $('stBtn').onclick = function () { $('more').hidden = true; $('steel').hidden = !$('steel').hidden; stPanel(); updateUi(); };
  $('f-steel').onclick = function () { saveBlob(fname('steel-list', 'csv'), new Blob([stCsv()], { type: 'text/csv' })); };
  $('stDrawBtn').onclick = function () { $('more').hidden = true; stView = 'plan'; stShowSheet(); };

  // ---------- the Steel tool: context bar and hooks ----------
  (function () {
    $('st-sec').innerHTML = opts(SSEC_KEYS.map(function (k) { return [k, SSEC[k].name]; }), stSec);
    $('st-sec').onchange = function () { stSec = this.value; };
    $('st-h').onchange = function () { var v = parseNum(this.value); if (v != null && v >= 100 && v <= 60000) stColH = v / 1000; this.value = String(Math.round(stColH * 1000)); };
    $('st-h').value = String(Math.round(stColH * 1000));
    ['auto', 'free', 'x', 'y'].forEach(function (a) { $('sta-' + a).onclick = function () { stAx = a; updateUi(); }; });
    $('st-fin').onclick = function () { stRun = null; ghostLine.visible = marker.visible = false; updateUi(); };
  })();
  }
  function stInit() { stBindInsp(); stBind(); }
  function stHooks() {
    return { secs: SSEC, kgm: stKgm, area: stArea, paint: stPaint, poly: stPoly, rows: stRows, totals: stTotals, csv: stCsv, add: stAdd, rack: stRack, frame: stFrame, plates: stPlates, plateRows: stPlateRows, boltRows: stBoltRows, sheet: stSheet, clean: stClean,
      setTool: setTool, foot: stFoot, loose: stLoose, through: stThrough, pipeClashes: stPipeClashes, move: stMove, tap: stTap, setKind: function (k) { stk = k; }, setSec: function (s) { stSec = s; }, setColH: function (h) { stColH = h; }, run: function () { return stRun; }, groups: stGroups, groupMove: stGroupMove, groupDelete: stGroupDelete, panel: stPanel, inspHtml: stInspHtml };
  }
