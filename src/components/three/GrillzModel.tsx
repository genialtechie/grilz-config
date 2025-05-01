import React, { useRef, useEffect, useMemo } from 'react';
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
  const originalMaterialsRef = useRef<Map<number, THREE.Material>>(new Map()); // Ref for original materials

  // Clone the scene to avoid modifying the original asset
  const clonedScene = useMemo(() => {
    const clone = scene.clone();
    console.log('Scene cloned.');
    return clone;
  }, [scene]);

  // Store original materials on mount
  useEffect(() => {
    const materialsMap = new Map<number, THREE.Material>();
    let storedCount = 0;
    scene.traverse((child) => {
      // Use original scene here to capture initial state before any modifications
      if (child instanceof THREE.Mesh && !(child.material instanceof THREE.Material)) {
        console.warn(`Mesh '${child.name}' has non-standard material type:`, child.material);
      }

      if (child instanceof THREE.Mesh && child.material instanceof THREE.Material) {
        const index = getToothIndexFromName(child.name);
        if (index !== null && index >= 0 && !materialsMap.has(index)) {
          // Store a clone of the material
          materialsMap.set(index, child.material.clone());
          storedCount++;
        }
      }
    });
    originalMaterialsRef.current = materialsMap;
    if (storedCount > 0) {
      console.log(`Stored original materials for ${storedCount} teeth.`);
    } else {
        console.warn('No original tooth materials were stored. Check mesh names and getToothIndexFromName logic.');
    }
    // Intentionally depend only on the original scene load
  }, [scene]);

  // Log mesh names (keep for debugging, use original scene)
  useEffect(() => {
    console.log("--- Traversing original scene for mesh names ---");
    scene.traverse((child) => {
      if (child instanceof THREE.Mesh) {
        console.log(`Found Mesh: Name='${child.name}'`);
      }
    });
    console.log("--- Finished traversing original scene ---");
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

  // --- Pre-create reusable materials for performance ---
  const materials = useMemo(() => ({
    gold: new THREE.MeshStandardMaterial({ color: '#FFD700', metalness: 0.8, roughness: 0.3 }),
    silver: new THREE.MeshStandardMaterial({ color: '#C0C0C0', metalness: 0.9, roughness: 0.2 }),
    selectionHighlight: new THREE.MeshStandardMaterial({ color: '#ff0000', transparent: true, opacity: 0.7, roughness: 0.5 }),
    mould: new THREE.MeshStandardMaterial({ color: '#F5F5F5', metalness: 0.1, roughness: 0.8 }), // Default/fallback mould
  }), []);

  // --- Apply customizations and selection highlights to the CLONED scene --- 
  clonedScene.traverse((child) => {
    if (!(child instanceof THREE.Mesh)) return; // Skip non-meshes

    const mesh = child as THREE.Mesh;
    const index = getToothIndexFromName(mesh.name);

    // --- Handle Moulds (Apply mould material) ---
    if (mesh.name === 'bottom_mould' || mesh.name === 'top_mould') {
      mesh.material = materials.mould;
      return;
    }

    // --- Handle Teeth ---
    if (index !== null && index >= 0 && index < customizations.length) {
      const isToothSelectedForHighlight = selectedTeeth.includes(index);
      const customization = customizations[index];
      const originalMaterial = originalMaterialsRef.current.get(index);

      // Remove existing diamonds first
      const existingStones = mesh.getObjectByName('diamond_stones');
      if (existingStones) {
        mesh.remove(existingStones);
      }

      if (isSelectionMode) {
        // --- Selection Mode: Apply highlight ONLY to selected, others keep their material ---
        if (isToothSelectedForHighlight) {
          mesh.material = materials.selectionHighlight;
        } else {
          // Apply the actual current material (customized or original)
          if (customization && customization.material !== 'default') {
            // Apply Customization (same logic as below)
            let targetMaterial: THREE.MeshStandardMaterial | undefined;
            if (customization.material === 'gold') {
              targetMaterial = materials.gold.clone();
            } else if (customization.material === 'silver') {
              targetMaterial = materials.silver.clone();
            } else {
              targetMaterial = materials.mould.clone();
            }
            targetMaterial.color.set(customization.color);
            mesh.material = targetMaterial;
            // Ensure diamonds are shown if customized, even in selection mode
            if (customization.hasDiamonds) {
              const diamondStones = createDiamondStones(mesh, '#FFFFFF'); 
              diamondStones.name = 'diamond_stones';
              mesh.add(diamondStones);
            }
          } else {
            // Apply Original/Default Material (same logic as below)
            if (originalMaterial) {
              mesh.material = originalMaterial;
            } else {
              mesh.material = materials.mould;
              console.warn(`Original material for tooth index ${index} not found. Applying fallback.`);
            }
             // Diamonds are already removed or weren't there
          }
        }

      } else {
        // --- Customization Mode: Apply custom or original materials ---
        if (customization && customization.material !== 'default') {
          // Apply Customization
          let targetMaterial: THREE.MeshStandardMaterial | undefined;
          
          if (customization.material === 'gold') {
            targetMaterial = materials.gold.clone(); // Clone to modify color safely
          } else if (customization.material === 'silver') {
            targetMaterial = materials.silver.clone(); // Clone to modify color safely
          } else {
            // Fallback or handle other material types if added later
            targetMaterial = materials.mould.clone(); 
          }
          
          targetMaterial.color.set(customization.color); // Set the specific color
          mesh.material = targetMaterial;

          // Add diamonds if specified
          if (customization.hasDiamonds) {
            const diamondStones = createDiamondStones(mesh, '#FFFFFF'); // Use white stones for now
            diamondStones.name = 'diamond_stones';
            mesh.add(diamondStones);
          }
        } else {
          // Apply Original/Default Material (Reset state)
          if (originalMaterial) {
            mesh.material = originalMaterial; // Use the stored original material
          } else {
            // Fallback if original material wasn't found
            mesh.material = materials.mould;
            console.warn(`Original material for tooth index ${index} not found. Applying fallback.`);
          }
          // Diamonds are already removed
        }
      }
    } else if(mesh.name !== 'bottom_mould' && mesh.name !== 'top_mould') {
      // Optional: Handle meshes that are not moulds and don't match tooth naming
      // Could be gums, etc. Apply a default material if needed.
      // mesh.material = materials.mould; 
      // console.log(`Applying default material to unrecognized mesh: ${mesh.name}`);
    }
  });

  return (
    <primitive
      object={clonedScene} // Use the cloned scene
      scale={10} // Scale the model up
      onClick={handleToothClick}
    />
  );
};

export default GrillzModel;
