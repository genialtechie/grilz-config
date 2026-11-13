import * as THREE from 'three';
import { clearDecals, projectOnTeeth, runProjection } from './inscriptions';

// Photo grillz in 3D (MAG-148): the customer's picture across each run of
// neighbouring photo teeth, projected like the letters (inscriptions.ts). Until
// they upload one, a soft portrait mark stands in so the choice visibly does
// something. The mark is only for the screen: the captures the AI photo starts
// from leave it out (hidePhotoPlaceholders), while a real picture stays in, so
// the photo is made from the customer's image on the teeth.

export const PHOTO_DECAL = 'photo_decal';
const PLACEHOLDER = 'photoPlaceholder';

/** Runs of neighbouring teeth in one row, in index order. */
export function photoRuns(indices: number[]): number[][] {
  const runs: number[][] = [];
  [...indices].sort((a, b) => a - b).forEach((index) => {
    const last = runs.at(-1);
    if (last && last.at(-1) === index - 1 && Math.floor(last[0] / 16) === Math.floor(index / 16)) last.push(index);
    else runs.push([index]);
  });
  return runs;
}

const roundedRect = (context: CanvasRenderingContext2D, x: number, y: number, width: number, height: number, radius: number) => {
  context.beginPath();
  context.moveTo(x + radius, y);
  context.arcTo(x + width, y, x + width, y + height, radius);
  context.arcTo(x + width, y + height, x, y + height, radius);
  context.arcTo(x, y + height, x, y, radius);
  context.arcTo(x, y, x + width, y, radius);
  context.closePath();
};

/** The picture (or the stand-in mark) on a canvas the shape of the run's face, inside a thin dark edge. */
function drawPhoto(image: HTMLImageElement | null, aspect: number): HTMLCanvasElement {
  const height = 384;
  const width = Math.max(64, Math.min(4096, Math.round(height * aspect)));
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const context = canvas.getContext('2d')!;
  const inset = height * 0.04;
  const radius = Math.min(width, height) * 0.16;
  roundedRect(context, inset, inset, width - inset * 2, height - inset * 2, radius);
  context.save();
  context.clip();
  if (image) {
    // Cover the face, cropped from the middle (portraits keep the upper part, where faces are).
    const scale = Math.max(width / image.width, height / image.height);
    const drawWidth = image.width * scale;
    const drawHeight = image.height * scale;
    const top = image.height > image.width ? Math.min(0, (height - drawHeight) * 0.3) : (height - drawHeight) / 2;
    context.drawImage(image, (width - drawWidth) / 2, top, drawWidth, drawHeight);
  } else {
    // A soft portrait mark: head and shoulders, engraved-looking, on a pale enamel panel.
    context.fillStyle = '#e4e0d9';
    context.fillRect(0, 0, width, height);
    context.fillStyle = '#9a948b';
    const middle = width / 2;
    const unit = Math.min(height, width * 1.1);
    context.beginPath();
    context.arc(middle, height * 0.4, unit * 0.17, 0, Math.PI * 2);
    context.fill();
    context.beginPath();
    context.ellipse(middle, height * 0.98, unit * 0.36, unit * 0.32, 0, Math.PI, Math.PI * 2);
    context.fill();
  }
  context.restore();
  context.lineWidth = height * 0.035;
  context.strokeStyle = 'rgba(40, 34, 28, 0.85)';
  roundedRect(context, inset, inset, width - inset * 2, height - inset * 2, radius);
  context.stroke();
  return canvas;
}

const images = new Map<string, Promise<HTMLImageElement | null>>();
/** The uploaded picture as an image (data URLs decode quickly; a failure leaves the stand-in). */
export function loadPhoto(src: string | null | undefined): Promise<HTMLImageElement | null> {
  if (!src || typeof Image === 'undefined') return Promise.resolve(null);
  if (!images.has(src)) {
    images.clear();
    images.set(
      src,
      new Promise((resolve) => {
        const image = new Image();
        image.onload = () => resolve(image);
        image.onerror = () => resolve(null);
        image.src = src;
      }),
    );
  }
  return images.get(src)!;
}

/** Decals for one run of photo teeth: the picture, or the stand-in when there is none yet. */
export function photoDecals(teeth: THREE.Mesh[], image: HTMLImageElement | null): { tooth: THREE.Mesh; decal: THREE.Mesh }[] {
  if (!teeth.length || typeof document === 'undefined') return [];
  // Most of the face, a touch towards the biting edge, clear of the gum.
  const projection = runProjection(teeth, 0.74, (lowerRow) => (lowerRow ? 0.52 : 0.46));
  const texture = new THREE.CanvasTexture(drawPhoto(image, projection.size.x / projection.size.y));
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.anisotropy = 8;
  // Enamelled picture under a clear glaze: keeps its colours under the studio light.
  const material = new THREE.MeshPhysicalMaterial({
    map: texture,
    transparent: true,
    alphaTest: 0.08,
    depthWrite: false,
    polygonOffset: true,
    polygonOffsetFactor: -4,
    metalness: 0,
    roughness: 0.35,
    clearcoat: 0.6,
    clearcoatRoughness: 0.2,
    envMapIntensity: 0.5,
  });
  return projectOnTeeth(teeth, projection, material, PHOTO_DECAL).map((item) => {
    item.decal.userData[PLACEHOLDER] = !image;
    return item;
  });
}

export const clearPhotoDecals = (tooth: THREE.Object3D, disposed: Set<THREE.Material>) => clearDecals(tooth, PHOTO_DECAL, disposed);

/** Hides the stand-in marks (they are not the customer's design) for a capture; returns how to put them back. */
export function hidePhotoPlaceholders(scene: THREE.Object3D): () => void {
  const hidden: THREE.Object3D[] = [];
  scene.traverse((object) => {
    if (object.name === PHOTO_DECAL && object.userData[PLACEHOLDER] && object.visible) {
      object.visible = false;
      hidden.push(object);
    }
  });
  return () =>
    hidden.forEach((object) => {
      object.visible = true;
    });
}
