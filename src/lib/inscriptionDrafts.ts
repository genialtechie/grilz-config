import {
  INSCRIPTION_PER_TOOTH,
  INSCRIPTION_SPAN_MAX,
  type EnamelId,
  type Inscription,
  type InscriptionFontId,
  type InscriptionStyleId,
} from './renderSpec';

// The builder's inscriptions while the customer edits them: up to two, one per
// row. A draft counts once it has text and teeth in the set (MAG-76). Until the
// customer taps teeth for it, a draft with text sits on an automatic run of
// front teeth (placeDrafts), so typing shows on the model at once (MAG-148).

export type InscriptionDraft = {
  text: string;
  style: InscriptionStyleId;
  font: InscriptionFontId;
  enamel: EnamelId | null;
  teeth: number[];
  /** The first tooth tapped while choosing a run; the next tap in the same row ends it. */
  anchor: number | null;
  /** Set by placeDrafts: `teeth` were chosen automatically, not tapped by the customer. */
  auto?: boolean;
};

export const newDraft = (style: InscriptionStyleId = 'cut'): InscriptionDraft => ({ text: '', style, font: 'block', enamel: null, teeth: [], anchor: null });

const rowOf = (index: number) => Math.floor(index / 16);

/** The draft's teeth as a valid run: all in the set, neighbours in one row. */
const runInSet = (teeth: number[], inSet: Set<number>) => (teeth.length > 0 && teeth.every((index) => inSet.has(index)) ? teeth : []);

/** Does the text fit the teeth it is on? */
export const fitsTeeth = (draft: Pick<InscriptionDraft, 'text' | 'teeth'>) => draft.text.trim().length <= INSCRIPTION_PER_TOOTH * Math.max(1, draft.teeth.length);

/** The inscriptions that count: text, teeth in the set, enough teeth for the letters, one per row. */
export function inscriptionsFrom(drafts: InscriptionDraft[], inSet: Set<number>): Inscription[] {
  const rows = new Set<number>();
  return drafts.flatMap((draft) => {
    const teeth = runInSet(draft.teeth, inSet);
    const text = draft.text.trim();
    if (!text || !teeth.length || !fitsTeeth(draft) || rows.has(rowOf(teeth[0]))) return [];
    rows.add(rowOf(teeth[0]));
    return [{ text: draft.font === 'block' ? text.toUpperCase() : text, teeth, style: draft.style, font: draft.font, enamel: draft.style === 'engraved' ? draft.enamel : null }];
  });
}

/**
 * A tap on a tooth while choosing where the letters go. The first tap starts a
 * run on that tooth; a second tap in the same row ends it (every tooth between
 * must be in the set). Teeth on the row another inscription uses are skipped.
 */
export function pickTooth(draft: InscriptionDraft, index: number, inSet: Set<number>, blockedRow: number | null): { draft: InscriptionDraft; done: boolean } {
  if (!inSet.has(index) || rowOf(index) === blockedRow) return { draft, done: false };
  if (draft.anchor === null || rowOf(draft.anchor) !== rowOf(index)) return { draft: { ...draft, teeth: [index], anchor: index }, done: false };
  const from = Math.min(draft.anchor, index);
  const to = Math.max(draft.anchor, index);
  // Stop at the first gap, going out from the first tooth tapped.
  const teeth: number[] = [draft.anchor];
  for (let next = draft.anchor - 1; next >= from && inSet.has(next); next -= 1) teeth.unshift(next);
  for (let next = draft.anchor + 1; next <= to && inSet.has(next); next += 1) teeth.push(next);
  return { draft: { ...draft, teeth: teeth.slice(0, INSCRIPTION_SPAN_MAX), anchor: null }, done: true };
}

/** The row an inscription draft sits on, if it has teeth. */
export const draftRow = (draft: InscriptionDraft): number | null => (draft.teeth.length ? rowOf(draft.teeth[0]) : null);

/** The middle of each row, between its two front teeth. */
const ROW_CENTRE = [7.5, 23.5];

/**
 * The teeth a draft's text sits on before the customer picks any: a run of
 * neighbouring teeth in `row`, centred on the front of the set, as many as the
 * letters need (INSCRIPTION_PER_TOOTH a tooth, at most INSCRIPTION_SPAN_MAX).
 * The run keeps to the middle: on a row with an even number of teeth it takes
 * an even number (the two front teeth rather than one beside the middle).
 * Empty when the row has no teeth in the set.
 */
export function autoRun(text: string, inSet: Set<number>, row: number): number[] {
  const letters = text.trim().length;
  if (!letters) return [];
  // The longest stretch of neighbouring teeth in the row nearest its middle.
  const blocks: number[][] = [];
  for (let index = row * 16; index < row * 16 + 16; index += 1) {
    if (!inSet.has(index)) continue;
    const last = blocks.at(-1);
    if (last && last.at(-1) === index - 1) last.push(index);
    else blocks.push([index]);
  }
  if (!blocks.length) return [];
  const centre = ROW_CENTRE[row];
  const distance = (block: number[]) => Math.abs((block[0] + block.at(-1)!) / 2 - centre);
  const block = [...blocks].sort((a, b) => b.length - a.length || distance(a) - distance(b))[0];
  let count = Math.min(INSCRIPTION_SPAN_MAX, block.length, Math.ceil(letters / INSCRIPTION_PER_TOOTH));
  // Keep the run on the middle: match the block's odd or even count when there is room.
  if ((block.length - count) % 2 === 1 && count < Math.min(INSCRIPTION_SPAN_MAX, block.length)) count += 1;
  // The window of `count` teeth in the block whose middle is closest to the row's.
  let best = 0;
  for (let start = 0; start + count <= block.length; start += 1) {
    const middle = (block[start] + block[start + count - 1]) / 2;
    const bestMiddle = (block[best] + block[best + count - 1]) / 2;
    if (Math.abs(middle - centre) < Math.abs(bestMiddle - centre) - 1e-9) best = start;
  }
  return block.slice(best, best + count);
}

/** Does the draft sit on teeth the customer picked, all still in the set? */
const manualRun = (draft: InscriptionDraft, inSet: Set<number>) => runInSet(draft.teeth, inSet);

/**
 * The drafts as the builder shows them: a draft with text and no teeth of its
 * own (none picked, or picked teeth no longer in the set) gets an automatic run
 * (autoRun), marked `auto`. It goes on the top row, unless the set has no top
 * teeth or the other draft is there; then the bottom row. Teeth the customer
 * picked are never moved.
 */
export function placeDrafts(drafts: InscriptionDraft[], inSet: Set<number>): InscriptionDraft[] {
  const placed: InscriptionDraft[] = drafts.map((draft) => ({ ...draft, auto: undefined }));
  const rowOfDraft = (draft: InscriptionDraft) => (draft.teeth.length ? rowOf(draft.teeth[0]) : null);
  placed.forEach((draft, i) => {
    if (!draft.text.trim() || manualRun(draft, inSet).length || draft.anchor !== null) return;
    const others = placed.filter((_, j) => j !== i).map((other) => (manualRun(other, inSet).length || other.auto ? rowOfDraft(other) : null));
    const rows = [0, 1].filter((row) => !others.includes(row) && [...inSet].some((index) => rowOf(index) === row));
    if (!rows.length) return;
    const teeth = autoRun(draft.text, inSet, rows[0]);
    if (teeth.length) placed[i] = { ...draft, teeth, auto: true };
  });
  return placed;
}

/** The drafts to keep in state from what the editor hands back: automatic runs aren't stored, they are worked out again. */
export const unplaceDrafts = (drafts: InscriptionDraft[]): InscriptionDraft[] =>
  drafts.map(({ auto, ...draft }) => (auto ? { ...draft, teeth: [] } : draft));
