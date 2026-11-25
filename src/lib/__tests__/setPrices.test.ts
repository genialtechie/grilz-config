import { describe, expect, it } from 'vitest';
import { priceBreakdown, priceHints } from '../pricing';
import { DEFAULT_SET, describeSpec, parseRenderSpec, type KaratId, type MetalId, type RenderTooth, type ToothDesign } from '../renderSpec';
import { parseTenantConfig, type TenantPricing } from '../tenant/schema';
import { describeChanges } from '../tenant/diff';
import { VVSLAB_CONFIG } from '../tenant/vvslab';

// Set prices, a colour surcharge and per-tooth extras (MAG-204), on Luckey's
// real table: silver $80, 10K $115, 14K $180, 18K $220 a tooth, and a $50
// appointment fee. His cuts are deep free, permanent $100 an order.

const LUCKEY: TenantPricing = {
  ...VVSLAB_CONFIG.pricing,
  base: 50,
  baseLabel: 'Appointment fee',
  metalPerTooth: { yellow: 100, white: 100, rose: 100, silver: 80, platinum: 320 },
  karatMultiplier: { '10k': 1.15, '14k': 1.8, '18k': 2.2, '22k': 2.3 },
  stylePerTooth: { solid: 0, 'open-face': 15, 'diamond-cut': 20, 'diamond-dust': 20, engraving: 30, opals: 60 },
  cuts: { deep: { amount: 0, per: 'tooth' }, permanent: { amount: 100, per: 'order' } },
  setPrices: [
    { size: 12, prices: { silver: 400, '10k': 1250, '14k': 1800, '18k': 2640 } },
    { size: 16, prices: { silver: 500, '10k': 1650, '14k': 2400, '18k': 3520 } },
    { size: 20, prices: { silver: 700, '10k': 2050, '14k': 3000, '18k': 4400 } },
    { size: 24, prices: { silver: 900, '10k': 2450, '14k': 3600, '18k': 5280 } },
  ],
  colourSurcharge: { white: 40, rose: 40 },
  extraPerTooth: {
    starburst: 25, pineapple: 25, princess: 20, nugget: 35, 'enamel-fill': 30,
    cross: 150, star: 150, heart: 150, lightning: 175, '3d': 200, 'diamond-shapes': 250, '3d-animal': 250,
    brushed: 0, laser: 0,
  },
  // The rest of the named menu is not extras: engraving, open face and diamond
  // dust are styles (stylePerTooth above), fangs are a set-level add-on.
};

const tooth = (metal: MetalId, karat: KaratId, extra: Partial<ToothDesign> = {}): ToothDesign => ({
  metal, karat, type: 'plain', style: 'solid', setting: 'honeycomb', stone: 'moissanite', ...extra,
});

// Top teeth first, then bottom: 12 = 6/6, 16 = 8/8, 20 = 10/10, 24 = 12/12.
const setOf = (count: number, metal: MetalId, karat: KaratId, extra: Partial<ToothDesign> = {}): RenderTooth[] => {
  const top = Math.min(count, 12);
  const bottom = count - top;
  return [
    ...Array.from({ length: top }, (_, i) => ({ ...tooth(metal, karat, extra), index: i })),
    ...Array.from({ length: bottom }, (_, i) => ({ ...tooth(metal, karat, extra), index: 16 + i })),
  ];
};
const topBottom = (top: number, bottom: number, metal: MetalId, karat: KaratId, extra: Partial<ToothDesign> = {}): RenderTooth[] => [
  ...Array.from({ length: top }, (_, i) => ({ ...tooth(metal, karat, extra), index: 5 + i })),
  ...Array.from({ length: bottom }, (_, i) => ({ ...tooth(metal, karat, extra), index: 21 + i })),
];

const quote = (pricing: TenantPricing, teeth: RenderTooth[]) => priceBreakdown(pricing, teeth, DEFAULT_SET);
const line = (pricing: TenantPricing, teeth: RenderTooth[], startsWith: string) =>
  quote(pricing, teeth).lines.find((item) => item.label.startsWith(startsWith));

// Luckey's table, every cell: the set price plus the $50 appointment fee.
const TABLE: { metal: MetalId; karat: KaratId; label: string; sets: [number, number][] }[] = [
  { metal: 'silver', karat: '10k', label: 'Silver', sets: [[12, 450], [16, 550], [20, 750], [24, 950]] },
  { metal: 'yellow', karat: '10k', label: '10K', sets: [[12, 1300], [16, 1700], [20, 2100], [24, 2500]] },
  { metal: 'yellow', karat: '14k', label: '14K', sets: [[12, 1850], [16, 2450], [20, 3050], [24, 3650]] },
  { metal: 'yellow', karat: '18k', label: '18K', sets: [[12, 2690], [16, 3570], [20, 4450], [24, 5330]] },
];

describe('set prices (MAG-204)', () => {
  for (const row of TABLE) {
    for (const [size, total] of row.sets) {
      it(`${row.label} ${size / 2}/${size / 2} is $${total.toLocaleString()}`, () => {
        expect(quote(LUCKEY, setOf(size, row.metal, row.karat)).total).toBe(total);
      });
    }
  }

  it('a 10K 6/6 shows the set price as the saving off the per-tooth total', () => {
    const breakdown = quote(LUCKEY, setOf(12, 'yellow', '10k'));
    expect(line(LUCKEY, setOf(12, 'yellow', '10k'), 'Metal')).toEqual({ label: 'Metal · 12 teeth', amount: 1380 });
    expect(line(LUCKEY, setOf(12, 'yellow', '10k'), 'Set price')).toEqual({ label: 'Set price · 10K · 12 teeth', amount: -130 });
    expect(breakdown.total).toBe(1300);
  });

  it('a 4-tooth piece uses per-tooth prices', () => {
    expect(quote(LUCKEY, setOf(4, 'silver', '10k')).total).toBe(4 * 80 + 50);
    expect(quote(LUCKEY, setOf(4, 'yellow', '10k')).total).toBe(4 * 115 + 50);
    expect(quote(LUCKEY, setOf(4, 'yellow', '14k')).total).toBe(4 * 180 + 50);
    expect(quote(LUCKEY, setOf(4, 'yellow', '18k')).total).toBe(4 * 220 + 50);
    expect(line(LUCKEY, setOf(4, 'yellow', '10k'), 'Set price')).toBeUndefined();
  });

  it('a set between sizes uses the biggest size it reaches, per tooth', () => {
    // 14 teeth at the 12-tooth set rate: 14 x $1,250 / 12, rounded.
    const breakdown = quote(LUCKEY, setOf(14, 'yellow', '10k'));
    expect(line(LUCKEY, setOf(14, 'yellow', '10k'), 'Metal')).toEqual({ label: 'Metal · 14 teeth', amount: 1610 });
    expect(line(LUCKEY, setOf(14, 'yellow', '10k'), 'Set price')).toEqual({ label: 'Set price · 10K · 14 teeth', amount: -152 });
    expect(breakdown.total).toBe(50 + 1610 - 152);
  });

  it('a mixed set discounts only the metal that reaches a set size', () => {
    // 12 silver at the set price, 6 10K at per tooth.
    const mixed = [...topBottom(6, 6, 'silver', '10k'), ...topBottom(3, 3, 'yellow', '10k')];
    expect(quote(LUCKEY, mixed).total).toBe(50 + 400 + 6 * 115);
    // Neither metal reaches a set size: everything per tooth.
    const small = [...topBottom(3, 3, 'silver', '10k'), ...topBottom(3, 3, 'yellow', '10k')];
    expect(quote(LUCKEY, small).total).toBe(50 + 6 * 80 + 6 * 115);
    expect(line(LUCKEY, small, 'Set price')).toBeUndefined();
  });

  it('a set price wins over the percentage discount for its metal only', () => {
    const pricing: TenantPricing = {
      ...LUCKEY,
      base: 0,
      volume: [{ minTeeth: 12, percentOff: 10 }],
      setPrices: [{ size: 12, prices: { silver: 400 } }],
    };
    // Silver has a set price: no percentage off it.
    expect(quote(pricing, setOf(12, 'silver', '10k')).total).toBe(400);
    expect(line(pricing, setOf(12, 'silver', '10k'), 'Set discount')).toBeUndefined();
    // 10K has none: 10% off the per-tooth total.
    expect(quote(pricing, setOf(12, 'yellow', '10k')).total).toBe(1380 - 138);
    expect(line(pricing, setOf(12, 'yellow', '10k'), 'Set discount')).toEqual({ label: 'Set discount · 12 teeth, 10% off', amount: -138 });
  });

  it('a shop with no set prices quotes exactly as before', () => {
    const breakdown = quote(VVSLAB_CONFIG.pricing, setOf(12, 'yellow', '10k'));
    expect(breakdown.lines.some((item) => item.label.startsWith('Set price'))).toBe(false);
    expect(breakdown.total).toBe(quote(VVSLAB_CONFIG.pricing, setOf(12, 'yellow', '10k')).total);
  });

  it('the server, from the stored config and the posted design, gets the builder’s total', () => {
    const parsed = parseTenantConfig({ ...VVSLAB_CONFIG, pricing: LUCKEY, catalog: { ...VVSLAB_CONFIG.catalog, extras: Object.keys(LUCKEY.extraPerTooth ?? {}) as never } });
    expect(parsed.ok).toBe(true);
    if (!parsed.ok) return;
    const teeth = setOf(12, 'yellow', '10k');
    expect(priceBreakdown(parsed.config.pricing, teeth, DEFAULT_SET).total).toBe(quote(LUCKEY, teeth).total);
    expect(priceBreakdown(parsed.config.pricing, teeth, DEFAULT_SET).total).toBe(1300);
  });
});

describe('colour surcharge (MAG-204)', () => {
  it('white gold adds $40 a tooth on top of the metal price', () => {
    const noSets: TenantPricing = { ...LUCKEY, setPrices: undefined };
    expect(quote(noSets, setOf(6, 'white', '10k')).total).toBe(6 * 115 + 6 * 40 + 50);
    expect(line(noSets, setOf(6, 'white', '10k'), 'White gold')).toEqual({ label: 'White gold colour · 6 teeth', amount: 240 });
    expect(quote(noSets, setOf(2, 'rose', '18k')).total).toBe(2 * 220 + 2 * 40 + 50);
  });

  it('the surcharge still applies on top of a set price', () => {
    expect(quote(LUCKEY, setOf(12, 'white', '10k')).total).toBe(1250 + 12 * 40 + 50);
    expect(line(LUCKEY, setOf(12, 'white', '10k'), 'White gold')).toEqual({ label: 'White gold colour · 12 teeth', amount: 480 });
  });

  it('the metal hint shows the surcharge in the per-tooth price', () => {
    expect(priceHints(LUCKEY).metal('white', '10k')).toBe('$155 / tooth');
    expect(priceHints(LUCKEY).metal('yellow', '10k')).toBe('$115 / tooth');
    expect(priceHints({ ...LUCKEY, setPrices: undefined }).metal('rose', '18k')).toBe('$260 / tooth');
  });
});

describe('per-tooth extras (MAG-204)', () => {
  it('a finish adds its price per tooth, on the teeth that have it', () => {
    const teeth = setOf(2, 'yellow', '10k', { extras: ['starburst'] });
    expect(line(LUCKEY, teeth, 'Starburst')).toEqual({ label: 'Starburst · 2 teeth', amount: 50 });
    expect(quote(LUCKEY, teeth).total).toBe(2 * 115 + 50 + 50);
    const mixed = [...setOf(2, 'yellow', '10k', { extras: ['starburst'] }), ...setOf(4, 'yellow', '10k')];
    expect(quote(LUCKEY, mixed).total).toBe(6 * 115 + 50 + 50);
  });

  it('the named extras menu prices the same way, one menu not two', () => {
    expect(quote(LUCKEY, setOf(1, 'yellow', '10k', { extras: ['cross'] })).total).toBe(115 + 150 + 50);
    expect(quote(LUCKEY, setOf(1, 'yellow', '10k', { extras: ['enamel-fill'] })).total).toBe(115 + 30 + 50);
    expect(quote(LUCKEY, setOf(1, 'yellow', '10k', { extras: ['3d-animal'] })).total).toBe(115 + 250 + 50);
    expect(quote(LUCKEY, setOf(1, 'yellow', '10k', { extras: ['lightning', 'star'] })).total).toBe(115 + 175 + 150 + 50);
    // The menu items that are already styles price through the style, not an extra.
    expect(quote(LUCKEY, setOf(1, 'yellow', '10k', { style: 'engraving' })).total).toBe(115 + 30 + 50);
    expect(quote(LUCKEY, setOf(1, 'yellow', '10k', { style: 'open-face' })).total).toBe(115 + 15 + 50);
  });

  it('a $0 extra adds no line', () => {
    const teeth = setOf(2, 'yellow', '10k', { extras: ['brushed'] });
    expect(quote(LUCKEY, teeth).total).toBe(2 * 115 + 50);
    expect(line(LUCKEY, teeth, 'Brushed')).toBeUndefined();
  });

  it('a design only validates extras the shop sells', () => {
    const catalog = { ...VVSLAB_CONFIG.catalog, extras: ['starburst', 'star', 'cross'] as never };
    const withExtras = (extras: string[]) => ({ ...DEFAULT_SET, teeth: [{ ...tooth('yellow', '10k'), index: 5, extras }] });
    const parsed = parseRenderSpec(withExtras(['star', 'cross']), catalog);
    expect(parsed?.teeth[0].extras).toEqual(['cross', 'star']);
    expect(describeSpec(parsed!)).toContain('a small star');
    expect(parseRenderSpec(withExtras(['free-gold']), catalog)).toBeNull();
    expect(parseRenderSpec(withExtras(['star']), VVSLAB_CONFIG.catalog)).toBeNull();
  });

  it('the config needs a price for every extra it sells, and prunes prices it stopped selling', () => {
    const catalog = { ...VVSLAB_CONFIG.catalog, extras: ['starburst', 'star'] as never };
    const missing = parseTenantConfig({ ...VVSLAB_CONFIG, pricing: { ...LUCKEY, extraPerTooth: { starburst: 25 } }, catalog });
    expect(missing.ok).toBe(false);
    if (!missing.ok) expect(missing.issues.some((issue) => /Add a price for star/.test(issue.message))).toBe(true);
    const parsed = parseTenantConfig({ ...VVSLAB_CONFIG, pricing: LUCKEY, catalog });
    expect(parsed.ok).toBe(true);
    if (parsed.ok) expect(parsed.config.pricing.extraPerTooth).toEqual({ starburst: 25, star: 150 });
  });

  it('the config rejects duplicate set sizes and sizes outside 2–32 teeth', () => {
    const duplicate: TenantPricing = { ...LUCKEY, setPrices: [{ size: 12, prices: { silver: 400 } }, { size: 12, prices: { silver: 500 } }] };
    const bad = parseTenantConfig({ ...VVSLAB_CONFIG, pricing: duplicate });
    expect(bad.ok).toBe(false);
    if (!bad.ok) expect(bad.issues.map((issue) => issue.message)).toContain('Each set size can have one price.');
    expect(parseTenantConfig({ ...VVSLAB_CONFIG, pricing: { ...LUCKEY, setPrices: [{ size: 1, prices: { silver: 100 } }] } }).ok).toBe(false);
    expect(parseTenantConfig({ ...VVSLAB_CONFIG, pricing: { ...LUCKEY, setPrices: [{ size: 33, prices: { silver: 100 } }] } }).ok).toBe(false);
    // An empty tier is allowed: it prices nothing and changes nothing.
    const empty = parseTenantConfig({ ...VVSLAB_CONFIG, pricing: { ...LUCKEY, setPrices: [{ size: 12, prices: {} }] } });
    expect(empty.ok).toBe(true);
    if (empty.ok) {
      expect(empty.config.pricing.setPrices).toEqual([{ size: 12, prices: {} }]);
      expect(quote(empty.config.pricing, setOf(12, 'yellow', '10k')).total).toBe(quote({ ...LUCKEY, setPrices: undefined }, setOf(12, 'yellow', '10k')).total);
    }
  });

  it('a set-price change shows up in the config diff', () => {
    const before = { ...VVSLAB_CONFIG, pricing: VVSLAB_CONFIG.pricing };
    const after = { ...VVSLAB_CONFIG, pricing: LUCKEY };
    expect(describeChanges(before, after).map((change) => change.text).some((text) => text.startsWith('Set prices'))).toBe(true);
  });
});
