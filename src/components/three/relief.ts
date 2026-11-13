import * as THREE from 'three';

/**
 * A surface as seen from one direction, for asking "what is in front of this
 * spot?" thousands of times: the same answer as casting a ray along `forward`,
 * without testing every triangle each time. The triangles that face the viewer
 * are flattened onto the plane across the view and sorted into a grid of
 * buckets; a question looks only at the few triangles in one bucket.
 *
 * Positions across the view are (a, b) along `right` and `up` from `origin`;
 * `depth` is the distance towards the viewer along `forward`.
 */
export class Relief {
  private readonly triangles: Float32Array;
  private readonly normals: Float32Array;
  private readonly buckets: number[][];
  private readonly cells = 24;

  /**
   * `sources`: geometries, each with the matrix that places it (or none).
   * `limit`: how far across the view, each way from `origin`, the relief reaches; triangles outside are left out.
   */
  constructor(
    sources: { geometry: THREE.BufferGeometry; matrix?: THREE.Matrix4 }[],
    private readonly origin: THREE.Vector3,
    private readonly right: THREE.Vector3,
    private readonly up: THREE.Vector3,
    private readonly forward: THREE.Vector3,
    private readonly limit: number,
  ) {
    const triangles: number[] = [];
    const normals: number[] = [];
    this.buckets = Array.from({ length: this.cells * this.cells }, () => []);
    const corners = [new THREE.Vector3(), new THREE.Vector3(), new THREE.Vector3()];
    const edge1 = new THREE.Vector3();
    const edge2 = new THREE.Vector3();
    const normal = new THREE.Vector3();
    for (const { geometry, matrix } of sources) {
      const position = geometry.attributes.position as THREE.BufferAttribute;
      const index = geometry.index;
      const count = index ? index.count : position.count;
      for (let i = 0; i < count; i += 3) {
        corners.forEach((corner, k) => {
          corner.fromBufferAttribute(position, index ? index.getX(i + k) : i + k);
          if (matrix) corner.applyMatrix4(matrix);
        });
        normal.crossVectors(edge1.subVectors(corners[1], corners[0]), edge2.subVectors(corners[2], corners[0]));
        // Only what faces the viewer can be in front of anything.
        if (normal.dot(forward) <= 0) continue;
        normal.normalize();
        const flat = corners.flatMap((corner) => {
          const offset = corner.clone().sub(origin);
          return [offset.dot(right), offset.dot(up), offset.dot(forward)];
        });
        const [minA, maxA] = [Math.min(flat[0], flat[3], flat[6]), Math.max(flat[0], flat[3], flat[6])];
        const [minB, maxB] = [Math.min(flat[1], flat[4], flat[7]), Math.max(flat[1], flat[4], flat[7])];
        if (maxA < -limit || minA > limit || maxB < -limit || minB > limit) continue;
        const id = triangles.length / 9;
        triangles.push(...flat);
        normals.push(normal.x, normal.y, normal.z);
        for (let row = this.cell(minB); row <= this.cell(maxB); row += 1) {
          for (let column = this.cell(minA); column <= this.cell(maxA); column += 1) this.buckets[row * this.cells + column].push(id);
        }
      }
    }
    this.triangles = Float32Array.from(triangles);
    this.normals = Float32Array.from(normals);
  }

  private cell(value: number) {
    return THREE.MathUtils.clamp(Math.floor(((value + this.limit) / (2 * this.limit)) * this.cells), 0, this.cells - 1);
  }

  /** The surface nearest the viewer at (a, b): how far forward it is and which way it faces, or null if nothing is there. */
  at(a: number, b: number): { depth: number; normal: THREE.Vector3 } | null {
    if (Math.abs(a) > this.limit || Math.abs(b) > this.limit) return null;
    const t = this.triangles;
    let best = -Infinity;
    let found = -1;
    for (const id of this.buckets[this.cell(b) * this.cells + this.cell(a)]) {
      const o = id * 9;
      const [ax, ay, bx, by, cx, cy] = [t[o], t[o + 1], t[o + 3], t[o + 4], t[o + 6], t[o + 7]];
      const area = (bx - ax) * (cy - ay) - (cx - ax) * (by - ay);
      if (Math.abs(area) < 1e-18) continue;
      // Where (a, b) sits in the triangle; a hair of slack so a spot exactly on a shared edge belongs to one side.
      const w1 = ((a - ax) * (cy - ay) - (cx - ax) * (b - ay)) / area;
      const w2 = ((bx - ax) * (b - ay) - (a - ax) * (by - ay)) / area;
      if (w1 < -1e-6 || w2 < -1e-6 || w1 + w2 > 1 + 1e-6) continue;
      const depth = t[o + 2] + w1 * (t[o + 5] - t[o + 2]) + w2 * (t[o + 8] - t[o + 2]);
      if (depth > best) {
        best = depth;
        found = id;
      }
    }
    return found < 0 ? null : { depth: best, normal: new THREE.Vector3(this.normals[found * 3], this.normals[found * 3 + 1], this.normals[found * 3 + 2]) };
  }

  /** The point in space at (a, b) and `depth`. */
  point(a: number, b: number, depth: number) {
    return this.origin.clone().addScaledVector(this.right, a).addScaledVector(this.up, b).addScaledVector(this.forward, depth);
  }
}
