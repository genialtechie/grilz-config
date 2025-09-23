import React, { useRef, Suspense, RefObject } from 'react';
import { Canvas, useFrame } from '@react-three/fiber';
import { OrthographicCamera } from '@react-three/drei';
import * as THREE from 'three';
import { Results } from '@mediapipe/face_mesh';
import GrillzModel from './GrillzModel';
import { ToothCustomization } from '../../lib/types';

export interface ARSceneProps {
  faceMeshResultsRef: RefObject<Results | null>;
  customizations: ToothCustomization[];
}

const ARSceneContent: React.FC<ARSceneProps> = ({
  faceMeshResultsRef,
  customizations,
}) => {
  const groupRef = useRef<THREE.Group>(null);
  const targetPosition = useRef(new THREE.Vector3());
  const targetScale = useRef(new THREE.Vector3());

  useFrame(() => {
    const landmarks = faceMeshResultsRef.current?.multiFaceLandmarks?.[0];
    if (landmarks && groupRef.current) {
      const left = landmarks[61];
      const right = landmarks[291];
      const centerX = (left.x + right.x) / 2 - 0.5;
      const centerY = -(left.y + right.y) / 2 + 0.5;
      const width = Math.abs(left.x - right.x);
      // adjust for primitive's default scale (10)
      const scaleFactor = (width * 2) / 10;
      targetPosition.current.set(centerX * 2, centerY * 2, 0);
      targetScale.current.set(scaleFactor, scaleFactor, scaleFactor);
      groupRef.current.position.lerp(targetPosition.current, 0.15);
      groupRef.current.scale.lerp(targetScale.current, 0.15);
    }
  });

  return (
    <group ref={groupRef}>
      <GrillzModel
        customizations={customizations}
        selectedTeeth={[]}
        isSelectionMode={false}
        toggleToothSelection={() => {}}
      />
    </group>
  );
};

const ARScene: React.FC<ARSceneProps> = ({
  faceMeshResultsRef,
  customizations,
}) => (
  <Canvas
    className="absolute inset-0 pointer-events-none"
    orthographic
    gl={{ alpha: true, antialias: true }}
  >
    <color
      attach="background"
      args={['transparent']}
    />
    <OrthographicCamera
      makeDefault
      position={[0, 0, 100]}
      zoom={1}
    />
    <ambientLight />
    <directionalLight position={[0, 0, 10]} />
    <Suspense fallback={null}>
      <ARSceneContent
        faceMeshResultsRef={faceMeshResultsRef}
        customizations={customizations}
      />
    </Suspense>
  </Canvas>
);

export default ARScene;
