import type { CSSProperties } from 'react';
import { developed, photoCaption } from './afterLogic';

export type PhotoStatus = 'developing' | 'ready' | 'none';

/**
 * The 3D still develops into the studio photo (about 30 s): it starts washed out and blurred, sharpens
 * while the photo is made, and the photo fades in over it when it arrives. With reduced motion, the
 * still shows plainly and the photo replaces it.
 */
export function Photo({ still, photo, status, elapsed }: { still: string; photo: string | null; status: PhotoStatus; elapsed: number }) {
  const e = status === 'developing' ? developed(elapsed, false) : 1;
  const style = {
    '--b': `${(16 * (1 - e)).toFixed(2)}px`,
    '--br': (1 + 0.9 * (1 - e)).toFixed(3),
    '--sa': (0.15 + 0.85 * e).toFixed(3),
    '--co': (0.55 + 0.45 * e).toFixed(3),
  } as CSSProperties;
  const caption = photoCaption(status, elapsed);
  return (
    <figure className="after-photo" data-ready={status === 'ready' && photo ? '' : undefined} style={{ margin: 0, ...style }}>
      <div className="frame">
        <img className="still" src={still} alt={status === 'ready' ? '' : 'Your design in 3D'} />
        {photo && <img className="final" src={photo} alt="The studio photo of your grillz" />}
      </div>
      {/* the countdown changes every second, so only the start and the end are announced */}
      <figcaption className="cap" aria-hidden={status === 'developing'}>
        {caption}
      </figcaption>
      <span className="sr" aria-live="polite">
        {status === 'ready' ? 'Your studio photo is ready.' : status === 'developing' ? 'Your studio photo is developing. About 30 seconds.' : ''}
      </span>
    </figure>
  );
}
