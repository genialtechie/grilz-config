import * as THREE from 'three';

// Photo grillz in 3D (MAG-148): the customer's picture across each run of
// neighbouring photo teeth, laid like the letters (inscriptions.ts): one
// picture per run, each tooth showing its part on a panel inside a gold rim
// (redesign/overlays.ts). Until they upload one, the prototype's stand-in shows
// so the choice visibly does something. The stand-in is only for the screen:
// the captures the AI photo starts from leave it out (hidePhotoPlaceholders),
// while a real picture stays in, so the photo is made from the customer's
// image on the teeth.

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

/** The picture (or the stand-in) on a canvas the shape of the run's face (width over height). */
function drawPhoto(image: HTMLImageElement | null, aspect: number): HTMLCanvasElement {
  const height = 384;
  const width = Math.max(64, Math.min(4096, Math.round(height * aspect)));
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const context = canvas.getContext('2d')!;
  if (image) {
    // Cover the face, cropped from the middle (portraits keep the upper part, where faces are).
    const scale = Math.max(width / image.width, height / image.height);
    const drawWidth = image.width * scale;
    const drawHeight = image.height * scale;
    const top = image.height > image.width ? Math.min(0, (height - drawHeight) * 0.3) : (height - drawHeight) / 2;
    context.drawImage(image, (width - drawWidth) / 2, top, drawWidth, drawHeight);
  } else {
    // The prototype's stand-in: a bold colour sweep with "YOUR PHOTO" across it.
    const gradient = context.createLinearGradient(0, 0, width, 0);
    gradient.addColorStop(0, '#0f1c3f');
    gradient.addColorStop(0.5, '#b3222f');
    gradient.addColorStop(1, '#f2a33a');
    context.fillStyle = gradient;
    context.fillRect(0, 0, width, height);
    context.fillStyle = 'rgba(255,255,255,.92)';
    context.textAlign = 'center';
    context.textBaseline = 'middle';
    let size = height * 0.58;
    context.font = `800 ${size}px "Inter Tight", Arial, sans-serif`;
    const measured = context.measureText('YOUR PHOTO').width;
    if (measured > width * 0.9) size *= (width * 0.9) / measured;
    context.font = `800 ${size}px "Inter Tight", Arial, sans-serif`;
    context.fillText('YOUR PHOTO', width / 2, height * 0.53);
  }
  return canvas;
}

/** The run's picture as a texture, `aspect` wide (width over height). */
export function photoTexture(image: HTMLImageElement | null, aspect: number) {
  const texture = new THREE.CanvasTexture(drawPhoto(image, aspect));
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.anisotropy = 4;
  return texture;
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

/** Marks a photo panel as the stand-in (not the customer's design), so captures leave it out. */
export function markPlaceholder(panel: THREE.Object3D, placeholder: boolean) {
  panel.name = PHOTO_DECAL;
  panel.userData[PLACEHOLDER] = placeholder;
}

/** Hides the stand-in panels (they are not the customer's design) for a capture; returns how to put them back. */
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
