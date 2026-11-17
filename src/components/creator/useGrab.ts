import { useCallback, useEffect, useLayoutEffect, useRef, type PointerEvent as ReactPointerEvent, type RefObject } from 'react';

/** How far a drag goes before it counts (px). */
const SWIPE = 24;

const reduced = () => typeof window !== 'undefined' && Boolean(window.matchMedia?.('(prefers-reduced-motion: reduce)').matches);

/**
 * A panel that grows (the lab's doorSize and traySize): drag its handle (or its heading) up for more room,
 * down to give the 3D its room back; a tap on the handle toggles; Escape shrinks. The height change
 * animates from where it was.
 * `handle` and `head` are CSS selectors inside the panel that start a drag.
 */
export function useGrab(panel: RefObject<HTMLElement | null>, big: boolean, setBig: (big: boolean) => void, handle: string, head: string) {
  const start = useRef<{ y: number; moved: boolean; onHandle: boolean } | null>(null);
  const before = useRef<number | null>(null);
  const resize = useCallback(
    (next: boolean) => {
      if (next === big) return;
      before.current = panel.current?.offsetHeight ?? null;
      setBig(next);
    },
    [big, panel, setBig],
  );

  useLayoutEffect(() => {
    const el = panel.current;
    const from = before.current;
    before.current = null;
    if (!el || from === null || reduced() || !el.animate) return;
    el.scrollTop = 0;
    el.animate([{ height: `${from}px`, overflow: 'hidden' }, { height: `${el.offsetHeight}px`, overflow: 'hidden' }], { duration: 340, easing: 'cubic-bezier(.2,.8,.2,1)' });
  }, [big, panel]);

  useEffect(() => {
    const move = (event: PointerEvent) => {
      const s = start.current;
      if (!s) return;
      const dy = event.clientY - s.y;
      if (Math.abs(dy) < SWIPE) return;
      s.moved = true;
      start.current = null;
      resize(dy < 0);
    };
    const up = () => {
      const s = start.current;
      start.current = null;
      if (s && !s.moved && s.onHandle) resize(!big);
    };
    const key = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && big) resize(false);
    };
    window.addEventListener('pointermove', move);
    window.addEventListener('pointerup', up);
    window.addEventListener('pointercancel', up);
    document.addEventListener('keydown', key);
    return () => {
      window.removeEventListener('pointermove', move);
      window.removeEventListener('pointerup', up);
      window.removeEventListener('pointercancel', up);
      document.removeEventListener('keydown', key);
    };
  }, [big, resize]);

  const onPointerDown = (event: ReactPointerEvent) => {
    const target = event.target as HTMLElement;
    const onHandle = Boolean(target.closest(handle));
    if (!onHandle && !target.closest(head)) return;
    // Buttons and fields inside the heading keep their own taps.
    if (!onHandle && target.closest('button, input, textarea, a, label')) return;
    start.current = { y: event.clientY, moved: false, onHandle };
  };

  return { onPointerDown, resize };
}
