import { readFileSync } from 'node:fs';
import { beforeAll, describe, expect, it } from 'vitest';
import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { layoutFor } from '../../components/three/DiamondStones';
import { crownGeometry } from '../../components/three/gems';
import { Relief } from '../../components/three/relief';
import { frameOf } from '../../components/three/styles';
import { toothCustomization } from '../toothCustomization';
import { SETTINGS } from '../renderSpec';

// The real dental model, so the layouts are checked on the teeth customers see.
const meshes = new Map<string, THREE.Mesh>();
beforeAll(async () => {
  const file = readFileSync(new URL('../../../public/assets/teeth_final.glb', import.meta.url));
  const data = file.buffer.slice(file.byteOffset, file.byteOffset + file.byteLength);
  const gltf = await new Promise<{ scene: THREE.Object3D }>((resolve, reject) => new GLTFLoader().parse(data, '', resolve, reject));
  gltf.scene.traverse((object) => {
    if (object instanceof THREE.Mesh) meshes.set(object.name, object);
  });
});
const moulds = () => [meshes.get('top_mould')!, meshes.get('bottom_mould')!];

describe('the brilliant cut', () => {
  const position = crownGeometry().attributes.position as THREE.BufferAttribute;
  const normal = crownGeometry().attributes.normal as THREE.BufferAttribute;
  const points = Array.from({ length: position.count }, (_, i) => new THREE.Vector3().fromBufferAttribute(position, i));

  it('has a crown of 33 facets: table, 8 bezels, 8 stars, 16 upper girdle', () => {
    const facets = new Set(Array.from({ length: normal.count }, (_, i) => [normal.getX(i), normal.getY(i), normal.getZ(i)].map((value) => value.toFixed(4)).join()));
    expect(facets.size).toBe(33);
  });

  it('sits on its girdle with the table on top, about a third of its radius high', () => {
    expect(Math.min(...points.map((point) => point.y))).toBeCloseTo(0, 5);
    expect(Math.max(...points.map((point) => point.y))).toBeCloseTo(0.302, 2);
    expect(Math.max(...points.map((point) => Math.hypot(point.x, point.z)))).toBeLessThan(1.03);
  });

  it('is the same every eighth of a turn', () => {
    const turned = points.map((point) => point.clone().applyAxisAngle(new THREE.Vector3(0, 1, 0), Math.PI / 4));
    for (const point of turned) expect(points.some((other) => other.distanceTo(point) < 1e-4)).toBe(true);
  });
});

describe('the surface lookup', () => {
  it('gives the answer a ray cast gives, across a tooth', () => {
    const tooth = meshes.get('top_teeth008')!;
    const { centre, facial, across, up, reach } = frameOf(tooth.geometry);
    const relief = new Relief([{ geometry: tooth.geometry }], centre, across, up, facial, reach * 0.6);
    const ray = new THREE.Raycaster();
    const probe = new THREE.Mesh(tooth.geometry);
    let compared = 0;
    for (let i = -8; i <= 8; i += 1) {
      for (let j = -8; j <= 8; j += 1) {
        // Off the grid lines of the mesh, where a ray on an edge is a coin toss.
        const [a, b] = [(i / 17) * reach + 0.00011, (j / 17) * reach + 0.00007];
        ray.set(centre.clone().addScaledVector(across, a).addScaledVector(up, b).addScaledVector(facial, reach), facial.clone().negate());
        const hit = ray.intersectObject(probe, false)[0];
        const found = relief.at(a, b);
        expect(Boolean(found)).toBe(Boolean(hit));
        if (hit && found) {
          expect(relief.point(a, b, found.depth).distanceTo(hit.point)).toBeLessThan(1e-6);
          expect(found.normal.dot(hit.face!.normal)).toBeCloseTo(1, 4);
          compared += 1;
        }
      }
    }
    expect(compared).toBeGreaterThan(50);
  });
});

describe('stones on a tooth', () => {
  const settings = SETTINGS.map((setting) => setting.id);

  it('covers a front tooth like real work: ten or so stones across, none on top of another', () => {
    for (const setting of settings) {
      const { stones, beads } = layoutFor(meshes.get('top_teeth008')!, setting, 0, moulds());
      // A jeweler quotes 65 to 90 stones for a fully iced tooth; mosaic's large stones take fewer.
      expect(stones.length, setting).toBeGreaterThan(setting === 'mosaic' ? 70 : 85);
      expect(stones.length, setting).toBeLessThan(220);
      stones.forEach((stone, i) => {
        for (const other of stones.slice(i + 1)) expect(stone.p.distanceTo(other.p), setting).toBeGreaterThan((stone.r + other.r) * 0.9);
      });
      // Every bead holds at least three stones.
      for (const bead of beads) expect(stones.filter((stone) => stone.p.distanceTo(bead.p) < stone.r * 1.7).length, setting).toBeGreaterThanOrEqual(3);
    }
  });

  it('builds each setting differently', () => {
    const tooth = meshes.get('top_teeth008')!;
    const [honeycomb, prong, mosaic] = (['honeycomb', 'prong', 'mosaic'] as const).map((setting) => layoutFor(tooth, setting, 0, moulds()));
    const sizes = (layout: typeof honeycomb) => new Set(layout.stones.map((stone) => stone.r.toFixed(6))).size;
    // Honeycomb: a bead in each gap between three stones, about two to a stone. Prong: one where four meet.
    expect(honeycomb.beads.length).toBeGreaterThan(honeycomb.stones.length * 1.3);
    expect(prong.beads.length).toBeGreaterThan(prong.stones.length * 0.6);
    expect(prong.beads.length).toBeLessThan(prong.stones.length * 1.1);
    // Mosaic: large and small stones, no beads.
    expect(mosaic.beads.length).toBe(0);
    expect(sizes(mosaic)).toBeGreaterThan(1);
    expect(sizes(honeycomb)).toBe(1);
  });

  it('keeps stones off the root under the gum, on every tooth', () => {
    for (const [name, tooth] of meshes) {
      if (!/_teeth\d{3}$/.test(name)) continue;
      const frame = frameOf(tooth.geometry);
      const gum = new Relief(moulds().map((mould) => ({ geometry: mould.geometry, matrix: mould.matrix })), frame.centre, frame.across, frame.up, frame.facial, frame.reach);
      const { stones } = layoutFor(tooth, 'honeycomb', 0, moulds());
      expect(stones.length, name).toBeGreaterThan(10);
      for (const stone of stones) {
        const offset = stone.p.clone().sub(frame.centre);
        const cover = gum.at(offset.dot(frame.across), offset.dot(frame.up));
        expect(cover === null || cover.depth < offset.dot(frame.facial), name).toBe(true);
      }
    }
  });

  it('is worked out once per tooth and setting', () => {
    const tooth = meshes.get('bottom_teeth008')!;
    expect(layoutFor(tooth, 'prong', 0, moulds())).toBe(layoutFor(tooth, 'prong', 0, moulds()));
  });
});

describe('the 3D view of an iced tooth', () => {
  it('carries the setting the customer chose', () => {
    const tooth = { metal: 'white', karat: '14k', type: 'iced', style: 'solid', setting: 'mosaic', stone: 'lab' } as const;
    expect(toothCustomization(tooth, { fangs: false, cut: 'deep' }, 7)).toMatchObject({ hasDiamonds: true, setting: 'mosaic', diamondType: 'lab' });
  });
});
