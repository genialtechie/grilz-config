import React from 'react';
import { Canvas } from '@react-three/fiber';
import {
  OrbitControls,
  PerspectiveCamera,
  Environment,
} from '@react-three/drei';
import GrillzModel from './GrillzModel';
import { SceneProps } from '../../lib/types';

const Scene: React.FC<SceneProps> = ({
  customizations,
  selectedTeeth,
  isSelectionMode,
  toggleToothSelection,
}) => {
  return (
    <div className="w-full h-full">
      <Canvas className="w-full h-full">
        <PerspectiveCamera
          makeDefault
          position={[0, 0, 10]}
          fov={50}
        />
        <ambientLight intensity={0.8} />
        <directionalLight
          position={[10, 10, 5]}
          intensity={1.5}
        />
        <directionalLight
          position={[-10, -10, -5]}
          intensity={1}
        />
        <directionalLight
          position={[0, 0, 10]}
          intensity={1}
        />
        <OrbitControls
          minDistance={50}
          maxDistance={150}
        />
        <spotLight
          position={[5, 5, 5]}
          intensity={1.5}
          angle={0.4}
          penumbra={1}
        />
        <pointLight
          position={[-5, -5, -5]}
          intensity={1}
          distance={50}
        />
        <hemisphereLight
          intensity={0.5}
          color="#ffffff"
          groundColor="#000000"
        />
        <Environment preset="studio" />
        <GrillzModel
          customizations={customizations}
          selectedTeeth={selectedTeeth}
          isSelectionMode={isSelectionMode}
          toggleToothSelection={toggleToothSelection}
        />
      </Canvas>
    </div>
  );
};

export default Scene;
