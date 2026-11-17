import type { ReactNode } from 'react';

// The lab's shared Row: words on the left, the round picture (Thumb) on the right.
// A choice is a radio; a link opens elsewhere; otherwise it only shows.
type RowProps = {
  title: ReactNode;
  hint?: ReactNode;
  thumb: ReactNode;
  lead?: boolean;
} & (
  | { kind?: 'show' }
  | { kind: 'radio'; checked: boolean; onSelect: () => void }
  | { kind: 'link'; href: string }
);

export function Row(props: RowProps) {
  const inner = (
    <>
      <span className="txt">
        <b>{props.title}</b>
        {props.hint && <span className="ins">{props.hint}</span>}
      </span>
      <span className="prev">{props.thumb}</span>
    </>
  );
  const className = `mrow${props.lead ? ' lead' : ''}`;
  if (props.kind === 'radio') {
    return (
      <button type="button" role="radio" aria-checked={props.checked} tabIndex={props.checked ? 0 : -1} className={className} onClick={props.onSelect}>
        {inner}
      </button>
    );
  }
  if (props.kind === 'link') {
    return (
      <a className={className} href={props.href} target="_blank" rel="noopener noreferrer">
        {inner}
      </a>
    );
  }
  return <div className={className}>{inner}</div>;
}
