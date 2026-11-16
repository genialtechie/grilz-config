import * as THREE from 'three';
import { TOOTH_DATA, type ToothKind } from './toothData';

// The teeth, sculpted (a port of docs/redesign/prototype/src/30-sculpt.js, the
// approved prototype). Each tooth is stored as a coarse cage (toothData.ts) and
// smoothed here into one soft, continuous surface. Caps, panels, rims, open-face
// masks and stone layouts are all laid out on a height map of each tooth's
// lip-side face, so they follow whatever shape the tooth has.
//
// Units: the maths is in millimetres; geometry comes out in "stage units" (MM
// per millimetre), the prototype's own, so the finish shaders, which read the
// geometry's own positions, draw at the approved scale. The model scales the
// whole piece up to the scene's size (see piece.ts).
//
// Everything is worked out once per tooth shape and kept (memo), as in the
// prototype: switching options only swaps meshes.

/** Stage units per millimetre. */
export const MM = 2.3 / 62;

/**
 * A tooth: [kind, width, crown height, depth at the gum, which shape ('U0'…'L7'),
 * mirrored (the left side of the mouth), sharpened into a fang]; sizes in millimetres.
 * In its own space the gum line is y = 0, the biting end is y = height, and z points out of the mouth.
 */
export type ToothDef = readonly [ToothKind, number, number, number, string, 0 | 1, 0 | 1];

const defs = (row: 'U' | 'L'): ToothDef[] => TOOTH_DATA[row].map((r, k) => [r.t, r.w, r.h, r.d, `${row}${k}`, 0, 0] as const);
export const UPPER = defs('U');
export const LOWER = defs('L');
/** How much longer a fang is than the canine it is built on (mm). */
export const FANG = 3.4;
export const mirrorOf = (def: ToothDef): ToothDef => [def[0], def[1], def[2], def[3], def[4], 1, def[6]];
export const fangOf = (def: ToothDef): ToothDef => [def[0], def[1], def[2] + FANG, def[3], def[4], def[5], 1];

/** A cap sits a quarter of a millimetre proud of the tooth; its edge shows a lip; an open face leaves a frame this wide. */
export const CAP_OFF = 0.24;
const LIP = 0.4;
export const WIN = 1.45;
/**
 * How far a cap's edge arches away from the gum between teeth: deep cut shows each
 * tooth, the permanent look runs straight.
 */
export const SIDE = { deep: 0.27, permanent: 0.06 } as const;
/** The thin gold rim round an iced face, and its tube. */
export const RIM = 0.3;
export const TUBE = 0.12;

export function srad(a: number, m: number) {
  return Math.pow(Math.pow(Math.abs(Math.cos(a)), m) + Math.pow(Math.abs(Math.sin(a)), m), -1 / m);
}
function solve(f: (x: number) => number, lo: number, hi: number) {
  for (let k = 0; k < 34; k++) {
    const mid = (lo + hi) / 2;
    if (f(mid) > 0) hi = mid;
    else lo = mid;
  }
  return (lo + hi) / 2;
}

const _a = new THREE.Vector3();
const _b = new THREE.Vector3();
const _c = new THREE.Vector3();
const cache = new Map<string, unknown>();
export function memo<T>(key: string, make: () => T): T {
  if (cache.has(key)) return cache.get(key) as T;
  const made = make();
  cache.set(key, made);
  return made;
}
const skey = (def: ToothDef) => `${def[4]}_${def[5]}_${def[6]}`;
export const dkey = (def: ToothDef, rise: number) => `${def.join('_')}|${rise}`;

function unpack<T extends Int16Array | Uint16Array>(str: string, Type: { new (buffer: ArrayBuffer): T }): T {
  const bin = atob(str);
  const u = new Uint8Array(bin.length);
  for (let k = 0; k < bin.length; k++) u[k] = bin.charCodeAt(k);
  return new Type(u.buffer);
}

/** One round of Catmull-Clark smoothing on a cage of four-sided faces that is open at the root end. */
function subdivide(P: ArrayLike<number>, Q: ArrayLike<number>) {
  const nv = P.length / 3;
  const nq = Q.length / 4;
  const edge = new Map<number, number>();
  const ea: number[] = [];
  const eb: number[] = [];
  const ef: number[] = [];
  const fe = new Int32Array(nq * 4);
  const fp = new Float64Array(nq * 3);
  let k: number, j: number, c: number, a: number, b: number, key: number, e: number | undefined;
  for (k = 0; k < nq; k++) for (c = 0; c < 3; c++) fp[k * 3 + c] = (P[Q[k * 4] * 3 + c] + P[Q[k * 4 + 1] * 3 + c] + P[Q[k * 4 + 2] * 3 + c] + P[Q[k * 4 + 3] * 3 + c]) / 4;
  for (k = 0; k < nq; k++) {
    for (j = 0; j < 4; j++) {
      a = Q[k * 4 + j];
      b = Q[k * 4 + ((j + 1) % 4)];
      key = a < b ? a * 65536 + b : b * 65536 + a;
      e = edge.get(key);
      if (e === undefined) {
        e = ea.length;
        edge.set(key, e);
        ea.push(a);
        eb.push(b);
        ef.push(k, -1);
      } else ef[e * 2 + 1] = k;
      fe[k * 4 + j] = e;
    }
  }
  const ne = ea.length;
  const out = new Float64Array((nv + nq + ne) * 3);
  const sf = new Float64Array(nv * 3);
  const sr = new Float64Array(nv * 3);
  const sb = new Float64Array(nv * 3);
  const nf = new Int32Array(nv);
  const nr = new Int32Array(nv);
  const nb = new Int32Array(nv);
  for (k = 0; k < nq; k++) {
    for (j = 0; j < 4; j++) {
      a = Q[k * 4 + j];
      nf[a]++;
      for (c = 0; c < 3; c++) sf[a * 3 + c] += fp[k * 3 + c];
    }
  }
  for (let e2 = 0; e2 < ne; e2++) {
    a = ea[e2];
    b = eb[e2];
    const f0 = ef[e2 * 2];
    const f1 = ef[e2 * 2 + 1];
    const o = (nv + nq + e2) * 3;
    for (c = 0; c < 3; c++) {
      const mid = (P[a * 3 + c] + P[b * 3 + c]) / 2;
      out[o + c] = f1 < 0 ? mid : (P[a * 3 + c] + P[b * 3 + c] + fp[f0 * 3 + c] + fp[f1 * 3 + c]) / 4;
      sr[a * 3 + c] += mid;
      sr[b * 3 + c] += mid;
      if (f1 < 0) {
        sb[a * 3 + c] += P[b * 3 + c];
        sb[b * 3 + c] += P[a * 3 + c];
      }
    }
    nr[a]++;
    nr[b]++;
    if (f1 < 0) {
      nb[a]++;
      nb[b]++;
    }
  }
  for (k = 0; k < nv; k++) {
    for (c = 0; c < 3; c++) {
      const p = P[k * 3 + c];
      const n = nf[k];
      out[k * 3 + c] = nb[k] ? 0.75 * p + 0.125 * sb[k * 3 + c] : (sf[k * 3 + c] / n + (2 * sr[k * 3 + c]) / nr[k] + (n - 3) * p) / n;
    }
  }
  for (k = 0; k < nq * 3; k++) out[nv * 3 + k] = fp[k];
  const Q2 = new Int32Array(nq * 16);
  for (k = 0; k < nq; k++) {
    for (j = 0; j < 4; j++) {
      const o2 = (k * 4 + j) * 4;
      Q2[o2] = Q[k * 4 + j];
      Q2[o2 + 1] = nv + nq + fe[k * 4 + j];
      Q2[o2 + 2] = nv + k;
      Q2[o2 + 3] = nv + nq + fe[k * 4 + ((j + 3) % 4)];
    }
  }
  return { P: out, Q: Q2 };
}

/** A finished tooth: points, the way each faces, triangles (the last few close the root end), and its measurements. */
export type Shape = {
  P: Float64Array;
  N: Float64Array;
  F: number[];
  /** Triangles of the surface itself (the rest close the root). */
  nt: number;
  nv: number;
  x0: number;
  x1: number;
  y1: number;
  z0: number;
  z1: number;
  /** The neck, and the line between the lip half and the tongue half. */
  cx: number;
  cz: number;
  hx: number;
  hz: number;
  zs: number;
};

export function shape(def: ToothDef): Shape {
  return memo(`sh${skey(def)}`, () => {
    let k: number, c: number, j: number;
    if (def[5]) {
      // The left side of the mouth: the same tooth in a mirror.
      const o = shape([def[0], def[1], def[2], def[3], def[4], 0, def[6]]);
      const mp = new Float64Array(o.P);
      const mn = new Float64Array(o.N);
      const mf = o.F.slice();
      for (k = 0; k < mp.length; k += 3) {
        mp[k] = -mp[k];
        mn[k] = -mn[k];
      }
      for (k = 0; k < mf.length; k += 3) {
        c = mf[k + 1];
        mf[k + 1] = mf[k + 2];
        mf[k + 2] = c;
      }
      return { ...o, P: mp, N: mn, F: mf, x0: -o.x1, x1: -o.x0, cx: -o.cx };
    }
    const rec = TOOTH_DATA[def[4].charAt(0) as 'U' | 'L'][Number(def[4].slice(1))];
    const v = unpack(rec.v, Int16Array);
    let P: Float64Array = new Float64Array(v.length);
    for (k = 0; k < v.length; k++) P[k] = v[k] / 1000;
    let m = subdivide(P, unpack(rec.q, Uint16Array));
    m = subdivide(m.P, m.Q);
    P = m.P;
    const Q = m.Q;
    const nq = Q.length / 4;
    const nv = P.length / 3;
    if (def[6]) {
      // A fang: the top of the canine drawn out and down into a point.
      let tip = 0;
      for (k = 1; k < nv; k++) if (P[k * 3 + 1] > P[tip * 3 + 1]) tip = k;
      const tx = P[tip * 3];
      const tz = P[tip * 3 + 2];
      for (k = 0; k < nv; k++) {
        const t = P[k * 3 + 1] / rec.h;
        if (t <= 0.34) continue;
        const g = Math.pow(Math.min(1, (t - 0.34) / 0.66), 1.55);
        const nar = 1 - 0.34 * g;
        P[k * 3 + 1] += FANG * g;
        P[k * 3] = tx + (P[k * 3] - tx) * nar;
        P[k * 3 + 2] = tz + (P[k * 3 + 2] - tz) * nar + 0.8 * g;
      }
    }
    const F: number[] = [];
    const cnt = new Map<number, number>();
    const dir: number[] = [];
    let key: number, a: number, b: number;
    for (k = 0; k < nq; k++) {
      F.push(Q[k * 4], Q[k * 4 + 1], Q[k * 4 + 2], Q[k * 4], Q[k * 4 + 2], Q[k * 4 + 3]);
      for (j = 0; j < 4; j++) {
        a = Q[k * 4 + j];
        b = Q[k * 4 + ((j + 1) % 4)];
        key = a < b ? a * 65536 + b : b * 65536 + a;
        if (!cnt.has(key)) {
          cnt.set(key, dir.length);
          dir.push(a, b, 1);
        } else dir[cnt.get(key)! + 2]++;
      }
    }
    const nt = F.length;
    const N = new Float64Array(nv * 3 + 3);
    const P2 = new Float64Array(nv * 3 + 3);
    let loop = 0;
    let cx = 0;
    let cy = 0;
    let cz = 0;
    P2.set(P);
    for (k = 0; k < dir.length; k += 3) {
      if (dir[k + 2] === 1) {
        F.push(dir[k + 1], dir[k], nv);
        loop++;
        cx += P[dir[k] * 3];
        cy += P[dir[k] * 3 + 1];
        cz += P[dir[k] * 3 + 2];
      }
    }
    P2[nv * 3] = cx / loop;
    P2[nv * 3 + 1] = cy / loop;
    P2[nv * 3 + 2] = cz / loop;
    P = P2;
    let mx = 0;
    let my = 0;
    let mz = 0;
    let vol = 0;
    for (k = 0; k < nv; k++) {
      mx += P[k * 3];
      my += P[k * 3 + 1];
      mz += P[k * 3 + 2];
    }
    mx /= nv;
    my /= nv;
    mz /= nv;
    const tri = (k2: number) => {
      _a.set(P[F[k2] * 3] - mx, P[F[k2] * 3 + 1] - my, P[F[k2] * 3 + 2] - mz);
      _b.set(P[F[k2 + 1] * 3] - mx, P[F[k2 + 1] * 3 + 1] - my, P[F[k2 + 1] * 3 + 2] - mz);
      _c.set(P[F[k2 + 2] * 3] - mx, P[F[k2 + 2] * 3 + 1] - my, P[F[k2 + 2] * 3 + 2] - mz);
    };
    for (k = 0; k < F.length; k += 3) {
      tri(k);
      vol += _a.dot(_b.cross(_c));
    }
    if (vol < 0) {
      for (k = 0; k < F.length; k += 3) {
        const sw = F[k + 1];
        F[k + 1] = F[k + 2];
        F[k + 2] = sw;
      }
    }
    for (k = 0; k < nt; k += 3) {
      tri(k);
      _b.sub(_a);
      _c.sub(_a);
      _b.cross(_c);
      for (j = 0; j < 3; j++) {
        N[F[k + j] * 3] += _b.x;
        N[F[k + j] * 3 + 1] += _b.y;
        N[F[k + j] * 3 + 2] += _b.z;
      }
    }
    for (k = 0; k < nv; k++) {
      const l = Math.hypot(N[k * 3], N[k * 3 + 1], N[k * 3 + 2]) || 1;
      N[k * 3] /= l;
      N[k * 3 + 1] /= l;
      N[k * 3 + 2] /= l;
    }
    N[nv * 3 + 1] = -1;
    const s: Shape = { P, N, F, nt, nv, x0: 1e9, x1: -1e9, y1: -1e9, z0: 1e9, z1: -1e9, cx: 0, cz: 0, hx: 0, hz: 0, zs: 0 };
    let nx0 = 1e9;
    let nx1 = -1e9;
    let nz0 = 1e9;
    let nz1 = -1e9;
    for (k = 0; k < nv; k++) {
      const x = P[k * 3];
      const y = P[k * 3 + 1];
      const z = P[k * 3 + 2];
      s.x0 = Math.min(s.x0, x);
      s.x1 = Math.max(s.x1, x);
      s.y1 = Math.max(s.y1, y);
      s.z0 = Math.min(s.z0, z);
      s.z1 = Math.max(s.z1, z);
      if (Math.abs(y) < 0.6) {
        nx0 = Math.min(nx0, x);
        nx1 = Math.max(nx1, x);
        nz0 = Math.min(nz0, z);
        nz1 = Math.max(nz1, z);
      }
    }
    s.cx = (nx0 + nx1) / 2;
    s.cz = (nz0 + nz1) / 2;
    s.hx = (nx1 - nx0) / 2;
    s.hz = (nz1 - nz0) / 2;
    s.zs = (s.z0 + s.z1) / 2;
    return s;
  });
}

/** The way round the tooth: 90 degrees is the middle of the lip side, 0 and 180 are where it meets its neighbours. */
const thOf = (s: Shape, x: number, z: number) => Math.atan2((z - s.cz) / s.hz, (x - s.cx) / s.hx);
/** Where a cap's edge runs, round the tooth: close to the gum on the lip side, arching up between teeth. */
function margin(def: ToothDef, th: number, rise: number) {
  const s = rise * def[2];
  return Math.sin(th) > 0 ? -0.35 + (s + 0.35) * Math.pow(Math.abs(Math.cos(th)), 3.2) : s;
}

// The lip-side face seen from straight in front, as a fine height map: how far forward the surface is at each point, and which way it faces there.
const CELL = 1 / 16;
type Face = { x0: number; y0: number; nx: number; ny: number; Z: Float32Array; A: Float32Array; B: Float32Array; C: Float32Array; cov: Uint8Array };

function face(def: ToothDef): Face {
  return memo(`f${skey(def)}`, () => {
    const s = shape(def);
    const { P, N, F } = s;
    const x0 = s.x0 - 0.6;
    const y0 = -1.4;
    const nx = Math.ceil((s.x1 - s.x0 + 1.2) / CELL) + 1;
    const ny = Math.ceil((s.y1 + 0.6 - y0) / CELL) + 1;
    const n = nx * ny;
    const Z = new Float32Array(n);
    const A = new Float32Array(n);
    const B = new Float32Array(n);
    const C = new Float32Array(n);
    const cov = new Uint8Array(n);
    let k: number, i: number, j: number, o: number;
    for (k = 0; k < n; k++) {
      Z[k] = -1e9;
      C[k] = 1;
    }
    for (k = 0; k < s.nt; k += 3) {
      const a = F[k] * 3;
      const b = F[k + 1] * 3;
      const c = F[k + 2] * 3;
      if (P[a + 2] < s.zs || P[b + 2] < s.zs || P[c + 2] < s.zs) continue;
      if (N[a + 2] < 0.1 && N[b + 2] < 0.1 && N[c + 2] < 0.1) continue;
      const ax = (P[a] - x0) / CELL;
      const ay = (P[a + 1] - y0) / CELL;
      const bx = (P[b] - x0) / CELL;
      const by = (P[b + 1] - y0) / CELL;
      const cx = (P[c] - x0) / CELL;
      const cy = (P[c + 1] - y0) / CELL;
      const det = (bx - ax) * (cy - ay) - (cx - ax) * (by - ay);
      if (Math.abs(det) < 1e-9) continue;
      const i0 = Math.max(0, Math.ceil(Math.min(ax, bx, cx)));
      const i1 = Math.min(nx - 1, Math.floor(Math.max(ax, bx, cx)));
      const j0 = Math.max(0, Math.ceil(Math.min(ay, by, cy)));
      const j1 = Math.min(ny - 1, Math.floor(Math.max(ay, by, cy)));
      for (j = j0; j <= j1; j++) {
        for (i = i0; i <= i1; i++) {
          const w1 = ((i - ax) * (cy - ay) - (cx - ax) * (j - ay)) / det;
          const w2 = ((bx - ax) * (j - ay) - (i - ax) * (by - ay)) / det;
          const w0 = 1 - w1 - w2;
          if (w0 < -1e-6 || w1 < -1e-6 || w2 < -1e-6) continue;
          const z = w0 * P[a + 2] + w1 * P[b + 2] + w2 * P[c + 2];
          o = j * nx + i;
          if (z > Z[o]) {
            Z[o] = z;
            A[o] = w0 * N[a] + w1 * N[b] + w2 * N[c];
            B[o] = w0 * N[a + 1] + w1 * N[b + 1] + w2 * N[c + 1];
            C[o] = w0 * N[a + 2] + w1 * N[b + 2] + w2 * N[c + 2];
            cov[o] = 1;
          }
        }
      }
    }
    // Carry the surface a little past its own edge, so anything sitting right on the edge still has something to rest on.
    const have = new Uint8Array(cov);
    const nb4 = [-1, 1, -nx, nx];
    for (let pass = 0; pass < 16; pass++) {
      const add: number[] = [];
      for (j = 1; j < ny - 1; j++) {
        for (i = 1; i < nx - 1; i++) {
          o = j * nx + i;
          if (have[o]) continue;
          let cn = 0;
          let sz = 0;
          let sa = 0;
          let sb = 0;
          let sc = 0;
          for (k = 0; k < 4; k++) {
            const q = o + nb4[k];
            if (have[q]) {
              cn++;
              sz += Z[q];
              sa += A[q];
              sb += B[q];
              sc += C[q];
            }
          }
          if (cn) add.push(o, sz / cn, sa / cn, sb / cn, sc / cn);
        }
      }
      for (k = 0; k < add.length; k += 5) {
        o = add[k];
        have[o] = 1;
        Z[o] = add[k + 1];
        A[o] = add[k + 2];
        B[o] = add[k + 3];
        C[o] = add[k + 4];
      }
    }
    for (k = 0; k < n; k++) if (!have[k]) Z[k] = s.zs;
    return { x0, y0, nx, ny, Z, A, B, C, cov };
  });
}

/** Read a height map between its points. */
function samp(arr: ArrayLike<number>, f: Face, x: number, y: number) {
  const gx = Math.min(f.nx - 1.001, Math.max(0, (x - f.x0) / CELL));
  const gy = Math.min(f.ny - 1.001, Math.max(0, (y - f.y0) / CELL));
  const i = Math.floor(gx);
  const j = Math.floor(gy);
  const u = gx - i;
  const v = gy - j;
  const o = j * f.nx + i;
  return (arr[o] * (1 - u) + arr[o + 1] * u) * (1 - v) + (arr[o + f.nx] * (1 - u) + arr[o + f.nx + 1] * u) * v;
}

/** For every point inside a shape, how far it is from the shape's edge (measured in points of the map). */
function spread(mask: Uint8Array, nx: number, ny: number) {
  const INF = 1e12;
  const f = new Float64Array(nx * ny);
  const n = Math.max(nx, ny);
  const v = new Int32Array(n);
  const z = new Float64Array(n + 1);
  const g = new Float64Array(n);
  let k: number, q: number;
  for (k = 0; k < nx * ny; k++) f[k] = mask[k] ? INF : 0;
  const run = (off: number, stride: number, len: number) => {
    for (q = 0; q < len; q++) g[q] = f[off + q * stride];
    let kk = 0;
    let s2 = 0;
    v[0] = 0;
    z[0] = -INF;
    z[1] = INF;
    for (q = 1; q < len; q++) {
      for (;;) {
        const p = v[kk];
        s2 = (g[q] + q * q - (g[p] + p * p)) / (2 * q - 2 * p);
        if (s2 <= z[kk] && kk > 0) kk--;
        else break;
      }
      kk++;
      v[kk] = q;
      z[kk] = s2;
      z[kk + 1] = INF;
    }
    kk = 0;
    for (q = 0; q < len; q++) {
      while (z[kk + 1] < q) kk++;
      const p2 = v[kk];
      f[off + q * stride] = (q - p2) * (q - p2) + g[p2];
    }
  };
  for (k = 0; k < nx; k++) run(k, nx, ny);
  for (k = 0; k < ny; k++) run(k * nx, 1, nx);
  for (k = 0; k < nx * ny; k++) f[k] = Math.max(0, Math.sqrt(f[k]) - 0.5);
  return f;
}

/** The part of the face a cap covers, as distance in from its edge. */
function reach(def: ToothDef, rise: number) {
  return memo(`g${skey(def)}|${def[2]}|${rise}`, () => {
    const f = face(def);
    const s = shape(def);
    const mask = new Uint8Array(f.nx * f.ny);
    for (let j = 0; j < f.ny; j++) {
      for (let i = 0; i < f.nx; i++) {
        const o = j * f.nx + i;
        if (f.cov[o] && f.y0 + j * CELL >= margin(def, thOf(s, f.x0 + i * CELL, f.Z[o]), rise)) mask[o] = 1;
      }
    }
    return spread(mask, f.nx, f.ny);
  });
}

/** The point on a cap's lip-side face above (x, y), and which way it faces. */
export function facePoint(def: ToothDef, x: number, y: number, P: THREE.Vector3, N: THREE.Vector3) {
  const f = face(def);
  N.set(samp(f.A, f, x, y), samp(f.B, f, x, y), samp(f.C, f, x, y)).normalize();
  P.set(x, y + N.y * CAP_OFF, samp(f.Z, f, x, y) + N.z * CAP_OFF);
}
/** How far (x, y) is in from the cap's edge; 0 off the face. */
const inFrom = (def: ToothDef, x: number, y: number, rise: number) => samp(reach(def, rise), face(def), x, y) * CELL;
const onFace = (def: ToothDef, x: number, y: number, inset: number, rise: number) => inFrom(def, x, y, rise) >= inset;

/** The face's outline, `inset` in from its edge, as points round its centre. */
export function outline(def: ToothDef, rise: number, inset: number, n: number): [number, number][] {
  return memo(`ol${dkey(def, rise)}${inset}|${n}`, () => {
    const pts: [number, number][] = [];
    const yc = def[2] * 0.45;
    for (let k = 0; k < n; k++) {
      const a = (k / n) * Math.PI * 2;
      const ca = Math.cos(a);
      const sa = Math.sin(a);
      const rho = solve((r) => (onFace(def, r * ca, yc + r * sa, inset, rise) ? -1 : 1), 0, 14);
      pts.push([rho * ca, yc + rho * sa]);
    }
    return pts;
  });
}

/** Make every face point outwards. */
export function orient(geo: THREE.BufferGeometry, closed: boolean) {
  const p = geo.attributes.position as THREE.BufferAttribute;
  const ix = geo.index!.array as Uint16Array | Uint32Array;
  const c = new THREE.Vector3();
  let vol = 0;
  let k: number;
  if (!closed) {
    for (k = 0; k < p.count; k++) c.add(_a.fromBufferAttribute(p, k));
    c.multiplyScalar(1 / p.count);
  }
  for (k = 0; k < ix.length; k += 3) {
    _a.fromBufferAttribute(p, ix[k]).sub(c);
    _b.fromBufferAttribute(p, ix[k + 1]).sub(c);
    _c.fromBufferAttribute(p, ix[k + 2]).sub(c);
    vol += _a.dot(_b.cross(_c));
  }
  if (vol < 0) {
    for (k = 0; k < ix.length; k += 3) {
      const t = ix[k + 1];
      ix[k + 1] = ix[k + 2];
      ix[k + 2] = t;
    }
  }
  geo.computeVertexNormals();
  return geo;
}

export function grid(idx: number[], rings: number, NU: number) {
  for (let k = 0; k < rings - 1; k++) {
    for (let j = 0; j < NU; j++) {
      const a = k * NU + j;
      const b = k * NU + ((j + 1) % NU);
      const c = a + NU;
      const d = b + NU;
      idx.push(a, c, b, b, c, d);
    }
  }
}

export function bufGeo(pos: number[], idx: number[], uv?: number[]) {
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  if (uv) g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  g.setIndex(idx);
  return g;
}

/** The whole tooth, closed at the root. */
export function toothGeo(def: ToothDef) {
  return memo(`t${skey(def)}`, () => {
    const s = shape(def);
    const n = s.P.length;
    const pos = new Float32Array(n);
    for (let k = 0; k < n; k++) pos[k] = s.P[k] * MM;
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    g.setAttribute('normal', new THREE.BufferAttribute(new Float32Array(s.N), 3));
    g.setIndex(s.F);
    g.computeBoundingSphere();
    g.computeBoundingBox();
    return g;
  });
}

/** The grill cap: the tooth's own surface, a little fuller, cut off along an arched edge that turns in to show its thickness. */
export function capGeo(def: ToothDef, rise: number) {
  return memo(`c${dkey(def, rise)}`, () => {
    const s = shape(def);
    const { P, N, F } = s;
    const f = new Float32Array(s.nv);
    const at = new Int32Array(s.nv);
    const cuts = new Map<number, number>();
    const lips = new Map<number, number>();
    const pos: number[] = [];
    const uv: number[] = [];
    const idx: number[] = [];
    const w = def[1];
    const h = def[2];
    let k: number, j: number;
    for (k = 0; k < s.nv; k++) {
      f[k] = P[k * 3 + 1] - margin(def, thOf(s, P[k * 3], P[k * 3 + 2]), rise);
      at[k] = -1;
    }
    const put = (x: number, y: number, z: number, nx: number, ny: number, nz: number, drop: number) => {
      const front = nz > 0.12 && z > s.zs;
      uv.push(x / w + 0.5, front ? (y + 1) / (h + 2) : 3);
      pos.push((x - nx * drop) * MM, (y + ny * CAP_OFF - ny * drop) * MM, (z + nz * CAP_OFF - nz * drop) * MM);
      return pos.length / 3 - 1;
    };
    const whole = (v: number) => (at[v] >= 0 ? at[v] : (at[v] = put(P[v * 3], P[v * 3 + 1], P[v * 3 + 2], N[v * 3], N[v * 3 + 1], N[v * 3 + 2], 0)));
    // The point where the cap's edge crosses the line from a to b, and the same point turned in for the lip.
    const cut = (a: number, b: number) => {
      const key = a < b ? a * 65536 + b : b * 65536 + a;
      const known = cuts.get(key);
      if (known !== undefined) return known;
      const t = f[a] / (f[a] - f[b]);
      const x = P[a * 3] + (P[b * 3] - P[a * 3]) * t;
      const y = P[a * 3 + 1] + (P[b * 3 + 1] - P[a * 3 + 1]) * t;
      const z = P[a * 3 + 2] + (P[b * 3 + 2] - P[a * 3 + 2]) * t;
      _a.set(N[a * 3] + (N[b * 3] - N[a * 3]) * t, N[a * 3 + 1] + (N[b * 3 + 1] - N[a * 3 + 1]) * t, N[a * 3 + 2] + (N[b * 3 + 2] - N[a * 3 + 2]) * t).normalize();
      const id = put(x, y, z, _a.x, _a.y, _a.z, 0);
      lips.set(id, put(x, y, z, _a.x, _a.y, _a.z, LIP));
      cuts.set(key, id);
      return id;
    };
    for (k = 0; k < s.nt; k += 3) {
      const poly: number[] = [];
      const edge: number[] = [];
      for (j = 0; j < 3; j++) {
        const a = F[k + j];
        const b = F[k + ((j + 1) % 3)];
        if (f[a] >= 0) {
          poly.push(whole(a));
          edge.push(0);
        }
        if (f[a] >= 0 !== f[b] >= 0) {
          poly.push(cut(a, b));
          edge.push(1);
        }
      }
      if (poly.length < 3) continue;
      idx.push(poly[0], poly[1], poly[2]);
      if (poly.length === 4) idx.push(poly[0], poly[2], poly[3]);
      for (j = 0; j < poly.length; j++) {
        const p = poly[j];
        const q = poly[(j + 1) % poly.length];
        if (edge[j] && edge[(j + 1) % poly.length] && p !== q) idx.push(q, p, lips.get(p)!, q, lips.get(p)!, lips.get(q)!);
      }
    }
    const geo = orient(bufGeo(pos, idx, uv), false);
    geo.computeBoundingSphere();
    geo.computeBoundingBox();
    return geo;
  });
}

/**
 * A panel lying on the cap's face: for opal, a printed photo, or letters. Its
 * UVs run across the tooth as in the prototype (u0..u1, v0..v1); callers that
 * lay one picture across several teeth replace them.
 */
export function patchGeo(def: ToothDef, rise: number, inset: number, lift: number, u0 = 0, u1 = 1, v0 = 0, v1 = 1) {
  const ol = outline(def, rise, inset, 72);
  const NR = 7;
  const pos: number[] = [];
  const uv: number[] = [];
  const idx: number[] = [];
  const P = new THREE.Vector3();
  const N = new THREE.Vector3();
  const yc = def[2] * 0.45;
  const w = def[1];
  const h = def[2];
  let r: number, k: number;
  const put = (x: number, y: number) => {
    facePoint(def, x, y, P, N);
    P.addScaledVector(N, lift);
    pos.push(P.x * MM, P.y * MM, P.z * MM);
    uv.push(u0 + (x / w + 0.5) * (u1 - u0), v0 + (y / h) * (v1 - v0));
  };
  put(0, yc);
  for (r = 1; r <= NR; r++) for (k = 0; k < 72; k++) put((ol[k][0] * r) / NR, yc + ((ol[k][1] - yc) * r) / NR);
  for (k = 0; k < 72; k++) idx.push(0, 1 + k, 1 + ((k + 1) % 72));
  for (r = 0; r < NR - 1; r++) {
    for (k = 0; k < 72; k++) {
      const a = 1 + r * 72 + k;
      const b = 1 + r * 72 + ((k + 1) % 72);
      const c = a + 72;
      const d = b + 72;
      idx.push(a, c, b, b, c, d);
    }
  }
  return orient(bufGeo(pos, idx, uv), false);
}

/** A panel kept per tooth shape (opal, letters on one tooth): shared, never disposed. */
export const sharedPatch = (def: ToothDef, rise: number, inset: number, lift: number) =>
  memo(`pg${dkey(def, rise)}|${inset}|${lift}`, () => patchGeo(def, rise, inset, lift));

/** A thin raised gold line following the face's outline. */
export function rimGeo(def: ToothDef, rise: number, inset: number, tube: number) {
  return memo(`r${dkey(def, rise)}${inset}|${tube}`, () => {
    const P = new THREE.Vector3();
    const N = new THREE.Vector3();
    const pts = outline(def, rise, inset, 96).map((p) => {
      facePoint(def, p[0], p[1], P, N);
      return P.clone().addScaledVector(N, 0.05).multiplyScalar(MM);
    });
    return new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts, true), 160, tube * MM, 6, true);
  });
}

/**
 * An open face: the part of the cap that is cut away, as an alpha map (white =
 * metal kept). The prototype paints it on a canvas; this is the same picture
 * as raw pixels (row 0 at the bottom, as a data texture reads), so it needs no page.
 */
export function maskTex(def: ToothDef, rise: number) {
  return memo(`m${dkey(def, rise)}`, () => {
    const W = 144;
    const H = 192;
    const data = new Uint8Array(W * H * 4);
    const w = def[1];
    const h = def[2];
    for (let r = 0; r < H; r++) {
      for (let i = 0; i < W; i++) {
        const u = (i + 0.5) / W;
        const v = (r + 0.5) / H;
        const keep = Math.round(255 * Math.min(1, Math.max(0, 0.5 + (WIN - inFrom(def, (u - 0.5) * w, v * (h + 2) - 1, rise)) / 0.2)));
        const k = (r * W + i) * 4;
        data[k] = data[k + 1] = data[k + 2] = keep;
        data[k + 3] = 255;
      }
    }
    const t = new THREE.DataTexture(data, W, H, THREE.RGBAFormat);
    t.minFilter = t.magFilter = THREE.LinearFilter;
    t.generateMipmaps = false;
    t.needsUpdate = true;
    return t;
  });
}

// ---------- set stones: small cut stones packed edge to edge inside a thin gold rim ----------

/** One stone: an eight-sided cut, girdle radius 1, table up. */
export const gemGeo = (() => {
  const seg = 8;
  const step = (Math.PI * 2) / seg;
  const tr = 0.6;
  const th = 0.34;
  const pos: number[] = [];
  const mid = new THREE.Vector3(0, -0.2, 0);
  const P = (r: number, y: number, a: number) => new THREE.Vector3(r * Math.cos(a), y, r * Math.sin(a));
  const tri = (a: THREE.Vector3, b: THREE.Vector3, c: THREE.Vector3) => {
    const n = new THREE.Vector3().subVectors(b, a).cross(new THREE.Vector3().subVectors(c, a));
    const ctr = new THREE.Vector3().add(a).add(b).add(c).multiplyScalar(1 / 3).sub(mid);
    if (n.dot(ctr) < 0) [b, c] = [c, b];
    pos.push(a.x, a.y, a.z, b.x, b.y, b.z, c.x, c.y, c.z);
  };
  for (let k = 0; k < seg; k++) {
    const t0 = P(tr, th, k * step);
    const t1 = P(tr, th, (k + 1) * step);
    const g0 = P(1, 0, (k - 0.5) * step);
    const g1 = P(1, 0, (k + 0.5) * step);
    tri(new THREE.Vector3(0, th, 0), t0, t1);
    tri(t0, t1, g1);
    tri(t0, g1, g0);
    tri(g0, g1, P(1, -0.3, (k + 0.5) * step));
    tri(g0, P(1, -0.3, (k + 0.5) * step), P(1, -0.3, (k - 0.5) * step));
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.computeVertexNormals();
  return g;
})();
/** A gold bead between prong-set stones. */
export const beadGeo = new THREE.SphereGeometry(1, 10, 8);
const UPY = new THREE.Vector3(0, 1, 0);

/** Where a stone sits, for its glint: position (stage units), facing, radius (mm). */
export type Spot = { p: THREE.Vector3; n: THREE.Vector3; r: number };
export type StoneLayout = { stones: THREE.Matrix4[]; beads: THREE.Matrix4[]; spots: Spot[] };
export type Setting = 'honeycomb' | 'mosaic' | 'prong';

/** Where every stone sits, worked out once per tooth shape. */
export function stoneLayout(def: ToothDef, rise: number, setting: Setting, open: boolean): StoneLayout {
  return memo(`s${dkey(def, rise)}${setting}${open}`, () => {
    const stones: THREE.Matrix4[] = [];
    const beads: THREE.Matrix4[] = [];
    const spots: Spot[] = [];
    const P = new THREE.Vector3();
    const N = new THREE.Vector3();
    const m4 = new THREE.Matrix4();
    const q = new THREE.Quaternion();
    const q2 = new THREE.Quaternion();
    const sc = new THREE.Vector3();
    const h = def[2];
    let seed = 7 + def[1] * 31 + h * 17;
    let x: number, y: number, k: number, row: number;
    const rnd = () => {
      seed = (seed * 16807) % 2147483647;
      return seed / 2147483647;
    };
    const place = (px: number, py: number, rad: number) => {
      facePoint(def, px, py, P, N);
      if (N.z < 0.28) return false;
      P.addScaledVector(N, 0.02);
      q.setFromUnitVectors(UPY, N);
      q2.setFromAxisAngle(UPY, rnd() * 6.283);
      q.multiply(q2);
      sc.setScalar(rad * MM);
      stones.push(m4.compose(P.clone().multiplyScalar(MM), q, sc).clone());
      spots.push({ p: P.clone().multiplyScalar(MM), n: N.clone(), r: rad });
      return true;
    };
    const bead = (px: number, py: number, rad: number) => {
      facePoint(def, px, py, P, N);
      P.addScaledVector(N, 0.06);
      sc.setScalar(rad * MM);
      beads.push(m4.compose(P.clone().multiplyScalar(MM), q.identity(), sc).clone());
    };
    if (open) {
      // An iced open face: one row of stones round the frame.
      const ol = outline(def, rise, RIM + TUBE + 0.42, 220);
      let acc = 0;
      const rad0 = 0.37;
      for (k = 0; k < ol.length; k++) {
        const a = ol[k];
        const b = ol[(k + 1) % ol.length];
        acc += Math.hypot(b[0] - a[0], b[1] - a[1]);
        if (acc >= rad0 * 2.04) {
          acc = 0;
          place(b[0], b[1], rad0);
        }
      }
    } else if (setting === 'prong') {
      // Even rows, a gold bead at every corner.
      const pp = 0.98;
      const pr = 0.46;
      const ins = RIM + TUBE + pr + 0.04;
      const K = Math.ceil(def[1] / 2 / pp) + 1;
      for (y = -0.3 + ins, row = 0; y <= h; y += pp, row++) {
        for (k = -K; k <= K; k++) {
          x = k * pp;
          if (onFace(def, x, y, ins, rise)) place(x, y, pr);
          if (onFace(def, x + pp / 2, y + pp / 2, ins + 0.1, rise)) bead(x + pp / 2, y + pp / 2, 0.15);
        }
      }
    } else if (setting === 'mosaic') {
      // A few larger stones, the gaps packed with small ones.
      const big: [number, number][] = [];
      const BR = 0.68;
      const SR = 0.33;
      const bp = 2.25;
      const sp = 0.68;
      const K2 = Math.ceil(def[1] / 2 / sp) + 1;
      for (y = 0.9, row = 0; y <= h; y += bp * 0.82, row++) {
        for (k = -3; k <= 3; k++) {
          x = (k + (row % 2 ? 0.5 : 0)) * bp + (rnd() - 0.5) * 0.5;
          const yy = y + (rnd() - 0.5) * 0.5;
          if (onFace(def, x, yy, RIM + TUBE + BR + 0.05, rise) && place(x, yy, BR)) big.push([x, yy]);
        }
      }
      for (y = -0.3 + RIM + TUBE + SR, row = 0; y <= h; y += sp * 0.866, row++) {
        for (k = -K2; k <= K2; k++) {
          const xx = (k + (row % 2 ? 0.5 : 0)) * sp;
          const yy = y;
          if (!onFace(def, xx, yy, RIM + TUBE + SR + 0.04, rise)) continue;
          if (big.some((g) => Math.hypot(g[0] - xx, g[1] - yy) < BR + SR + 0.03)) continue;
          place(xx, yy, SR);
        }
      }
    } else {
      // Honeycomb: tight pavé.
      const rad = 0.43;
      const pitch = 0.86;
      const inset = RIM + TUBE + rad + 0.04;
      const K3 = Math.ceil(def[1] / 2 / pitch) + 1;
      for (y = -0.3 + inset, row = 0; y <= h; y += pitch * 0.866, row++) {
        for (k = -K3; k <= K3; k++) {
          x = (k + (row % 2 ? 0.5 : 0)) * pitch;
          if (onFace(def, x, y, inset, rise)) place(x, y, rad);
        }
      }
    }
    return { stones, beads, spots };
  });
}
