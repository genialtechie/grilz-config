import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import * as THREE from 'three';
import { TOOTH_DATA } from '../../components/three/redesign/toothData';
import { buildPiece, SCENE_PER_MM, toothName } from '../../components/three/redesign/piece';
import { capGeo, fangOf, FANG, LOWER, MM, shape, SIDE, stoneLayout, toothGeo, UPPER } from '../../components/three/redesign/sculpt';
import type { Look } from '../../components/three/redesign/look';
import { capShape, toothLook } from '../../components/three/redesign/dress';
import { toothCustomization } from '../toothCustomization';
import { FANG_TEETH, SETTINGS } from '../renderSpec';
import { MODEL_SIZE } from '../framing';

// The redesign's piece (src/components/three/redesign), checked against the
// approved prototype it was ported from (docs/redesign/prototype).

/** Plain stand-ins for the materials: building the piece only hangs them on meshes. */
const look = () => {
  const plain = new THREE.MeshBasicMaterial();
  return { resinTooth: plain, resinBack: plain, resinGum: plain, resinBlock: plain, depthOnly: plain } as unknown as Look;
};

describe('the tooth shapes', () => {
  it('are the prototype’s, number for number', () => {
    const source = readFileSync(new URL('../../../docs/redesign/prototype/src/25-teeth.js', import.meta.url), 'utf8');
    const prototype = JSON.parse(source.slice(source.indexOf('{'), source.lastIndexOf('}') + 1));
    expect(TOOTH_DATA).toEqual(prototype);
  });

  it('are smoothed twice, closed at the root, the left side a mirror of the right', () => {
    const right = shape(UPPER[0]);
    const left = shape([...UPPER[0].slice(0, 5), 1, 0] as unknown as typeof UPPER[0]);
    expect(right.nv).toBeGreaterThan(2000);
    expect(left.x0).toBeCloseTo(-right.x1, 6);
    expect(toothGeo(UPPER[0]).index!.count).toBeGreaterThan(right.nt);
  });

  it('draws a fang out of the canine, the extra length long', () => {
    const canine = UPPER[2];
    expect(canine[0]).toBe('can');
    expect(shape(fangOf(canine)).y1 - shape(canine).y1).toBeCloseTo(FANG, 1);
  });
});

describe('the piece', () => {
  const piece = buildPiece(look());
  piece.root.updateMatrixWorld(true);
  const centre = (index: number) => new THREE.Box3().setFromObject(piece.teeth[index].resin).getCenter(new THREE.Vector3());

  it('has 32 teeth, named and numbered as the old model was', () => {
    expect(piece.teeth).toHaveLength(32);
    piece.teeth.forEach((slot, index) => {
      expect(slot.index).toBe(index);
      expect(slot.group.name).toBe(toothName(index));
      expect(piece.root.getObjectByName(toothName(index))).toBe(slot.group);
    });
    expect(toothName(0)).toBe('top_teeth001');
    expect(toothName(31)).toBe('bottom_teeth016');
  });

  it('runs each row from the viewer’s right (0) to the left (15), the front teeth in the middle', () => {
    for (const row of [0, 16]) {
      expect(centre(row).x).toBeGreaterThan(0.5);
      expect(centre(row + 15).x).toBeLessThan(-0.5);
      expect(centre(row + 7).x).toBeGreaterThan(0);
      expect(centre(row + 8).x).toBeLessThan(0);
      // The front teeth stand furthest forward.
      expect(centre(row + 7).z).toBeGreaterThan(centre(row + 3).z);
    }
    // Fangs are built on the upper canines.
    for (const index of FANG_TEETH) expect(piece.teeth[index].def[0]).toBe('can');
  });

  it('closes the bite: the upper front teeth just over and in front of the lower ones', () => {
    const upper = new THREE.Box3().setFromObject(piece.teeth[7].resin);
    const lower = new THREE.Box3().setFromObject(piece.teeth[23].resin);
    const overlap = (upper.min.y - lower.max.y) / (MM * piece.root.scale.x);
    // About 1.6 mm of overbite (the lower tips sit above the upper edge, behind it).
    expect(overlap).toBeLessThan(-1);
    expect(overlap).toBeGreaterThan(-2.5);
    expect(upper.max.z).toBeGreaterThan(lower.max.z);
  });

  it('sits centred on the stage, the size the framing expects', () => {
    piece.root.traverse((object) => {
      if (object.name === 'piece_shadow') object.visible = false;
    });
    const box = new THREE.Box3();
    piece.root.traverse((object) => {
      if (object instanceof THREE.Mesh && object.visible) box.expandByObject(object);
    });
    const size = box.getSize(new THREE.Vector3());
    const middle = box.getCenter(new THREE.Vector3());
    expect(Math.abs(middle.x)).toBeLessThan(0.02);
    expect(Math.abs(middle.y)).toBeLessThan(0.05);
    expect(size.x).toBeCloseTo(MODEL_SIZE.width, 1);
    expect(size.y).toBeCloseTo(MODEL_SIZE.height, 1);
    // Teeth keep the old model's scale: a front tooth about 9 mm wide.
    const front = new THREE.Box3().setFromObject(piece.teeth[7].resin).getSize(new THREE.Vector3());
    expect(front.x / SCENE_PER_MM).toBeGreaterThan(8);
    expect(front.x / SCENE_PER_MM).toBeLessThan(10.5);
  });
});

describe('caps', () => {
  it('are worked out once per tooth shape and cut', () => {
    expect(capGeo(UPPER[0], SIDE.deep)).toBe(capGeo(UPPER[0], SIDE.deep));
    expect(capGeo(UPPER[0], SIDE.permanent)).not.toBe(capGeo(UPPER[0], SIDE.deep));
  });

  it('follow the design: a fang on a canine, the cut, the karat', () => {
    const design = { metal: 'yellow', karat: '18k', type: 'plain', style: 'diamond-cut', setting: 'honeycomb', stone: 'moissanite' } as const;
    const t = toothLook(toothCustomization(design, { fangs: true, cut: 'permanent' }, 5))!;
    expect(t).toMatchObject({ metal: 'yellow', karat: '18k', type: 'plain', style: 'cut', fang: true, cut: 'permanent' });
    const piece = buildPiece(look());
    const { def, rise } = capShape(piece.teeth[5], t);
    expect(def[6]).toBe(1);
    expect(rise).toBe(SIDE.permanent);
    expect(toothLook({ material: 'default', color: '#fff', hasDiamonds: false })).toBeNull();
  });
});

describe('stones on a tooth', () => {
  const settings = SETTINGS.map((setting) => setting.id);
  const front = UPPER[0];

  it('covers a front tooth like real work, none on top of another', () => {
    // The prototype's layouts on an upper front tooth: honeycomb 81 stones, mosaic 63, prong 52 (larger stones, with beads).
    const least = { honeycomb: 75, mosaic: 55, prong: 45 };
    for (const setting of settings) {
      const { stones, spots } = stoneLayout(front, SIDE.deep, setting, false);
      expect(stones.length, setting).toBeGreaterThan(least[setting]);
      expect(stones.length, setting).toBeLessThan(120);
      spots.forEach((stone, i) => {
        for (const other of spots.slice(i + 1)) expect(stone.p.distanceTo(other.p) / MM, setting).toBeGreaterThan((stone.r + other.r) * 0.9);
      });
    }
  });

  it('builds each setting differently', () => {
    const [honeycomb, prong, mosaic] = (['honeycomb', 'prong', 'mosaic'] as const).map((setting) => stoneLayout(front, SIDE.deep, setting, false));
    const sizes = (layout: typeof honeycomb) => new Set(layout.spots.map((stone) => stone.r)).size;
    // Prong: a gold bead between the rows. Honeycomb and mosaic: stones edge to edge.
    expect(prong.beads.length).toBeGreaterThan(prong.stones.length * 0.5);
    expect(honeycomb.beads).toHaveLength(0);
    expect(sizes(mosaic)).toBe(2);
    expect(sizes(honeycomb)).toBe(1);
  });

  it('runs one row of stones round an iced open face', () => {
    const ring = stoneLayout(front, SIDE.deep, 'honeycomb', true);
    const full = stoneLayout(front, SIDE.deep, 'honeycomb', false);
    expect(ring.stones.length).toBeGreaterThan(20);
    expect(ring.stones.length).toBeLessThan(full.stones.length);
  });

  it('works on every tooth, lower row too', () => {
    for (const def of [...UPPER, ...LOWER]) expect(stoneLayout(def, SIDE.deep, 'honeycomb', false).stones.length, def[4]).toBeGreaterThan(10);
  });

  it('is worked out once per tooth and setting', () => {
    expect(stoneLayout(LOWER[0], SIDE.deep, 'prong', false)).toBe(stoneLayout(LOWER[0], SIDE.deep, 'prong', false));
  });
});

describe('the 3D view of an iced tooth', () => {
  it('carries the setting the customer chose', () => {
    const tooth = { metal: 'white', karat: '14k', type: 'iced', style: 'solid', setting: 'mosaic', stone: 'lab' } as const;
    expect(toothCustomization(tooth, { fangs: false, cut: 'deep' }, 7)).toMatchObject({ hasDiamonds: true, setting: 'mosaic', diamondType: 'lab', karat: '14k' });
  });
});
