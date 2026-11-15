
  // ---------- the arch: where each tooth sits, walked so neighbours touch at their widest points ----------
  function archPath(pts, zshift) {
    var v = [], k; for (k = pts.length - 1; k >= 1; k--) v.push(new V3(-pts[k][0], 0, pts[k][1] + zshift)); for (k = 0; k < pts.length; k++) v.push(new V3(pts[k][0], 0, pts[k][1] + zshift));
    var P = new THREE.CatmullRomCurve3(v, false, 'centripetal').getPoints(1200).slice(600), len = [0];
    for (k = 1; k < P.length; k++) len.push(len[k - 1] + P[k].distanceTo(P[k - 1]));
    return { at: function (s) {
      s = Math.max(0, Math.min(len[len.length - 1] - .001, s)); var lo = 0, hi = len.length - 1; while (hi - lo > 1) { var mid = (lo + hi) >> 1; if (len[mid] > s) hi = mid; else lo = mid; }
      var f = (s - len[lo]) / (len[hi] - len[lo] || 1), a = P[lo], b = P[hi], tx = b.x - a.x, tz = b.z - a.z, tl = Math.hypot(tx, tz) || 1;
      return { x: a.x + tx * f, z: a.z + tz * f, nx: -tz / tl, nz: tx / tl, ang: Math.atan2(-tz / tl, tx / tl) };
    } };
  }
  var ARCH_U = archPath([[0, 17.5], [4.1, 16.6], [11.3, 14.6], [16.3, 10.0], [19.6, 4.9], [21.9, -0.7], [24.2, -8.4], [26.2, -18.4], [26.9, -29.8], [27.2, -50]], .9);
  var ARCH_L = archPath([[0, 19.2], [3.2, 18.8], [9.4, 17.35], [14.35, 13.55], [17.65, 8.75], [20.8, 3.15], [23.4, -5.0], [25.25, -15.5], [25.85, -27.25], [26.1, -47]], -2.9);
  var LOW_Y = -.25, teeth = [], hit = [], dirty = true, ready = false;
  function layout(list) { var s = 0, out = []; list.forEach(function (def) { out.push({ def: def, s: s + def[1] / 2 }); s += def[1]; }); out.end = s; return out; }
  function buildRow(list, path, upper) {
    var lay = layout(list);
    lay.forEach(function (it, k) {
      var pt = path.at(it.s), def = it.def, h = def[2];
      [1, -1].forEach(function (side) {
        var g = new THREE.Group(); g.rotation.order = 'YXZ'; g.rotation.set(0, side * pt.ang, upper ? Math.PI : 0);
        var base = new V3(side * pt.x * MM, (upper ? h : LOW_Y - h) * MM, pt.z * MM); if (!upper) base.sub(PIVOT);
        g.position.copy(base);
        var rm = new THREE.Mesh(toothGeo(def), resinTooth), rb = new THREE.Mesh(toothGeo(def), resinBack), cm = new THREE.Mesh(capGeo(def, SIDE.deep), creamMat); cm.visible = false;
        rb.renderOrder = 1; rm.renderOrder = 2;
        var idx = (upper ? 0 : 16) + (side > 0 ? 8 + k : 7 - k);
        rm.userData.idx = cm.userData.idx = idx; g.add(rb); g.add(rm); g.add(cm); (upper ? rig : jaw).add(g);
        teeth[idx] = { g: g, resin: rm, back: rb, cap: cm, deco: null, key: null, spots: [], def: def, upper: upper, base: base, out: new V3(Math.sin(side * pt.ang), 0, Math.cos(side * pt.ang)), ang: side * pt.ang, pop: 0, lift: 0 };
        hit.push(rm, cm);
      });
    });
    return lay;
  }
  // the clear holder: a flat-topped block, like a jeweler's mold or a display case, with a slim gum roll where the teeth meet it
  var BLOCK0 = 11.4, BLOCK1 = 18.6;
  function holder(lay, path, upper) {
    var NS = 24, end = lay.end + 1.2, tail = 4, pos = [], idx = [], rings = 0, s, j, u = upper ? 1 : -1, y0 = upper ? 0 : LOW_Y, centre = [], stations = [], q0;
    function prop(as, n) { if (as <= lay[0].s) return lay[0].def[n]; for (var k = 1; k < lay.length; k++) if (as <= lay[k].s) { var f = (as - lay[k - 1].s) / (lay[k].s - lay[k - 1].s); f = f * f * (3 - 2 * f); return lay[k - 1].def[n] + (lay[k].def[n] - lay[k - 1].def[n]) * f; } return lay[lay.length - 1].def[n]; }
    for (s = -end; s <= end + .001; s += 1) stations.push(s);
    [15, 30, 45, 59, 70, 79, 86].forEach(function (dg) { var e = end + tail * Math.sin(dg * Math.PI / 180); stations.push(e); stations.unshift(-e); });
    for (q0 = 0; q0 < stations.length; q0++) {
      s = stations[q0];
      var as = Math.abs(s), over = Math.max(0, as - end) / tail, shrink = Math.sqrt(Math.max(0, 1 - over * over)), pt = path.at(as), sx = s < 0 ? -1 : 1;
      var gum = prop(as, 2), dep = prop(as, 3), crest = y0 + u * (gum - .15), base = y0 + u * (BLOCK0 + 1), yc = (crest + base) / 2, hh = Math.abs(base - crest) / 2, half = dep / 2 + .75, off = -.12 * dep;
      for (j = 0; j < NS; j++) {
        var a = j / NS * Math.PI * 2, r = srad(a, 2.6), n = off + r * Math.cos(a) * half * shrink;
        pos.push((sx * pt.x + sx * pt.nx * n) * MM, (yc + u * r * Math.sin(a) * hh * shrink) * MM, (pt.z + pt.nz * n) * MM);
      }
      centre.push([(sx * pt.x + sx * pt.nx * off) * MM, yc * MM, (pt.z + pt.nz * off) * MM]); rings++;
    }
    grid(idx, rings, NS);
    var e0 = pos.length / 3; pos.push.apply(pos, centre[0]); for (j = 0; j < NS; j++) idx.push(e0, (j + 1) % NS, j);
    var e1 = pos.length / 3; pos.push.apply(pos, centre[rings - 1]); for (j = 0; j < NS; j++) idx.push(e1, (rings - 1) * NS + j, (rings - 1) * NS + (j + 1) % NS);
    var roll = orient(bufGeo(pos, idx), true);
    // the block: the arch's outline pushed out past the teeth, closed straight across the back, with a flat top and bevelled edges
    var shape = new THREE.Shape(), first = true, bt = .9, thick = BLOCK1 - BLOCK0;
    for (s = -end - 2; s <= end + 2.001; s += 1.5) { var p2 = path.at(Math.abs(s)), sg = s < 0 ? -1 : 1, o2 = prop(Math.abs(s), 3) * .52 + 1.3, X = sg * (p2.x + p2.nx * o2), Z = p2.z + p2.nz * o2; if (first) { shape.moveTo(X, Z); first = false; } else shape.lineTo(X, Z); }
    shape.closePath();
    var block = new THREE.ExtrudeGeometry(shape, { depth: thick - 2 * bt, bevelEnabled: true, bevelThickness: bt, bevelSize: bt, bevelSegments: 3, curveSegments: 4 });
    block.rotateX(Math.PI / 2); block.translate(0, (upper ? BLOCK1 : LOW_Y - BLOCK0) - bt, 0); block.scale(MM, MM, MM); block.computeVertexNormals();
    [roll, block].forEach(function (g, gi) {
      [resinBack, depthOnly, gi ? resinBlock : resinGum].forEach(function (mat, n) { var m = new THREE.Mesh(g, mat); m.renderOrder = n === 0 ? 1 : n === 1 ? 3 + gi * 2 : 4 + gi * 2; if (!upper) m.position.copy(PIVOT).multiplyScalar(-1); (upper ? rig : jaw).add(m); });
    });
  }

  // ---------- dressing a tooth: its cap, finish, stones, panels, letters and charm ----------
  var letterMats = {}, photoVer = 0;
  function fangOf(def) { return ['fang', def[1], def[2] + 3.4, def[3]]; }
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
    o.cap.geometry = capGeo(def, side);
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
  var layU = buildRow(UPPER, ARCH_U, true), layL = buildRow(LOWER, ARCH_L, false);
  holder(layU, ARCH_U, true); holder(layL, ARCH_L, false);
  (function () {
    var cv = document.createElement('canvas'); cv.width = cv.height = 128; var cx = cv.getContext('2d'), gr = cx.createRadialGradient(64, 64, 4, 64, 64, 64);
    gr.addColorStop(0, 'rgba(0,0,0,1)'); gr.addColorStop(1, 'rgba(0,0,0,0)'); cx.fillStyle = gr; cx.fillRect(0, 0, 128, 128);
    var m = new THREE.Mesh(new THREE.PlaneGeometry(3.6, 3.8), new THREE.MeshBasicMaterial({ map: new THREE.CanvasTexture(cv), transparent: true, opacity: .2, depthWrite: false, toneMapped: false }));
    m.rotation.x = -Math.PI / 2; m.position.set(0, -20.6 * MM, -12 * MM); scene.add(m);
  })();
  var open = 0, openGoal = 0, glintT = 0;
  function setJaw(o) { open = o; jaw.rotation.x = o * .095; dirty = true; }
  G.jaw = function (wide) { openGoal = wide ? 1 : 0; };
  G.view = function (dir) { user.yaw = dir * 1.1 - tgt.yaw; user.pitch = 0; hold = true; idleAt = performance.now(); dirty = true; };
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
  var VIEWS = [{ yaw: 0, pitch: .05, zoom: 1 }, { yaw: .46, pitch: .08, zoom: .92 }, { yaw: -.34, pitch: .07, zoom: .7 }, { yaw: .1, pitch: .04, zoom: .68 }, { yaw: .3, pitch: -.03, zoom: 1 }], LANDVIEW = { yaw: -.3, pitch: .08, zoom: 1 };
  var boxC = { top: 64, bottom: 420 }, hold = false;
  var curv = { yaw: reduce ? LANDVIEW.yaw : -1.0, pitch: .26, zoom: reduce ? 1 : 1.32 }, tgt = { yaw: 0, pitch: 0, zoom: 1 }, user = { yaw: 0, pitch: 0 }, dragging = false, idleAt = 0;
  G.goal = function (snap) {
    var v = ui.mode === 'door' ? LANDVIEW : VIEWS[ui.step];
    tgt.yaw = v.yaw; tgt.pitch = v.pitch; tgt.zoom = v.zoom;
    if (ui.mode === 'build' && hasSel() && teeth[ui.sel]) { tgt.yaw = Math.max(-1.15, Math.min(1.15, teeth[ui.sel].ang * .85)); tgt.zoom = Math.min(tgt.zoom, .76); }
    user.yaw = 0; user.pitch = 0; hold = false;
    if (snap) { curv.yaw = tgt.yaw; curv.pitch = tgt.pitch; curv.zoom = tgt.zoom; }
    dirty = true;
  };
  function resize() { W = stage.clientWidth; H = stage.clientHeight; renderer.setSize(W, H, false); camera.aspect = W / H; camera.updateProjectionMatrix(); dirty = true; }
  window.addEventListener('resize', resize);
  function place(t) {
    // the piece is framed in the free area above the controls, whatever their height
    var tan = Math.tan(THREE.MathUtils.degToRad(camera.fov) / 2), fh = Math.max(140, boxC.bottom - boxC.top), yc = (boxC.top + boxC.bottom) / 2;
    var r = Math.max(21 * MM * H / (.9 * fh * tan), 36 * MM * H / (.92 * W * tan)) * curv.zoom;
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
    var c = document.createElement('canvas'), ar = w / h, k = canvas.height / H, fh = (boxC.bottom - boxC.top) * k, sh = Math.min(canvas.height, fh * 1.12, canvas.width / ar), sw = sh * ar, cy = (boxC.top + boxC.bottom) / 2 * k;
    c.width = w; c.height = h; c.getContext('2d').drawImage(canvas, (canvas.width - sw) / 2, Math.max(0, Math.min(canvas.height - sh, cy - sh / 2)), sw, sh, 0, 0, w, h); dirty = true;
    return c.toDataURL('image/jpeg', .9);
  };

  // ---------- the loop: draws only when something changes ----------
  var visible = true, lastYaw = 9;
  if ('IntersectionObserver' in window) new IntersectionObserver(function (en) { visible = en[0].isIntersecting; }).observe(stage);
  function frame(t) {
    requestAnimationFrame(frame);
    if (!ready || !visible) return;
    var k = reduce ? 1 : .075, moving = false;
    ['yaw', 'pitch', 'zoom'].forEach(function (a) { var d = tgt[a] - curv[a]; if (Math.abs(d) > .0005) { curv[a] += d * k; moving = true; } });
    if (!dragging && !hold && (Math.abs(user.yaw) > .001 || Math.abs(user.pitch) > .001) && t - idleAt > 4000) { user.yaw *= .96; user.pitch *= .96; moving = true; }
    teeth.forEach(function (o, n) {
      var want = ui.mode === 'build' && ui.sel === n ? 1 : 0;
      if (Math.abs(want - o.lift) > .002) { o.lift += (want - o.lift) * (reduce ? 1 : .16); o.g.position.copy(o.base).addScaledVector(o.out, o.lift * 1.3 * MM); moving = true; }
      if (o.pop > 0) { o.pop = Math.max(0, o.pop - .06); o.g.scale.setScalar(1 + Math.sin(o.pop * Math.PI) * .1); moving = true; }
    });
    var bx = G.box || boxC; ['top', 'bottom'].forEach(function (a) { var d = bx[a] - boxC[a]; if (Math.abs(d) > .5) { boxC[a] += d * (reduce ? 1 : .14); moving = true; } });
    if (Math.abs(openGoal - open) > .002) { setJaw(open + (openGoal - open) * (reduce ? 1 : .12)); moving = true; }
    if (glintT > 0) { glintT = Math.max(0, glintT - .035); renderer.toneMappingExposure = 1 + Math.sin(glintT * Math.PI) * .3; rig.rotation.y = Math.sin(glintT * Math.PI) * .1; moving = true; }
    if (G.tick) G.tick(t);
    var swaying = place(t);
    if (moving || swaying || dirty) { updateGlints(); renderer.render(scene, camera); dirty = false; }
  }
  G.solid(70); resize(); G.goal(reduce);
  G.boot = function () { G.sync(); load.hidden = true; ready = true; G.ready = true; dirty = true; requestAnimationFrame(frame); };
  })();
