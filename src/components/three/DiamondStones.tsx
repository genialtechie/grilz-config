import * as THREE from 'three';
import { stoneMaterial } from './materials';
import { frontOf, onFront, SECTORS } from './styles';

// Pavé: round stones packed edge to edge over the front of a tooth, the way a
// jeweler sets an iced cap (about nine across a front tooth). Positions are
// in the tooth's own space (the model's teeth carry no extra transform).

const STONE_RADIUS = 0.00108;
const SPACING = STONE_RADIUS * 2.04;
const Y = new THREE.Vector3(0, 1, 0);

/**
 * A round brilliant, flat-shaded so every facet is its own mirror: table,
 * two rings of crown facets, girdle, pavilion to a point. Y is up out of the
 * setting. Eight-fold like a real cut; the rings are offset so the facets
 * alternate the way star and bezel facets do.
 */
let brilliant: THREE.BufferGeometry | null = null;
function brilliantGeometry() {
  if (brilliant) return brilliant;
  // [radius, height] from the table down to the culet.
  const profile: [number, number][] = [
    [0, 0.36],
    [0.55, 0.36],
    [0.82, 0.24],
    [1, 0.08],
    [1, 0.03],
    [0, -0.78],
  ];
  const sides = 8;
  const positions: number[] = [];
  const ring = (level: number, k: number) => {
    const [radius, height] = profile[level];
    const angle = ((k + (level % 2 ? 0.5 : 0)) / sides) * Math.PI * 2;
    return [Math.cos(angle) * radius, height, Math.sin(angle) * radius];
  };
  for (let level = 0; level < profile.length - 1; level += 1) {
    for (let k = 0; k < sides; k += 1) {
      const a = ring(level, k);
      const b = ring(level, k + 1);
      const c = ring(level + 1, k);
      const d = ring(level + 1, k + 1);
      positions.push(...a, ...b, ...c, ...b, ...d, ...c);
    }
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geometry.computeVertexNormals();
  brilliant = geometry;
  return brilliant;
}

// A few stones throw a little colour (fire); most stay white.
const FIRE = ['#fff6e0', '#e8f2ff', '#ffeef6', '#f0fff4'];

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

/**
 * `ring`: instead of covering the face, set one row of stones round it this
 * far out from the middle (0 to 1), for an iced open face.
 */
export const createDiamondStones = (tooth: THREE.Mesh, kind: 'lab' | 'moissanite' = 'lab', ring = 0) => {
  const random = seeded(tooth.name);
  const geometry = tooth.geometry;
  const front = frontOf(geometry);
  const { centre, facial, up, across } = front;
  const size = geometry.boundingBox!.getSize(new THREE.Vector3());

  // A honeycomb grid in front of the tooth, each point shot back onto its surface.
  const probe = new THREE.Mesh(geometry);
  const ray = new THREE.Raycaster();
  const reach = Math.max(size.x, size.y, size.z);
  const rowStep = SPACING * Math.sqrt(3) / 2;
  const kept: { p: THREE.Vector3; n: THREE.Vector3 }[] = [];
  if (ring > 0) {
    // One row round the face, spaced evenly along it.
    const line = Array.from({ length: SECTORS * 4 }, (_, i) => onFront(front, i / 4, ring, 0));
    const gap = SPACING * 1.08;
    let since = gap;
    line.forEach((point, i) => {
      since += i ? point.distanceTo(line[i - 1]) : 0;
      if (since < gap) return;
      since = 0;
      const n = point.clone().sub(centre).normalize().lerp(facial, 0.7).normalize();
      kept.push({ p: point, n });
    });
  }
  for (let row = 0, v = -reach / 2; ring === 0 && v <= reach / 2; row += 1, v += rowStep) {
    for (let u = -reach / 2 + (row % 2 ? SPACING / 2 : 0); u <= reach / 2; u += SPACING) {
      const origin = centre.clone().addScaledVector(across, u).addScaledVector(up, v).addScaledVector(facial, reach);
      ray.set(origin, facial.clone().negate());
      const hit = ray.intersectObject(probe, false)[0];
      if (!hit?.face) continue;
      const n = hit.face.normal.clone();
      // Only the face a stone can sit on: not the sides, tip or back.
      if (n.dot(facial) < 0.35) continue;
      kept.push({ p: hit.point, n });
    }
  }
  const mesh = new THREE.InstancedMesh(brilliantGeometry(), stoneMaterial(), Math.max(1, kept.length));
  mesh.count = kept.length;
  const matrix = new THREE.Matrix4();
  const quaternion = new THREE.Quaternion();
  const scale = new THREE.Vector3();
  const colour = new THREE.Color();
  const fireShare = kind === 'moissanite' ? 0.28 : 0.14;
  kept.forEach(({ p, n }, i) => {
    // Set a few degrees off true, like hand-set stones, so neighbours catch different lights.
    const tilted = n.clone().add(new THREE.Vector3((random() - 0.5) * 0.35, (random() - 0.5) * 0.35, (random() - 0.5) * 0.35)).normalize();
    quaternion.setFromUnitVectors(Y, tilted);
    // A little twist per stone so the facets don't all catch the light together.
    quaternion.multiply(new THREE.Quaternion().setFromAxisAngle(Y, random() * Math.PI));
    const size = STONE_RADIUS * (0.94 + random() * 0.1);
    scale.set(size, size, size);
    matrix.compose(p.clone().addScaledVector(n, STONE_RADIUS * 0.12), quaternion, scale);
    mesh.setMatrixAt(i, matrix);
    mesh.setColorAt(i, colour.set(random() < fireShare ? FIRE[i % FIRE.length] : '#ffffff'));
  });
  mesh.instanceMatrix.needsUpdate = true;
  if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
  return mesh;
};
