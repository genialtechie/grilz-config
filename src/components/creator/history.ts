// Undo and Back, as pure functions (the lab's designSnap/track/undo and ui.navHist).
// Undo steps back through any change to the design; Back returns to the part you were on before.

/** The design as it was after each change: `past` holds what Undo goes back to, `last` is now. */
export type History = { past: string[]; last: string | null };

export const HISTORY_MAX = 60;
export const freshHistory = (): History => ({ past: [], last: null });

/** Notes the design as it is now; if it changed since the last note, the old one can be undone to. */
export function track(h: History, now: string, max = HISTORY_MAX): History {
  if (h.last === null) return { past: h.past, last: now };
  if (now === h.last) return h;
  const past = [...h.past, h.last];
  return { past: past.length > max ? past.slice(past.length - max) : past, last: now };
}

/** Steps back one change: the design to put back, and the history after it (null when nothing to undo). */
export function undo(h: History): { design: string; history: History } | null {
  if (!h.past.length) return null;
  const design = h.past[h.past.length - 1];
  return { design, history: { past: h.past.slice(0, -1), last: design } };
}

export const canUndo = (h: History) => h.past.length > 0;

/** Back's memory: the parts opened before this one, newest last. */
export function openPart<T extends string>(stack: readonly T[], from: T | null, to: T): T[] {
  return from && from !== to ? [...stack, from] : [...stack];
}

/** Where Back goes: the previous part, or null for the start page (the build is kept). */
export function back<T extends string>(stack: readonly T[]): { to: T | null; stack: T[] } {
  if (!stack.length) return { to: null, stack: [] };
  return { to: stack[stack.length - 1], stack: stack.slice(0, -1) };
}
