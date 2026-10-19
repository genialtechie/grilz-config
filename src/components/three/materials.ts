import * as THREE from 'three';
import type { MetalId } from '../../lib/renderSpec';

// Physically based metal colours (sRGB base colour at metalness 1). The UI
// swatches are flat paint colours tuned for small chips; as metal they read
// olive and flat, so the 3D view uses measured reflectance instead.
const METAL_BASE: Record<MetalId, string> = {
  yellow: '#f0c46a',
  white: '#e4e3df',
  rose: '#efb59c',
  silver: '#f2f1ee',
  platinum: '#d8d7d4',
};

/** A mirror-polished metal: mostly dark, with sharp bright reflections of the studio lights. */
export function polishedMetal(metal: MetalId) {
  return new THREE.MeshPhysicalMaterial({
    color: METAL_BASE[metal],
    metalness: 1,
    roughness: metal === 'silver' || metal === 'platinum' ? 0.07 : 0.09,
    envMapIntensity: 1.25,
  });
}

/** The metal under a pavé setting: the same alloy, a touch rougher so the stones lead. */
export function settingMetal(metal: MetalId) {
  const material = polishedMetal(metal);
  material.roughness = 0.22;
  material.envMapIntensity = 0.9;
  return material;
}

/** Fine plaster grain for the dental-stone mould (a small tiling bump texture, made once). */
let grain: THREE.CanvasTexture | null = null;
function plasterGrain() {
  if (grain || typeof document === 'undefined') return grain;
  const size = 128;
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const context = canvas.getContext('2d');
  if (!context) return null;
  const image = context.createImageData(size, size);
  for (let i = 0; i < size * size; i += 1) {
    const value = 118 + Math.random() * 20;
    image.data.set([value, value, value, 255], i * 4);
  }
  context.putImageData(image, 0, 0);
  grain = new THREE.CanvasTexture(canvas);
  grain.wrapS = THREE.RepeatWrapping;
  grain.wrapT = THREE.RepeatWrapping;
  grain.repeat.set(6, 6);
  return grain;
}

/** Dental stone, the pale mint a jeweler's model is cast in. The bare teeth are the same stone. */
export function dentalStone() {
  return new THREE.MeshStandardMaterial({
    color: '#d6e6df',
    roughness: 0.92,
    metalness: 0,
    bumpMap: plasterGrain(),
    bumpScale: 0.6,
    envMapIntensity: 0.55,
  });
}

/**
 * Pavé stones: mirror facets with a little icy body. Each facet reflects a
 * different part of the studio, so a stone is a mosaic of hard white and dark
 * facets that changes as the set turns, which is how diamonds read in photos.
 * No transmission pass, so it stays cheap on phones.
 */
export function stoneMaterial() {
  return new THREE.MeshStandardMaterial({
    color: '#ffffff',
    metalness: 0.55,
    roughness: 0.02,
    envMapIntensity: 3.6,
    flatShading: true,
  });
}
