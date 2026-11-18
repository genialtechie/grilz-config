import * as THREE from 'three';
import { DEFAULT_TOOTH, type CharmId, type KaratId, type MetalId, type OpalId, type SettingId, type StyleId } from '../../../lib/renderSpec';
import type { ToothCustomization } from '../../../lib/types';
import { buildCharm } from './charms';
import type { Finish, Look } from './look';
import { noRaycast, type ToothSlot } from './piece';
import { beadGeo, capGeo, fangOf, gemGeo, maskTex, RIM, rimGeo, SIDE, sharedPatch, stoneLayout, TUBE, WIN, type ToothDef } from './sculpt';

// Dressing a tooth (a port of dress() in docs/redesign/prototype/src/40-scene.js):
// its cap, finish, stones and panels, from what the builder asks the 3D view
// to draw for that tooth (ToothCustomization, made from the RenderSpec).

/** The stones and their beads hang in a group with the old model's name: captures that leave stones out find them by it. */
export const STONES = 'diamond_stones';
/** The opal and photo panels sit this far in from the cap's edge (mm), each inside a gold rim. */
export const OPAL_INSET = 0.95;
export const PHOTO_INSET = 0.5;

/** One tooth's design in the prototype's terms. */
export type ToothLook = {
  metal: MetalId;
  karat: KaratId;
  type: 'plain' | 'iced' | 'photo';
  /** The finish on a plain cap; 'open' on any cap (an iced open face is a frame of stones). */
  style: Finish | 'open' | 'opal';
  opal: OpalId;
  setting: SettingId;
  fang: boolean;
  cut: 'deep' | 'permanent';
  /** A one-of-one charm on the face. */
  charm: CharmId | null;
};

const STYLE: Record<StyleId, ToothLook['style']> = {
  solid: 'solid',
  'open-face': 'open',
  'diamond-cut': 'cut',
  'diamond-dust': 'dust',
  engraving: 'engr',
  opals: 'opal',
};

/** What a tooth wears, or null for a bare tooth (not in the set). */
export function toothLook(customization: ToothCustomization | undefined): ToothLook | null {
  if (!customization || customization.material === 'default') return null;
  const type = customization.hasDiamonds ? 'iced' : customization.photo ? 'photo' : 'plain';
  return {
    metal: customization.metal ?? (customization.material === 'gold' ? 'yellow' : 'silver'),
    karat: customization.karat ?? DEFAULT_TOOTH.karat,
    type,
    style: customization.style ? STYLE[customization.style] : 'solid',
    opal: customization.opal ?? 'white',
    setting: customization.setting ?? 'honeycomb',
    fang: Boolean(customization.fang),
    cut: customization.cut === 'permanent' ? 'permanent' : 'deep',
    charm: customization.charm ?? null,
  };
}

/** The shape a dressed tooth's cap follows (a fang on a canine), and how its edge arches. */
export function capShape(slot: ToothSlot, t: ToothLook): { def: ToothDef; rise: number } {
  return { def: t.fang ? fangOf(slot.def) : slot.def, rise: SIDE[t.cut] };
}

function instanced(geometry: THREE.BufferGeometry, material: THREE.Material, list: THREE.Matrix4[]) {
  const im = new THREE.InstancedMesh(geometry, material, list.length);
  list.forEach((m, n) => im.setMatrixAt(n, m));
  im.instanceMatrix.needsUpdate = true;
  // The instances spread over the whole tooth; the mesh's own bounds would be one stone.
  im.frustumCulled = false;
  // A tap on a stone is a tap on its tooth, right under it.
  im.raycast = noRaycast;
  return im;
}

function clearDeco(slot: ToothSlot) {
  if (!slot.deco) return;
  slot.cap.remove(slot.deco);
  // Geometry and materials are shared and kept; only the stones' own instance buffers go.
  slot.deco.traverse((child) => {
    if (child instanceof THREE.InstancedMesh) child.dispose();
  });
  slot.deco = null;
}

/**
 * Dresses one tooth: its cap, finish, stones and panels. Returns whether
 * anything changed (a tooth already dressed this way is left as it is).
 */
export function dressTooth(slot: ToothSlot, look: Look, t: ToothLook | null): boolean {
  if (!t) {
    if (slot.key === 'bare') return false;
    slot.key = 'bare';
    clearDeco(slot);
    slot.cap.visible = false;
    slot.cap.raycast = noRaycast;
    slot.spots = [];
    return true;
  }
  const { def, rise } = capShape(slot, t);
  const key = [def.join('_'), rise, t.metal, t.karat, t.type, t.style, t.opal, t.setting, t.charm ?? ''].join('|');
  if (slot.key === key) return false;
  slot.key = key;
  clearDeco(slot);
  slot.spots = [];
  const cap = slot.cap;
  cap.visible = true;
  // The cap takes taps (a fang reaches past the clear tooth under it).
  cap.raycast = THREE.Mesh.prototype.raycast;
  cap.geometry = capGeo(def, rise);
  const gold = look.matFor(t.metal, t.karat, 'solid');
  const plain = t.type === 'plain';
  const iced = t.type === 'iced';
  const open = t.style === 'open' && t.type !== 'photo';
  const deco = new THREE.Group();
  deco.name = 'tooth_finish';
  const mesh = (g: THREE.BufferGeometry, m: THREE.Material) => {
    const x = new THREE.Mesh(g, m);
    x.raycast = noRaycast;
    deco.add(x);
    return x;
  };
  const finish: Finish = plain && (t.style === 'cut' || t.style === 'dust' || t.style === 'engr') ? t.style : 'solid';
  cap.material = look.matFor(t.metal, t.karat, finish, open ? maskTex(def, rise) : null);
  // Kept, to put back after the tooth has shown as picked.
  cap.userData.dressed = cap.material;
  if (open) mesh(rimGeo(def, rise, WIN, 0.15), gold);
  if (iced) {
    const layout = stoneLayout(def, rise, t.setting, open);
    const stones = new THREE.Group();
    stones.name = STONES;
    stones.add(instanced(gemGeo, look.diamondMat, layout.stones));
    if (layout.beads.length) stones.add(instanced(beadGeo, gold, layout.beads));
    deco.add(stones);
    mesh(rimGeo(def, rise, RIM, TUBE), gold);
    slot.spots = layout.spots;
  }
  if (plain && t.style === 'opal') {
    mesh(sharedPatch(def, rise, OPAL_INSET, 0.1), look.opalMat(t.opal));
    mesh(rimGeo(def, rise, OPAL_INSET, 0.16), gold);
  }
  // The picture itself is laid across the whole run of photo teeth (overlays.ts); the rim is the tooth's own.
  if (t.type === 'photo') mesh(rimGeo(def, rise, PHOTO_INSET, 0.13), gold);
  if (t.charm) deco.add(buildCharm(def, slot.upper, t.charm, look, gold));
  cap.add(deco);
  slot.deco = deco;
  return true;
}
