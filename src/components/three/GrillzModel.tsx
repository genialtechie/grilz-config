import React from 'react';
import { useGLTF } from '@react-three/drei';
import * as THREE from 'three';
import { ThreeEvent } from '@react-three/fiber';
import { GrillzModelProps } from '../../lib/types';
import { createDiamondStones } from './DiamondStones';

const toothNameRegex = /^(top|bottom)_teeth(\d{3})$/;

const getToothIndexFromName = (name: string): number | null => {
  console.log('Attempting to get index for name:', name); // Log name being checked
  const match = name.match(toothNameRegex);
  if (!match) {
    console.log(' -> No regex match'); // Log if regex fails
    return null;
  }

  const [_, prefix, numberStr] = match;
  const number = parseInt(numberStr, 10);

  if (prefix === 'top') {
    return number - 1; // top_teeth001 -> 0, ..., top_teeth016 -> 15
  } else if (prefix === 'bottom') {
    return 16 + (number - 1); // bottom_teeth001 -> 16, ..., bottom_teeth016 -> 31
  }

  return null;
};

const GrillzModel: React.FC<GrillzModelProps> = ({
  customizations,
  selectedTeeth,
  isSelectionMode,
  toggleToothSelection,
}) => {
  const { scene } = useGLTF('/assets/teeth_final.glb');

  // Log all mesh names once on component mount
  React.useEffect(() => {
    console.log("--- Traversing scene for mesh names ---");
    scene.traverse((child) => {
      if (child instanceof THREE.Mesh) {
        console.log(`Found Mesh: Name='${child.name}'`);
      }
    });
    console.log("--- Finished traversing scene ---");
  }, [scene]);

  const handleToothClick = (e: ThreeEvent<MouseEvent>) => {
    if (!isSelectionMode) return;

    e.stopPropagation();
    const mesh = e.object as THREE.Mesh;
    if (mesh.name === 'bottom_mould' || mesh.name === 'top_mould') return;

    console.log('--- Click Event ---');
    console.log('Clicked object name:', mesh.name);

    const toothIndex = getToothIndexFromName(mesh.name);

    if (toothIndex !== null && toothIndex >= 0) {
      console.log('Toggling selection for index:', toothIndex);
      toggleToothSelection(toothIndex);
    } else {
      console.log('Clicked object is not a selectable tooth.');
    }
    console.log('--- End Click Event ---');
  };

  scene.traverse((child) => {
    if (child instanceof THREE.Mesh) {
      const mesh = child as THREE.Mesh;

      if (mesh.name === 'bottom_mould' || mesh.name === 'top_mould') {
        const material = new THREE.MeshStandardMaterial({
          color: '#ffffff',
          metalness: 0.2,
          roughness: 0.5,
        });
        mesh.material = material;
        return;
      }

      const index = getToothIndexFromName(mesh.name);

      if (index !== null && index >= 0 && index < customizations.length) {
        const isToothSelected = selectedTeeth.includes(index);
        const customization = customizations[index];

        const mouldColor = '#ffffff';
        const mouldMetalness = 0.2;
        const mouldRoughness = 0.5;

        const materialProps = isSelectionMode
          ? {
              color: isToothSelected ? '#ff0000' : mouldColor,
              metalness: mouldMetalness,
              roughness: mouldRoughness,
              transparent: isToothSelected,
              opacity: isToothSelected ? 0.8 : 1,
            }
          : {
              color: isToothSelected ? customization.color : mouldColor,
              metalness: isToothSelected ? 1.0 : mouldMetalness,
              roughness: isToothSelected ? 0.3 : mouldRoughness,
              transparent: false,
              opacity: 1,
            };

        mesh.material = new THREE.MeshStandardMaterial(materialProps);

        const existingStones = mesh.getObjectByName('diamond_stones');
        if (existingStones) {
          mesh.remove(existingStones);
        }

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
      scale={10} // Scale the model up
      onClick={handleToothClick}
    />
  );
};

export default GrillzModel;
