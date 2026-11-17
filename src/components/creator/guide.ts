// The guide: a quick question that steps in only when someone seems stuck (decided Nov 16, built in the
// lab's 50-ui.js). Pure rules here; the bubble itself is QuickQuestion.tsx.
import type { PartId } from './model';

export type QuestionId = 'where' | 'many' | 'metal' | 'finish' | 'stones' | 'extras' | 'happy';

/** No touch for this long while building, and the guide asks. */
export const IDLE_MS = 9000;
/** Closing the bubble keeps it away for this long. */
export const QUIET_AFTER_CLOSE_MS = 20000;
/** "Keep editing" on Happy with it? keeps it away longer. */
export const QUIET_AFTER_KEEP_MS = 30000;
/** How long "Changed … Undo" stays. */
export const UNDO_MS = 6000;

/** The next thing worth asking: the teeth first, then the first part not opened yet, then whether they're done. */
export function nextQuestion(hasTeeth: boolean, visited: Partial<Record<PartId, boolean>>): QuestionId {
  if (!hasTeeth) return 'where';
  const order: QuestionId[] = ['metal', 'finish', 'stones', 'extras'];
  return order.find((q) => !visited[q as PartId]) ?? 'happy';
}

export type StuckInput = {
  /** Only while building (not on the start page, the AI or after Done). */
  building: boolean;
  /** A bubble (question or Undo) is already up. */
  bubbleOpen: boolean;
  now: number;
  /** The guide was closed or answered "Keep editing" until then. */
  quietUntil: number;
  /** The last tap, key or drag anywhere (the panel or the 3D). */
  lastTouch: number;
  hasTeeth: boolean;
  /** The panel is dragged up on a phone: no room for the bubble. */
  panelBig?: boolean;
};

/**
 * Does someone seem stuck? An empty build asks at once (which teeth?); otherwise only after IDLE_MS of
 * nothing. Never over another bubble, and never while they asked for quiet.
 */
export function seemsStuck(s: StuckInput): boolean {
  if (!s.building || s.bubbleOpen || s.panelBig || s.now < s.quietUntil) return false;
  if (!s.hasTeeth) return true;
  return s.now - s.lastTouch > IDLE_MS;
}
