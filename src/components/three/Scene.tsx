import { Suspense, useEffect, useMemo, useRef, useState } from 'react';
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
import type { CloseUp, SceneProps, ViewRequest } from '../../lib/types';
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
/** How much of the clear part of the canvas the covered teeth fill at rest (MAG-148). */
const TEETH_FRACTION = 0.95;
/**
 * The bands of the canvas the controls sit over, as shares of its height: the
 * tooth count and view buttons along the top, the tip (and on phones the edge
 * of the options sheet) along the bottom. The teeth are framed between them.
 */
const overlays = () =>
  typeof window !== 'undefined' && window.matchMedia('(max-width: 860px)').matches ? { top: 0.12, bottom: 0.2 } : { top: 0.08, bottom: 0.08 };
/** Front, left and right: how far round the side views turn (radians from the front). */
const SIDE_TURN = 1.05;
/** Waits for the opening still to fade before the camera moves in on the teeth, so the two never disagree on screen. */
const POSTER_FADE_MS = 360;

const toothName = (index: number) => `${index < 16 ? 'top' : 'bottom'}_teeth${String((index % 16) + 1).padStart(3, '0')}`;

/** The box round some teeth, in world space (null when none are in the scene yet). */
function teethBox(scene: THREE.Object3D, teeth: readonly number[]): THREE.Box3 | null {
  const box = new THREE.Box3();
  teeth.forEach((index) => {
    const mesh = scene.getObjectByName(toothName(index));
    if (mesh) box.expandByObject(mesh);
  });
  return box.isEmpty() ? null : box;
}

/** Camera distance at which a box fills `fraction` of the canvas along whichever axis runs out first. */
function boxDistance(camera: THREE.PerspectiveCamera, width: number, height: number, box: THREE.Box3, fraction: number) {
  const size = box.getSize(new THREE.Vector3());
  const tan = Math.tan(THREE.MathUtils.degToRad(camera.fov / 2));
  const aspect = width / Math.max(1, height);
  return Math.max(size.y / (2 * tan * fraction), size.x / (2 * tan * aspect * fraction)) + size.z / 2;
}

type Goal = { target: THREE.Vector3; distance: number; azimuth?: number; polar?: number };

/** The shortest turn from one angle to another. */
const turn = (from: number, to: number) => {
  const difference = (to - from) % (Math.PI * 2);
  return difference > Math.PI ? difference - Math.PI * 2 : difference < -Math.PI ? difference + Math.PI * 2 : difference;
};

/**
 * The camera: opens on the framing the still was taken at (so the still and the
 * model line up), then glides in on the covered teeth (`frameTeeth`, MAG-148).
 * It glides in to a tapped tooth, to the teeth an option changes (`closeUp`),
 * and to a fixed view (`view`), and back. Glides keep the angle the customer
 * looks from unless a view or close-up turns it. Any drag or pinch hands control
 * back. A short slow swing plays once the model is on screen (`started`) so the
 * metal catches the light. The canvas only draws while something moves.
 */
function Rig({
  focus,
  started,
  frameTeeth,
  closeUp,
  view,
  onUserControl,
}: {
  focus: THREE.Vector3 | null;
  started: boolean;
  frameTeeth?: number[];
  closeUp?: CloseUp | null;
  view?: ViewRequest | null;
  onUserControl?: () => void;
}) {
  const controls = useRef<OrbitControlsImpl | null>(null);
  const { camera, size, invalidate, scene } = useThree();
  const perspective = camera as THREE.PerspectiveCamera;
  const rest = fitDistance(perspective, size.width, size.height, VIEW_FRACTION);
  const swing = useRef({ until: reducedMotion() ? 0 : -1, base: 0 });
  const goal = useRef<Goal | null>(null);

  // Home: the covered teeth filling the canvas, once the model is drawn and the still has gone.
  const [settled, setSettled] = useState(false);
  useEffect(() => {
    if (!started) return;
    const timer = window.setTimeout(() => setSettled(true), POSTER_FADE_MS);
    return () => window.clearTimeout(timer);
  }, [started]);
  const teethKey = frameTeeth?.join(',') ?? '';
  const home = useMemo<Goal>(() => {
    const box = settled && frameTeeth?.length ? teethBox(scene, frameTeeth) : null;
    if (!box) return { target: MODEL_CENTRE.clone(), distance: rest };
    // Fit the teeth to the clear band between the controls (its height, the canvas's full width)...
    const { top, bottom } = overlays();
    const clear = 1 - top - bottom;
    const size3 = box.getSize(new THREE.Vector3());
    const tan = Math.tan(THREE.MathUtils.degToRad(perspective.fov / 2));
    const aspect = size.width / Math.max(1, size.height);
    const fit = Math.max(size3.y / (2 * tan * clear * TEETH_FRACTION), size3.x / (2 * tan * aspect * TEETH_FRACTION)) + size3.z / 2;
    // ...never further out than the whole model's framing...
    const distance = Math.min(rest, fit);
    // ...and centred in that band: aim below the teeth by as much as the band sits above the canvas's middle.
    const target = box.getCenter(new THREE.Vector3());
    target.y -= (bottom - top) * (distance - size3.z / 2) * tan;
    return { target, distance };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [settled, teethKey, rest, scene, perspective, size.width, size.height]);

  // The opening framing, on load and whenever the canvas changes size, before the model is drawn.
  useEffect(() => {
    if (settled) return;
    const direction = camera.position.clone().sub(controls.current?.target ?? MODEL_CENTRE).normalize();
    if (!Number.isFinite(direction.x) || direction.lengthSq() === 0) direction.set(0, 0, 1);
    camera.position.copy(MODEL_CENTRE).addScaledVector(direction, rest);
    controls.current?.target.copy(MODEL_CENTRE);
    controls.current?.update();
    invalidate();
  }, [camera, rest, invalidate, settled]);

  // Glide to home when it changes (the set changed, the canvas resized), unless looking closer.
  const looking = useRef<'home' | 'focus' | 'closeUp'>('home');
  useEffect(() => {
    if (!settled || looking.current !== 'home') return;
    goal.current = { ...home, target: home.target.clone() };
    invalidate();
  }, [home, settled, invalidate]);

  // A tapped tooth: glide in towards it. Nothing tapped: glide back out.
  const first = useRef(true);
  useEffect(() => {
    if (first.current) {
      first.current = false;
      return;
    }
    looking.current = focus ? 'focus' : 'home';
    goal.current = focus ? { target: focus.clone(), distance: home.distance * 0.5 } : { ...home, target: home.target.clone() };
    swing.current.until = 0;
    invalidate();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [focus, invalidate]);

  // An option that shows at close range (stones, settings, fangs): glide in on the teeth it changes, and back.
  const hadCloseUp = useRef(false);
  useEffect(() => {
    if (!closeUp) {
      if (hadCloseUp.current) {
        hadCloseUp.current = false;
        looking.current = 'home';
        goal.current = { ...home, target: home.target.clone() };
        invalidate();
      }
      return;
    }
    const box = teethBox(scene, closeUp.teeth);
    if (!box) return;
    hadCloseUp.current = true;
    looking.current = 'closeUp';
    const target = box.getCenter(new THREE.Vector3());
    const distance = Math.max(home.distance * 0.3, boxDistance(perspective, size.width, size.height, box, closeUp.fill));
    // Turning to a tooth: look at it from straight out of the arch.
    const azimuth = closeUp.turn ? Math.atan2(target.x, target.z + 1.2) * 1.15 : undefined;
    goal.current = { target, distance, azimuth };
    swing.current.until = 0;
    invalidate();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [closeUp, invalidate]);

  // Front, left or right, at the current framing.
  useEffect(() => {
    if (!view) return;
    const azimuth = view.side === 'front' ? 0 : view.side === 'left' ? -SIDE_TURN : SIDE_TURN;
    const current = goal.current ?? { target: controls.current?.target.clone() ?? home.target.clone(), distance: camera.position.distanceTo(controls.current?.target ?? home.target) };
    goal.current = { target: current.target.clone(), distance: current.distance, azimuth, polar: Math.PI / 2 };
    swing.current.until = 0;
    invalidate();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [view, invalidate]);

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
      const g = goal.current;
      // Reduced motion: arrive at once.
      const ease = reducedMotion() ? 1 : 1 - Math.exp(-delta * 6);
      const spherical = new THREE.Spherical().setFromVector3(camera.position.clone().sub(orbit.target));
      orbit.target.lerp(g.target, ease);
      spherical.radius = THREE.MathUtils.lerp(spherical.radius, g.distance, ease);
      if (g.azimuth !== undefined) spherical.theta += turn(spherical.theta, g.azimuth) * ease;
      if (g.polar !== undefined) spherical.phi = THREE.MathUtils.lerp(spherical.phi, g.polar, ease);
      camera.position.copy(orbit.target).add(new THREE.Vector3().setFromSpherical(spherical));
      camera.lookAt(orbit.target);
      const arrived =
        orbit.target.distanceTo(g.target) < 0.002 &&
        Math.abs(spherical.radius - g.distance) < 0.002 &&
        (g.azimuth === undefined || Math.abs(turn(spherical.theta, g.azimuth)) < 0.002) &&
        (g.polar === undefined || Math.abs(spherical.phi - g.polar) < 0.002);
      if (arrived) goal.current = null;
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
      // Zoom limits follow the resting framing; zooming out can still show the whole model.
      minDistance={home.distance * 0.3}
      maxDistance={Math.max(home.distance * 1.3, rest * 1.05)}
      minPolarAngle={Math.PI / 3.4}
      maxPolarAngle={(Math.PI * 2.4) / 3.4}
      target={[0, 0, 0]}
      onStart={() => {
        // Any touch ends the opening swing and any glide in progress.
        swing.current.until = 0;
        goal.current = null;
        // The customer has taken over: a close-up ending later doesn't pull the camera back.
        hadCloseUp.current = false;
        looking.current = 'home';
        onUserControl?.();
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
  photoImage,
  poster,
  frameTeeth,
  closeUp,
  view,
  onUserControl,
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
        <Rig focus={focus} started={drawn} frameTeeth={frameTeeth} closeUp={closeUp} view={view} onUserControl={onUserControl} />
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
            photoImage={photoImage}
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
