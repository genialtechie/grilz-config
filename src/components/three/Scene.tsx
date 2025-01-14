import React from 'react';
import { Canvas } from '@react-three/fiber';
import { OrbitControls, PerspectiveCamera } from '@react-three/drei';
import GrillzModel from './GrillzModel';
import { SceneProps } from '../../lib/types';

const Scene: React.FC<SceneProps> = ({
  customizations,
  selectedTeeth,
  isSelectionMode,
  toggleToothSelection,
}) => {
  return (
    <Canvas style={{ height: '400px', width: '400px' }}>
      <PerspectiveCamera
        makeDefault
        position={[0, 0, 10]}
        fov={50}
      />
      <ambientLight intensity={0.5} />
      <directionalLight
        position={[10, 10, 5]}
        intensity={1}
      />
      <OrbitControls
        minDistance={50}
        maxDistance={150}
      />
      <GrillzModel
        customizations={customizations}
        selectedTeeth={selectedTeeth}
        isSelectionMode={isSelectionMode}
        toggleToothSelection={toggleToothSelection}
      />
    </Canvas>
  );
};

export default Scene;
