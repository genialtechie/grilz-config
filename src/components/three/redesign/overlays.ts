import * as THREE from 'three';
import type { Inscription, MetalId } from '../../../lib/renderSpec';
import { INSCRIPTION_DECAL, letterMaterial, letterTexture } from '../inscriptions';
import { markPlaceholder, PHOTO_DECAL, photoTexture } from '../photoDecals';
import { PHOTO_INSET } from './dress';
import type { Look } from './look';
import { noRaycast, type Piece, type ToothSlot } from './piece';
import { patchGeo, type ToothDef } from './sculpt';

// Letters and pictures laid across a run of neighbouring teeth. Each tooth gets
// a panel lying on the face of its cap (the prototype's patch), and the panels
// share one picture, mapped as the run is seen from its front: a name runs on
// from one tooth to the next as a jeweler lays it out, and a photo spreads over
// every photo tooth in the run. The panels hang in each tooth's overlay group,
// so captures count them as part of the tooth.

/** A tooth in a run, with the shape its cap is dressed in (a fang, the cut). */
export type Shaped = { slot: ToothSlot; def: ToothDef; rise: number };

/** Each tooth's panel, and where its points fall across (a) and up (b) the run's front view. */
function across(piece: Piece, run: Shaped[], inset: number, lift: number) {
  piece.root.updateMatrixWorld(true);
  const inverse = piece.root.matrixWorld.clone().invert();
  // The run's front: the way its teeth face, on average, out of the arch (the jaw is closed, so both halves share one frame).
  const outward = run.reduce((sum, { slot }) => sum.add(slot.out), new THREE.Vector3()).normalize();
  const up = new THREE.Vector3(0, 1, 0);
  const right = new THREE.Vector3().crossVectors(up, outward).normalize();
  const p = new THREE.Vector3();
  const box = { a0: Infinity, a1: -Infinity, b0: Infinity, b1: -Infinity };
  const panels = run.map(({ slot, def, rise }) => {
    const geometry = patchGeo(def, rise, inset, lift);
    const matrix = inverse.clone().multiply(slot.group.matrixWorld);
    const position = geometry.attributes.position as THREE.BufferAttribute;
    const ab = new Float32Array(position.count * 2);
    for (let i = 0; i < position.count; i++) {
      p.fromBufferAttribute(position, i).applyMatrix4(matrix);
      const a = p.dot(right);
      const b = p.dot(up);
      ab[i * 2] = a;
      ab[i * 2 + 1] = b;
      box.a0 = Math.min(box.a0, a);
      box.a1 = Math.max(box.a1, a);
      box.b0 = Math.min(box.b0, b);
      box.b1 = Math.max(box.b1, b);
    }
    return { slot, geometry, ab };
  });
  return { panels, ...box };
}

/** Maps a panel onto the picture: `a` and `b` centred on (ca, cb), the picture `width` by `height`. */
function mapPanel(geometry: THREE.BufferGeometry, ab: Float32Array, ca: number, cb: number, width: number, height: number) {
  const uv = new Float32Array(ab.length);
  for (let i = 0; i < ab.length; i += 2) {
    uv[i] = (ab[i] - ca) / width + 0.5;
    uv[i + 1] = (ab[i + 1] - cb) / height + 0.5;
  }
  geometry.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
}

function hang(slot: ToothSlot, geometry: THREE.BufferGeometry, material: THREE.Material, name: string) {
  const mesh = new THREE.Mesh(geometry, material);
  mesh.name = name;
  mesh.raycast = noRaycast;
  slot.overlay.add(mesh);
  return mesh;
}

/** Removes a tooth's panels of one kind. Their picture and material are shared by the run: `disposed` keeps them from going twice. */
export function clearOverlay(slot: ToothSlot, name: string, disposed: Set<THREE.Material>) {
  slot.overlay.children
    .filter((child) => child.name === name)
    .forEach((child) => {
      slot.overlay.remove(child);
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

/**
 * The letters of one inscription across its teeth. A monogram on one tooth fills
 * most of its face; a name across teeth keeps to a band. Letters sit a little
 * towards the biting edge, clear of the gum; on the lower row they keep to the
 * part the upper teeth don't cover in the closed bite.
 */
export function layLetters(piece: Piece, look: Look, run: Shaped[], inscription: Inscription, metal: MetalId) {
  if (!run.length || typeof document === 'undefined') return;
  const single = run.length === 1;
  const { panels, a0, a1, b0, b1 } = across(piece, run, single ? 0.75 : 0.3, 0.09);
  const upper = run[0].slot.upper;
  // The lower teeth show up to the biting ends of the upper teeth over them.
  const bite = () => piece.rig.position.y + run.reduce((sum, { slot }) => sum + piece.teeth[slot.index - 16].tip, 0) / run.length;
  const top = upper ? b1 : Math.min(b1, bite());
  const face = top - b0;
  const width = a1 - a0;
  const height = face * (single ? 0.72 : 0.62);
  const centre = b0 + face * (upper ? 0.46 : 0.5);
  const material = letterMaterial(inscription, letterTexture(inscription, metal, width / height), { metal: look.metalEnv, sparkle: look.sparkleEnv });
  panels.forEach(({ slot, geometry, ab }) => {
    mapPanel(geometry, ab, (a0 + a1) / 2, centre, width, height);
    hang(slot, geometry, material, INSCRIPTION_DECAL);
  });
}

/** The customer's picture (or the stand-in) across a run of photo teeth, inside each tooth's gold rim. */
export function layPhoto(piece: Piece, look: Look, run: Shaped[], image: HTMLImageElement | null) {
  if (!run.length || typeof document === 'undefined') return;
  const { panels, a0, a1, b0, b1 } = across(piece, run, PHOTO_INSET, 0.08);
  const width = a1 - a0;
  const height = b1 - b0;
  const material = look.photoMat(photoTexture(image, width / height));
  panels.forEach(({ slot, geometry, ab }) => {
    mapPanel(geometry, ab, (a0 + a1) / 2, (b0 + b1) / 2, width, height);
    markPlaceholder(hang(slot, geometry, material, PHOTO_DECAL), !image);
  });
}
