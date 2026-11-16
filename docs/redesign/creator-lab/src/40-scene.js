
  // ---------- the arch: every tooth sits where it was measured, touching its neighbours. The lower row closes just inside the upper one, as a real bite does ----------
  function archPath(pts) {
    var v = [], k; for (k = pts.length - 1; k >= 1; k--) v.push(new V3(-pts[k][0], 0, pts[k][1])); for (k = 0; k < pts.length; k++) v.push(new V3(pts[k][0], 0, pts[k][1]));
    var P = new THREE.CatmullRomCurve3(v, false, 'centripetal').getPoints(1200).slice(600), len = [0];
    for (k = 1; k < P.length; k++) len.push(len[k - 1] + P[k].distanceTo(P[k - 1]));
    return {
      at: function (s) {
        s = Math.max(0, Math.min(len[len.length - 1] - .001, s)); var lo = 0, hi = len.length - 1; while (hi - lo > 1) { var mid = (lo + hi) >> 1; if (len[mid] > s) hi = mid; else lo = mid; }
        var f = (s - len[lo]) / (len[hi] - len[lo] || 1), a = P[lo], b = P[hi], tx = b.x - a.x, tz = b.z - a.z, tl = Math.hypot(tx, tz) || 1;
        return { x: a.x + tx * f, z: a.z + tz * f, nx: -tz / tl, nz: tx / tl };
      },
      where: function (x, z) { var best = 0, bd = 1e9; for (var q = 0; q < P.length; q++) { var d = (P[q].x - x) * (P[q].x - x) + (P[q].z - z) * (P[q].z - z); if (d < bd) { bd = d; best = q; } } return len[best]; }
    };
  }
  var teeth = [], hit = [], dirty = true, ready = false;
  var glowMat = new THREE.ShaderMaterial({ uniforms: { t: { value: 0 } }, transparent: true, depthWrite: false, side: THREE.BackSide,
    vertexShader: 'uniform float t; varying float vF; void main() { float pulse = 0.5 + 0.5 * sin(t * 0.005); vec3 p = position + normal * (0.034 + 0.01 * pulse); vec4 mv = modelViewMatrix * vec4(p, 1.0); vec3 n = normalize(normalMatrix * normal); vF = 1.0 - abs(dot(n, normalize(-mv.xyz))); gl_Position = projectionMatrix * mv; }',
    fragmentShader: 'uniform float t; varying float vF; void main() { float pulse = 0.5 + 0.5 * sin(t * 0.005); float a = clamp((0.55 + 0.3 * pulse) * (0.45 + 0.8 * vF), 0.0, 0.92); gl_FragColor = vec4(vec3(0.98, 0.66, 0.12), a); }' });
  function buildRow(row, upper) {
    var recs = TOOTH_DATA[row], list = upper ? UPPER : LOWER, pts = [[0, recs[0].p[2] + .3]], lay = [], a = recs[6].p, b = recs[7].p;
    recs.forEach(function (r) { pts.push([r.p[0], r.p[2]]); });
    pts.push([b[0] + (b[0] - a[0]) * 1.7, b[2] + (b[2] - a[2]) * 1.7]);
    lay.path = archPath(pts);
    recs.forEach(function (r, k) {
      [1, -1].forEach(function (side) {
        var def = side > 0 ? list[k] : mirrorOf(list[k]), g = new THREE.Group(); g.rotation.order = 'YXZ'; g.rotation.set(0, side * r.a, upper ? Math.PI : 0);
        var base = new V3(side * r.p[0] * MM, r.p[1] * MM, r.p[2] * MM); if (!upper) base.sub(PIVOT);
        g.position.copy(base);
        var rm = new THREE.Mesh(toothGeo(def), resinTooth), rb = new THREE.Mesh(toothGeo(def), resinBack), cm = new THREE.Mesh(capGeo(def, SIDE.deep), creamMat); cm.visible = false;
        rb.renderOrder = 1; rm.renderOrder = 2;
        var gw = new THREE.Mesh(cm.geometry, glowMat); gw.visible = false; gw.layers.set(2); g.add(gw); cm.layers.enable(1);   // the glow is drawn in its own pass, above the holder
        var idx = (upper ? 0 : 16) + (side > 0 ? 8 + k : 7 - k);
        rm.userData.idx = cm.userData.idx = idx; g.add(rb); g.add(rm); g.add(cm); (upper ? rig : jaw).add(g);
        teeth[idx] = { g: g, resin: rm, back: rb, cap: cm, glow: gw, deco: null, key: null, spots: [], def: def, upper: upper, base: base, out: new V3(Math.sin(side * r.a), 0, Math.cos(side * r.a)), ang: side * r.a, pop: 0, lift: 0 };
        hit.push(rm, cm);
      });
      lay.push({ s: lay.path.where(r.p[0], r.p[2]), gum: Math.abs(r.p[1]), dep: r.d, w: r.w });
    });
    lay.end = lay[7].s + list[7][1] / 2;
    return lay;
  }
  // the clear holder: a flat-topped block, like a jeweler's mold or a display case, with a slim gum roll where the teeth meet it.
  // The roll's edge is scalloped as a gum line is: it arcs over each tooth and comes to a point between neighbours, filling the small gap there.
  var BLOCK = { U: [11.4, 18.6], L: [8.6, 15.8] };   // where each block starts and ends, measured from the biting line
  function holder(lay, upper) {
    var path = lay.path, NS = 24, end = lay.end + 1.2, tail = 4, pos = [], idx = [], rings = 0, s, j, u = upper ? 1 : -1, B0 = BLOCK[upper ? 'U' : 'L'][0], B1 = BLOCK[upper ? 'U' : 'L'][1], centre = [], stations = [], q0;
    function prop(as, n) { if (as <= lay[0].s) return lay[0][n]; for (var k = 1; k < lay.length; k++) if (as <= lay[k].s) { var f = (as - lay[k - 1].s) / (lay[k].s - lay[k - 1].s); f = f * f * (3 - 2 * f); return lay[k - 1][n] + (lay[k][n] - lay[k - 1][n]) * f; } return lay[lay.length - 1][n]; }
    var PAP = [1.7, 1.7, 1.6, 1.35, 1.2, 1.05, .9, 0], cuts = [0], k2;      // how far the gum reaches down between each pair of neighbours, starting between the two front teeth
    for (k2 = 0; k2 < 7; k2++) cuts.push((lay[k2].s + lay[k2].w / 2 + lay[k2 + 1].s - lay[k2 + 1].w / 2) / 2);
    cuts.push(lay.end);
    function pap(as) {
      for (var k = 0; k < 8; k++) if (as <= cuts[k + 1]) { var mid = (cuts[k] + cuts[k + 1]) / 2, t = (as - mid) / ((cuts[k + 1] - cuts[k]) / 2); return (t < 0 ? PAP[k === 0 ? 0 : k - 1] : PAP[k]) * Math.pow(Math.abs(t), 2.6); }
      return 0;
    }
    for (s = -end; s <= end + .001; s += .5) stations.push(s);
    [15, 30, 45, 59, 70, 79, 86].forEach(function (dg) { var e = end + tail * Math.sin(dg * Math.PI / 180); stations.push(e); stations.unshift(-e); });
    for (q0 = 0; q0 < stations.length; q0++) {
      s = stations[q0];
      var as = Math.abs(s), over = Math.max(0, as - end) / tail, shrink = Math.sqrt(Math.max(0, 1 - over * over)), pt = path.at(as), sx = s < 0 ? -1 : 1;
      var pp = pap(as), crest = u * (prop(as, 'gum') - .15 - pp), base = u * (B0 + 1), yc = (crest + base) / 2, hh = Math.abs(base - crest) / 2, half = prop(as, 'dep') / 2 + 1.25;
      for (j = 0; j < NS; j++) {
        var a = j / NS * Math.PI * 2, r = srad(a, Math.sin(a) < 0 ? 2.6 - .76 * pp : 2.6), n = r * Math.cos(a) * half * shrink;   // between teeth the edge thins to a wedge that tucks in behind their faces
        pos.push((sx * pt.x + sx * pt.nx * n) * MM, (yc + u * r * Math.sin(a) * hh * shrink) * MM, (pt.z + pt.nz * n) * MM);
      }
      centre.push([sx * pt.x * MM, yc * MM, pt.z * MM]); rings++;
    }
    grid(idx, rings, NS);
    var e0 = pos.length / 3; pos.push.apply(pos, centre[0]); for (j = 0; j < NS; j++) idx.push(e0, (j + 1) % NS, j);
    var e1 = pos.length / 3; pos.push.apply(pos, centre[rings - 1]); for (j = 0; j < NS; j++) idx.push(e1, (rings - 1) * NS + j, (rings - 1) * NS + (j + 1) % NS);
    var roll = orient(bufGeo(pos, idx), true);
    // the block: the arch's outline pushed out past the teeth, closed straight across the back, with a flat top and bevelled edges
    var shape2 = new THREE.Shape(), first = true, bt = .9, thick = B1 - B0;
    for (s = -end - 2; s <= end + 2.001; s += 1.5) { var p2 = path.at(Math.abs(s)), sg = s < 0 ? -1 : 1, o2 = prop(Math.abs(s), 'dep') * .5 + 2.6, X = sg * (p2.x + p2.nx * o2), Z = p2.z + p2.nz * o2; if (first) { shape2.moveTo(X, Z); first = false; } else shape2.lineTo(X, Z); }
    shape2.closePath();
    var block = new THREE.ExtrudeGeometry(shape2, { depth: thick - 2 * bt, bevelEnabled: true, bevelThickness: bt, bevelSize: bt, bevelSegments: 3, curveSegments: 4 });
    block.rotateX(Math.PI / 2); block.translate(0, (upper ? B1 : -B0) - bt, 0); block.scale(MM, MM, MM); block.computeVertexNormals();
    [roll, block].forEach(function (g, gi) {
      [resinBack, depthOnly, gi ? resinBlock : resinGum].forEach(function (mat, n) { var m = new THREE.Mesh(g, mat); m.renderOrder = n === 0 ? 1 : n === 1 ? 3 + gi * 2 : 4 + gi * 2; if (!upper) m.position.copy(PIVOT).multiplyScalar(-1); (upper ? rig : jaw).add(m); });
    });
  }

  // ---------- dressing a tooth: its cap, finish, stones, panels, letters and charm ----------
  var letterMats = {}, photoVer = 0;
  function instanced(geo, mat, list) { var im = new THREE.InstancedMesh(geo, mat, list.length); list.forEach(function (m, n) { im.setMatrixAt(n, m); }); im.instanceMatrix.needsUpdate = true; im.frustumCulled = false; return im; }
  function letterMat(ins, flip, t) {
    var key = ins.text + ins.style + flip + t.metal + t.karat; if (letterMats[key]) return letterMats[key];
    var tex = letterTex(ins.text, flip), base = metalColor(t.metal, t.karat), m;
    if (ins.style === 'engraved') m = new THREE.MeshStandardMaterial({ color: base.clone().multiplyScalar(.16), metalness: .5, roughness: .6, envMap: metalEnv, envMapIntensity: .6 });
    else if (ins.style === 'iced') m = new THREE.MeshStandardMaterial({ color: 0xffffff, metalness: 1, roughness: .03, envMap: sparkleEnv, envMapIntensity: 1.5 });
    else m = new THREE.MeshStandardMaterial({ color: base.clone().lerp(new THREE.Color(0xffffff), .35), metalness: 1, roughness: .05, envMap: sparkleEnv, envMapIntensity: 1.2 });
    m.alphaMap = tex; m.alphaTest = .5; return (letterMats[key] = m);
  }
  function dress(o, t, mOn, opt) {
    var def = opt.fang ? fangOf(o.def) : o.def, side = SIDE[opt.cut] === undefined ? SIDE.deep : SIDE[opt.cut];
    var key = [def.join('_'), side, mOn, t.metal, t.karat, t.type, t.style, t.opal, t.setting, t.charm, opt.ins ? opt.ins.text + opt.ins.style : '', opt.photo ? opt.photo.join(',') + photoVer : ''].join('|');
    if (o.key === key) return; o.key = key;
    o.cap.geometry = capGeo(def, side); if (o.glow) o.glow.geometry = o.cap.geometry;
    if (o.deco) { o.cap.remove(o.deco); o.deco.traverse(function (c) { if (c.geometry && c.geometry.userData.own) c.geometry.dispose(); }); }
    o.deco = null; o.spots = [];
    if (!mOn) { o.cap.material = creamMat; return; }
    var gold = matFor(t.metal, t.karat, 'solid'), plain = t.type === 'plain', iced = t.type === 'iced', open = t.style === 'open' && t.type !== 'photo', D = new THREE.Group();
    function mesh(g, m) { var x = new THREE.Mesh(g, m); D.add(x); return x; }
    o.cap.material = matFor(t.metal, t.karat, plain && FINISH_GLSL[t.style] ? t.style : 'solid', open ? maskTex(def, side) : null);
    if (open) mesh(rimGeo(def, side, WIN, .15), gold);
    if (iced) {
      var L = stoneLayout(def, side, t.setting, open);
      D.add(instanced(gemGeo, diamondMat, L.stones)); if (L.beads.length) D.add(instanced(beadGeo, gold, L.beads));
      mesh(rimGeo(def, side, RIM, TUBE), gold); o.spots = L.spots;
    }
    if (plain && t.style === 'opal') { mesh(memo('pg' + dkey(def, side), function () { return patchGeo(def, side, .95, .1, 0, 1, 0, 1); }), opalMat(t.opal)); mesh(rimGeo(def, side, .95, .16), gold); }
    if (t.type === 'photo') { var u = opt.photo || [0, 1], pg = patchGeo(def, side, .5, .08, o.upper ? u[1] : u[0], o.upper ? u[0] : u[1], o.upper ? 1 : 0, o.upper ? 0 : 1); pg.userData.own = true; mesh(pg, photoMat); mesh(rimGeo(def, side, .5, .13), gold); }
    if (opt.ins) mesh(memo('lg' + dkey(def, side), function () { return patchGeo(def, side, .75, .09, 0, 1, 0, 1); }), letterMat(opt.ins, o.upper, t));
    if (t.charm) D.add(buildCharm(def, o.upper, t.charm, gold));
    o.cap.add(D); o.deco = D;
  }
  function photoRuns() {                 // a photo runs across every photo tooth in a row, left to right
    var runs = {};
    [0, 16].forEach(function (b) { var list = [], total = 0, acc = 0, k; for (k = b; k < b + 16; k++) if (T[k].on && T[k].type === 'photo') { list.push(k); total += teeth[k].def[1]; } list.forEach(function (k2) { var w = teeth[k2].def[1]; runs[k2] = [acc / total, (acc + w) / total]; acc += w; }); });
    return runs;
  }

  // ---------- sparkle: small star glints that light up on the stones facing a light, and move as the piece turns ----------
  var glintTex = (function () {
    var c = document.createElement('canvas'); c.width = c.height = 64; var x = c.getContext('2d'), g = x.createRadialGradient(32, 32, 0, 32, 32, 30);
    g.addColorStop(0, 'rgba(255,255,255,1)'); g.addColorStop(.18, 'rgba(255,255,255,.55)'); g.addColorStop(1, 'rgba(255,255,255,0)'); x.fillStyle = g; x.fillRect(0, 0, 64, 64);
    x.globalCompositeOperation = 'lighter'; [0, Math.PI / 2].forEach(function (a) { x.save(); x.translate(32, 32); x.rotate(a); var l = x.createLinearGradient(-32, 0, 32, 0); l.addColorStop(0, 'rgba(255,255,255,0)'); l.addColorStop(.5, 'rgba(255,255,255,.95)'); l.addColorStop(1, 'rgba(255,255,255,0)'); x.fillStyle = l; x.fillRect(-32, -1.1, 64, 2.2); x.restore(); });
    return new THREE.CanvasTexture(c);
  })();
  var GMAX = 420, gPos = new Float32Array(GMAX * 3), gAlpha = new Float32Array(GMAX), gGeo = new THREE.BufferGeometry(), gList = [];
  gGeo.setAttribute('position', new THREE.BufferAttribute(gPos, 3)); gGeo.setAttribute('aAlpha', new THREE.BufferAttribute(gAlpha, 1));
  var gMat = new THREE.ShaderMaterial({ uniforms: { map: { value: glintTex }, uSize: { value: 30 * PR } }, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
    vertexShader: 'attribute float aAlpha; varying float vA; uniform float uSize; void main() { vA = aAlpha; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); gl_PointSize = uSize * (0.3 + aAlpha); }',
    fragmentShader: 'uniform sampler2D map; varying float vA; void main() { vec4 c = texture2D(map, gl_PointCoord); gl_FragColor = vec4(c.rgb * vA * 1.5, c.a * vA); }' });
  var glints = new THREE.Points(gGeo, gMat); glints.frustumCulled = false; glints.renderOrder = 9; scene.add(glints);
  var LIGHTS = [new V3(.3, .85, .45).normalize(), new V3(-.65, .5, .58).normalize(), new V3(.72, .2, .66).normalize(), new V3(0, .15, 1).normalize()], _p = new V3(), _n = new V3(), _v = new V3(), _r = new V3(), _m3 = new THREE.Matrix3();
  function collectGlints() {
    gList = [];
    teeth.forEach(function (o, k) { if (!T[k].on || !o.spots.length) return; var step = Math.max(1, Math.floor(o.spots.length / 13)); for (var q = k % step; q < o.spots.length && gList.length < GMAX; q += step) gList.push({ o: o, s: o.spots[q] }); });
    gGeo.setDrawRange(0, gList.length);
  }
  function updateGlints() {
    if (!gList.length) return;
    scene.updateMatrixWorld();
    for (var k = 0; k < gList.length; k++) {
      var g = gList[k], mw = g.o.cap.matrixWorld; _p.copy(g.s.p).applyMatrix4(mw); _n.copy(g.s.n).applyMatrix3(_m3.setFromMatrix4(mw)).normalize();
      _v.copy(camera.position).sub(_p).normalize(); var nv = _n.dot(_v), a = 0;
      if (nv > .05) { _r.copy(_n).multiplyScalar(2 * nv).sub(_v); for (var l = 0; l < LIGHTS.length; l++) a += Math.pow(Math.max(0, _r.dot(LIGHTS[l])), 220); }
      _p.addScaledVector(_n, .012); gPos[k * 3] = _p.x; gPos[k * 3 + 1] = _p.y; gPos[k * 3 + 2] = _p.z; gAlpha[k] = Math.min(1, a * 1.3);
    }
    gGeo.attributes.position.needsUpdate = true; gGeo.attributes.aAlpha.needsUpdate = true;
  }

  // ---------- build the piece ----------
  holder(buildRow('U', true), true); holder(buildRow('L', false), false);
  rig.position.y = (BLOCK.L[1] - BLOCK.U[1]) / 2 * MM;   // the piece sits centred on the stage
  (function () {
    var cv = document.createElement('canvas'); cv.width = cv.height = 128; var cx = cv.getContext('2d'), gr = cx.createRadialGradient(64, 64, 4, 64, 64, 64);
    gr.addColorStop(0, 'rgba(0,0,0,1)'); gr.addColorStop(1, 'rgba(0,0,0,0)'); cx.fillStyle = gr; cx.fillRect(0, 0, 128, 128);
    var m = new THREE.Mesh(new THREE.PlaneGeometry(3.6, 3.8), new THREE.MeshBasicMaterial({ map: new THREE.CanvasTexture(cv), transparent: true, opacity: .2, depthWrite: false, toneMapped: false }));
    m.rotation.x = -Math.PI / 2; m.position.set(0, -((BLOCK.L[1] + BLOCK.U[1]) / 2 + 1.75) * MM, -12 * MM); scene.add(m);
  })();
  var open = 0, openGoal = 0, glintT = 0;
  function setJaw(o) { open = o; jaw.rotation.x = o * .12; dirty = true; }
  G.jaw = function (wide) { openGoal = wide ? 1 : 0; };
  G.view = function (dir) { user.yaw = dir * 1.1 - tgt.yaw; user.pitch = 0; hold = true; idleAt = performance.now(); dirty = true; };
  G.turn = function () { G.turnAt = ((G.turnAt === undefined ? 0 : G.turnAt) + 2) % 3 - 1; G.view(G.turnAt === 0 ? 0 : G.turnAt); };
  G.pop = function (k) { if (k === undefined) teeth.forEach(function (o, n) { if (T[n].on) o.pop = 1; }); else teeth[k].pop = 1; };
  G.glint = function () { glintT = 1; };
  G.sync = function () {
    var mOn = metalOn(), runs = photoRuns(), ins = insOn() ? SET.ins : null;
    teeth.forEach(function (o, k) {
      var t = T[k]; o.cap.visible = t.on; if (!t.on) { o.spots = []; return; }
      dress(o, t, mOn, { fang: SET.fangs && FANG_TEETH.indexOf(k) >= 0, cut: SET.cut, ins: ins && ins.tooth === k ? ins : null, photo: runs[k] });
      if (!mOn) o.spots = [];
    });
    collectGlints(); dirty = true;
  };
  G.photo = function (img) { setPhoto(img); photoVer++; };

  // ---------- option pictures: each one is the real tooth, dressed and photographed on the spot ----------
  var tscene = new THREE.Scene(), tcam = new THREE.PerspectiveCamera(22, 1, .1, 50), thumbs = {}, tdef = UPPER[0];
  tscene.environment = studioEnv; tscene.background = roomTexture('#f7f6f3', '#eceae5', '#dcdad4');
  var to = { def: tdef, upper: false, cap: new THREE.Mesh(capGeo(tdef, SIDE.deep), creamMat), deco: null, key: null, spots: [] };
  (function () { var tb = new THREE.Mesh(toothGeo(tdef), resinTooth); tscene.add(tb); tscene.add(to.cap); var cy = tdef[2] * .46 * MM, d = 1.5; tcam.position.set(Math.sin(.42) * d, cy + .1, Math.cos(.42) * d); tcam.lookAt(0, cy, .05); })();
  var W = 1, H = 1;
  G.thumb = function (key, t, opt) {
    if (thumbs[key]) return thumbs[key];
    var d = blank(); for (var kk in t) d[kk] = t[kk]; d.on = true; if (!t.karat) d.karat = '14k';
    dress(to, d, true, opt || { cut: 'deep' });
    var S = 128, px = Math.round(S * PR), c = document.createElement('canvas'); c.width = c.height = px;
    renderer.setScissorTest(true); renderer.setViewport(0, 0, S, S); renderer.setScissor(0, 0, S, S); renderer.render(tscene, tcam);
    c.getContext('2d').drawImage(canvas, 0, canvas.height - px, px, px, 0, 0, px, px);
    renderer.setScissorTest(false); renderer.setViewport(0, 0, W, H); dirty = true;
    return (thumbs[key] = c.toDataURL('image/jpeg', .88));
  };

  // ---------- camera ----------
  // one camera move per step: the look in three-quarter, the teeth straight on, then closer for metal, finish and extras
  var VIEWS = [{ yaw: 0, pitch: .05, zoom: 1 }, { yaw: .44, pitch: .08, zoom: .86 }, { yaw: -.32, pitch: .06, zoom: .76 }, { yaw: .12, pitch: .04, zoom: .74 }, { yaw: -.2, pitch: .05, zoom: .82 }, { yaw: -.26, pitch: .08, zoom: 1 }], LANDVIEW = { yaw: -.3, pitch: .08, zoom: 1 };
  var boxC = { top: 64, bottom: 420, left: 0, right: 0 }, hold = false;
  var curv = { yaw: reduce ? LANDVIEW.yaw : -1.0, pitch: .26, zoom: reduce ? 1 : 1.32 }, tgt = { yaw: 0, pitch: 0, zoom: 1 }, user = { yaw: 0, pitch: 0 }, dragging = false, idleAt = 0;
  G.goal = function (snap) {
    var v = ui.mode === 'door' ? LANDVIEW : VIEWS[Math.max(0, Math.min(5, ui.step))];
    tgt.yaw = v.yaw; tgt.pitch = v.pitch; tgt.zoom = v.zoom;
    var pk = picked(); if (ui.mode === 'build' && pk.length) { var ang = pk.reduce(function (a, k) { return a + teeth[k].ang; }, 0) / pk.length; tgt.yaw = Math.max(-1.15, Math.min(1.15, ang * .85)); tgt.zoom = Math.min(tgt.zoom, pk.length === 1 ? .76 : .9); }
    user.yaw = 0; user.pitch = 0; hold = false;
    if (snap) { curv.yaw = tgt.yaw; curv.pitch = tgt.pitch; curv.zoom = tgt.zoom; }
    dirty = true;
  };
  function resize() { W = stage.clientWidth; H = stage.clientHeight; renderer.setSize(W, H, false); camera.aspect = W / H; place.off = null; camera.clearViewOffset(); camera.updateProjectionMatrix(); dirty = true; }
  window.addEventListener('resize', resize);
  function place(t) {
    // the piece is framed in the free area beside or above the controls, whatever their size
    var tan = Math.tan(THREE.MathUtils.degToRad(camera.fov) / 2), fh = Math.max(140, boxC.bottom - boxC.top), yc = (boxC.top + boxC.bottom) / 2;
    var right = boxC.right > boxC.left + 200 ? boxC.right : W, fw = Math.max(200, right - boxC.left), xc = (boxC.left + right) / 2;
    var r = Math.max(19.4 * MM * H / (.9 * fh * tan), 36 * MM * H / (.92 * fw * tan)) * curv.zoom;
    var off = Math.round(W / 2 - xc);
    if (off !== place.off) { place.off = off; if (off) camera.setViewOffset(W, H, off, 0, W, H); else camera.clearViewOffset(); }
    var sway = (!reduce && !dragging && t - idleAt > 2500) ? Math.sin((t - idleAt - 2500) / 2600) * .16 : 0;
    var yaw = curv.yaw + user.yaw + sway, pitch = Math.max(-.5, Math.min(.6, curv.pitch + user.pitch));
    var lift = -((H / 2 - yc) / (H / 2)) * r * tan, cz = -6 * MM;
    camera.position.set(Math.sin(yaw) * Math.cos(pitch) * r, Math.sin(pitch) * r + lift, cz + Math.cos(yaw) * Math.cos(pitch) * r);
    camera.lookAt(0, lift, cz);
    return sway !== 0;
  }

  // ---------- touch ----------
  var ray = new THREE.Raycaster(), ptr = new THREE.Vector2(), down = null;
  function pick(e) {
    var r = canvas.getBoundingClientRect(); ptr.set(((e.clientX - r.left) / r.width) * 2 - 1, -((e.clientY - r.top) / r.height) * 2 + 1);
    ray.setFromCamera(ptr, camera); var hits = ray.intersectObjects(hit, false);
    for (var k = 0; k < hits.length; k++) if (hits[k].object.visible) return hits[k].object.userData.idx;
    return null;
  }
  canvas.addEventListener('pointerdown', function (e) { down = { x: e.clientX, y: e.clientY, moved: false }; dragging = true; hold = false; G.touched = performance.now(); });
  window.addEventListener('pointermove', function (e) {
    if (!down) { if (ready && e.target === canvas) canvas.classList.toggle('pt', pick(e) !== null); return; }
    var dx = e.clientX - down.x, dy = e.clientY - down.y;
    if (!down.moved && Math.abs(dx) + Math.abs(dy) > 7) { down.moved = true; down.lx = e.clientX; down.ly = e.clientY; }
    if (down.moved) { user.yaw -= (e.clientX - down.lx) * .008; user.pitch += (e.clientY - down.ly) * .005; user.yaw = Math.max(-1.6, Math.min(1.6, user.yaw)); down.lx = e.clientX; down.ly = e.clientY; dirty = true; }
  });
  window.addEventListener('pointerup', function (e) {
    if (!down) return; var d = down; down = null; dragging = false; idleAt = performance.now();
    if (d.moved || !ready || e.target !== canvas) return;
    G.tap(pick(e));
  });
  window.addEventListener('pointercancel', function () { down = null; dragging = false; });

  // ---------- the photo ----------
  G.shot = function (w, h) {
    teeth.forEach(function (o) { o.lift = 0; o.g.position.copy(o.base); o.g.scale.setScalar(1); });
    place(performance.now()); updateGlints(); renderer.render(scene, camera);
    var right = boxC.right > boxC.left + 200 ? boxC.right : W, c = document.createElement('canvas'), ar = w / h, k = canvas.height / H, fh = (boxC.bottom - boxC.top) * k, fw = (right - boxC.left) * k;
    var sh = Math.min(canvas.height, fh * 1.12, fw * 1.05 / ar), sw = sh * ar, cy = (boxC.top + boxC.bottom) / 2 * k, cx = (boxC.left + right) / 2 * k;
    c.width = w; c.height = h; c.getContext('2d').drawImage(canvas, Math.max(0, Math.min(canvas.width - sw, cx - sw / 2)), Math.max(0, Math.min(canvas.height - sh, cy - sh / 2)), sw, sh, 0, 0, w, h); dirty = true;
    return c.toDataURL('image/jpeg', .9);
  };

  // ---------- the selected tooth's glow: a pass of its own after the scene, hidden only by the teeth, never by the clear holder ----------
  var anyGlow = false, capDepth = new THREE.MeshBasicMaterial({ colorWrite: false });
  function renderAll() {
    renderer.render(scene, camera);
    if (!anyGlow) return;
    var bg = scene.background; scene.background = null; renderer.autoClear = false; renderer.clearDepth();
    camera.layers.set(1); scene.overrideMaterial = capDepth; renderer.render(scene, camera);   // the caps' depth only
    scene.overrideMaterial = null; camera.layers.set(2); renderer.render(scene, camera);      // then the glow on top
    camera.layers.set(0); renderer.autoClear = true; scene.background = bg;
  }

  // ---------- the loop: draws only when something changes ----------
  var visible = true, lastYaw = 9;
  if ('IntersectionObserver' in window) new IntersectionObserver(function (en) { visible = en[0].isIntersecting; }).observe(stage);
  function frame(t) {
    requestAnimationFrame(frame);
    if (!ready || !visible) return;
    var k = reduce ? 1 : .075, moving = false;
    ['yaw', 'pitch', 'zoom'].forEach(function (a) { var d = tgt[a] - curv[a]; if (Math.abs(d) > .0005) { curv[a] += d * k; moving = true; } });
    if (!dragging && !hold && (Math.abs(user.yaw) > .001 || Math.abs(user.pitch) > .001) && t - idleAt > 4000) { user.yaw *= .96; user.pitch *= .96; moving = true; }
    anyGlow = false;
    teeth.forEach(function (o, n) {
      var isPick = ui.mode === 'build' && (ui.picks || []).indexOf(n) >= 0, want = isPick ? 1 : 0;
      if (Math.abs(want - o.lift) > .002) { o.lift += (want - o.lift) * (reduce ? 1 : .16); o.g.position.copy(o.base).addScaledVector(o.out, o.lift * 1.3 * MM); moving = true; }
      var gwant = isPick && T[n].on; if (o.glow && o.glow.visible !== gwant) { o.glow.visible = gwant; moving = true; }
      if (gwant) { glowMat.uniforms.t.value = t; moving = true; anyGlow = true; }
      if (o.pop > 0) { o.pop = Math.max(0, o.pop - .06); o.g.scale.setScalar(1 + Math.sin(o.pop * Math.PI) * .1); moving = true; }
    });
    var bx = G.box || boxC; ['top', 'bottom', 'left', 'right'].forEach(function (a) { var d = (bx[a] || 0) - boxC[a]; if (Math.abs(d) > .5) { boxC[a] += d * (reduce ? 1 : .14); moving = true; } });
    if (Math.abs(openGoal - open) > .002) { setJaw(open + (openGoal - open) * (reduce ? 1 : .12)); moving = true; }
    if (glintT > 0) { glintT = Math.max(0, glintT - .035); renderer.toneMappingExposure = 1 + Math.sin(glintT * Math.PI) * .3; rig.rotation.y = Math.sin(glintT * Math.PI) * .1; moving = true; }
    if (G.tick) G.tick(t);
    var swaying = place(t);
    if (moving || swaying || dirty) { updateGlints(); renderAll(); dirty = false; }
  }
  G.solid(70); resize(); G.goal(reduce);
  G.boot = function () { G.sync(); load.hidden = true; ready = true; G.ready = true; dirty = true; requestAnimationFrame(frame); };
  })();
