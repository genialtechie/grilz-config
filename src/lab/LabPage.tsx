import { useMemo } from 'react';
import Scene from '../components/three/Scene';
import type { ToothCustomization } from '../lib/types';
import { METALS } from '../lib/renderSpec';

// Dev-only render lab (/lab, not routed in production builds): the 3D model with
// a fixed design from the URL, for side-by-side visual comparisons.
//   /lab?metal=yellow&type=iced&count=6

export default function LabPage() {
  const params = new URLSearchParams(window.location.search);
  const metalId = params.get('metal') ?? 'yellow';
  const iced = params.get('type') === 'iced';
  const count = Number(params.get('count') ?? 6);
  const customizations = useMemo<ToothCustomization[]>(() => {
    const start = Math.floor((16 - count) / 2);
    const covered = new Set<number>();
    for (let i = 0; i < count; i += 1) {
      covered.add(start + i);
      covered.add(16 + start + i);
    }
    const metal = METALS.find((item) => item.id === metalId) ?? METALS[0];
    return Array.from({ length: 32 }, (_, index) =>
      covered.has(index)
        ? { material: metal.id === 'silver' || metal.id === 'platinum' ? 'silver' : 'gold', color: metal.swatch, metal: metal.id, hasDiamonds: iced, diamondType: 'lab' }
        : { material: 'default', color: '#f5f5f2', hasDiamonds: false },
    );
  }, [metalId, iced, count]);

  return (
    <div style={{ width: '100vw', height: '100vh', background: '#f4f1ec' }}>
      <Scene customizations={customizations} selectedTeeth={[]} isSelectionMode={false} toggleToothSelection={() => {}} />
    </div>
  );
}
