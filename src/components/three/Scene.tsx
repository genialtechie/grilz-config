import { Suspense, useEffect, useRef, useState } from 'react';
import { Canvas, useFrame, useThree, type RootState } from '@react-three/fiber';
import {
  ContactShadows,
  Environment,
  Html,
  Lightformer,
  OrbitControls,
  PerformanceMonitor,
  PerspectiveCamera,
  Stats,
} from '@react-three/drei';
import * as THREE from 'three';
import type { OrbitControls as OrbitControlsImpl } from 'three-stdlib';
import GrillzModel from './GrillzModel';
import type { SceneProps } from '../../lib/types';
import { fitDistance, MODEL_CENTRE, VIEW_FRACTION } from '../../lib/framing';

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

const reducedMotion = () => typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
const SWING_SECONDS = 7;

/**
 * The camera: fits the set to the canvas, glides in to a tapped tooth and
 * back, and gives a short slow swing once the model is on screen (`started`)
 * so the metal catches the light. The canvas only draws while something moves.
 */
function Rig({ focus, started }: { focus: THREE.Vector3 | null; started: boolean }) {
  const controls = useRef<OrbitControlsImpl | null>(null);
  const { camera, size, invalidate } = useThree();
  const rest = fitDistance(camera as THREE.PerspectiveCamera, size.width, size.height, VIEW_FRACTION);
  const swing = useRef({ until: reducedMotion() ? 0 : -1, base: 0 });
  const goal = useRef<{ target: THREE.Vector3; distance: number } | null>(null);

  // The resting framing, on load and whenever the canvas changes size.
  useEffect(() => {
    const direction = camera.position.clone().sub(controls.current?.target ?? MODEL_CENTRE).normalize();
    if (!Number.isFinite(direction.x) || direction.lengthSq() === 0) direction.set(0, 0, 1);
    camera.position.copy(MODEL_CENTRE).addScaledVector(direction, rest);
    controls.current?.target.copy(MODEL_CENTRE);
    controls.current?.update();
    invalidate();
  }, [camera, rest, invalidate]);

  // A tapped tooth: glide in towards it. Nothing tapped: glide back out.
  const first = useRef(true);
  useEffect(() => {
    if (first.current) {
      first.current = false;
      return;
    }
    goal.current = focus ? { target: focus.clone(), distance: rest * 0.5 } : { target: MODEL_CENTRE.clone(), distance: rest };
    swing.current.until = 0;
    invalidate();
  }, [focus, rest, invalidate]);

  // The model has just appeared: draw, so the swing begins.
  useEffect(() => {
    if (started) invalidate();
  }, [started, invalidate]);

  useFrame((state, delta) => {
    const orbit = controls.current;
    if (!orbit) return;
    let moving = false;

    // The opening swing: the view eases side to side, then settles.
    const now = state.clock.elapsedTime;
    if (swing.current.until === -1 && started) swing.current = { until: now + SWING_SECONDS, base: orbit.getAzimuthalAngle() };
    if (swing.current.until > now) {
      const t = SWING_SECONDS - (swing.current.until - now);
      const fade = Math.min(1, t / 1.5) * Math.min(1, (swing.current.until - now) / 1.5);
      orbit.setAzimuthalAngle(swing.current.base + Math.sin(t * 0.9) * 0.38 * fade);
      moving = true;
    }

    if (goal.current) {
      const ease = 1 - Math.exp(-delta * 6);
      orbit.target.lerp(goal.current.target, ease);
      const offset = camera.position.clone().sub(orbit.target);
      const distance = THREE.MathUtils.lerp(offset.length(), goal.current.distance, ease);
      camera.position.copy(orbit.target).addScaledVector(offset.normalize(), distance);
      if (orbit.target.distanceTo(goal.current.target) < 0.002 && Math.abs(distance - goal.current.distance) < 0.002) goal.current = null;
      moving = true;
    }

    if (moving) {
      orbit.update();
      invalidate();
    }
  });

  return (
    <OrbitControls
      ref={controls}
      makeDefault
      enableDamping
      dampingFactor={0.08}
      enablePan={false}
      enableZoom
      enableRotate
      minDistance={rest * 0.42}
      maxDistance={rest * 1.3}
      minPolarAngle={Math.PI / 3.4}
      maxPolarAngle={(Math.PI * 2.4) / 3.4}
      target={[0, 0, 0]}
      onStart={() => {
        // Any touch ends the opening swing and any glide in progress.
        swing.current.until = 0;
        goal.current = null;
      }}
    />
  );
}

type Props = SceneProps & {
  onReady?: (state: RootState) => void;
};

function Scene({
  customizations,
  selectedTeeth,
  isSelectionMode,
  selectionLook,
  toggleToothSelection,
  inscriptions,
  poster,
  onReady,
}: Props) {
  const [focus, setFocus] = useState<THREE.Vector3 | null>(null);
  const [drawn, setDrawn] = useState(false);
  // Starts sharp; drops to 1x if a phone can't keep up, and back up if it recovers.
  const [dpr, setDpr] = useState(1.75);
  // /configurator?fps shows a frame-rate meter, for checking real phones.
  const showFps = typeof window !== 'undefined' && new URLSearchParams(window.location.search).has('fps');

  // While picking teeth a tap selects, so any close-up ends.
  useEffect(() => {
    if (isSelectionMode) setFocus(null);
  }, [isSelectionMode]);

  return (
    <div className="viewer-canvas">
      <Canvas
        frameloop="demand"
        dpr={[1, dpr]}
        gl={{ antialias: true, alpha: true }}
        onCreated={onReady}
        onPointerMissed={() => setFocus(null)}
        role="img"
        aria-label="Interactive 3D model of your grillz. Drag to rotate, tap a tooth to look closer."
      >
        <PerformanceMonitor onDecline={() => setDpr(1)} onIncline={() => setDpr(1.75)} />
        {showFps && <Stats />}
        <PerspectiveCamera makeDefault position={[0, 0, 10]} fov={44} />
        <Rig focus={focus} started={drawn} />
        {/* The stone mould is lit by these; the metal and stones by the studio below. */}
        <ambientLight intensity={0.45} />
        <directionalLight position={[4, 7, 8]} intensity={1.6} />
        <directionalLight position={[-6, 2, 4]} intensity={0.5} />
        {/* A jeweler's light tent: soft grey walls with big softboxes, and two narrow dark
            flags. Polished metal mirrors its surroundings, so white metals need mostly
            light to mirror (in a dark room they render black); the flags and the darker
            floor keep the contrast that makes it read as metal, not as white plastic. */}
        <Environment resolution={256} frames={1}>
          <color attach="background" args={['#6a655e']} />
          {/* The wall behind the camera, floor to ceiling: what the faces you look at mirror. */}
          <Lightformer form="rect" intensity={0.95} position={[0, 2, 10]} scale={[16, 11, 1]} />
          {/* Top light and two tall side strips: the bright streaks along each tooth. */}
          <Lightformer form="rect" intensity={3} position={[0, 7, 2]} rotation-x={Math.PI / 2} scale={[12, 4, 1]} />
          <Lightformer form="rect" intensity={3.2} position={[-6, 1, 3]} rotation-y={Math.PI / 2.6} scale={[1.4, 10, 1]} />
          <Lightformer form="rect" intensity={3.2} position={[6, 1, 3]} rotation-y={-Math.PI / 2.6} scale={[1.4, 10, 1]} />
          <Lightformer form="ring" intensity={4} position={[2.5, 3, 7]} scale={1.2} />
          {/* Dark flags beside the camera: a thin dark band down each tooth, so edges read. */}
          <Lightformer form="rect" color="#0b0a09" intensity={1} position={[-3.6, 1.5, 8.5]} rotation-y={Math.PI / 9} scale={[0.9, 9, 1]} />
          <Lightformer form="rect" color="#0b0a09" intensity={1} position={[3.6, 1.5, 8.5]} rotation-y={-Math.PI / 9} scale={[0.9, 9, 1]} />
          <Lightformer form="rect" intensity={1.4} position={[0, -6, 3]} rotation-x={-Math.PI / 2.4} scale={[12, 12, 1]} color="#8a7a6a" />
          {/* Low strip in front: lights the downward-facing lower teeth. */}
          <Lightformer form="rect" intensity={2.2} position={[0, -2.5, 8]} scale={[9, 0.8, 1]} />
        </Environment>
        {/* With a poster up, the set is already on screen: no loading note over it. */}
        <Suspense fallback={poster ? null : <ModelLoader />}>
          <GrillzModel
            customizations={customizations}
            selectedTeeth={selectedTeeth}
            isSelectionMode={isSelectionMode}
            selectionLook={selectionLook}
            toggleToothSelection={toggleToothSelection}
            inscriptions={inscriptions}
            onFocusTooth={(point) => setFocus((current) => (current && current.distanceTo(point) < 0.3 ? null : point))}
            onDrawn={() => setDrawn(true)}
          />
          {/* The mould doesn't move, so its shadow is drawn once, after it loads. */}
          <ContactShadows position={[0, -1.72, 0]} opacity={0.42} scale={9} blur={2.6} far={2.2} resolution={512} frames={1} />
        </Suspense>
      </Canvas>
      {/* The still the builder opens on; the live model, drawn in the same place, fades in over it. */}
      {poster && <img className={drawn ? 'viewer-poster viewer-poster--done' : 'viewer-poster'} src={poster} alt="" decoding="sync" aria-hidden="true" />}
    </div>
  );
}

export default Scene;
