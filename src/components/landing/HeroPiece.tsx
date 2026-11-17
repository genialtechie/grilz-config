import { Component, useMemo, type ReactNode } from 'react';
import Scene from '../three/Scene';
import { baseToothState } from '../../lib/hooks/useGrillzCustomization';
import { toothCustomization } from '../../lib/toothCustomization';
import type { DesignSnapshot } from '../../lib/savedDesign';
import type { ToothCustomization } from '../../lib/types';

// The live piece behind the hero: the builder's own scene, on a transparent
// canvas so the page's background shows through. Loaded on its own after the
// page has painted (see LandingPage), so the words never wait for three.js.

/** If WebGL can't start, the hero simply has no piece; the page carries on. */
class Quiet extends Component<{ children: ReactNode }, { failed: boolean }> {
  state = { failed: false };
  static getDerivedStateFromError() {
    return { failed: true };
  }
  render() {
    return this.state.failed ? null : this.props.children;
  }
}

const noop = () => {};

export default function HeroPiece({ design, onReady }: { design: DesignSnapshot; onReady: () => void }) {
  const customizations = useMemo<ToothCustomization[]>(() => {
    const on = new Set(design.teeth);
    return Array.from({ length: 32 }, (_, index) =>
      on.has(index) ? toothCustomization(design.overrides[index] ?? design.base, design.set, index) : { ...baseToothState },
    );
  }, [design]);

  return (
    <Quiet>
      <Scene customizations={customizations} selectedTeeth={[]} isSelectionMode={false} toggleToothSelection={noop} onReady={onReady} />
    </Quiet>
  );
}
