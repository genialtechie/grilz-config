// The creator's icons: the line set the live builder uses (lucide paths), drawn in ink, and the stage tools'
// own small marks, as in the Grill Creator Lab. Every icon is decorative: the button around it carries the label.

const LINE = {
  kit: (
    <>
      <path d="M11 21.73a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73z" />
      <path d="M12 22V12" />
      <path d="m3.3 7 7.703 4.734a2 2 0 0 0 1.994 0L20.7 7" />
      <path d="m7.5 4.27 9 5.15" />
    </>
  ),
  check: (
    <>
      <circle cx="12" cy="12" r="10" />
      <path d="m9 12 2 2 4-4" />
    </>
  ),
  spark: (
    <>
      <path d="M9.937 15.5A2 2 0 0 0 8.5 14.063l-6.135-1.582a.5.5 0 0 1 0-.962L8.5 9.936A2 2 0 0 0 9.937 8.5l1.582-6.135a.5.5 0 0 1 .963 0L14.063 8.5A2 2 0 0 0 15.5 9.937l6.135 1.581a.5.5 0 0 1 0 .964L15.5 14.063a2 2 0 0 0-1.437 1.437l-1.582 6.135a.5.5 0 0 1-.963 0z" />
      <path d="M20 3v4" />
      <path d="M22 5h-4" />
    </>
  ),
  cam: (
    <>
      <path d="M14.5 4h-5L7 7H4a2 2 0 0 0-2 2v9a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2V9a2 2 0 0 0-2-2h-3l-2.5-3z" />
      <circle cx="12" cy="13" r="3" />
    </>
  ),
  plus: (
    <>
      <path d="M5 12h14" />
      <path d="M12 5v14" />
    </>
  ),
} as const;

export function Ico({ name }: { name: keyof typeof LINE }) {
  return (
    <svg className="ico" viewBox="0 0 24 24" aria-hidden="true">
      {LINE[name]}
    </svg>
  );
}

const STROKE = { fill: 'none', stroke: 'currentColor', strokeWidth: 1.6, strokeLinecap: 'round', strokeLinejoin: 'round' } as const;

export const JawIcon = () => (
  <svg viewBox="0 0 16 16" aria-hidden="true">
    <path d="M2.5 6.5q5.5-4 11 0M2.5 9.5q5.5 4 11 0" {...STROKE} />
  </svg>
);
export const TurnIcon = () => (
  <svg viewBox="0 0 16 16" aria-hidden="true">
    <path d="M13 8a5 5 0 1 1-1.6-3.7M13 2.8v2.6h-2.6" {...STROKE} />
  </svg>
);
export const UndoIcon = () => (
  <svg viewBox="0 0 16 16" aria-hidden="true">
    <path d="M5.6 3.8 2.8 6.6l2.8 2.8M3 6.6h6.4a3.8 3.8 0 0 1 0 7.6H7" {...STROKE} />
  </svg>
);
export const SparkIcon = () => (
  <svg className="ai" viewBox="0 0 16 16" aria-hidden="true">
    <path d="M7 2.2l1.3 3.4 3.4 1.3-3.4 1.3L7 11.6 5.7 8.2 2.3 6.9l3.4-1.3zM12.6 10.4l.6 1.5 1.5.6-1.5.6-.6 1.5-.6-1.5-1.5-.6 1.5-.6z" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinejoin="round" />
  </svg>
);
export const ToothIcon = () => (
  <svg viewBox="0 0 16 16" aria-hidden="true">
    <path d="M8 3.3c-.9-.7-3-.8-3.4 1-.3 1.4.3 2.3.6 3.6.2 1.3.3 3.1 1.1 3.1.9 0 .8-2 1.7-2s.8 2 1.7 2c.8 0 .9-1.8 1.1-3.1.3-1.3.9-2.2.6-3.6-.4-1.8-2.5-1.7-3.4-1z" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinejoin="round" />
  </svg>
);
export const TapIcon = () => (
  <svg viewBox="0 0 24 24" aria-hidden="true">
    <path d="M9 11V5.5a1.5 1.5 0 0 1 3 0V10m0-.5V4.5a1.5 1.5 0 0 1 3 0V10m0-1a1.5 1.5 0 0 1 3 0v4.5a6.5 6.5 0 0 1-6.5 6.5h-.6a6 6 0 0 1-4.6-2.2L4.4 14.6a1.6 1.6 0 0 1 2.4-2.1L9 14.5" />
  </svg>
);
