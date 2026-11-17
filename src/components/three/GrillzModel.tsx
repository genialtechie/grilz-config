import { useEffect, useMemo, useRef } from 'react';
import { useFrame, useThree, type ThreeEvent } from '@react-three/fiber';
import * as THREE from 'three';
import { loadInscriptionFont, INSCRIPTION_DECAL } from './inscriptions';
import { loadPhoto, PHOTO_DECAL, photoRuns } from './photoDecals';
import { capShape, dressTooth, toothLook, type ToothLook } from './redesign/dress';
import { Glints } from './redesign/glints';
import { lookFor } from './redesign/look';
import { clearOverlay, layLetters, layPhoto, type Shaped } from './redesign/overlays';
import { buildPiece, noRaycast, SCENE_SCALE, setJaw, type ToothSlot } from './redesign/piece';
import { capGeo, MM, SIDE, toothGeo } from './redesign/sculpt';
import { CAP_LAYER, GLOW_LAYER, glowMaterial, LIFT } from './redesign/glow';
import type { GrillzModelProps } from '../../lib/types';
import { useTenant } from '../../lib/tenant/useTenant';
import { mix, usableAccent } from '../../lib/tenant/theme';

// The set on its stand: the redesign's sculpted teeth in a clear resin holder,
// dressed from what the builder asks for each tooth (redesign/, a port of the
// approved prototype in docs/redesign/prototype). The piece is built once, in
// code (nothing is downloaded), and only the teeth that change are redressed.

const toothNameRegex = /^(top|bottom)_teeth(\d{3})$/;
/** The outline round a tooth picked to style on its own: a slightly bigger back-face shell. */
const MARK_GROW = 1.12;
/** How far a glint stands off its stone, in the scene's units (the prototype's, scaled up). */
const GLINT_LIFT = 0.012 * SCENE_SCALE;

const getToothIndexFromName = (name: string): number | null => {
  const match = name.match(toothNameRegex);
  if (!match) return null;
  const [, row, numberString] = match;
  const toothNumber = Number.parseInt(numberString, 10) - 1;
  return row === 'top' ? toothNumber : 16 + toothNumber;
};

/** The tooth a picked object belongs to. */
const findTooth = (object: THREE.Object3D): number | null => {
  for (let current: THREE.Object3D | null = object; current; current = current.parent) {
    const index = getToothIndexFromName(current.name);
    if (index !== null) return index;
  }
  return null;
};

/** The prototype numbers each row the other way round; glints pick their stones by its numbering, so they fall as there. */
const prototypeOrder = (index: number) => (index < 16 ? 0 : 16) + 15 - (index % 16);

function GrillzModel({
  customizations,
  selectedTeeth,
  isSelectionMode,
  selectionLook = 'fill',
  toggleToothSelection,
  inscriptions,
  photoImage,
  onFocusTooth,
  onDrawn,
  jawOpen = false,
}: Omit<GrillzModelProps, 'poster' | 'frame' | 'onMissTap'> & { onFocusTooth?: (point: THREE.Vector3) => void; onDrawn?: () => void }) {
  const gl = useThree((state) => state.gl);
  const scene = useThree((state) => state.scene);
  // The canvas draws on demand: changes made here ask for a frame.
  const invalidate = useThree((state) => state.invalidate);

  const look = useMemo(() => lookFor(gl), [gl]);
  const piece = useMemo(() => buildPiece(look), [look]);
  const glints = useMemo(() => new Glints(GLINT_LIFT), []);
  useEffect(() => () => glints.dispose(), [glints]);

  // The studio lights whatever has no room of its own: the selection colour, and the plain white
  // teeth and flat colours the captures swap in.
  useEffect(() => {
    const previous = scene.environment;
    scene.environment = look.studioEnv;
    return () => {
      scene.environment = previous;
    };
  }, [scene, look]);

  // Selected teeth glow in the shop's accent (the demo keeps its original red).
  const tenant = useTenant();
  const selectColor = tenant.demo ? '#ce4257' : usableAccent(tenant.config.brand.accent);
  const selectGlow = tenant.demo ? '#712432' : mix(selectColor, '#000000', 0.45);
  const marks = useMemo(
    () => ({
      selected: new THREE.MeshStandardMaterial({ color: selectColor, emissive: selectGlow, emissiveIntensity: 0.22, metalness: 0.25, roughness: 0.34, side: THREE.DoubleSide }),
      mark: new THREE.MeshBasicMaterial({ color: selectColor, side: THREE.BackSide }),
    }),
    [selectColor, selectGlow],
  );
  useEffect(
    () => () => {
      marks.selected.dispose();
      marks.mark.dispose();
    },
    [marks],
  );

  // The creator's picked teeth: an amber glow above the holder (redesign/glow.ts, drawn by GlowPass).
  const glowMat = useMemo(() => glowMaterial(), []);
  useEffect(() => () => glowMat.dispose(), [glowMat]);
  const glowing = selectionLook === 'glow' && isSelectionMode;

  const looks = useMemo(() => Array.from({ length: 32 }, (_, index) => toothLook(customizations[index])), [customizations]);
  const selectedToothSet = useMemo(() => new Set(selectedTeeth), [selectedTeeth]);

  // Dress the teeth, then mark the picked ones.
  const dressed = useRef(false);
  useEffect(() => {
    piece.teeth.forEach((slot, index) => {
      const t = looks[index];
      dressTooth(slot, look, t);
      const selected = isSelectionMode && selectedToothSet.has(index);
      showSelection(slot, t, selected && selectionLook === 'fill', selected && selectionLook === 'outline', marks);
      showGlow(slot, glowing && selected && slot.cap.visible, glowMat);
    });
    glints.collect(
      piece.teeth
        .filter((slot) => slot.cap.visible && slot.deco?.visible !== false)
        .map((slot) => ({ cap: slot.cap, spots: slot.spots, order: prototypeOrder(slot.index) })),
    );
    invalidate();
    dressed.current = true;
  }, [piece, look, looks, glints, isSelectionMode, selectedToothSet, selectionLook, marks, invalidate, glowing, glowMat]);

  // Picked teeth lift a little out of the arch, the glow breathes, and the mouth opens and closes.
  const jaw = useRef(0);
  useFrame(() => {
    const still = reducedMotion();
    let moving = false;
    piece.teeth.forEach((slot) => {
      const data = slot.group.userData as { base?: THREE.Vector3; lift?: number };
      const want = glowing && selectedToothSet.has(slot.index) && slot.cap.visible ? 1 : 0;
      const now = data.lift ?? 0;
      if (Math.abs(want - now) < 0.002) return;
      data.base ??= slot.group.position.clone();
      data.lift = still ? want : now + (want - now) * 0.16;
      slot.group.position.copy(data.base).addScaledVector(slot.out, data.lift * LIFT * MM);
      moving = true;
    });
    const goal = jawOpen ? 1 : 0;
    if (Math.abs(goal - jaw.current) > 0.002) {
      jaw.current = still ? goal : jaw.current + (goal - jaw.current) * 0.12;
      setJaw(piece, jaw.current);
      moving = true;
    }
    if (glowing && selectedToothSet.size && !still) {
      glowMat.uniforms.t.value = performance.now();
      moving = true;
    }
    if (moving) invalidate();
  });

  // The glints follow the camera.
  useFrame(({ camera }) => {
    piece.root.updateMatrixWorld();
    glints.update(camera, gl.getPixelRatio());
  });

  // Says when the dressed model is on screen: one frame after the first one that draws
  // it (that frame compiles the shaders, which can take a moment on a phone).
  const announced = useRef(false);
  useFrame(() => {
    if (!dressed.current || announced.current) return;
    announced.current = true;
    requestAnimationFrame(() => {
      // Also a mark for load-time measurements.
      performance.mark('vvs:model-drawn');
      onDrawn?.();
    });
  });

  /** A tooth with the shape its cap is dressed in (letters and pictures lie on that face). */
  const shaped = (index: number): Shaped | null => {
    const slot = piece.teeth[index];
    const t = looks[index];
    if (!slot) return null;
    const { def, rise } = t ? capShape(slot, t) : { def: slot.def, rise: SIDE.deep };
    return { slot, def, rise };
  };

  // Letters, after the teeth are dressed (a fang or the cut changes the face they lie on).
  const inscriptionKey = JSON.stringify(inscriptions ?? []);
  const shapeKey = looks.map((t) => (t ? `${t.fang}${t.cut}${t.metal}` : '')).join(',');
  useEffect(() => {
    const list = inscriptions ?? [];
    const disposed = new Set<THREE.Material>();
    piece.teeth.forEach((slot) => clearOverlay(slot, INSCRIPTION_DECAL, disposed));
    if (!list.length) {
      invalidate();
      return;
    }
    let cancelled = false;
    void Promise.all(list.map((inscription) => loadInscriptionFont(inscription.font))).then(() => {
      if (cancelled) return;
      list.forEach((inscription) => {
        const run = inscription.teeth.map(shaped).filter((item): item is Shaped => Boolean(item));
        const metal = customizations[inscription.teeth[0]]?.metal ?? 'yellow';
        layLetters(piece, look, run, inscription, metal);
      });
      invalidate();
    });
    return () => {
      cancelled = true;
      const gone = new Set<THREE.Material>();
      piece.teeth.forEach((slot) => clearOverlay(slot, INSCRIPTION_DECAL, gone));
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [piece, look, inscriptionKey, shapeKey, invalidate]);

  // Photo teeth: the customer's picture (or the stand-in) across each run of neighbouring photo teeth.
  const photoTeeth = looks.flatMap((t, index) => (t?.type === 'photo' ? [index] : []));
  const photoKey = `${photoTeeth.join(',')}|${shapeKey}`;
  useEffect(() => {
    const disposed = new Set<THREE.Material>();
    piece.teeth.forEach((slot) => clearOverlay(slot, PHOTO_DECAL, disposed));
    if (!photoTeeth.length) {
      invalidate();
      return;
    }
    let cancelled = false;
    void Promise.all([loadPhoto(photoImage), loadInscriptionFont('block')]).then(([image]) => {
      if (cancelled) return;
      photoRuns(photoTeeth).forEach((indices) => {
        const run = indices.map(shaped).filter((item): item is Shaped => Boolean(item));
        layPhoto(piece, look, run, image);
      });
      invalidate();
    });
    return () => {
      cancelled = true;
      const gone = new Set<THREE.Material>();
      piece.teeth.forEach((slot) => clearOverlay(slot, PHOTO_DECAL, gone));
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [piece, look, photoKey, photoImage, invalidate]);

  const handleToothClick = (event: ThreeEvent<MouseEvent>) => {
    if (!isSelectionMode) {
      // Outside selection, a tap on the set glides in for a closer look.
      event.stopPropagation();
      onFocusTooth?.(event.point.clone());
      return;
    }
    const toothIndex = findTooth(event.object);
    // The holder: let the tap carry on to whatever tooth lies behind it.
    if (toothIndex === null) return;
    event.stopPropagation();
    toggleToothSelection(toothIndex);
  };

  return (
    <>
      <primitive
        object={piece.root}
        onClick={handleToothClick}
        onPointerOver={() => {
          if (isSelectionMode) document.body.style.cursor = 'pointer';
        }}
        onPointerOut={() => {
          document.body.style.cursor = 'default';
        }}
      />
      <primitive object={glints.points} />
    </>
  );
}

const reducedMotion = () => typeof window !== 'undefined' && Boolean(window.matchMedia?.('(prefers-reduced-motion: reduce)').matches);

/** The glow shell round a picked tooth's cap: made the first time it is needed, on the glow layer, never tapped. */
function showGlow(slot: ToothSlot, on: boolean, material: THREE.Material) {
  slot.cap.layers.enable(CAP_LAYER);
  let shell = slot.group.getObjectByName('tooth_glow') as THREE.Mesh | undefined;
  if (!on && !shell) return;
  if (!shell) {
    shell = new THREE.Mesh(slot.cap.geometry, material);
    shell.name = 'tooth_glow';
    shell.layers.set(GLOW_LAYER);
    shell.raycast = noRaycast;
    slot.group.add(shell);
  }
  shell.geometry = slot.cap.geometry;
  shell.visible = on;
}

/**
 * How a tooth shows while teeth are being picked: filled in the accent (choosing
 * teeth for letters), outlined in it (styling teeth on their own), or as dressed.
 */
function showSelection(slot: ToothSlot, t: ToothLook | null, fill: boolean, outline: boolean, marks: { selected: THREE.Material; mark: THREE.Material }) {
  const cap = slot.cap;
  if (fill) {
    if (!t) cap.geometry = capGeo(slot.def, SIDE.deep);
    cap.material = marks.selected;
    cap.visible = true;
    cap.raycast = THREE.Mesh.prototype.raycast;
  } else {
    cap.visible = Boolean(t);
    if (t) cap.material = cap.userData.dressed as THREE.Material;
    cap.raycast = t ? THREE.Mesh.prototype.raycast : noRaycast;
  }
  if (slot.deco) slot.deco.visible = !fill;

  if (slot.mark) {
    slot.group.remove(slot.mark);
    slot.mark = null;
  }
  if (outline) {
    // Round the cap only: the root stands inside the clear holder, where a shell round it would show.
    const geometry = t ? capGeo(capShape(slot, t).def, capShape(slot, t).rise) : toothGeo(slot.def);
    const mark = new THREE.Mesh(geometry, marks.mark);
    mark.name = 'tooth_mark';
    const centre = geometry.boundingBox!.getCenter(new THREE.Vector3());
    mark.scale.setScalar(MARK_GROW);
    mark.position.copy(centre).multiplyScalar(1 - MARK_GROW);
    mark.raycast = noRaycast;
    slot.group.add(mark);
    slot.mark = mark;
  }
}

export default GrillzModel;
