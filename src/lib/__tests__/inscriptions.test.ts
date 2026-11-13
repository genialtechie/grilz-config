import { describe, expect, it } from 'vitest';
import { describeInscription, inscriptionLook, parseRenderSpec, planMasks, type RenderSpec, type RenderTooth } from '../renderSpec';
import { priceBreakdown } from '../pricing';
import { autoRun, inscriptionsFrom, newDraft, pickTooth, placeDrafts, unplaceDrafts } from '../inscriptionDrafts';
import { VVSLAB_CONFIG } from '../tenant/vvslab';

// Inscriptions that span teeth, in script or block, with enamel, one per row (MAG-76).

const tooth = (index: number): RenderTooth => ({ index, metal: 'yellow', karat: '14k', type: 'plain', style: 'solid', setting: 'honeycomb', stone: 'lab' });
const teeth = [...[4, 5, 6, 7, 8, 9, 10, 11].map(tooth), ...[20, 21, 22, 23, 24, 25, 26, 27].map(tooth)];
const spec = (inscriptions: unknown): unknown => ({ fangs: false, cut: 'deep', vision: '', teeth, inscriptions });
const name = { text: 'Lainee', teeth: [21, 22, 23, 24, 25, 26], style: 'engraved', font: 'script', enamel: 'pink' };

describe('inscriptions', () => {
  it('a name across six lower teeth, in script with pink enamel', () => {
    const parsed = parseRenderSpec(spec([name]))!;
    expect(parsed.inscriptions).toEqual([name]);
    expect(describeInscription(parsed.inscriptions[0])).toBe('"Lainee" in script, engraved with pink enamel, across 6 lower teeth');
    expect(inscriptionLook(parsed.inscriptions[0])).toContain('flowing cursive script');
    expect(inscriptionLook(parsed.inscriptions[0])).toContain('pink enamel');
    // One section edit covers the whole run.
    expect(planMasks(parsed).filter((plan) => plan.kind === 'inscription')).toEqual([{ kind: 'inscription', indices: [21, 22, 23, 24, 25, 26] }]);
  });

  it('still reads the old single-tooth shape', () => {
    const parsed = parseRenderSpec({ fangs: false, cut: 'deep', vision: '', teeth, inscription: { text: 'HB', tooth: 7, style: 'cut' } })!;
    expect(parsed.inscriptions).toEqual([{ text: 'HB', teeth: [7], style: 'cut', font: 'block', enamel: null }]);
  });

  it('one on each row, upper first', () => {
    const parsed = parseRenderSpec(spec([{ ...name, teeth: [24], text: 'Jae', enamel: null }, { text: 'G.U', teeth: [7], style: 'engraved', font: 'script', enamel: null }]))!;
    expect(parsed.inscriptions.map((item) => item.text)).toEqual(['G.U', 'Jae']);
  });

  it('refuses gaps, two rows at once, two on one row, too many letters, and enamel on raised letters', () => {
    expect(parseRenderSpec(spec([{ ...name, teeth: [21, 23] }]))).toBeNull();
    expect(parseRenderSpec(spec([{ ...name, teeth: [11, 20] }]))).toBeNull();
    expect(parseRenderSpec(spec([{ ...name, teeth: [21] }, { ...name, teeth: [25] }]))).toBeNull();
    expect(parseRenderSpec(spec([{ ...name, text: 'Abcdefghijk', teeth: [21] }]))).toBeNull();
    expect(parseRenderSpec(spec([{ ...name, teeth: [3] }]))).toBeNull(); // not in the set
    expect(parseRenderSpec(spec([{ ...name, style: 'cut' }]))!.inscriptions[0].enamel).toBeNull();
  });

  it('is priced per tooth it covers', () => {
    const parsed = parseRenderSpec(spec([name])) as RenderSpec;
    const line = priceBreakdown(VVSLAB_CONFIG.pricing, parsed.teeth, parsed).lines.find((item) => item.label.startsWith('Inscription'));
    expect(line).toEqual({ label: 'Inscription "Lainee" · 6 teeth', amount: (VVSLAB_CONFIG.pricing.inscription.engraved ?? 0) * 6 });
  });

  it('picking: first tap starts a run, a second tap in the row ends it, stopping at gaps', () => {
    const inSet = new Set([20, 21, 22, 23, 25, 26]);
    let picked = pickTooth({ ...newDraft(), text: 'Lainee' }, 21, inSet, null);
    expect(picked).toMatchObject({ done: false, draft: { teeth: [21], anchor: 21 } });
    picked = pickTooth(picked.draft, 26, inSet, null);
    expect(picked).toMatchObject({ done: true, draft: { teeth: [21, 22, 23], anchor: null } });
    // The same tooth twice: just that tooth.
    expect(pickTooth(pickTooth(newDraft(), 22, inSet, null).draft, 22, inSet, null).draft.teeth).toEqual([22]);
    // A row another inscription already uses is skipped.
    expect(pickTooth(newDraft(), 22, inSet, 1).draft.teeth).toEqual([]);
    // Only drafts with text, teeth in the set and room for the letters count.
    expect(inscriptionsFrom([{ ...picked.draft, text: 'Lainee' }], inSet)).toHaveLength(1);
    expect(inscriptionsFrom([{ ...picked.draft, text: '' }], inSet)).toHaveLength(0);
    expect(inscriptionsFrom([{ ...picked.draft, teeth: [22], text: 'Abcdefgh' }], inSet)).toHaveLength(0);
  });
});

// Typed text shows on the model straight away, on the front teeth, until the customer picks teeth (MAG-148).
describe('automatic placement', () => {
  const sixBySix = new Set([5, 6, 7, 8, 9, 10, 21, 22, 23, 24, 25, 26]);
  const typed = (text: string, patch = {}) => ({ ...newDraft(), text, ...patch });

  it('"HBO" on a 6 x 6 goes on the two front top teeth', () => {
    expect(autoRun('HBO', sixBySix, 0)).toEqual([7, 8]);
    const [placed] = placeDrafts([typed('HBO')], sixBySix);
    expect(placed).toMatchObject({ teeth: [7, 8], auto: true });
    expect(inscriptionsFrom([placed], sixBySix)).toEqual([{ text: 'HBO', teeth: [7, 8], style: 'cut', font: 'block', enamel: null }]);
  });

  it('grows with the text and stays centred', () => {
    expect(autoRun('ABCDEFGHIJKL', sixBySix, 0)).toEqual([7, 8]);
    expect(autoRun('A', new Set([7]), 0)).toEqual([7]);
    // An odd row keeps an odd run on its middle tooth.
    expect(autoRun('A', new Set([6, 7, 8]), 0)).toEqual([7]);
    expect(autoRun('ABCDEFG', new Set([6, 7, 8]), 0)).toEqual([6, 7, 8]);
    // Never more teeth than the run may span, or than the row has.
    const full = new Set(Array.from({ length: 16 }, (_, index) => index));
    expect(autoRun('ABCDEFGHIJKL', full, 0)).toEqual([7, 8]);
    expect(autoRun('AB', new Set([3, 4]), 0)).toEqual([3, 4]);
  });

  it('uses the bottom row when there are no top teeth, or the other text is on top', () => {
    const bottomOnly = new Set([21, 22, 23, 24, 25, 26]);
    expect(placeDrafts([typed('HB')], bottomOnly)[0].teeth).toEqual([23, 24]);
    const [first, second] = placeDrafts([typed('HB'), typed('JAE')], sixBySix);
    expect(first.teeth).toEqual([7, 8]);
    expect(second.teeth).toEqual([23, 24]);
    // The second text picked on top by hand: the first moves to the bottom.
    const moved = placeDrafts([typed('HB'), typed('JAE', { teeth: [6] })], sixBySix);
    expect(moved[0].teeth).toEqual([23, 24]);
    expect(moved[1]).toMatchObject({ teeth: [6], auto: undefined });
  });

  it('never moves teeth the customer picked, and nothing shows without text', () => {
    expect(placeDrafts([typed('HB', { teeth: [9] })], sixBySix)[0]).toMatchObject({ teeth: [9], auto: undefined });
    expect(placeDrafts([typed('  ')], sixBySix)[0].teeth).toEqual([]);
    expect(inscriptionsFrom(placeDrafts([typed('')], sixBySix), sixBySix)).toEqual([]);
    // Picked teeth that left the set: back to the automatic run.
    expect(placeDrafts([typed('HB', { teeth: [2] })], sixBySix)[0].teeth).toEqual([7, 8]);
  });

  it('a tap on the model replaces the automatic run; automatic runs are not stored', () => {
    const placed = placeDrafts([typed('HBO')], sixBySix);
    expect(unplaceDrafts(placed)[0]).toEqual(typed('HBO'));
    const { draft } = pickTooth(unplaceDrafts(placed)[0], 9, sixBySix, null);
    expect(placeDrafts([draft], sixBySix)[0]).toMatchObject({ teeth: [9], auto: undefined });
  });
});
