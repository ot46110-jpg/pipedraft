  // ---------- steel: columns, beams, braces, pipe racks, equipment frames, base plates ----------
  // Spliced into the app script by build.js at //@@STEEL@@. Positions are model metres like the pipes: [x, up, z], CAD Y is z.
  var ST_RHO = 7850, ST_FIL = 1 - Math.PI / 4;
  var SSEC = {};                                                    // rolled sections, mm; weight is computed from the shape
  function stDefH(h, b, tw, tf, r) { SSEC['H' + h + 'x' + b] = { t: 'H', h: h, b: b, tw: tw, tf: tf, r: r, name: 'H ' + h + 'x' + b + 'x' + tw + 'x' + tf }; }
  [[100, 50, 5, 7, 8], [125, 60, 6, 8, 9], [150, 75, 5, 7, 8], [148, 100, 6, 9, 11], [150, 150, 7, 10, 11], [175, 90, 5, 8, 9], [200, 100, 5.5, 8, 11], [194, 150, 6, 9, 13], [200, 200, 8, 12, 13],
   [250, 125, 6, 9, 12], [244, 175, 7, 11, 16], [250, 250, 9, 14, 16], [300, 150, 6.5, 9, 13], [294, 200, 8, 12, 18], [300, 300, 10, 15, 18], [350, 175, 7, 11, 14], [340, 250, 9, 14, 20],
   [350, 350, 12, 19, 20], [400, 200, 8, 13, 16], [390, 300, 10, 16, 22], [400, 400, 13, 21, 22]].forEach(function (a) { stDefH.apply(null, a); });
  function stDefC(h, b, tw, tf, r1, r2) { SSEC['C' + h + 'x' + b] = { t: 'C', h: h, b: b, tw: tw, tf: tf, r1: r1, r2: r2, name: 'C ' + h + 'x' + b + 'x' + tw + 'x' + tf }; }
  [[100, 50, 5, 7.5, 8, 4], [125, 65, 6, 8, 8, 4], [150, 75, 6.5, 10, 10, 5], [200, 80, 7.5, 11, 12, 6], [250, 90, 9, 13, 14, 7]].forEach(function (a) { stDefC.apply(null, a); });
  function stDefL(a, t, r1, r2) { SSEC['L' + a + 'x' + a + 'x' + t] = { t: 'L', h: a, b: a, tf: t, r1: r1, r2: r2, name: 'L ' + a + 'x' + a + 'x' + t }; }
  [[50, 6, 6.5, 4.5], [65, 6, 8.5, 4], [75, 6, 8.5, 4], [90, 7, 10, 5], [100, 10, 10, 7]].forEach(function (a) { stDefL.apply(null, a); });
  function stDefR(h, b, t) { SSEC[(b === h ? 'SHS' : 'RHS') + h + 'x' + b + 'x' + t] = { t: 'R', h: h, b: b, tf: t, name: (b === h ? 'SHS ' : 'RHS ') + h + 'x' + b + 'x' + t }; }
  [[100, 100, 4], [100, 100, 5], [150, 150, 6], [200, 200, 8], [250, 250, 9], [100, 50, 3.2], [150, 100, 5], [200, 100, 6]].forEach(function (a) { stDefR.apply(null, a); });
  var SSEC_KEYS = Object.keys(SSEC);
  function stArea(s) {                                              // mm2, with root fillets and toe radii
    if (s.t === 'H') return 2 * s.b * s.tf + (s.h - 2 * s.tf) * s.tw + (4 - Math.PI) * s.r * s.r;
    if (s.t === 'C') return 2 * s.b * s.tf + (s.h - 2 * s.tf) * s.tw + ST_FIL * (2 * s.r1 * s.r1 - 2 * s.r2 * s.r2);
    if (s.t === 'L') return s.tf * (2 * s.h - s.tf) + ST_FIL * (s.r1 * s.r1 - 2 * s.r2 * s.r2);
    var t = s.tf, ro = t <= 6 ? 2 * t : t <= 10 ? 2.5 * t : 3 * t, ri = ro - t;      // hollow section corner radii as EN 10219
    return 2 * t * (s.b + s.h - 2 * t) - (4 - Math.PI) * (ro * ro - ri * ri);
  }
  function stKgm(s) { return stArea(s) * ST_RHO * 1e-6; }
  function stPaint(s) { return s.t === 'H' ? (4 * s.b + 2 * s.h - 2 * s.tw) / 1000 : s.t === 'C' ? (2 * s.h + 4 * s.b - 2 * s.tw) / 1000 : s.t === 'L' ? 4 * s.h / 1000 : 2 * (s.b + s.h) / 1000; }   // m2 per metre, outside surface
  function stPoly(s) {                                              // outline in mm centred on the bounding box: x across, y up; hollow sections add a hole
    var h = s.h, b = s.b, hw = b / 2, hh = h / 2, tw = s.tw, tf = s.tf, w = tw / 2;
    if (s.t === 'H') return { o: [[-hw, -hh], [hw, -hh], [hw, -hh + tf], [w, -hh + tf], [w, hh - tf], [hw, hh - tf], [hw, hh], [-hw, hh], [-hw, hh - tf], [-w, hh - tf], [-w, -hh + tf], [-hw, -hh + tf]] };
    if (s.t === 'C') return { o: [[-hw, -hh], [hw, -hh], [hw, -hh + tf], [-hw + tw, -hh + tf], [-hw + tw, hh - tf], [hw, hh - tf], [hw, hh], [-hw, hh]] };
    if (s.t === 'L') return { o: [[-hw, -hh], [hw, -hh], [hw, -hh + tf], [-hw + tf, -hh + tf], [-hw + tf, hh], [-hw, hh]] };
    return { o: [[-hw, -hh], [hw, -hh], [hw, hh], [-hw, hh]], hole: [[-hw + tf, -hh + tf], [-hw + tf, hh - tf], [hw - tf, hh - tf], [hw - tf, -hh + tf]] };
  }

  // ---------- steel data: model.steel = { m: members, pl: base plates } ----------
  var ST_BOLTS = { M16: 16, M20: 20, M24: 24, M30: 30 };
  function st3(v) { return Math.round(v * 1000) / 1000; }
  function stNum(v, d) { v = Number(v); return isFinite(v) ? v : d; }
  function stPt(a) { if (!Array.isArray(a) || a.length !== 3) return null; var p = a.map(function (v) { return stNum(v, NaN); }); return p.some(function (v) { return !isFinite(v) || Math.abs(v) > 5000; }) ? null : p.map(st3); }
  function stCleanPlate(q) {
    if (!q) return null; var p = stPt(q.p); if (!p) return null;
    var w = stNum(q.w, 0), d = stNum(q.d, 0), t = stNum(q.t, 0); if (!(w >= 0.05 && w <= 3 && d >= 0.05 && d <= 3 && t >= 0.006 && t <= 0.1)) return null;
    return { p: p, w: st3(w), d: st3(d), t: st3(t), n: [4, 6, 8].indexOf(q.n) >= 0 ? q.n : 4, bolt: OWN(ST_BOLTS, q.bolt) ? q.bolt : 'M20' };
  }
  function stClean(s) {
    var o = { m: [], pl: [] }; if (!s || typeof s !== 'object') return o;
    (Array.isArray(s.m) ? s.m : []).slice(0, 6000).forEach(function (p) {
      if (!p || typeof p.s !== 'string' || !OWN(SSEC, p.s)) return; var a = stPt(p.a), b = stPt(p.b); if (!a || !b) return;
      o.m.push({ a: a, b: b, s: p.s, r: ((Math.round(stNum(p.r, 0)) % 360) + 360) % 360, k: String(p.k || '').slice(0, 20) });
    });
    (Array.isArray(s.pl) ? s.pl : []).slice(0, 3000).forEach(function (q) { var c = stCleanPlate(q); if (c) o.pl.push(c); });
    return o;
  }
  function stLen(p) { return Math.hypot(p.b[0] - p.a[0], p.b[1] - p.a[1], p.b[2] - p.a[2]); }
  function stBasis(p) {                                             // columns for the profile x, profile y and the member axis; profile y is up (a vertical member: toward +z)
    var d = V(p.b).sub(V(p.a)).normalize(), up = Math.abs(d.y) > 0.999 ? new T.Vector3(0, 0, -1) : new T.Vector3(0, 1, 0);
    var y = up.clone().sub(d.clone().multiplyScalar(d.dot(up))).normalize(), x = new T.Vector3().crossVectors(y, d);
    var r = (p.r || 0) * Math.PI / 180, cx = Math.cos(r), sx = Math.sin(r);
    return { x: x.clone().multiplyScalar(cx).add(y.clone().multiplyScalar(sx)), y: y.clone().multiplyScalar(cx).sub(x.clone().multiplyScalar(sx)), z: d };
  }
  var stGeoC = {}, stEdgeC = {}, stLs = null;                       // cached shapes; stLs is the loose-end result of the rebuild in progress
  function stGeo(sec, L) {
    var k = sec + '@' + L.toFixed(3); if (stGeoC[k]) return stGeoC[k];
    if (Object.keys(stGeoC).length > 400) { stGeoC = {}; stEdgeC = {}; }
    var s = SSEC[sec], pl = stPoly(s), sh = new T.Shape(pl.o.map(function (q) { return new T.Vector2(q[0] / 1000, q[1] / 1000); }));
    if (pl.hole) sh.holes.push(new T.Path(pl.hole.map(function (q) { return new T.Vector2(q[0] / 1000, q[1] / 1000); })));
    return (stGeoC[k] = new T.ExtrudeGeometry(sh, { depth: L, bevelEnabled: false }));
  }

  function stEdges(sec, L, g) { var k = sec + '@' + L.toFixed(3); return stEdgeC[k] || (stEdgeC[k] = new T.EdgesGeometry(g, 30)); }

  // ---------- equipment footprints (any built-in or custom equipment): the box of what is drawn, turned about the vertical ----------
  var stBoxC = {};
  function stEqBox(k) {                                             // x0..x1, y0..y1, z0..z1 in the equipment frame
    var def = eqDef(k); if (!def) return null;
    if (def.custom) { var cw = def.W / 2, cd = def.D / 2; return { x0: -cw, x1: cw, y0: 0, y1: def.H, z0: -cd, z1: cd }; }
    if (stBoxC[k]) return stBoxC[k];
    var g = new T.Group(); try { def.build(g, mat(0x888888, 0.5)); } catch (x) { return null; }
    g.updateMatrixWorld(true); var b = new T.Box3().setFromObject(g);
    g.traverse(function (o) { if (o.geometry) o.geometry.dispose(); if (o.material) o.material.dispose(); });
    return (stBoxC[k] = { x0: b.min.x, x1: b.max.x, y0: b.min.y, y1: b.max.y, z0: b.min.z, z1: b.max.z });
  }
  function stFoot(e, grow) {                                        // {c: four corners [x, z], y0, y1, cx, cz, hx, hz, th}
    var bx = stEqBox(e.k); if (!bx) return null; grow = grow || 0;
    var th = (e.r || 0) * Math.PI / 2, c = Math.cos(th), s = Math.sin(th);
    var rot = function (x, z) { return [e.p[0] + x * c + z * s, e.p[2] - x * s + z * c]; };
    return { c: [rot(bx.x0 - grow, bx.z0 - grow), rot(bx.x1 + grow, bx.z0 - grow), rot(bx.x1 + grow, bx.z1 + grow), rot(bx.x0 - grow, bx.z1 + grow)], y0: e.p[1] + bx.y0, y1: e.p[1] + bx.y1, box: bx, th: th };
  }
  function stOverlap(A, B) {                                        // separating axis test on two convex polygons
    var ok = true;
    [A, B].forEach(function (P) {
      for (var i = 0; i < P.length && ok; i++) {
        var a = P[i], b = P[(i + 1) % P.length], nx = a[1] - b[1], ny = b[0] - a[0], mn = [Infinity, Infinity], mx = [-Infinity, -Infinity];
        [A, B].forEach(function (Q, k) { Q.forEach(function (q) { var v = q[0] * nx + q[1] * ny; if (v < mn[k]) mn[k] = v; if (v > mx[k]) mx[k] = v; }); });
        if (mx[0] <= mn[1] + 1e-9 || mx[1] <= mn[0] + 1e-9) ok = false;
      }
    });
    return ok;
  }
  function stTag(i) { try { return assignTags().equip[i] || ('Equipment ' + (i + 1)); } catch (x) { return 'Equipment ' + (i + 1); } }
  function stClear(e) { var c = stNum(e.cl, 0); return c > 0 && c <= 20 ? c : 0; }

  // ---------- checks ----------
  function stLoose() {                                              // members with an end resting on nothing: not on the floor, nor on another member's end or body
    var out = {}, S = model.steel.m, lo = lowY();
    function near(q, j) {
      var P = S[j], a = P.a, b = P.b, u = [b[0] - a[0], b[1] - a[1], b[2] - a[2]], L2 = u[0] * u[0] + u[1] * u[1] + u[2] * u[2]; if (L2 < 1e-9) return false;
      var t = Math.max(0, Math.min(1, ((q[0] - a[0]) * u[0] + (q[1] - a[1]) * u[1] + (q[2] - a[2]) * u[2]) / L2));
      return Math.hypot(a[0] + u[0] * t - q[0], a[1] + u[1] * t - q[1], a[2] + u[2] * t - q[2]) < 0.15;
    }
    if (S.length > 1500) return out;
    S.forEach(function (p, i) {
      var cnt = 0; [p.a, p.b].forEach(function (q) { if (Math.abs(q[1]) < 0.01 || Math.abs(q[1] - lo) < 0.01) { cnt++; return; } for (var j = 0; j < S.length; j++) if (j !== i && near(q, j)) { cnt++; return; } });
      if (cnt < 2) out[i] = 1;
    });
    return out;
  }
  function stThrough(E, p) {                                        // length of member p inside the body of equipment E (shrunk 30 mm), metres
    var f = stFoot(E, 0); if (!f) return 0;
    var S = 0.03, bx = f.box, c = Math.cos(f.th), s = Math.sin(f.th);
    var loc = function (q) { var dx = q[0] - E.p[0], dz = q[2] - E.p[2]; return [dx * c - dz * s, q[1] - E.p[1], dx * s + dz * c]; }, A = loc(p.a), B = loc(p.b), t0 = 0, t1 = 1, ok = true;
    [[A[0], B[0], bx.x0 + S, bx.x1 - S], [A[1], B[1], bx.y0 + S, bx.y1 - S], [A[2], B[2], bx.z0 + S, bx.z1 - S]].forEach(function (r) {
      if (!ok) return; var d = r[1] - r[0]; if (r[2] >= r[3]) { ok = false; return; }
      if (Math.abs(d) < 1e-12) { if (r[0] < r[2] || r[0] > r[3]) ok = false; return; }
      var ta = (r[2] - r[0]) / d, tb = (r[3] - r[0]) / d; if (ta > tb) { var x = ta; ta = tb; tb = x; } t0 = Math.max(t0, ta); t1 = Math.min(t1, tb); if (t0 >= t1) ok = false;
    });
    return ok ? (t1 - t0) * stLen(p) : 0;
  }
  function stSegDist(p1, q1, p2, q2) {                              // closest distance between two segments (arrays of 3)
    var d1 = V(q1).sub(V(p1)), d2 = V(q2).sub(V(p2)), r = V(p1).sub(V(p2)), a = d1.dot(d1), e = d2.dot(d2), f = d2.dot(r), s, t;
    if (a < 1e-12 && e < 1e-12) return r.length();
    if (a < 1e-12) { s = 0; t = Math.max(0, Math.min(1, f / e)); }
    else {
      var c = d1.dot(r);
      if (e < 1e-12) { t = 0; s = Math.max(0, Math.min(1, -c / a)); }
      else {
        var b = d1.dot(d2), den = a * e - b * b; s = den > 1e-12 ? Math.max(0, Math.min(1, (b * f - c * e) / den)) : 0; t = (b * s + f) / e;
        if (t < 0) { t = 0; s = Math.max(0, Math.min(1, -c / a)); } else if (t > 1) { t = 1; s = Math.max(0, Math.min(1, (b - c) / a)); }
      }
    }
    return V(p1).addScaledVector(d1, s).sub(V(p2).addScaledVector(d2, t)).length();
  }
  function stPipeClashes() {                                        // [{p: pipe index, m: member index}]: a pipe axis closer to a member axis than the pipe radius plus half the smaller side
    var out = [], S = model.steel.m, P = model.pipes; if (!S.length || S.length * P.length > 250000) return out;
    S.forEach(function (m, mi) {
      var sc0 = SSEC[m.s], rm = Math.min(sc0.b, sc0.h) / 2000, lo = [Math.min(m.a[0], m.b[0]) - 1, Math.min(m.a[1], m.b[1]) - 1, Math.min(m.a[2], m.b[2]) - 1], hi = [Math.max(m.a[0], m.b[0]) + 1, Math.max(m.a[1], m.b[1]) + 1, Math.max(m.a[2], m.b[2]) + 1];
      P.forEach(function (p, pi) {
        if (p.ghost) return;
        if (Math.max(p.a[0], p.b[0]) < lo[0] || Math.min(p.a[0], p.b[0]) > hi[0] || Math.max(p.a[1], p.b[1]) < lo[1] || Math.min(p.a[1], p.b[1]) > hi[1] || Math.max(p.a[2], p.b[2]) < lo[2] || Math.min(p.a[2], p.b[2]) > hi[2]) return;
        if (stSegDist(m.a, m.b, p.a, p.b) < OD[p.n] / 2000 + rm - 0.01) out.push({ p: pi, m: mi });
      });
    });
    return out;
  }
  function stWarnings() {                                           // added to the Check list by rebuild()
    var S = model.steel.m, E = model.equip, seen = {};
    S.forEach(function (p, i) {
      var L = stLen(p), k = [p.a, p.b].map(function (q) { return q.map(function (v) { return Math.round(v * 100); }).join(','); }).sort().join('|') + p.s;
      if (L < 0.05) warns.push('Steel member ' + (i + 1) + ' is shorter than 50 mm.');
      if (seen[k] !== undefined) warns.push('Steel members ' + (seen[k] + 1) + ' and ' + (i + 1) + ' are the same member twice.'); else seen[k] = i;
    });
    var ls = stLs || stLoose(), n = Object.keys(ls).length; stLs = null;
    if (n) warns.push(n + ' steel member' + (n > 1 ? 's' : '') + ' with an end resting on nothing (red): connect it to the floor or to another member.');
    E.forEach(function (a, i) {
      var fa = stFoot(a, 0); if (!fa) return; var la = stTag(i), ca = stClear(a);
      E.forEach(function (b, j) {
        if (j <= i) return; var fb = stFoot(b, 0); if (!fb || Math.min(fa.y1, fb.y1) <= Math.max(fa.y0, fb.y0)) return; var lb = stTag(j);
        if (stOverlap(fa.c, fb.c)) warns.push(la + ' and ' + lb + ' overlap.');
        else if (ca && stOverlap(stFoot(a, ca).c, fb.c)) warns.push(lb + ' is inside the maintenance clearance of ' + la + '.');
        else if (stClear(b) && stOverlap(stFoot(b, stClear(b)).c, fa.c)) warns.push(la + ' is inside the maintenance clearance of ' + lb + '.');
      });
      if (a.p[1] + fa.box.y0 > 0.3) {                               // raised: something must carry it
        var xs = fa.c.map(function (q) { return q[0]; }), zs = fa.c.map(function (q) { return q[1]; }), cnt = 0, base = fa.y0, x0 = Math.min.apply(null, xs) - 0.3, x1 = Math.max.apply(null, xs) + 0.3, z0 = Math.min.apply(null, zs) - 0.3, z1 = Math.max.apply(null, zs) + 0.3;
        S.forEach(function (m) {
          if (Math.max(m.a[1], m.b[1]) < base - 0.6 || Math.min(m.a[1], m.b[1]) > base + 0.05) return;
          if ([m.a, m.b, [(m.a[0] + m.b[0]) / 2, 0, (m.a[2] + m.b[2]) / 2]].some(function (q) { return q[0] >= x0 && q[0] <= x1 && q[2] >= z0 && q[2] <= z1; })) cnt++;
        });
        if (cnt < 2) warns.push(la + ' sits at ' + Math.round(base * 1000) + ' mm with no steel under it: add a support frame (⋯, Project, Steel).');
      }
    });
    var th = 0, shown = 0;
    E.forEach(function (a, i) { S.forEach(function (m, mi) { if (stThrough(a, m) > 0.02) { th++; if (shown < 8) { shown++; warns.push('Steel member ' + (mi + 1) + ' (' + SSEC[m.s].name + ') runs through ' + stTag(i) + '.'); } } }); });
    if (th > 8) warns.push((th - 8) + ' more steel members run through equipment.');
    var pc = stPipeClashes(); pc.slice(0, 8).forEach(function (c) { warns.push('Pipe ' + (c.p + 1) + ' (' + model.pipes[c.p].ln + ') runs into steel member ' + (c.m + 1) + ' (' + SSEC[model.steel.m[c.m].s].name + ').'); });
    if (pc.length > 8) warns.push((pc.length - 8) + ' more pipes run into steel.');
  }

  // ---------- 3D ----------
  function stBuild() {
    var S = model.steel, anyCl = model.equip.some(function (e) { return stClear(e) > 0; }); stLs = null;
    if (!S.m.length && !S.pl.length && !anyCl) return;
    var ls = stLs = stLoose(), mN = mat(0x6f95b0, 0.6), mL = mat(0xe5604d, 0.6), mS = mat(0xffb21f, 0.5), mP = mat(0x59636b, 0.6), edge = new T.LineBasicMaterial({ color: 0x0b1116 });
    S.m.forEach(function (p, i) {
      var L = stLen(p); if (L < 0.001) return;
      var on = (sel && sel.kind === 'steel' && sel.i === i) || msel['steel:' + i], m = new T.Mesh(stGeo(p.s, L), on ? mS : ls[i] ? mL : mN), B = stBasis(p);
      m.matrixAutoUpdate = false; m.matrix.makeBasis(B.x, B.y, B.z); m.matrix.setPosition(V(p.a)); m.userData = { kind: 'steel', i: i }; world.add(m);
      var ln = new T.LineSegments(stEdges(p.s, L, m.geometry), edge); ln.matrixAutoUpdate = false; ln.matrix.copy(m.matrix); world.add(ln);
    });
    S.pl.forEach(function (q) { var m = new T.Mesh(new T.BoxGeometry(q.w, q.t, q.d), mP); m.position.set(q.p[0], q.p[1] + q.t / 2, q.p[2]); world.add(m); });
    model.equip.forEach(function (e) {                              // the maintenance clearance, a dashed box on the floor outline
      var c = stClear(e); if (!c) return; var f = stFoot(e, c); if (!f) return;
      var pts = []; f.c.forEach(function (q, k) { var n = f.c[(k + 1) % 4]; pts.push(new T.Vector3(q[0], f.y0 + 0.01, q[1]), new T.Vector3(n[0], f.y0 + 0.01, n[1])); });
      var ln = new T.LineSegments(new T.BufferGeometry().setFromPoints(pts), new T.LineBasicMaterial({ color: 0xc9902a })); world.add(ln);
    });
  }

  // ---------- list ----------
  function stRows() {                                               // [{sec, name, q, L, kgm, kg, paint, cuts}]
    var g = {};
    model.steel.m.forEach(function (p) { var L = stLen(p); if (L < 0.001) return; (g[p.s] = g[p.s] || { sec: p.s, q: 0, L: 0, c: [] }); g[p.s].q++; g[p.s].L += L; g[p.s].c.push(L); });
    return Object.keys(g).sort(function (a, b) { return SSEC_KEYS.indexOf(a) - SSEC_KEYS.indexOf(b); }).map(function (k) { var s = SSEC[k], w = stKgm(s); return { sec: k, name: s.name, q: g[k].q, L: g[k].L, kgm: w, kg: w * g[k].L, paint: stPaint(s) * g[k].L, cuts: g[k].c }; });
  }
  function stPlateKg(q) { return q.w * q.d * q.t * ST_RHO; }
  function stPlateRows() {
    var g = {}; model.steel.pl.forEach(function (q) { var k = 'PL ' + Math.round(q.t * 1000) + 'x' + Math.round(q.w * 1000) + 'x' + Math.round(q.d * 1000); (g[k] = g[k] || { name: k, q: 0, kgEach: stPlateKg(q) }); g[k].q++; });
    return Object.keys(g).map(function (k) { var r = g[k]; r.kg = r.kgEach * r.q; return r; });
  }
  function stBoltRows() { var b = {}; model.steel.pl.forEach(function (q) { b[q.bolt] = (b[q.bolt] || 0) + q.n; }); return Object.keys(b).map(function (k) { return { bolt: k, q: b[k] }; }); }
  function stTotals() { var r = stRows(); return { n: r.reduce(function (a, x) { return a + x.q; }, 0), kg: r.reduce(function (a, x) { return a + x.kg; }, 0) + model.steel.pl.reduce(function (a, q) { return a + stPlateKg(q); }, 0), paint: r.reduce(function (a, x) { return a + x.paint; }, 0) }; }
  function stCsv() {
    var q = function (s) { return '"' + String(s).replace(/"/g, '""') + '"'; }, nl = String.fromCharCode(10);
    var out = 'Mark,Section,Grade,Length mm,kg/m,Weight kg,Start X,Start Y,Start Z,End X,End Y,End Z' + nl;
    model.steel.m.forEach(function (p, i) { var s = SSEC[p.s], L = stLen(p), a = cadOf(p.a), b = cadOf(p.b); out += [q(p.k || (i + 1)), q(s.name), q('S275 / SS400'), Math.round(L * 1000), stKgm(s).toFixed(2), (stKgm(s) * L).toFixed(1)].concat(a.concat(b).map(function (v) { return Math.round(v * 1000); })).join(',') + nl; });
    stPlateRows().forEach(function (r) { out += [q('PL'), q(r.name), '', '', '', r.kg.toFixed(1), r.q].join(',') + nl; });
    stBoltRows().forEach(function (r) { out += [q('AB'), q('Anchor bolt ' + r.bolt), '', '', '', '', r.q].join(',') + nl; });
    return out;
  }

  // ---------- editing ----------
  var stk = 'col', stSec = 'H200x200', stColH = 4, stAx = 'auto', stRun = null;
  function stAdd(a, b, sec, roll, mark) {
    var p = { a: a.map(st3), b: b.map(st3), s: OWN(SSEC, sec) ? sec : stSec, r: roll || 0, k: mark || '' };
    if (Math.hypot(p.b[0] - p.a[0], p.b[1] - p.a[1], p.b[2] - p.a[2]) < 0.001) return -1;
    pushHist(); model.steel.m.push(p); changed(); return model.steel.m.length - 1;
  }
  function stSnap(e) {                                              // a member end or mid point near the tap on screen, else the grid point on the work plane
    var best = null, bd = e.pointerType === 'touch' ? 32 : 24;
    model.steel.m.forEach(function (p) {
      [p.a, p.b, [(p.a[0] + p.b[0]) / 2, (p.a[1] + p.b[1]) / 2, (p.a[2] + p.b[2]) / 2]].forEach(function (q, k) {
        var s = scrOk(q); if (!s) return; var d = Math.hypot(s.x - e.clientX, s.y - e.clientY) + (k === 2 ? 8 : 0);
        if (d < bd) { bd = d; best = { p: q.slice(), kind: k === 2 ? 'mid' : 'end' }; }
      });
    });
    if (best) return best;
    var pp = planePoint(e); return pp ? { p: planePt(pp), kind: 'grid' } : null;
  }
  function stConstrain(s, sn) {                                     // free ends keep their point; grid points follow the locked or dominant horizontal axis
    if (sn.kind !== 'grid' || stAx === 'free') return sn.p.slice();
    var dx = sn.p[0] - s[0], dz = sn.p[2] - s[2], ax = stAx === 'auto' ? (Math.abs(dx) >= Math.abs(dz) ? 'x' : 'y') : stAx;
    return ax === 'x' ? [sn.p[0], s[1], s[2]] : [s[0], s[1], sn.p[2]];
  }
  function stTap(e) {
    var sn = stSnap(e); if (!sn) return;
    if (stk === 'col') { var top = sn.p.slice(); top[1] = st3(sn.p[1] + stColH); if (stAdd(sn.p, top) >= 0) elev = sn.p[1]; return; }
    if (!stRun) { stRun = sn.p.slice(); elev = stRun[1]; updateUi(); return; }
    var end = stConstrain(stRun, sn); if (stAdd(stRun, end) >= 0) { stRun = end; elev = end[1]; }
    ghostLine.visible = false; updateUi();
  }
  function stGhost(e) {
    var sn = stSnap(e); if (!sn) { marker.visible = ghostLine.visible = false; return; }
    var a = stk === 'beam' && stRun ? stRun : null, p = a ? stConstrain(a, sn) : sn.p.slice();
    marker.visible = true; marker.position.set(p[0], p[1], p[2]); markSnap(sn.kind !== 'grid', sn.kind === 'mid' ? 'mid' : 'end');
    var b = a ? p : stk === 'col' ? [p[0], p[1] + stColH, p[2]] : null;
    if (b) { ghostLine.visible = true; setLine(ghostLine, a || p, b); } else ghostLine.visible = false;
    setPos('X ' + Math.round(p[0] * 1000) + '  Y ' + Math.round(p[2] * 1000) + '  Z ' + Math.round(p[1] * 1000) + ' mm' + (a ? '  L ' + Math.round(Math.hypot(p[0] - a[0], p[1] - a[1], p[2] - a[2]) * 1000) : ''));
  }
  function stMove(list, o, copy) {                                  // o is a model-space offset in metres
    pushHist(); var made = [];
    list.forEach(function (i) { var p = model.steel.m[i]; if (!p) return; var q = JSON.parse(JSON.stringify(p)); q.a = q.a.map(function (v, k) { return st3(v + o[k]); }); q.b = q.b.map(function (v, k) { return st3(v + o[k]); }); if (copy) { q.k = ''; made.push(q); } else model.steel.m[i] = q; });
    made.forEach(function (q) { model.steel.m.push(q); }); changed(); return made.length;
  }

  // ---------- groups: members that share a mark prefix (a rack, a frame) move, copy and delete together ----------
  function stPrefix(k) { var i = String(k || '').indexOf('-'); return i > 0 ? k.slice(0, i) : ''; }
  function stGroups() { var g = {}; model.steel.m.forEach(function (p, i) { var x = stPrefix(p.k); if (x) (g[x] = g[x] || []).push(i); }); return g; }
  function stFreshPrefix(x) {
    var g = stGroups(), m = /^(.*?)([0-9]*)$/.exec(x), base = m[1], n = m[2] ? Number(m[2]) + 1 : 2;
    while (g[base + n] || (base + n).length > 10) { n++; if (n > 999) break; } return base + n;
  }
  function stGroupMove(x, o, copy) {                                // o is a model-space offset in metres; a copy gets a new prefix
    var g = stGroups()[x]; if (!g) return 0;
    if (!copy) return stMove(g, o, false) || g.length;
    var np = stFreshPrefix(x), n0 = model.steel.m.length; stMove(g, o, true);
    for (var i = n0; i < model.steel.m.length; i++) model.steel.m[i].k = np + model.steel.m[g[i - n0]].k.slice(x.length);
    changed(); return model.steel.m.length - n0;
  }
  function stGroupDelete(x) { var g = stGroups()[x]; if (!g) return 0; pushHist(); var set = {}; g.forEach(function (i) { set[i] = 1; }); model.steel.m = model.steel.m.filter(function (p, i) { return !set[i]; }); sel = null; msel = {}; changed(); return g.length; }

  // ---------- generators ----------
  var stP = { x: 0, y: 0, dir: 'x', bays: 4, bay: 6000, w: 4000, tiers: '4000, 5500', col: 'H200x200', beam: 'H300x150', strut: 'H200x100', brace: 'L75x75x6', bracing: 'end', mid: 'no', mk: 'PR1',
    fh: 1000, finset: 100, fleg: 'H150x150', fbeam: 'H100x50', fbrace: 'none', pt: 20, pove: 75, pbolt: 'M20', pn: '4' };
  function stCz(tos, sec) { return st3(tos - SSEC[sec].h / 2000); }  // member centreline for a given top of steel
  function stRack(o) {                                              // o.x and o.y are CAD mm, levels are top of steel; returns the number of members added
    o = Object.assign({}, stP, o || {});
    var tiers = (Array.isArray(o.tiers) ? o.tiers : String(o.tiers).split(/[,; ]+/)).map(function (v) { return Number(v) / 1000; }).filter(function (v) { return v > 0.5 && v < 60; }).sort(function (a, b) { return a - b; });
    var bays = Math.max(1, Math.min(60, Math.round(Number(o.bays)))), bay = Number(o.bay) / 1000, w = Number(o.w) / 1000;
    if (!tiers.length || !(bay > 0.5) || !(w > 0.5) || !OWN(SSEC, o.col) || !OWN(SSEC, o.beam) || !OWN(SSEC, o.strut)) return 0;
    var X = Number(o.x) / 1000, Z = Number(o.y) / 1000, u = o.dir === 'y' ? [0, 1] : [1, 0], v = o.dir === 'y' ? [1, 0] : [0, 1], lines = o.mid === 'yes' ? 3 : 2, mk = String(o.mk || 'PR').slice(0, 10);
    var P = function (i, j, y) { return [st3(X + u[0] * i * bay + v[0] * j * w / (lines - 1)), y, st3(Z + u[1] * i * bay + v[1] * j * w / (lines - 1))]; };
    var top = stCz(tiers[tiers.length - 1], o.beam), made = [], roll = o.dir === 'y' ? 90 : 0, nc = 0, nb = 0, ns = 0, nx = 0;
    function mm(a, b, sec, r, tag, n) { made.push({ a: a, b: b, s: sec, r: r, k: mk + '-' + tag + n }); }
    for (var i = 0; i <= bays; i++) for (var j = 0; j < lines; j++) mm(P(i, j, 0), P(i, j, top), o.col, roll, 'C', ++nc);
    for (var i2 = 0; i2 <= bays; i2++) tiers.forEach(function (t) { for (var j2 = 0; j2 < lines - 1; j2++) mm(P(i2, j2, stCz(t, o.beam)), P(i2, j2 + 1, stCz(t, o.beam)), o.beam, 0, 'B', ++nb); });
    tiers.forEach(function (t) { for (var i3 = 0; i3 < bays; i3++) for (var j3 = 0; j3 < lines; j3++) mm(P(i3, j3, stCz(t, o.strut)), P(i3 + 1, j3, stCz(t, o.strut)), o.strut, 0, 'S', ++ns); });
    if (o.bracing !== 'none' && OWN(SSEC, o.brace)) {
      for (var k = 0; k < bays; k++) {
        if (o.bracing === 'end' && k !== 0 && k !== bays - 1) continue;
        [0, lines - 1].forEach(function (jj) { mm(P(k, jj, 0), P(k + 1, jj, top), o.brace, 0, 'X', ++nx); mm(P(k + 1, jj, 0), P(k, jj, top), o.brace, 0, 'X', ++nx); });
      }
    }
    pushHist(); made.forEach(function (m) { model.steel.m.push(m); }); changed(); return made.length;
  }
  function stFrame(ei, o) {                                         // four legs and a beam ring under equipment ei, and the equipment is set on top
    var E = model.equip[ei]; if (!E) return 0; o = Object.assign({}, stP, o || {});
    var f = stFoot(E, 0), tos = Number(o.fh) / 1000, ins = Number(o.finset) / 1000; if (!f || !(tos > 0.2) || !OWN(SSEC, o.fleg) || !OWN(SSEC, o.fbeam)) return 0;
    var bx = f.box, c = Math.cos(f.th), s = Math.sin(f.th), rot = function (x, z) { return [E.p[0] + x * c + z * s, E.p[2] - x * s + z * c]; };
    var C = [rot(bx.x0 + ins, bx.z0 + ins), rot(bx.x1 - ins, bx.z0 + ins), rot(bx.x1 - ins, bx.z1 - ins), rot(bx.x0 + ins, bx.z1 - ins)], zb = stCz(tos, o.fbeam), made = [], roll = ((Math.round(-(E.r || 0) * 90) % 360) + 360) % 360, mk = stTag(ei).replace(/[^A-Za-z0-9]+/g, '').slice(0, 10) || 'EQ';
    var newY = st3(tos - bx.y0);
    if (Math.abs(E.p[1] - newY) > 0.001 && eqNozEnds(ei) > 0) { toast('Pipes are tied to the nozzles. Move the equipment to ' + Math.round(tos * 1000) + ' mm first, or take the pipes off.'); return 0; }
    C.forEach(function (q, i) { made.push({ a: [st3(q[0]), 0, st3(q[1])], b: [st3(q[0]), zb, st3(q[1])], s: o.fleg, r: roll, k: mk + '-L' + (i + 1) }); });
    C.forEach(function (q, i) { var n = C[(i + 1) % 4]; made.push({ a: [st3(q[0]), zb, st3(q[1])], b: [st3(n[0]), zb, st3(n[1])], s: o.fbeam, r: 0, k: mk + '-B' + (i + 1) }); });
    if (o.fbrace === 'x') C.forEach(function (q, i) { var n = C[(i + 1) % 4]; made.push({ a: [st3(q[0]), 0, st3(q[1])], b: [st3(n[0]), zb, st3(n[1])], s: 'L50x50x6', r: 0, k: mk + '-X' + (2 * i + 1) }, { a: [st3(n[0]), 0, st3(n[1])], b: [st3(q[0]), zb, st3(q[1])], s: 'L50x50x6', r: 0, k: mk + '-X' + (2 * i + 2) }); });
    pushHist(); made.forEach(function (m) { model.steel.m.push(m); }); E.p[1] = newY; changed(); return made.length;
  }
  function stPlates(o) {                                            // one plate under every vertical member that stands on the floor
    o = Object.assign({ ove: 75, t: 20, bolt: 'M20', n: 4 }, o || {}); var ove = Number(o.ove) / 1000, t = Number(o.t) / 1000, made = [], seen = {};
    if (!(ove >= 0 && ove <= 0.5) || !(t >= 0.006 && t <= 0.1)) return 0;
    model.steel.m.forEach(function (m) {
      if (Math.abs(m.a[0] - m.b[0]) > 1e-6 || Math.abs(m.a[2] - m.b[2]) > 1e-6 || Math.abs(Math.min(m.a[1], m.b[1])) > 0.01) return;
      var k = m.a[0] + ',' + m.a[2]; if (seen[k]) return; seen[k] = 1;
      var S = SSEC[m.s], across = m.r % 180 === 0 ? [S.b, S.h] : [S.h, S.b];
      made.push(stCleanPlate({ p: [m.a[0], 0, m.a[2]], w: across[0] / 1000 + 2 * ove, d: across[1] / 1000 + 2 * ove, t: t, n: o.n, bolt: o.bolt }));
    });
    made = made.filter(Boolean); pushHist(); model.steel.pl = made; changed(); return made.length;
  }

  // ---------- drawing sheets: plan and elevations to scale, with dimensions ----------
  function stHull(P) {
    P = P.slice().sort(function (a, b) { return a[0] - b[0] || a[1] - b[1]; }); if (P.length < 3) return P;
    var cr = function (o, a, b) { return (a[0] - o[0]) * (b[1] - o[1]) - (a[1] - o[1]) * (b[0] - o[0]); }, lo = [], up = [];
    P.forEach(function (p) { while (lo.length >= 2 && cr(lo[lo.length - 2], lo[lo.length - 1], p) <= 1e-12) lo.pop(); lo.push(p); });
    for (var i = P.length - 1; i >= 0; i--) { var p = P[i]; while (up.length >= 2 && cr(up[up.length - 2], up[up.length - 1], p) <= 1e-12) up.pop(); up.push(p); }
    lo.pop(); up.pop(); return lo.concat(up);
  }
  var ST_SCALES = [20, 25, 50, 75, 100, 150, 200, 250, 300, 500, 750, 1000, 1500, 2000, 3000, 5000];
  function stSheet(view, labels, cut) {                             // view 'plan' (X right, Y up), 'front' (looking along Y), 'side' (looking along X); cut is a frame line in metres
    var W = 1200, H = 849, TB = 96, f1 = function (v) { return Math.round(v * 10) / 10; };
    var uv = view === 'plan' ? function (p) { return [p[0], p[2]]; } : view === 'front' ? function (p) { return [p[0], p[1]]; } : function (p) { return [p[2], p[1]]; };
    var ci = view === 'side' ? 0 : 2, inCut = function (q) { return cut == null || view === 'plan' || Math.abs(q[ci] - cut) < 0.06; };
    var items = [], pts = [];
    model.steel.m.forEach(function (m, i) {
      if (cut != null && view !== 'plan' && !(inCut(m.a) && inCut(m.b))) return;
      var s = SSEC[m.s], B = stBasis(m), P = [];
      [m.a, m.b].forEach(function (e) { [-1, 1].forEach(function (a) { [-1, 1].forEach(function (b) { var q = V(e).addScaledVector(B.x, a * s.b / 2000).addScaledVector(B.y, b * s.h / 2000); P.push(uv([q.x, q.y, q.z])); }); }); });
      var hp = stHull(P); hp.forEach(function (q) { pts.push(q); });
      items.push({ t: 'm', i: i, poly: hp, mid: uv([(m.a[0] + m.b[0]) / 2, (m.a[1] + m.b[1]) / 2, (m.a[2] + m.b[2]) / 2]), L: Math.hypot(uv(m.a)[0] - uv(m.b)[0], uv(m.a)[1] - uv(m.b)[1]) });
    });
    model.steel.pl.forEach(function (q) {
      if (cut != null && view !== 'plan' && !inCut(q.p)) return;
      var poly = view === 'plan' ? [[q.p[0] - q.w / 2, q.p[2] - q.d / 2], [q.p[0] + q.w / 2, q.p[2] - q.d / 2], [q.p[0] + q.w / 2, q.p[2] + q.d / 2], [q.p[0] - q.w / 2, q.p[2] + q.d / 2]] : (function () { var h = (view === 'front' ? q.w : q.d) / 2, c = view === 'front' ? q.p[0] : q.p[2]; return [[c - h, q.p[1]], [c + h, q.p[1]], [c + h, q.p[1] + q.t], [c - h, q.p[1] + q.t]]; })();
      poly.forEach(function (pt) { pts.push(pt); }); items.push({ t: 'p', poly: poly, q: q });
    });
    model.equip.forEach(function (E, i) {
      var f = stFoot(E, 0); if (!f) return; var cl = stClear(E), fc = cl ? stFoot(E, cl) : null, uvs = f.c.map(function (q) { return view === 'plan' ? q : view === 'front' ? [q[0], 0] : [q[1], 0]; });
      var u0 = Math.min.apply(null, uvs.map(function (q) { return q[0]; })), u1 = Math.max.apply(null, uvs.map(function (q) { return q[0]; }));
      if (cut != null && view !== 'plan') { var cs = f.c.map(function (q) { return q[view === 'side' ? 0 : 1]; }); if (cut < Math.min.apply(null, cs) - 0.06 || cut > Math.max.apply(null, cs) + 0.06) return; }
      var poly = view === 'plan' ? f.c : [[u0, f.y0], [u1, f.y0], [u1, f.y1], [u0, f.y1]];
      poly.forEach(function (q) { pts.push(q); }); if (fc && view === 'plan') fc.c.forEach(function (q) { pts.push(q); }); items.push({ t: 'e', i: i, poly: poly, cl: view === 'plan' && fc ? fc.c : null });
    });
    var title = ((model.title || {}).project || '').slice(0, 60);
    if (!pts.length) return null;
    var u0 = Math.min.apply(null, pts.map(function (q) { return q[0]; })), u1 = Math.max.apply(null, pts.map(function (q) { return q[0]; })), v0 = Math.min.apply(null, pts.map(function (q) { return q[1]; })), v1 = Math.max.apply(null, pts.map(function (q) { return q[1]; }));
    var ax = 110, ay = 50, aw = W - ax - 60, ah = H - TB - ay - 90;
    var pm = Math.min(aw / Math.max(u1 - u0, 0.5), ah / Math.max(v1 - v0, 0.5)), ratio = ST_SCALES.filter(function (r) { return 1000 / (r * 0.35) <= pm + 1e-9; })[0] || ST_SCALES[ST_SCALES.length - 1];
    pm = 1000 / (ratio * 0.35);                                     // 1 px is 0.35 mm of paper on A3 (1200 px = 420 mm): the scale is true
    var ox = ax + (aw - (u1 - u0) * pm) / 2, oy = ay + (ah - (v1 - v0) * pm) / 2 + (v1 - v0) * pm;
    var X = function (u) { return f1(ox + (u - u0) * pm); }, Y = function (v) { return f1(oy - (v - v0) * pm); };
    var o = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ' + W + ' ' + H + '" font-family="Arial, sans-serif"><rect width="' + W + '" height="' + H + '" fill="#fff"/><rect x="14" y="14" width="' + (W - 28) + '" height="' + (H - 28) + '" fill="none" stroke="#111" stroke-width="1.4"/>';
    var path = function (P) { return P.map(function (q, k) { return (k ? 'L' : 'M') + X(q[0]) + ' ' + Y(q[1]); }).join('') + 'Z'; };
    items.filter(function (it) { return it.t === 'e' && it.cl; }).forEach(function (it) { o += '<path d="' + path(it.cl) + '" fill="none" stroke="#b07a1a" stroke-width="0.8" stroke-dasharray="6 3"/>'; });
    items.filter(function (it) { return it.t === 'p'; }).forEach(function (it) {
      o += '<path d="' + path(it.poly) + '" fill="#9aa5ad" stroke="#111" stroke-width="0.9"/>';
      if (view === 'plan') { var q = it.q, bx = q.w / 2 - 0.04, bz = q.d / 2 - 0.04; [[-bx, -bz], [bx, -bz], [bx, bz], [-bx, bz]].forEach(function (c) { o += '<circle cx="' + X(q.p[0] + c[0]) + '" cy="' + Y(q.p[2] + c[1]) + '" r="' + Math.max(1.4, f1(ST_BOLTS[q.bolt] / 2000 * pm)) + '" fill="#fff" stroke="#111" stroke-width="0.6"/>'; }); }
    });
    items.filter(function (it) { return it.t === 'm'; }).forEach(function (it) { o += '<path d="' + path(it.poly) + '" fill="#e4e9ec" stroke="#111" stroke-width="0.9" stroke-linejoin="round"/>'; });
    var used = [];
    items.filter(function (it) { return it.t === 'e'; }).forEach(function (it) {
      var xs = it.poly.map(function (q) { return q[0]; }), ys = it.poly.map(function (q) { return q[1]; }), cx = (Math.min.apply(null, xs) + Math.max.apply(null, xs)) / 2, cy = (Math.min.apply(null, ys) + Math.max.apply(null, ys)) / 2, tg = stTag(it.i), nm = eqLabel(model.equip[it.i].k);
      o += '<path d="' + path(it.poly) + '" fill="#bfe5e2" fill-opacity="0.75" stroke="#0b5d58" stroke-width="1.3"/><text x="' + X(cx) + '" y="' + Y(cy) + '" text-anchor="middle" font-size="10" font-weight="bold" fill="#063d3a">' + esc(tg) + '</text><text x="' + X(cx) + '" y="' + (Y(cy) + 11) + '" text-anchor="middle" font-size="8" fill="#063d3a">' + esc(nm) + '</text>';
      used.push([Math.min.apply(null, xs.map(X)), Math.min.apply(null, ys.map(Y)), Math.max.apply(null, xs.map(X)), Math.max.apply(null, ys.map(Y))]);
    });
    if (labels) items.filter(function (it) { return it.t === 'm' && it.L * pm > 46; }).sort(function (a, b) { return b.L - a.L; }).forEach(function (it) {   // longest first; a label that would land on another label or on equipment is left out
      var m = model.steel.m[it.i], tx = esc(m.k || SSEC[m.s].name.replace(/^[A-Z]+ /, '')), w = tx.length * 3.7, cx = X(it.mid[0]), cy = Y(it.mid[1]) - 3, bx = [cx - w / 2 - 1, cy - 7, cx + w / 2 + 1, cy + 2];
      if (used.some(function (u) { return bx[0] < u[2] && bx[2] > u[0] && bx[1] < u[3] && bx[3] > u[1]; })) return; used.push(bx);
      o += '<text x="' + cx + '" y="' + cy + '" text-anchor="middle" font-size="6.5" fill="#1a3a50" paint-order="stroke" stroke="#fff" stroke-width="2">' + tx + '</text>';
    });
    var colsU = [], colsV = [], lev = [];
    model.steel.m.forEach(function (m) {
      if (cut != null && view !== 'plan' && !(inCut(m.a) && inCut(m.b))) return;
      if (Math.abs(m.a[0] - m.b[0]) < 1e-6 && Math.abs(m.a[2] - m.b[2]) < 1e-6) { colsU.push(uv(m.a)[0]); if (view === 'plan') colsV.push(m.a[2]); }
      if (view !== 'plan') [m.a, m.b].forEach(function (q) { if (q[1] > 0.01) lev.push(q[1]); });
    });
    items.filter(function (it) { return it.t === 'e'; }).forEach(function (it) { var E = model.equip[it.i], f = stFoot(E, 0); colsU.push(view === 'side' ? E.p[2] : E.p[0]); if (view === 'plan') colsV.push(E.p[2]); else { lev.push(f.y1); if (f.y0 > 0.01) lev.push(f.y0); } });
    var uniq = function (a) { a = a.map(function (v) { return Math.round(v * 1000) / 1000; }).sort(function (x, y) { return x - y; }); return a.filter(function (v, i) { return !i || v - a[i - 1] > 0.0015; }); };
    function chain(vals, horiz, off) {
      vals = uniq(vals); if (vals.length < 2) return '';
      var d = '', tick = function (p) { return horiz ? '<line x1="' + p + '" y1="' + (off - 5) + '" x2="' + p + '" y2="' + (off + 5) + '" stroke="#111" stroke-width="1"/>' : '<line x1="' + (off - 5) + '" y1="' + p + '" x2="' + (off + 5) + '" y2="' + p + '" stroke="#111" stroke-width="1"/>'; };
      var P = vals.map(function (v) { return horiz ? X(v) : Y(v); });
      d += horiz ? '<line x1="' + P[0] + '" y1="' + off + '" x2="' + P[P.length - 1] + '" y2="' + off + '" stroke="#111" stroke-width="0.8"/>' : '<line x1="' + off + '" y1="' + P[0] + '" x2="' + off + '" y2="' + P[P.length - 1] + '" stroke="#111" stroke-width="0.8"/>';
      P.forEach(function (p) { d += tick(p); });
      for (var i = 1; i < vals.length; i++) {
        var mid = (P[i] + P[i - 1]) / 2, g = Math.round((vals[i] - vals[i - 1]) * 1000); if (Math.abs(P[i] - P[i - 1]) < 26) continue;
        d += horiz ? '<text x="' + f1(mid) + '" y="' + (off - 4) + '" text-anchor="middle" font-size="9" fill="#111">' + g + '</text>' : '<text transform="translate(' + (off - 4) + ' ' + f1(mid) + ') rotate(-90)" text-anchor="middle" font-size="9" fill="#111">' + g + '</text>';
      }
      return d;
    }
    var by = Y(v0) + 26, lx = X(u0) - 34;
    o += chain(colsU, true, by);
    if (colsU.length > 1) o += chain([Math.min.apply(null, colsU), Math.max.apply(null, colsU)], true, by + 18);
    if (view === 'plan') { o += chain(colsV, false, lx); if (colsV.length > 1) o += chain([Math.min.apply(null, colsV), Math.max.apply(null, colsV)], false, lx - 18); }
    else {
      uniq(lev).reduce(function (r, z) { if (!r.length || z - r[r.length - 1] > 0.12) r.push(z); return r; }, []).forEach(function (z) { o += '<line x1="' + (lx - 6) + '" y1="' + Y(z) + '" x2="' + (X(u1) + 20) + '" y2="' + Y(z) + '" stroke="#7a8a96" stroke-width="0.5" stroke-dasharray="2 4"/><text x="' + (lx - 8) + '" y="' + (Y(z) + 3) + '" text-anchor="end" font-size="9" fill="#111">EL +' + Math.round(z * 1000) + '</text>'; });
      o += '<line x1="' + (X(u0) - 20) + '" y1="' + Y(0) + '" x2="' + (X(u1) + 20) + '" y2="' + Y(0) + '" stroke="#111" stroke-width="1.6"/><text x="' + (lx - 8) + '" y="' + (Y(0) + 3) + '" text-anchor="end" font-size="9" fill="#111">EL 0</text>';
    }
    if (view === 'plan') o += '<g transform="translate(' + (W - 80) + ' 80)"><circle r="22" fill="none" stroke="#111"/><path d="M0 -22 L6 8 L0 3 L-6 8Z" fill="#111"/><text y="-28" text-anchor="middle" font-size="12" font-weight="bold">N</text></g>';
    var tb = H - 14 - TB, tot = stTotals(), name = view === 'plan' ? 'PLAN' : cut != null ? 'SECTION AT ' + (view === 'side' ? 'X' : 'Y') + ' = ' + Math.round(cut * 1000) : view === 'front' ? 'ELEVATION, LOOKING ALONG Y' : 'ELEVATION, LOOKING ALONG X', d = new Date(), ds = d.getFullYear() + '-' + ('0' + (d.getMonth() + 1)).slice(-2) + '-' + ('0' + d.getDate()).slice(-2);
    o += '<rect x="14" y="' + tb + '" width="' + (W - 28) + '" height="' + TB + '" fill="none" stroke="#111" stroke-width="1.4"/>';
    [[0.34, 'PROJECT', title || '-'], [0.56, 'VIEW', name], [0.66, 'SCALE', '1:' + ratio], [0.76, 'STEEL', Math.round(tot.kg) + ' kg, ' + tot.n + ' members'], [0.9, 'DATE', ds]].forEach(function (c, k, a) {
      var x0 = 14 + (k ? a[k - 1][0] : 0) * (W - 28); o += (k ? '<line x1="' + x0 + '" y1="' + tb + '" x2="' + x0 + '" y2="' + (H - 14) + '" stroke="#111"/>' : '') + '<text x="' + (x0 + 8) + '" y="' + (tb + 16) + '" font-size="8" fill="#555">' + c[1] + '</text><text x="' + (x0 + 8) + '" y="' + (tb + 44) + '" font-size="14" font-weight="bold" fill="#111">' + esc(c[2]) + '</text>';
    });
    o += '<text x="' + (W - 20) + '" y="' + (tb + 16) + '" text-anchor="end" font-size="8" fill="#555">DIMENSIONS IN mm. LEVELS ARE TO MEMBER CENTRELINE, EQUIPMENT TO ITS BASE AND TOP</text></svg>';
    return o;
  }
  var stView = 'plan', stLab = true, stCut = null;
  function stShowSheet() {
    var svg = stSheet(stView, stLab, stCut);
    if (!svg) { toast('No steel or equipment to draw yet'); return; }
    showSheet('Steel, ' + (stView === 'plan' ? 'plan' : stView === 'front' ? 'front elevation' : 'side elevation') + (stCut != null ? ', section' : ''), svg, 'steel-' + stView + (stCut != null ? '-section' : ''), false);
  }
  function stCutList() {                                            // frame lines a section can be cut on: where columns stand, across the view
    if (stView === 'plan') return []; var k = stView === 'side' ? 0 : 2, a = [];
    model.steel.m.forEach(function (m) { if (Math.abs(m.a[0] - m.b[0]) < 1e-6 && Math.abs(m.a[2] - m.b[2]) < 1e-6) a.push(st3(m.a[k])); });
    return a.sort(function (x, y) { return x - y; }).filter(function (v, i, b) { return !i || v - b[i - 1] > 0.0015; });
  }
