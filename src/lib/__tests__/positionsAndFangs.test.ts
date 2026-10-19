import { describe, expect, it } from 'vitest';
import { metalPerTooth, priceBreakdown } from '../pricing';
import { DEFAULT_SET, parseRenderSpec, planMasks, toothPosition, type RenderTooth, type ToothDesign } from '../renderSpec';
import { describeChanges } from '../tenant/diff';
import { parseTenantConfig, type TenantPricing } from '../tenant/schema';
import { VVSLAB_CONFIG } from '../tenant/vvslab';

const tooth: ToothDesign = { metal: 'yellow', karat: '10k', type: 'plain', style: 'solid', setting: 'honeycomb', stone: 'moissanite' };
const at = (...indices: number[]): RenderTooth[] => indices.map((index) => ({ ...tooth, index }));
const base: TenantPricing = { ...VVSLAB_CONFIG.pricing, minimumOrder: 0, extras: { ...VVSLAB_CONFIG.pricing.extras, fangs: 40 } };
const line = (pricing: TenantPricing, teeth: RenderTooth[], label: string, fangs = false) =>
  priceBreakdown(pricing, teeth, { ...DEFAULT_SET, fangs }).lines.find((item) => item.label.startsWith(label))?.amount;

describe('tooth positions', () => {
  it('groups the incisors and canines as front, then premolars, then molars, on both rows', () => {
    expect([7, 8, 6, 9, 5, 10].map(toothPosition)).toEqual(Array(6).fill('front'));
    expect([4, 11, 3, 12].map(toothPosition)).toEqual(Array(4).fill('premolar'));
    expect([2, 13, 0, 15].map(toothPosition)).toEqual(Array(4).fill('molar'));
    expect([23, 21, 20, 18].map(toothPosition)).toEqual(['front', 'front', 'premolar', 'molar']);
  });

  it('prices back teeth at the shop’s share of a front tooth, on a line of its own', () => {
    const pricing = { ...base, positions: { premolar: 120, molar: 150 } };
    const metal = metalPerTooth(pricing, 'yellow', '10k');
    // One front, one premolar, one molar.
    expect(line(pricing, at(7, 4, 0), 'Back teeth · 2 teeth')).toBe(Math.round(metal * 0.2 + metal * 0.5));
    expect(line(pricing, at(7, 4, 0), 'Metal')).toBe(metal * 3);
    // Cheaper back teeth come off.
    expect(line({ ...base, positions: { premolar: 80, molar: 80 } }, at(4), 'Back teeth')).toBe(-Math.round(metal * 0.2));
    // Front-only sets and shops that haven't set it: no line, totals as before.
    expect(line(pricing, at(6, 7, 8, 9), 'Back teeth')).toBeUndefined();
    expect(line(base, at(0, 4, 7), 'Back teeth')).toBeUndefined();
  });

  it('takes the set-size discount off the back-teeth price too', () => {
    const pricing = { ...base, positions: { premolar: 150, molar: 150 }, volume: [{ minTeeth: 2, percentOff: 10 }] };
    const metal = metalPerTooth(pricing, 'yellow', '10k');
    expect(line(pricing, at(7, 4), 'Set discount')).toBe(-Math.round((metal * 2 + metal * 0.5) * 0.1));
  });
});

describe('fangs', () => {
  it('charges once per set by default, only when the set has an upper canine', () => {
    expect(line(base, at(5, 6, 7, 8, 9, 10), 'Fangs', true)).toBe(40);
    // A 2-piece front set has no canine to build a fang on.
    expect(line(base, at(7, 8), 'Fangs', true)).toBeUndefined();
  });

  it('charges per fang when the shop says so: one per upper canine in the set', () => {
    const pricing = { ...base, fangsPer: 'fang' as const };
    expect(line(pricing, at(5, 6, 7, 8, 9, 10), 'Fangs · 2', true)).toBe(80);
    expect(line(pricing, at(5, 6, 7), 'Fangs · 1', true)).toBe(40);
  });

  it('drops fangs from a design with no upper canine, and only plans fangs on canines in the set', () => {
    expect(parseRenderSpec({ ...DEFAULT_SET, fangs: true, teeth: at(7, 8) }, VVSLAB_CONFIG.catalog)?.fangs).toBe(false);
    const one = parseRenderSpec({ ...DEFAULT_SET, fangs: true, teeth: at(5, 6, 7) }, VVSLAB_CONFIG.catalog)!;
    expect(one.fangs).toBe(true);
    expect(planMasks(one).filter((plan) => plan.kind === 'fangs').map((plan) => plan.indices)).toEqual([[5]]);
  });
});

describe('shop settings', () => {
  it('accepts sensible values, refuses silly ones and lists the change', () => {
    const pricing = { ...VVSLAB_CONFIG.pricing, fangsPer: 'fang' as const, positions: { premolar: 110, molar: 130 } };
    expect(parseTenantConfig({ ...VVSLAB_CONFIG, pricing }).ok).toBe(true);
    expect(parseTenantConfig({ ...VVSLAB_CONFIG, pricing: { ...pricing, positions: { premolar: 10, molar: 130 } } }).ok).toBe(false);
    const changes = JSON.stringify(describeChanges(VVSLAB_CONFIG, { ...VVSLAB_CONFIG, pricing }));
    expect(changes).toContain('Fangs charged per fang');
    expect(changes).toContain('Molars: 100% → 130% of a front tooth');
  });
});
