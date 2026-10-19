import { describe, expect, it } from 'vitest';
import * as THREE from 'three';
import { captureSide, fitDistance, MODEL_SIZE, withCaptureFraming } from '../framing';

describe('framing', () => {
  const camera = () => new THREE.PerspectiveCamera(44, 1, 0.1, 100);

  it('fits the model inside the canvas on phones and wide screens', () => {
    const tan = Math.tan(THREE.MathUtils.degToRad(22));
    for (const [width, height] of [[390, 300], [1000, 800], [390, 700]]) {
      const distance = fitDistance(camera(), width, height, 0.82);
      // At the model's centre plane it never takes more than the asked share of either side.
      const visibleHeight = 2 * distance * tan;
      expect(MODEL_SIZE.height / visibleHeight).toBeLessThanOrEqual(0.82);
      expect(MODEL_SIZE.width / (visibleHeight * (width / height))).toBeLessThanOrEqual(0.82);
    }
  });

  it('captures from the original framing and gives the camera back', () => {
    const cam = camera();
    cam.position.set(1.2, 0.4, 3.1);
    cam.lookAt(0.3, 0.2, 0);
    const before = cam.position.clone();
    const seen = withCaptureFraming(cam, () => cam.position.length());
    expect(seen).toBeCloseTo(10, 5);
    expect(cam.position.equals(before)).toBe(true);
  });

  it('crops the same square as before', () => {
    expect(captureSide(390, 235)).toBeCloseTo(145.7, 1);
    expect(captureSide(1000, 800)).toBeCloseTo(496, 1);
  });
});
