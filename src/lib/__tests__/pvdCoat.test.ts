import { describe, expect, it } from 'vitest';
import { MARKET_DEFAULTS } from '../metalMarket';
import { priceBreakdown } from '../pricing';
import { buildFillPrompt, DEFAULT_SET, describeSpec, describeTooth, parseRenderSpec, type KaratId, type MetalId, type RenderTooth, type ToothDesign } from '../renderSpec';
import { parseTenantConfig, type TenantPricing } from '../tenant/schema';
import { describeChanges } from '../tenant/diff';
import { VVSLAB_CONFIG } from '../tenant/vvslab';

// PVD colour coat (MAG-214), on Luckey's real table: silver $80, 10K $115,
// 14K $180, 18K $220 a tooth, and a $50 appointment fee. The coat is one
// flat $35 a tooth, whatever the colour — the ticket's price.

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
  pvdPerTooth: 35,
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

const quote = (pricing: TenantPricing, teeth: RenderTooth[]) => priceBreakdown(pricing, teeth, DEFAULT_SET);
const line = (pricing: TenantPricing, teeth: RenderTooth[], startsWith: string) =>
  quote(pricing, teeth).lines.find((item) => item.label.startsWith(startsWith));

// The shop offers the coat: the catalog is what the server passes to
// parseRenderSpec, so it carries the pvd flag.
const PVD_CATALOG = { ...VVSLAB_CONFIG.catalog, pvd: true } as never;

describe('PVD colour coat (MAG-214)', () => {
  it('a coated tooth adds $35, on its own line, and the total is exact', () => {
    const teeth = setOf(6, 'yellow', '10k', { pvd: 'pink' });
    expect(line(LUCKEY, teeth, 'Pink PVD')).toEqual({ label: 'Pink PVD coat · 6 teeth', amount: 210 });
    expect(quote(LUCKEY, teeth).total).toBe(6 * 115 + 6 * 35 + 50);
  });

  it('the coat stacks on top of a set price, like the colour surcharge', () => {
    const teeth = setOf(12, 'yellow', '10k', { pvd: 'pink' });
    expect(line(LUCKEY, teeth, 'Set price')).toEqual({ label: 'Set price · 10K · 12 teeth', amount: -130 });
    expect(line(LUCKEY, teeth, 'Pink PVD')).toEqual({ label: 'Pink PVD coat · 12 teeth', amount: 420 });
    expect(quote(LUCKEY, teeth).total).toBe(1250 + 12 * 35 + 50);
  });

  it('colours group separately, and two-tone teeth each carry their own coat', () => {
    const teeth = [
      ...setOf(2, 'yellow', '10k', { pvd: 'pink' }),
      ...setOf(2, 'yellow', '10k', { pvd: 'royal-blue' }),
    ].map((tooth, i) => ({ ...tooth, index: i }));
    expect(line(LUCKEY, teeth, 'Pink PVD')).toEqual({ label: 'Pink PVD coat · 2 teeth', amount: 70 });
    expect(line(LUCKEY, teeth, 'Royal blue PVD')).toEqual({ label: 'Royal blue PVD coat · 2 teeth', amount: 70 });
    expect(quote(LUCKEY, teeth).total).toBe(4 * 115 + 4 * 35 + 50);
    // The two colours are different designs, so the prompt names both.
    expect(describeSpec({ ...DEFAULT_SET, teeth })).toContain('pink PVD colour coat');
    expect(describeSpec({ ...DEFAULT_SET, teeth })).toContain('royal blue PVD colour coat');
    // A white-gold tooth pays its colour surcharge and the coat.
    const mixed = [{ ...tooth('yellow', '10k', { pvd: 'pink' }), index: 5 }, { ...tooth('white', '10k', { pvd: 'pink' }), index: 6 }];
    expect(line(LUCKEY, mixed, 'Pink PVD')).toEqual({ label: 'Pink PVD coat · 2 teeth', amount: 70 });
    expect(quote(LUCKEY, mixed).total).toBe(115 + 115 + 40 + 70 + 50);
  });

  it('the coat works with any style on a plain tooth', () => {
    const opal = tooth('yellow', '10k', { style: 'opals', pvd: 'pink' });
    expect(quote(LUCKEY, [{ ...opal, index: 5 }]).total).toBe(115 + 60 + 35 + 50);
    expect(describeTooth(opal)).toBe('Yellow gold 10K · White opals · Pink PVD coat');
    expect(describeSpec({ ...DEFAULT_SET, teeth: [{ ...opal, index: 5 }] })).toContain('pink PVD colour coat');
    const cut = tooth('yellow', '10k', { style: 'diamond-cut', pvd: 'black' });
    expect(quote(LUCKEY, [{ ...cut, index: 5 }]).total).toBe(115 + 20 + 35 + 50);
    expect(describeTooth(cut)).toBe('Yellow gold 10K · Diamond-cut · Black PVD coat');
  });

  it('the coat never applies to iced or photo teeth — not charged, not described, stripped on parse', () => {
    // Decision: the whole face is covered edge to edge in stones, so there
    // is no metal to coat — the same rule as named extras (MAG-204). A coat
    // would also hide a photo.
    const iced: TenantPricing = { ...LUCKEY, icedPerTooth: { moissanite: { '10k': 300 } } };
    const teeth = setOf(6, 'yellow', '10k', { type: 'iced', style: 'solid', pvd: 'pink' });
    expect(line(iced, teeth, 'Iced')).toEqual({ label: 'Iced · 6 teeth', amount: 1800 });
    expect(line(iced, teeth, 'PVD')).toBeUndefined();
    expect(quote(iced, teeth).total).toBe(6 * 300 + 50);
    expect(describeTooth({ ...tooth('yellow', '10k'), type: 'iced', pvd: 'pink' })).not.toContain('PVD');
    expect(describeSpec({ ...DEFAULT_SET, teeth })).not.toContain('PVD');
    const parsedIced = parseRenderSpec({ ...DEFAULT_SET, teeth: [{ ...tooth('yellow', '10k'), index: 5, type: 'iced', pvd: 'pink' }] }, PVD_CATALOG);
    expect(parsedIced?.teeth[0].pvd).toBeUndefined();
    const parsedPhoto = parseRenderSpec({ ...DEFAULT_SET, teeth: [{ ...tooth('yellow', '10k'), index: 5, type: 'photo', pvd: 'pink' }] }, PVD_CATALOG);
    expect(parsedPhoto?.teeth[0].pvd).toBeUndefined();
    // Plain teeth keep it.
    const parsed = parseRenderSpec({ ...DEFAULT_SET, teeth: [{ ...tooth('yellow', '10k'), index: 5, pvd: 'pink' }] }, PVD_CATALOG);
    expect(parsed?.teeth[0].pvd).toBe('pink');
    expect(parseRenderSpec({ ...DEFAULT_SET, teeth: [{ ...tooth('yellow', '10k'), index: 5, pvd: 'not-a-colour' as never }] }, PVD_CATALOG)).toBeNull();
  });

  it('a shop that does not offer the coat never sells it, and offering it needs a price', () => {
    // The demo catalog has no pvd flag: a coated design is rejected.
    expect(parseRenderSpec({ ...DEFAULT_SET, teeth: [{ ...tooth('yellow', '10k'), index: 5, pvd: 'pink' }] }, VVSLAB_CONFIG.catalog)).toBeNull();
    expect(parseRenderSpec({ ...DEFAULT_SET, teeth: [{ ...tooth('yellow', '10k'), index: 5, pvd: 'pink' }] }, PVD_CATALOG)?.teeth[0].pvd).toBe('pink');
    // Offering the coat with no price blocks saving — $0 is never assumed.
    const catalog = { ...VVSLAB_CONFIG.catalog, pvd: true } as never;
    const unpriced = parseTenantConfig({ ...VVSLAB_CONFIG, pricing: { ...LUCKEY, pvdPerTooth: undefined }, catalog });
    expect(unpriced.ok).toBe(false);
    if (!unpriced.ok) expect(unpriced.issues.some((issue) => /Add a price for the PVD colour coat/.test(issue.message))).toBe(true);
    const priced = parseTenantConfig({ ...VVSLAB_CONFIG, pricing: LUCKEY, catalog });
    expect(priced.ok).toBe(true);
    if (priced.ok) expect(priced.config.pricing.pvdPerTooth).toBe(35);
  });

  it('the render prompt carries the colour, in the main prompt and the section edits', () => {
    const teeth = setOf(2, 'yellow', '10k', { pvd: 'royal-blue' });
    const spec = { ...DEFAULT_SET, teeth };
    expect(describeSpec(spec)).toContain('royal blue PVD colour coat');
    expect(describeTooth(teeth[0])).toBe('Yellow gold 10K · Solid · Royal blue PVD coat');
    expect(buildFillPrompt(spec, { kind: 'tooth', indices: [0] })).toContain('ROYAL BLUE PVD COAT');
    // Uncoated teeth say nothing about it.
    expect(describeSpec({ ...DEFAULT_SET, teeth: setOf(2, 'yellow', '10k') })).not.toContain('PVD');
  });

  it('the coat stays in the percentage discount base, like colour and extras', () => {
    // 12 teeth, no set prices, 10% off from 12: the base is metal $1,380 +
    // coat $420 = $1,800, so the discount is $180.
    const pricing: TenantPricing = { ...LUCKEY, setPrices: undefined, volume: [{ minTeeth: 12, percentOff: 10 }] };
    const teeth = setOf(12, 'yellow', '10k', { pvd: 'pink' });
    expect(line(pricing, teeth, 'Set discount')).toEqual({ label: 'Set discount · 12 teeth, 10% off', amount: -180 });
    expect(quote(pricing, teeth).total).toBe(50 + 1380 + 420 - 180);
  });

  it('the back-teeth delta includes the coat', () => {
    // 12 teeth 10K pink, back teeth at 50%: 6 back teeth × ($115 + $35) ×
    // −50% = −$450.
    const half: TenantPricing = { ...LUCKEY, setPrices: undefined, positions: { premolar: 50, molar: 50 } };
    const teeth = setOf(12, 'yellow', '10k', { pvd: 'pink' });
    expect(line(half, teeth, 'Back teeth')).toEqual({ label: 'Back teeth · 6 teeth', amount: -450 });
    expect(quote(half, teeth).total).toBe(50 + 1380 + 420 - 450);
  });

  it('the coat still applies on a market-linked quote — it is labour, not a metal price', () => {
    // Decision: the colour surcharge returns $0 on a quote because the quote
    // already is that metal's price. A PVD coat is a coating applied to the
    // finished tooth, like a named extra, so it stacks on the quote.
    const quoted: TenantPricing = {
      ...LUCKEY,
      market: {
        ...MARKET_DEFAULTS,
        enabled: true,
        quote: { asOf: '2026-11-25T00:00:00.000Z', gold: 4000, silver: 50, platinum: 1600, perTooth: { 'yellow:10k': 140 } },
      },
    };
    const teeth = setOf(12, 'yellow', '10k', { pvd: 'pink' });
    expect(line(quoted, teeth, 'Metal')).toEqual({ label: 'Metal · 12 teeth', amount: 1680 });
    expect(line(quoted, teeth, 'Pink PVD')).toEqual({ label: 'Pink PVD coat · 12 teeth', amount: 420 });
    expect(quote(quoted, teeth).total).toBe(50 + 1680 + 420);
    expect(quote(quoted, teeth).market).toBeDefined();
  });

  it('turning the coat on shows up in the publish diff', () => {
    const before = { ...VVSLAB_CONFIG, pricing: VVSLAB_CONFIG.pricing };
    const after = { ...VVSLAB_CONFIG, pricing: { ...VVSLAB_CONFIG.pricing, pvdPerTooth: 35 }, catalog: { ...VVSLAB_CONFIG.catalog, pvd: true } };
    const texts = describeChanges(before, after).map((change) => change.text);
    expect(texts).toContain('PVD colour coat turned on');
    expect(texts).toContain('PVD colour coat: $0 → $35 per tooth');
    const off = { ...VVSLAB_CONFIG, pricing: { ...VVSLAB_CONFIG.pricing, pvdPerTooth: 35 }, catalog: { ...VVSLAB_CONFIG.catalog, pvd: false } };
    expect(describeChanges(after, off).map((change) => change.text)).toContain('PVD colour coat turned off');
  });
});
