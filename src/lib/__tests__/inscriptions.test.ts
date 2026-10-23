import { describe, expect, it } from 'vitest';
import { describeInscription, inscriptionLook, parseRenderSpec, planMasks, type RenderSpec, type RenderTooth } from '../renderSpec';
import { priceBreakdown } from '../pricing';
import { inscriptionsFrom, newDraft, pickTooth } from '../inscriptionDrafts';
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
