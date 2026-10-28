
  // ---------- steel accessories: grating, handrail, stair, ladder (spliced after steel.part.js) ----------
  // model.steel.a: [{t: 'g' grating panel | 'h' handrail | 's' stair | 'l' ladder, ...}], positions in model metres [x, up, z].
  // Every figure here is a typical value; check the standard that applies to the site (EN ISO 14122, OSHA 1910) before drawing for construction.
  var GRAT = {                                                      // grating by bearing bar (height x thickness at 30 mm pitch) and chequer plate by thickness
    G25x3: { name: 'Grating 25x3', h: 25, t: 3, pitch: 30 }, G32x3: { name: 'Grating 32x3', h: 32, t: 3, pitch: 30 }, G32x5: { name: 'Grating 32x5', h: 32, t: 5, pitch: 30 }, G40x5: { name: 'Grating 40x5', h: 40, t: 5, pitch: 30 },
    CP4: { name: 'Chequer plate 4 mm', plate: 4 }, CP6: { name: 'Chequer plate 6 mm', plate: 6 }, CP8: { name: 'Chequer plate 8 mm', plate: 8 }
  };
  var GRAT_KEYS = Object.keys(GRAT);
  function stGratKgm2(k) { var g = GRAT[k]; return g.plate ? g.plate * ST_RHO / 1000 * 1.1 : (1000 / g.pitch) * (g.h / 1000) * (g.t / 1000) * ST_RHO + 10 * 5e-3 * 5e-3 * ST_RHO; }   // bearing bars plus twisted cross bars at 100 mm; chequer pattern adds about 10 percent
  function stGratTh(k) { var g = GRAT[k]; return (g.plate ? g.plate : g.h) / 1000; }
  var RAILS = { '42.4x2.6': { od: 42.4, t: 2.6 }, '48.3x3.2': { od: 48.3, t: 3.2 } };
  function stRailKgm(k) { var r = RAILS[k]; return Math.PI * (r.od - r.t) * r.t * ST_RHO * 1e-6; }
  var ST_TOE = { w: 0.005, h: 0.1 };                                 // toe plate 100 x 5
  var ST_DIRS = [[1, 0], [0, 1], [-1, 0], [0, -1]];
  function stDirV(d) { return ST_DIRS[((Math.round(d / 90) % 4) + 4) % 4]; }
  function stClamp(v, lo, hi, d) { v = stNum(v, d); return Math.max(lo, Math.min(hi, v)); }
  function stCleanAcc(q) {
    if (!q || typeof q !== 'object') return null;
    var k = String(q.k || '').slice(0, 20), o;
    if (q.t === 'g') {
      var p = stPt(q.p); if (!p || !OWN(GRAT, q.s)) return null;
      var gw = st3(stClamp(q.w, 0.2, 30, 1)), gd = st3(stClamp(q.d, 0.2, 30, 1));
      return { t: 'g', p: p, w: gw, d: gd, r: ((Math.round(stNum(q.r, 0)) % 360) + 360) % 360, s: q.s, k: k, o: stCleanHoles(q.o, gw, gd) };
    }
    if (q.t === 'h') {
      var a = stPt(q.a), b = stPt(q.b); if (!a || !b || !OWN(RAILS, q.rs) || Math.hypot(b[0] - a[0], b[1] - a[1], b[2] - a[2]) < 0.01) return null;
      return { t: 'h', a: a, b: b, h: st3(stClamp(q.h, 0.9, 1.4, 1.1)), post: st3(stClamp(q.post, 0.5, 2, 1.2)), mid: [0, 1, 2].indexOf(q.mid) >= 0 ? q.mid : 1, toe: q.toe !== false, rs: q.rs, k: k };
    }
    if (q.t === 's') {
      var ps = stPt(q.p); if (!ps || !OWN(SSEC, q.sec) || !OWN(GRAT, q.tread) || !OWN(RAILS, q.rs)) return null;
      return { t: 's', p: ps, dir: ((Math.round(stNum(q.dir, 0) / 90) % 4) + 4) % 4 * 90, H: st3(stClamp(q.H, 0.3, 8, 3)), w: st3(stClamp(q.w, 0.5, 3, 0.9)), g: st3(stClamp(q.g, 0.18, 0.4, 0.25)), sec: q.sec, tread: q.tread, rail: q.rail !== false, rs: q.rs, k: k };
    }
    if (q.t === 'l') {
      var pl = stPt(q.p); if (!pl) return null;
      return { t: 'l', p: pl, dir: ((Math.round(stNum(q.dir, 0) / 90) % 4) + 4) % 4 * 90, h: st3(stClamp(q.h, 0.5, 15, 3)), w: st3(stClamp(q.w, 0.4, 0.8, 0.5)), cage: ['auto', 'yes', 'no'].indexOf(q.cage) >= 0 ? q.cage : 'auto', k: k };
    }
    return null;
  }
  function stCleanHoles(list, w, d) {                              // holes in a grating panel, in its own frame: x along the width, z along the depth, from the centre
    var out = [];
    (Array.isArray(list) ? list : []).slice(0, 40).forEach(function (h) {
      if (!h || typeof h !== 'object') return; var x = stNum(h.x, NaN), z = stNum(h.z, NaN); if (!isFinite(x) || !isFinite(z) || Math.abs(x) > w / 2 + 0.5 || Math.abs(z) > d / 2 + 0.5) return;
      var o = { k: h.k === 'r' ? 'r' : 'c', x: st3(x), z: st3(z), kick: h.kick !== false, src: h.src === 'auto' ? 'auto' : '' };
      if (o.k === 'c') o.d = st3(stClamp(h.d, 0.03, 5, 0.2)); else { o.w = st3(stClamp(h.w, 0.03, 8, 0.3)); o.d = st3(stClamp(h.d, 0.03, 8, 0.3)); o.a = ((Math.round(stNum(h.a, 0)) % 360) + 360) % 360; }
      out.push(o);
    });
    return out;
  }
  function stHoleArea(o) { return o.k === 'c' ? Math.PI * o.d * o.d / 4 : o.w * o.d; }
  function stHoleW(cx, cz, rdeg, o) {                              // a hole in plan: its centre and corners (or just the centre and radius) in model coordinates, for a panel centred on cx, cz turned rdeg
    var t = rdeg * Math.PI / 180, c = Math.cos(t), s = Math.sin(t), W = function (x, z) { return [cx + x * c + z * s, cz - x * s + z * c]; }, out = { c: W(o.x, o.z) };
    if (o.k === 'c') { out.r = o.d / 2; return out; }
    var a = (o.a || 0) * Math.PI / 180, ca = Math.cos(a), sa = Math.sin(a);
    out.pts = [[-1, -1], [1, -1], [1, 1], [-1, 1]].map(function (q) { var lx = q[0] * o.w / 2, lz = q[1] * o.d / 2; return W(o.x + lx * ca + lz * sa, o.z - lx * sa + lz * ca); });
    return out;
  }
  function stAccName(a) { return a.t === 'g' ? GRAT[a.s].name : a.t === 'h' ? 'Handrail' : a.t === 's' ? 'Stair' : 'Ladder'; }
  function stHasCage(a) { return a.cage === 'yes' || (a.cage === 'auto' && a.h > 3); }
  function stStairN(a) { return Math.max(2, Math.ceil(a.H / 0.2 - 1e-9)); }

  // ---------- geometry: every accessory is a few primitives ----------
  // box {c, w, h, d, r deg}, cyl {a, b, rad}, bar {a, b, w, h} (w across, h up), mem {a, b, s, r} (a section member), ring {c, rad, tube}
  function stRailParts(A, B, h, post, mid, toe, rs) {
    var L = Math.hypot(B[0] - A[0], B[1] - A[1], B[2] - A[2]), n = Math.max(1, Math.ceil(L / post - 1e-9)), rad = RAILS[rs].od / 2000, kgm = stRailKgm(rs), out = [], at = function (f, dy) { return [A[0] + (B[0] - A[0]) * f, A[1] + (B[1] - A[1]) * f + dy, A[2] + (B[2] - A[2]) * f]; };
    if (L < 0.01) return out;
    for (var i = 0; i <= n; i++) out.push({ k: 'cyl', a: at(i / n, 0), b: at(i / n, h), rad: rad, kg: h * kgm });
    out.push({ k: 'cyl', a: at(0, h), b: at(1, h), rad: rad, kg: L * kgm });
    for (var m = 1; m <= mid; m++) out.push({ k: 'cyl', a: at(0, h * m / (mid + 1)), b: at(1, h * m / (mid + 1)), rad: rad, kg: L * kgm });
    if (toe) out.push({ k: 'bar', a: at(0, 0.05), b: at(1, 0.05), w: ST_TOE.w, h: ST_TOE.h, kg: L * ST_TOE.w * ST_TOE.h * ST_RHO });
    return out;
  }
  function stAccParts(a) {
    var out = [], p;
    if (a.t === 'g') {
      var th = stGratTh(a.s), holes = a.o || [], ha = Math.min(a.w * a.d * 0.95, holes.reduce(function (t, o) { return t + stHoleArea(o); }, 0));
      out.push({ k: 'box', c: [a.p[0], a.p[1] - th / 2, a.p[2]], w: a.w, h: th, d: a.d, r: a.r, kg: (a.w * a.d - ha) * stGratKgm2(a.s), grat: true, holes: holes });
      holes.forEach(function (o) {                                  // a toe plate round the hole
        if (!o.kick) return; var hw = stHoleW(a.p[0], a.p[2], a.r, o), y = a.p[1] + 0.05;
        if (o.k === 'c') out.push({ k: 'tube', c: [hw.c[0], y, hw.c[1]], rad: o.d / 2 + 0.003, h: ST_TOE.h, kg: Math.PI * o.d * ST_TOE.h * ST_TOE.w * ST_RHO });
        else for (var i = 0; i < 4; i++) { var P = hw.pts[i], Q = hw.pts[(i + 1) % 4]; out.push({ k: 'bar', a: [P[0], y, P[1]], b: [Q[0], y, Q[1]], w: ST_TOE.w, h: ST_TOE.h, kg: Math.hypot(Q[0] - P[0], Q[1] - P[1]) * ST_TOE.h * ST_TOE.w * ST_RHO }); }
      });
    }
    else if (a.t === 'h') out = stRailParts(a.a, a.b, a.h, a.post, a.mid, a.toe, a.rs);
    else if (a.t === 's') {
      var n = stStairN(a), r = a.H / n, run = (n - 1) * a.g, d = stDirV(a.dir), lat = [-d[1], d[0]], th2 = stGratTh(a.tread), ang = Math.atan2(d[0], d[1]) * 180 / Math.PI, S = SSEC[a.sec];
      [-1, 1].forEach(function (sd) {
        var ox = lat[0] * sd * (a.w / 2 + S.b / 2000), oz = lat[1] * sd * (a.w / 2 + S.b / 2000);
        out.push({ k: 'mem', a: [a.p[0] + ox, a.p[1], a.p[2] + oz], b: [a.p[0] + d[0] * run + ox, a.p[1] + a.H, a.p[2] + d[1] * run + oz], s: a.sec, r: sd < 0 ? 0 : 180, kg: Math.hypot(run, a.H) * stKgm(S) });
      });
      for (var i = 1; i <= n - 1; i++) out.push({ k: 'box', c: [a.p[0] + d[0] * ((i - 0.5) * a.g), a.p[1] + i * r - th2 / 2, a.p[2] + d[1] * ((i - 0.5) * a.g)], w: a.w, h: th2, d: a.g, r: ang, kg: a.w * a.g * stGratKgm2(a.tread), grat: true });
      if (a.rail) [-1, 1].forEach(function (sd) {
        var o = a.w / 2 + S.b / 1000, A = [a.p[0] + lat[0] * sd * o, a.p[1], a.p[2] + lat[1] * sd * o], B = [A[0] + d[0] * run, A[1] + a.H, A[2] + d[1] * run];
        out = out.concat(stRailParts(A, B, 0.9, 1.5, 1, false, a.rs));
      });
    }
    else if (a.t === 'l') {
      var dd = stDirV(a.dir), lt = [-dd[1], dd[0]], w = a.w, h = a.h;
      [-1, 1].forEach(function (sd) { var x = a.p[0] + lt[0] * sd * w / 2, z = a.p[2] + lt[1] * sd * w / 2; out.push({ k: 'bar', a: [x, a.p[1], z], b: [x, a.p[1] + h, z], w: 0.01, h: 0.05, kg: h * 0.05 * 0.01 * ST_RHO }); });
      for (var y = 0.3; y < h - 0.05; y += 0.3) out.push({ k: 'cyl', a: [a.p[0] - lt[0] * w / 2, a.p[1] + y, a.p[2] - lt[1] * w / 2], b: [a.p[0] + lt[0] * w / 2, a.p[1] + y, a.p[2] + lt[1] * w / 2], rad: 0.01, kg: w * Math.PI * 0.01 * 0.01 * ST_RHO });
      if (stHasCage(a)) {
        var cr = 0.35, cx = a.p[0] - dd[0] * 0.4, cz = a.p[2] - dd[1] * 0.4;
        for (var hy = 2.2; hy <= h + 0.9 + 1e-9; hy += 0.9) { var yy = Math.min(hy, h + 0.9); out.push({ k: 'ring', c: [cx, a.p[1] + yy, cz], rad: cr, tube: 0.012, kg: 2 * Math.PI * cr * 0.05 * 0.005 * ST_RHO }); }
        if (h + 0.9 > 2.2) for (var v = 0; v < 5; v++) { var an = Math.PI * (0.15 + 0.7 * v / 4), vx = cx - dd[0] * cr * Math.sin(an) + lt[0] * cr * Math.cos(an), vz = cz - dd[1] * cr * Math.sin(an) + lt[1] * cr * Math.cos(an); out.push({ k: 'cyl', a: [vx, a.p[1] + 2.2, vz], b: [vx, a.p[1] + h + 0.9, vz], rad: 0.008, kg: (h - 1.3) * 0.04 * 0.005 * ST_RHO }); }
      }
    }
    return out;
  }
  function stAccKg(a) { return stAccParts(a).reduce(function (s, q) { return s + (q.kg || 0); }, 0); }
  function stAccAll() { return model.steel.a; }

  // ---------- 3D ----------
  var stUC = null, stUB = null, stUR = {}, stPG = {}, stUTC = {};
  function stUT(rad, h) { var k = rad.toFixed(4) + ':' + h; if (!stUTC[k] && Object.keys(stUTC).length > 100) stUTC = {}; return stUTC[k] || (stUTC[k] = new T.CylinderGeometry(rad, rad, h, 24, 1, true)); }
  function stPlateGeo(w, d, th, holes) {                            // a panel with holes: the outline and the holes in the x, z plane, extruded down by the thickness
    var key = [w, d, th, JSON.stringify(holes.map(function (o) { return [o.k, o.x, o.z, o.d, o.w, o.a]; }))].join('|');
    if (stPG[key]) return stPG[key]; if (Object.keys(stPG).length > 200) stPG = {};
    var sh = new T.Shape([new T.Vector2(-w / 2, -d / 2), new T.Vector2(w / 2, -d / 2), new T.Vector2(w / 2, d / 2), new T.Vector2(-w / 2, d / 2)]);
    holes.forEach(function (o) {
      var p = new T.Path();
      if (o.k === 'c') p.absarc(o.x, o.z, o.d / 2, 0, Math.PI * 2, false);
      else { var a = (o.a || 0) * Math.PI / 180, ca = Math.cos(a), sa = Math.sin(a), P = [[-1, -1], [1, -1], [1, 1], [-1, 1]].map(function (q) { var lx = q[0] * o.w / 2, lz = q[1] * o.d / 2; return new T.Vector2(o.x + lx * ca + lz * sa, o.z - lx * sa + lz * ca); }); p.setFromPoints(P); }
      sh.holes.push(p);
    });
    var g = new T.ExtrudeGeometry(sh, { depth: th, bevelEnabled: false, curveSegments: 20 }); g.rotateX(Math.PI / 2);
    return (stPG[key] = g);
  }
  function stAccBuild() {
    var A = model.steel.a; if (!A.length) return;
    if (!stUC) { stUC = new T.CylinderGeometry(1, 1, 1, 8); stUB = new T.BoxGeometry(1, 1, 1); }
    var cols = { g: 0x9aa4ab, h: 0xf2c14e, s: 0x6f95b0, l: 0xf2c14e }, mats = {}, matTube = mat(0xf2c14e, 0.6); matTube.side = T.DoubleSide;
    A.forEach(function (a, i) {
      var on = (sel && sel.kind === 'sacc' && sel.i === i) || msel['sacc:' + i], m0 = on ? mat(0xffb21f, 0.5) : (mats[a.t] = mats[a.t] || mat(cols[a.t], 0.6));
      stAccParts(a).forEach(function (q) {
        var m, mm = on ? m0 : q.grat ? (mats.gr = mats.gr || mat(0x9aa4ab, 0.7)) : m0;
        if (q.k === 'box' && q.holes && q.holes.length) { m = new T.Mesh(stPlateGeo(q.w, q.d, q.h, q.holes), mm); m.position.set(q.c[0], q.c[1] + q.h / 2, q.c[2]); m.rotation.y = q.r * Math.PI / 180; }
        else if (q.k === 'box') { m = new T.Mesh(stUB, mm); m.position.set(q.c[0], q.c[1], q.c[2]); m.rotation.y = q.r * Math.PI / 180; m.scale.set(q.w, q.h, q.d); }
        else if (q.k === 'tube') { m = new T.Mesh(stUT(q.rad, q.h), on ? mm : matTube); m.position.set(q.c[0], q.c[1], q.c[2]); }
        else if (q.k === 'cyl') { var da = V(q.b).sub(V(q.a)), L = da.length(); m = new T.Mesh(stUC, mm); m.position.copy(V(q.a)).addScaledVector(da, 0.5); m.quaternion.setFromUnitVectors(UP, da.normalize()); m.scale.set(q.rad, L, q.rad); }
        else if (q.k === 'bar') { var B = stBasis({ a: q.a, b: q.b, r: 0 }), L2 = V(q.b).distanceTo(V(q.a)); m = new T.Mesh(stUB, mm); m.matrixAutoUpdate = false; m.matrix.makeBasis(B.x.clone().multiplyScalar(q.w), B.y.clone().multiplyScalar(q.h), B.z.clone().multiplyScalar(L2)); m.matrix.setPosition(V(q.a).add(V(q.b)).multiplyScalar(0.5)); }
        else if (q.k === 'mem') { var Lm = stLen(q); if (Lm < 0.001) return; var Bm = stBasis(q); m = new T.Mesh(stGeo(q.s, Lm), mm); m.matrixAutoUpdate = false; m.matrix.makeBasis(Bm.x, Bm.y, Bm.z); m.matrix.setPosition(V(q.a)); }
        else if (q.k === 'ring') { var key = q.rad + ':' + q.tube; m = new T.Mesh(stUR[key] || (stUR[key] = new T.TorusGeometry(q.rad, q.tube, 6, 20)), mm); m.position.set(q.c[0], q.c[1], q.c[2]); m.rotation.x = Math.PI / 2; }
        if (!m) return; m.userData = { kind: 'sacc', i: i }; world.add(m);
      });
    });
  }

  // ---------- holes for what goes through a grating ----------
  function stGratLocal(g, x, z) { var t = g.r * Math.PI / 180, dx = x - g.p[0], dz = z - g.p[2]; return [dx * Math.cos(t) - dz * Math.sin(t), dx * Math.sin(t) + dz * Math.cos(t)]; }
  function stFitHole(g, h) {                                        // a hole that would reach past the panel edge is cut back to a rectangle 2 mm inside it, else the outline and the hole cross; null when almost none of it is on the panel
    var hw = h.k === 'c' ? h.d : h.w, m = 0.002, X = g.w / 2 - m, Z = g.d / 2 - m;
    if (Math.abs(h.x) + hw / 2 <= X && Math.abs(h.z) + h.d / 2 <= Z) return h;
    var x0 = Math.max(-X, h.x - hw / 2), x1 = Math.min(X, h.x + hw / 2), z0 = Math.max(-Z, h.z - h.d / 2), z1 = Math.min(Z, h.z + h.d / 2);
    return x1 - x0 < 0.02 || z1 - z0 < 0.02 ? null : { k: 'r', x: st3((x0 + x1) / 2), z: st3((z0 + z1) / 2), w: st3(x1 - x0), d: st3(z1 - z0), a: 0, what: h.what };
  }
  function stNeedHoles(g) {                                         // the holes the pipes and equipment passing through panel g call for: [{k, x, z, d | w, d, a, what}]
    var out = [], top = g.p[1], clr = stD.hclr;
    model.pipes.forEach(function (p, i) {
      if (p.ghost) return; var ya = p.a[1], yb = p.b[1], dy = yb - ya, L = Math.hypot(p.b[0] - p.a[0], dy, p.b[2] - p.a[2]);
      if (L < 0.01 || Math.abs(dy) / L < 0.5 || Math.min(ya, yb) > top - 0.01 || Math.max(ya, yb) < top + 0.01) return;
      var t = (top - ya) / dy, x = p.a[0] + (p.b[0] - p.a[0]) * t, z = p.a[2] + (p.b[2] - p.a[2]) * t, l = stGratLocal(g, x, z), od = OD[p.n] / 1000, d = od / (Math.abs(dy) / L) + clr;
      if (Math.abs(l[0]) > g.w / 2 + d / 2 || Math.abs(l[1]) > g.d / 2 + d / 2) return;
      out.push({ k: 'c', x: st3(l[0]), z: st3(l[1]), d: st3(d), what: 'Pipe ' + (i + 1) + (p.ln ? ' (' + p.ln + ')' : '') });
    });
    model.equip.forEach(function (e, i) {
      var f = stFoot(e, 0); if (!f || f.y0 > top - 0.02 || f.y1 < top + 0.02) return;
      var xs = f.c.map(function (q) { return q[0]; }), zs = f.c.map(function (q) { return q[1]; }), l = f.c.map(function (q) { return stGratLocal(g, q[0], q[1]); });
      var x0 = Math.min.apply(null, l.map(function (q) { return q[0]; })) - clr, x1 = Math.max.apply(null, l.map(function (q) { return q[0]; })) + clr, z0 = Math.min.apply(null, l.map(function (q) { return q[1]; })) - clr, z1 = Math.max.apply(null, l.map(function (q) { return q[1]; })) + clr;
      if (x1 < -g.w / 2 || x0 > g.w / 2 || z1 < -g.d / 2 || z0 > g.d / 2) return;
      var def = eqDef(e.k), round = def && (def.custom ? def.shape === 'cyl' : e.k === 'vessel');
      if (round) out.push({ k: 'c', x: st3((x0 + x1) / 2), z: st3((z0 + z1) / 2), d: st3(Math.max(x1 - x0, z1 - z0)), what: stTag(i) });
      else out.push({ k: 'r', x: st3((x0 + x1) / 2), z: st3((z0 + z1) / 2), w: st3(x1 - x0), d: st3(z1 - z0), a: 0, what: stTag(i) });
    });
    return out.map(function (h) { return stFitHole(g, h); }).filter(Boolean);
  }
  function stHoleCovers(h, n) {                                     // does existing hole h take in the needed hole n
    var dx = n.x - h.x, dz = n.z - h.z, nw = n.k === 'c' ? n.d : n.w, nd = n.d;
    if (h.k === 'c') return n.k === 'c' ? Math.hypot(dx, dz) + n.d / 2 <= h.d / 2 + 0.012 : Math.hypot(Math.abs(dx) + nw / 2, Math.abs(dz) + nd / 2) <= h.d / 2 + 0.012;
    var a = (h.a || 0) * Math.PI / 180, lx = dx * Math.cos(a) - dz * Math.sin(a), lz = dx * Math.sin(a) + dz * Math.cos(a);
    return Math.abs(lx) + nw / 2 <= h.w / 2 + 0.012 && Math.abs(lz) + nd / 2 <= h.d / 2 + 0.012;
  }
  function stCutHoles(i) {                                          // replace the automatic holes of panel i with the ones its pipes and equipment need; holes made by hand stay
    var g = model.steel.a[i]; if (!g || g.t !== 'g') return -1;
    var keep = (g.o || []).filter(function (o) { return o.src !== 'auto'; }), made = [];
    stNeedHoles(g).forEach(function (n) { if (keep.some(function (h) { return stHoleCovers(h, n); })) return; var h = { k: n.k, x: n.x, z: n.z, kick: stD.hkick, src: 'auto' }; if (n.k === 'c') h.d = n.d; else { h.w = n.w; h.d = n.d; h.a = 0; } made.push(h); });
    pushHist(); g.o = stCleanHoles(keep.concat(made), g.w, g.d); changed(); return made.length;
  }

  // ---------- checks ----------
  function stAccWarnings() {
    var A = model.steel.a, w = warns, lo = lowY();
    A.forEach(function (a, i) {
      var nm = (a.k || stAccName(a)) + ' (accessory ' + (i + 1) + ')';
      if (a.t === 'l') {
        if (a.h > 3 && a.cage === 'no') w.push('Ladder ' + nm + ' is ' + a.h.toFixed(1) + ' m high without a safety cage. A cage is usual above about 3 m: check the standard that applies.');
        if (a.h > 6) w.push('Ladder ' + nm + ' is ' + a.h.toFixed(1) + ' m high. A rest platform about every 6 m is usual.');
      }
      if (a.t === 's') {
        var n = stStairN(a), slope = Math.atan((a.H / n) / a.g) * 180 / Math.PI;
        if (a.H > 3.2) w.push('Stair ' + nm + ' rises ' + a.H.toFixed(1) + ' m in one flight. About 3 m between landings is usual.');
        if (slope > 45 || slope < 20) w.push('Stair ' + nm + ' slopes ' + Math.round(slope) + ' degrees. Industrial stairs are usually 30 to 45 degrees.');
      }
    });
    var G = A.filter(function (a) { return a.t === 'g'; });
    if (G.length && G.length * (model.pipes.length + model.equip.length + 1) < 60000) {
      var seenN = {};
      A.forEach(function (g, gi) {
        if (g.t !== 'g') return;
        stNeedHoles(g).forEach(function (n) { if ((g.o || []).some(function (h) { return stHoleCovers(h, n); })) return; var kk = n.what + '@' + gi; if (seenN[kk]) return; seenN[kk] = 1; w.push(n.what + ' goes through grating ' + (g.k || 'accessory ' + (gi + 1)) + ' with no hole. Cut one: select the panel, Cut holes.'); });
      });
    }
    stOpenEdges().slice(0, 8).forEach(function (o) { w.push('Platform ' + o.name + ' at ' + Math.round(o.y * 1000) + ' mm has about ' + o.len.toFixed(1) + ' m of open edge with no handrail, stair or ladder.'); });
  }
  function stOpenEdges() {                                          // gratings above 0.5 m whose edge has nothing at it: [{name, y, len}]
    var A = model.steel.a, G = [], R = [], out = [], lo = lowY();
    A.forEach(function (a, i) { if (a.t === 'g') G.push({ a: a, i: i }); else if (a.t === 'h') R.push(a); });
    if (G.length > 200) return out;
    G.forEach(function (gi) {
      var g = gi.a; if (g.p[1] - lo < 0.5) return;
      var th = g.r * Math.PI / 180, c = Math.cos(th), s = Math.sin(th), loc = function (x, z) { return [g.p[0] + x * c + z * s, g.p[2] - x * s + z * c]; }, open = 0, edges = [[[-g.w / 2, -g.d / 2], [g.w / 2, -g.d / 2]], [[g.w / 2, -g.d / 2], [g.w / 2, g.d / 2]], [[g.w / 2, g.d / 2], [-g.w / 2, g.d / 2]], [[-g.w / 2, g.d / 2], [-g.w / 2, -g.d / 2]]];
      edges.forEach(function (e) {
        var L = Math.hypot(e[1][0] - e[0][0], e[1][1] - e[0][1]), n = Math.max(2, Math.round(L / 0.1));
        for (var k = 0; k < n; k++) {
          var f = (k + 0.5) / n, q = loc(e[0][0] + (e[1][0] - e[0][0]) * f, e[0][1] + (e[1][1] - e[0][1]) * f), cov = false;
          G.forEach(function (oi) { if (cov || oi === gi) return; var o = oi.a; if (Math.abs(o.p[1] - g.p[1]) > 0.06) return; var ot = o.r * Math.PI / 180, dx = q[0] - o.p[0], dz = q[1] - o.p[2], lx = dx * Math.cos(ot) - dz * Math.sin(ot), lz = dx * Math.sin(ot) + dz * Math.cos(ot); if (Math.abs(lx) <= o.w / 2 + 0.06 && Math.abs(lz) <= o.d / 2 + 0.06) cov = true; });
          if (!cov) R.forEach(function (r) { if (cov || Math.abs(Math.min(r.a[1], r.b[1]) - g.p[1]) > 0.15 && Math.abs(Math.max(r.a[1], r.b[1]) - g.p[1]) > 0.15) return; if (stPlanDist(q, r.a, r.b) < 0.12) cov = true; });
          if (!cov) A.forEach(function (a) {
            if (cov) return;
            if (a.t === 's') { var d = stDirV(a.dir), n2 = stStairN(a), tx = a.p[0] + d[0] * (n2 - 1) * a.g, tz = a.p[2] + d[1] * (n2 - 1) * a.g; if (Math.abs(a.p[1] + a.H - g.p[1]) < 0.15 && Math.hypot(q[0] - tx, q[1] - tz) < a.w / 2 + 0.3) cov = true; }
            else if (a.t === 'l') { if (Math.abs(a.p[1] + a.h - g.p[1]) < 0.6 && Math.hypot(q[0] - a.p[0], q[1] - a.p[2]) < 0.6) cov = true; }
          });
          if (!cov) open += L / n;
        }
      });
      if (open > 0.15) out.push({ name: g.k || ('accessory ' + (gi.i + 1)), y: g.p[1], len: open });
    });
    return out;
  }
  function stPlanDist(q, a, b) {                                    // distance in plan from point q [x, z] to the segment a to b
    var ax = a[0], az = a[2], dx = b[0] - ax, dz = b[2] - az, L2 = dx * dx + dz * dz, t = L2 < 1e-12 ? 0 : Math.max(0, Math.min(1, ((q[0] - ax) * dx + (q[1] - az) * dz) / L2));
    return Math.hypot(ax + dx * t - q[0], az + dz * t - q[1]);
  }

  // ---------- list ----------
  function stAccRows() {                                            // [{name, q, unit, amt, kg}] grouped by kind and section
    var g = {};
    model.steel.a.forEach(function (a) {
      var key = a.t === 'g' ? 'g:' + a.s : a.t === 's' ? 's:' + a.sec : a.t, e = g[key] || (g[key] = { name: a.t === 'g' ? GRAT[a.s].name : a.t === 'h' ? 'Handrail with toe plate' : a.t === 's' ? 'Stair, stringers ' + SSEC[a.sec].name : 'Ladder', q: 0, amt: 0, kg: 0, unit: a.t === 'g' ? 'm²' : a.t === 'h' ? 'm' : a.t === 's' ? 'm rise' : 'm' });
      e.q++; e.kg += stAccKg(a);
      e.amt += a.t === 'g' ? a.w * a.d : a.t === 'h' ? Math.hypot(a.b[0] - a.a[0], a.b[1] - a.a[1], a.b[2] - a.a[2]) : a.t === 's' ? a.H : a.h;
      if (a.t === 'h' && !a.toe) e.name = 'Handrail';
    });
    return Object.keys(g).map(function (k) { return g[k]; });
  }

  // ---------- generators ----------
  var stD = { gw: 1, gd: 2, gs: 'G32x5', rh: 1.1, rpost: 1.2, rmid: 1, rtoe: true, rs: '42.4x2.6', sH: 3, sW: 0.9, sG: 0.25, ssec: 'C200x80', stread: 'G32x5', sdir: 0, lh: 4, lw: 0.5, ldir: 0, lcage: 'auto', hd: 0.2, hclr: 0.05, hkick: true };
  function stAccAdd(q) { var c = stCleanAcc(q); if (!c) return -1; pushHist(); model.steel.a.push(c); changed(); return model.steel.a.length - 1; }
  function stRailAround(i) {                                        // a handrail on the four sides of grating i, at its top level
    var g = model.steel.a[i]; if (!g || g.t !== 'g') return 0;
    var th = g.r * Math.PI / 180, c = Math.cos(th), s = Math.sin(th), loc = function (x, z) { return [st3(g.p[0] + x * c + z * s), g.p[1], st3(g.p[2] - x * s + z * c)]; };
    var P = [loc(-g.w / 2, -g.d / 2), loc(g.w / 2, -g.d / 2), loc(g.w / 2, g.d / 2), loc(-g.w / 2, g.d / 2)], made = [];
    for (var k = 0; k < 4; k++) { var q = stCleanAcc({ t: 'h', a: P[k], b: P[(k + 1) % 4], h: stD.rh, post: stD.rpost, mid: stD.rmid, toe: stD.rtoe, rs: stD.rs, k: g.k ? g.k + '-R' + (k + 1) : '' }); if (q) made.push(q); }
    pushHist(); made.forEach(function (q) { model.steel.a.push(q); }); changed(); return made.length;
  }
  function stPlatform(o) {                                          // a framed deck: corner legs, perimeter beams, secondary beams, one grating panel, handrail round it
    o = Object.assign({ x: 0, y: 0, w: 3000, d: 2000, lvl: 3000, leg: 'H150x150', beam: 'H150x75', sec: 'C100x50', grat: 'G32x5', rail: 'all', brace: 'none', mk: 'PF1', pitch: 1000 }, o || {});
    var X = Number(o.x) / 1000, Z = Number(o.y) / 1000, w = Number(o.w) / 1000, d = Number(o.d) / 1000, tos = Number(o.lvl) / 1000, pitch = Math.max(0.4, Number(o.pitch) / 1000);
    if (!(w >= 0.6 && d >= 0.6 && w <= 60 && d <= 60 && tos >= 0.3 && tos <= 60) || !isFinite(X) || !isFinite(Z) || !OWN(SSEC, o.leg) || !OWN(SSEC, o.beam) || !OWN(SSEC, o.sec) || !OWN(GRAT, o.grat)) return 0;
    var mk = String(o.mk || 'PF').slice(0, 10), made = [], th = stGratTh(o.grat), zb = st3(tos - th - SSEC[o.beam].h / 2000), zs = st3(tos - th - SSEC[o.sec].h / 2000);
    var nx = Math.max(1, Math.ceil(w / 5 - 1e-9)), nz = Math.max(1, Math.ceil(d / 5 - 1e-9)), n = 0;
    var xs = [], zz = []; for (var i = 0; i <= nx; i++) xs.push(st3(X + w * i / nx)); for (var j = 0; j <= nz; j++) zz.push(st3(Z + d * j / nz));
    xs.forEach(function (x) { zz.forEach(function (z) { if ((x === xs[0] || x === xs[xs.length - 1]) || (z === zz[0] || z === zz[zz.length - 1])) made.push({ a: [x, 0, z], b: [x, zb, z], s: o.leg, r: 0, k: mk + '-C' + (++n) }); }); });
    var nb = 0; for (var a = 0; a < nx; a++) { made.push({ a: [xs[a], zb, zz[0]], b: [xs[a + 1], zb, zz[0]], s: o.beam, r: 0, k: mk + '-B' + (++nb) }, { a: [xs[a], zb, zz[nz]], b: [xs[a + 1], zb, zz[nz]], s: o.beam, r: 0, k: mk + '-B' + (++nb) }); }
    for (var c = 0; c < nz; c++) made.push({ a: [xs[0], zb, zz[c]], b: [xs[0], zb, zz[c + 1]], s: o.beam, r: 0, k: mk + '-B' + (++nb) }, { a: [xs[nx], zb, zz[c]], b: [xs[nx], zb, zz[c + 1]], s: o.beam, r: 0, k: mk + '-B' + (++nb) });
    var ns = Math.max(1, Math.ceil(w / pitch - 1e-9)), nsb = 0;                         // secondary beams across the short way, at most `pitch` apart
    for (var s = 1; s < ns; s++) { var xx = st3(X + w * s / ns); made.push({ a: [xx, zs, zz[0]], b: [xx, zs, zz[nz]], s: o.sec, r: 0, k: mk + '-S' + (++nsb) }); }
    if (o.brace === 'x' && OWN(SSEC, 'L50x50x6')) [[xs[0], zz[0], xs[0], zz[nz]], [xs[nx], zz[0], xs[nx], zz[nz]]].forEach(function (e, q) { made.push({ a: [st3(e[0]), 0, st3(e[1])], b: [st3(e[2]), zb, st3(e[3])], s: 'L50x50x6', r: 0, k: mk + '-X' + (2 * q + 1) }, { a: [st3(e[2]), 0, st3(e[3])], b: [st3(e[0]), zb, st3(e[1])], s: 'L50x50x6', r: 0, k: mk + '-X' + (2 * q + 2) }); });
    var acc = [stCleanAcc({ t: 'g', p: [X + w / 2, tos, Z + d / 2], w: w, d: d, r: 0, s: o.grat, k: mk + '-G' })];
    if (o.rail === 'all') { var Pc = [[X, Z], [X + w, Z], [X + w, Z + d], [X, Z + d]]; for (var k = 0; k < 4; k++) acc.push(stCleanAcc({ t: 'h', a: [Pc[k][0], tos, Pc[k][1]], b: [Pc[(k + 1) % 4][0], tos, Pc[(k + 1) % 4][1]], h: stD.rh, post: stD.rpost, mid: stD.rmid, toe: stD.rtoe, rs: stD.rs, k: mk + '-R' + (k + 1) })); }
    if (!stRoom(made.length)) return 0;
    pushHist(); made.forEach(function (m) { model.steel.m.push(m); }); acc.filter(Boolean).forEach(function (q) { model.steel.a.push(q); }); changed(); return made.length + acc.length;
  }
  function stStanchion(o) {                                         // a T support for pipes: one column and a head beam across, or two columns
    o = Object.assign({ x: 0, y: 0, lvl: 1000, width: 1500, dir: 'x', col: 'H150x150', beam: 'H100x50', two: 'no', mk: 'ST1' }, o || {});
    var X = Number(o.x) / 1000, Z = Number(o.y) / 1000, tos = Number(o.lvl) / 1000, w = Number(o.width) / 1000;
    if (!(tos >= 0.3) || !(w >= 0.3) || !isFinite(X) || !isFinite(Z) || !OWN(SSEC, o.col) || !OWN(SSEC, o.beam)) return 0;
    var u = o.dir === 'y' ? [0, 1] : [1, 0], zb = stCz(tos, o.beam), mk = String(o.mk || 'ST').slice(0, 10), made = [], pos = o.two === 'yes' ? [-w / 2, w / 2] : [0];
    pos.forEach(function (t, i) { var x = st3(X + u[0] * t), z = st3(Z + u[1] * t); made.push({ a: [x, 0, z], b: [x, zb, z], s: o.col, r: o.dir === 'y' ? 90 : 0, k: mk + '-C' + (i + 1) }); });
    made.push({ a: [st3(X - u[0] * w / 2), zb, st3(Z - u[1] * w / 2)], b: [st3(X + u[0] * w / 2), zb, st3(Z + u[1] * w / 2)], s: o.beam, r: 0, k: mk + '-B1' });
    pushHist(); made.forEach(function (m) { model.steel.m.push(m); }); changed(); return made.length;
  }
