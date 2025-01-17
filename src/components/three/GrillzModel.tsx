import React from 'react';
import { useGLTF } from '@react-three/drei';
import * as THREE from 'three';
import { ThreeEvent } from '@react-three/fiber';
import { GrillzModelProps } from '../../lib/types';
import { createDiamondStones } from './DiamondStones';

const GrillzModel: React.FC<GrillzModelProps> = ({
  customizations,
  selectedTeeth,
  isSelectionMode,
  toggleToothSelection,
}) => {
  const { scene } = useGLTF('/assets/grillz_mould.glb');

  const handleToothClick = (e: ThreeEvent<MouseEvent>) => {
    if (!isSelectionMode) return;

    e.stopPropagation();
    const mesh = e.object as THREE.Mesh;
    if (mesh.name === 'bottom_mould') return;

    const toothIndex = parseInt(mesh.name.replace('tooth_', ''), 10) - 1;
    toggleToothSelection(toothIndex);
  };

  scene.traverse((child) => {
    if ((child as THREE.Mesh).isMesh) {
      const mesh = child as THREE.Mesh;

      // For bottom mould, always keep original white material
      if (mesh.name === 'bottom_mould') {
        const material = new THREE.MeshStandardMaterial({
          color: '#ffffff',
          metalness: 0.5,
          roughness: 0.3,
        });
        mesh.material = material;
        return;
      }

      const index = parseInt(mesh.name.replace('tooth_', ''), 10) - 1;
      if (index >= 0 && index < customizations.length) {
        const isToothSelected = selectedTeeth.includes(index);
        const customization = customizations[index];

        // Default mould properties
        const mouldColor = '#ffffff';
        const mouldMetalness = 0.2;
        const mouldRoughness = 0.5;

        // Material properties based on mode and selection
        const materialProps = isSelectionMode
          ? {
              // Selection mode: highlight selected teeth in red, others match mould
              color: isToothSelected ? '#ff0000' : mouldColor,
              metalness: mouldMetalness,
              roughness: mouldRoughness,
              transparent: isToothSelected,
              opacity: isToothSelected ? 0.8 : 1,
            }
          : {
              // Customization mode: apply custom properties to selected teeth
              color: isToothSelected ? customization.color : mouldColor,
              metalness: isToothSelected ? 1.0 : mouldMetalness,
              roughness: isToothSelected ? 0.3 : mouldRoughness,
              transparent: false,
              opacity: 1,
            };

        mesh.material = new THREE.MeshStandardMaterial(materialProps);

        // Remove existing diamond stones if hasDiamonds is false or in selection mode
        const existingStones = mesh.children.find(
          (child) => child.name === 'diamond_stones'
        );
        if (existingStones) {
          mesh.remove(existingStones);
        }

        // Only add diamond stones if hasDiamonds is true and not in selection mode
        if (customization.hasDiamonds && isToothSelected && !isSelectionMode) {
          const diamondStones = createDiamondStones(mesh, '#FFFFFF');
          diamondStones.name = 'diamond_stones';
          mesh.add(diamondStones);
        }
      }
    }
  });

  return (
    <primitive
      object={scene}
      onClick={handleToothClick}
    />
  );
};

export default GrillzModel;
