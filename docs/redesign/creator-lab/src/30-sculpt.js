
  // ---------- sculpting: the teeth are real crown shapes. Each one is stored as a coarse cage (TOOTH_DATA) and smoothed here into one soft, continuous surface ----------
  function unpack(str, Type) { var bin = atob(str), u = new Uint8Array(bin.length); for (var k = 0; k < bin.length; k++) u[k] = bin.charCodeAt(k); return new Type(u.buffer); }
  // a tooth is [type, width, crown height, depth at the gum, which shape, mirrored (the left side of the mouth), sharpened into a fang]; sizes in millimetres.
  // In its own space the gum line is y = 0, the biting end is y = height, and z points out of the mouth.
  function defs(row) { return TOOTH_DATA[row].map(function (r, k) { return [r.t, r.w, r.h, r.d, row + k, 0, 0]; }); }
  var UPPER = defs('U'), LOWER = defs('L'), FANG = 3.4;
  function mirrorOf(def) { var d = def.slice(); d[5] = 1; return d; }
  function fangOf(def) { var d = def.slice(); d[2] = def[2] + FANG; d[6] = 1; return d; }
  function srad(a, m) { return Math.pow(Math.pow(Math.abs(Math.cos(a)), m) + Math.pow(Math.abs(Math.sin(a)), m), -1 / m); }
  function solve(f, lo, hi) { for (var k = 0; k < 34; k++) { var mid = (lo + hi) / 2; if (f(mid) > 0) hi = mid; else lo = mid; } return (lo + hi) / 2; }
  var _a = new V3(), _b = new V3(), _c = new V3();
  var cache = {};
  function memo(key, make) { return cache[key] || (cache[key] = make()); }
  function skey(def) { return def[4] + '_' + def[5] + '_' + def[6]; }
  function dkey(def, side) { return def.join('_') + '|' + side; }
  function subdivide(P, Q) {              // one round of Catmull-Clark smoothing on a cage of four-sided faces that is open at the root end
    var nv = P.length / 3, nq = Q.length / 4, edge = new Map(), ea = [], eb = [], ef = [], fe = new Int32Array(nq * 4), fp = new Float64Array(nq * 3), k, j, c, a, b, key, e;
    for (k = 0; k < nq; k++) for (c = 0; c < 3; c++) fp[k * 3 + c] = (P[Q[k * 4] * 3 + c] + P[Q[k * 4 + 1] * 3 + c] + P[Q[k * 4 + 2] * 3 + c] + P[Q[k * 4 + 3] * 3 + c]) / 4;
    for (k = 0; k < nq; k++) for (j = 0; j < 4; j++) {
      a = Q[k * 4 + j]; b = Q[k * 4 + (j + 1) % 4]; key = a < b ? a * 65536 + b : b * 65536 + a; e = edge.get(key);
      if (e === undefined) { e = ea.length; edge.set(key, e); ea.push(a); eb.push(b); ef.push(k, -1); } else ef[e * 2 + 1] = k;
      fe[k * 4 + j] = e;
    }
    var ne = ea.length, out = new Float64Array((nv + nq + ne) * 3), sf = new Float64Array(nv * 3), sr = new Float64Array(nv * 3), sb = new Float64Array(nv * 3), nf = new Int32Array(nv), nr = new Int32Array(nv), nb = new Int32Array(nv);
    for (k = 0; k < nq; k++) for (j = 0; j < 4; j++) { a = Q[k * 4 + j]; nf[a]++; for (c = 0; c < 3; c++) sf[a * 3 + c] += fp[k * 3 + c]; }
    for (e = 0; e < ne; e++) {
      a = ea[e]; b = eb[e]; var f0 = ef[e * 2], f1 = ef[e * 2 + 1], o = (nv + nq + e) * 3;
      for (c = 0; c < 3; c++) {
        var mid = (P[a * 3 + c] + P[b * 3 + c]) / 2;
        out[o + c] = f1 < 0 ? mid : (P[a * 3 + c] + P[b * 3 + c] + fp[f0 * 3 + c] + fp[f1 * 3 + c]) / 4;
        sr[a * 3 + c] += mid; sr[b * 3 + c] += mid;
        if (f1 < 0) { sb[a * 3 + c] += P[b * 3 + c]; sb[b * 3 + c] += P[a * 3 + c]; }
      }
      nr[a]++; nr[b]++; if (f1 < 0) { nb[a]++; nb[b]++; }
    }
    for (k = 0; k < nv; k++) for (c = 0; c < 3; c++) { var p = P[k * 3 + c], n = nf[k]; out[k * 3 + c] = nb[k] ? .75 * p + .125 * sb[k * 3 + c] : (sf[k * 3 + c] / n + 2 * sr[k * 3 + c] / nr[k] + (n - 3) * p) / n; }
    for (k = 0; k < nq * 3; k++) out[nv * 3 + k] = fp[k];
    var Q2 = new Int32Array(nq * 16);
    for (k = 0; k < nq; k++) for (j = 0; j < 4; j++) { var o2 = (k * 4 + j) * 4; Q2[o2] = Q[k * 4 + j]; Q2[o2 + 1] = nv + nq + fe[k * 4 + j]; Q2[o2 + 2] = nv + k; Q2[o2 + 3] = nv + nq + fe[k * 4 + (j + 3) % 4]; }
    return { P: out, Q: Q2 };
  }
  function shape(def) {                   // the finished tooth: points, the way each faces, and triangles (the last few close the root end)
    return memo('sh' + skey(def), function () {
      var k, c, j;
      if (def[5]) {                       // the left side of the mouth: the same tooth in a mirror
        var o = shape(def.slice(0, 5).concat(0, def[6])), mp = new Float64Array(o.P), mn = new Float64Array(o.N), mf = o.F.slice(), ms = {};
        for (k = 0; k < mp.length; k += 3) { mp[k] = -mp[k]; mn[k] = -mn[k]; }
        for (k = 0; k < mf.length; k += 3) { c = mf[k + 1]; mf[k + 1] = mf[k + 2]; mf[k + 2] = c; }
        for (c in o) ms[c] = o[c];
        ms.P = mp; ms.N = mn; ms.F = mf; ms.x0 = -o.x1; ms.x1 = -o.x0; ms.cx = -o.cx; return ms;
      }
      var rec = TOOTH_DATA[def[4].charAt(0)][+def[4].slice(1)], v = unpack(rec.v, Int16Array), P = new Float64Array(v.length);
      for (k = 0; k < v.length; k++) P[k] = v[k] / 1000;
      var m = subdivide(P, unpack(rec.q, Uint16Array)); m = subdivide(m.P, m.Q); P = m.P;
      var Q = m.Q, nq = Q.length / 4, nv = P.length / 3, tip = 0;
      if (def[6]) {                       // a fang: the top of the canine drawn out and down into a point
        for (k = 1; k < nv; k++) if (P[k * 3 + 1] > P[tip * 3 + 1]) tip = k;
        var tx = P[tip * 3], tz = P[tip * 3 + 2];
        for (k = 0; k < nv; k++) { var t = P[k * 3 + 1] / rec.h; if (t <= .34) continue; var g = Math.pow(Math.min(1, (t - .34) / .66), 1.55), nar = 1 - .34 * g; P[k * 3 + 1] += FANG * g; P[k * 3] = tx + (P[k * 3] - tx) * nar; P[k * 3 + 2] = tz + (P[k * 3 + 2] - tz) * nar + .8 * g; }
      }
      var F = [], cnt = new Map(), dir = [], key, a, b;
      for (k = 0; k < nq; k++) {
        F.push(Q[k * 4], Q[k * 4 + 1], Q[k * 4 + 2], Q[k * 4], Q[k * 4 + 2], Q[k * 4 + 3]);
        for (j = 0; j < 4; j++) { a = Q[k * 4 + j]; b = Q[k * 4 + (j + 1) % 4]; key = a < b ? a * 65536 + b : b * 65536 + a; if (!cnt.has(key)) { cnt.set(key, dir.length); dir.push(a, b, 1); } else dir[cnt.get(key) + 2]++; }
      }
      var nt = F.length, N = new Float64Array(nv * 3 + 3), P2 = new Float64Array(nv * 3 + 3), loop = 0, cx = 0, cy = 0, cz = 0;
      P2.set(P);
      for (k = 0; k < dir.length; k += 3) if (dir[k + 2] === 1) { F.push(dir[k + 1], dir[k], nv); loop++; cx += P[dir[k] * 3]; cy += P[dir[k] * 3 + 1]; cz += P[dir[k] * 3 + 2]; }
      P2[nv * 3] = cx / loop; P2[nv * 3 + 1] = cy / loop; P2[nv * 3 + 2] = cz / loop; P = P2;
      var mx = 0, my = 0, mz = 0, vol = 0;
      for (k = 0; k < nv; k++) { mx += P[k * 3]; my += P[k * 3 + 1]; mz += P[k * 3 + 2]; } mx /= nv; my /= nv; mz /= nv;
      function tri(k2) { _a.set(P[F[k2] * 3] - mx, P[F[k2] * 3 + 1] - my, P[F[k2] * 3 + 2] - mz); _b.set(P[F[k2 + 1] * 3] - mx, P[F[k2 + 1] * 3 + 1] - my, P[F[k2 + 1] * 3 + 2] - mz); _c.set(P[F[k2 + 2] * 3] - mx, P[F[k2 + 2] * 3 + 1] - my, P[F[k2 + 2] * 3 + 2] - mz); }
      for (k = 0; k < F.length; k += 3) { tri(k); vol += _a.dot(_b.cross(_c)); }
      if (vol < 0) for (k = 0; k < F.length; k += 3) { var sw = F[k + 1]; F[k + 1] = F[k + 2]; F[k + 2] = sw; }
      for (k = 0; k < nt; k += 3) { tri(k); _b.sub(_a); _c.sub(_a); _b.cross(_c); for (j = 0; j < 3; j++) { N[F[k + j] * 3] += _b.x; N[F[k + j] * 3 + 1] += _b.y; N[F[k + j] * 3 + 2] += _b.z; } }
      for (k = 0; k < nv; k++) { var l = Math.hypot(N[k * 3], N[k * 3 + 1], N[k * 3 + 2]) || 1; N[k * 3] /= l; N[k * 3 + 1] /= l; N[k * 3 + 2] /= l; }
      N[nv * 3 + 1] = -1;
      var s = { P: P, N: N, F: F, nt: nt, nv: nv, x0: 1e9, x1: -1e9, y1: -1e9, z0: 1e9, z1: -1e9 }, nx0 = 1e9, nx1 = -1e9, nz0 = 1e9, nz1 = -1e9;
      for (k = 0; k < nv; k++) {
        var x = P[k * 3], y = P[k * 3 + 1], z = P[k * 3 + 2];
        s.x0 = Math.min(s.x0, x); s.x1 = Math.max(s.x1, x); s.y1 = Math.max(s.y1, y); s.z0 = Math.min(s.z0, z); s.z1 = Math.max(s.z1, z);
        if (Math.abs(y) < .6) { nx0 = Math.min(nx0, x); nx1 = Math.max(nx1, x); nz0 = Math.min(nz0, z); nz1 = Math.max(nz1, z); }
      }
      s.cx = (nx0 + nx1) / 2; s.cz = (nz0 + nz1) / 2; s.hx = (nx1 - nx0) / 2; s.hz = (nz1 - nz0) / 2; s.zs = (s.z0 + s.z1) / 2;   // the neck, and the line between the lip half and the tongue half
      return s;
    });
  }
  function thOf(s, x, z) { return Math.atan2((z - s.cz) / s.hz, (x - s.cx) / s.hx); }   // the way round the tooth: 90 degrees is the middle of the lip side, 0 and 180 are where it meets its neighbours
  var CAP_OFF = .24, LIP = .4, WIN = 1.45;   // a cap sits a quarter of a millimetre proud of the tooth; its edge shows a lip; an open face leaves a frame this wide
  var SIDE = { deep: .27, permanent: .06 };  // how far a cap's edge arches away from the gum between teeth: deep cut shows each tooth, the permanent look runs straight
  function margin(def, th, side) { var s = side * def[2]; return Math.sin(th) > 0 ? -.35 + (s + .35) * Math.pow(Math.abs(Math.cos(th)), 3.2) : s; }
  // the lip-side face seen from straight in front, as a fine height map: how far forward the surface is at each point, and which way it faces there
  var CELL = 1 / 16;
  function face(def) {
    return memo('f' + skey(def), function () {
      var s = shape(def), P = s.P, N = s.N, F = s.F, x0 = s.x0 - .6, y0 = -1.4, nx = Math.ceil((s.x1 - s.x0 + 1.2) / CELL) + 1, ny = Math.ceil((s.y1 + .6 - y0) / CELL) + 1, n = nx * ny;
      var Z = new Float32Array(n), A = new Float32Array(n), B = new Float32Array(n), C = new Float32Array(n), cov = new Uint8Array(n), k, i, j, o;
      for (k = 0; k < n; k++) { Z[k] = -1e9; C[k] = 1; }
      for (k = 0; k < s.nt; k += 3) {
        var a = F[k] * 3, b = F[k + 1] * 3, c = F[k + 2] * 3;
        if (P[a + 2] < s.zs || P[b + 2] < s.zs || P[c + 2] < s.zs) continue;
        if (N[a + 2] < .1 && N[b + 2] < .1 && N[c + 2] < .1) continue;
        var ax = (P[a] - x0) / CELL, ay = (P[a + 1] - y0) / CELL, bx = (P[b] - x0) / CELL, by = (P[b + 1] - y0) / CELL, cx = (P[c] - x0) / CELL, cy = (P[c + 1] - y0) / CELL, det = (bx - ax) * (cy - ay) - (cx - ax) * (by - ay);
        if (Math.abs(det) < 1e-9) continue;
        var i0 = Math.max(0, Math.ceil(Math.min(ax, bx, cx))), i1 = Math.min(nx - 1, Math.floor(Math.max(ax, bx, cx))), j0 = Math.max(0, Math.ceil(Math.min(ay, by, cy))), j1 = Math.min(ny - 1, Math.floor(Math.max(ay, by, cy)));
        for (j = j0; j <= j1; j++) for (i = i0; i <= i1; i++) {
          var w1 = ((i - ax) * (cy - ay) - (cx - ax) * (j - ay)) / det, w2 = ((bx - ax) * (j - ay) - (i - ax) * (by - ay)) / det, w0 = 1 - w1 - w2;
          if (w0 < -1e-6 || w1 < -1e-6 || w2 < -1e-6) continue;
          var z = w0 * P[a + 2] + w1 * P[b + 2] + w2 * P[c + 2]; o = j * nx + i;
          if (z > Z[o]) { Z[o] = z; A[o] = w0 * N[a] + w1 * N[b] + w2 * N[c]; B[o] = w0 * N[a + 1] + w1 * N[b + 1] + w2 * N[c + 1]; C[o] = w0 * N[a + 2] + w1 * N[b + 2] + w2 * N[c + 2]; cov[o] = 1; }
        }
      }
      // carry the surface a little past its own edge, so anything sitting right on the edge still has something to rest on
      var have = new Uint8Array(cov), nb4 = [-1, 1, -nx, nx];
      for (var pass = 0; pass < 16; pass++) {
        var add = [];
        for (j = 1; j < ny - 1; j++) for (i = 1; i < nx - 1; i++) {
          o = j * nx + i; if (have[o]) continue; var cn = 0, sz = 0, sa = 0, sb = 0, sc = 0;
          for (k = 0; k < 4; k++) { var q = o + nb4[k]; if (have[q]) { cn++; sz += Z[q]; sa += A[q]; sb += B[q]; sc += C[q]; } }
          if (cn) add.push(o, sz / cn, sa / cn, sb / cn, sc / cn);
        }
        for (k = 0; k < add.length; k += 5) { o = add[k]; have[o] = 1; Z[o] = add[k + 1]; A[o] = add[k + 2]; B[o] = add[k + 3]; C[o] = add[k + 4]; }
      }
      for (k = 0; k < n; k++) if (!have[k]) Z[k] = s.zs;
      return { x0: x0, y0: y0, nx: nx, ny: ny, Z: Z, A: A, B: B, C: C, cov: cov };
    });
  }
  function samp(arr, f, x, y) {           // read a height map between its points
    var gx = Math.min(f.nx - 1.001, Math.max(0, (x - f.x0) / CELL)), gy = Math.min(f.ny - 1.001, Math.max(0, (y - f.y0) / CELL)), i = Math.floor(gx), j = Math.floor(gy), u = gx - i, v = gy - j, o = j * f.nx + i;
    return (arr[o] * (1 - u) + arr[o + 1] * u) * (1 - v) + (arr[o + f.nx] * (1 - u) + arr[o + f.nx + 1] * u) * v;
  }
  function spread(mask, nx, ny) {         // for every point inside a shape, how far it is from the shape's edge (measured in points of the map)
    var INF = 1e12, f = new Float64Array(nx * ny), n = Math.max(nx, ny), v = new Int32Array(n), z = new Float64Array(n + 1), g = new Float64Array(n), k, q;
    for (k = 0; k < nx * ny; k++) f[k] = mask[k] ? INF : 0;
    function run(off, stride, len) {
      for (q = 0; q < len; q++) g[q] = f[off + q * stride];
      var kk = 0, s2; v[0] = 0; z[0] = -INF; z[1] = INF;
      for (q = 1; q < len; q++) {
        for (;;) { var p = v[kk]; s2 = ((g[q] + q * q) - (g[p] + p * p)) / (2 * q - 2 * p); if (s2 <= z[kk] && kk > 0) kk--; else break; }
        kk++; v[kk] = q; z[kk] = s2; z[kk + 1] = INF;
      }
      kk = 0;
      for (q = 0; q < len; q++) { while (z[kk + 1] < q) kk++; var p2 = v[kk]; f[off + q * stride] = (q - p2) * (q - p2) + g[p2]; }
    }
    for (k = 0; k < nx; k++) run(k, nx, ny);
    for (k = 0; k < ny; k++) run(k * nx, 1, nx);
    for (k = 0; k < nx * ny; k++) f[k] = Math.max(0, Math.sqrt(f[k]) - .5);
    return f;
  }
  function reach(def, side) {             // the part of the face a cap covers, as distance in from its edge
    return memo('g' + skey(def) + '|' + def[2] + '|' + side, function () {
      var f = face(def), s = shape(def), mask = new Uint8Array(f.nx * f.ny), i, j, o;
      for (j = 0; j < f.ny; j++) for (i = 0; i < f.nx; i++) { o = j * f.nx + i; if (f.cov[o] && f.y0 + j * CELL >= margin(def, thOf(s, f.x0 + i * CELL, f.Z[o]), side)) mask[o] = 1; }
      return spread(mask, f.nx, f.ny);
    });
  }
  function facePoint(def, x, y, P, N) {   // the point on a cap's lip-side face above (x, y), and which way it faces
    var f = face(def); N.set(samp(f.A, f, x, y), samp(f.B, f, x, y), samp(f.C, f, x, y)).normalize();
    P.set(x, y + N.y * CAP_OFF, samp(f.Z, f, x, y) + N.z * CAP_OFF);
  }
  function inFrom(def, x, y, side) { return samp(reach(def, side), face(def), x, y) * CELL; }   // how far (x, y) is in from the cap's edge; 0 off the face
  function onFace(def, x, y, inset, side) { return inFrom(def, x, y, side) >= inset; }
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
  function toothGeo(def) {                // the whole tooth, closed at the root
    return memo('t' + skey(def), function () {
      var s = shape(def), n = s.P.length, pos = new Float32Array(n), k;
      for (k = 0; k < n; k++) pos[k] = s.P[k] * MM;
      var g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.BufferAttribute(pos, 3)); g.setAttribute('normal', new THREE.BufferAttribute(new Float32Array(s.N), 3)); g.setIndex(s.F); return g;
    });
  }
  function capGeo(def, side) {            // the grill cap: the tooth's own surface, a little fuller, cut off along an arched edge that turns in to show its thickness
    return memo('c' + dkey(def, side), function () {
      var s = shape(def), P = s.P, N = s.N, F = s.F, f = new Float32Array(s.nv), at = new Int32Array(s.nv), cuts = {}, lips = {}, pos = [], uv = [], idx = [], w = def[1], h = def[2], k, j;
      for (k = 0; k < s.nv; k++) { f[k] = P[k * 3 + 1] - margin(def, thOf(s, P[k * 3], P[k * 3 + 2]), side); at[k] = -1; }
      function put(x, y, z, nx, ny, nz, drop) {
        var front = nz > .12 && z > s.zs; uv.push(x / w + .5, front ? (y + 1) / (h + 2) : 3);
        pos.push((x - nx * drop) * MM, (y + ny * CAP_OFF - ny * drop) * MM, (z + nz * CAP_OFF - nz * drop) * MM); return pos.length / 3 - 1;
      }
      function whole(v) { return at[v] >= 0 ? at[v] : (at[v] = put(P[v * 3], P[v * 3 + 1], P[v * 3 + 2], N[v * 3], N[v * 3 + 1], N[v * 3 + 2], 0)); }
      function cut(a, b) {                // the point where the cap's edge crosses the line from a to b, and the same point turned in for the lip
        var key = a < b ? a * 65536 + b : b * 65536 + a; if (cuts[key] !== undefined) return cuts[key];
        var t = f[a] / (f[a] - f[b]), x = P[a * 3] + (P[b * 3] - P[a * 3]) * t, y = P[a * 3 + 1] + (P[b * 3 + 1] - P[a * 3 + 1]) * t, z = P[a * 3 + 2] + (P[b * 3 + 2] - P[a * 3 + 2]) * t;
        _a.set(N[a * 3] + (N[b * 3] - N[a * 3]) * t, N[a * 3 + 1] + (N[b * 3 + 1] - N[a * 3 + 1]) * t, N[a * 3 + 2] + (N[b * 3 + 2] - N[a * 3 + 2]) * t).normalize();
        var id = put(x, y, z, _a.x, _a.y, _a.z, 0); lips[id] = put(x, y, z, _a.x, _a.y, _a.z, LIP); return (cuts[key] = id);
      }
      for (k = 0; k < s.nt; k += 3) {
        var poly = [], edge = [];
        for (j = 0; j < 3; j++) { var a = F[k + j], b = F[k + (j + 1) % 3]; if (f[a] >= 0) { poly.push(whole(a)); edge.push(0); } if ((f[a] >= 0) !== (f[b] >= 0)) { poly.push(cut(a, b)); edge.push(1); } }
        if (poly.length < 3) continue;
        idx.push(poly[0], poly[1], poly[2]); if (poly.length === 4) idx.push(poly[0], poly[2], poly[3]);
        for (j = 0; j < poly.length; j++) { var p = poly[j], q = poly[(j + 1) % poly.length]; if (edge[j] && edge[(j + 1) % poly.length] && p !== q) idx.push(q, p, lips[p], q, lips[p], lips[q]); }
      }
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
      var W = 144, H = 192, c = document.createElement('canvas'); c.width = W; c.height = H; var x = c.getContext('2d'), im = x.createImageData(W, H), w = def[1], h = def[2];
      for (var j = 0; j < H; j++) for (var i2 = 0; i2 < W; i2++) { var u = (i2 + .5) / W, v = 1 - (j + .5) / H, keep = Math.round(255 * Math.min(1, Math.max(0, .5 + (WIN - inFrom(def, (u - .5) * w, v * (h + 2) - 1, side)) / .2))), k = (j * W + i2) * 4; im.data[k] = im.data[k + 1] = im.data[k + 2] = keep; im.data[k + 3] = 255; }
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
