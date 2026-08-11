import { Suspense } from 'react';
import { Canvas } from '@react-three/fiber';
import {
  Environment,
  Html,
  OrbitControls,
  PerspectiveCamera,
} from '@react-three/drei';
import GrillzModel from './GrillzModel';
import type { SceneProps } from '../../lib/types';

function ModelLoader() {
  return (
    <Html center>
      <div className="canvas-loader">
        <span />
        Loading 3D preview
      </div>
    </Html>
  );
}

function Scene({
  customizations,
  selectedTeeth,
  isSelectionMode,
  toggleToothSelection,
}: SceneProps) {
  return (
    <div className="viewer-canvas">
      <Canvas
        dpr={[1, 1.75]}
        gl={{ antialias: true, alpha: true }}
        shadows
        aria-label="Interactive grillz model"
      >
        <PerspectiveCamera makeDefault position={[0, 0, 10]} fov={44} />
        <OrbitControls
          enableDamping
          dampingFactor={0.08}
          enablePan={false}
          enableZoom
          enableRotate
          minDistance={7.5}
          maxDistance={12.5}
          minPolarAngle={Math.PI / 3.4}
          maxPolarAngle={(Math.PI * 2.4) / 3.4}
          target={[0, 0, 0]}
        />
        <ambientLight intensity={1.1} />
        <directionalLight position={[6, 7, 8]} intensity={2.1} castShadow />
        <directionalLight position={[-7, 2, 5]} intensity={1.2} />
        <pointLight position={[0, -5, 5]} intensity={0.8} />
        <Environment preset="studio" />
        <Suspense fallback={<ModelLoader />}>
          <GrillzModel
            customizations={customizations}
            selectedTeeth={selectedTeeth}
            isSelectionMode={isSelectionMode}
            toggleToothSelection={toggleToothSelection}
          />
        </Suspense>
      </Canvas>
    </div>
  );
}

export default Scene;
