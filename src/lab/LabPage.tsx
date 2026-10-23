import { useMemo, useRef } from 'react';
import type { RootState } from '@react-three/fiber';
import Scene from '../components/three/Scene';
import type { ToothCustomization } from '../lib/types';
import { FANG_TEETH, METALS, groupTeeth, type RenderSpec, type StyleId } from '../lib/renderSpec';
import { toothCustomization } from '../lib/toothCustomization';
import { capturePreview } from '../lib/capturePreview';
import { capturePhotoStill, type PhotoStill } from '../lib/photoStage';
import { baseToothState } from '../lib/hooks/useGrillzCustomization';

// Dev-only render lab (/lab, not routed in production builds): the 3D model with
// a fixed design from the URL, for side-by-side visual comparisons and the AI
// photo eval (MAG-76).
//   /lab?metal=yellow&type=iced&count=6&style=open-face&fangs=1
//   /lab?spec=<URL-encoded RenderSpec JSON>
// window.__lab.capture() returns the exact preview the AI photo starts from.

declare global {
  interface Window {
    __lab?: { ready: boolean; capture: () => string; photo: () => PhotoStill; root: RootState };
  }
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
      ? { material: metal.id === 'silver' || metal.id === 'platinum' ? 'silver' : 'gold', color: metal.swatch, metal: metal.id, style, fang: fangs && FANG_TEETH.includes(index), cut, hasDiamonds: iced, diamondType: 'lab' }
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
  const raw = params.get('spec');
  const spec = useMemo(() => (raw ? (JSON.parse(raw) as RenderSpec) : null), [raw]);
  const customizations = useMemo(() => (spec ? fromSpec(spec) : fromParams(params)), [spec, raw]); // eslint-disable-line react-hooks/exhaustive-deps
  const state = useRef<RootState | null>(null);

  const onReady = (root: RootState) => {
    state.current = root;
    window.__lab = {
      ready: true,
      root,
      photo: () => capturePhotoStill(root, spec ? spec.teeth.map((tooth) => tooth.index) : []),
      capture: () => capturePreview(root, spec ? spec.teeth.map((tooth) => tooth.index) : [], spec ? groupTeeth(spec.teeth).length > 1 : false),
    };
  };

  return (
    <div style={{ width: '100vw', height: '100vh', background: '#f4f1ec' }}>
      <Scene customizations={customizations} selectedTeeth={[]} isSelectionMode={false} toggleToothSelection={() => {}} inscriptions={spec?.inscriptions} onReady={onReady} />
    </div>
  );
}
