import * as THREE from 'three';
import type { Spot } from './sculpt';

// Sparkle (a port of the glints in docs/redesign/prototype/src/40-scene.js):
// small star glints that light up on the stones facing one of a few fixed
// lights, and move as the piece turns. One draw call for the whole piece: up to
// GMAX points, a dozen or so stones per tooth, placed in the world each frame.
//
// The points are named "stone_glints": captures and masks leave them out (they
// are flashes of light, not part of a tooth's shape).

export const GLINTS = 'stone_glints';
const GMAX = 420;
const LIGHTS = [new THREE.Vector3(0.3, 0.85, 0.45), new THREE.Vector3(-0.65, 0.5, 0.58), new THREE.Vector3(0.72, 0.2, 0.66), new THREE.Vector3(0, 0.15, 1)].map((v) => v.normalize());

let texture: THREE.Texture | null = null;
/** A soft star: a round glow with two thin crossed rays. */
function glintTexture() {
  if (texture) return texture;
  const c = document.createElement('canvas');
  c.width = c.height = 64;
  const x = c.getContext('2d')!;
  const g = x.createRadialGradient(32, 32, 0, 32, 32, 30);
  g.addColorStop(0, 'rgba(255,255,255,1)');
  g.addColorStop(0.18, 'rgba(255,255,255,.55)');
  g.addColorStop(1, 'rgba(255,255,255,0)');
  x.fillStyle = g;
  x.fillRect(0, 0, 64, 64);
  x.globalCompositeOperation = 'lighter';
  [0, Math.PI / 2].forEach((a) => {
    x.save();
    x.translate(32, 32);
    x.rotate(a);
    const l = x.createLinearGradient(-32, 0, 32, 0);
    l.addColorStop(0, 'rgba(255,255,255,0)');
    l.addColorStop(0.5, 'rgba(255,255,255,.95)');
    l.addColorStop(1, 'rgba(255,255,255,0)');
    x.fillStyle = l;
    x.fillRect(-32, -1.1, 64, 2.2);
    x.restore();
  });
  texture = new THREE.CanvasTexture(c);
  return texture;
}

export type GlintSource = { cap: THREE.Object3D; spots: Spot[]; order: number };

export class Glints {
  readonly points: THREE.Points;
  private readonly pos = new Float32Array(GMAX * 3);
  private readonly alpha = new Float32Array(GMAX);
  private readonly geometry = new THREE.BufferGeometry();
  private readonly material: THREE.ShaderMaterial;
  private list: { cap: THREE.Object3D; spot: Spot }[] = [];
  private readonly p = new THREE.Vector3();
  private readonly n = new THREE.Vector3();
  private readonly v = new THREE.Vector3();
  private readonly r = new THREE.Vector3();
  private readonly m3 = new THREE.Matrix3();

  /** `lift`: how far a glint stands off its stone, in world units. */
  constructor(private readonly lift: number) {
    this.geometry.setAttribute('position', new THREE.BufferAttribute(this.pos, 3));
    this.geometry.setAttribute('aAlpha', new THREE.BufferAttribute(this.alpha, 1));
    this.geometry.setDrawRange(0, 0);
    this.material = new THREE.ShaderMaterial({
      uniforms: { map: { value: glintTexture() }, uSize: { value: 30 } },
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
      vertexShader:
        'attribute float aAlpha; varying float vA; uniform float uSize; void main() { vA = aAlpha; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); gl_PointSize = uSize * (0.3 + aAlpha); }',
      fragmentShader: 'uniform sampler2D map; varying float vA; void main() { vec4 c = texture2D(map, gl_PointCoord); gl_FragColor = vec4(c.rgb * vA * 1.5, c.a * vA); }',
    });
    this.points = new THREE.Points(this.geometry, this.material);
    this.points.name = GLINTS;
    this.points.frustumCulled = false;
    this.points.renderOrder = 9;
    this.points.raycast = () => {};
  }

  /** Which stones carry a glint: about a dozen per tooth, spread over its face. */
  collect(sources: GlintSource[]) {
    this.list = [];
    sources.forEach(({ cap, spots, order }) => {
      if (!spots.length) return;
      const step = Math.max(1, Math.floor(spots.length / 13));
      for (let q = order % step; q < spots.length && this.list.length < GMAX; q += step) this.list.push({ cap, spot: spots[q] });
    });
    this.geometry.setDrawRange(0, this.list.length);
  }

  /** Places the glints for this frame: bright where a stone mirrors one of the lights into the camera. */
  update(camera: THREE.Camera, pixelRatio: number) {
    this.material.uniforms.uSize.value = 30 * pixelRatio;
    if (!this.list.length) return;
    const { p, n, v, r, m3 } = this;
    for (let k = 0; k < this.list.length; k++) {
      const { cap, spot } = this.list[k];
      const mw = cap.matrixWorld;
      p.copy(spot.p).applyMatrix4(mw);
      n.copy(spot.n).applyMatrix3(m3.setFromMatrix4(mw)).normalize();
      v.copy(camera.position).sub(p).normalize();
      const nv = n.dot(v);
      let a = 0;
      if (nv > 0.05) {
        r.copy(n).multiplyScalar(2 * nv).sub(v);
        for (let l = 0; l < LIGHTS.length; l++) a += Math.pow(Math.max(0, r.dot(LIGHTS[l])), 220);
      }
      p.addScaledVector(n, this.lift);
      this.pos[k * 3] = p.x;
      this.pos[k * 3 + 1] = p.y;
      this.pos[k * 3 + 2] = p.z;
      this.alpha[k] = Math.min(1, a * 1.3);
    }
    this.geometry.attributes.position.needsUpdate = true;
    this.geometry.attributes.aAlpha.needsUpdate = true;
  }

  dispose() {
    this.geometry.dispose();
    this.material.dispose();
  }
}
