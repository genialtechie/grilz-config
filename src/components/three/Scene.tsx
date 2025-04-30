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
        <OrbitControls
          enablePan={true}
          enableZoom={true}
          enableRotate={true}
          minDistance={1}
          maxDistance={2}
          minPolarAngle={Math.PI / 4}
          maxPolarAngle={(3 * Math.PI) / 4}
          target={[0, 0, 0]}
        />
        <ambientLight intensity={0.8} />
        <directionalLight
          position={[10, 10, 5]}
          intensity={1}
        />
        <directionalLight
          position={[-10, -10, -5]}
          intensity={1}
        />
        <directionalLight
          position={[0, 0, 10]}
          intensity={1}
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
        <React.Suspense fallback={null}>
          <GrillzModel
            customizations={customizations}
            selectedTeeth={selectedTeeth}
            isSelectionMode={isSelectionMode}
            toggleToothSelection={toggleToothSelection}
          />
        </React.Suspense>
      </Canvas>
    </div>
  );
};

export default Scene;
