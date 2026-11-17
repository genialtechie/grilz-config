import * as THREE from 'three';

// The picked teeth's amber glow (the Grill Creator Lab's 40-scene.js): a soft shell just outside the
// cap, brightest at its edges, breathing slowly. It lives on its own layer and is drawn in a pass of
// its own after the scene (GlowPass), hidden only by the caps, never by the clear holder: "drawn above
// the gums", as the owner asked on Nov 16.

/** The layer the caps' depth is drawn on for the glow pass. */
export const CAP_LAYER = 1;
/** The layer the glow shells live on. */
export const GLOW_LAYER = 2;

export function glowMaterial() {
  return new THREE.ShaderMaterial({
    uniforms: { t: { value: 0 } },
    transparent: true,
    depthWrite: false,
    side: THREE.BackSide,
    vertexShader:
      'uniform float t; varying float vF; void main() { float pulse = 0.5 + 0.5 * sin(t * 0.005); vec3 p = position + normal * (0.034 + 0.01 * pulse); vec4 mv = modelViewMatrix * vec4(p, 1.0); vec3 n = normalize(normalMatrix * normal); vF = 1.0 - abs(dot(n, normalize(-mv.xyz))); gl_Position = projectionMatrix * mv; }',
    fragmentShader:
      'uniform float t; varying float vF; void main() { float pulse = 0.5 + 0.5 * sin(t * 0.005); float a = clamp((0.55 + 0.3 * pulse) * (0.45 + 0.8 * vF), 0.0, 0.92); gl_FragColor = vec4(vec3(0.98, 0.66, 0.12), a); }',
  });
}

/** How far a picked tooth lifts out of the arch (stage units, as the lab: 1.3 mm). */
export const LIFT = 1.3;
