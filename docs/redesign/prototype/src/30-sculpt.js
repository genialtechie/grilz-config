
  // ---------- sculpting: every tooth is one smooth, bulging form, widest near the biting edge and rounding off toward the gum ----------
  // [type, width, crown height, depth] in millimetres; proportions follow the product's hosted model
  var UPPER = [['inc', 9.0, 10.5, 6.4], ['inc', 6.9, 9.2, 5.8], ['can', 7.6, 10.2, 7.2], ['pre', 6.9, 8.0, 8.4], ['pre', 6.5, 7.6, 8.2], ['mol', 10.6, 7.2, 10.2], ['mol', 10.0, 6.8, 10.0], ['mol', 9.0, 6.2, 9.4]];
  var LOWER = [['inc', 5.6, 8.6, 5.4], ['inc', 6.1, 8.9, 5.6], ['can', 6.9, 9.8, 6.8], ['pre', 7.0, 7.9, 7.8], ['pre', 7.1, 7.5, 8.0], ['mol', 10.8, 6.8, 9.8], ['mol', 10.2, 6.4, 9.6], ['mol', 9.4, 5.8, 9.2]];
  // m1i / m1c: how square the outline is at the biting end and the gum end. m2l / m2n: how square the cross-section is on the lip side and the tongue side.
  // neck: width at the gum. thin: how far the biting edge thins. tip: taper to a point (from tf). kl: narrowing on the tongue side. bl: share of the depth in front of the contact line. bulge: how far the face domes out.
  var PAR = {
    inc: { m1i: 3.3, m1c: 2.3, m2l: 3.3, m2n: 2.2, neck: .80, thin: .55, tip: 0, kl: .32, bl: .32, bulge: .17 },
    can: { m1i: 2.8, m1c: 2.2, m2l: 2.9, m2n: 2.2, neck: .82, thin: .38, tip: .2, kl: .30, bl: .36, bulge: .2 },
    fang: { m1i: 2.0, m1c: 2.2, m2l: 2.7, m2n: 2.2, neck: .84, thin: .42, tip: .8, tf: .4, kl: .30, bl: .38, bulge: .18 },
    pre: { m1i: 3.2, m1c: 2.4, m2l: 3.0, m2n: 2.4, neck: .86, thin: .06, tip: 0, kl: .14, bl: .44, bulge: .12, cusp: .075, fos: .08, n: 2, ph: Math.PI / 2 },
    mol: { m1i: 3.6, m1c: 2.6, m2l: 3.4, m2n: 3.0, neck: .90, thin: .02, tip: 0, kl: .08, bl: .47, bulge: .08, cusp: .06, fos: .09, n: 4, ph: Math.PI / 4 }
  };
  var Y0 = .39, Y1 = .61;                 // the form runs from a little under the gum line (y = -0.22 h) to the tip (y = h)
  function ss(a, b, x) { x = Math.min(1, Math.max(0, (x - a) / (b - a))); return x * x * (3 - 2 * x); }
  function srad(a, m) { return Math.pow(Math.pow(Math.abs(Math.cos(a)), m) + Math.pow(Math.abs(Math.sin(a)), m), -1 / m); }
  function sect(def, phi) {
    var p = PAR[def[0]], r1 = srad(phi, phi >= 0 ? p.m1i : p.m1c), ce = r1 * Math.cos(phi), se = r1 * Math.sin(phi), t = (se + 1) / 2;
    var wf = p.neck + (1 - p.neck) * ss(.1, .62, t); if (p.tip) wf *= 1 - p.tip * ss(p.tf || .66, 1, t);
    return { ce: ce, se: se, t: t, wf: wf, df: 1 - p.thin * ss(.45, 1, t) };
  }
  // a point on the tooth: phi runs root to tip, th runs round the tooth (th = 90 degrees is the lip side). The arch line passes through z = 0, where the tooth is widest.
  function S(def, phi, th, out) {
    var p = PAR[def[0]], w = def[1], h = def[2], d = def[3], q = sect(def, phi), lab = Math.sin(th) >= 0, r2 = srad(th, lab ? p.m2l : p.m2n), cx = r2 * Math.cos(th), cz = r2 * Math.sin(th);
    var x = w / 2 * q.wf * q.ce * cx, z;
    if (lab) z = d * p.bl * q.df * q.ce * cz + d * p.bulge * q.ce * (1 - cx * cx);
    else { z = d * (1 - p.bl) * q.df * q.ce * cz; x *= 1 + p.kl * cz; }
    z += d * p.bl * (1 - q.df) * .9;
    var y = Y0 * h + Y1 * h * q.se;
    if (p.cusp) { var tw = ss(.55, .95, q.t); y += h * p.cusp * tw * q.ce * Math.cos(p.n * (th - p.ph)) - h * p.fos * tw * (1 - q.ce) * (1 - q.ce); }
    return out.set(x, y, z);
  }
  var _a = new V3(), _b = new V3(), _c = new V3(), _d = new V3();
  function normalAt(def, phi, th, out) {
    if (Math.abs(phi) > Math.PI / 2 - .02) return out.set(0, phi > 0 ? 1 : -1, 0);
    var e = .004; S(def, phi, th + e, _a); S(def, phi, th - e, _b); _a.sub(_b); S(def, phi + e, th, _c); S(def, phi - e, th, _d); _c.sub(_d);
    return out.crossVectors(_c, _a).normalize();
  }
  function solve(f, lo, hi) { for (var k = 0; k < 34; k++) { var mid = (lo + hi) / 2; if (f(mid) > 0) hi = mid; else lo = mid; } return (lo + hi) / 2; }
  function phiForY(def, y) { var se = Math.max(-.999, Math.min(.999, (y - Y0 * def[2]) / (Y1 * def[2]))), p = PAR[def[0]]; return solve(function (a) { return srad(a, a >= 0 ? p.m1i : p.m1c) * Math.sin(a) - se; }, -Math.PI / 2, Math.PI / 2); }
  function thForX(def, cxn) { var m = PAR[def[0]].m2l; return solve(function (a) { return cxn - srad(a, m) * Math.cos(a); }, 0, Math.PI); }
  var CAP_OFF = .24, LIP = .4, WIN = 1.45;   // a cap sits a quarter of a millimetre proud of the tooth; its edge shows a lip; an open face leaves a frame this wide
  var SIDE = { deep: .27, permanent: .06 };  // how far a cap's edge arches away from the gum between teeth: deep cut shows each tooth, the permanent look runs straight
  function margin(def, th, side) { var s = side * def[2]; return Math.sin(th) > 0 ? -.35 + (s + .35) * Math.pow(Math.abs(Math.cos(th)), 3.2) : s; }
  function facePoint(def, x, y, P, N) {   // the point on a cap's lip-side face above (x, y), and which way it faces
    var phi = phiForY(def, y), q = sect(def, phi), half = def[1] / 2 * q.wf * q.ce, th = thForX(def, Math.max(-.999, Math.min(.999, x / half)));
    S(def, phi, th, P); normalAt(def, phi, th, N); P.y += N.y * CAP_OFF; P.z += N.z * CAP_OFF; return half;
  }
  function onFace(def, x, y, inset, side) {  // is (x, y) on the cap's face, at least `inset` from its edge?
    var h = def[2]; if (y > h - inset * .8 || y < -.35) return false;
    var phi = phiForY(def, y), q = sect(def, phi), half = def[1] / 2 * q.wf * q.ce; if (Math.abs(x) > half - inset) return false;
    return y >= margin(def, thForX(def, x / half), side) + inset;
  }
  var cache = {};
  function memo(key, make) { return cache[key] || (cache[key] = make()); }
  function dkey(def, side) { return def.join('_') + '|' + side; }
  function outline(def, side, inset, n) {     // the face's outline, `inset` in from its edge, as points round its centre
    return memo('ol' + dkey(def, side) + inset + n, function () {
      var pts = [], yc = def[2] * .45;
      for (var k = 0; k < n; k++) { var a = k / n * Math.PI * 2, ca = Math.cos(a), sa = Math.sin(a), rho = solve(function (r) { return onFace(def, r * ca, yc + r * sa, inset, side) ? -1 : 1; }, 0, 14); pts.push([rho * ca, yc + rho * sa]); }
      return pts;
    });
  }
  function orient(geo, closed) {          // make every face point outwards
    var p = geo.attributes.position, ix = geo.index.array, c = new V3(), vol = 0, k;
    if (!closed) { for (k = 0; k < p.count; k++) c.add(_a.fromBufferAttribute(p, k)); c.multiplyScalar(1 / p.count); }
    for (k = 0; k < ix.length; k += 3) { _a.fromBufferAttribute(p, ix[k]).sub(c); _b.fromBufferAttribute(p, ix[k + 1]).sub(c); _c.fromBufferAttribute(p, ix[k + 2]).sub(c); vol += _a.dot(_b.cross(_c)); }
    if (vol < 0) for (k = 0; k < ix.length; k += 3) { var t = ix[k + 1]; ix[k + 1] = ix[k + 2]; ix[k + 2] = t; }
    geo.computeVertexNormals(); return geo;
  }
  function grid(idx, rings, NU) { for (var k = 0; k < rings - 1; k++) for (var j = 0; j < NU; j++) { var a = k * NU + j, b = k * NU + (j + 1) % NU, c = a + NU, d = b + NU; idx.push(a, c, b, b, c, d); } }
  function bufGeo(pos, idx, uv) { var g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); if (uv) g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2)); g.setIndex(idx); return g; }
  function toothGeo(def) {                // the whole tooth, closed at both ends
    return memo('t' + def.join('_'), function () {
      var NU = 56, NV = 40, pos = [], idx = [], v = new V3(), k, j;
      function put(phi, th) { S(def, phi, th, v); pos.push(v.x * MM, v.y * MM, v.z * MM); }
      for (k = 1; k < NV; k++) { var phi = -Math.PI / 2 + Math.PI * k / NV; for (j = 0; j < NU; j++) put(phi, j / NU * Math.PI * 2); }
      grid(idx, NV - 1, NU);
      var tip = pos.length / 3; put(Math.PI / 2, 0); for (j = 0; j < NU; j++) idx.push(tip, (NV - 2) * NU + (j + 1) % NU, (NV - 2) * NU + j);
      var root = pos.length / 3; put(-Math.PI / 2, 0); for (j = 0; j < NU; j++) idx.push(root, j, (j + 1) % NU);
      return orient(bufGeo(pos, idx), true);
    });
  }
  function capGeo(def, side) {            // the grill cap: the tooth's face and edge, a little fuller, stopping at an arched edge with a lip
    return memo('c' + dkey(def, side), function () {
      var NU = 60, NV = 30, pos = [], uv = [], idx = [], v = new V3(), n = new V3(), k, j, start = [], w = def[1], h = def[2];
      function put(phi, th, lip) {
        S(def, phi, th, v); normalAt(def, phi, th, n);
        if (Math.sin(th) > .03) uv.push(v.x / w + .5, (v.y + 1) / (h + 2)); else uv.push(3, 3);
        v.y += n.y * CAP_OFF; v.z += n.z * CAP_OFF; if (lip) v.addScaledVector(n, -LIP); pos.push(v.x * MM, v.y * MM, v.z * MM);
      }
      for (j = 0; j < NU; j++) { var th = j / NU * Math.PI * 2; start[j] = phiForY(def, margin(def, th, side)); put(start[j], th, true); }
      for (k = 0; k < NV; k++) for (j = 0; j < NU; j++) put(start[j] + (Math.PI / 2 - start[j]) * k / NV, j / NU * Math.PI * 2, false);
      grid(idx, NV + 1, NU);
      var tip = pos.length / 3; put(Math.PI / 2, Math.PI / 2, false); for (j = 0; j < NU; j++) idx.push(tip, NV * NU + (j + 1) % NU, NV * NU + j);
      return orient(bufGeo(pos, idx, uv), false);
    });
  }
  function patchGeo(def, side, inset, lift, u0, u1, v0, v1) {   // a panel lying on the cap's face: for opal, a printed photo, or letters
    var ol = outline(def, side, inset, 72), NR = 7, pos = [], uv = [], idx = [], P = new V3(), N = new V3(), yc = def[2] * .45, r, k, w = def[1], h = def[2];
    function put(x, y) { facePoint(def, x, y, P, N); P.addScaledVector(N, lift); pos.push(P.x * MM, P.y * MM, P.z * MM); uv.push(u0 + (x / w + .5) * (u1 - u0), v0 + y / h * (v1 - v0)); }
    put(0, yc);
    for (r = 1; r <= NR; r++) for (k = 0; k < 72; k++) put(ol[k][0] * r / NR, yc + (ol[k][1] - yc) * r / NR);
    for (k = 0; k < 72; k++) idx.push(0, 1 + k, 1 + (k + 1) % 72);
    for (r = 0; r < NR - 1; r++) for (k = 0; k < 72; k++) { var a = 1 + r * 72 + k, b = 1 + r * 72 + (k + 1) % 72, c = a + 72, d = b + 72; idx.push(a, c, b, b, c, d); }
    return orient(bufGeo(pos, idx, uv), false);
  }
  function rimGeo(def, side, inset, tube) {   // a thin raised gold line following the face's outline
    return memo('r' + dkey(def, side) + inset + tube, function () {
      var P = new V3(), N = new V3(), pts = outline(def, side, inset, 96).map(function (p) { facePoint(def, p[0], p[1], P, N); return P.clone().addScaledVector(N, .05).multiplyScalar(MM); });
      return new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts, true), 160, tube * MM, 6, true);
    });
  }
  function maskTex(def, side) {           // an open face: the part of the cap that is cut away
    return memo('m' + dkey(def, side), function () {
      var W = 72, H = 96, c = document.createElement('canvas'); c.width = W; c.height = H; var x = c.getContext('2d'), im = x.createImageData(W, H), w = def[1], h = def[2];
      for (var j = 0; j < H; j++) for (var i2 = 0; i2 < W; i2++) { var u = (i2 + .5) / W, v = 1 - (j + .5) / H, inside = onFace(def, (u - .5) * w, v * (h + 2) - 1, WIN, side), k = (j * W + i2) * 4; im.data[k] = im.data[k + 1] = im.data[k + 2] = inside ? 0 : 255; im.data[k + 3] = 255; }
      x.putImageData(im, 0, 0); var t = new THREE.CanvasTexture(c); t.minFilter = t.magFilter = THREE.LinearFilter; t.generateMipmaps = false; return t;
    });
  }

  // ---------- set stones: small cut stones packed edge to edge inside a thin gold rim ----------
  var gemGeo = (function () {
    var seg = 8, step = Math.PI * 2 / seg, tr = .6, th = .34, pos = [], mid = new V3(0, -.2, 0);
    function P(r, y, a) { return new V3(r * Math.cos(a), y, r * Math.sin(a)); }
    function tri(a, b, c) { var n = new V3().subVectors(b, a).cross(new V3().subVectors(c, a)), ctr = new V3().add(a).add(b).add(c).multiplyScalar(1 / 3).sub(mid); if (n.dot(ctr) < 0) { var t = b; b = c; c = t; } pos.push(a.x, a.y, a.z, b.x, b.y, b.z, c.x, c.y, c.z); }
    for (var k = 0; k < seg; k++) {
      var t0 = P(tr, th, k * step), t1 = P(tr, th, (k + 1) * step), g0 = P(1, 0, (k - .5) * step), g1 = P(1, 0, (k + .5) * step);
      tri(new V3(0, th, 0), t0, t1); tri(t0, t1, g1); tri(t0, g1, g0);
      tri(g0, g1, P(1, -.3, (k + .5) * step)); tri(g0, P(1, -.3, (k + .5) * step), P(1, -.3, (k - .5) * step));
    }
    var g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.computeVertexNormals(); return g;
  })();
  var beadGeo = new THREE.SphereGeometry(1, 10, 8), UPY = new V3(0, 1, 0), UPZ = new V3(0, 0, 1), RIM = .3, TUBE = .12;
  function stoneLayout(def, side, setting, open) {   // where every stone sits, worked out once per tooth shape
    return memo('s' + dkey(def, side) + setting + open, function () {
      var stones = [], beads = [], spots = [], P = new V3(), N = new V3(), m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), q2 = new THREE.Quaternion(), sc = new V3(), h = def[2], seed = 7 + def[1] * 31 + h * 17, x, y, k, row;
      function rnd() { seed = (seed * 16807) % 2147483647; return seed / 2147483647; }
      function place(px, py, rad) {
        facePoint(def, px, py, P, N); if (N.z < .28) return false;
        P.addScaledVector(N, .02); q.setFromUnitVectors(UPY, N); q2.setFromAxisAngle(UPY, rnd() * 6.283); q.multiply(q2); sc.setScalar(rad * MM);
        stones.push(m4.compose(P.clone().multiplyScalar(MM), q, sc).clone()); spots.push({ p: P.clone().multiplyScalar(MM), n: N.clone(), r: rad }); return true;
      }
      function bead(px, py, rad) { facePoint(def, px, py, P, N); P.addScaledVector(N, .06); sc.setScalar(rad * MM); beads.push(m4.compose(P.clone().multiplyScalar(MM), q.identity(), sc).clone()); }
      if (open) {                         // an iced open face: one row of stones round the frame
        var ol = outline(def, side, RIM + TUBE + .42, 220), acc = 0, rad0 = .37;
        for (k = 0; k < ol.length; k++) { var a = ol[k], b = ol[(k + 1) % ol.length]; acc += Math.hypot(b[0] - a[0], b[1] - a[1]); if (acc >= rad0 * 2.04) { acc = 0; place(b[0], b[1], rad0); } }
      } else if (setting === 'prong') {   // even rows, a gold bead at every corner
        var pp = .98, pr = .46, ins = RIM + TUBE + pr + .04, K = Math.ceil(def[1] / 2 / pp) + 1;
        for (y = -.3 + ins, row = 0; y <= h; y += pp, row++) for (k = -K; k <= K; k++) { x = k * pp; if (onFace(def, x, y, ins, side)) place(x, y, pr); if (onFace(def, x + pp / 2, y + pp / 2, ins + .1, side)) bead(x + pp / 2, y + pp / 2, .15); }
      } else if (setting === 'mosaic') {  // a few larger stones, the gaps packed with small ones
        var big = [], BR = .68, SR = .33, bp = 2.25, sp = .68, K2 = Math.ceil(def[1] / 2 / sp) + 1;
        for (y = .9, row = 0; y <= h; y += bp * .82, row++) for (k = -3; k <= 3; k++) { x = (k + (row % 2 ? .5 : 0)) * bp + (rnd() - .5) * .5; var yy = y + (rnd() - .5) * .5; if (onFace(def, x, yy, RIM + TUBE + BR + .05, side) && place(x, yy, BR)) big.push([x, yy]); }
        for (y = -.3 + RIM + TUBE + SR, row = 0; y <= h; y += sp * .866, row++) for (k = -K2; k <= K2; k++) {
          x = (k + (row % 2 ? .5 : 0)) * sp; if (!onFace(def, x, y, RIM + TUBE + SR + .04, side)) continue;
          if (big.some(function (g) { return Math.hypot(g[0] - x, g[1] - y) < BR + SR + .03; })) continue; place(x, y, SR);
        }
      } else {                            // honeycomb: tight pavé
        var rad = .43, pitch = .86, inset = RIM + TUBE + rad + .04, K3 = Math.ceil(def[1] / 2 / pitch) + 1;
        for (y = -.3 + inset, row = 0; y <= h; y += pitch * .866, row++) for (k = -K3; k <= K3; k++) { x = (k + (row % 2 ? .5 : 0)) * pitch; if (onFace(def, x, y, inset, side)) place(x, y, rad); }
      }
      return { stones: stones, beads: beads, spots: spots };
    });
  }

  // ---------- one-of-one charms: raised pieces built from drawn outlines. Generic versions of the motifs in the reference, made from scratch. ----------
  var charmGeo = {};
  function ext(shape, depth, bevel) { return new THREE.ExtrudeGeometry(shape, { depth: depth, bevelEnabled: true, bevelThickness: bevel, bevelSize: bevel, bevelSegments: 4, curveSegments: 22 }); }
  function shield(k) { var s = new THREE.Shape(); s.moveTo(-3.4 * k, 3.8 * k); s.quadraticCurveTo(-1.7 * k, 3.2 * k, 0, 4.2 * k); s.quadraticCurveTo(1.7 * k, 3.2 * k, 3.4 * k, 3.8 * k); s.bezierCurveTo(3.6 * k, .5 * k, 2.6 * k, -2.6 * k, 0, -4.4 * k); s.bezierCurveTo(-2.6 * k, -2.6 * k, -3.6 * k, .5 * k, -3.4 * k, 3.8 * k); return s; }
  function poly(pts) { var s = new THREE.Shape(); pts.forEach(function (p, n) { if (n) s.lineTo(p[0], p[1]); else s.moveTo(p[0], p[1]); }); s.closePath(); return s; }
  function oval(rx, ry) { var s = new THREE.Shape(); s.absellipse(0, 0, rx, ry, 0, Math.PI * 2, false, 0); return s; }
  var OX = '0x55101a', GREEN = '0x0c3d27', BROWN = '0x3a2212';
  function charmParts(id) {               // pieces with sizes in millimetres, facing forward; built once per charm
    if (charmGeo[id]) return charmGeo[id];
    var parts = [], sph = new THREE.SphereGeometry(1, 28, 18), k;
    function add(g, role, x, y, z, s, rz) { parts.push({ g: g, role: role, x: x || 0, y: y || 0, z: z || 0, s: s || 1, rz: rz || 0 }); }
    function stretch(g, role, x, y, z, sx, sy, sz) { parts.push({ g: g, role: role, x: x, y: y, z: z, s: 1, rz: 0, sx: sx, sy: sy, sz: sz }); }
    if (id === 'crest') {                 // a plain quartered shield
      add(ext(shield(1), .55, .26), 'gold', 0, 0, 0);
      add(ext(poly([[-2.55, 2.85], [0, 3.15], [0, .4], [-2.6, .4]]), .1, .05), 'e:' + OX, 0, .05, .82); add(ext(poly([[0, 3.15], [2.55, 2.85], [2.6, .4], [0, .4]]), .1, .05), 'e:' + GREEN, 0, .05, .82);
      add(ext(poly([[-2.6, .4], [0, .4], [0, -3.3], [-1.75, -1.9]]), .1, .05), 'e:' + GREEN, 0, .05, .82); add(ext(poly([[0, .4], [2.6, .4], [1.75, -1.9], [0, -3.3]]), .1, .05), 'e:' + OX, 0, .05, .82);
      add(ext(poly([[-.2, 3.2], [.2, 3.2], [.2, -3.3], [-.2, -3.3]]), .16, .08), 'gold', 0, .05, .95); add(ext(poly([[-2.7, .24], [2.7, .24], [2.7, .66], [-2.7, .66]]), .16, .08), 'gold', 0, .05, .95);
      parts.w = 7.4; parts.h = 8.8;
    } else if (id === 'tri') {            // a raised triangle with a stone at its centre
      var t3 = poly([[0, 3.7], [-3.4, -2.4], [3.4, -2.4]]), hole = new THREE.Path(); hole.moveTo(0, 2.2); hole.lineTo(2.1, -1.6); hole.lineTo(-2.1, -1.6); hole.closePath(); t3.holes.push(hole);
      add(ext(t3, .5, .2), 'gold', 0, 0, 0); stretch(new THREE.TorusGeometry(1, .16, 10, 36), 'gold', 0, -.45, .45, 1.05, 1.05, 2); add(gemGeo, 'diamond', 0, -.45, .5, .9);
      parts.w = 7.2; parts.h = 6.6; parts.cy = .6;
    } else if (id === 'orb') {            // a ball with a pair of feathered wings
      [-1, 1].forEach(function (sd) {
        for (k = 0; k < 4; k++) { var L = 3.0 + k * .85, ang = (18 + k * 17) * Math.PI / 180; parts.push({ g: ext(oval(L / 2, .62), .2, .14), role: 'gold', x: sd * (1.0 + Math.cos(ang) * L / 2), y: -1.4 + Math.sin(ang) * L / 2, z: .1 + (3 - k) * .1, s: 1, rz: sd > 0 ? ang : Math.PI - ang }); }
        for (k = 0; k < 4; k++) { var a4 = 69 * Math.PI / 180, dd = 1.5 + k * 1.05; add(gemGeo, 'diamond', sd * (1.0 + Math.cos(a4) * dd), -1.4 + Math.sin(a4) * dd, .52, .42); }
      });
      add(sph, 'gold', 0, -1.6, .7, 1.45);
      parts.w = 9.6; parts.h = 6.6; parts.cy = .4;
    } else if (id === 'crown') {
      add(ext(poly([[-3.4, -2.4], [3.4, -2.4], [3.8, 2.0], [2.85, .3], [1.9, 2.6], [.95, .3], [0, 3.2], [-.95, .3], [-1.9, 2.6], [-2.85, .3], [-3.8, 2.0]]), .5, .24), 'gold', 0, 0, 0);
      [[-3.8, 2.0], [-1.9, 2.6], [0, 3.2], [1.9, 2.6], [3.8, 2.0]].forEach(function (p) { add(sph, 'gold', p[0], p[1] + .15, .5, .46); });
      add(gemGeo, 'f:0x1d49c8', -2.05, -1.35, .78, .62); add(gemGeo, 'diamond', 0, -1.35, .78, .7); add(gemGeo, 'f:0x1d49c8', 2.05, -1.35, .78, .62);
      parts.w = 8.0; parts.h = 6.2;
    } else if (id === 'hat') {            // a plain crooked pointed hat
      add(ext(poly([[-2.4, -2.3], [2.4, -2.3], [1.7, -.4], [1.25, 1.3], [1.9, 2.5], [3.0, 3.0], [1.6, 3.5], [.2, 2.6], [-.6, .9], [-1.5, -.8]]), .6, .3), 'e:' + BROWN, 0, 0, 0);
      add(ext(oval(4.0, .85), .3, .22), 'e:' + BROWN, 0, -2.6, .35); add(ext(poly([[-2.2, -2.2], [2.2, -2.2], [1.95, -1.5], [-1.9, -1.5]]), .12, .08), 'gold', 0, 0, .92);
      parts.w = 8.6; parts.h = 7.2; parts.cy = .2;
    } else if (id === 'broom') {          // a broomstick that lies across more than one tooth
      var bar = new THREE.CylinderGeometry(.34, .34, 12.4, 14); bar.rotateZ(Math.PI / 2); add(bar, 'gold', -3.0, 0, .55); add(sph, 'gold', -9.2, 0, .55, .36);
      var br = new THREE.Shape(); br.moveTo(3.0, .5); br.bezierCurveTo(5.0, 2.0, 8.0, 1.7, 9.3, .55); br.lineTo(8.8, .15); br.lineTo(9.5, -.3); br.lineTo(8.8, -.6); br.bezierCurveTo(7.6, -1.8, 5.0, -2.0, 3.0, -.5); br.closePath();
      add(ext(br, .5, .34), 'e:' + BROWN, 0, 0, .1);
      add(ext(poly([[3.25, -.85], [3.75, -.95], [3.75, .95], [3.25, .85]]), .2, .12), 'gold', 0, 0, .78); add(ext(poly([[4.25, -1.15], [4.7, -1.2], [4.7, 1.2], [4.25, 1.15]]), .2, .12), 'gold', 0, 0, .82);
      parts.w = 19; parts.h = 4.2; parts.span = 2.7; parts.py = .3;
    } else if (id === 'owl') {
      add(ext(oval(2.35, 3.1), .5, .32), 'gold', 0, 0, 0);
      add(ext(poly([[-2.0, 2.2], [-1.5, 3.9], [-.7, 2.8]]), .3, .16), 'gold', 0, 0, .1); add(ext(poly([[2.0, 2.2], [1.5, 3.9], [.7, 2.8]]), .3, .16), 'gold', 0, 0, .1);
      [-1, 1].forEach(function (sd) { stretch(new THREE.TorusGeometry(1, .2, 10, 30), 'gold', sd * .98, 1.35, .82, .72, .72, 1.4); add(gemGeo, 'f:0x1d49c8', sd * .98, 1.35, .86, .52); add(ext(oval(.62, 1.75), .2, .14), 'gold', sd * 2.0, -.7, .5, 1, sd * -.14); });
      add(ext(poly([[-.34, .82], [.34, .82], [0, .2]]), .2, .1), 'gold', 0, 0, .86);
      [[0, -.5], [-.72, -1.05], [.72, -1.05], [0, -1.6], [-.72, -2.15], [.72, -2.15], [0, -2.65]].forEach(function (p) { add(gemGeo, 'diamond', p[0], p[1], .8, .38); });
      parts.w = 5.6; parts.h = 7.6; parts.cy = .4;
    } else if (id === 'potr' || id === 'pote') {   // a round flask with a coloured stone for the liquid
      stretch(new THREE.TorusGeometry(1, .13, 12, 44), 'gold', 0, -1.2, .32, 2.0, 2.0, 2.4); stretch(sph, 'c:' + (id === 'potr' ? '0x4d0612' : '0x06432b'), 0, -1.2, .25, 1.8, 1.8, 1.1);
      add(ext(poly([[-.55, .6], [.55, .6], [.55, 2.3], [-.55, 2.3]]), .4, .2), 'gold', 0, 0, .1); add(ext(poly([[-.95, 2.25], [.95, 2.25], [.95, 2.7], [-.95, 2.7]]), .45, .16), 'gold', 0, 0, .12);
      add(sph, 'e:' + BROWN, 0, 3.15, .5, .55);
      parts.w = 4.8; parts.h = 7.6; parts.cy = .3;
    } else {                              // sapphire: a domed stone in a gold bezel
      stretch(new THREE.TorusGeometry(1, .13, 12, 48), 'gold', 0, 0, .3, 2.15, 2.85, 2.6); stretch(sph, 'c:0x071a5c', 0, 0, .25, 1.95, 2.65, 1.15);
      [[0, 2.85], [0, -2.85], [2.15, 0], [-2.15, 0]].forEach(function (p) { add(sph, 'gold', p[0], p[1], .55, .36); });
      parts.w = 5.2; parts.h = 6.6;
    }
    return (charmGeo[id] = parts);
  }
  function buildCharm(def, upper, id, gold) {
    var parts = charmParts(id), grp = new THREE.Group(), P = new V3(), N = new V3(), q = new THREE.Quaternion();
    parts.forEach(function (p) {
      var c0 = p.role.charAt(0), mat = p.role === 'gold' ? gold : p.role === 'diamond' ? diamondMat : c0 === 'e' ? enamelMat(+p.role.slice(2)) : c0 === 'c' ? cabMat(+p.role.slice(2)) : facetMat(+p.role.slice(2));
      var m = new THREE.Mesh(p.g, mat); m.position.set(p.x - (parts.cx || 0), p.y - (parts.cy || 0), p.z);
      if (p.sx) m.scale.set(p.sx, p.sy, p.sz); else m.scale.setScalar(p.s);
      if (p.g === gemGeo) m.rotation.x = Math.PI / 2; m.rotation.z = p.rz || 0;
      grp.add(m);
    });
    var k = Math.min(.86 * def[1] * (parts.span || 1) / parts.w, .68 * def[2] / parts.h);
    facePoint(def, 0, def[2] * (parts.py || .5), P, N);
    grp.position.copy(P).addScaledVector(N, -.1).multiplyScalar(MM); grp.scale.setScalar(k * MM);
    q.setFromUnitVectors(UPZ, N); grp.quaternion.copy(q); if (upper) grp.rotateZ(Math.PI);
    return grp;
  }
  // letters on a tooth: drawn once, then laid on the face
  function letterTex(text, flip) {
    var c = document.createElement('canvas'); c.width = c.height = 256; var x = c.getContext('2d');
    x.fillStyle = '#000'; x.fillRect(0, 0, 256, 256); x.fillStyle = '#fff'; x.textAlign = 'center'; x.textBaseline = 'middle';
    var size = 150; x.font = '700 ' + size + 'px Geist, Arial, sans-serif'; while (x.measureText(text).width > 170 && size > 30) { size -= 6; x.font = '700 ' + size + 'px Geist, Arial, sans-serif'; }
    x.translate(128, 128 + 6); if (flip) x.rotate(Math.PI); x.fillText(text, 0, 0);
    var t = new THREE.CanvasTexture(c); t.anisotropy = 4; return t;
  }
