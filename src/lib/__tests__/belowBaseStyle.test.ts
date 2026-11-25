import { describe, expect, it } from 'vitest';
import { MARKET_DEFAULTS } from '../metalMarket';
import { priceBreakdown, priceHints } from '../pricing';
import { DEFAULT_SET, describeSpec, parseRenderSpec, type KaratId, type MetalId, type RenderTooth, type ToothDesign } from '../renderSpec';
import { parseTenantConfig, type TenantPricing } from '../tenant/schema';
import { describeChanges } from '../tenant/diff';
import { VVSLAB_CONFIG } from '../tenant/vvslab';

// A below-base style (MAG-219), on Luckey's real table: silver $80, 10K
// $115, 14K $180, 18K $220 a tooth, and a $50 appointment fee. His cuts are
// deep free, permanent $100 an order. Trax lists Windows at -$60 a tooth in
// its per-tooth price book; vvslab's Windows is open-face (its render text
// already says "open-face windows"), so the demo price here is open-face
// at -$60 against a Solid base of $0.

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

// The same table with open-face priced below the Solid base.
const BELOW: TenantPricing = { ...LUCKEY, stylePerTooth: { ...LUCKEY.stylePerTooth, 'open-face': -60 } };

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

describe('a below-base style (MAG-219)', () => {
  it('shows openly as -$60 / tooth on the style card, not "+$-60"', () => {
    expect(priceHints(BELOW).style('open-face')).toBe('-$60 / tooth');
    expect(priceHints(BELOW).style('solid')).toBe('Included');
    expect(priceHints(BELOW).style('diamond-cut')).toBe('+$20 / tooth');
  });

  it('makes a set cheaper than the same set in the base style, with the saving shown', () => {
    const teeth = setOf(6, 'yellow', '10k', { style: 'open-face' });
    // 6 × $115 metal − 6 × $60 finish + $50 fee.
    expect(line(BELOW, teeth, 'Style & finish')).toEqual({ label: 'Style & finish', amount: -360 });
    expect(quote(BELOW, teeth).total).toBe(380);
    expect(quote(LUCKEY, setOf(6, 'yellow', '10k')).total).toBe(740);
  });

  it('stacks on a set price — the saving comes off the set-priced total too', () => {
    const teeth = setOf(12, 'yellow', '10k', { style: 'open-face' });
    // Set price $1,250 + 12 × -$60 finish + $50 fee; the Set price line
    // still shows the -$130 saving off the per-tooth metal total.
    expect(line(BELOW, teeth, 'Metal')).toEqual({ label: 'Metal · 12 teeth', amount: 1380 });
    expect(line(BELOW, teeth, 'Set price')).toEqual({ label: 'Set price · 10K · 12 teeth', amount: -130 });
    expect(line(BELOW, teeth, 'Style & finish')).toEqual({ label: 'Style & finish', amount: -720 });
    expect(quote(BELOW, teeth).total).toBe(580);
    expect(quote(LUCKEY, setOf(12, 'yellow', '10k')).total).toBe(1300);
  });

  it('still reduces a market-quoted total — a style finish is labour, not a metal price', () => {
    // A market quote of $140 a tooth for 10K gold, forged the same way the
    // metal-market tests forge one (the server rebuilds the real quote).
    const quoted: TenantPricing = {
      ...BELOW,
      market: {
        ...MARKET_DEFAULTS,
        enabled: true,
        quote: { asOf: '2026-11-25T00:00:00.000Z', gold: 4000, silver: 50, platinum: 1600, perTooth: { 'yellow:10k': 140 } },
      },
    };
    const teeth = setOf(6, 'yellow', '10k', { style: 'open-face' });
    expect(line(quoted, teeth, 'Set price')).toBeUndefined();
    expect(quote(quoted, teeth).total).toBe(50 + 840 - 360);
    expect(quote(quoted, teeth).market).toEqual({ asOf: '2026-11-25T00:00:00.000Z', gold: 4000, silver: 50, platinum: 1600 });
    // The same quoted set in Solid costs the full $890 — the -$360 is the
    // finish, not a phantom metal saving (contrast the colour surcharge,
    // which returns $0 on a quote because it IS a metal price).
    expect(quote(quoted, setOf(6, 'yellow', '10k')).total).toBe(890);
  });

  it('shrinks the % volume-discount base — the discount is a % of what is actually charged', () => {
    // No set prices here, so the 10% tier applies to the whole per-tooth
    // total: ($1,380 metal − $720 finish) × 10% = $66 off.
    const priced: TenantPricing = { ...BELOW, setPrices: undefined, volume: [{ minTeeth: 12, percentOff: 10 }] };
    const teeth = setOf(12, 'yellow', '10k', { style: 'open-face' });
    expect(line(priced, teeth, 'Set discount')).toEqual({ label: 'Set discount · 12 teeth, 10% off', amount: -66 });
    expect(quote(priced, teeth).total).toBe(1380 - 720 - 66 + 50);
    expect(quote({ ...priced, stylePerTooth: { ...priced.stylePerTooth, 'open-face': 0 } }, teeth).total).toBe(1380 - 138 + 50);
  });

  it('counts in the back-teeth delta — a cheaper back tooth saves less on the back-teeth share', () => {
    // 3 front teeth + 2 molars at 50%: each back tooth is (metal $115 +
    // finish -$60) × (0.5 − 1) = -$27.50, so -$55 over the two.
    const priced: TenantPricing = { ...BELOW, positions: { premolar: 50, molar: 50 } };
    const teeth = [5, 6, 7, 0, 1].map((index) => ({ ...tooth('yellow', '10k', { style: 'open-face' }), index }));
    expect(line(priced, teeth, 'Back teeth')).toEqual({ label: 'Back teeth · 2 teeth', amount: -55 });
    expect(quote(priced, teeth).total).toBe(50 + 575 - 300 - 55);
    // The same set in Solid: back teeth save the full $57.50 each.
    expect(quote(priced, teeth.map((item) => ({ ...item, style: 'solid' as const }))).total).toBe(50 + 575 - 115);
  });

  it('applies to iced open-face teeth too — their labour falls back to the style price', () => {
    // 6 iced open-face 10K teeth, moissanite $75 a tooth, honeycomb $0:
    // metal $690 + stones $450 + finish 6 × -$60 + fee $50.
    const teeth = setOf(6, 'yellow', '10k', { type: 'iced', style: 'open-face' });
    expect(line(BELOW, teeth, 'Style & finish')).toEqual({ label: 'Style & finish', amount: -360 });
    expect(quote(BELOW, teeth).total).toBe(830);
    // At Luckey's +$15 open-face price the same set is $1,280.
    expect(quote(LUCKEY, teeth).total).toBe(1280);
  });

  it('does not leak onto full-face iced teeth — they take no finish at all', () => {
    // Even with diamond-cut priced at -$60, an iced tooth's finish is $0:
    // stones cover the whole face, so there is no finish to discount.
    const priced: TenantPricing = { ...BELOW, stylePerTooth: { ...BELOW.stylePerTooth, 'diamond-cut': -60 } };
    const teeth = setOf(6, 'yellow', '10k', { type: 'iced', style: 'diamond-cut' });
    expect(line(priced, teeth, 'Style & finish')).toBeUndefined();
    expect(quote(priced, teeth).total).toBe(6 * 115 + 6 * 75 + 50);
  });

  it('composes per tooth — a mixed set saves only on the below-base teeth', () => {
    const teeth = [
      ...[5, 6].map((index) => ({ ...tooth('yellow', '10k'), index })),
      ...[7, 8, 9, 10].map((index) => ({ ...tooth('yellow', '10k', { style: 'open-face' }), index })),
    ];
    expect(line(BELOW, teeth, 'Style & finish')).toEqual({ label: 'Style & finish', amount: -240 });
    expect(quote(BELOW, teeth).total).toBe(6 * 115 - 240 + 50);
  });

  it('is still named in the render prompt — a cheap style is not dropped from the design', () => {
    const spec = parseRenderSpec({
      teeth: setOf(6, 'yellow', '10k', { style: 'open-face' }),
      cut: 'deep', fangs: false, vision: '', inscriptions: [],
    });
    expect(spec).not.toBeNull();
    expect(describeSpec(spec!)).toContain('open-face windows');
  });
});

describe('a below-base style in the config (MAG-219)', () => {
  const belowConfig = {
    ...VVSLAB_CONFIG,
    pricing: { ...VVSLAB_CONFIG.pricing, stylePerTooth: { ...VVSLAB_CONFIG.pricing.stylePerTooth, 'open-face': -60 } },
  };

  it('saves: the schema allows a negative style price', () => {
    expect(parseTenantConfig(belowConfig).ok).toBe(true);
  });

  it('still rejects negative prices everywhere else — only styles can go below base', () => {
    expect(parseTenantConfig({ ...belowConfig, pricing: { ...belowConfig.pricing, metalPerTooth: { ...belowConfig.pricing.metalPerTooth, yellow: -10 } } }).ok).toBe(false);
    expect(parseTenantConfig({ ...belowConfig, pricing: { ...belowConfig.pricing, base: -50 } }).ok).toBe(false);
    expect(parseTenantConfig({ ...belowConfig, pricing: { ...belowConfig.pricing, stonePerTooth: { ...belowConfig.pricing.stonePerTooth, moissanite: -75 } } }).ok).toBe(false);
  });

  it('still requires a price for every style the shop sells', () => {
    const { 'open-face': _dropped, ...rest } = belowConfig.pricing.stylePerTooth;
    expect(parseTenantConfig({ ...belowConfig, pricing: { ...belowConfig.pricing, stylePerTooth: rest } }).ok).toBe(false);
  });

  it('reads honestly in the publish diff', () => {
    const changes = describeChanges(VVSLAB_CONFIG, belowConfig);
    expect(changes.map((change) => change.text)).toContain('Open-face: $40 → -$60 per tooth');
    expect(changes.map((change) => change.text)).toContain('Iced open face: 100% of stones + $40 → 100% of stones + -$60');
  });
});
