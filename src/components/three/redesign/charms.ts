import * as THREE from 'three';
import type { CharmId } from '../../../lib/renderSpec';
import type { Look } from './look';
import { noRaycast } from './piece';
import { facePoint, gemGeo, MM, type ToothDef } from './sculpt';

// One-of-one charms (a port of the Creator Lab's charms, docs/redesign/creator-lab/src/30-sculpt.js):
// raised pieces built from drawn outlines and laid on the face of one tooth. All of them are original
// designs made here from plain shapes. Two differ from the lab on purpose, to keep clear of well-known
// marks: the emblem is a solid triangle with one stone (no ring inside it), and the winged piece has a
// heart where the lab had a ball. Sizes are in millimetres, the piece facing forward (+z).

/** What a part is made of: the tooth's metal, a set diamond, enamel, a domed stone or a faceted stone (colours are linear hex). */
type Role = 'gold' | 'diamond' | { enamel: number } | { cab: number } | { facet: number };
type Part = { g: THREE.BufferGeometry; role: Role; x: number; y: number; z: number; s: number; rz: number; sx?: number; sy?: number; sz?: number };
/** The parts, the piece's size (w × h), the centre to lay on the tooth (cx, cy), how many teeth wide it may run (span) and how high on the face it sits (py, 0–1). */
type Charm = { parts: Part[]; w: number; h: number; cx?: number; cy?: number; span?: number; py?: number };

const OX = 0x55101a;
const GREEN = 0x0c3d27;
const BROWN = 0x3a2212;
const BLUE = 0x1d49c8;
const UPZ = new THREE.Vector3(0, 0, 1);

const ext = (shape: THREE.Shape, depth: number, bevel: number) =>
  new THREE.ExtrudeGeometry(shape, { depth, bevelEnabled: true, bevelThickness: bevel, bevelSize: bevel, bevelSegments: 4, curveSegments: 22 });
const poly = (pts: [number, number][]) => {
  const s = new THREE.Shape();
  pts.forEach(([x, y], n) => (n ? s.lineTo(x, y) : s.moveTo(x, y)));
  s.closePath();
  return s;
};
const oval = (rx: number, ry: number) => {
  const s = new THREE.Shape();
  s.absellipse(0, 0, rx, ry, 0, Math.PI * 2, false, 0);
  return s;
};
const shield = () => {
  const s = new THREE.Shape();
  s.moveTo(-3.4, 3.8);
  s.quadraticCurveTo(-1.7, 3.2, 0, 4.2);
  s.quadraticCurveTo(1.7, 3.2, 3.4, 3.8);
  s.bezierCurveTo(3.6, 0.5, 2.6, -2.6, 0, -4.4);
  s.bezierCurveTo(-2.6, -2.6, -3.6, 0.5, -3.4, 3.8);
  return s;
};
const heart = (k: number) => {
  const s = new THREE.Shape();
  s.moveTo(0, -1.9 * k);
  s.bezierCurveTo(-0.7 * k, -1.2 * k, -2.2 * k, -0.4 * k, -2.2 * k, 0.7 * k);
  s.bezierCurveTo(-2.2 * k, 1.8 * k, -0.6 * k, 2.1 * k, 0, 1.1 * k);
  s.bezierCurveTo(0.6 * k, 2.1 * k, 2.2 * k, 1.8 * k, 2.2 * k, 0.7 * k);
  s.bezierCurveTo(2.2 * k, -0.4 * k, 0.7 * k, -1.2 * k, 0, -1.9 * k);
  return s;
};

const made = new Map<CharmId, Charm>();

/** A charm's parts, built once and shared by every tooth that wears it. */
function charmParts(id: CharmId): Charm {
  const known = made.get(id);
  if (known) return known;
  const parts: Part[] = [];
  const sph = new THREE.SphereGeometry(1, 28, 18);
  const add = (g: THREE.BufferGeometry, role: Role, x = 0, y = 0, z = 0, s = 1, rz = 0) => parts.push({ g, role, x, y, z, s, rz });
  const stretch = (g: THREE.BufferGeometry, role: Role, x: number, y: number, z: number, sx: number, sy: number, sz: number) => parts.push({ g, role, x, y, z, s: 1, rz: 0, sx, sy, sz });
  let charm: Charm;
  if (id === 'crest') {
    // A plain quartered shield.
    add(ext(shield(), 0.55, 0.26), 'gold');
    add(ext(poly([[-2.55, 2.85], [0, 3.15], [0, 0.4], [-2.6, 0.4]]), 0.1, 0.05), { enamel: OX }, 0, 0.05, 0.82);
    add(ext(poly([[0, 3.15], [2.55, 2.85], [2.6, 0.4], [0, 0.4]]), 0.1, 0.05), { enamel: GREEN }, 0, 0.05, 0.82);
    add(ext(poly([[-2.6, 0.4], [0, 0.4], [0, -3.3], [-1.75, -1.9]]), 0.1, 0.05), { enamel: GREEN }, 0, 0.05, 0.82);
    add(ext(poly([[0, 0.4], [2.6, 0.4], [1.75, -1.9], [0, -3.3]]), 0.1, 0.05), { enamel: OX }, 0, 0.05, 0.82);
    add(ext(poly([[-0.2, 3.2], [0.2, 3.2], [0.2, -3.3], [-0.2, -3.3]]), 0.16, 0.08), 'gold', 0, 0.05, 0.95);
    add(ext(poly([[-2.7, 0.24], [2.7, 0.24], [2.7, 0.66], [-2.7, 0.66]]), 0.16, 0.08), 'gold', 0, 0.05, 0.95);
    charm = { parts, w: 7.4, h: 8.8 };
  } else if (id === 'emblem') {
    // A solid gold triangle with a raised edge and one stone in a bezel at its centre.
    add(ext(poly([[0, 3.7], [-3.4, -2.4], [3.4, -2.4]]), 0.5, 0.2), 'gold');
    add(ext(poly([[0, 2.55], [-2.4, -1.75], [2.4, -1.75]]), 0.12, 0.06), 'gold', 0, 0, 0.55, 1);
    stretch(new THREE.TorusGeometry(1, 0.14, 10, 36), 'gold', 0, -0.35, 0.82, 0.78, 0.78, 1.6);
    add(gemGeo, 'diamond', 0, -0.35, 0.86, 0.7);
    charm = { parts, w: 7.2, h: 6.6, cy: 0.6 };
  } else if (id === 'winged-heart') {
    // A gold heart with a pair of feathered wings, stones along each wing.
    [-1, 1].forEach((sd) => {
      for (let k = 0; k < 4; k++) {
        const L = 3.0 + k * 0.85;
        const ang = ((18 + k * 17) * Math.PI) / 180;
        add(ext(oval(L / 2, 0.62), 0.2, 0.14), 'gold', sd * (1.0 + (Math.cos(ang) * L) / 2), -1.4 + (Math.sin(ang) * L) / 2, 0.1 + (3 - k) * 0.1, 1, sd > 0 ? ang : Math.PI - ang);
      }
      for (let k = 0; k < 4; k++) {
        const a4 = (69 * Math.PI) / 180;
        const dd = 1.5 + k * 1.05;
        add(gemGeo, 'diamond', sd * (1.0 + Math.cos(a4) * dd), -1.4 + Math.sin(a4) * dd, 0.52, 0.42);
      }
    });
    add(ext(heart(0.78), 0.55, 0.3), 'gold', 0, -1.5, 0.45);
    charm = { parts, w: 9.6, h: 6.6, cy: 0.4 };
  } else if (id === 'crown') {
    add(ext(poly([[-3.4, -2.4], [3.4, -2.4], [3.8, 2.0], [2.85, 0.3], [1.9, 2.6], [0.95, 0.3], [0, 3.2], [-0.95, 0.3], [-1.9, 2.6], [-2.85, 0.3], [-3.8, 2.0]]), 0.5, 0.24), 'gold');
    ([[-3.8, 2.0], [-1.9, 2.6], [0, 3.2], [1.9, 2.6], [3.8, 2.0]] as const).forEach(([x, y]) => add(sph, 'gold', x, y + 0.15, 0.5, 0.46));
    add(gemGeo, { facet: BLUE }, -2.05, -1.35, 0.78, 0.62);
    add(gemGeo, 'diamond', 0, -1.35, 0.78, 0.7);
    add(gemGeo, { facet: BLUE }, 2.05, -1.35, 0.78, 0.62);
    charm = { parts, w: 8.0, h: 6.2 };
  } else if (id === 'hat') {
    // A plain crooked pointed hat.
    add(ext(poly([[-2.4, -2.3], [2.4, -2.3], [1.7, -0.4], [1.25, 1.3], [1.9, 2.5], [3.0, 3.0], [1.6, 3.5], [0.2, 2.6], [-0.6, 0.9], [-1.5, -0.8]]), 0.6, 0.3), { enamel: BROWN });
    add(ext(oval(4.0, 0.85), 0.3, 0.22), { enamel: BROWN }, 0, -2.6, 0.35);
    add(ext(poly([[-2.2, -2.2], [2.2, -2.2], [1.95, -1.5], [-1.9, -1.5]]), 0.12, 0.08), 'gold', 0, 0, 0.92);
    charm = { parts, w: 8.6, h: 7.2, cy: 0.2 };
  } else if (id === 'broom') {
    // A broomstick that lies across more than one tooth.
    const bar = new THREE.CylinderGeometry(0.34, 0.34, 12.4, 14);
    bar.rotateZ(Math.PI / 2);
    add(bar, 'gold', -3.0, 0, 0.55);
    add(sph, 'gold', -9.2, 0, 0.55, 0.36);
    const br = new THREE.Shape();
    br.moveTo(3.0, 0.5);
    br.bezierCurveTo(5.0, 2.0, 8.0, 1.7, 9.3, 0.55);
    br.lineTo(8.8, 0.15);
    br.lineTo(9.5, -0.3);
    br.lineTo(8.8, -0.6);
    br.bezierCurveTo(7.6, -1.8, 5.0, -2.0, 3.0, -0.5);
    br.closePath();
    add(ext(br, 0.5, 0.34), { enamel: BROWN }, 0, 0, 0.1);
    add(ext(poly([[3.25, -0.85], [3.75, -0.95], [3.75, 0.95], [3.25, 0.85]]), 0.2, 0.12), 'gold', 0, 0, 0.78);
    add(ext(poly([[4.25, -1.15], [4.7, -1.2], [4.7, 1.2], [4.25, 1.15]]), 0.2, 0.12), 'gold', 0, 0, 0.82);
    charm = { parts, w: 19, h: 4.2, span: 2.7, py: 0.3 };
  } else if (id === 'owl') {
    add(ext(oval(2.35, 3.1), 0.5, 0.32), 'gold');
    add(ext(poly([[-2.0, 2.2], [-1.5, 3.9], [-0.7, 2.8]]), 0.3, 0.16), 'gold', 0, 0, 0.1);
    add(ext(poly([[2.0, 2.2], [1.5, 3.9], [0.7, 2.8]]), 0.3, 0.16), 'gold', 0, 0, 0.1);
    [-1, 1].forEach((sd) => {
      stretch(new THREE.TorusGeometry(1, 0.2, 10, 30), 'gold', sd * 0.98, 1.35, 0.82, 0.72, 0.72, 1.4);
      add(gemGeo, { facet: BLUE }, sd * 0.98, 1.35, 0.86, 0.52);
      add(ext(oval(0.62, 1.75), 0.2, 0.14), 'gold', sd * 2.0, -0.7, 0.5, 1, sd * -0.14);
    });
    add(ext(poly([[-0.34, 0.82], [0.34, 0.82], [0, 0.2]]), 0.2, 0.1), 'gold', 0, 0, 0.86);
    ([[0, -0.5], [-0.72, -1.05], [0.72, -1.05], [0, -1.6], [-0.72, -2.15], [0.72, -2.15], [0, -2.65]] as const).forEach(([x, y]) => add(gemGeo, 'diamond', x, y, 0.8, 0.38));
    charm = { parts, w: 5.6, h: 7.6, cy: 0.4 };
  } else if (id === 'ruby-potion' || id === 'emerald-potion') {
    // A round flask with a coloured stone for the liquid.
    stretch(new THREE.TorusGeometry(1, 0.13, 12, 44), 'gold', 0, -1.2, 0.32, 2.0, 2.0, 2.4);
    stretch(sph, { cab: id === 'ruby-potion' ? 0x4d0612 : 0x06432b }, 0, -1.2, 0.25, 1.8, 1.8, 1.1);
    add(ext(poly([[-0.55, 0.6], [0.55, 0.6], [0.55, 2.3], [-0.55, 2.3]]), 0.4, 0.2), 'gold', 0, 0, 0.1);
    add(ext(poly([[-0.95, 2.25], [0.95, 2.25], [0.95, 2.7], [-0.95, 2.7]]), 0.45, 0.16), 'gold', 0, 0, 0.12);
    add(sph, { enamel: BROWN }, 0, 3.15, 0.5, 0.55);
    charm = { parts, w: 4.8, h: 7.6, cy: 0.3 };
  } else {
    // Sapphire: a domed stone in a gold bezel.
    stretch(new THREE.TorusGeometry(1, 0.13, 12, 48), 'gold', 0, 0, 0.3, 2.15, 2.85, 2.6);
    stretch(sph, { cab: 0x071a5c }, 0, 0, 0.25, 1.95, 2.65, 1.15);
    ([[0, 2.85], [0, -2.85], [2.15, 0], [-2.15, 0]] as const).forEach(([x, y]) => add(sph, 'gold', x, y, 0.55, 0.36));
    charm = { parts, w: 5.2, h: 6.6 };
  }
  made.set(id, charm);
  return charm;
}

const materialFor = (role: Role, look: Look, gold: THREE.Material): THREE.Material => {
  if (role === 'gold') return gold;
  if (role === 'diamond') return look.diamondMat;
  if ('enamel' in role) return look.enamelMat(role.enamel);
  if ('cab' in role) return look.cabMat(role.cab);
  return look.facetMat(role.facet);
};

/**
 * One charm on a tooth's cap, in the cap's own space: sized to the tooth (a broom may run over its
 * neighbours), laid on the lip-side face and turned to face out of it. Never takes a tap (the tooth does).
 */
export function buildCharm(def: ToothDef, upper: boolean, id: CharmId, look: Look, gold: THREE.Material) {
  const charm = charmParts(id);
  const group = new THREE.Group();
  group.name = 'tooth_charm';
  charm.parts.forEach((p) => {
    const mesh = new THREE.Mesh(p.g, materialFor(p.role, look, gold));
    mesh.position.set(p.x - (charm.cx ?? 0), p.y - (charm.cy ?? 0), p.z);
    if (p.sx !== undefined) mesh.scale.set(p.sx, p.sy!, p.sz!);
    else mesh.scale.setScalar(p.s);
    // A stone's table faces up its own y: turn it to face out.
    if (p.g === gemGeo) mesh.rotation.x = Math.PI / 2;
    mesh.rotation.z = p.rz;
    mesh.raycast = noRaycast;
    group.add(mesh);
  });
  const k = Math.min((0.86 * def[1] * (charm.span ?? 1)) / charm.w, (0.68 * def[2]) / charm.h);
  const P = new THREE.Vector3();
  const N = new THREE.Vector3();
  facePoint(def, 0, def[2] * (charm.py ?? 0.5), P, N);
  group.position.copy(P).addScaledVector(N, -0.1).multiplyScalar(MM);
  group.scale.setScalar(k * MM);
  group.quaternion.setFromUnitVectors(UPZ, N);
  // The upper teeth hang biting end down: turn the charm the right way up.
  if (upper) group.rotateZ(Math.PI);
  return group;
}
