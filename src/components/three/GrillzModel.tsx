import React from 'react';
import { useGLTF } from '@react-three/drei';
import * as THREE from 'three';
import { ThreeEvent } from '@react-three/fiber';
import { GrillzModelProps } from '../../lib/types';

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
    console.log('Selecting tooth:', toothIndex);
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
        const material = new THREE.MeshStandardMaterial({
          // In selection mode:
          // - All unselected teeth match bottom mould material exactly
          // - Selected teeth are red and transparent
          // In customization mode:
          // - Selected teeth show customization
          // - Unselected teeth remain like the mould
          color: isSelectionMode
            ? selectedTeeth.includes(index)
              ? '#ff0000'
              : '#ffffff'
            : selectedTeeth.includes(index)
            ? customizations[index].color
            : '#ffffff',
          metalness: isSelectionMode
            ? 0.5 // Match mould metalness
            : selectedTeeth.includes(index)
            ? customizations[index].material === 'diamond'
              ? 0.5
              : 1.0
            : 0.5, // Unselected teeth match mould
          roughness: isSelectionMode
            ? 0.3 // Match mould roughness
            : selectedTeeth.includes(index)
            ? customizations[index].material === 'diamond'
              ? 0.1
              : 0.3
            : 0.3, // Unselected teeth match mould
          transparent: isSelectionMode && selectedTeeth.includes(index),
          opacity: isSelectionMode && selectedTeeth.includes(index) ? 0.8 : 1,
        });
        mesh.material = material;
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
