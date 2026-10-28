
  // ---------- steel inspector and panel (spliced after steel.part.js) ----------
  function stInspHtml(it, i) {
    var a = cadOf(it.a), b = cadOf(it.b), s = SSEC[it.s], L = stLen(it), co = function (id, v) { return '<input type="text" inputmode="decimal" id="' + id + '" value="' + mmText(v) + '" autocomplete="off">'; };
    return '<h2>Steel member ' + (i + 1) + '</h2>'
      + '<div class="row"><label class="field">Section<select id="st-isec">' + opts(SSEC_KEYS.map(function (k) { return [k, SSEC[k].name]; }), it.s) + '</select></label></div>'
      + '<div class="grid2"><label class="field">Mark<input type="text" id="st-imk" value="' + esc(it.k) + '" maxlength="20" autocomplete="off"></label><label class="field">Roll, degrees<input type="text" inputmode="numeric" id="st-ir" value="' + it.r + '" autocomplete="off"></label></div>'
      + '<div class="field">Start, mm (X · Y · Z up)<div class="coord">' + co('st-ia0', a[0]) + co('st-ia1', a[1]) + co('st-ia2', a[2]) + '</div></div>'
      + '<div class="field">End, mm<div class="coord">' + co('st-ib0', b[0]) + co('st-ib1', b[1]) + co('st-ib2', b[2]) + '</div></div>'
      + '<div class="grid2"><label class="field">Length, mm<input type="text" inputmode="decimal" id="st-il" value="' + mmText(L) + '" autocomplete="off"></label><label class="field">Keep fixed<select id="st-ik">' + opts([['start', 'The start'], ['end', 'The end'], ['middle', 'The middle']], stLenKeep) + '</select></label></div>'
      + '<div class="row"><label class="field">Members meeting an end that moves<select id="st-ic">' + opts([['0', 'Stay where they are'], ['1', 'Move along with it']], stCarry ? '1' : '0') + '</select></label></div>'
      + '<p>' + (stKgm(s) * L).toFixed(1) + ' kg (' + stKgm(s).toFixed(1) + ' kg/m). Or drag an end handle with the Pencil.</p>'
      + '<div class="field">Move or copy by, mm<div class="coord"><input type="text" inputmode="decimal" id="st-ox" value="0"><input type="text" inputmode="decimal" id="st-oy" value="0"><input type="text" inputmode="decimal" id="st-oz" value="0"></div></div>'
      + '<div class="row"><button id="st-imove">Move</button><button id="st-icopy">Copy</button><button id="st-idel">Delete</button></div>';
  }
  function stOffs2() { var f = function (id) { var v = parseNum($(id).value); return v == null ? 0 : v / 1000; }; return sceneOf([f('sa-ox'), f('sa-oy'), f('sa-oz')]); }
  function stOffs() { var f = function (id) { var v = parseNum($(id).value); return v == null ? 0 : v / 1000; }; return sceneOf([f('st-ox'), f('st-oy'), f('st-oz')]); }
  function stBindInsp() {
  $('insp').addEventListener('change', function (e) {
    var t = e.target; if (!t || !t.id || t.id.indexOf('sa-') !== 0 || !sel || sel.kind !== 'sacc') return;
    var a = model.steel.a[sel.i]; if (!a || /^sa-o[xyz]$/.test(t.id)) return;
    var c = stAccApply(a, t.id.slice(3), t.value); if (!c) { toast('That value is not usable'); showInsp(); return; }
    pushHist(); model.steel.a[sel.i] = c; changed();
  });
  $('insp').addEventListener('click', function (e) {
    var id = e.target && e.target.id; if (!id || id.indexOf('sa-') !== 0 || !sel || sel.kind !== 'sacc') return;
    var a = model.steel.a[sel.i]; if (!a) return;
    if (id === 'sa-del') { removeItem('sacc', sel.i); return; }
    if (id === 'sa-rail') { var n = stRailAround(sel.i); toast(n ? n + ' handrails added' : 'Could not add handrails'); return; }
    if (id === 'sa-move' || id === 'sa-copy') {
      var o = stOffs2(), c = JSON.parse(JSON.stringify(a)), sh = function (P) { return [st3(P[0] + o[0]), st3(P[1] + o[1]), st3(P[2] + o[2])]; };
      if (c.p) c.p = sh(c.p); if (c.a) { c.a = sh(c.a); c.b = sh(c.b); }
      var cc = stCleanAcc(c); if (!cc) return; pushHist();
      if (id === 'sa-copy') { cc.k = ''; model.steel.a.push(cc); sel = { kind: 'sacc', i: model.steel.a.length - 1 }; toast('Copied'); } else model.steel.a[sel.i] = cc;
      changed();
    }
  });
  $('insp').addEventListener('change', function (e) {
    var t = e.target; if (!t || !t.id || t.id.indexOf('st-i') !== 0 || !sel || sel.kind !== 'steel') return;
    var p = model.steel.m[sel.i]; if (!p) return;
    if (t.id === 'st-isec') { pushHist(); p.s = t.value; changed(); }
    else if (t.id === 'st-ik') { stLenKeep = t.value; }
    else if (t.id === 'st-ic') { stCarry = t.value === '1'; }
    else if (t.id === 'st-il') { var ln = parseNum(t.value); if (ln == null || !stSetLen(sel.i, ln, stLenKeep)) { toast('Type a length between 50 and 60000 mm'); showInsp(); } }
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

  var YN = [['1', 'Yes'], ['0', 'No']], DIRS = [[0, '+X'], [90, '+Y'], [180, '−X'], [270, '−Y']];
  function stAccSpec(a) {                                           // [key, label, kind (mm, deg, int, sel, txt), options]
    var gr = GRAT_KEYS.map(function (k) { return [k, GRAT[k].name]; }), rl = Object.keys(RAILS).map(function (k) { return [k, 'CHS ' + k]; }), ch = SSEC_KEYS.filter(function (k) { return SSEC[k].t === 'C'; }).map(function (k) { return [k, SSEC[k].name]; });
    if (a.t === 'g') return [['px', 'Centre X, mm', 'mm'], ['py', 'Centre Y, mm', 'mm'], ['pz', 'Top level, mm', 'mm'], ['w', 'Width, mm', 'mm'], ['d', 'Depth, mm', 'mm'], ['r', 'Turn, degrees', 'deg'], ['s', 'Section', 'sel', gr], ['k', 'Mark', 'txt']];
    if (a.t === 'h') return [['ax', 'Start X, mm', 'mm'], ['ay', 'Start Y, mm', 'mm'], ['az', 'Start level, mm', 'mm'], ['bx', 'End X, mm', 'mm'], ['by', 'End Y, mm', 'mm'], ['bz', 'End level, mm', 'mm'], ['h', 'Height, mm', 'mm'], ['post', 'Post spacing, mm', 'mm'], ['mid', 'Intermediate rails', 'sel', [[0, '0'], [1, '1'], [2, '2']]], ['toe', 'Toe plate', 'sel', YN], ['rs', 'Rail', 'sel', rl], ['k', 'Mark', 'txt']];
    if (a.t === 's') return [['px', 'Foot X, mm', 'mm'], ['py', 'Foot Y, mm', 'mm'], ['pz', 'Foot level, mm', 'mm'], ['dir', 'Climbs toward', 'sel', DIRS], ['H', 'Rise, mm', 'mm'], ['w', 'Width, mm', 'mm'], ['g', 'Going, mm', 'mm'], ['sec', 'Stringers', 'sel', ch], ['tread', 'Treads', 'sel', gr], ['rail', 'Handrails', 'sel', YN], ['rs', 'Rail', 'sel', rl], ['k', 'Mark', 'txt']];
    return [['px', 'Base X, mm', 'mm'], ['py', 'Base Y, mm', 'mm'], ['pz', 'Base level, mm', 'mm'], ['dir', 'Faces', 'sel', DIRS], ['h', 'Height, mm', 'mm'], ['w', 'Width, mm', 'mm'], ['cage', 'Safety cage', 'sel', [['auto', 'Auto, above 3 m'], ['yes', 'Yes'], ['no', 'No']]], ['k', 'Mark', 'txt']];
  }
  function stAccVal(a, key) {
    var m = /^([pab])([xyz])$/.exec(key); if (m) { var P = a[m[1]], i = { x: 0, y: 2, z: 1 }[m[2]]; return mmText(P[i]); }
    var v = a[key]; return key === 'toe' || key === 'rail' ? (v ? '1' : '0') : ['h', 'post', 'w', 'd', 'H', 'g'].indexOf(key) >= 0 && !(key === 'h' && a.t === 'l' && false) ? mmText(v) : v;
  }
  function stAccInspHtml(a, i) {
    var spec = stAccSpec(a), h = '<h2>' + esc(stAccName(a)) + ' ' + (i + 1) + '</h2><div class="grid2">';
    spec.forEach(function (f) {
      var v = stAccVal(a, f[0]);
      h += '<label class="field">' + f[1] + (f[2] === 'sel' ? '<select id="sa-' + f[0] + '">' + opts(f[3], v) + '</select>' : '<input type="text" inputmode="' + (f[2] === 'txt' ? 'text' : 'decimal') + '" id="sa-' + f[0] + '" value="' + esc(v) + '" autocomplete="off">') + '</label>';
    });
    h += '</div>';
    if (a.t === 's') { var n = stStairN(a); h += '<p>' + n + ' risers of ' + Math.round(a.H / n * 1000) + ' mm, ' + (n - 1) + ' treads, run ' + Math.round((n - 1) * a.g * 1000) + ' mm, slope ' + Math.round(Math.atan(a.H / n / a.g) * 180 / Math.PI) + ' degrees.</p>'; }
    if (a.t === 'l') h += '<p>' + (stHasCage(a) ? 'With a safety cage.' : 'No cage.') + '</p>';
    h += '<p>' + stAccKg(a).toFixed(1) + ' kg' + (a.t === 'g' ? ', ' + (a.w * a.d).toFixed(2) + ' m²' : '') + '</p>';
    if (a.t === 'g') h += '<div class="row"><button id="sa-rail">Handrail round it</button></div>';
    h += '<div class="field">Move or copy by, mm<div class="coord"><input type="text" inputmode="decimal" id="sa-ox" value="0"><input type="text" inputmode="decimal" id="sa-oy" value="0"><input type="text" inputmode="decimal" id="sa-oz" value="0"></div></div><div class="row"><button id="sa-move">Move</button><button id="sa-copy">Copy</button><button id="sa-del">Delete</button></div>';
    return h;
  }
  function stAccApply(a, key, raw) {                                // a new copy of accessory a with one field changed, cleaned, or null
    var c = JSON.parse(JSON.stringify(a)), m = /^([pab])([xyz])$/.exec(key);
    if (m) { var v = parseNum(raw); if (v == null) return null; c[m[1]][{ x: 0, y: 2, z: 1 }[m[2]]] = v / 1000; }
    else if (['h', 'post', 'w', 'd', 'H', 'g'].indexOf(key) >= 0) { var u = parseNum(raw); if (u == null) return null; c[key] = u / 1000; }
    else if (key === 'r' || key === 'dir' || key === 'mid') { var n = parseNum(raw); if (n == null) return null; c[key] = n; }
    else if (key === 'toe' || key === 'rail') c[key] = raw === '1';
    else c[key] = raw;
    return stCleanAcc(c);
  }
  var stA = { x: 0, y: 0, z: 0, r: 0 };
  var stPf = { x: 0, y: 0, w: 3000, d: 2000, lvl: 3000, pitch: 1000, leg: 'H150x150', beam: 'H150x75', sec: 'C100x50', grat: 'G32x5', rail: 'all', brace: 'none', mk: 'PF1' };
  var stSn = { x: 0, y: 0, lvl: 1000, width: 1500, dir: 'x', two: 'no', col: 'H150x150', beam: 'H100x50', mk: 'ST1' };
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
    var AC = stAccRows(), AL = model.steel.a;
    if (AL.length) h += '<h2 style="margin-top:14px">Grating, rails, stairs, ladders</h2>' + AC.map(function (r) { return line(esc(r.name) + ' × ' + r.q, r.amt.toFixed(1) + ' ' + r.unit + ', ' + Math.round(r.kg) + ' kg'); }).join('') + AL.map(function (a, i) { return '<div class="row"><button data-stsa="' + i + '" style="flex:1;text-align:left">' + esc(a.k || stAccName(a)) + ' · ' + (a.t === 'g' ? Math.round(a.w * 1000) + '×' + Math.round(a.d * 1000) : a.t === 's' ? 'rise ' + Math.round(a.H * 1000) : a.t === 'l' ? Math.round(a.h * 1000) + ' high' : Math.round(Math.hypot(a.b[0] - a.a[0], a.b[2] - a.a[2]) * 1000) + ' long') + '</button></div>'; }).join('');
    h += '<h2 style="margin-top:14px">Platform</h2><div class="grid2">' + F('Corner X, mm', 'stf-x', stPf.x) + F('Corner Y, mm', 'stf-y', stPf.y) + F('Width (X), mm', 'stf-w', stPf.w) + F('Depth (Y), mm', 'stf-d', stPf.d) + F('Top of grating, mm', 'stf-lvl', stPf.lvl) + F('Secondary beams at most, mm', 'stf-pitch', stPf.pitch) + S('Legs', 'stf-leg', stPf.leg) + S('Perimeter beams', 'stf-beam', stPf.beam) + S('Secondary beams', 'stf-sec', stPf.sec) + O('Grating', 'stf-grat', stPf.grat, GRAT_KEYS.map(function (k) { return [k, GRAT[k].name]; })) + O('Handrail', 'stf-rail', stPf.rail, [['all', 'All round'], ['none', 'None']]) + O('Bracing', 'stf-brace', stPf.brace, [['none', 'None'], ['x', 'X on both ends']]) + F('Mark prefix', 'stf-mk', stPf.mk, 'text') + '</div><div class="row"><button id="stf-go">Build platform</button></div><p class="dim" style="margin:6px 0;font-size:11.5px">A framed deck on four or more legs with beams, one grating panel and a handrail round it. Add a stair or ladder from Parts, Steel, and the Check list says where an edge is left open.</p>';
    h += '<h2 style="margin-top:14px">Pipe stanchion</h2><div class="grid2">' + F('X, mm', 'stn-x', stSn.x) + F('Y, mm', 'stn-y', stSn.y) + F('Top of steel, mm', 'stn-lvl', stSn.lvl) + F('Head beam length, mm', 'stn-width', stSn.width) + O('Head beam along', 'stn-dir', stSn.dir, [['x', 'X'], ['y', 'Y']]) + O('Two legs', 'stn-two', stSn.two, [['no', 'No, a T'], ['yes', 'Yes, a goalpost']]) + S('Column', 'stn-col', stSn.col) + S('Head beam', 'stn-beam', stSn.beam) + F('Mark prefix', 'stn-mk', stSn.mk, 'text') + '</div><div class="row"><button id="stn-go">Build stanchion</button></div>';
    h += '<h2 style="margin-top:14px">Defaults for tapped parts</h2><div class="grid2">' + O('Grating', 'std-gs', stD.gs, GRAT_KEYS.map(function (k) { return [k, GRAT[k].name]; })) + O('Rail pipe', 'std-rs', stD.rs, Object.keys(RAILS).map(function (k) { return [k, 'CHS ' + k]; })) + F('Rail post spacing, mm', 'std-rpost', Math.round(stD.rpost * 1000)) + O('Intermediate rails', 'std-rmid', String(stD.rmid), [['0', '0'], ['1', '1'], ['2', '2']]) + O('Toe plate', 'std-rtoe', stD.rtoe ? '1' : '0', YN) + F('Stair going, mm', 'std-sG', Math.round(stD.sG * 1000)) + O('Stair stringers', 'std-ssec', stD.ssec, SSEC_KEYS.filter(function (k) { return SSEC[k].t === 'C'; }).map(function (k) { return [k, SSEC[k].name]; })) + O('Stair treads', 'std-stread', stD.stread, GRAT_KEYS.map(function (k) { return [k, GRAT[k].name]; })) + O('Ladder cage', 'std-lcage', stD.lcage, [['auto', 'Auto, above 3 m'], ['yes', 'Yes'], ['no', 'No']]) + '</div>';
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
    if (t.id && t.id.indexOf('stf-') === 0) { var fk = t.id.slice(4); stPf[fk] = typeof stPf[fk] === 'number' ? stNum(parseNum(t.value), stPf[fk]) : t.value; return; }
    if (t.id && t.id.indexOf('stn-') === 0) { var nk = t.id.slice(4); stSn[nk] = typeof stSn[nk] === 'number' ? stNum(parseNum(t.value), stSn[nk]) : t.value; return; }
    if (t.id && t.id.indexOf('std-') === 0) { var dk = t.id.slice(4), dv = t.value; if (dk === 'rtoe') stD.rtoe = dv === '1'; else if (dk === 'rmid') stD.rmid = Number(dv); else if (['rpost', 'sG'].indexOf(dk) >= 0) { var q0 = parseNum(dv); if (q0 != null) stD[dk] = Math.max(0.2, Math.min(2, q0 / 1000)); } else stD[dk] = dv; return; }
    if (t.id && t.id.indexOf('sta-') === 0) { var q = t.id.slice(4), v = parseNum(t.value); stA[q] = v == null ? stA[q] : v; return; }
    if (t.id === 'stv-cut') { stCut = t.value === '' ? null : Number(t.value); return; }
    if (t.getAttribute && t.getAttribute('data-stcl') != null) { var ei = Number(t.getAttribute('data-stcl')), cm = parseNum(t.value), E = model.equip[ei]; if (!E) return; pushHist(); if (cm != null && cm > 0 && cm <= 20000) E.cl = st3(cm / 1000); else delete E.cl; changed(); }
  });
  $('steel').addEventListener('click', function (e) {
    var b = e.target && e.target.closest ? e.target.closest('button') : null; if (!b) return;
    if (b.getAttribute('data-steq') != null) { if (tool !== 'sel') setTool('sel'); sel = { kind: 'equip', i: Number(b.getAttribute('data-steq')) }; msel = {}; rebuild(); updateUi(); return; }
    if (b.getAttribute('data-stsa') != null) { if (tool !== 'sel') setTool('sel'); sel = { kind: 'sacc', i: Number(b.getAttribute('data-stsa')) }; msel = {}; rebuild(); updateUi(); return; }
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
    else if (id === 'stf-go') { var nf2 = stPlatform(stPf); toast(nf2 ? nf2 + ' parts added' : 'Check the platform sizes'); fit(); }
    else if (id === 'stn-go') { var ns2 = stStanchion(stSn); toast(ns2 ? ns2 + ' members added' : 'Check the stanchion sizes'); }
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
  })();
  }
  function stInit() { stBindInsp(); stBind(); stBindBar(); }
  var ST_KINDS = { col: 'Column', beam: 'Beam', grating: 'Grating', rail: 'Handrail', stair: 'Stair', ladder: 'Ladder' };
  function stSyncBar() {                                            // which controls of the Steel context bar apply to the kind in use
    var mem = stk === 'col' || stk === 'beam', f = { grating: ['W, mm', 'D, mm'], rail: ['Height, mm', ''], stair: ['Rise, mm', 'Width, mm'], ladder: ['Height, mm', 'Width, mm'] }[stk];
    $('st-sec').hidden = !mem; $('st-sec').value = stSec; $('st-h').hidden = stk !== 'col';
    $('st-p1').hidden = !f; $('st-p2').hidden = !f || !f[1]; $('st-dir').hidden = stk !== 'stair' && stk !== 'ladder';
    if (f) {
      var v = { grating: [stD.gw, stD.gd], rail: [stD.rh, 0], stair: [stD.sH, stD.sW], ladder: [stD.lh, stD.lw] }[stk];
      $('st-p1').placeholder = f[0]; $('st-p2').placeholder = f[1]; $('st-p1').setAttribute('aria-label', f[0]); $('st-p2').setAttribute('aria-label', f[1]);
      if (document.activeElement !== $('st-p1')) $('st-p1').value = String(Math.round(v[0] * 1000)); if (document.activeElement !== $('st-p2')) $('st-p2').value = String(Math.round(v[1] * 1000));
    }
    var dv = stk === 'stair' ? stD.sdir : stD.ldir; $('st-dir').textContent = (stk === 'stair' ? 'Climbs ' : 'Faces ') + ['+X', '+Y', '−X', '−Y'][(dv / 90) % 4];
  }
  function stHint() {
    return { col: 'Tap the floor or the end of a member to stand a column. Section and height are below.', beam: cursor ? 'Aim along an axis and tap, as with pipe: up the screen is Z. Type a length and press the arrow. X, Y, Z lock the axis, the dot ends the run.' : 'Tap where the beam starts: the floor, or the end or middle of a member. Start at types a position.',
      grating: 'Tap where the grating panel goes (its centre). Size is below, the level is the working height. Corners snap for the next one.', rail: cursor ? 'Aim along an axis and tap where the handrail ends, or type a length.' : 'Tap where the handrail starts: a grating corner snaps.',
      stair: 'Tap the foot of the stair. It climbs the way the button says, to the rise below; the top edge is where the platform starts.', ladder: 'Tap the foot of the ladder. A cage is added above about 3 m.' }[stk];
  }
  function stBindBar() {
    $('st-p1').onchange = function () { var v = parseNum(this.value); if (v == null || v < 100 || v > 30000) { stSyncBar(); return; } v /= 1000; if (stk === 'grating') stD.gw = v; else if (stk === 'rail') stD.rh = Math.min(1.4, Math.max(0.9, v)); else if (stk === 'stair') stD.sH = v; else if (stk === 'ladder') stD.lh = v; stSyncBar(); };
    $('st-p2').onchange = function () { var v = parseNum(this.value); if (v == null || v < 100 || v > 30000) { stSyncBar(); return; } v /= 1000; if (stk === 'grating') stD.gd = v; else if (stk === 'stair') stD.sW = Math.min(3, Math.max(0.5, v)); else if (stk === 'ladder') stD.lw = Math.min(0.8, Math.max(0.4, v)); stSyncBar(); };
    $('st-dir').onclick = function () { if (stk === 'stair') stD.sdir = (stD.sdir + 90) % 360; else stD.ldir = (stD.ldir + 90) % 360; stSyncBar(); };
  }
  // ---------- several steel parts at once: box select, Multi, move, copy, section, delete ----------
  function isMk(k) { return !!MK[k] || k === 'steel' || k === 'sacc'; }
  function stMselOk(k, i) { return k === 'steel' ? !!model.steel.m[i] : k === 'sacc' ? !!model.steel.a[i] : false; }
  function stMselIdx(kind) { return Object.keys(msel).filter(function (k) { return k.indexOf(kind + ':') === 0; }).map(function (k) { return +k.split(':')[1]; }).filter(function (i) { return stMselOk(kind, i); }); }
  function stMselAny() { return stMselIdx('steel').length + stMselIdx('sacc').length > 0; }
  function stBoxSelect(inside) {
    model.steel.m.forEach(function (p, i) { if ((inside(p.a) && inside(p.b)) || inside([(p.a[0] + p.b[0]) / 2, (p.a[1] + p.b[1]) / 2, (p.a[2] + p.b[2]) / 2])) msel['steel:' + i] = 1; });
    model.steel.a.forEach(function (a, i) { if (inside(a.p || [(a.a[0] + a.b[0]) / 2, (a.a[1] + a.b[1]) / 2, (a.a[2] + a.b[2]) / 2])) msel['sacc:' + i] = 1; });
  }
  function stMultiRows(cnt) { return cnt.steel ? '<div class="row"><label class="field">Section of the selected steel<select id="m-ss"><option value="">Change…</option>' + opts(SSEC_KEYS.map(function (k) { return [k, SSEC[k].name]; }), '') + '</select></label></div>' : ''; }
  function stMultiBind() {
    if ($('m-ss')) $('m-ss').onchange = function () {
      var v = this.value, ids = stMselIdx('steel'); if (!OWN(SSEC, v) || !ids.length) return;
      pushHist(); ids.forEach(function (i) { model.steel.m[i].s = v; }); changed(); toast(ids.length + ' member' + (ids.length === 1 ? '' : 's') + ' now ' + SSEC[v].name);
    };
  }
  function stMselDelete() { var m = stMselIdx('steel'), a = stMselIdx('sacc'); if (!m.length && !a.length) return 0; var ms = {}, as = {}; m.forEach(function (i) { ms[i] = 1; }); a.forEach(function (i) { as[i] = 1; }); model.steel.m = model.steel.m.filter(function (p, i) { return !ms[i]; }); model.steel.a = model.steel.a.filter(function (p, i) { return !as[i]; }); return m.length + a.length; }
  function stMselGo(copies, o, n) {                                 // move the picked steel by o (CAD mm), or make n stepped copies; the copies become the selection
    var ms = stMselIdx('steel'), as = stMselIdx('sacc'); if (!ms.length && !as.length) return false;
    if (copies && !o[0] && !o[1] && !o[2]) { toast('Type an offset for the copy'); return true; }
    var d = sceneOf([o[0] / 1000, o[1] / 1000, o[2] / 1000]), sh = function (P, k) { return [st3(P[0] + d[0] * k), st3(P[1] + d[1] * k), st3(P[2] + d[2] * k)]; };
    var low = lowY(), bad = ms.some(function (i) { var p = model.steel.m[i]; return Math.min(p.a[1], p.b[1]) + Math.min(d[1] * (copies ? n : 1), 0) < low - 1e-9; });
    if (bad) { toast('That takes steel under the floor'); return true; }
    pushHist();
    var plain1 = function (x) { return JSON.parse(JSON.stringify(x)); };
    if (!copies) {
      ms.forEach(function (i) { var p = model.steel.m[i]; p.a = sh(p.a, 1); p.b = sh(p.b, 1); });
      as.forEach(function (i) { var q = plain1(model.steel.a[i]); if (q.p) q.p = sh(q.p, 1); if (q.a) { q.a = sh(q.a, 1); q.b = sh(q.b, 1); } var c = stCleanAcc(q); if (c) model.steel.a[i] = c; });
      changed(); toast('Moved'); return true;
    }
    Object.keys(msel).forEach(function (k) { if (k.indexOf('steel:') === 0 || k.indexOf('sacc:') === 0) delete msel[k]; });
    for (var c = 1; c <= n; c++) {
      ms.forEach(function (i) { var q = plain1(model.steel.m[i]); q.a = sh(q.a, c); q.b = sh(q.b, c); q.k = ''; model.steel.m.push(q); if (c === n) msel['steel:' + (model.steel.m.length - 1)] = 1; });
      as.forEach(function (i) { var q = plain1(model.steel.a[i]); if (q.p) q.p = sh(q.p, c); if (q.a) { q.a = sh(q.a, c); q.b = sh(q.b, c); } q.k = ''; var cc = stCleanAcc(q); if (cc) { model.steel.a.push(cc); if (c === n) msel['sacc:' + (model.steel.a.length - 1)] = 1; } });
    }
    sel = null; changed(); toast((ms.length + as.length) * n + ' copied'); return true;
  }
  function stHooks() {
    return { secs: SSEC, kgm: stKgm, area: stArea, paint: stPaint, poly: stPoly, rows: stRows, totals: stTotals, csv: stCsv, add: stAdd, rack: stRack, frame: stFrame, plates: stPlates, plateRows: stPlateRows, boltRows: stBoltRows, sheet: stSheet, clean: stClean,
      setTool: setTool, foot: stFoot, loose: stLoose, through: stThrough, pipeClashes: stPipeClashes, move: stMove, tap: stTap, setKind: function (k) { stk = k; }, setSec: function (s) { stSec = s; }, setColH: function (h) { stColH = h; }, run: function () { return cursor; }, boxSelect: stBoxSelect, mselGo: stMselGo, mselIdx: stMselIdx, ext: stCalcExt, setLen: stSetLen, stretch: stStretch, addTyped: stAddTyped, segUndo: stSegUndo, setCarry: function (v) { stCarry = !!v; }, alignEnds: alignEnds, accAdd: stAccAdd, accRows: stAccRows, accParts: stAccParts, accKg: stAccKg, openEdges: stOpenEdges, railAround: stRailAround, platform: stPlatform, stanchion: stStanchion, defaults: stD, accInspHtml: stAccInspHtml, accApply: stAccApply, grat: GRAT, hint: stHint, groups: stGroups, groupMove: stGroupMove, groupDelete: stGroupDelete, panel: stPanel, inspHtml: stInspHtml };
  }
