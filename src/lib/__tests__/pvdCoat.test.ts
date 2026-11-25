import { describe, expect, it } from 'vitest';
import { MARKET_DEFAULTS } from '../metalMarket';
import { priceBreakdown } from '../pricing';
import { buildFillPrompt, DEFAULT_SET, describeSpec, describeTooth, parseRenderSpec, type KaratId, type MetalId, type RenderTooth, type ToothDesign } from '../renderSpec';
import { parseTenantConfig, type TenantPricing } from '../tenant/schema';
import { describeChanges } from '../tenant/diff';
import { VVSLAB_CONFIG } from '../tenant/vvslab';

// PVD colour coat (MAG-214), on Luckey's real table: silver $80, 10K $115,
// 14K $180, 18K $220 a tooth, and a $50 appointment fee. Colour costs
// nothing extra on any metal (Haleem, Nov 25): a coated tooth costs its
// metal price only. All 7 colours the same price — free.

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
  it('a coated tooth adds nothing — no PVD line, total is the metal price only', () => {
    const teeth = setOf(6, 'yellow', '10k', { pvd: 'pink' });
    expect(line(LUCKEY, teeth, 'PVD')).toBeUndefined();
    expect(quote(LUCKEY, teeth).lines.some((item) => item.label.includes('PVD'))).toBe(false);
    expect(quote(LUCKEY, teeth).total).toBe(6 * 115 + 50);
    // The same teeth without the coat cost exactly the same.
    expect(quote(LUCKEY, setOf(6, 'yellow', '10k')).total).toBe(6 * 115 + 50);
  });

  it('the coat does not stack on a set price — the set price stands, no coat line', () => {
    const teeth = setOf(12, 'yellow', '10k', { pvd: 'pink' });
    expect(line(LUCKEY, teeth, 'Set price')).toEqual({ label: 'Set price · 10K · 12 teeth', amount: -130 });
    expect(line(LUCKEY, teeth, 'PVD')).toBeUndefined();
    expect(quote(LUCKEY, teeth).total).toBe(1250 + 50);
  });

  it('colours group separately in the prompt, and two-tone teeth each carry their own coat — free', () => {
    const teeth = [
      ...setOf(2, 'yellow', '10k', { pvd: 'pink' }),
      ...setOf(2, 'yellow', '10k', { pvd: 'royal-blue' }),
    ].map((tooth, i) => ({ ...tooth, index: i }));
    expect(line(LUCKEY, teeth, 'PVD')).toBeUndefined();
    expect(quote(LUCKEY, teeth).total).toBe(4 * 115 + 50);
    // The two colours are different designs, so the prompt names both.
    expect(describeSpec({ ...DEFAULT_SET, teeth })).toContain('pink PVD colour coat');
    expect(describeSpec({ ...DEFAULT_SET, teeth })).toContain('royal blue PVD colour coat');
    // A white-gold tooth pays its colour surcharge and nothing for the coat.
    const mixed = [{ ...tooth('yellow', '10k', { pvd: 'pink' }), index: 5 }, { ...tooth('white', '10k', { pvd: 'pink' }), index: 6 }];
    expect(line(LUCKEY, mixed, 'White gold')).toEqual({ label: 'White gold colour · 1 tooth', amount: 40 });
    expect(quote(LUCKEY, mixed).total).toBe(115 + 115 + 40 + 50);
  });

  it('the coat works with any style on a plain tooth, and adds nothing', () => {
    const opal = tooth('yellow', '10k', { style: 'opals', pvd: 'pink' });
    expect(quote(LUCKEY, [{ ...opal, index: 5 }]).total).toBe(115 + 60 + 50);
    expect(describeTooth(opal)).toBe('Yellow gold 10K · White opals · Pink PVD coat');
    expect(describeSpec({ ...DEFAULT_SET, teeth: [{ ...opal, index: 5 }] })).toContain('pink PVD colour coat');
    const cut = tooth('yellow', '10k', { style: 'diamond-cut', pvd: 'black' });
    expect(quote(LUCKEY, [{ ...cut, index: 5 }]).total).toBe(115 + 20 + 50);
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

  it('a shop that does not offer the coat never sells it, and offering it needs no price', () => {
    // The demo catalog has no pvd flag: a coated design is rejected.
    expect(parseRenderSpec({ ...DEFAULT_SET, teeth: [{ ...tooth('yellow', '10k'), index: 5, pvd: 'pink' }] }, VVSLAB_CONFIG.catalog)).toBeNull();
    expect(parseRenderSpec({ ...DEFAULT_SET, teeth: [{ ...tooth('yellow', '10k'), index: 5, pvd: 'pink' }] }, PVD_CATALOG)?.teeth[0].pvd).toBe('pink');
    // Offering the coat saves with no price — there is no price to require.
    // A stale pvdPerTooth left in a stored config is stripped, not an error:
    // the field was optional and the feature never shipped, so nothing in
    // production has it, but an old draft must not break on load.
    const catalog = { ...VVSLAB_CONFIG.catalog, pvd: true } as never;
    const offered = parseTenantConfig({ ...VVSLAB_CONFIG, pricing: LUCKEY, catalog });
    expect(offered.ok).toBe(true);
    if (offered.ok) expect(offered.config.catalog.pvd).toBe(true);
    const stale = parseTenantConfig({ ...VVSLAB_CONFIG, pricing: { ...LUCKEY, pvdPerTooth: 35 } as never, catalog });
    expect(stale.ok).toBe(true);
    if (stale.ok) expect('pvdPerTooth' in stale.config.pricing).toBe(false);
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

  it('the coat is excluded from the percentage discount base', () => {
    // 12 teeth, no set prices, 10% off from 12: the base is metal $1,380
    // only — the coat adds nothing, so there is nothing of it in the base.
    const pricing: TenantPricing = { ...LUCKEY, setPrices: undefined, volume: [{ minTeeth: 12, percentOff: 10 }] };
    const teeth = setOf(12, 'yellow', '10k', { pvd: 'pink' });
    expect(line(pricing, teeth, 'Set discount')).toEqual({ label: 'Set discount · 12 teeth, 10% off', amount: -138 });
    expect(quote(pricing, teeth).total).toBe(50 + 1380 - 138);
  });

  it('the back-teeth delta excludes the coat', () => {
    // 12 teeth 10K pink, back teeth at 50%: 6 back teeth × $115 × −50% =
    // −$345. The coat contributes nothing to the delta.
    const half: TenantPricing = { ...LUCKEY, setPrices: undefined, positions: { premolar: 50, molar: 50 } };
    const teeth = setOf(12, 'yellow', '10k', { pvd: 'pink' });
    expect(line(half, teeth, 'Back teeth')).toEqual({ label: 'Back teeth · 6 teeth', amount: -345 });
    expect(quote(half, teeth).total).toBe(50 + 1380 - 345);
  });

  it('a market-linked quote charges the quote only — the coat adds nothing', () => {
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
    expect(line(quoted, teeth, 'PVD')).toBeUndefined();
    expect(quote(quoted, teeth).total).toBe(50 + 1680);
    expect(quote(quoted, teeth).market).toBeDefined();
    // The same teeth without the coat cost exactly the same.
    expect(quote(quoted, setOf(12, 'yellow', '10k')).total).toBe(50 + 1680);
  });

  it('turning the coat on shows up in the publish diff, with no price line', () => {
    const before = { ...VVSLAB_CONFIG, pricing: VVSLAB_CONFIG.pricing };
    const after = { ...VVSLAB_CONFIG, pricing: VVSLAB_CONFIG.pricing, catalog: { ...VVSLAB_CONFIG.catalog, pvd: true } };
    const texts = describeChanges(before, after).map((change) => change.text);
    expect(texts).toContain('PVD colour coat turned on');
    expect(texts.some((text) => text.startsWith('PVD colour coat:'))).toBe(false);
    const off = { ...VVSLAB_CONFIG, pricing: VVSLAB_CONFIG.pricing, catalog: { ...VVSLAB_CONFIG.catalog, pvd: false } };
    expect(describeChanges(after, off).map((change) => change.text)).toContain('PVD colour coat turned off');
  });
});
