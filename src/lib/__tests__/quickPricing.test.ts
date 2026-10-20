import { describe, expect, it } from 'vitest';
import { checkLines, editLine, QUICK_RATIOS, quickAnswers, quickPricing } from '../quickPricing';
import { parseTenantConfig } from '../tenant/schema';
import { VVSLAB_CONFIG } from '../tenant/vvslab';

const start = { ...VVSLAB_CONFIG.pricing, source: 'default' as const };
const totals = (pricing: ReturnType<typeof quickPricing>) => Object.fromEntries(checkLines(pricing).map((line) => [line.id, line.total]));

describe('quick pricing', () => {
  it('prices a 6-top from three answers ($100 a tooth, $175 iced, no fee)', () => {
    const pricing = quickPricing(start, { gold: 100, iced: 175, fee: { kind: 'none', amount: 0 } });
    expect(totals(pricing)).toMatchObject({ gold10k: 600, gold14k: 840, gold18k: 1110, iced: 1050 });
    expect(pricing.base).toBe(0);
    expect(pricing.minimumOrder).toBe(0);
    expect(pricing.source).toBe('quick');
  });

  it('derives everything else by the shared ratios', () => {
    const pricing = quickPricing(start, { gold: 100, iced: 175, fee: { kind: 'service', amount: 150 } });
    expect(pricing.metalPerTooth).toEqual({ yellow: 100, white: 100, rose: 100, silver: 55, platinum: 210 });
    expect(pricing.karatMultiplier).toEqual(QUICK_RATIOS.karat);
    expect(pricing.stonePerTooth).toEqual({ moissanite: 75, lab: 160, natural: 325 });
    expect(pricing.stylePerTooth.solid).toBe(0);
    expect(pricing.stylePerTooth['diamond-cut']).toBe(25);
    expect(pricing.stylePerTooth.engraving).toBe(30);
    expect(pricing.extras.fangs).toBe(100);
    expect(pricing.settingPerTooth.honeycomb).toBe(0);
    expect(pricing.base).toBe(150);
    // Lab diamonds: 6 × (100 gold + 160 lab).
    expect(totals(pricing).icedLab).toBe(1560);
    expect(parseTenantConfig({ ...VVSLAB_CONFIG, pricing }).ok).toBe(true);
  });

  it('a minimum order instead of a fee', () => {
    const pricing = quickPricing(start, { gold: 120, iced: 200, fee: { kind: 'minimum', amount: 500 } });
    expect(pricing.base).toBe(0);
    expect(pricing.minimumOrder).toBe(500);
  });

  it('leaves what the questions don’t cover as it was', () => {
    const shop = { ...start, display: 'from' as const, volume: [{ minTeeth: 8, percentOff: 5 }], positions: { premolar: 120, molar: 150 }, molds: { kit: 30, own: 0, store: 0 }, inscription: { cut: 60, iced: 120, engraved: 40 } };
    const pricing = quickPricing(shop, { gold: 100, iced: 175, fee: { kind: 'none', amount: 0 } });
    for (const key of ['display', 'volume', 'positions', 'molds', 'inscription'] as const) expect(pricing[key]).toEqual(shop[key]);
    expect(pricing.extras.permanent).toBe(shop.extras.permanent);
    expect(pricing.extras.photo).toBe(shop.extras.photo);
  });

  it('reads the answers back from a shop’s prices', () => {
    expect(quickAnswers(start)).toEqual({ gold: 150, iced: 225, fee: { kind: 'service', amount: 200 } });
    const pricing = quickPricing(start, { gold: 100, iced: 175, fee: { kind: 'minimum', amount: 400 } });
    expect(quickAnswers(pricing)).toEqual({ gold: 100, iced: 175, fee: { kind: 'minimum', amount: 400 } });
  });

  it('changes just the price behind a line on the check screen', () => {
    const pricing = quickPricing(start, { gold: 100, iced: 175, fee: { kind: 'none', amount: 0 } });
    expect(totals(editLine(pricing, 'gold14k', 150))).toMatchObject({ gold10k: 600, gold14k: 900, gold18k: 1110 });
    expect(totals(editLine(pricing, 'iced', 200))).toMatchObject({ gold10k: 600, iced: 1200 });
    expect(totals(editLine(pricing, 'icedLab', 300))).toMatchObject({ iced: 1050, icedLab: 1800 });
    // The 10K answer re-derives everything that hangs off it, keeping the stone add-on.
    expect(totals(editLine(pricing, 'gold10k', 120))).toMatchObject({ gold10k: 720, gold14k: 1008, iced: 1170 });
    // …and keeps a 14K or lab price changed on this screen instead of snapping back to the ratio.
    const edited = editLine(editLine(pricing, 'gold14k', 150), 'icedLab', 300);
    const after = editLine(edited, 'gold10k', 120);
    expect(after.karatMultiplier['14k']).toBe(1.5);
    expect(after.stonePerTooth.lab).toBe(200);
    expect(totals(after)).toMatchObject({ gold10k: 720, gold14k: 1080, icedLab: 1920 });
  });

  it('the starting prices follow the same ratios', () => {
    const derived = quickPricing(start, quickAnswers(start));
    expect(totals(derived)).toEqual(totals(start));
  });
});
