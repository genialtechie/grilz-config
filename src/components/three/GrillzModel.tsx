import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useFrame, useThree, type ThreeEvent } from '@react-three/fiber';
import { useGLTF } from '@react-three/drei';
import * as THREE from 'three';
import { createDiamondStones, disposeDiamondStones } from './DiamondStones';
import { gemSupport } from './gems';
import { dentalStone, polishedMetal } from './materials';
import { fangGeometry, finishFor, ICED_RING } from './styles';
import { clearInscriptionDecals, inscriptionDecals, loadInscriptionFont } from './inscriptions';
import { clearPhotoDecals, loadPhoto, photoDecals, photoRuns } from './photoDecals';
import type { GrillzModelProps, ToothCustomization } from '../../lib/types';
import { useTenant } from '../../lib/tenant/useTenant';
import { mix, usableAccent } from '../../lib/tenant/theme';

const toothNameRegex = /^(top|bottom)_teeth(\d{3})$/;
const PERMANENT_GROW = 1.08;
/** The outline round a tooth picked to style on its own: a slightly bigger back-face shell. */
const MARK_GROW = 1.12;

const getToothIndexFromName = (name: string): number | null => {
  const match = name.match(toothNameRegex);
  if (!match) return null;

  const [, row, numberString] = match;
  const toothNumber = Number.parseInt(numberString, 10) - 1;
  return row === 'top' ? toothNumber : 16 + toothNumber;
};

const findToothMesh = (object: THREE.Object3D): THREE.Mesh | null => {
  let current: THREE.Object3D | null = object;
  while (current) {
    if (current instanceof THREE.Mesh && getToothIndexFromName(current.name) !== null) {
      return current;
    }
    current = current.parent;
  }
  return null;
};

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
}: Omit<GrillzModelProps, 'poster'> & { onFocusTooth?: (point: THREE.Vector3) => void; onDrawn?: () => void }) {
  const { scene } = useGLTF('/assets/teeth_final.glb');
  // The canvas draws on demand: changes made here ask for a frame.
  const invalidate = useThree((state) => state.invalidate);

  const clonedScene = useMemo(() => {
    const clone = scene.clone(true);

    clone.traverse((child) => {
      if (!(child instanceof THREE.Mesh)) return;
      child.castShadow = true;
      child.receiveShadow = true;
      // The tooth as modelled; a fang swaps in a drawn-out copy and swaps back.
      child.userData.baseGeometry = child.geometry;
      if (!child.geometry.boundingBox) child.geometry.computeBoundingBox();
      child.userData.centre = child.geometry.boundingBox!.getCenter(new THREE.Vector3());
    });

    return clone;
  }, [scene]);

  // Selected teeth glow in the shop's accent (the demo keeps its original red).
  const tenant = useTenant();
  const selectColor = tenant.demo ? '#ce4257' : usableAccent(tenant.config.brand.accent);
  const selectGlow = tenant.demo ? '#712432' : mix(selectColor, '#000000', 0.45);

  const materials = useMemo(() => {
    const selected = new THREE.MeshStandardMaterial({
      color: selectColor,
      emissive: selectGlow,
      emissiveIntensity: 0.22,
      metalness: 0.25,
      roughness: 0.34,
    });
    // The mould and the bare teeth are one dental-stone cast, as on a jeweler's bench.
    const mould = dentalStone();
    const mark = new THREE.MeshBasicMaterial({ color: selectColor, side: THREE.BackSide });
    const finishCache = new Map<string, THREE.MeshPhysicalMaterial>();

    return { selected, mark, mould, finishCache };
  }, [selectColor, selectGlow]);

  const selectedToothSet = useMemo(() => new Set(selectedTeeth), [selectedTeeth]);
  /** Bumped to redress the teeth when the stones have to change material (see gemSupport). */
  const [stoneEpoch, setStoneEpoch] = useState(0);

  // The gums, for keeping stones on the part of each tooth that shows.
  const moulds = useMemo(() => {
    const found: THREE.Mesh[] = [];
    clonedScene.traverse((child) => {
      if (child instanceof THREE.Mesh && (child.name === 'top_mould' || child.name === 'bottom_mould')) found.push(child);
    });
    return found;
  }, [clonedScene]);

  // The cap's own metal, polished, iced or not: round an iced face it is the rim the stones sit in.
  const getFinishMaterial = useCallback((customization: ToothCustomization) => {
    const metal = customization.metal ?? (customization.material === 'gold' ? 'yellow' : 'silver');
    const existing = materials.finishCache.get(metal);
    if (existing) return existing;
    const material = polishedMetal(metal);
    materials.finishCache.set(metal, material);
    return material;
  }, [materials]);

  useEffect(() => {
    clonedScene.traverse((child) => {
      if (!(child instanceof THREE.Mesh)) return;

      if (child.name === 'bottom_mould' || child.name === 'top_mould') {
        child.material = materials.mould;
        return;
      }

      const index = getToothIndexFromName(child.name);
      if (index === null || index >= customizations.length) return;

      const existingStones = child.getObjectByName('diamond_stones');
      if (existingStones) {
        child.remove(existingStones);
        disposeDiamondStones(existingStones);
      }
      // Finishes are cached and shared between teeth, so they are only detached.
      const existingFinish = child.getObjectByName('tooth_finish');
      if (existingFinish) child.remove(existingFinish);
      const existingMark = child.getObjectByName('tooth_mark');
      if (existingMark) child.remove(existingMark);

      const customization = customizations[index];
      const isSelected = selectedToothSet.has(index);
      const capped = customization.material !== 'default';
      const base = child.userData.baseGeometry as THREE.BufferGeometry;
      child.geometry = capped && customization.fang ? fangGeometry(base) : base;
      // Permanent look: fuller caps, grown about the tooth's own centre until
      // neighbours meet and the metal reaches the gum. Deep cut keeps the teeth apart.
      const grow = capped && customization.cut === 'permanent' ? PERMANENT_GROW : 1;
      child.scale.setScalar(grow);
      child.position.copy(child.userData.centre as THREE.Vector3).multiplyScalar(1 - grow);

      if (isSelectionMode && isSelected && selectionLook === 'fill') {
        child.material = materials.selected;
        return;
      }
      if (isSelectionMode && isSelected && selectionLook === 'outline') {
        // Styling this tooth on its own: it keeps its design, outlined, so each change shows.
        const mark = new THREE.Mesh(child.geometry, materials.mark);
        mark.name = 'tooth_mark';
        mark.scale.setScalar(MARK_GROW);
        mark.position.copy(child.userData.centre as THREE.Vector3).multiplyScalar(1 - MARK_GROW);
        mark.raycast = () => {};
        child.add(mark);
      }

      child.material = customization.material === 'default' ? materials.mould : getFinishMaterial(customization);

      const metal = customization.metal ?? (customization.material === 'gold' ? 'yellow' : 'silver');
      if (capped && customization.hasDiamonds) {
        // Iced open face: one ring of stones round the frame, the tooth showing in the middle.
        const openFace = customization.style === 'open-face';
        const stones = createDiamondStones(child, {
          kind: customization.diamondType === 'moissanite' ? 'moissanite' : 'diamond',
          setting: customization.setting,
          metal,
          ring: openFace ? ICED_RING : 0,
          moulds,
        });
        stones.name = 'diamond_stones';
        child.add(stones);
        const finish = openFace ? finishFor(child, 'open-face', metal, true) : null;
        if (finish) child.add(finish);
      } else if (capped && customization.style) {
        const finish = finishFor(child, customization.style, metal, false, customization.opal);
        if (finish) child.add(finish);
      }
    });
    invalidate();
    dressed.current = true;
  }, [clonedScene, customizations, getFinishMaterial, invalidate, isSelectionMode, materials, moulds, selectedToothSet, selectionLook, stoneEpoch]);

  // The traced stones need a shader some graphics drivers may refuse. Once it has been built,
  // check it ran; if not, dress the teeth again and the stones come back in a plain material.
  const stonesChecked = useRef(false);
  useFrame(({ gl }) => {
    if (stonesChecked.current) return;
    const support = gemSupport(gl);
    if (support === 'pending') return;
    stonesChecked.current = true;
    if (support === 'unsupported') setStoneEpoch((epoch) => epoch + 1);
  });

  // Says when the dressed model is on screen: one frame after the first one that draws
  // it (that frame compiles the shaders, which can take a moment on a phone).
  const dressed = useRef(false);
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

  // Letters, after the teeth are dressed (fang shapes and permanent-look scale change where they land).
  const inscriptionKey = JSON.stringify(inscriptions ?? []);
  useEffect(() => {
    const list = inscriptions ?? [];
    const disposed = new Set<THREE.Material>();
    const teeth = new Map<number, THREE.Mesh>();
    clonedScene.traverse((child) => {
      if (!(child instanceof THREE.Mesh)) return;
      const index = getToothIndexFromName(child.name);
      if (index === null) return;
      teeth.set(index, child);
      clearInscriptionDecals(child, disposed);
    });
    if (!list.length) {
      invalidate();
      return;
    }
    let cancelled = false;
    void Promise.all(list.map((inscription) => loadInscriptionFont(inscription.font))).then(() => {
      if (cancelled) return;
      list.forEach((inscription) => {
        const meshes = inscription.teeth.map((index) => teeth.get(index)).filter((mesh): mesh is THREE.Mesh => Boolean(mesh));
        const metal = customizations[inscription.teeth[0]]?.metal ?? 'yellow';
        inscriptionDecals(inscription, meshes, metal).forEach(({ tooth, decal }) => tooth.add(decal));
      });
      invalidate();
    });
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [clonedScene, customizations, inscriptionKey, invalidate]);

  // Photo teeth: the customer's picture (or the stand-in) across each run of neighbouring photo teeth.
  const photoTeeth = customizations.flatMap((tooth, index) => (tooth.photo && tooth.material !== 'default' ? [index] : []));
  const photoKey = photoTeeth.join(',');
  useEffect(() => {
    const disposed = new Set<THREE.Material>();
    const teeth = new Map<number, THREE.Mesh>();
    clonedScene.traverse((child) => {
      if (!(child instanceof THREE.Mesh)) return;
      const index = getToothIndexFromName(child.name);
      if (index === null) return;
      teeth.set(index, child);
      clearPhotoDecals(child, disposed);
    });
    if (!photoTeeth.length) {
      invalidate();
      return;
    }
    let cancelled = false;
    void loadPhoto(photoImage).then((image) => {
      if (cancelled) return;
      photoRuns(photoTeeth).forEach((run) => {
        const meshes = run.map((index) => teeth.get(index)).filter((mesh): mesh is THREE.Mesh => Boolean(mesh));
        photoDecals(meshes, image).forEach(({ tooth, decal }) => tooth.add(decal));
      });
      invalidate();
    });
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [clonedScene, customizations, photoKey, photoImage, invalidate]);

  useEffect(() => {
    return () => {
      materials.selected.dispose();
      materials.mark.dispose();
      materials.mould.dispose();
      materials.finishCache.forEach((material) => material.dispose());
    };
  }, [materials]);

  const handleToothClick = (event: ThreeEvent<MouseEvent>) => {
    if (!isSelectionMode) {
      // Outside selection, a tap on the set glides in for a closer look.
      event.stopPropagation();
      onFocusTooth?.(event.point.clone());
      return;
    }
    const tooth = findToothMesh(event.object);
    if (!tooth) return;
    event.stopPropagation();
    const toothIndex = getToothIndexFromName(tooth.name);
    if (toothIndex !== null) toggleToothSelection(toothIndex);
  };

  return (
    <primitive
      object={clonedScene}
      scale={34}
      onClick={handleToothClick}
      onPointerOver={() => {
        if (isSelectionMode) document.body.style.cursor = 'pointer';
      }}
      onPointerOut={() => {
        document.body.style.cursor = 'default';
      }}
    />
  );
}

useGLTF.preload('/assets/teeth_final.glb');

export default GrillzModel;
