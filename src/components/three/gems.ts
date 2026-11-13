import * as THREE from 'three';

// Diamonds, drawn the way the best web jewelry renderers do it: light is
// followed through each stone. A ray from the eye refracts in through a crown
// facet, bounces off the pavilion by total internal reflection, and refracts
// back out through the crown, split into colour (fire). What comes out is the
// stone's own lighting rig seen through that path, so every facet shows a
// different piece of it: the hard white-and-dark mosaic that reads as diamond,
// changing as the set turns.
//
// A brilliant cut is a convex solid, so it is exactly the space inside its 57
// facet planes. The shader finds where a ray leaves by testing those planes,
// with no textures and no acceleration structure, and the stones are instanced:
// thousands share one small mesh and one material.
//
// Stones get their own lights, not the metal's light tent. A tent makes a
// diamond flat and milky; sparkle and fire need dark surroundings with small
// hard lights. The rig below is written in the shader (no environment map),
// fixed in the world like the tent, so stones flash as the camera moves.

/** One facet plane of the unit stone (girdle radius 1, girdle at y = 0, table up): normal and offset. */
type Plane = { normal: THREE.Vector3; offset: number };

const RAD = Math.PI / 180;

// Tolkowsky-style proportions of a round brilliant, as shares of the girdle radius.
const TABLE = 0.56;
const CROWN_ANGLE = 34.5 * RAD;
const PAVILION_ANGLE = 40.75 * RAD;
const LOWER_GIRDLE_ANGLE = 42.3 * RAD;
const CROWN_HEIGHT = (1 - TABLE) * Math.tan(CROWN_ANGLE);
/** How far down the ridge between two bezel facets the star facets reach (0 at the table, 1 at the girdle). */
const STAR_REACH = 0.5;

/** A facet at `tilt` to the girdle plane, facing `azimuth`, through `point`; `down` for the pavilion. */
function facet(azimuth: number, tilt: number, point: THREE.Vector3, down = false): Plane {
  const normal = new THREE.Vector3(Math.sin(tilt) * Math.cos(azimuth), (down ? -1 : 1) * Math.cos(tilt), Math.sin(tilt) * Math.sin(azimuth));
  return { normal, offset: normal.dot(point) };
}

const onGirdle = (azimuth: number) => new THREE.Vector3(Math.cos(azimuth), 0, Math.sin(azimuth));

/** The 57 facets of a round brilliant: table, 8 bezels, 8 stars, 16 upper girdle; 8 pavilion mains, 16 lower girdle. */
function brilliantPlanes(): { crown: Plane[]; pavilion: Plane[] } {
  const crown: Plane[] = [{ normal: new THREE.Vector3(0, 1, 0), offset: CROWN_HEIGHT }];
  const pavilion: Plane[] = [];
  const step = Math.PI / 4;
  const half = step / 2;
  const quarter = step / 4;
  // Where a star's lower point sits: on the ridge between two bezels, half way down it.
  const apothem = TABLE * Math.cos(half);
  const ridge = apothem + STAR_REACH * (1 - apothem);
  const ridgeHeight = Math.tan(CROWN_ANGLE) * (1 - ridge * Math.cos(half));
  const starTilt = Math.atan((CROWN_HEIGHT - ridgeHeight) / (ridge - apothem));
  const upperGirdleTilt = Math.atan(ridgeHeight / (1 - ridge * Math.cos(quarter)));
  const culet = new THREE.Vector3(0, -Math.tan(PAVILION_ANGLE), 0);
  for (let k = 0; k < 8; k += 1) {
    const azimuth = k * step;
    crown.push(facet(azimuth, CROWN_ANGLE, onGirdle(azimuth)));
    crown.push(facet(azimuth + half, starTilt, new THREE.Vector3(Math.cos(azimuth + half) * apothem, CROWN_HEIGHT, Math.sin(azimuth + half) * apothem)));
    crown.push(facet(azimuth + quarter, upperGirdleTilt, onGirdle(azimuth + quarter)));
    crown.push(facet(azimuth - quarter, upperGirdleTilt, onGirdle(azimuth - quarter)));
    pavilion.push(facet(azimuth, PAVILION_ANGLE, culet, true));
    pavilion.push(facet(azimuth + quarter, LOWER_GIRDLE_ANGLE, onGirdle(azimuth + quarter), true));
    pavilion.push(facet(azimuth - quarter, LOWER_GIRDLE_ANGLE, onGirdle(azimuth - quarter), true));
  }
  return { crown, pavilion };
}

const PLANES = brilliantPlanes();
const ALL_PLANES = [...PLANES.crown, ...PLANES.pavilion];

/** One facet as a polygon: a big square on its plane, cut down by every other plane. */
function facetPolygon(plane: Plane, others: Plane[]): THREE.Vector3[] {
  const u = new THREE.Vector3().crossVectors(plane.normal, Math.abs(plane.normal.y) > 0.9 ? new THREE.Vector3(1, 0, 0) : new THREE.Vector3(0, 1, 0)).normalize();
  const v = new THREE.Vector3().crossVectors(plane.normal, u);
  const centre = plane.normal.clone().multiplyScalar(plane.offset);
  let polygon = [[-4, -4], [4, -4], [4, 4], [-4, 4]].map(([a, b]) => centre.clone().addScaledVector(u, a).addScaledVector(v, b));
  for (const other of others) {
    if (other === plane || !polygon.length) continue;
    const next: THREE.Vector3[] = [];
    polygon.forEach((point, i) => {
      const previous = polygon[(i + polygon.length - 1) % polygon.length];
      const a = other.normal.dot(previous) - other.offset;
      const b = other.normal.dot(point) - other.offset;
      if ((a <= 0) !== (b <= 0)) next.push(previous.clone().lerp(point, a / (a - b)));
      if (b <= 0) next.push(point);
    });
    polygon = next;
  }
  // Several facets meet at each corner, so the cuts leave points stacked on one another: keep one of each.
  return polygon.filter((point, i) => point.distanceTo(polygon[(i + polygon.length - 1) % polygon.length]) > 1e-4);
}

let crown: THREE.BufferGeometry | null = null;
/**
 * The part of a stone that shows above its setting: the crown, one flat
 * polygon per facet. The pavilion is inside the metal; the shader knows its
 * planes but nothing draws them.
 */
export function crownGeometry(): THREE.BufferGeometry {
  if (crown) return crown;
  const positions: number[] = [];
  const normals: number[] = [];
  for (const plane of PLANES.crown) {
    const polygon = facetPolygon(plane, ALL_PLANES);
    // Wind each triangle so it faces out of the stone.
    for (let i = 1; i + 1 < polygon.length; i += 1) {
      const [a, b, c] = [polygon[0], polygon[i], polygon[i + 1]];
      const outward = new THREE.Vector3().subVectors(b, a).cross(new THREE.Vector3().subVectors(c, a)).dot(plane.normal) > 0;
      for (const point of outward ? [a, b, c] : [a, c, b]) {
        positions.push(point.x, point.y, point.z);
        normals.push(plane.normal.x, plane.normal.y, plane.normal.z);
      }
    }
  }
  crown = new THREE.BufferGeometry();
  crown.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  crown.setAttribute('normal', new THREE.Float32BufferAttribute(normals, 3));
  crown.computeBoundingSphere();
  return crown;
}

// ---------- The stones' lights ----------

/**
 * Small hard lights round the front of the set, in world space: [direction, brightness].
 * Spread unevenly on purpose, so no two stones catch them the same way.
 */
const SPOTS: [THREE.Vector3, number][] = (
  [
    [0.05, 0.62, 0.78, 30], [-0.52, 0.38, 0.76, 24], [0.6, 0.3, 0.74, 26], [-0.2, 0.12, 0.97, 18],
    [0.28, -0.1, 0.95, 16], [-0.78, 0.05, 0.62, 22], [0.82, -0.02, 0.57, 20], [0.1, 0.9, 0.42, 28],
    [-0.4, 0.75, 0.52, 22], [0.45, 0.7, 0.55, 24], [-0.15, -0.42, 0.9, 12], [0.55, -0.38, 0.74, 12],
    [-0.62, -0.3, 0.72, 12], [-0.95, 0.3, 0.1, 18], [0.95, 0.25, 0.15, 18], [0, 0.35, 0.94, 14],
  ] as const
).map(([x, y, z, brightness]) => [new THREE.Vector3(x, y, z).normalize(), brightness]);

/** GLSL for the rig: soft light from above and in front, a dark floor, and the hard spots. */
const LIGHTS_GLSL = /* glsl */ `
  const int SPOT_COUNT = ${SPOTS.length};
  uniform vec4 uSpots[SPOT_COUNT];

  vec3 gemLight(vec3 direction) {
    // A studio of light panels with dimmer gaps between them, a dark floor and a dim band
    // at eye level. Each facet shows a different piece of it, so neighbouring facets land
    // on a panel and on a gap: the hard light-and-dark pattern of a cut stone.
    float around = atan(direction.x, direction.z);
    float panels = smoothstep(0.1, 0.17, abs(fract(around * 1.55 + 0.5) - 0.5));
    float height = smoothstep(-0.32, -0.05, direction.y) * (1.0 - 0.7 * smoothstep(0.08, 0.0, abs(direction.y - 0.52) - 0.04));
    float room = mix(0.03, 1.3, max(panels, 0.22) * height);
    // One broad soft box, up and in front: the stone's overall brightness.
    float soft = 1.6 * smoothstep(0.76, 0.92, dot(direction, normalize(vec3(0.0, 0.62, 0.78))));
    float spots = 0.0;
    for (int i = 0; i < SPOT_COUNT; i++) spots += uSpots[i].w * smoothstep(0.994, 0.9985, dot(direction, uSpots[i].xyz));
    return vec3(room + soft) * vec3(0.97, 0.985, 1.0) + vec3(spots);
  }
`;

const spotUniform = () => ({ value: SPOTS.map(([direction, brightness]) => new THREE.Vector4(direction.x, direction.y, direction.z, brightness)) });

// ---------- The stone material ----------

export type GemKind = 'diamond' | 'moissanite';

/**
 * Refractive index and how far apart it splits red from blue (moissanite bends and splits light
 * more: more fire). The split is about twice life size, so fire shows on stones a few pixels wide.
 */
const OPTICS: Record<GemKind, { ior: number; dispersion: number }> = {
  diamond: { ior: 2.417, dispersion: 0.05 },
  moissanite: { ior: 2.65, dispersion: 0.12 },
};

const INTERNAL_BOUNCES = 4;

let glint: THREE.ShaderMaterial | null = null;

const gems = new Map<string, THREE.ShaderMaterial>();

// A graphics driver that can't build the stone shader would leave iced teeth bare. If that
// happens the stones fall back to a plain material: flat mirror facets, no light path.
let unsupported = false;
let plain: THREE.MeshStandardMaterial | null = null;
const plainStone = () => (plain ??= new THREE.MeshStandardMaterial({ color: '#ffffff', metalness: 0.55, roughness: 0.02, envMapIntensity: 3.6, flatShading: true }));

/** Whether this device draws traced stones: 'pending' until the shader has been built once. */
export function gemSupport(renderer: THREE.WebGLRenderer): 'ok' | 'unsupported' | 'pending' {
  if (unsupported) return 'unsupported';
  let built = false;
  for (const material of [...gems.values(), ...(glint ? [glint] : [])]) {
    const program = (renderer.properties.get(material) as { currentProgram?: { diagnostics?: { runnable: boolean } } }).currentProgram;
    if (!program) continue;
    built = true;
    if (program.diagnostics && !program.diagnostics.runnable) unsupported = true;
  }
  return unsupported ? 'unsupported' : built ? 'ok' : 'pending';
}

/** True once the stone shader has failed on this device: no glints, plain stones. */
export const gemsUnsupported = () => unsupported;

/**
 * The material for stones set in `seat` (the metal's colour: light that leaves
 * through the pavilion comes back off the setting, tinted by it). Shared by
 * every stone of that kind in that metal.
 */
export function gemMaterial(kind: GemKind, seat: THREE.ColorRepresentation): THREE.Material {
  if (unsupported) return plainStone();
  const seatColour = new THREE.Color(seat);
  const key = `${kind}:${seatColour.getHexString()}`;
  const cached = gems.get(key);
  if (cached) return cached;
  const material = new THREE.ShaderMaterial({
    uniforms: {
      uPlanes: { value: ALL_PLANES.map((plane) => new THREE.Vector4(plane.normal.x, plane.normal.y, plane.normal.z, plane.offset)) },
      uSpots: spotUniform(),
      uIor: { value: OPTICS[kind].ior },
      uDispersion: { value: OPTICS[kind].dispersion },
      uSeat: { value: seatColour },
    },
    vertexShader: /* glsl */ `
      varying vec3 vLocal;
      varying vec3 vNormal;
      varying vec3 vEye;
      varying vec3 vTint;
      varying mat3 vToWorld;

      void main() {
        mat4 world = modelMatrix * instanceMatrix;
        mat3 linear = mat3(world);
        // Stones are only turned and scaled evenly, so the inverse is the transpose over the scale squared.
        mat3 inverseLinear = transpose(linear) / dot(linear[0], linear[0]);
        vLocal = position;
        vNormal = normal;
        vEye = inverseLinear * (cameraPosition - world[3].xyz);
        vToWorld = linear / length(linear[0]);
        #ifdef USE_INSTANCING_COLOR
          vTint = instanceColor;
        #else
          vTint = vec3(1.0);
        #endif
        gl_Position = projectionMatrix * viewMatrix * world * vec4(position, 1.0);
      }
    `,
    fragmentShader: /* glsl */ `
      const int PLANE_COUNT = ${ALL_PLANES.length};
      uniform vec4 uPlanes[PLANE_COUNT];
      uniform float uIor;
      uniform float uDispersion;
      uniform vec3 uSeat;
      varying vec3 vLocal;
      varying vec3 vNormal;
      varying vec3 vEye;
      varying vec3 vTint;
      varying mat3 vToWorld;
      ${LIGHTS_GLSL}

      // What a ray leaving the stone sees. The viewer blocks the light from their own direction
      // (the dark centre a jeweler calls head shadow), which is where a diamond's contrast comes from.
      vec3 seen(vec3 direction, vec3 toEye) {
        vec3 world = normalize(vToWorld * direction);
        return gemLight(world) * smoothstep(0.992, 0.97, dot(world, toEye));
      }

      float fresnel(float cosine, float f0) {
        return f0 + (1.0 - f0) * pow(1.0 - clamp(cosine, 0.0, 1.0), 5.0);
      }

      void main() {
        vec3 normal = normalize(vNormal);
        vec3 ray = normalize(vLocal - vEye);
        vec3 toEye = normalize(vToWorld * -ray);
        float f0 = pow((uIor - 1.0) / (uIor + 1.0), 2.0);

        // Off the surface.
        float mirror = fresnel(-dot(ray, normal), f0);
        vec3 colour = mirror * seen(reflect(ray, normal), toEye);

        // Into the stone, and round inside it.
        vec3 origin = vLocal;
        vec3 direction = refract(ray, normal, 1.0 / uIor);
        vec3 carried = vec3(1.0 - mirror) * vTint;
        for (int bounce = 0; bounce < ${INTERNAL_BOUNCES}; bounce++) {
          float nearest = 1e6;
          vec3 wall = vec3(0.0, 1.0, 0.0);
          for (int i = 0; i < PLANE_COUNT; i++) {
            float along = dot(direction, uPlanes[i].xyz);
            if (along > 1e-4) {
              float distance = (uPlanes[i].w - dot(origin, uPlanes[i].xyz)) / along;
              if (distance < nearest) {
                nearest = distance;
                wall = uPlanes[i].xyz;
              }
            }
          }
          origin += direction * nearest;
          float cosine = dot(direction, wall);
          float sineOut = uIor * uIor * (1.0 - cosine * cosine);
          if (sineOut < 1.0) {
            // Steep enough to get out: some light leaves here, the rest carries on inside.
            float kept = fresnel(sqrt(1.0 - sineOut), f0);
            vec3 leaving;
            if (wall.y < 0.0) {
              // Out through the back, into the setting: a dim return off the metal.
              leaving = uSeat * 0.16;
            } else {
              // Out through the crown, each colour bent a little differently: fire.
              vec3 red = refract(direction, -wall, uIor - uDispersion);
              vec3 green = refract(direction, -wall, uIor);
              vec3 blue = refract(direction, -wall, uIor + uDispersion);
              if (dot(red, red) < 0.5) red = green;
              if (dot(blue, blue) < 0.5) blue = green;
              leaving = vec3(seen(red, toEye).r, seen(green, toEye).g, seen(blue, toEye).b);
            }
            colour += carried * (1.0 - kept) * leaving;
            carried *= kept;
          }
          direction = reflect(direction, wall);
        }
        // Whatever is still inside after the last bounce: a little of the room.
        colour += carried * 0.25 * seen(direction, toEye);

        gl_FragColor = vec4(colour, 1.0);
        #include <tonemapping_fragment>
        #include <colorspace_fragment>
      }
    `,
  });
  gems.set(key, material);
  return material;
}

// ---------- Glints ----------

let glintQuad: THREE.BufferGeometry | null = null;

/** A unit square for one glint (the shader turns it to face the camera). */
export function glintGeometry(): THREE.BufferGeometry {
  glintQuad ??= new THREE.PlaneGeometry(2, 2);
  return glintQuad;
}

/**
 * The flash when a facet throws one of the hard lights straight at the eye: a
 * small four-point star over the stone, there one moment and gone the next as
 * the set turns. Drawn over the stones and added to them. Each stone gets a
 * few made-up facet directions (from `seed`) and flashes when one of them
 * mirrors a light into the camera; most stones are dark most of the time.
 */
export function glintMaterial(): THREE.ShaderMaterial {
  if (glint) return glint;
  glint = new THREE.ShaderMaterial({
    uniforms: { uSpots: spotUniform() },
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
    vertexShader: /* glsl */ `
      const int SPOT_COUNT = ${SPOTS.length};
      uniform vec4 uSpots[SPOT_COUNT];
      attribute float seed;
      varying vec2 vOffset;
      varying float vFlash;

      float hash(float n) {
        return fract(sin(n * 127.1) * 43758.5453);
      }

      void main() {
        mat4 world = modelMatrix * instanceMatrix;
        vec3 centre = world[3].xyz;
        float radius = length(world[0].xyz);
        vec3 axis = normalize(world[1].xyz);
        vec3 toEye = normalize(cameraPosition - centre);
        vec3 side = normalize(cross(axis, vec3(0.31, 0.95, 0.17)));
        vec3 other = cross(axis, side);

        float flash = 0.0;
        for (int k = 0; k < 3; k++) {
          float turn = hash(seed + float(k) * 3.7) * 6.2832;
          float lean = mix(0.12, 0.62, hash(seed + float(k) * 9.1 + 5.0));
          vec3 facet = normalize(axis + lean * (cos(turn) * side + sin(turn) * other));
          vec3 mirrored = reflect(-toEye, facet);
          for (int i = 0; i < SPOT_COUNT; i++) {
            flash = max(flash, uSpots[i].w / 30.0 * pow(max(dot(mirrored, uSpots[i].xyz), 0.0), 900.0));
          }
        }
        // Only stones turned towards the viewer flash.
        flash *= smoothstep(0.15, 0.45, dot(axis, toEye));
        vFlash = flash;
        vOffset = position.xy;
        vec4 view = viewMatrix * vec4(centre + axis * radius * 0.3, 1.0);
        view.xy += position.xy * radius * (1.5 + 3.5 * flash) * step(0.04, flash);
        gl_Position = projectionMatrix * view;
      }
    `,
    fragmentShader: /* glsl */ `
      varying vec2 vOffset;
      varying float vFlash;

      void main() {
        float distance = length(vOffset);
        float core = exp(-distance * distance * 26.0);
        float rays = exp(-abs(vOffset.x) * 26.0) * exp(-abs(vOffset.y) * 3.2) + exp(-abs(vOffset.y) * 26.0) * exp(-abs(vOffset.x) * 3.2);
        float glow = (core * 1.6 + rays * 0.75) * vFlash * smoothstep(1.0, 0.7, distance);
        gl_FragColor = vec4(vec3(glow), glow);
        #include <tonemapping_fragment>
        #include <colorspace_fragment>
      }
    `,
  });
  return glint;
}
