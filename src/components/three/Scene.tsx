import React from 'react';
import { Canvas } from '@react-three/fiber';
import { OrbitControls } from '@react-three/drei';
import GrillzModel from './GrillzModel';
import { SceneProps } from '../../lib/types';

const Scene: React.FC<SceneProps> = ({
  customizations,
  selectedTeeth,
  isSelectionMode,
  toggleToothSelection,
}) => {
  return (
    <Canvas style={{ height: '500px', width: '500px' }}>
      <ambientLight intensity={0.5} />
      <directionalLight
        position={[10, 10, 5]}
        intensity={1}
      />
      <OrbitControls />
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
