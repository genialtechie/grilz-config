import * as THREE from 'three';
import { TOOTH_DATA } from './toothData';
import { bufGeo, grid, LOWER, MM, mirrorOf, orient, srad, toothGeo, UPPER, type Spot, type ToothDef } from './sculpt';
import type { Look } from './look';

// The piece on the stage (a port of the arch and the holder in
// docs/redesign/prototype/src/40-scene.js): every tooth sits where it was
// measured, touching its neighbours, and the lower row closes just inside the
// upper one as a real bite does. The teeth stand in a clear resin holder: a
// flat-topped block, like a jeweler's mold or a display case, with a slim gum
// roll where the teeth meet it.
//
// Numbering is the builder's own (as on the old model): each row runs from the
// viewer's right (0, the wearer's upper left third molar) to the viewer's left
// (15); the lower row is 16 to 31 the same way. The prototype numbers the other
// way round; only the numbering differs, every tooth sits where it does there.
//
// Each tooth is a group named as on the old model (top_teeth001 … bottom_teeth016),
// holding the clear tooth (named the same, so captures can paint bare teeth
// white), its cap, and whatever dresses the cap. Captures, masks and the camera
// find teeth by those names.

/** Scene units per millimetre: the old model's teeth were this size, so framing, captures and close-ups keep their scale. */
export const SCENE_PER_MM = 0.07;
/** The piece is built in the prototype's stage units and scaled up to the scene by this much. */
export const SCENE_SCALE = SCENE_PER_MM / MM;
/** The prototype's camera looks this far behind the front of the arch (mm): the middle of the piece, put at the scene's centre. */
const LOOK_DEPTH = 6;

/** Where each block starts and ends, measured from the biting line (mm). */
const BLOCK = { U: [11.4, 18.6], L: [8.6, 15.8] } as const;
/** The lower jaw's hinge (stage units), behind the back teeth. */
const PIVOT = new THREE.Vector3(0, 2 * MM, -48 * MM);

export const toothName = (index: number) => `${index < 16 ? 'top' : 'bottom'}_teeth${String((index % 16) + 1).padStart(3, '0')}`;

export type ToothSlot = {
  index: number;
  upper: boolean;
  /** The tooth's own shape (mirrored on the left side), before any fang. */
  def: ToothDef;
  group: THREE.Group;
  /** The clear tooth: its near surface and its far inside walls. */
  resin: THREE.Mesh;
  back: THREE.Mesh;
  /** The grill cap; hidden when the tooth isn't in the set. */
  cap: THREE.Mesh;
  /** Everything on the cap: finish rims, stones, panels. */
  deco: THREE.Group | null;
  /** Letters and pictures laid over the cap (they come and go on their own). */
  overlay: THREE.Group;
  /** The marking round a tooth picked to style on its own. */
  mark: THREE.Mesh | null;
  /** What the cap is dressed as, to skip redressing when nothing changed. */
  key: string | null;
  /** Where its stones sit, for the glints. */
  spots: Spot[];
  /** Which way the tooth faces, out of the arch. */
  out: THREE.Vector3;
  /** How high its biting end sits, in the upper half's space (stage units, jaw closed). */
  tip: number;
};

export type Piece = {
  /** The whole piece, scaled to the scene. */
  root: THREE.Group;
  /** The upper half (and the stage the jaw hangs from). */
  rig: THREE.Group;
  /** The lower half, hinged at PIVOT. */
  jaw: THREE.Group;
  teeth: ToothSlot[];
};

/** Raycasting off: things that are part of a tooth's look but never what a tap lands on. */
export const noRaycast = () => {};
/** A cap not made yet. */
const NO_CAP = new THREE.BufferGeometry();

type Lay = { s: number; gum: number; dep: number; w: number }[] & { path: ArchPath; end: number };
type ArchPath = { at: (s: number) => { x: number; z: number; nx: number; nz: number }; where: (x: number, z: number) => number };

/** The arch as a path along the gum line: a point and its outward normal at any distance from the middle. */
function archPath(pts: [number, number][]): ArchPath {
  const v: THREE.Vector3[] = [];
  let k: number;
  for (k = pts.length - 1; k >= 1; k--) v.push(new THREE.Vector3(-pts[k][0], 0, pts[k][1]));
  for (k = 0; k < pts.length; k++) v.push(new THREE.Vector3(pts[k][0], 0, pts[k][1]));
  const P = new THREE.CatmullRomCurve3(v, false, 'centripetal').getPoints(1200).slice(600);
  const len = [0];
  for (k = 1; k < P.length; k++) len.push(len[k - 1] + P[k].distanceTo(P[k - 1]));
  return {
    at(s) {
      s = Math.max(0, Math.min(len[len.length - 1] - 0.001, s));
      let lo = 0;
      let hi = len.length - 1;
      while (hi - lo > 1) {
        const mid = (lo + hi) >> 1;
        if (len[mid] > s) hi = mid;
        else lo = mid;
      }
      const f = (s - len[lo]) / (len[hi] - len[lo] || 1);
      const a = P[lo];
      const b = P[hi];
      const tx = b.x - a.x;
      const tz = b.z - a.z;
      const tl = Math.hypot(tx, tz) || 1;
      return { x: a.x + tx * f, z: a.z + tz * f, nx: -tz / tl, nz: tx / tl };
    },
    where(x, z) {
      let best = 0;
      let bd = 1e9;
      for (let q = 0; q < P.length; q++) {
        const d = (P[q].x - x) * (P[q].x - x) + (P[q].z - z) * (P[q].z - z);
        if (d < bd) {
          bd = d;
          best = q;
        }
      }
      return len[best];
    },
  };
}

function buildRow(row: 'U' | 'L', upper: boolean, look: Look, rig: THREE.Group, jaw: THREE.Group, teeth: ToothSlot[]): Lay {
  const recs = TOOTH_DATA[row];
  const list = upper ? UPPER : LOWER;
  const pts: [number, number][] = [[0, recs[0].p[2] + 0.3]];
  const a = recs[6].p;
  const b = recs[7].p;
  recs.forEach((r) => pts.push([r.p[0], r.p[2]]));
  pts.push([b[0] + (b[0] - a[0]) * 1.7, b[2] + (b[2] - a[2]) * 1.7]);
  const lay = [] as unknown as Lay;
  lay.path = archPath(pts);
  recs.forEach((r, k) => {
    ([1, -1] as const).forEach((side) => {
      const def = side > 0 ? list[k] : mirrorOf(list[k]);
      const g = new THREE.Group();
      g.rotation.order = 'YXZ';
      g.rotation.set(0, side * r.a, upper ? Math.PI : 0);
      const base = new THREE.Vector3(side * r.p[0] * MM, r.p[1] * MM, r.p[2] * MM);
      if (!upper) base.sub(PIVOT);
      g.position.copy(base);
      const resin = new THREE.Mesh(toothGeo(def), look.resinTooth);
      const back = new THREE.Mesh(toothGeo(def), look.resinBack);
      // The cap's shape is worked out when the tooth is first dressed (most teeth never are).
      const cap = new THREE.Mesh(NO_CAP, look.resinTooth);
      cap.visible = false;
      cap.raycast = noRaycast;
      back.raycast = noRaycast;
      back.renderOrder = 1;
      resin.renderOrder = 2;
      // The builder's numbering: right side of the stage (side +1) first, from the back.
      const index = (upper ? 0 : 16) + (side > 0 ? 7 - k : 8 + k);
      g.name = toothName(index);
      resin.name = toothName(index);
      cap.name = 'tooth_cap';
      const overlay = new THREE.Group();
      overlay.name = 'tooth_overlay';
      g.add(back, resin, cap, overlay);
      (upper ? rig : jaw).add(g);
      teeth[index] = {
        index,
        upper,
        def,
        group: g,
        resin,
        back,
        cap,
        deco: null,
        overlay,
        mark: null,
        key: null,
        spots: [],
        out: new THREE.Vector3(Math.sin(side * r.a), 0, Math.cos(side * r.a)),
        tip: (upper ? r.p[1] - r.h : r.p[1] + r.h) * MM,
      };
    });
    lay.push({ s: lay.path.where(r.p[0], r.p[2]), gum: Math.abs(r.p[1]), dep: r.d, w: r.w });
  });
  lay.end = lay[7].s + list[7][1] / 2;
  return lay;
}

/**
 * The clear holder: a flat-topped block with a slim gum roll where the teeth meet it.
 * The roll's edge is scalloped as a gum line is: it arcs over each tooth and comes
 * to a point between neighbours, filling the small gap there.
 */
function holder(lay: Lay, upper: boolean, look: Look, rig: THREE.Group, jaw: THREE.Group) {
  const path = lay.path;
  const NS = 24;
  const end = lay.end + 1.2;
  const tail = 4;
  const pos: number[] = [];
  const idx: number[] = [];
  let rings = 0;
  let s: number, j: number;
  const u = upper ? 1 : -1;
  const [B0, B1] = BLOCK[upper ? 'U' : 'L'];
  const centre: [number, number, number][] = [];
  const stations: number[] = [];
  const prop = (as: number, n: 'gum' | 'dep' | 'w') => {
    if (as <= lay[0].s) return lay[0][n];
    for (let k = 1; k < lay.length; k++) {
      if (as <= lay[k].s) {
        let f = (as - lay[k - 1].s) / (lay[k].s - lay[k - 1].s);
        f = f * f * (3 - 2 * f);
        return lay[k - 1][n] + (lay[k][n] - lay[k - 1][n]) * f;
      }
    }
    return lay[lay.length - 1][n];
  };
  // How far the gum reaches down between each pair of neighbours, starting between the two front teeth.
  const PAP = [1.7, 1.7, 1.6, 1.35, 1.2, 1.05, 0.9, 0];
  const cuts = [0];
  for (let k2 = 0; k2 < 7; k2++) cuts.push((lay[k2].s + lay[k2].w / 2 + lay[k2 + 1].s - lay[k2 + 1].w / 2) / 2);
  cuts.push(lay.end);
  const pap = (as: number) => {
    for (let k = 0; k < 8; k++) {
      if (as <= cuts[k + 1]) {
        const mid = (cuts[k] + cuts[k + 1]) / 2;
        const t = (as - mid) / ((cuts[k + 1] - cuts[k]) / 2);
        return (t < 0 ? PAP[k === 0 ? 0 : k - 1] : PAP[k]) * Math.pow(Math.abs(t), 2.6);
      }
    }
    return 0;
  };
  for (s = -end; s <= end + 0.001; s += 0.5) stations.push(s);
  [15, 30, 45, 59, 70, 79, 86].forEach((dg) => {
    const e = end + tail * Math.sin((dg * Math.PI) / 180);
    stations.push(e);
    stations.unshift(-e);
  });
  for (let q0 = 0; q0 < stations.length; q0++) {
    s = stations[q0];
    const as = Math.abs(s);
    const over = Math.max(0, as - end) / tail;
    const shrink = Math.sqrt(Math.max(0, 1 - over * over));
    const pt = path.at(as);
    const sx = s < 0 ? -1 : 1;
    const pp = pap(as);
    const crest = u * (prop(as, 'gum') - 0.15 - pp);
    const base = u * (B0 + 1);
    const yc = (crest + base) / 2;
    const hh = Math.abs(base - crest) / 2;
    const half = prop(as, 'dep') / 2 + 1.25;
    for (j = 0; j < NS; j++) {
      const a = (j / NS) * Math.PI * 2;
      // Between teeth the edge thins to a wedge that tucks in behind their faces.
      const r = srad(a, Math.sin(a) < 0 ? 2.6 - 0.76 * pp : 2.6);
      const n = r * Math.cos(a) * half * shrink;
      pos.push((sx * pt.x + sx * pt.nx * n) * MM, (yc + u * r * Math.sin(a) * hh * shrink) * MM, (pt.z + pt.nz * n) * MM);
    }
    centre.push([sx * pt.x * MM, yc * MM, pt.z * MM]);
    rings++;
  }
  grid(idx, rings, NS);
  const e0 = pos.length / 3;
  pos.push(...centre[0]);
  for (j = 0; j < NS; j++) idx.push(e0, (j + 1) % NS, j);
  const e1 = pos.length / 3;
  pos.push(...centre[rings - 1]);
  for (j = 0; j < NS; j++) idx.push(e1, (rings - 1) * NS + j, (rings - 1) * NS + ((j + 1) % NS));
  const roll = orient(bufGeo(pos, idx), true);
  // The block: the arch's outline pushed out past the teeth, closed straight across the back, with a flat top and bevelled edges.
  const shape2 = new THREE.Shape();
  let first = true;
  const bt = 0.9;
  const thick = B1 - B0;
  for (s = -end - 2; s <= end + 2.001; s += 1.5) {
    const p2 = path.at(Math.abs(s));
    const sg = s < 0 ? -1 : 1;
    const o2 = prop(Math.abs(s), 'dep') * 0.5 + 2.6;
    const X = sg * (p2.x + p2.nx * o2);
    const Z = p2.z + p2.nz * o2;
    if (first) {
      shape2.moveTo(X, Z);
      first = false;
    } else shape2.lineTo(X, Z);
  }
  shape2.closePath();
  const block = new THREE.ExtrudeGeometry(shape2, { depth: thick - 2 * bt, bevelEnabled: true, bevelThickness: bt, bevelSize: bt, bevelSegments: 3, curveSegments: 4 });
  block.rotateX(Math.PI / 2);
  block.translate(0, (upper ? B1 : -B0) - bt, 0);
  block.scale(MM, MM, MM);
  block.computeVertexNormals();
  [roll, block].forEach((g, gi) => {
    [look.resinBack, look.depthOnly, gi ? look.resinBlock : look.resinGum].forEach((mat, n) => {
      const m = new THREE.Mesh(g, mat);
      m.name = gi ? 'holder_block' : 'holder_gum';
      m.renderOrder = n === 0 ? 1 : n === 1 ? 3 + gi * 2 : 4 + gi * 2;
      // Only the near surface takes a tap (it can glide the camera in); its two other passes never do.
      if (n !== 2) m.raycast = noRaycast;
      if (!upper) m.position.copy(PIVOT).multiplyScalar(-1);
      (upper ? rig : jaw).add(m);
    });
  });
}

/** A soft round shadow under the piece. */
function shadow() {
  const size = 128;
  const data = new Uint8Array(size * size * 4);
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      // The prototype's radial gradient: black in the middle (from 4 px out), clear at the edge.
      const d = Math.hypot(x + 0.5 - 64, y + 0.5 - 64);
      const a = Math.min(1, Math.max(0, 1 - (d - 4) / 60));
      data.set([0, 0, 0, Math.round(a * 255)], (y * size + x) * 4);
    }
  }
  const map = new THREE.DataTexture(data, size, size, THREE.RGBAFormat);
  map.magFilter = map.minFilter = THREE.LinearFilter;
  map.needsUpdate = true;
  const m = new THREE.Mesh(new THREE.PlaneGeometry(3.6, 3.8), new THREE.MeshBasicMaterial({ map, transparent: true, opacity: 0.2, depthWrite: false, toneMapped: false }));
  m.rotation.x = -Math.PI / 2;
  m.position.set(0, -((BLOCK.L[1] + BLOCK.U[1]) / 2 + 1.75) * MM, -12 * MM);
  m.name = 'piece_shadow';
  m.raycast = noRaycast;
  return m;
}

/** Builds the piece once: the teeth in their places, bare, in the clear holder. */
export function buildPiece(look: Look): Piece {
  const root = new THREE.Group();
  root.name = 'grillz_piece';
  const rig = new THREE.Group();
  const jaw = new THREE.Group();
  jaw.position.copy(PIVOT);
  rig.add(jaw);
  root.add(rig);
  const teeth: ToothSlot[] = [];
  holder(buildRow('U', true, look, rig, jaw, teeth), true, look, rig, jaw);
  holder(buildRow('L', false, look, rig, jaw, teeth), false, look, rig, jaw);
  // The piece sits centred on the stage.
  rig.position.y = ((BLOCK.L[1] - BLOCK.U[1]) / 2) * MM;
  root.add(shadow());
  root.scale.setScalar(SCENE_SCALE);
  root.position.z = LOOK_DEPTH * SCENE_PER_MM;
  return { root, rig, jaw, teeth };
}

/** Opens the mouth (0 closed, 1 open), as the prototype's jaw does. */
export function setJaw(piece: Piece, open: number) {
  piece.jaw.rotation.x = open * 0.12;
}
