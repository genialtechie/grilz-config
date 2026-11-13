import { useMemo, useRef } from 'react';
import type { RootState } from '@react-three/fiber';
import Scene from '../components/three/Scene';
import type { ToothCustomization } from '../lib/types';
import { FANG_TEETH, METALS, groupTeeth, type RenderSpec, type SettingId, type StyleId } from '../lib/renderSpec';
import { toothCustomization } from '../lib/toothCustomization';
import { capturePreview } from '../lib/capturePreview';
import { capturePhotoStill, type PhotoStill } from '../lib/photoStage';
import { baseToothState } from '../lib/hooks/useGrillzCustomization';
import * as THREE from 'three';
import { shopLooks } from '../lib/startingLooks';
import { buildTenant } from '../lib/tenant/tenant';
import { VVSLAB_CONFIG } from '../lib/tenant/vvslab';

// Dev-only render lab (/lab, not routed in production builds): the 3D model with
// a fixed design from the URL, for side-by-side visual comparisons and the AI
// photo eval (MAG-76).
//   /lab?metal=yellow&type=iced&count=6&style=open-face&fangs=1&setting=prong&stone=moissanite
//   /lab?spec=<URL-encoded RenderSpec JSON>
//   /lab?look=iced-fangs   (a starting look, as the demo shop offers it)
// window.__lab.shot(teeth, …) frames some teeth and returns a still (scripts/options/capture.mjs).
// window.__lab.capture() returns the exact preview the AI photo starts from.

declare global {
  interface Window {
    __lab?: { ready: boolean; capture: () => string; photo: () => PhotoStill; shot: (teeth: number[], options?: ShotOptions) => string; root: RootState };
  }
}

type ShotOptions = { azimuth?: number; polar?: number; fill?: number };

const toothName = (index: number) => `${index < 16 ? 'top' : 'bottom'}_teeth${String((index % 16) + 1).padStart(3, '0')}`;

/** A still of some teeth, framed to fill `fill` of the canvas, seen from `azimuth` round and `polar` down from above. */
function shot(root: RootState, teeth: number[], { azimuth = 0, polar = Math.PI / 2, fill = 0.9 }: ShotOptions = {}) {
  const { scene, gl, size } = root;
  const camera = root.camera as THREE.PerspectiveCamera;
  scene.updateMatrixWorld(true);
  const box = new THREE.Box3();
  teeth.forEach((index) => {
    const mesh = scene.getObjectByName(toothName(index));
    if (mesh) box.expandByObject(mesh);
  });
  const centre = box.getCenter(new THREE.Vector3());
  const extent = box.getSize(new THREE.Vector3());
  const tan = Math.tan(THREE.MathUtils.degToRad(camera.fov / 2));
  const aspect = size.width / size.height;
  const distance = Math.max(extent.y / (2 * tan * fill), extent.x / (2 * tan * aspect * fill)) + extent.z / 2;
  camera.position.copy(centre).add(new THREE.Vector3().setFromSphericalCoords(distance, polar, azimuth));
  camera.lookAt(centre);
  camera.updateMatrixWorld();
  gl.render(scene, camera);
  return gl.domElement.toDataURL('image/png');
}

function fromParams(params: URLSearchParams): ToothCustomization[] {
  const metalId = params.get('metal') ?? 'yellow';
  const iced = params.get('type') === 'iced';
  const count = Number(params.get('count') ?? 6);
  const style = (params.get('style') ?? 'solid') as StyleId;
  const fangs = params.get('fangs') === '1';
  const cut = params.get('cut') === 'permanent' ? 'permanent' : 'deep';
  const start = Math.floor((16 - count) / 2);
  const covered = new Set<number>();
  for (let i = 0; i < count; i += 1) {
    covered.add(start + i);
    covered.add(16 + start + i);
  }
  const metal = METALS.find((item) => item.id === metalId) ?? METALS[0];
  return Array.from({ length: 32 }, (_, index) =>
    covered.has(index)
      ? { material: metal.id === 'silver' || metal.id === 'platinum' ? 'silver' : 'gold', color: metal.swatch, metal: metal.id, style, fang: fangs && FANG_TEETH.includes(index), cut, hasDiamonds: iced, diamondType: params.get('stone') === 'moissanite' ? 'moissanite' : 'lab', setting: (params.get('setting') ?? 'honeycomb') as SettingId }
      : { ...baseToothState },
  );
}

function fromSpec(spec: RenderSpec): ToothCustomization[] {
  const byIndex = new Map(spec.teeth.map((tooth) => [tooth.index, tooth]));
  return Array.from({ length: 32 }, (_, index) => {
    const tooth = byIndex.get(index);
    return tooth ? toothCustomization(tooth, spec, index) : { ...baseToothState };
  });
}

export default function LabPage() {
  const params = new URLSearchParams(window.location.search);
  const lookId = params.get('look');
  const raw = params.get('spec');
  const spec = useMemo<RenderSpec | null>(() => {
    if (lookId) {
      const found = shopLooks(buildTenant('vvslab', VVSLAB_CONFIG, true)).find(({ look }) => look.id === lookId);
      if (!found) return null;
      const { design } = found;
      return { ...design.set, inscriptions: [], teeth: design.teeth.map((index) => ({ index, ...(design.overrides[index] ?? design.base) })) };
    }
    return raw ? (JSON.parse(raw) as RenderSpec) : null;
  }, [raw, lookId]);
  const customizations = useMemo(() => (spec ? fromSpec(spec) : fromParams(params)), [spec]); // eslint-disable-line react-hooks/exhaustive-deps
  const state = useRef<RootState | null>(null);

  const onReady = (root: RootState) => {
    state.current = root;
    window.__lab = {
      ready: true,
      root,
      photo: () => capturePhotoStill(root, spec ? spec.teeth.map((tooth) => tooth.index) : []),
      shot: (teeth, options) => shot(root, teeth, options),
      capture: () => capturePreview(root, spec ? spec.teeth.map((tooth) => tooth.index) : [], spec ? groupTeeth(spec.teeth).length > 1 : false),
    };
  };

  return (
    <div style={{ width: '100vw', height: '100vh', background: '#f4f1ec' }}>
      <Scene customizations={customizations} selectedTeeth={[]} isSelectionMode={false} toggleToothSelection={() => {}} inscriptions={spec?.inscriptions} onReady={onReady} />
    </div>
  );
}
