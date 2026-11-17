
  // =====================================================================
  // 3D. Everything on the stage is generated here: nothing is loaded from a file.
  // =====================================================================
  var THREE = window.THREE, renderer = null;
  if (THREE) { try { renderer = new THREE.WebGLRenderer({ canvas: canvas, antialias: true, alpha: true, powerPreference: 'high-performance' }); } catch (err) { renderer = null; } }
  if (!renderer) { load.textContent = '3D is not available here. The controls below still work.'; }
  else (function () {
  renderer.outputEncoding = THREE.sRGBEncoding;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1;
  var PR = Math.min(window.devicePixelRatio || 1, 2); renderer.setPixelRatio(PR);
  var V3 = THREE.Vector3, scene = new THREE.Scene(), camera = new THREE.PerspectiveCamera(26, 1, .1, 100), pmrem = new THREE.PMREMGenerator(renderer);
  var MM = 2.3 / 62, rig = new THREE.Group(), jaw = new THREE.Group(), PIVOT = new V3(0, 2 * MM, -48 * MM);
  scene.add(rig); jaw.position.copy(PIVOT); rig.add(jaw);

  // the room: a pale stone studio, painted once and used as the backdrop
  function roomTexture(c0, c1, c2) {
    var c = document.createElement('canvas'); c.width = c.height = 512; var x = c.getContext('2d');
    x.fillStyle = c2; x.fillRect(0, 0, 512, 512); x.translate(256, 195); x.scale(614, 461);
    var g = x.createRadialGradient(0, 0, 0, 0, 0, 1); g.addColorStop(0, c0); g.addColorStop(.55, c1); g.addColorStop(1, c2);
    x.fillStyle = g; x.fillRect(-2, -2, 4, 4);
    var tex = new THREE.CanvasTexture(c); tex.encoding = THREE.sRGBEncoding; return tex;
  }
  scene.background = null;   // transparent: the stage's CSS paints the room (the same gradient in the builder; the page's own background on the front door)

  // ---------- lighting: four rooms, each reflected by different things ----------
  function sceneEnv(room, panels) {
    var s = new THREE.Scene();
    s.add(new THREE.Mesh(new THREE.BoxGeometry(30, 30, 30), new THREE.MeshBasicMaterial({ color: room, side: THREE.BackSide })));
    panels.forEach(function (p) {
      var m = new THREE.Mesh(new THREE.PlaneGeometry(p[0], p[1]), new THREE.MeshBasicMaterial({ color: new THREE.Color(p[6] || 0xffffff).multiplyScalar(p[5]), side: THREE.DoubleSide, toneMapped: false }));
      m.position.set(p[2], p[3], p[4]); m.lookAt(0, 0, 0); s.add(m);
    });
    var rt = pmrem.fromScene(s, .035);
    s.traverse(function (o) { if (o.geometry) o.geometry.dispose(); if (o.material) o.material.dispose(); });
    return rt.texture;
  }
  // the studio the clear holder sits in
  var studioEnv = sceneEnv(0x77756e, [[13, 8, 0, 11, 4, 2.4, 0xfff6e8], [9, 7, -9, 3, 9, 1.7, 0xfff6e8], [1.6, 12, 12, 3, 3, 5], [1.2, 10, -13, 4, -2, 4], [16, 4, 0, -10, 6, 1.4, 0xffe2b8], [9, 1.2, 0, 7, -12, 3.5]]);
  // the bright room the default cream caps reflect (the look from the first version)
  var creamEnv = sceneEnv(0xdad9d3, [[10, 6, 0, 11, 5, 5.5], [2.2, 12, -11, 2, 6, 4.4], [2.2, 12, 11, 3, 4, 3], [14, 3, 0, -9, 8, 1.2], [5, 5, 0, 4, 13, 1.9], [8, 1.2, 0, 6, -12, 5]]);
  scene.environment = studioEnv;
  function equirect(w, h, fn) {
    var data = new Uint16Array(w * h * 4), hf = THREE.DataUtils.toHalfFloat, rgb = [0, 0, 0];
    for (var y = 0; y < h; y++) for (var x = 0; x < w; x++) {
      var el = ((y + .5) / h - .5) * Math.PI, phi = ((x + .5) / w - .5) * Math.PI * 2; fn(el, phi, rgb);
      var k = (y * w + x) * 4; data[k] = hf(rgb[0]); data[k + 1] = hf(rgb[1]); data[k + 2] = hf(rgb[2]); data[k + 3] = hf(1);
    }
    var tex = new THREE.DataTexture(data, w, h, THREE.RGBAFormat, THREE.HalfFloatType);
    tex.mapping = THREE.EquirectangularReflectionMapping; tex.magFilter = tex.minFilter = THREE.LinearFilter; tex.needsUpdate = true;
    var out = pmrem.fromEquirectangular(tex).texture; tex.dispose(); return out;
  }
  function box(v, lo, hi, soft) { return Math.min(1, Math.max(0, (v - lo) / soft)) * Math.min(1, Math.max(0, (hi - v) / soft)); }
  // a jeweler's light tent, for the metal: broad soft light for body colour, dark gaps for contrast, hard strips for glints
  var metalEnv = equirect(512, 256, function (el, phi, c) {
    var deg = Math.PI / 180, dx = Math.cos(phi) * Math.cos(el), dz = Math.sin(phi) * Math.cos(el), az = Math.abs(Math.atan2(dx, dz)) / deg, e = el / deg;
    var r = .05, g = .045, b = .04, up = Math.max(0, e) / 90; r += .16 * up; g += .16 * up; b += .17 * up;
    var top = box(e, 34, 88, 7) * box(az, -1, 96, 16) * 5.2; r += top; g += top * .98; b += top * .94;
    var card = box(e, -3, 24, 5) * box(az, -1, 46, 10) * 1.55; r += card; g += card * .97; b += card * .92;
    var strip = box(e, -28, 62, 4) * box(az, 62, 71, 1.5) * 9; r += strip; g += strip; b += strip;
    var rim = box(e, 6, 46, 5) * box(az, 138, 181, 8) * 3.4; r += rim; g += rim; b += rim * 1.04;
    var floor = box(e, -91, -18, 14) * .62; r += floor; g += floor * .84; b += floor * .62;
    c[0] = r; c[1] = g; c[2] = b;
  });
  // a bright room full of small hot lights, for the stones: every facet catches a different one as the piece turns
  var sparkleEnv = (function () {
    var seed = 7, rnd = function () { seed = (seed * 16807) % 2147483647; return seed / 2147483647; }, lights = [], k;
    for (k = 0; k < 230; k++) { var tint = rnd(); lights.push([(rnd() - .5) * Math.PI * .96, (rnd() - .5) * Math.PI * 2, .03 + rnd() * .05, 7 + rnd() * 34, tint < .1 ? [.55, .8, 1.6] : tint < .2 ? [1.6, .95, .5] : [1, 1, 1]]); }
    return equirect(512, 256, function (el, phi, c) {
      var up = Math.max(0, el) / 1.57, r = .2 + .75 * up, g = .21 + .76 * up, b = .23 + .8 * up;
      for (var q = 0; q < lights.length; q++) {
        var L = lights[q], de = el - L[0], dp = Math.abs(phi - L[1]); if (dp > Math.PI) dp = 2 * Math.PI - dp; dp *= Math.cos(el);
        var d2 = (de * de + dp * dp) / (L[2] * L[2]); if (d2 < 6) { var w = Math.exp(-d2) * L[3]; r += w * L[4][0]; g += w * L[4][1]; b += w * L[4][2]; }
      }
      c[0] = r; c[1] = g; c[2] = b;
    });
  })();

  // ---------- materials ----------
  // clear resin, drawn in two passes: the far inside walls first, then the near surface, which turns solid at its edges and wherever it catches a light
  var resinBack = new THREE.MeshStandardMaterial({ color: 0x8fa3ad, roughness: .5, metalness: 0, transparent: true, opacity: .3, side: THREE.BackSide, depthWrite: false, envMapIntensity: .8 });
  var depthOnly = new THREE.MeshBasicMaterial({ colorWrite: false, transparent: true });
  function resinFront(write, edge) {
    var m = new THREE.MeshPhysicalMaterial({ color: 0xcfd9de, roughness: .2, metalness: 0, clearcoat: 1, clearcoatRoughness: .05, transparent: true, opacity: .66, depthWrite: write, envMapIntensity: 1 });
    m.onBeforeCompile = function (sh) {
      sh.fragmentShader = sh.fragmentShader.replace('#include <output_fragment>', 'float vvsEdge = pow(1.0 - saturate(dot(geometry.normal, geometry.viewDir)), 2.2); float vvsGlare = max(0.0, dot(outgoingLight - totalDiffuse, vec3(0.3333))); diffuseColor.a = clamp(diffuseColor.a + vvsEdge * ' + edge.toFixed(2) + ' + vvsGlare * 0.9, 0.0, 1.0);\n#include <output_fragment>');
    };
    m.customProgramCacheKey = function () { return 'resin' + edge; };
    return m;
  }
  var resinTooth = resinFront(true, .25), resinGum = resinFront(false, .45), resinBlock = resinFront(false, .5);
  var CLEAR = new THREE.Color(0xa9b9c1), MILK = new THREE.Color(0xeef1f1), TOOTHMILK = new THREE.Color(0xf4f5f3);
  G.solid = function (pct) {
    var t = Math.max(0, Math.min(1, (pct - 30) / 70));
    [resinGum, resinBlock].forEach(function (m) { m.opacity = .2 + .8 * t; m.color.copy(CLEAR).lerp(MILK, t); m.roughness = .06 + .42 * t; });
    resinTooth.opacity = Math.min(1, .5 + .55 * t); resinTooth.color.copy(CLEAR).lerp(TOOTHMILK, Math.min(1, t + .3)); resinTooth.roughness = .1 + .3 * t;
    resinBack.opacity = .5 - .36 * t; dirty = true;
  };
  var creamMat = new THREE.MeshStandardMaterial({ color: 0xffc35a, metalness: 1, roughness: .14, envMap: creamEnv, envMapIntensity: 1.15, side: THREE.DoubleSide });
  var diamondMat = new THREE.MeshStandardMaterial({ color: 0xffffff, metalness: 1, roughness: 0, envMap: sparkleEnv, envMapIntensity: 1.35 });
  var mats = {};
  function metalColor(metal, karat) { var m = METALS[metal], c = m.gold ? m.rgb[karat] || m.rgb['14k'] : m.rgb; return new THREE.Color(c[0], c[1], c[2]); }
  var OBJ_V = ['#include <common>', '#include <common>\nvarying vec3 vObj; varying vec3 vD1; varying vec3 vD2;'], OBJ_V2 = ['#include <begin_vertex>', '#include <begin_vertex>\nvObj = position; vD1 = normalize(normalMatrix * vec3(0.74, 0.66, 0.0)); vD2 = normalize(normalMatrix * vec3(-0.74, 0.66, 0.0));'], OBJ_F = ['#include <common>', '#include <common>\nvarying vec3 vObj; varying vec3 vD1; varying vec3 vD2;'];
  var FINISH_GLSL = {
    // diamond cut: crisp four-sided facets cut across the surface
    cut: ['#include <normal_fragment_maps>', '#include <normal_fragment_maps>\nvec2 cu = vec2(dot(vObj, vec3(0.74, 0.66, 0.1)), dot(vObj, vec3(-0.74, 0.66, 0.1))) * 19.0; vec2 cf = fract(cu) - 0.5; normal = normalize(normal + (vD1 * sign(cf.x) + vD2 * sign(cf.y)) * 0.3);'],
    // diamond dust: a fine sparkling grain
    dust: ['#include <normal_fragment_maps>', '#include <normal_fragment_maps>\nvec3 dq = mat3(0.80, 0.36, -0.48, -0.60, 0.48, -0.64, 0.0, 0.80, 0.60) * vObj; vec3 dc = floor(dq * 250.0); vec3 dr = fract(sin(vec3(dot(dc, vec3(127.1, 311.7, 74.7)), dot(dc, vec3(269.5, 183.3, 246.1)), dot(dc, vec3(113.5, 271.9, 124.6)))) * 43758.5453) - 0.5; normal = normalize(normal + dr * 0.7);'],
    // engraving: scrolling vine lines cut into the metal
    engr: ['#include <color_fragment>', '#include <color_fragment>\nvec2 ep = vObj.xy * 34.0; float ea = sin(ep.x * 1.7 + sin(ep.y * 2.3) * 1.7) * sin(ep.y * 1.9 + sin(ep.x * 2.1) * 1.5); float eb = sin((ep.x + ep.y) * 3.1 + sin(ep.x * 1.3) * 2.0); float vvsLine = max(smoothstep(0.09, 0.02, abs(ea)), smoothstep(0.06, 0.0, abs(eb)) * 0.55); diffuseColor.rgb *= mix(1.0, 0.34, vvsLine);']
  };
  function matFor(metal, karat, finish, mask) {
    var key = metal + karat + finish + (mask ? mask.uuid : ''); if (mats[key]) return mats[key];
    var m = new THREE.MeshStandardMaterial({ color: metalColor(metal, karat), metalness: 1, roughness: finish === 'dust' ? .2 : finish === 'cut' ? .12 : .17, envMap: metalEnv, envMapIntensity: finish === 'dust' ? 1.25 : 1, side: THREE.DoubleSide });
    if (mask) { m.alphaMap = mask; m.alphaTest = .5; }
    var glsl = FINISH_GLSL[finish];
    if (glsl) {
      m.onBeforeCompile = function (sh) {
        sh.vertexShader = sh.vertexShader.replace(OBJ_V[0], OBJ_V[1]).replace(OBJ_V2[0], OBJ_V2[1]);
        sh.fragmentShader = sh.fragmentShader.replace(OBJ_F[0], OBJ_F[1]).replace(glsl[0], glsl[1]);
        if (finish === 'engr') sh.fragmentShader = sh.fragmentShader.replace('#include <roughnessmap_fragment>', '#include <roughnessmap_fragment>\nroughnessFactor = mix(roughnessFactor, 0.6, vvsLine);');
      };
      m.customProgramCacheKey = function () { return 'fin-' + finish; };
    }
    return (mats[key] = m);
  }
  var enamel = {}, jewel = {}, opalM = {};
  function enamelMat(hex) { return enamel[hex] || (enamel[hex] = new THREE.MeshPhysicalMaterial({ color: hex, roughness: .22, metalness: 0, clearcoat: 1, clearcoatRoughness: .04, envMap: metalEnv, envMapIntensity: .9 })); }
  function cabMat(hex) { return jewel[hex] || (jewel[hex] = new THREE.MeshPhysicalMaterial({ color: hex, emissive: hex, emissiveIntensity: .05, roughness: .1, metalness: 0, clearcoat: 1, clearcoatRoughness: .02, envMap: metalEnv, envMapIntensity: .55 })); }
  function facetMat(hex) { return jewel['f' + hex] || (jewel['f' + hex] = new THREE.MeshStandardMaterial({ color: hex, metalness: 1, roughness: 0, envMap: sparkleEnv, envMapIntensity: 1.5 })); }
  // opal: a milky body with flashes of colour that move as the piece turns
  function opalMat(id) {
    if (opalM[id]) return opalM[id];
    var base = { white: 0xdfe6ea, fire: 0xd9592a, blue: 0x2c5fc0 }[id], fire = { white: .55, fire: .5, blue: .7 }[id];
    var m = new THREE.MeshPhysicalMaterial({ color: base, roughness: .14, metalness: 0, clearcoat: 1, clearcoatRoughness: .03, envMap: metalEnv, envMapIntensity: .7 });
    m.onBeforeCompile = function (sh) {
      sh.vertexShader = sh.vertexShader.replace('#include <common>', '#include <common>\nvarying vec3 vObj;').replace('#include <begin_vertex>', '#include <begin_vertex>\nvObj = position;');
      sh.fragmentShader = sh.fragmentShader.replace('#include <common>', '#include <common>\nvarying vec3 vObj;')
        .replace('#include <emissivemap_fragment>', '#include <emissivemap_fragment>\nvec3 oq = mat3(0.80, 0.36, -0.48, -0.60, 0.48, -0.64, 0.0, 0.80, 0.60) * vObj * 46.0; vec3 oc = floor(oq); float orn = fract(sin(dot(oc, vec3(127.1, 311.7, 74.7))) * 43758.5453); float ofl = pow(max(0.0, sin(orn * 40.0 + dot(normalize(vViewPosition), vec3(3.0, 5.0, 2.0)) * 7.0)), 3.0); totalEmissiveRadiance += ofl * (0.5 + 0.5 * cos(6.2831 * (orn + vec3(0.0, 0.33, 0.67)))) * ' + fire.toFixed(2) + ';');
    };
    m.customProgramCacheKey = function () { return 'opal' + id; };
    return (opalM[id] = m);
  }
  var photoTex = null, photoMat = new THREE.MeshPhysicalMaterial({ color: 0xffffff, roughness: .28, metalness: 0, clearcoat: .9, clearcoatRoughness: .06, envMap: metalEnv, envMapIntensity: .5 });
  function setPhoto(img) {         // the customer's image for photo grillz; a drawn sample stands in until they add one
    var c = document.createElement('canvas'); c.width = 1024; c.height = 256; var x = c.getContext('2d');
    if (img) { var s = Math.max(1024 / img.width, 256 / img.height), w = img.width * s, h = img.height * s; x.drawImage(img, (1024 - w) / 2, (256 - h) / 2, w, h); }
    else {
      var g = x.createLinearGradient(0, 0, 1024, 0); g.addColorStop(0, '#0f1c3f'); g.addColorStop(.5, '#b3222f'); g.addColorStop(1, '#f2a33a'); x.fillStyle = g; x.fillRect(0, 0, 1024, 256);
      x.fillStyle = 'rgba(255,255,255,.92)'; x.font = '700 150px Geist, Arial, sans-serif'; x.textAlign = 'center'; x.textBaseline = 'middle'; x.fillText('YOUR PHOTO', 512, 136);
    }
    if (photoTex) photoTex.dispose(); photoTex = new THREE.CanvasTexture(c); photoTex.encoding = THREE.sRGBEncoding; photoTex.anisotropy = 4; photoMat.map = photoTex; photoMat.needsUpdate = true;
  }
  setPhoto(null);
