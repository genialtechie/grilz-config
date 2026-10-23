import * as THREE from 'three';
import { DecalGeometry } from 'three/examples/jsm/geometries/DecalGeometry.js';
import { ENAMELS, type Inscription, type MetalId } from '../../lib/renderSpec';

// Inscriptions drawn on the 3D set (MAG-76): the letters are part of the
// preview, so the AI photo starts from the exact text, font and placement
// instead of inventing them. One texture per inscription is projected across
// its teeth from the front; each tooth gets its own decal (a child of the
// tooth, so it follows the jaw and the permanent-look scale).

export const INSCRIPTION_DECAL = 'inscription_decal';

// Both faces are declared in index.css; the browser only downloads them when asked.
const FONTS = {
  script: { family: 'VVS Script', weight: '400' },
  block: { family: 'Inter Tight', weight: '800' },
} as const;

const loaded = new Map<string, Promise<unknown>>();
/** Loads the letters' font once (the canvas can only draw with a font the document has loaded). */
export function loadInscriptionFont(font: Inscription['font']): Promise<unknown> {
  if (typeof document === 'undefined' || !document.fonts) return Promise.resolve();
  const spec = FONTS[font];
  if (!loaded.has(font)) loaded.set(font, document.fonts.load(`${spec.weight} 64px "${spec.family}"`).catch(() => undefined));
  return loaded.get(font)!;
}

/** Metal colours for raised letters (sRGB). */
const METAL_LETTER: Record<MetalId, string> = { yellow: '#f6d27e', white: '#f1f1ee', rose: '#f3bfa8', silver: '#f4f4f2', platinum: '#e6e6e3' };
const ENGRAVED_LINE = '#2a2621';

/** A darker shade of a #rrggbb colour. */
const shade = (hex: string, factor: number) => {
  const value = Number.parseInt(hex.slice(1), 16);
  const channel = (shift: number) => Math.round(((value >> shift) & 255) * factor);
  return `rgb(${channel(16)},${channel(8)},${channel(0)})`;
};

/** The letters on a canvas the shape of the decal (width:height), drawn in their colours. */
function drawLetters(inscription: Inscription, metal: MetalId, aspect: number): HTMLCanvasElement {
  // One tooth curves away at its edges, so its letters keep a wider margin.
  const fill = inscription.teeth.length === 1 ? 0.84 : 0.92;
  const height = 256;
  const width = Math.min(4096, Math.round(height * aspect));
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const context = canvas.getContext('2d')!;
  const font = FONTS[inscription.font];
  const text = inscription.font === 'block' ? inscription.text.toUpperCase() : inscription.text;
  // As large as fits: 92% of the width, and no taller than the decal (script's loops reach past its capitals).
  let size = height * (inscription.font === 'script' ? 0.92 : 0.6);
  context.font = `${font.weight} ${size}px "${font.family}", ${inscription.font === 'script' ? 'cursive' : 'sans-serif'}`;
  const measured = context.measureText(text).width;
  if (measured > width * fill) size *= (width * fill) / measured;
  context.font = `${font.weight} ${size}px "${font.family}", ${inscription.font === 'script' ? 'cursive' : 'sans-serif'}`;
  // A name across several teeth is drawn wider to fill them, as jewelers lay it out (script stretches well; block a little).
  const stretch = Math.min(inscription.font === 'script' ? 1.35 : 1.15, Math.max(1, (width * fill) / context.measureText(text).width));
  context.setTransform(stretch, 0, 0, 1, 0, 0);
  context.textAlign = 'center';
  context.textBaseline = 'middle';
  const x = width / 2 / stretch;
  const y = height * (inscription.font === 'script' ? 0.54 : 0.52);
  const stroke = Math.max(2, size * 0.06);

  if (inscription.style === 'engraved') {
    // Cut into the metal: a dark engraved line, or the cut filled with enamel and edged dark.
    const enamel = inscription.enamel ? ENAMELS.find((item) => item.id === inscription.enamel)?.swatch : null;
    context.lineJoin = 'round';
    context.strokeStyle = ENGRAVED_LINE;
    context.lineWidth = stroke;
    if (enamel) {
      // A fine cut edge round the enamel: script strokes are thin, so the edge must not swamp the colour.
      context.strokeStyle = shade(enamel, 0.55);
      context.lineWidth = Math.max(1.5, size * 0.014);
      context.strokeText(text, x, y);
      context.fillStyle = enamel;
      context.fillText(text, x, y);
    } else if (inscription.font === 'script') {
      context.fillStyle = ENGRAVED_LINE;
      context.fillText(text, x, y);
    } else {
      // Block letters engraved as outlines, as hand engravers cut them.
      context.strokeText(text, x, y);
    }
  } else if (inscription.style === 'cut') {
    // Raised, faceted letters: polished metal with a dark edge so they read against the tooth.
    context.lineJoin = 'round';
    context.strokeStyle = ENGRAVED_LINE;
    context.lineWidth = stroke * 1.2;
    context.strokeText(text, x, y);
    context.fillStyle = METAL_LETTER[metal];
    context.fillText(text, x, y);
  } else {
    // Iced letters: paved with tiny stones, edged in metal.
    context.lineJoin = 'round';
    context.strokeStyle = METAL_LETTER[metal];
    context.lineWidth = stroke * 1.4;
    context.strokeText(text, x, y);
    context.fillStyle = '#ffffff';
    context.fillText(text, x, y);
    context.globalCompositeOperation = 'source-atop';
    const dot = Math.max(2, size * 0.05);
    for (let row = 0; row * dot * 1.7 < height; row += 1) {
      for (let column = 0; column * dot * 2 < width / stretch; column += 1) {
        const cx = column * dot * 2 + (row % 2 ? dot : 0);
        const cy = row * dot * 1.7;
        const shade = 150 + ((row * 7 + column * 13) % 5) * 26;
        context.fillStyle = `rgb(${shade},${shade},${Math.min(255, shade + 10)})`;
        context.beginPath();
        context.arc(cx, cy, dot * 0.8, 0, Math.PI * 2);
        context.fill();
      }
    }
    context.globalCompositeOperation = 'source-over';
  }
  context.setTransform(1, 0, 0, 1, 0, 0);
  return canvas;
}

function letterMaterial(inscription: Inscription, texture: THREE.Texture) {
  const raised = inscription.style !== 'engraved';
  return new THREE.MeshPhysicalMaterial({
    map: texture,
    transparent: true,
    alphaTest: 0.08,
    depthWrite: false,
    polygonOffset: true,
    polygonOffsetFactor: -4,
    // Raised letters are metal (or stones); engraved lines are dark cuts; enamel is glossy glass-like paint.
    metalness: raised ? 0.9 : inscription.enamel ? 0 : 0.4,
    roughness: raised ? 0.12 : inscription.enamel ? 0.4 : 0.5,
    clearcoat: 0,
    // Enamel is coloured glass: it keeps its colour under bright studio light.
    emissiveMap: inscription.enamel ? texture : null,
    emissive: inscription.enamel ? new THREE.Color('#ffffff') : new THREE.Color('#000000'),
    emissiveIntensity: inscription.enamel ? 0.45 : 0,
    envMapIntensity: inscription.style === 'iced' ? 2.6 : inscription.enamel ? 0.5 : 1.2,
  });
}

/**
 * Decals for one inscription on its teeth (meshes already in the scene, world
 * matrices current). Each decal is returned with the tooth it belongs to, in
 * that tooth's local space.
 */
export function inscriptionDecals(inscription: Inscription, teeth: THREE.Mesh[], metal: MetalId): { tooth: THREE.Mesh; decal: THREE.Mesh }[] {
  if (!teeth.length || typeof document === 'undefined') return [];
  teeth.forEach((tooth) => tooth.updateWorldMatrix(true, false));
  const box = new THREE.Box3();
  teeth.forEach((tooth) => box.expandByObject(tooth));
  const centre = box.getCenter(new THREE.Vector3());

  // Project from the front of the run: outward from the middle of the arch, level.
  const outward = new THREE.Vector3(centre.x, 0, centre.z + 1.2).normalize();
  if (outward.lengthSq() < 0.5) outward.set(0, 0, 1);
  const up = new THREE.Vector3(0, 1, 0);
  const right = new THREE.Vector3().crossVectors(up, outward).normalize();
  const orientation = new THREE.Euler().setFromRotationMatrix(new THREE.Matrix4().makeBasis(right, up, outward));

  // The decal spans the run's width (measured across the projection) and most of a tooth's height.
  const corners = [box.min, box.max].flatMap((a) => [box.min, box.max].map((b) => new THREE.Vector3(a.x, 0, b.z)));
  const across = corners.map((corner) => corner.dot(right));
  const width = (Math.max(...across) - Math.min(...across)) * 0.94;
  const toothHeight = box.max.y - box.min.y;
  const height = toothHeight * 0.66;
  const depth = (box.max.z - box.min.z) + 0.6;
  // Letters sit on the part of the teeth that shows when the bite is closed: lower on the lower row
  // (the upper teeth overlap its top), higher on the upper row.
  const lowerRow = centre.y < 0;
  const position = centre.clone().setY(lowerRow ? box.min.y + toothHeight * 0.42 : box.min.y + toothHeight * 0.55);

  const canvas = drawLetters(inscription, metal, width / height);
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.anisotropy = 8;
  const material = letterMaterial(inscription, texture);
  const size = new THREE.Vector3(width, height, depth);

  return teeth.flatMap((tooth) => {
    const geometry = new DecalGeometry(tooth, position, orientation, size);
    if (!geometry.getAttribute('position')?.count) {
      geometry.dispose();
      return [];
    }
    // DecalGeometry is in world space; hang it on the tooth in the tooth's own space.
    geometry.applyMatrix4(tooth.matrixWorld.clone().invert());
    const decal = new THREE.Mesh(geometry, material);
    decal.name = INSCRIPTION_DECAL;
    decal.renderOrder = 2;
    return [{ tooth, decal }];
  });
}

/** Removes a tooth's inscription decals (their texture and material are shared per inscription). */
export function clearInscriptionDecals(tooth: THREE.Object3D, disposed: Set<THREE.Material>) {
  tooth.children.filter((child) => child.name === INSCRIPTION_DECAL).forEach((child) => {
    tooth.remove(child);
    const mesh = child as THREE.Mesh;
    mesh.geometry.dispose();
    const material = mesh.material as THREE.MeshPhysicalMaterial;
    if (!disposed.has(material)) {
      disposed.add(material);
      material.map?.dispose();
      material.dispose();
    }
  });
}
