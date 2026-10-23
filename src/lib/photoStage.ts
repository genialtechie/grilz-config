import * as THREE from 'three';
import type { RootState } from '@react-three/fiber';
import { MODEL_CENTRE } from './framing';
import { labelColor } from './photoLabels';

// The photo stage (MAG-76): the 3D still the AI photo starts from, set up the
// way jewelers shoot grillz on a model. The AI then only has to make it
// photographic; the less it has to invent, the less it changes the piece.
//   - the bite closed, upper incisors just over the lower ones;
//   - a fixed camera: front, a little above and turned slightly, the set filling a 3:2 frame;
//   - a charcoal backdrop and a studio of big soft boxes for the metal to reflect, with dark flags
//     so polished edges read (all-white surroundings make metal look flat);
//   - supersampled: drawn at 1.5x and scaled down, so edges and stones stay crisp.
// The live viewer is untouched: everything is set for one frame and put back.

/** A charcoal backdrop, as jewelers shoot white metal and stones: they need the contrast. */
export const BACKDROP = '#2c2a27';
export const PHOTO_WIDTH = 1536;
export const PHOTO_HEIGHT = 1024;
const SUPERSAMPLE = 1.5;
/** How far the upper jaw moves to close the bite, in scene units (measured on the model). The lower one stays on its shadow. */
const BITE = new THREE.Vector3(0, -0.93, 0.3);
const CAMERA_FOV = 30;
/** A little above the bite line and a little to the side, as on a bench shot. */
const CAMERA_DIRECTION = new THREE.Vector3(0.22, 0.1, 1).normalize();

const toothName = /^(top|bottom)_teeth(\d{3})$/;
const toothIndexOf = (name: string): number | null => {
  const match = name.match(toothName);
  if (!match) return null;
  const number = Number.parseInt(match[2], 10) - 1;
  return match[1] === 'top' ? number : 16 + number;
};

let studio: { texture: THREE.Texture; renderer: THREE.WebGLRenderer } | null = null;

/** The studio the metal reflects: soft boxes above, in front and at the sides, dark flags between. */
function photoEnvironment(renderer: THREE.WebGLRenderer): THREE.Texture {
  if (studio?.renderer === renderer) return studio.texture;
  const room = new THREE.Scene();
  room.background = new THREE.Color('#57534d');
  const panel = (color: string, intensity: number, size: [number, number], position: [number, number, number], lookAt = new THREE.Vector3()) => {
    const material = new THREE.MeshBasicMaterial({ color: new THREE.Color(color).multiplyScalar(intensity), side: THREE.DoubleSide });
    const mesh = new THREE.Mesh(new THREE.PlaneGeometry(...size), material);
    mesh.position.set(...position);
    mesh.lookAt(lookAt);
    room.add(mesh);
  };
  // Soft boxes: a big one overhead, a wide one behind the camera, two tall strips at the sides.
  panel('#ffffff', 4, [16, 10], [0, 9, 2]);
  panel('#fffaf2', 3, [14, 7], [0, 1.5, 10]);
  panel('#ffffff', 3, [3, 10], [-8, 2, 4]);
  panel('#ffffff', 3, [3, 10], [8, 2, 4]);
  // Dark flags, narrow and off to the sides: thin dark bands along polished edges, not big black faces.
  panel('#141414', 1, [1.6, 9], [-6.5, 1, -1]);
  panel('#141414', 1, [1.6, 9], [6.5, 1, -1]);
  // A low soft box in front: the lower teeth face down and would otherwise mirror the dark floor.
  panel('#fff8ee', 2.4, [12, 2.5], [0, -3.5, 8]);
  // The white sweep below: warm bounce light into the lower teeth.
  panel('#f2eee8', 1.4, [24, 24], [0, -9, 0]);
  const generator = new THREE.PMREMGenerator(renderer);
  const texture = generator.fromScene(room, 0.02).texture;
  generator.dispose();
  room.traverse((object) => {
    if (object instanceof THREE.Mesh) {
      object.geometry.dispose();
      (object.material as THREE.Material).dispose();
    }
  });
  studio?.texture.dispose();
  studio = { texture, renderer };
  return texture;
}

/** Everything the stage changes for one frame, put back afterwards. */
function stage(state: RootState, covered: Set<number>) {
  const { scene, camera, gl } = state;
  const restore: (() => void)[] = [];

  // Close the bite: move the upper mould and upper teeth.
  const upper: THREE.Object3D[] = [];
  scene.traverse((object) => {
    if (object.name === 'top_mould' || /^top_teeth\d{3}$/.test(object.name)) upper.push(object);
  });
  upper.forEach((object) => {
    const scale = object.parent ? object.parent.getWorldScale(new THREE.Vector3()) : new THREE.Vector3(1, 1, 1);
    const offset = BITE.clone().divide(scale);
    const before = object.position.clone();
    object.position.add(offset);
    restore.push(() => object.position.copy(before));
  });

  // Frame the covered teeth (or the front of the set) in a 3:2 shot.
  scene.updateMatrixWorld(true);
  const box = new THREE.Box3();
  scene.traverse((object) => {
    if (!(object instanceof THREE.Mesh)) return;
    const index = toothIndexOf(object.name);
    if (index !== null && (covered.size === 0 || covered.has(index))) box.expandByObject(object);
  });
  if (box.isEmpty()) box.setFromCenterAndSize(MODEL_CENTRE, new THREE.Vector3(3, 1.5, 1));
  const centre = box.getCenter(new THREE.Vector3());
  const size = box.getSize(new THREE.Vector3());
  // The set takes about 70% of the width (or 62% of the height), with mould round it.
  const tan = Math.tan(THREE.MathUtils.degToRad(CAMERA_FOV / 2));
  const aspect = PHOTO_WIDTH / PHOTO_HEIGHT;
  const distance = Math.max(size.x / (2 * tan * aspect * 0.86), (size.y + 0.5) / (2 * tan * 0.7)) + size.z / 2;

  const perspective = camera as THREE.PerspectiveCamera;
  const saved = { position: perspective.position.clone(), quaternion: perspective.quaternion.clone(), fov: perspective.fov, aspect: perspective.aspect };
  perspective.fov = CAMERA_FOV;
  perspective.aspect = aspect;
  perspective.position.copy(centre).addScaledVector(CAMERA_DIRECTION, distance);
  perspective.lookAt(centre);
  perspective.updateProjectionMatrix();
  perspective.updateMatrixWorld();
  restore.push(() => {
    perspective.position.copy(saved.position);
    perspective.quaternion.copy(saved.quaternion);
    perspective.fov = saved.fov;
    perspective.aspect = saved.aspect;
    perspective.updateProjectionMatrix();
    perspective.updateMatrixWorld();
  });

  // Draw at the photo's size (supersampled), then put the canvas back.
  const size2 = gl.getSize(new THREE.Vector2());
  const ratio = gl.getPixelRatio();
  gl.setPixelRatio(SUPERSAMPLE);
  gl.setSize(PHOTO_WIDTH, PHOTO_HEIGHT, false);
  restore.push(() => {
    gl.setPixelRatio(ratio);
    gl.setSize(size2.x, size2.y, false);
  });
  return () => {
    restore.reverse().forEach((undo) => undo());
    scene.updateMatrixWorld(true);
  };
}

function toCanvas(gl: THREE.WebGLRenderer, background: string): HTMLCanvasElement {
  const output = document.createElement('canvas');
  output.width = PHOTO_WIDTH;
  output.height = PHOTO_HEIGHT;
  const context = output.getContext('2d');
  if (!context) throw new Error('Canvas 2D is unavailable');
  context.fillStyle = background;
  context.fillRect(0, 0, PHOTO_WIDTH, PHOTO_HEIGHT);
  context.imageSmoothingQuality = 'high';
  context.drawImage(gl.domElement, 0, 0, PHOTO_WIDTH, PHOTO_HEIGHT);
  return output;
}

export type PhotoStill = {
  /** The still the AI photo starts from (JPEG data URL, 1536×1024). */
  image: string;
  /** Each covered tooth in its own flat colour (PNG data URL, see photoLabels.ts), for the automatic checks. */
  labels: string;
};


/** The photo stage's still and label map for the covered teeth. */
export function capturePhotoStill(state: RootState, coveredTeeth: number[]): PhotoStill {
  const { scene, camera, gl } = state;
  const covered = new Set(coveredTeeth);
  const background = scene.background;
  const environment = scene.environment;
  const intensity = scene.environmentIntensity;
  const exposure = gl.toneMappingExposure;
  const undo = stage(state, covered);
  const moulds = new Map<THREE.MeshStandardMaterial, number>();
  const lights = new Map<THREE.Light, number>();
  let image = '';
  let labels = '';
  try {
    // The still: studio reflections, white background.
    scene.background = new THREE.Color(BACKDROP);
    scene.environment = photoEnvironment(gl);
    scene.environmentIntensity = 1;
    gl.toneMappingExposure = 0.95;
    // The mould is matte stone: under the studio it should read as stone, not glow white.
    scene.traverse((object) => {
      if (!(object instanceof THREE.Mesh) || !(object.material instanceof THREE.MeshStandardMaterial) || object.material.metalness > 0) return;
      const material = object.material;
      if (moulds.has(material)) return;
      moulds.set(material, material.envMapIntensity);
      material.envMapIntensity = 0.1;
    });
    // The scene's direct lights are set for the live view; softer here so the stone keeps its colour.
    scene.traverse((object) => {
      if (!(object instanceof THREE.Light) || lights.has(object)) return;
      lights.set(object, object.intensity);
      object.intensity *= 0.6;
    });
    gl.render(scene, camera);
    image = toCanvas(gl, BACKDROP).toDataURL('image/jpeg', 0.94);

    // The label map: each covered tooth (with its stones and finish) flat, everything else black.
    const originals = new Map<THREE.Mesh, THREE.Material | THREE.Material[]>();
    const flat = new Map<number, THREE.MeshBasicMaterial>();
    const black = new THREE.MeshBasicMaterial({ color: '#000000', toneMapped: false });
    scene.traverse((object) => {
      if (!(object instanceof THREE.Mesh)) return;
      let index: number | null = null;
      for (let node: THREE.Object3D | null = object; node && index === null; node = node.parent) index = toothIndexOf(node.name);
      originals.set(object, object.material);
      if (index === null || !covered.has(index)) {
        object.material = black;
        return;
      }
      if (!flat.has(index)) {
        const [r, g, b] = labelColor(index);
        flat.set(index, new THREE.MeshBasicMaterial({ color: new THREE.Color().setRGB(r / 255, g / 255, b / 255, THREE.SRGBColorSpace), toneMapped: false }));
      }
      object.material = flat.get(index)!;
    });
    scene.background = new THREE.Color('#000000');
    scene.environment = null;
    gl.render(scene, camera);
    const map = toCanvas(gl, '#000000');
    originals.forEach((material, mesh) => {
      mesh.material = material;
    });
    flat.forEach((material) => material.dispose());
    black.dispose();
    labels = map.toDataURL('image/png');
  } finally {
    scene.background = background;
    scene.environment = environment;
    scene.environmentIntensity = intensity;
    gl.toneMappingExposure = exposure;
    moulds.forEach((value, material) => {
      material.envMapIntensity = value;
    });
    lights.forEach((value, light) => {
      light.intensity = value;
    });
    undo();
    gl.render(scene, camera);
  }
  return { image, labels };
}
