import * as THREE from 'three';
import type { MetalId, SettingId } from '../../lib/renderSpec';
import { crownGeometry, gemMaterial, gemsUnsupported, glintGeometry, glintMaterial, type GemKind } from './gems';
import { METAL_BASE, polishedMetal } from './materials';
import { Relief } from './relief';
import { frameOf, frontOf, onFront, SECTORS } from './styles';

// An iced tooth: stones set into the front of the cap, edge to edge inside a
// polished rim, with the beads of metal that hold them. The three settings a
// jeweler offers are laid out differently, so each reads as itself:
//   honeycomb  stones packed in a hexagon pattern, a small bead in every gap between three;
//   prong      stones in straight rows and columns, a bead where four corners meet;
//   mosaic     large stones on the diagonal with a small stone in each space between four.
// Sizes follow real work (measured off jewelers' product photos): a front tooth takes ten or eleven stones across.
// Positions are in the tooth's own space (the model's teeth carry no extra transform).

const STONE_RADIUS = 0.00078;
/** Stones stop this share of the way to the face's edge: the cap's polished edge is the rim round them. */
const ICED_FACE = 0.95;
const Y = new THREE.Vector3(0, 1, 0);

type Seat = { p: THREE.Vector3; n: THREE.Vector3; r: number };
/** Where a tooth's stones and metalwork sit, worked out once per tooth shape and setting. */
type Layout = { stones: Seat[]; beads: Seat[] };
const layouts = new Map<string, Layout>();
const gums = new WeakMap<THREE.BufferGeometry, Relief>();

/**
 * The gum round one tooth, as seen from in front of the mouth. Teeth are
 * modelled root and all: the root sits inside the gum, and stones set there
 * would poke out through it (and stand clear of it on the permanent look,
 * which grows the cap), so stones keep to the crown that shows.
 */
function gumRound(geometry: THREE.BufferGeometry, moulds: THREE.Mesh[]) {
  let gum = gums.get(geometry);
  if (!gum) {
    const front = frameOf(geometry);
    // The moulds in the teeth's own space (they share a parent), whatever the scene does to them.
    const sources = moulds.map((mould) => {
      mould.updateMatrix();
      return { geometry: mould.geometry, matrix: mould.matrix };
    });
    gum = new Relief(sources, front.centre, front.across, front.up, front.facial, front.reach);
    gums.set(geometry, gum);
  }
  return gum;
}

/** The face stones are laid on: which way it looks, its own up and across, and how far it reaches each way. */
type Face = { centre: THREE.Vector3; facing: THREE.Vector3; up: THREE.Vector3; across: THREE.Vector3; reach: number; outline: number[]; hit: (u: number, v: number) => { point: THREE.Vector3; normal: THREE.Vector3 } | null };
const faces = new WeakMap<THREE.BufferGeometry, Face>();

/**
 * The tooth's face as a setter sees it: square on. The finishes (styles.ts)
 * treat every tooth as facing straight out from the arch, which is fine for a
 * frame or a panel, but lower teeth lean back and stones laid out from the
 * front would thin out towards the biting edge. This looks along the face's
 * own average direction instead.
 */
function faceOf(geometry: THREE.BufferGeometry): Face {
  const cached = faces.get(geometry);
  if (cached) return cached;
  const front = frameOf(geometry);
  const { centre, reach } = front;
  // The average direction the front surface looks: every triangle that faces out of the arch, weighed by its size.
  const mean = new THREE.Vector3();
  const position = geometry.attributes.position as THREE.BufferAttribute;
  const corners = [new THREE.Vector3(), new THREE.Vector3(), new THREE.Vector3()];
  const count = geometry.index ? geometry.index.count : position.count;
  for (let i = 0; i < count; i += 3) {
    corners.forEach((corner, k) => corner.fromBufferAttribute(position, geometry.index ? geometry.index.getX(i + k) : i + k));
    const normal = new THREE.Vector3().crossVectors(corners[1].clone().sub(corners[0]), corners[2].clone().sub(corners[0]));
    if (normal.clone().normalize().dot(front.facial) > 0.3) mean.add(normal);
  }
  const facing = mean.lengthSq() > 0 ? mean.normalize() : front.facial.clone();
  const across = new THREE.Vector3().crossVectors(front.up, facing).normalize();
  const up = new THREE.Vector3().crossVectors(facing, across).normalize();
  const relief = new Relief([{ geometry }], centre, across, up, facing, reach * 0.6);
  const hit = (u: number, v: number) => {
    const found = relief.at(u, v);
    return found && found.normal.dot(facing) > 0.25 ? { point: relief.point(u, v, found.depth), normal: found.normal } : null;
  };
  // How far the face reaches in each direction from its middle.
  const outline: number[] = [];
  for (let i = 0; i < SECTORS; i += 1) {
    const angle = (i / SECTORS) * Math.PI * 2;
    let inside = 0;
    let outside = reach * 0.6;
    for (let step = 0; step < 11; step += 1) {
      const middle = (inside + outside) / 2;
      if (hit(Math.cos(angle) * middle, Math.sin(angle) * middle)) inside = middle;
      else outside = middle;
    }
    outline.push(inside);
  }
  const face: Face = { centre, facing, up, across, reach, outline, hit };
  faces.set(geometry, face);
  return face;
}

export function layoutFor(tooth: THREE.Mesh, setting: SettingId, ring: number, moulds: THREE.Mesh[]): Layout {
  const geometry = tooth.geometry;
  const key = `${geometry.uuid}:${setting}:${ring}`;
  const cached = layouts.get(key);
  if (cached) return cached;

  const front = frameOf(geometry);
  const face = faceOf(geometry);
  const { reach } = face;
  // Towards the gum: up for the top row, down for the bottom.
  const gumward = tooth.name.startsWith('top') ? 1 : -1;
  const layout: Layout = { stones: [], beads: [] };
  // The gum hides what it hides as seen from in front of the mouth, whichever way the tooth leans:
  // a point is hidden where the gum stands in front of it, or sits within a hair behind it.
  const gum = moulds.length ? gumRound(geometry, moulds) : null;
  const offset = new THREE.Vector3();
  const hidden = (point: THREE.Vector3) => {
    if (!gum) return false;
    offset.subVectors(point, front.centre);
    const found = gum.at(offset.dot(front.across), offset.dot(front.up));
    return found !== null && found.depth > offset.dot(front.facial) - STONE_RADIUS * 0.3;
  };

  /**
   * A seat on the tooth's face at (u, v) from its middle, for something `radius` wide,
   * or null where that would hang over the edge, sit on a side wall, or go under the gum.
   */
  const seat = (u: number, v: number, radius: number): Seat | null => {
    const sector = Math.round((Math.atan2(v, u) / (Math.PI * 2)) * SECTORS + SECTORS) % SECTORS;
    // The whole stone sits inside the rim round the face.
    if (Math.hypot(u, v) > face.outline[sector] * ICED_FACE - radius * 0.85) return null;
    const found = face.hit(u, v);
    if (!found) return null;
    if (hidden(found.point) || hidden(found.point.clone().addScaledVector(front.up, gumward * radius * 0.8))) return null;
    return { p: found.point, n: found.normal, r: radius };
  };
  // Nothing is set on top of a stone already there (a curved face can close the pattern up).
  const rowOf = new Map<Seat, number>();
  const add = (list: Seat[], found: Seat | null, row = 0) => {
    if (!found || layout.stones.some((other) => other.p.distanceTo(found.p) < (other.r + found.r) * 0.94)) return null;
    list.push(found);
    rowOf.set(found, row);
    return found;
  };

  /** The point of the tooth's surface at (u, v) on its face, if there is one. */
  const surface = (u: number, v: number) => face.hit(u, v)?.point ?? null;

  /**
   * A grid of seats measured along the tooth's surface, the way a setter lays
   * stones out: rows `rowStep` apart and seats `pitch` apart as the metal runs,
   * not as seen from the front (a tooth that leans back or curves round the
   * arch would otherwise get its rows stretched apart). The spacing is
   * adjusted a little per tooth so the rows fill the face from edge to gum
   * with no part-row left over; `scale` is that adjustment, to size the stones by.
   * Columns are numbered in half steps: even rows sit on even numbers, and
   * with `stagger` odd rows sit on the odd numbers between them.
   */
  const grid = (pitch: number, rowStep: number, stagger: boolean) => {
    const fine = STONE_RADIUS * 0.4;
    // How far up and down the face a full row of stones can sit: where a stone fits in the middle
    // and part way out to each side (the gum line arches, so the middle alone reaches too high).
    const fits: number[] = [];
    const [right, left] = [face.outline[0] * 0.55, -face.outline[SECTORS / 2] * 0.55];
    for (let v = -reach / 2; v <= reach / 2; v += fine) if (seat(0, v, pitch * 0.5) && seat(right, v, pitch * 0.5) && seat(left, v, pitch * 0.5)) fits.push(v);
    const points: { row: number; column: number; u: number; v: number }[] = [];
    if (!fits.length) return { points, scale: 1 };
    // Distance along the surface up the middle, from the lowest seat to the highest.
    const run: { v: number; length: number }[] = [];
    let previous: THREE.Vector3 | null = null;
    let length = 0;
    for (let v = fits[0]; v <= fits[fits.length - 1] + fine / 2; v += fine) {
      const point = surface(0, v);
      length += previous && point ? point.distanceTo(previous) : previous ? fine : 0;
      if (point) previous = point;
      run.push({ v, length });
    }
    const gaps = Math.max(1, Math.round(length / rowStep));
    const scale = THREE.MathUtils.clamp(length / gaps / rowStep, 0.88, 1.14);
    const rows = Math.floor(length / (rowStep * scale) + 1e-6);
    const start = (length - rows * rowStep * scale) / 2;
    // Columns: half a pitch of surface apart, measured once across the middle of the face and
    // used for every row, so rows line up with each other (a crisp pattern, not drifting rows).
    const middle = (fits[0] + fits[fits.length - 1]) / 2;
    const columns = new Map<number, number>([[0, 0]]);
    for (const side of [1, -1]) {
      let last = surface(0, middle);
      let travelled = 0;
      let index = 1;
      for (let u = fine; u <= reach / 2; u += fine) {
        const point = surface(side * u, middle);
        const stride = last && point ? point.distanceTo(last) : fine;
        travelled += stride;
        if (point) last = point;
        // The seat falls part way along this stride, not at its end.
        while (travelled >= (index * pitch * scale) / 2) {
          columns.set(side * index, side * (u - (fine * (travelled - (index * pitch * scale) / 2)) / stride));
          index += 1;
        }
      }
    }
    for (let row = 0; row <= rows; row += 1) {
      const target = start + row * rowStep * scale;
      // The exact height for this row: between the two measured points either side of it.
      const after = Math.max(1, run.findIndex((item) => item.length >= target - 1e-9));
      const [below, above] = [run[after - 1] ?? run[0], run[after] ?? run[run.length - 1]];
      const v = above.length > below.length ? THREE.MathUtils.lerp(below.v, above.v, (target - below.length) / (above.length - below.length)) : below.v;
      const odd = stagger && row % 2 === 1;
      columns.forEach((u, column) => {
        if ((Math.abs(column) % 2 === 1) === odd) points.push({ row, column, u, v });
      });
    }
    return { points, scale };
  };

  if (ring > 0) {
    // Iced open face: one row of stones round the frame, spaced evenly along it.
    const { centre, facial } = front;
    const frame = frontOf(geometry);
    const line = Array.from({ length: SECTORS * 4 }, (_, i) => onFront(frame, i / 4, ring, 0));
    const gap = STONE_RADIUS * 2.2;
    let since = gap;
    line.forEach((point, i) => {
      since += i ? point.distanceTo(line[i - 1]) : 0;
      if (since < gap) return;
      since = 0;
      layout.stones.push({ p: point, n: point.clone().sub(centre).normalize().lerp(facial, 0.7).normalize(), r: STONE_RADIUS });
    });
  } else if (setting === 'honeycomb') {
    // A hexagon pattern, stones all but touching, with a bead in each gap between three of them.
    const pitch = STONE_RADIUS * 2.05;
    const { points, scale } = grid(pitch, (pitch * Math.sqrt(3)) / 2, true);
    const at = new Map(points.map((point) => [`${point.row}:${point.column}`, point]));
    const between = (...others: (string | { u: number; v: number })[]) => {
      const found = others.map((other) => (typeof other === 'string' ? at.get(other) : other));
      if (found.some((item) => !item)) return;
      const all = found as { u: number; v: number }[];
      add(layout.beads, seat(all.reduce((sum, item) => sum + item.u, 0) / all.length, all.reduce((sum, item) => sum + item.v, 0) / all.length, STONE_RADIUS * 0.2 * scale));
    };
    points.forEach((point) => {
      const { row, column } = point;
      add(layout.stones, seat(point.u, point.v, STONE_RADIUS * scale), row);
      between(point, `${row}:${column + 2}`, `${row + 1}:${column + 1}`);
      between(point, `${row}:${column + 2}`, `${row - 1}:${column + 1}`);
    });
  } else if (setting === 'prong') {
    // Straight rows and columns, with a bead where four stones meet.
    const pitch = STONE_RADIUS * 2.05;
    const { points, scale } = grid(pitch, pitch, false);
    const at = new Map(points.map((point) => [`${point.row}:${point.column}`, point]));
    points.forEach(({ row, column, u, v }) => {
      add(layout.stones, seat(u, v, STONE_RADIUS * scale), row);
      const corners = [at.get(`${row}:${column + 2}`), at.get(`${row + 1}:${column}`), at.get(`${row + 1}:${column + 2}`)];
      if (corners.every(Boolean)) {
        const all = [{ u, v }, ...(corners as { u: number; v: number }[])];
        add(layout.beads, seat(all.reduce((sum, item) => sum + item.u, 0) / 4, all.reduce((sum, item) => sum + item.v, 0) / 4, STONE_RADIUS * 0.33 * scale));
      }
    });
  } else {
    // Mosaic: large stones touching along the diagonals, a small one in each space between four of them.
    const large = STONE_RADIUS * 1.34;
    const small = large * 0.4;
    const step = (large * 2.05) / Math.SQRT2;
    const { points, scale } = grid(step, step, false);
    points.forEach(({ row, column, u, v }) => {
      if ((row + column / 2) % 2) add(layout.stones, seat(u, v, small * scale), row);
      // Near the edge of the face, where a large stone won't fit, smaller ones take its place.
      else if (!add(layout.stones, seat(u, v, large * scale), row) && !add(layout.stones, seat(u, v, large * 0.7 * scale), row)) add(layout.stones, seat(u, v, small * scale), row);
    });
  }
  if (ring === 0) {
    // An end row that comes out as two or three stray stones (the face narrows there) is left off.
    const counts = new Map<number, number>();
    layout.stones.forEach((stone) => counts.set(rowOf.get(stone)!, (counts.get(rowOf.get(stone)!) ?? 0) + 1));
    const used = [...counts.keys()].sort((a, b) => a - b);
    for (const [end, inner] of [[used[0], used[1]], [used[used.length - 1], used[used.length - 2]]]) {
      if (inner !== undefined && end !== inner && counts.get(end)! <= counts.get(inner)! * 0.5) layout.stones = layout.stones.filter((stone) => rowOf.get(stone) !== end);
    }
    // A bead holds stones: one with fewer than three round it has nothing to hold.
    layout.beads = layout.beads.filter((bead) => layout.stones.filter((stone) => stone.p.distanceTo(bead.p) < stone.r * 1.7).length >= 3);
  }
  layouts.set(key, layout);
  return layout;
}

// ---------- Metalwork ----------

let bead: THREE.BufferGeometry | null = null;
/** A prong bead: a small dome of metal. */
const beadGeometry = () => (bead ??= new THREE.SphereGeometry(1, 6, 2, 0, Math.PI * 2, 0, Math.PI / 2));

const metalwork = new Map<MetalId, THREE.Material>();
/** The beads' metal: the cap's own alloy. */
function metalworkMaterial(metal: MetalId) {
  let material = metalwork.get(metal);
  if (!material) {
    material = polishedMetal(metal);
    // Rounded over by the setter's tool, not mirror flat: a whole row of beads shouldn't go dark together.
    (material as THREE.MeshPhysicalMaterial).roughness = 0.28;
    metalwork.set(metal, material);
  }
  return material;
}

// ---------- Building a tooth's stones ----------

/** A small seeded random, so a tooth's stones sit the same way every time it's redrawn. */
const seeded = (text: string) => {
  let state = 2166136261;
  for (let i = 0; i < text.length; i += 1) state = Math.imul(state ^ text.charCodeAt(i), 16777619);
  return () => {
    state = Math.imul(state ^ (state >>> 15), 2246822507);
    state = Math.imul(state ^ (state >>> 13), 3266489909);
    return ((state ^= state >>> 16) >>> 0) / 4294967296;
  };
};

/** Never picked by the pointer: a tap on a stone is a tap on its tooth, which lies right under it. */
const ignorePointer = () => {};

function instanced(geometry: THREE.BufferGeometry, material: THREE.Material, seats: Seat[], matrixFor: (seat: Seat, i: number) => THREE.Matrix4) {
  const mesh = new THREE.InstancedMesh(geometry, material, seats.length);
  seats.forEach((item, i) => mesh.setMatrixAt(i, matrixFor(item, i)));
  mesh.instanceMatrix.needsUpdate = true;
  mesh.raycast = ignorePointer;
  // Instances spread over the whole tooth; the mesh's own bounds are one stone at the origin.
  mesh.frustumCulled = false;
  return mesh;
}

export type StoneOptions = {
  kind?: GemKind;
  setting?: SettingId;
  metal?: MetalId;
  /** Instead of covering the face, one row of stones round it this far out from the middle (0 to 1): iced open face. */
  ring?: number;
  /** The gums. Stones stay on the crown that shows below (or above) them. */
  moulds?: THREE.Mesh[];
};

/** The stones for one tooth, with their setting: a group to add to the tooth. */
export function createDiamondStones(tooth: THREE.Mesh, { kind = 'diamond', setting = 'honeycomb', metal = 'yellow', ring = 0, moulds = [] }: StoneOptions = {}) {
  const random = seeded(tooth.name);
  const layout = layoutFor(tooth, setting, ring, moulds);
  const group = new THREE.Group();
  const quaternion = new THREE.Quaternion();
  const scale = new THREE.Vector3();
  const matrix = new THREE.Matrix4();

  // Stones: set almost flat (a hand-set stone is never dead level), each turned its own way.
  const stones = instanced(crownGeometry(), gemMaterial(kind, METAL_BASE[metal]), layout.stones, ({ p, n, r }) => {
    const tilted = n.clone().add(new THREE.Vector3((random() - 0.5) * 0.07, (random() - 0.5) * 0.07, (random() - 0.5) * 0.07)).normalize();
    quaternion.setFromUnitVectors(Y, tilted).multiply(new THREE.Quaternion().setFromAxisAngle(Y, random() * Math.PI * 2));
    return matrix.compose(p.clone().addScaledVector(n, r * 0.06), quaternion, scale.setScalar(r)).clone();
  });
  group.add(stones);

  // Glints sit on the stones' own seats and flash as the set turns.
  if (layout.stones.length && !gemsUnsupported()) {
    // Its own copy of the square, to carry each stone's seed; the seats are the stones' own.
    const glints = new THREE.InstancedMesh(glintGeometry().clone(), glintMaterial(), layout.stones.length);
    glints.instanceMatrix = stones.instanceMatrix;
    glints.geometry.setAttribute('seed', new THREE.InstancedBufferAttribute(Float32Array.from(layout.stones, () => random() * 100), 1));
    glints.name = 'stone_glints';
    glints.raycast = ignorePointer;
    glints.frustumCulled = false;
    glints.renderOrder = 2;
    group.add(glints);
  }

  if (layout.beads.length) {
    // Beads stand up between the stones to about the height of their tables.
    group.add(instanced(beadGeometry(), metalworkMaterial(metal), layout.beads, ({ p, n, r }) => matrix.compose(p.clone().addScaledVector(n, STONE_RADIUS * 0.1), quaternion.setFromUnitVectors(Y, n), scale.set(r, r * 1.25, r)).clone()));
  }
  return group;
}

/** Frees what one tooth's stones hold. Geometry and materials are shared, so only the per-tooth buffers go. */
export function disposeDiamondStones(group: THREE.Object3D) {
  group.traverse((child) => {
    if (!(child instanceof THREE.InstancedMesh)) return;
    if (child.name === 'stone_glints') child.geometry.dispose();
    child.dispose();
  });
}
