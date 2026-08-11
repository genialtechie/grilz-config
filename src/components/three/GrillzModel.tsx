import { useCallback, useEffect, useMemo } from 'react';
import { ThreeEvent } from '@react-three/fiber';
import { useGLTF } from '@react-three/drei';
import * as THREE from 'three';
import { createDiamondStones } from './DiamondStones';
import type { GrillzModelProps, ToothCustomization } from '../../lib/types';

const toothNameRegex = /^(top|bottom)_teeth(\d{3})$/;

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

const disposeObject = (object: THREE.Object3D) => {
  object.traverse((child) => {
    if (!(child instanceof THREE.Mesh)) return;
    child.geometry?.dispose();
    const childMaterials = Array.isArray(child.material) ? child.material : [child.material];
    childMaterials.forEach((material) => material.dispose());
  });
};

function GrillzModel({
  customizations,
  selectedTeeth,
  isSelectionMode,
  toggleToothSelection,
}: GrillzModelProps) {
  const { scene } = useGLTF('/assets/teeth_final.glb');

  const { clonedScene, originalMaterials } = useMemo(() => {
    const clone = scene.clone(true);
    const originals = new Map<number, THREE.Material>();

    clone.traverse((child) => {
      if (!(child instanceof THREE.Mesh)) return;
      child.castShadow = true;
      child.receiveShadow = true;

      if (child.material instanceof THREE.Material) {
        child.material = child.material.clone();
        const index = getToothIndexFromName(child.name);
        if (index !== null) originals.set(index, child.material);
      }
    });

    return { clonedScene: clone, originalMaterials: originals };
  }, [scene]);

  const materials = useMemo(() => {
    const selected = new THREE.MeshStandardMaterial({
      color: '#ce4257',
      emissive: '#712432',
      emissiveIntensity: 0.22,
      metalness: 0.25,
      roughness: 0.34,
    });
    const mould = new THREE.MeshStandardMaterial({
      color: '#e8e1d7',
      metalness: 0.05,
      roughness: 0.72,
    });
    const finishCache = new Map<string, THREE.MeshStandardMaterial>();

    return { selected, mould, finishCache };
  }, []);

  const selectedToothSet = useMemo(() => new Set(selectedTeeth), [selectedTeeth]);

  const getFinishMaterial = useCallback((customization: ToothCustomization) => {
    const key = `${customization.material}:${customization.color}`;
    const existing = materials.finishCache.get(key);
    if (existing) return existing;

    const material = new THREE.MeshStandardMaterial({
      color: customization.color,
      metalness: customization.material === 'gold' ? 0.88 : 0.94,
      roughness: customization.material === 'gold' ? 0.2 : 0.16,
      envMapIntensity: 1.35,
    });
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
        disposeObject(existingStones);
      }

      const customization = customizations[index];
      const isSelected = selectedToothSet.has(index);

      if (isSelectionMode && isSelected) {
        child.material = materials.selected;
        return;
      }

      child.material =
        customization.material === 'default'
          ? originalMaterials.get(index) ?? materials.mould
          : getFinishMaterial(customization);

      if (customization.hasDiamonds) {
        const stones = createDiamondStones(child, '#ffffff');
        stones.name = 'diamond_stones';
        child.add(stones);
      }
    });
  }, [clonedScene, customizations, getFinishMaterial, isSelectionMode, materials, originalMaterials, selectedToothSet]);

  useEffect(() => {
    return () => {
      materials.selected.dispose();
      materials.mould.dispose();
      materials.finishCache.forEach((material) => material.dispose());
    };
  }, [materials]);

  const handleToothClick = (event: ThreeEvent<MouseEvent>) => {
    if (!isSelectionMode) return;
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
