import { Suspense } from 'react';
import { Canvas, type RootState } from '@react-three/fiber';
import {
  ContactShadows,
  Environment,
  Html,
  Lightformer,
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

type Props = SceneProps & {
  onReady?: (state: RootState) => void;
};

function Scene({
  customizations,
  selectedTeeth,
  isSelectionMode,
  toggleToothSelection,
  onReady,
}: Props) {
  return (
    <div className="viewer-canvas">
      <Canvas
        dpr={[1, 1.75]}
        gl={{ antialias: true, alpha: true }}
        shadows
        onCreated={onReady}
        role="img"
        aria-label="Interactive 3D model of your grillz. Drag to rotate, tap a tooth to select it."
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
        {/* The stone mould is lit by these; the metal and stones by the studio below. */}
        <ambientLight intensity={0.45} />
        <directionalLight position={[4, 7, 8]} intensity={1.6} castShadow />
        <directionalLight position={[-6, 2, 4]} intensity={0.5} />
        {/* A dark studio with long softboxes: polished metal reflects mostly dark with
            sharp bright streaks along its edges, the way jewelry is photographed. */}
        <Environment resolution={256} frames={1}>
          <color attach="background" args={['#191613']} />
          {/* Big softbox in front (behind the camera): the polished faces you look at. */}
          <Lightformer form="rect" intensity={1.6} position={[0, 1.5, 9]} scale={[10, 4, 1]} />
          {/* Top light and two tall side strips: the long streaks along each tooth. */}
          <Lightformer form="rect" intensity={3} position={[0, 7, 2]} rotation-x={Math.PI / 2} scale={[12, 3, 1]} />
          <Lightformer form="rect" intensity={3.4} position={[-6, 1, 3]} rotation-y={Math.PI / 2.6} scale={[1.2, 10, 1]} />
          <Lightformer form="rect" intensity={3.4} position={[6, 1, 3]} rotation-y={-Math.PI / 2.6} scale={[1.2, 10, 1]} />
          <Lightformer form="ring" intensity={4} position={[2.5, 3, 7]} scale={1.2} />
          <Lightformer form="rect" intensity={1.4} position={[0, -6, 3]} rotation-x={-Math.PI / 2.4} scale={[12, 12, 1]} color="#8a7a6a" />
          {/* Low strip in front: lights the downward-facing lower teeth. */}
          <Lightformer form="rect" intensity={2.2} position={[0, -2.5, 8]} scale={[9, 0.8, 1]} />
        </Environment>
        <ContactShadows position={[0, -1.72, 0]} opacity={0.42} scale={9} blur={2.6} far={2.2} resolution={512} />
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
