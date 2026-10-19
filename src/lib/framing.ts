import * as THREE from 'three';

// How the 3D set is framed: the viewer fills the screen with it, and the AI
// capture always uses one standard framing whatever the viewer is zoomed to.
// Sizes are the dental model's (both moulds) at the scene's scale.

export const MODEL_SIZE = { width: 4.3, height: 3.4 };
/** How far the front teeth stand in front of the model's centre (they render biggest). */
const FRONT_DEPTH = 1.4;
export const MODEL_CENTRE = new THREE.Vector3(0, 0, 0);

/**
 * Camera distance at which the model takes up `fraction` of the canvas along
 * whichever axis runs out first (width on phones, height on wide screens).
 */
export function fitDistance(camera: THREE.PerspectiveCamera, width: number, height: number, fraction: number) {
  const tan = Math.tan(THREE.MathUtils.degToRad(camera.fov / 2));
  const aspect = width / Math.max(1, height);
  const forHeight = MODEL_SIZE.height / (2 * tan * fraction);
  const forWidth = MODEL_SIZE.width / (2 * tan * aspect * fraction);
  return Math.max(forHeight, forWidth) + FRONT_DEPTH;
}

/** The viewer's resting distance: the set fills most of the canvas. */
export const VIEW_FRACTION = 0.82;

/**
 * The capture framing is the builder's original one (camera 10 units out, the
 * crop below), so the AI photo starts from the same composition it was tuned
 * on, whatever the viewer is zoomed to.
 */
const CAPTURE_DISTANCE = 10;

/** The square the capture crops from the middle of the canvas. */
export const captureSide = (width: number, height: number) => Math.min(height * 0.62, width * 0.95);

/** Runs `draw` with the camera at the capture framing (the customer's angle kept), then puts it back. */
export function withCaptureFraming<T>(camera: THREE.Camera, draw: () => T): T {
  const position = camera.position.clone();
  const quaternion = camera.quaternion.clone();
  const direction = camera.getWorldDirection(new THREE.Vector3());
  camera.position.copy(MODEL_CENTRE).addScaledVector(direction, -CAPTURE_DISTANCE);
  camera.lookAt(MODEL_CENTRE);
  camera.updateMatrixWorld();
  try {
    return draw();
  } finally {
    camera.position.copy(position);
    camera.quaternion.copy(quaternion);
    camera.updateMatrixWorld();
  }
}
