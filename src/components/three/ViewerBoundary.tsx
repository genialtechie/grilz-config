import { Component, type ReactNode } from 'react';

// When the 3D view can't start (the browser has WebGL off or blocked, or the
// graphics driver refuses it), React would otherwise unmount the whole builder
// and leave a blank page. This keeps the failure to the viewer: it says what
// happened, and the options, price and Review stay usable.

type Props = { children: ReactNode; onError?: (error: Error) => void };

export class ViewerBoundary extends Component<Props, { failed: boolean }> {
  state = { failed: false };

  static getDerivedStateFromError() {
    return { failed: true };
  }

  componentDidCatch(error: Error) {
    this.props.onError?.(error);
  }

  render() {
    if (!this.state.failed) return this.props.children;
    return (
      <div className="viewer-canvas viewer-fallback" role="status">
        <div className="viewer-fallback__card">
          <strong>The 3D preview can’t start in this browser</strong>
          <p>You can still choose everything and see your price. To see the model, try Chrome or Safari, or turn on hardware acceleration in your browser’s settings.</p>
        </div>
      </div>
    );
  }
}
