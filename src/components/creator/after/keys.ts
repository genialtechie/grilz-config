import type { KeyboardEvent } from 'react';

/** Radio rows move with the arrow keys, like any radio group. */
export const radioKeys = (event: KeyboardEvent<HTMLElement>) => {
  if (!['ArrowDown', 'ArrowUp', 'ArrowLeft', 'ArrowRight'].includes(event.key)) return;
  const radios = [...event.currentTarget.querySelectorAll<HTMLButtonElement>('[role="radio"]')];
  const at = radios.indexOf(document.activeElement as HTMLButtonElement);
  if (at < 0) return;
  event.preventDefault();
  const next = radios[(at + (event.key === 'ArrowDown' || event.key === 'ArrowRight' ? 1 : radios.length - 1)) % radios.length];
  next.focus();
  next.click();
};
