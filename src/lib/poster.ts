import type { SetOptions, ToothDesign } from './renderSpec.js';

// The poster: a still of the set, shown in the 3D view's place while the 3D
// code and the model download, so the builder opens on the grillz instead of a
// spinner. The live model fades in over it.
//
// The two line up without any measuring. The viewer frames the model to fill a
// fixed share of the canvas along whichever axis runs out first (fitDistance),
// and the camera looks at the model's centre. A still taken on a canvas with
// the model's own aspect ratio fills that share along both axes at once, so
// showing it centred with `object-fit: contain` puts it at the size and place
// the live model will take, on any screen.

/**
 * Width over height of the poster images (scripts/posters/capture.ts): the
 * model's own, MODEL_SIZE in framing.ts. Written out here so this file, which
 * loads with the page, doesn't pull in three.js; a test keeps the two equal.
 */
export const POSTER_ASPECT = 4.3 / 3.4;

/**
 * The poster for a builder that opens on this design, or null when there is no
 * still of it. Stills exist for the default set in each metal: plain, solid,
 * deep cut, no fangs (which is what every shop that sells plain grillz opens on).
 */
export function posterFor(tooth: ToothDesign, set: Pick<SetOptions, 'fangs' | 'cut'>): string | null {
  if (tooth.type !== 'plain' || tooth.style !== 'solid' || set.fangs || set.cut !== 'deep') return null;
  return `/assets/posters/set-${tooth.metal}.webp`;
}
