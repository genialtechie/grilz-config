import type { RootState } from '@react-three/fiber';

const OUTPUT_SIZE = 1024;
const CAPTURE_PIXELS = 800; // crop resolution before upscaling; keeps the GPU work light on phones
const MAX_BUFFER = 4096;

// Re-renders the current 3D view at high resolution and returns a square JPEG
// crop centred on the model, ready to send to the AI renderer.
export function capturePreview(state: RootState): string {
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
  context.fillStyle = '#ffffff';
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
  gl.render(scene, camera);
  return output.toDataURL('image/jpeg', 0.92);
}
