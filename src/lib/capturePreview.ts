import * as THREE from 'three';
import type { RootState } from '@react-three/fiber';

const OUTPUT_SIZE = 1024;
const CAPTURE_PIXELS = 800; // crop resolution before upscaling; keeps the GPU work light on phones
const MAX_BUFFER = 4096;
const MASK_DILATE_PX = 10; // the AI photo never lines up pixel-perfectly with the 3D view

const toothNameRegex = /^(top|bottom)_teeth(\d{3})$/;

const toothIndexOf = (object: THREE.Object3D): number | null => {
  let current: THREE.Object3D | null = object;
  while (current) {
    const match = current.name.match(toothNameRegex);
    if (match) {
      const number = Number.parseInt(match[2], 10) - 1;
      return match[1] === 'top' ? number : 16 + number;
    }
    current = current.parent;
  }
  return null;
};

// Renders the current view at higher resolution and draws the centred square
// crop onto a 1024 canvas. The preview and every mask share this exact crop,
// so the masks line up with the image the AI starts from.
function renderCrop(state: RootState, background: string): HTMLCanvasElement {
  const { gl, scene, camera, size } = state;
  const previousRatio = gl.getPixelRatio();
  const side = Math.min(size.height * 0.62, size.width * 0.95);
  const ratio = Math.min(CAPTURE_PIXELS / side, MAX_BUFFER / Math.max(size.width, size.height));

  gl.setPixelRatio(ratio);
  gl.render(scene, camera);

  const output = document.createElement('canvas');
  output.width = OUTPUT_SIZE;
  output.height = OUTPUT_SIZE;
  const context = output.getContext('2d');
  if (!context) throw new Error('Canvas 2D is unavailable');
  context.fillStyle = background;
  context.fillRect(0, 0, OUTPUT_SIZE, OUTPUT_SIZE);
  context.drawImage(
    gl.domElement,
    ((size.width - side) / 2) * ratio,
    ((size.height - side) / 2) * ratio,
    side * ratio,
    side * ratio,
    0,
    0,
    OUTPUT_SIZE,
    OUTPUT_SIZE,
  );

  gl.setPixelRatio(previousRatio);
  return output;
}

/**
 * A square JPEG of the current 3D view, ready to send to the AI renderer.
 * Teeth without grillz are painted clean matte white for the capture so the AI
 * never mistakes a dimly lit natural tooth for metal.
 */
export function capturePreview(state: RootState, grillzTeeth: number[]): string {
  const withGrillz = new Set(grillzTeeth);
  const natural = new THREE.MeshStandardMaterial({ color: '#f6f3ee', roughness: 0.55, metalness: 0 });
  const originals = new Map<THREE.Mesh, THREE.Material | THREE.Material[]>();
  state.scene.traverse((object) => {
    if (!(object instanceof THREE.Mesh) || !toothNameRegex.test(object.name)) return;
    const index = toothIndexOf(object);
    if (index === null || withGrillz.has(index)) return;
    originals.set(object, object.material);
    object.material = natural;
  });
  let canvas: HTMLCanvasElement;
  try {
    canvas = renderCrop(state, '#ffffff');
  } finally {
    originals.forEach((material, mesh) => {
      mesh.material = material;
    });
    natural.dispose();
    state.gl.render(state.scene, state.camera);
  }
  return canvas.toDataURL('image/jpeg', 0.92);
}

/**
 * A black-and-white PNG mask (white = the given teeth, stones included) in the
 * same crop as capturePreview, slightly dilated. Used for per-tooth AI edits.
 */
export function captureToothMask(state: RootState, teeth: number[]): string {
  const wanted = new Set(teeth);
  const white = new THREE.MeshBasicMaterial({ color: '#ffffff', toneMapped: false });
  const black = new THREE.MeshBasicMaterial({ color: '#000000', toneMapped: false });
  const originals = new Map<THREE.Mesh, THREE.Material | THREE.Material[]>();
  const hidden: THREE.Object3D[] = [];
  const background = state.scene.background;
  const environment = state.scene.environment;

  state.scene.traverse((object) => {
    // Stones poke past the tooth outline and make ragged mask edges; mask the tooth shape only.
    if (object.name === 'diamond_stones' && object.visible) {
      object.visible = false;
      hidden.push(object);
      return;
    }
    if (!(object instanceof THREE.Mesh)) return;
    originals.set(object, object.material);
    const index = toothIndexOf(object);
    object.material = index !== null && wanted.has(index) ? white : black;
  });
  state.scene.background = null;
  state.scene.environment = null;

  let canvas: HTMLCanvasElement;
  try {
    canvas = renderCrop(state, '#000000');
  } finally {
    originals.forEach((material, mesh) => {
      mesh.material = material;
    });
    hidden.forEach((object) => {
      object.visible = true;
    });
    state.scene.background = background;
    state.scene.environment = environment;
    white.dispose();
    black.dispose();
    state.gl.render(state.scene, state.camera);
  }

  // Dilate: stack offset copies with "lighten" so white grows by MASK_DILATE_PX.
  const dilated = document.createElement('canvas');
  dilated.width = OUTPUT_SIZE;
  dilated.height = OUTPUT_SIZE;
  const context = dilated.getContext('2d')!;
  context.fillStyle = '#000000';
  context.fillRect(0, 0, OUTPUT_SIZE, OUTPUT_SIZE);
  context.globalCompositeOperation = 'lighten';
  for (let radius = 2; radius <= MASK_DILATE_PX; radius += 2) {
    for (let step = 0; step < 12; step += 1) {
      const angle = (step / 12) * Math.PI * 2;
      context.drawImage(canvas, Math.cos(angle) * radius, Math.sin(angle) * radius);
    }
  }
  context.drawImage(canvas, 0, 0);
  return dilated.toDataURL('image/png');
}
