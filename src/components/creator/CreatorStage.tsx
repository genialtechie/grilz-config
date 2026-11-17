import type { RootState } from '@react-three/fiber';
import Scene from '../three/Scene';
import { ViewerBoundary } from '../three/ViewerBoundary';
import type { SceneProps } from '../../lib/types';

/**
 * The 3D, loaded on its own (CreatorApp imports it lazily) so the panel is on screen and usable while
 * three.js downloads. When WebGL can't start, the boundary says so and the panel still works.
 */
export default function CreatorStage({ onError, onReady, ...props }: SceneProps & { onReady?: (state: RootState) => void; onError?: (error: Error) => void }) {
  return (
    <ViewerBoundary onError={onError}>
      <Scene {...props} onReady={onReady} />
    </ViewerBoundary>
  );
}
