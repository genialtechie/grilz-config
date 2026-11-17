import { useMemo } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { CAP_LAYER, GLOW_LAYER } from './redesign/glow';

/**
 * Draws the frame itself while a glow is showing: the scene as usual, then the caps' depth alone, then
 * the glow shells over it. So the glow is hidden by the teeth but shows through the clear holder.
 * Mounted only while some tooth glows; R3F draws on its own again once it unmounts.
 */
export function GlowPass() {
  const depthOnly = useMemo(() => new THREE.MeshBasicMaterial({ colorWrite: false }), []);
  useFrame(({ gl, scene, camera }) => {
    gl.autoClear = true;
    gl.render(scene, camera);
    const background = scene.background;
    scene.background = null;
    gl.autoClear = false;
    gl.clearDepth();
    camera.layers.set(CAP_LAYER);
    scene.overrideMaterial = depthOnly;
    gl.render(scene, camera);
    scene.overrideMaterial = null;
    camera.layers.set(GLOW_LAYER);
    gl.render(scene, camera);
    camera.layers.set(0);
    gl.autoClear = true;
    scene.background = background;
  }, 1);
  return null;
}
