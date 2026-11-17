import { useEffect, useMemo, useRef, useState } from 'react';
import { Canvas, useFrame, useThree, type RootState } from '@react-three/fiber';
import { OrbitControls, PerformanceMonitor, PerspectiveCamera, Stats } from '@react-three/drei';
import * as THREE from 'three';
import type { OrbitControls as OrbitControlsImpl } from 'three-stdlib';
import GrillzModel from './GrillzModel';
import { GlowPass } from './GlowPass';
import type { CloseUp, Frame, SceneProps, ViewRequest } from '../../lib/types';
import { CAMERA_FOV, fitDistance, FRONT_DEPTH, MODEL_CENTRE, MODEL_SIZE, VIEW_FRACTION } from '../../lib/framing';

const reducedMotion = () => typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
const SWING_SECONDS = 7;
/**
 * The bands of the canvas the controls sit over, as shares of its height: the
 * tooth count and view buttons along the top, the tip (and on phones the edge
 * of the options sheet) along the bottom. The teeth are framed between them.
 */
const overlays = () =>
  typeof window !== 'undefined' && window.matchMedia('(max-width: 860px)').matches ? { top: 0.12, bottom: 0.2 } : { top: 0.08, bottom: 0.08 };
/** With a frame (the creator), the share of the free area the piece fills, as in the Grill Creator Lab. */
const FRAME_FILL = 0.9;
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
 * model line up), then settles on the whole piece (the teeth in their clear holder,
 * as in the approved redesign), fitted between the controls.
 * It glides in to a tapped tooth, to the teeth an option changes (`closeUp`),
 * and to a fixed view (`view`), and back. Glides keep the angle the customer
 * looks from unless a view or close-up turns it. Any drag or pinch hands control
 * back. A short slow swing plays once the model is on screen (`started`) so the
 * metal catches the light. The canvas only draws while something moves.
 */
function Rig({
  focus,
  started,
  closeUp,
  view,
  onUserControl,
  frame,
}: {
  focus: THREE.Vector3 | null;
  started: boolean;
  closeUp?: CloseUp | null;
  view?: ViewRequest | null;
  onUserControl?: () => void;
  frame?: Frame | null;
}) {
  const controls = useRef<OrbitControlsImpl | null>(null);
  const { camera, size, invalidate, scene } = useThree();
  const perspective = camera as THREE.PerspectiveCamera;
  const rest = fitDistance(perspective, size.width, size.height, VIEW_FRACTION);
  const swing = useRef({ until: reducedMotion() ? 0 : -1, base: 0 });
  const goal = useRef<Goal | null>(null);

  // Home: the whole piece filling the clear band between the controls, once the model is drawn and the still has gone.
  const [settled, setSettled] = useState(false);
  useEffect(() => {
    if (!started) return;
    const timer = window.setTimeout(() => setSettled(true), POSTER_FADE_MS);
    return () => window.clearTimeout(timer);
  }, [started]);
  const frameTop = frame?.top;
  const frameBottom = frame?.bottom;
  const frameLeft = frame?.left;
  const frameRight = frame?.right;
  const home = useMemo<Goal>(() => {
    if (!settled) return { target: MODEL_CENTRE.clone(), distance: rest };
    if (frameTop !== undefined && frameBottom !== undefined && frameLeft !== undefined && frameRight !== undefined) {
      // The creator: fill the free area (above the panel on a phone, beside it on a computer). Its
      // height sets the distance with the canvas's; sideways, the view is shifted (see the frame below).
      const tan = Math.tan(THREE.MathUtils.degToRad(perspective.fov / 2));
      const aspect = size.width / Math.max(1, size.height);
      const H = Math.max(1, size.height);
      const W = Math.max(1, size.width);
      const top = Math.max(0, frameTop / H);
      const bottom = Math.max(0, 1 - frameBottom / H);
      const clearH = Math.max(0.15, 1 - top - bottom);
      const clearW = Math.max(0.2, (frameRight - frameLeft) / W);
      const span = Math.max(MODEL_SIZE.height / (2 * tan * clearH * FRAME_FILL), MODEL_SIZE.width / (2 * tan * aspect * clearW * FRAME_FILL));
      const target = MODEL_CENTRE.clone();
      target.y -= (bottom - top) * span * tan;
      return { target, distance: span + FRONT_DEPTH };
    }
    // Fit the whole piece to the clear band between the controls (its height, the canvas's full width)...
    const { top, bottom } = overlays();
    const clear = 1 - top - bottom;
    const tan = Math.tan(THREE.MathUtils.degToRad(perspective.fov / 2));
    const aspect = size.width / Math.max(1, size.height);
    const span = Math.max(MODEL_SIZE.height / (2 * tan * clear * VIEW_FRACTION), MODEL_SIZE.width / (2 * tan * aspect * VIEW_FRACTION));
    // ...and centre it in that band: aim below the piece by as much as the band sits above the canvas's middle.
    const target = MODEL_CENTRE.clone();
    target.y -= (bottom - top) * span * tan;
    return { target, distance: span + FRONT_DEPTH };
  }, [settled, rest, perspective, size.width, size.height, frameTop, frameBottom, frameLeft, frameRight]);

  // Sideways, the piece is centred in the free area by shifting the view, so it still turns about its middle.
  const shift = useRef(0);
  const shiftGoal = frameLeft !== undefined && frameRight !== undefined ? size.width / 2 - (frameLeft + frameRight) / 2 : 0;

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

    if (Math.abs(shiftGoal - shift.current) > 0.5 || (shift.current !== 0 && !perspective.view)) {
      shift.current = reducedMotion() ? shiftGoal : shift.current + (shiftGoal - shift.current) * Math.min(1, delta * 9);
      if (Math.abs(shiftGoal - shift.current) <= 0.5) shift.current = shiftGoal;
      if (Math.abs(shift.current) < 0.5) perspective.clearViewOffset();
      else perspective.setViewOffset(size.width, size.height, Math.round(shift.current), 0, size.width, size.height);
      moving = true;
    } else if (perspective.view && (perspective.view.fullWidth !== size.width || perspective.view.fullHeight !== size.height)) {
      perspective.setViewOffset(size.width, size.height, Math.round(shift.current), 0, size.width, size.height);
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
  closeUp,
  view,
  onUserControl,
  onReady,
  frame,
  onMissTap,
  jawOpen,
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
        onPointerMissed={(event) => {
          setFocus(null);
          // A tap (not the end of a drag) on no tooth.
          if (event.type === 'click') onMissTap?.();
        }}
        role="img"
        aria-label="Interactive 3D model of your grillz. Drag to rotate, tap a tooth to look closer."
      >
        <PerformanceMonitor onDecline={() => setDpr(1)} onIncline={() => setDpr(1.75)} />
        {showFps && <Stats />}
        <PerspectiveCamera makeDefault position={[0, 0, 10]} fov={CAMERA_FOV} />
        <Rig focus={focus} started={drawn} closeUp={closeUp} view={view} onUserControl={onUserControl} frame={frame} />
        {selectionLook === 'glow' && isSelectionMode && selectedTeeth.length > 0 && <GlowPass />}
        {/* No lamps: the piece is lit by the rooms its materials reflect (redesign/look.ts), with its own soft shadow. */}
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
          jawOpen={jawOpen}
        />
      </Canvas>
      {/* The still the builder opens on; the live model, drawn in the same place, fades in over it. */}
      {poster && <img className={drawn ? 'viewer-poster viewer-poster--done' : 'viewer-poster'} src={poster} alt="" decoding="sync" aria-hidden="true" />}
    </div>
  );
}

export default Scene;
