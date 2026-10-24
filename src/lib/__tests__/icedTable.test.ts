import { describe, expect, it } from 'vitest';
import { icedAllIn, metalPerTooth, nearestOffered, offered, priceBreakdown, priceHints } from '../pricing';
import { checkLines, quickPricing } from '../quickPricing';
import { DEFAULT_SET, parseRenderSpec, type RenderTooth, type ToothDesign } from '../renderSpec';
import { describeChanges } from '../tenant/diff';
import { parseTenantConfig, type TenantPricing } from '../tenant/schema';
import { VVSLAB_CONFIG } from '../tenant/vvslab';

// Iced teeth priced all-in by stone and metal or karat (MAG-97).

const iced: ToothDesign = { metal: 'yellow', karat: '10k', type: 'iced', style: 'solid', setting: 'honeycomb', stone: 'moissanite' };
const sixTop = (design: Partial<ToothDesign>): RenderTooth[] => [5, 6, 7, 8, 9, 10].map((index) => ({ ...iced, ...design, index }));
// The teeth alone: no service fee, minimum, set discount or back-teeth pricing.
const legacy: TenantPricing = { ...VVSLAB_CONFIG.pricing, base: 0, minimumOrder: 0, volume: undefined, positions: undefined };
// Atlanta Custom Gold Grillz, all-in per tooth.
const ceddy: TenantPricing = {
  ...legacy,
  icedPerTooth: {
    moissanite: { silver: 200, '10k': 300, '14k': 400, '18k': 500 },
    natural: { '10k': 400, '14k': 500, '18k': 600 },
  },
};
const total = (pricing: TenantPricing, teeth: RenderTooth[]) => priceBreakdown(pricing, teeth, DEFAULT_SET).total;
const stones = ['moissanite', 'lab', 'natural'] as const;
const karats = ['10k', '14k', '18k', '22k'] as const;

describe('iced all-in prices', () => {
  it('6 top 14K moissanite = $2,400', () => {
    expect(total(ceddy, sixTop({ karat: '14k' }))).toBe(2400);
    expect(priceBreakdown(ceddy, sixTop({ karat: '14k' }), DEFAULT_SET).lines).toEqual([
      { label: 'Service fee', amount: 0 },
      { label: 'Iced · 6 teeth', amount: 2400 },
    ]);
  });

  it('6 top 18K natural = $3,600', () => {
    expect(total(ceddy, sixTop({ karat: '18k', stone: 'natural' }))).toBe(3600);
  });

  it('6 top silver moissanite = $1,200', () => {
    expect(total(ceddy, sixTop({ metal: 'silver' }))).toBe(1200);
  });

  it('is the same price in yellow, white and rose gold', () => {
    expect(total(ceddy, sixTop({ metal: 'white', karat: '14k' }))).toBe(2400);
    expect(total(ceddy, sixTop({ metal: 'rose', karat: '14k' }))).toBe(2400);
  });

  it('keeps the setting price and the open-face share on top', () => {
    expect(total(ceddy, sixTop({ karat: '14k', setting: 'mosaic' }))).toBe(2400 + 6 * (legacy.settingPerTooth.mosaic ?? 0));
    // Open face at 60% of the stones: the stone part is the all-in price above the plain metal.
    const openFace = { ...ceddy, icedOpenFace: { stoneShare: 60, perTooth: 50 } };
    const plain = metalPerTooth(openFace, 'yellow', '14k');
    const perTooth = plain + (400 - plain) * 0.6 + 50;
    expect(total(openFace, sixTop({ karat: '14k', style: 'open-face' }))).toBe(Math.round(perTooth * 6));
  });

  it('prices plain teeth in the same set as metal, as before', () => {
    const teeth = [...sixTop({ karat: '14k' }), { ...iced, type: 'plain' as const, index: 21 }];
    const lines = priceBreakdown(ceddy, teeth, DEFAULT_SET).lines;
    expect(lines).toContainEqual({ label: 'Metal · 1 teeth', amount: metalPerTooth(ceddy, 'yellow', '10k') });
    expect(lines).toContainEqual({ label: 'Iced · 6 teeth', amount: 2400 });
  });

  it('hides combinations the shop does not offer', () => {
    expect(offered(ceddy, { ...iced, metal: 'silver', stone: 'natural' })).toBe(false);
    expect(offered(ceddy, { ...iced, karat: '22k' })).toBe(false);
    expect(offered(ceddy, { ...iced, stone: 'lab' })).toBe(false);
    expect(offered(ceddy, { ...iced, metal: 'platinum' })).toBe(false);
    // Plain teeth are always offered.
    expect(offered(ceddy, { ...iced, type: 'plain', karat: '22k' })).toBe(true);
    // A change onto a missing cell moves the stone first, then the karat; a metal with no iced at all can't be iced.
    expect(nearestOffered(ceddy, { ...iced, metal: 'silver', stone: 'natural' }, stones, karats)).toMatchObject({ metal: 'silver', stone: 'moissanite' });
    expect(nearestOffered(ceddy, { ...iced, karat: '22k', stone: 'natural' }, stones, karats)).toMatchObject({ karat: '10k', stone: 'natural' });
    expect(nearestOffered(ceddy, { ...iced, metal: 'platinum' }, stones, karats)).toBeNull();
    // The cards: no hint for a combination that isn't offered, the all-in price for one that is.
    const hints = priceHints(ceddy);
    expect(hints.stone('natural', 'yellow', '14k')).toBe('$500 / tooth');
    expect(hints.stone('natural', 'silver', '10k')).toBeUndefined();
    expect(hints.metal('yellow', '18k', 'moissanite')).toBe('$500 / tooth');
    expect(hints.metal('yellow', '22k', 'moissanite')).toBeUndefined();
    expect(hints.metal('yellow', '22k')).toBe(`$${metalPerTooth(ceddy, 'yellow', '22k')} / tooth`);
  });

  it('shops without the table quote as before', () => {
    expect(icedAllIn(legacy, iced)).toBeUndefined();
    expect(offered(legacy, { ...iced, metal: 'platinum', stone: 'natural' })).toBe(true);
    const metal = metalPerTooth(legacy, 'yellow', '14k');
    const stone = legacy.stonePerTooth.moissanite ?? 0;
    expect(priceBreakdown(legacy, sixTop({ karat: '14k' }), DEFAULT_SET).lines).toEqual([
      { label: 'Service fee', amount: 0 },
      { label: 'Metal · 6 teeth', amount: metal * 6 },
      { label: 'Stones', amount: stone * 6 },
    ]);
    expect(priceHints(legacy).stone('moissanite', 'yellow', '14k')).toBe(`+$${stone} / tooth`);
  });

  it('the server, from the stored config and the posted design, gets the builder’s total', () => {
    const config = { ...VVSLAB_CONFIG, pricing: ceddy };
    const teeth = sixTop({ karat: '18k', stone: 'natural' });
    const builder = priceBreakdown(config.pricing, teeth, DEFAULT_SET, config.catalog.addOns);
    const stored = parseTenantConfig(JSON.parse(JSON.stringify(config)));
    expect(stored.ok).toBe(true);
    if (!stored.ok) return;
    const spec = parseRenderSpec(JSON.parse(JSON.stringify({ ...DEFAULT_SET, teeth })), stored.config.catalog)!;
    expect(spec.teeth.every((tooth) => offered(stored.config.pricing, tooth))).toBe(true);
    expect(priceBreakdown(stored.config.pricing, spec.teeth, spec, stored.config.catalog.addOns)).toEqual(builder);
    // A combination outside the table is turned away, not quoted at metal plus stones.
    const outside = parseRenderSpec({ ...DEFAULT_SET, teeth: sixTop({ metal: 'silver', stone: 'natural' }) }, stored.config.catalog)!;
    expect(outside.teeth.every((tooth) => offered(stored.config.pricing, tooth))).toBe(false);
  });

  it('only takes stones and metal or karat columns it knows', () => {
    const parse = (icedPerTooth: unknown) => parseTenantConfig({ ...VVSLAB_CONFIG, pricing: { ...VVSLAB_CONFIG.pricing, icedPerTooth } }).ok;
    expect(parse(ceddy.icedPerTooth)).toBe(true);
    expect(parse({ moissanite: { gold: 300 } })).toBe(false);
    expect(parse({ ruby: { '10k': 300 } })).toBe(false);
    expect(parse({ moissanite: { '10k': -1 } })).toBe(false);
  });

  it('lists table changes in the change log', () => {
    const on = describeChanges({ ...VVSLAB_CONFIG, pricing: legacy }, { ...VVSLAB_CONFIG, pricing: ceddy }).map((change) => change.text);
    expect(on).toContain('Iced teeth priced all-in by metal and karat');
    const edited = { ...ceddy, icedPerTooth: { ...ceddy.icedPerTooth, moissanite: { silver: 200, '10k': 300, '14k': 450 } } };
    const changes = describeChanges({ ...VVSLAB_CONFIG, pricing: ceddy }, { ...VVSLAB_CONFIG, pricing: edited }).map((change) => change.text);
    expect(changes).toContain('Iced moissanite, 14K: $400 → $450');
    expect(changes).toContain('Iced moissanite, 18K: $500 → not offered');
  });

  it('quick pricing leaves the table alone', () => {
    const answers = { gold: 150, iced: 225, fee: { kind: 'service' as const, amount: 0 } };
    expect(quickPricing(ceddy, answers).icedPerTooth).toEqual(ceddy.icedPerTooth);
    expect(checkLines(ceddy)).toEqual(checkLines(legacy));
  });
});
