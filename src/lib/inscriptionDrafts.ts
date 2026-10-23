import {
  INSCRIPTION_PER_TOOTH,
  INSCRIPTION_SPAN_MAX,
  type EnamelId,
  type Inscription,
  type InscriptionFontId,
  type InscriptionStyleId,
} from './renderSpec';

// The builder's inscriptions while the customer edits them: up to two, one per
// row. A draft counts once it has text and teeth in the set (MAG-76).

export type InscriptionDraft = {
  text: string;
  style: InscriptionStyleId;
  font: InscriptionFontId;
  enamel: EnamelId | null;
  teeth: number[];
  /** The first tooth tapped while choosing a run; the next tap in the same row ends it. */
  anchor: number | null;
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
