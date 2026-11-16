import * as THREE from 'three';
import type { KaratId, MetalId, OpalId } from '../../../lib/renderSpec';

// Light and materials (a port of docs/redesign/prototype/src/20-three.js, the
// approved prototype). There are no lamps: everything is lit by four rooms,
// each reflected by different things:
//   studio  the clear resin holder (and anything else on the stage);
//   metal   a jeweler's light tent, painted pixel by pixel, for the caps;
//   sparkle a bright room full of small hot lights, for the stones;
//   cream   the bright room the prototype's default cream caps reflect. The
//           builder has no "no metal yet" state (every tooth in the set wears its
//           design from the first frame), so cream is not used here.
//
// Colours: the prototype runs three.js r147 with colour management off, so its
// hex colours are used as they are, as linear values. Here (r172, colour
// management on) the same numbers are passed as linear explicitly, so the
// metals and the resin come out exactly as approved.
//
// The rooms need the renderer to bake, so a look is made once per renderer.

const lin = (hex: number) => new THREE.Color().setHex(hex, THREE.LinearSRGBColorSpace);

/** The prototype's metal colours (linear), gold by karat. 22K is not in the prototype: it carries on the same steps. */
const METAL_RGB: Record<MetalId, Partial<Record<KaratId, [number, number, number]>> | [number, number, number]> = {
  yellow: { '10k': [1, 0.775, 0.4], '14k': [1, 0.725, 0.315], '18k': [1, 0.665, 0.23], '22k': [1, 0.605, 0.15] },
  white: { '10k': [0.9, 0.9, 0.89], '14k': [0.93, 0.92, 0.9], '18k': [0.95, 0.93, 0.89], '22k': [0.96, 0.935, 0.875] },
  rose: { '10k': [0.96, 0.66, 0.55], '14k': [0.97, 0.6, 0.47], '18k': [0.98, 0.55, 0.4], '22k': [0.99, 0.5, 0.33] },
  silver: [0.96, 0.97, 0.98],
  platinum: [0.8, 0.83, 0.87],
};

export function metalColor(metal: MetalId, karat: KaratId) {
  const table = METAL_RGB[metal];
  const c = Array.isArray(table) ? table : table[karat] ?? table['14k']!;
  return new THREE.Color(c[0], c[1], c[2]);
}

/** The cap's finish: the prototype's names. */
export type Finish = 'solid' | 'cut' | 'dust' | 'engr';

const OBJ_V: [string, string] = ['#include <common>', '#include <common>\nvarying vec3 vObj; varying vec3 vD1; varying vec3 vD2;'];
const OBJ_V2: [string, string] = [
  '#include <begin_vertex>',
  '#include <begin_vertex>\nvObj = position; vD1 = normalize(normalMatrix * vec3(0.74, 0.66, 0.0)); vD2 = normalize(normalMatrix * vec3(-0.74, 0.66, 0.0));',
];
const OBJ_F: [string, string] = ['#include <common>', '#include <common>\nvarying vec3 vObj; varying vec3 vD1; varying vec3 vD2;'];
const FINISH_GLSL: Partial<Record<Finish, [string, string]>> = {
  // Diamond cut: crisp four-sided facets cut across the surface.
  cut: [
    '#include <normal_fragment_maps>',
    '#include <normal_fragment_maps>\nvec2 cu = vec2(dot(vObj, vec3(0.74, 0.66, 0.1)), dot(vObj, vec3(-0.74, 0.66, 0.1))) * 19.0; vec2 cf = fract(cu) - 0.5; normal = normalize(normal + (vD1 * sign(cf.x) + vD2 * sign(cf.y)) * 0.3);',
  ],
  // Diamond dust: a fine sparkling grain.
  dust: [
    '#include <normal_fragment_maps>',
    '#include <normal_fragment_maps>\nvec3 dq = mat3(0.80, 0.36, -0.48, -0.60, 0.48, -0.64, 0.0, 0.80, 0.60) * vObj; vec3 dc = floor(dq * 250.0); vec3 dr = fract(sin(vec3(dot(dc, vec3(127.1, 311.7, 74.7)), dot(dc, vec3(269.5, 183.3, 246.1)), dot(dc, vec3(113.5, 271.9, 124.6)))) * 43758.5453) - 0.5; normal = normalize(normal + dr * 0.7);',
  ],
  // Engraving: scrolling vine lines cut into the metal.
  engr: [
    '#include <color_fragment>',
    '#include <color_fragment>\nvec2 ep = vObj.xy * 34.0; float ea = sin(ep.x * 1.7 + sin(ep.y * 2.3) * 1.7) * sin(ep.y * 1.9 + sin(ep.x * 2.1) * 1.5); float eb = sin((ep.x + ep.y) * 3.1 + sin(ep.x * 1.3) * 2.0); float vvsLine = max(smoothstep(0.09, 0.02, abs(ea)), smoothstep(0.06, 0.0, abs(eb)) * 0.55); diffuseColor.rgb *= mix(1.0, 0.34, vvsLine);',
  ],
};

export type Look = ReturnType<typeof makeLook>;

const looks = new WeakMap<THREE.WebGLRenderer, Look>();
/** The rooms and materials for one renderer, made the first time it asks. */
export function lookFor(renderer: THREE.WebGLRenderer): Look {
  let look = looks.get(renderer);
  if (!look) {
    look = makeLook(renderer);
    looks.set(renderer, look);
  }
  return look;
}

function makeLook(renderer: THREE.WebGLRenderer) {
  const pmrem = new THREE.PMREMGenerator(renderer);

  // ---------- the rooms ----------
  type Panel = [number, number, number, number, number, number, number?];
  const sceneEnv = (room: number, panels: Panel[]) => {
    const s = new THREE.Scene();
    s.add(new THREE.Mesh(new THREE.BoxGeometry(30, 30, 30), new THREE.MeshBasicMaterial({ color: lin(room), side: THREE.BackSide })));
    panels.forEach((p) => {
      const m = new THREE.Mesh(
        new THREE.PlaneGeometry(p[0], p[1]),
        new THREE.MeshBasicMaterial({ color: lin(p[6] ?? 0xffffff).multiplyScalar(p[5]), side: THREE.DoubleSide, toneMapped: false }),
      );
      m.position.set(p[2], p[3], p[4]);
      m.lookAt(0, 0, 0);
      s.add(m);
    });
    const rt = pmrem.fromScene(s, 0.035);
    s.traverse((o) => {
      if (o instanceof THREE.Mesh) {
        o.geometry.dispose();
        (o.material as THREE.Material).dispose();
      }
    });
    return rt.texture;
  };
  // The studio the clear holder sits in.
  const studioEnv = sceneEnv(0x77756e, [
    [13, 8, 0, 11, 4, 2.4, 0xfff6e8],
    [9, 7, -9, 3, 9, 1.7, 0xfff6e8],
    [1.6, 12, 12, 3, 3, 5],
    [1.2, 10, -13, 4, -2, 4],
    [16, 4, 0, -10, 6, 1.4, 0xffe2b8],
    [9, 1.2, 0, 7, -12, 3.5],
  ]);
  const equirect = (w: number, h: number, fn: (el: number, phi: number, rgb: number[]) => void) => {
    const data = new Uint16Array(w * h * 4);
    const hf = THREE.DataUtils.toHalfFloat;
    const rgb = [0, 0, 0];
    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        const el = ((y + 0.5) / h - 0.5) * Math.PI;
        const phi = ((x + 0.5) / w - 0.5) * Math.PI * 2;
        fn(el, phi, rgb);
        const k = (y * w + x) * 4;
        data[k] = hf(rgb[0]);
        data[k + 1] = hf(rgb[1]);
        data[k + 2] = hf(rgb[2]);
        data[k + 3] = hf(1);
      }
    }
    const tex = new THREE.DataTexture(data, w, h, THREE.RGBAFormat, THREE.HalfFloatType);
    tex.mapping = THREE.EquirectangularReflectionMapping;
    tex.magFilter = tex.minFilter = THREE.LinearFilter;
    tex.needsUpdate = true;
    const out = pmrem.fromEquirectangular(tex).texture;
    tex.dispose();
    return out;
  };
  const box = (v: number, lo: number, hi: number, soft: number) => Math.min(1, Math.max(0, (v - lo) / soft)) * Math.min(1, Math.max(0, (hi - v) / soft));
  // A jeweler's light tent, for the metal: broad soft light for body colour, dark gaps for contrast, hard strips for glints.
  const metalEnv = equirect(512, 256, (el, phi, c) => {
    const deg = Math.PI / 180;
    const dx = Math.cos(phi) * Math.cos(el);
    const dz = Math.sin(phi) * Math.cos(el);
    const az = Math.abs(Math.atan2(dx, dz)) / deg;
    const e = el / deg;
    let r = 0.05;
    let g = 0.045;
    let b = 0.04;
    const up = Math.max(0, e) / 90;
    r += 0.16 * up;
    g += 0.16 * up;
    b += 0.17 * up;
    const top = box(e, 34, 88, 7) * box(az, -1, 96, 16) * 5.2;
    r += top;
    g += top * 0.98;
    b += top * 0.94;
    const card = box(e, -3, 24, 5) * box(az, -1, 46, 10) * 1.55;
    r += card;
    g += card * 0.97;
    b += card * 0.92;
    const strip = box(e, -28, 62, 4) * box(az, 62, 71, 1.5) * 9;
    r += strip;
    g += strip;
    b += strip;
    const rim = box(e, 6, 46, 5) * box(az, 138, 181, 8) * 3.4;
    r += rim;
    g += rim;
    b += rim * 1.04;
    const floor = box(e, -91, -18, 14) * 0.62;
    r += floor;
    g += floor * 0.84;
    b += floor * 0.62;
    c[0] = r;
    c[1] = g;
    c[2] = b;
  });
  // A bright room full of small hot lights, for the stones: every facet catches a different one as the piece turns.
  const sparkleEnv = (() => {
    let seed = 7;
    const rnd = () => {
      seed = (seed * 16807) % 2147483647;
      return seed / 2147483647;
    };
    const lights: [number, number, number, number, number[]][] = [];
    for (let k = 0; k < 230; k++) {
      const tint = rnd();
      lights.push([(rnd() - 0.5) * Math.PI * 0.96, (rnd() - 0.5) * Math.PI * 2, 0.03 + rnd() * 0.05, 7 + rnd() * 34, tint < 0.1 ? [0.55, 0.8, 1.6] : tint < 0.2 ? [1.6, 0.95, 0.5] : [1, 1, 1]]);
    }
    return equirect(512, 256, (el, phi, c) => {
      const up = Math.max(0, el) / 1.57;
      let r = 0.2 + 0.75 * up;
      let g = 0.21 + 0.76 * up;
      let b = 0.23 + 0.8 * up;
      for (let q = 0; q < lights.length; q++) {
        const L = lights[q];
        const de = el - L[0];
        let dp = Math.abs(phi - L[1]);
        if (dp > Math.PI) dp = 2 * Math.PI - dp;
        dp *= Math.cos(el);
        const d2 = (de * de + dp * dp) / (L[2] * L[2]);
        if (d2 < 6) {
          const w = Math.exp(-d2) * L[3];
          r += w * L[4][0];
          g += w * L[4][1];
          b += w * L[4][2];
        }
      }
      c[0] = r;
      c[1] = g;
      c[2] = b;
    });
  })();
  pmrem.dispose();

  // ---------- clear resin, drawn in two passes ----------
  // The far inside walls first, then the near surface, which turns solid at its
  // edges and wherever it catches a light.
  const resinBack = new THREE.MeshStandardMaterial({
    color: lin(0x8fa3ad),
    roughness: 0.5,
    metalness: 0,
    transparent: true,
    opacity: 0.3,
    side: THREE.BackSide,
    depthWrite: false,
    envMap: studioEnv,
    envMapIntensity: 0.8,
  });
  const depthOnly = new THREE.MeshBasicMaterial({ colorWrite: false, transparent: true });
  const resinFront = (write: boolean, edge: number) => {
    const m = new THREE.MeshPhysicalMaterial({
      color: lin(0xcfd9de),
      roughness: 0.2,
      metalness: 0,
      clearcoat: 1,
      clearcoatRoughness: 0.05,
      transparent: true,
      opacity: 0.66,
      depthWrite: write,
      envMap: studioEnv,
      envMapIntensity: 1,
    });
    m.onBeforeCompile = (sh) => {
      sh.fragmentShader = sh.fragmentShader.replace(
        '#include <opaque_fragment>',
        `float vvsEdge = pow(1.0 - saturate(dot(geometryNormal, geometryViewDir)), 2.2); float vvsGlare = max(0.0, dot(outgoingLight - totalDiffuse, vec3(0.3333))); diffuseColor.a = clamp(diffuseColor.a + vvsEdge * ${edge.toFixed(2)} + vvsGlare * 0.9, 0.0, 1.0);\n#include <opaque_fragment>`,
      );
    };
    m.customProgramCacheKey = () => `resin${edge}`;
    return m;
  };
  const resinTooth = resinFront(true, 0.25);
  const resinGum = resinFront(false, 0.45);
  const resinBlock = resinFront(false, 0.5);
  const CLEAR = lin(0xa9b9c1);
  const MILK = lin(0xeef1f1);
  const TOOTHMILK = lin(0xf4f5f3);
  /** How solid the holder looks, 30 (clearest) to 100 (milky). */
  const setSolid = (pct: number) => {
    const t = Math.max(0, Math.min(1, (pct - 30) / 70));
    [resinGum, resinBlock].forEach((m) => {
      m.opacity = 0.2 + 0.8 * t;
      m.color.copy(CLEAR).lerp(MILK, t);
      m.roughness = 0.06 + 0.42 * t;
    });
    resinTooth.opacity = Math.min(1, 0.5 + 0.55 * t);
    resinTooth.color.copy(CLEAR).lerp(TOOTHMILK, Math.min(1, t + 0.3));
    resinTooth.roughness = 0.1 + 0.3 * t;
    resinBack.opacity = 0.5 - 0.36 * t;
  };

  // ---------- metal, stones, opal, photo ----------
  const diamondMat = new THREE.MeshStandardMaterial({ color: 0xffffff, metalness: 1, roughness: 0, envMap: sparkleEnv, envMapIntensity: 1.35 });
  const mats = new Map<string, THREE.MeshStandardMaterial>();
  /** A cap's metal, with its finish cut in, and an open face's cut-away (`mask`). */
  const matFor = (metal: MetalId, karat: KaratId, finish: Finish, mask: THREE.Texture | null = null) => {
    const key = `${metal}${karat}${finish}${mask ? mask.uuid : ''}`;
    const known = mats.get(key);
    if (known) return known;
    const m = new THREE.MeshStandardMaterial({
      color: metalColor(metal, karat),
      metalness: 1,
      roughness: finish === 'dust' ? 0.2 : finish === 'cut' ? 0.12 : 0.17,
      envMap: metalEnv,
      envMapIntensity: finish === 'dust' ? 1.25 : 1,
      side: THREE.DoubleSide,
    });
    if (mask) {
      m.alphaMap = mask;
      m.alphaTest = 0.5;
    }
    const glsl = FINISH_GLSL[finish];
    if (glsl) {
      m.onBeforeCompile = (sh) => {
        sh.vertexShader = sh.vertexShader.replace(OBJ_V[0], OBJ_V[1]).replace(OBJ_V2[0], OBJ_V2[1]);
        sh.fragmentShader = sh.fragmentShader.replace(OBJ_F[0], OBJ_F[1]).replace(glsl[0], glsl[1]);
        if (finish === 'engr') sh.fragmentShader = sh.fragmentShader.replace('#include <roughnessmap_fragment>', '#include <roughnessmap_fragment>\nroughnessFactor = mix(roughnessFactor, 0.6, vvsLine);');
      };
      m.customProgramCacheKey = () => `fin-${finish}`;
    }
    mats.set(key, m);
    return m;
  };
  const opalM = new Map<OpalId, THREE.MeshPhysicalMaterial>();
  /** Opal: a milky body with flashes of colour that move as the piece turns. */
  const opalMat = (id: OpalId) => {
    const known = opalM.get(id);
    if (known) return known;
    const base = { white: 0xdfe6ea, fire: 0xd9592a, blue: 0x2c5fc0 }[id];
    const fire = { white: 0.55, fire: 0.5, blue: 0.7 }[id];
    const m = new THREE.MeshPhysicalMaterial({ color: lin(base), roughness: 0.14, metalness: 0, clearcoat: 1, clearcoatRoughness: 0.03, envMap: metalEnv, envMapIntensity: 0.7 });
    m.onBeforeCompile = (sh) => {
      sh.vertexShader = sh.vertexShader.replace('#include <common>', '#include <common>\nvarying vec3 vObj;').replace('#include <begin_vertex>', '#include <begin_vertex>\nvObj = position;');
      sh.fragmentShader = sh.fragmentShader
        .replace('#include <common>', '#include <common>\nvarying vec3 vObj;')
        .replace(
          '#include <emissivemap_fragment>',
          `#include <emissivemap_fragment>\nvec3 oq = mat3(0.80, 0.36, -0.48, -0.60, 0.48, -0.64, 0.0, 0.80, 0.60) * vObj * 46.0; vec3 oc = floor(oq); float orn = fract(sin(dot(oc, vec3(127.1, 311.7, 74.7))) * 43758.5453); float ofl = pow(max(0.0, sin(orn * 40.0 + dot(normalize(vViewPosition), vec3(3.0, 5.0, 2.0)) * 7.0)), 3.0); totalEmissiveRadiance += ofl * (0.5 + 0.5 * cos(6.2831 * (orn + vec3(0.0, 0.33, 0.67)))) * ${fire.toFixed(2)};`,
        );
    };
    m.customProgramCacheKey = () => `opal${id}`;
    opalM.set(id, m);
    return m;
  };
  /** The customer's picture on photo teeth: printed under a clear glaze. One per run of teeth (its own picture). */
  const photoMat = (map: THREE.Texture) =>
    new THREE.MeshPhysicalMaterial({ color: 0xffffff, map, roughness: 0.28, metalness: 0, clearcoat: 0.9, clearcoatRoughness: 0.06, envMap: metalEnv, envMapIntensity: 0.5 });

  setSolid(HOLDER_SOLID);
  return { studioEnv, metalEnv, sparkleEnv, resinBack, depthOnly, resinTooth, resinGum, resinBlock, setSolid, diamondMat, matFor, opalMat, photoMat };
}

/** How solid the holder looks by default (the prototype's dial starts here). */
export const HOLDER_SOLID = 70;
