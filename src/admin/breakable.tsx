import { Fragment, type ReactNode } from 'react';

/**
 * A link or email that wraps where a person would break it: after a slash,
 * before a dot or an @. Pair with `overflow-wrap: anywhere` as the last resort
 * for a part that still doesn't fit.
 */
export function breakable(text: string): ReactNode {
  return text.split(/(?<=\/)|(?=[.@])/).map((part, index) => (
    <Fragment key={index}>
      {index > 0 && <wbr />}
      {part}
    </Fragment>
  ));
}
