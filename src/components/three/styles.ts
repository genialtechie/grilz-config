import * as THREE from 'three';
import type { MetalId, StyleId } from '../../lib/renderSpec';
import { dentalStone, polishedMetal } from './materials';

// The finishes a jeweler cuts into the front of a cap, built as geometry on
// the tooth's own surface: an open-face rim and window, diamond-cut facets,
// diamond dust, engraving and opal inlays, plus fang caps. Everything here is
// in the tooth's own space (the model's teeth carry no extra transform) and is
// cached per tooth, so switching options only swaps meshes.

/** Centre of the arch, behind the front teeth: the front of a tooth faces away from it. */
export const ARCH_CENTRE = new THREE.Vector3(0.005, 0, -0.03);
const SECTORS = 48;
const LIFT = 0.00012; // how far a finish sits off the cap, so it never z-fights

type Front = {
  centre: THREE.Vector3;
  facial: THREE.Vector3;
  across: THREE.Vector3;
  up: THREE.Vector3;
  reach: number;
  /** Distance from the centre to the edge of the front face, per sector. */
  outline: number[];
  probe: THREE.Mesh;
};

const fronts = new WeakMap<THREE.BufferGeometry, Front>();
const ray = new THREE.Raycaster();

/** Shoots a ray back onto the tooth from in front of the point (u, v) on its front plane. */
function hitFront(front: Front, u: number, v: number) {
  const origin = front.centre.clone().addScaledVector(front.across, u).addScaledVector(front.up, v).addScaledVector(front.facial, front.reach);
  ray.set(origin, front.facial.clone().negate());
  const hit = ray.intersectObject(front.probe, false)[0];
  if (!hit?.face || hit.face.normal.dot(front.facial) < 0.2) return null;
  return { point: hit.point, normal: hit.face.normal.clone() };
}

/** The tooth's front: its facing, and the outline of the face (found once per tooth). */
export function frontOf(geometry: THREE.BufferGeometry): Front {
  const cached = fronts.get(geometry);
  if (cached) return cached;
  if (!geometry.boundingBox) geometry.computeBoundingBox();
  const box = geometry.boundingBox!;
  const centre = box.getCenter(new THREE.Vector3());
  const size = box.getSize(new THREE.Vector3());
  const facial = new THREE.Vector3(centre.x - ARCH_CENTRE.x, 0, centre.z - ARCH_CENTRE.z).normalize();
  const up = new THREE.Vector3(0, 1, 0);
  const across = new THREE.Vector3().crossVectors(up, facial).normalize();
  const front: Front = { centre, facial, across, up, reach: Math.max(size.x, size.y, size.z), outline: [], probe: new THREE.Mesh(geometry) };
  for (let i = 0; i < SECTORS; i += 1) {
    const angle = (i / SECTORS) * Math.PI * 2;
    // Binary search for the edge of the front face along this direction.
    let inside = 0;
    let outside = front.reach;
    for (let step = 0; step < 12; step += 1) {
      const middle = (inside + outside) / 2;
      if (hitFront(front, Math.cos(angle) * middle, Math.sin(angle) * middle)) inside = middle;
      else outside = middle;
    }
    front.outline.push(inside);
  }
  fronts.set(geometry, front);
  return front;
}

/** A point on the tooth's front, `fraction` of the way from the centre to the edge, lifted off the surface. */
function onFront(front: Front, sector: number, fraction: number, lift = LIFT) {
  const angle = (sector / SECTORS) * Math.PI * 2;
  const radius = front.outline[sector % SECTORS] * fraction;
  const hit = hitFront(front, Math.cos(angle) * radius, Math.sin(angle) * radius) ?? hitFront(front, 0, 0);
  if (!hit) return front.centre.clone().addScaledVector(front.facial, front.reach / 2);
  return hit.point.addScaledVector(hit.normal, lift);
}

/**
 * A panel following the tooth's front out to `fraction` of the way to its
 * edge: rings of points from the centre outwards, with UVs for textures.
 * `relief` (sector, ring) pushes points in or out, for cut facets.
 */
function panel(front: Front, fraction: number, rings: number, relief?: (sector: number, ring: number) => number, sectors = SECTORS) {
  const positions: number[] = [];
  const uvs: number[] = [];
  const indices: number[] = [];
  const centre = onFront(front, 0, 0, LIFT + (relief?.(0, 0) ?? 0));
  positions.push(centre.x, centre.y, centre.z);
  uvs.push(0.5, 0.5);
  const step = SECTORS / sectors;
  for (let ring = 1; ring <= rings; ring += 1) {
    const f = (ring / rings) * fraction;
    for (let s = 0; s < sectors; s += 1) {
      const angle = (s / sectors) * Math.PI * 2;
      const p = onFront(front, s * step, f, LIFT + (relief?.(s, ring) ?? 0));
      positions.push(p.x, p.y, p.z);
      uvs.push(0.5 + (Math.cos(angle) * f) / 2, 0.5 + (Math.sin(angle) * f) / 2);
    }
  }
  const at = (ring: number, s: number) => (ring === 0 ? 0 : 1 + (ring - 1) * sectors + (s % sectors));
  for (let s = 0; s < sectors; s += 1) indices.push(at(0, 0), at(1, s), at(1, s + 1));
  for (let ring = 1; ring < rings; ring += 1) {
    for (let s = 0; s < sectors; s += 1) {
      indices.push(at(ring, s), at(ring + 1, s), at(ring + 1, s + 1), at(ring, s), at(ring + 1, s + 1), at(ring, s + 1));
    }
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geometry.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
  geometry.setIndex(indices);
  // Face the panel out of the tooth (the ring order can come out either way round).
  geometry.computeVertexNormals();
  const n = new THREE.Vector3().fromBufferAttribute(geometry.attributes.normal as THREE.BufferAttribute, 0);
  if (n.dot(front.facial) < 0) {
    for (let i = 0; i < indices.length; i += 3) [indices[i + 1], indices[i + 2]] = [indices[i + 2], indices[i + 1]];
    geometry.setIndex(indices);
    geometry.computeVertexNormals();
  }
  return geometry;
}

/** A rounded metal rim along the front, `fraction` of the way to the edge. */
function rim(front: Front, fraction: number, thickness: number) {
  const points = Array.from({ length: SECTORS }, (_, s) => onFront(front, s, fraction, thickness * 0.45));
  const curve = new THREE.CatmullRomCurve3(points, true, 'centripetal');
  return new THREE.TubeGeometry(curve, SECTORS * 2, thickness, 8, true);
}

// ---------- Procedural textures (made once, a few KB each, nothing downloaded) ----------

const textures = new Map<string, THREE.Texture>();
function canvasTexture(key: string, size: number, draw: (context: CanvasRenderingContext2D, size: number) => void, colour = false) {
  const existing = textures.get(key);
  if (existing || typeof document === 'undefined') return existing ?? null;
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const context = canvas.getContext('2d');
  if (!context) return null;
  draw(context, size);
  const texture = new THREE.CanvasTexture(canvas);
  if (colour) texture.colorSpace = THREE.SRGBColorSpace;
  textures.set(key, texture);
  return texture;
}

/** Diamond dust: tiny random facets, each tilting the surface a different way, so it glitters. */
const dustNormals = () =>
  canvasTexture('dust', 256, (context, size) => {
    const image = context.createImageData(size, size);
    for (let y = 0; y < size; y += 2) {
      for (let x = 0; x < size; x += 2) {
        const nx = Math.random() * 2 - 1;
        const ny = Math.random() * 2 - 1;
        const rgb = [128 + nx * 110, 128 + ny * 110, 255];
        for (const [dx, dy] of [[0, 0], [1, 0], [0, 1], [1, 1]]) image.data.set([...rgb, 255], ((y + dy) * size + x + dx) * 4);
      }
    }
    context.putImageData(image, 0, 0);
  });

/** Engraving: hand-cut scrolls and leaves, as a bump map (dark = cut into the metal). */
const engravingBump = () =>
  canvasTexture('engraving', 512, (context, size) => {
    context.fillStyle = '#ffffff';
    context.fillRect(0, 0, size, size);
    context.strokeStyle = '#000000';
    context.lineCap = 'round';
    for (let row = 0; row < 4; row += 1) {
      const y = (row + 0.5) * (size / 4);
      context.lineWidth = 7;
      context.beginPath();
      for (let x = 0; x <= size; x += 4) context.lineTo(x, y + Math.sin((x / size) * Math.PI * 4 + row) * 26);
      context.stroke();
      // Curls and leaves off the main scroll.
      for (let k = 0; k < 4; k += 1) {
        const cx = ((k + 0.5) / 4) * size;
        const cy = y + Math.sin((cx / size) * Math.PI * 4 + row) * 26;
        context.lineWidth = 4;
        context.beginPath();
        context.arc(cx + 14, cy - 18, 16, Math.PI * 0.2, Math.PI * 1.7);
        context.stroke();
        context.beginPath();
        context.ellipse(cx - 18, cy + 16, 18, 7, -0.6, 0, Math.PI * 2);
        context.stroke();
      }
    }
  });

/** Opal: soft patches of colour (play-of-colour) over milky white. */
const opalColour = () =>
  canvasTexture(
    'opal',
    256,
    (context, size) => {
      context.fillStyle = '#eef0f6';
      context.fillRect(0, 0, size, size);
      const hues = ['#7fd6ff', '#9dffcf', '#ffb3e6', '#fff1a6', '#b6a8ff', '#7affe9'];
      for (let i = 0; i < 70; i += 1) {
        const x = Math.random() * size;
        const y = Math.random() * size;
        const r = 10 + Math.random() * 34;
        const gradient = context.createRadialGradient(x, y, 0, x, y, r);
        gradient.addColorStop(0, `${hues[i % hues.length]}cc`);
        gradient.addColorStop(1, `${hues[i % hues.length]}00`);
        context.fillStyle = gradient;
        context.fillRect(x - r, y - r, r * 2, r * 2);
      }
    },
    true,
  );

// ---------- Materials (shared, made once per metal) ----------

const materials = new Map<string, THREE.Material>();
function material(key: string, make: () => THREE.Material) {
  const existing = materials.get(key);
  if (existing) return existing;
  const made = make();
  materials.set(key, made);
  return made;
}

const metalFacets = (metal: MetalId) =>
  material(`facets:${metal}`, () => {
    const m = polishedMetal(metal);
    m.flatShading = true;
    m.roughness = 0.04;
    return m;
  });
const metalRim = (metal: MetalId) => material(`rim:${metal}`, () => polishedMetal(metal));
const metalDust = (metal: MetalId) =>
  material(`dust:${metal}`, () => {
    const m = polishedMetal(metal);
    m.roughness = 0.16;
    m.normalMap = dustNormals();
    m.normalScale = new THREE.Vector2(0.9, 0.9);
    const map = m.normalMap;
    if (map) {
      map.wrapS = THREE.RepeatWrapping;
      map.wrapT = THREE.RepeatWrapping;
      map.repeat.set(3, 3);
    }
    return m;
  });
const metalEngraved = (metal: MetalId) =>
  material(`engraved:${metal}`, () => {
    const m = polishedMetal(metal);
    m.bumpMap = engravingBump();
    m.bumpScale = 1.2;
    return m;
  });
const opal = () =>
  material('opal', () =>
    new THREE.MeshPhysicalMaterial({
      color: '#ffffff',
      map: opalColour(),
      roughness: 0.12,
      metalness: 0,
      clearcoat: 1,
      clearcoatRoughness: 0.04,
      iridescence: 1,
      iridescenceIOR: 1.6,
      iridescenceThicknessRange: [180, 620],
      envMapIntensity: 1.3,
    }),
  );
const stone = () => material('stone', dentalStone);

// ---------- Finishes ----------

const finishes = new Map<string, THREE.Group>();

/**
 * The finish on a tooth's front for a plain (not iced) cap, or null for a
 * plain solid polish. Built once per tooth, style and metal, then reused.
 */
export function finishFor(tooth: THREE.Mesh, style: StyleId, metal: MetalId): THREE.Group | null {
  if (style === 'solid') return null;
  const key = `${tooth.geometry.uuid}:${style}:${metal}`;
  const cached = finishes.get(key);
  if (cached) return cached.clone();
  const front = frontOf(tooth.geometry);
  const group = new THREE.Group();
  const rimThickness = Math.max(...front.outline) * 0.07;
  const add = (geometry: THREE.BufferGeometry, m: THREE.Material) => group.add(new THREE.Mesh(geometry, m));

  if (style === 'open-face') {
    // The metal stops short of the middle: a polished rim, the tooth showing inside.
    add(panel(front, 0.74, 6), stone());
    add(rim(front, 0.76, rimThickness), metalRim(metal));
  } else if (style === 'diamond-cut') {
    // A star cut: alternating sectors and rings sit higher and lower, each a flat mirror facet.
    const depth = rimThickness * 0.5;
    add(panel(front, 0.9, 4, (s, ring) => ((s + ring) % 2 ? depth : 0) + (ring === 0 ? depth : 0), 16), metalFacets(metal));
    add(rim(front, 0.91, rimThickness * 0.8), metalRim(metal));
  } else if (style === 'diamond-dust') {
    add(panel(front, 0.8, 6), metalDust(metal));
    add(rim(front, 0.82, rimThickness * 0.8), metalRim(metal));
  } else if (style === 'engraving') {
    add(panel(front, 0.86, 6), metalEngraved(metal));
    add(rim(front, 0.88, rimThickness * 0.7), metalRim(metal));
  } else if (style === 'opals') {
    add(panel(front, 0.68, 6, () => rimThickness * 0.25), opal());
    add(rim(front, 0.7, rimThickness), metalRim(metal));
  }
  group.name = 'tooth_finish';
  finishes.set(key, group);
  return group.clone();
}

// ---------- Fangs ----------

const fangs = new WeakMap<THREE.BufferGeometry, THREE.BufferGeometry>();

/**
 * An upper canine drawn out into a fang: the lower half stretches down and
 * narrows to a point, the way a fang cap is built over the tooth.
 */
export function fangGeometry(geometry: THREE.BufferGeometry) {
  const cached = fangs.get(geometry);
  if (cached) return cached;
  if (!geometry.boundingBox) geometry.computeBoundingBox();
  const box = geometry.boundingBox!;
  const centre = box.getCenter(new THREE.Vector3());
  const height = box.max.y - box.min.y;
  const front = frontOf(geometry);
  const fang = geometry.clone();
  const position = fang.attributes.position as THREE.BufferAttribute;
  const p = new THREE.Vector3();
  for (let i = 0; i < position.count; i += 1) {
    p.fromBufferAttribute(position, i);
    const t = THREE.MathUtils.clamp((centre.y - p.y) / (centre.y - box.min.y), 0, 1);
    if (t <= 0) continue;
    const ease = t * t;
    // Pull toward the tooth's centre line across the face (keep some depth front to back).
    const offset = p.clone().sub(centre);
    const sideways = offset.dot(front.across);
    const depth = offset.dot(front.facial);
    p.addScaledVector(front.across, -sideways * 0.78 * ease);
    p.addScaledVector(front.facial, -depth * 0.35 * ease);
    p.y -= height * 0.55 * ease;
    position.setXYZ(i, p.x, p.y, p.z);
  }
  position.needsUpdate = true;
  fang.computeVertexNormals();
  fang.computeBoundingBox();
  fang.computeBoundingSphere();
  fangs.set(geometry, fang);
  return fang;
}
