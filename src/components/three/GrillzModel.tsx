import { useCallback, useEffect, useMemo } from 'react';
import { useThree, type ThreeEvent } from '@react-three/fiber';
import { useGLTF } from '@react-three/drei';
import * as THREE from 'three';
import { createDiamondStones } from './DiamondStones';
import { dentalStone, polishedMetal, settingMetal } from './materials';
import { fangGeometry, finishFor, ICED_RING } from './styles';
import type { GrillzModelProps, ToothCustomization } from '../../lib/types';
import { useTenant } from '../../lib/tenant/useTenant';
import { mix, usableAccent } from '../../lib/tenant/theme';

const toothNameRegex = /^(top|bottom)_teeth(\d{3})$/;
const PERMANENT_GROW = 1.08;

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

// Stones share one cached geometry (DiamondStones), so only their material is disposed.
const disposeStones = (object: THREE.Object3D) => {
  object.traverse((child) => {
    if (!(child instanceof THREE.Mesh)) return;
    const childMaterials = Array.isArray(child.material) ? child.material : [child.material];
    childMaterials.forEach((material) => material.dispose());
  });
};

function GrillzModel({
  customizations,
  selectedTeeth,
  isSelectionMode,
  toggleToothSelection,
  onFocusTooth,
}: GrillzModelProps & { onFocusTooth?: (point: THREE.Vector3) => void }) {
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
    const finishCache = new Map<string, THREE.MeshPhysicalMaterial>();

    return { selected, mould, finishCache };
  }, [selectColor, selectGlow]);

  const selectedToothSet = useMemo(() => new Set(selectedTeeth), [selectedTeeth]);

  const getFinishMaterial = useCallback((customization: ToothCustomization) => {
    const metal = customization.metal ?? (customization.material === 'gold' ? 'yellow' : 'silver');
    const key = `${metal}:${customization.hasDiamonds ? 'set' : 'polished'}`;
    const existing = materials.finishCache.get(key);
    if (existing) return existing;
    const material = customization.hasDiamonds ? settingMetal(metal) : polishedMetal(metal);
    materials.finishCache.set(key, material);
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
        disposeStones(existingStones);
      }
      // Finishes are cached and shared between teeth, so they are only detached.
      const existingFinish = child.getObjectByName('tooth_finish');
      if (existingFinish) child.remove(existingFinish);

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

      if (isSelectionMode && isSelected) {
        child.material = materials.selected;
        return;
      }

      child.material = customization.material === 'default' ? materials.mould : getFinishMaterial(customization);

      const metal = customization.metal ?? (customization.material === 'gold' ? 'yellow' : 'silver');
      if (capped && customization.hasDiamonds) {
        // Iced open face: one ring of stones round the frame, the tooth showing in the middle.
        const openFace = customization.style === 'open-face';
        const stones = createDiamondStones(child, customization.diamondType, openFace ? ICED_RING : 0);
        stones.name = 'diamond_stones';
        child.add(stones);
        const finish = openFace ? finishFor(child, 'open-face', metal, true) : null;
        if (finish) child.add(finish);
      } else if (capped && customization.style) {
        const finish = finishFor(child, customization.style, metal);
        if (finish) child.add(finish);
      }
    });
    invalidate();
  }, [clonedScene, customizations, getFinishMaterial, invalidate, isSelectionMode, materials, selectedToothSet]);

  useEffect(() => {
    return () => {
      materials.selected.dispose();
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
