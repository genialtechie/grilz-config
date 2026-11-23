import { describe, expect, it } from 'vitest';
import { icedOpalPrice, priceBreakdown } from '../pricing';
import { buildPhotoPrompt, DEFAULT_SET, describeTooth, groupTeeth, opalOf, parseRenderSpec, type RenderTooth, type ToothDesign } from '../renderSpec';
import { describeChanges } from '../tenant/diff';
import { parseTenantConfig, type TenantPricing } from '../tenant/schema';
import { VVSLAB_CONFIG } from '../tenant/vvslab';
import { toothCustomization } from '../toothCustomization';

// Iced + opals on one tooth (MAG-169): an opal centre inside a border of stones.

const iced: ToothDesign = { metal: 'yellow', karat: '10k', type: 'iced', style: 'solid', setting: 'honeycomb', stone: 'moissanite' };
const icedOpal: ToothDesign = { ...iced, style: 'opals', opal: 'fire' };
const sixTop = (design: ToothDesign): RenderTooth[] => [5, 6, 7, 8, 9, 10].map((index) => ({ ...design, index }));
// The teeth alone: no service fee, minimum, set discount or back-teeth pricing.
const bare: TenantPricing = { ...VVSLAB_CONFIG.pricing, base: 0, minimumOrder: 0, volume: undefined, positions: undefined };
const lines = (pricing: TenantPricing, teeth: RenderTooth[]) => Object.fromEntries(priceBreakdown(pricing, teeth, DEFAULT_SET).lines.map((line) => [line.label, line.amount]));

describe('iced opal pricing', () => {
  it("defaults to the shop's Opals price and its iced open-face share", () => {
    const pricing: TenantPricing = { ...bare, icedOpenFace: { stoneShare: 60 } };
    expect(icedOpalPrice(pricing)).toEqual({ stoneShare: 60, perTooth: 90 });
    expect(lines(pricing, sixTop(icedOpal))).toEqual({
      'Service fee': 0,
      'Metal · 6 teeth': 900,
      'Style & finish': 540, // 6 × $90 opals
      Stones: 270, // 6 × $75 × 60%
    });
  });

  it('charges the full stones when the shop has no open-face share', () => {
    expect(icedOpalPrice(bare)).toEqual({ stoneShare: 100, perTooth: 90 });
    expect(lines(bare, sixTop(icedOpal)).Stones).toBe(450);
  });

  it("uses the shop's own iced opal prices, for the stones and the setting", () => {
    const pricing: TenantPricing = { ...bare, settingPerTooth: { ...bare.settingPerTooth, mosaic: 20 }, icedOpenFace: { stoneShare: 60 }, icedOpal: { stoneShare: 50, perTooth: 120 } };
    expect(lines(pricing, sixTop({ ...icedOpal, setting: 'mosaic' }))).toEqual({
      'Service fee': 0,
      'Metal · 6 teeth': 900,
      'Style & finish': 720,
      Stones: 225,
      'Mosaic setting': 60,
    });
  });

  it('takes its share of the stones from an all-in iced price', () => {
    const pricing: TenantPricing = { ...bare, icedPerTooth: { moissanite: { '10k': 300 } }, icedOpal: { stoneShare: 50, perTooth: 100 } };
    // $150 of gold + half of the $150 above it, plus the opal.
    expect(lines(pricing, [{ ...icedOpal, index: 7 }])).toEqual({ 'Service fee': 0, 'Iced · 1 tooth': 225, 'Style & finish': 100 });
  });

  it('leaves iced open face, plain opals and fully iced teeth priced as before', () => {
    const pricing: TenantPricing = { ...bare, icedOpenFace: { stoneShare: 60, perTooth: 50 }, icedOpal: { stoneShare: 10, perTooth: 999 } };
    expect(lines(pricing, sixTop({ ...iced, style: 'open-face' }))).toEqual({ 'Service fee': 0, 'Metal · 6 teeth': 900, 'Style & finish': 300, Stones: 270 });
    expect(lines(pricing, sixTop({ ...icedOpal, type: 'plain' }))).toEqual({ 'Service fee': 0, 'Metal · 6 teeth': 900, 'Style & finish': 540 });
    expect(lines(pricing, sixTop(iced))).toEqual({ 'Service fee': 0, 'Metal · 6 teeth': 900, Stones: 450 });
  });

  it('is saved in a shop config and listed when it changes', () => {
    const parsed = parseTenantConfig({ ...VVSLAB_CONFIG, pricing: { ...VVSLAB_CONFIG.pricing, icedOpal: { stoneShare: 50, perTooth: 120 } } });
    if (!parsed.ok) throw new Error(JSON.stringify(parsed.issues));
    const config = parsed.config;
    expect(config.pricing.icedOpal).toEqual({ stoneShare: 50, perTooth: 120 });
    expect(parseTenantConfig({ ...VVSLAB_CONFIG, pricing: { ...VVSLAB_CONFIG.pricing, icedOpal: { stoneShare: 150 } } }).ok).toBe(false);
    expect(describeChanges(VVSLAB_CONFIG, config).map((change) => change.text)).toContain('Iced opal: 100% of stones + $90 → 50% of stones + $120');
  });
});

describe('iced opal design', () => {
  it('keeps its opal colour and draws an opal inside the ring of stones', () => {
    expect(opalOf(icedOpal)).toBe('fire');
    const drawn = toothCustomization(icedOpal, DEFAULT_SET, 7);
    expect(drawn).toMatchObject({ hasDiamonds: true, style: 'opals', opal: 'fire' });
    // Other finishes still don't show on iced teeth.
    expect(toothCustomization({ ...iced, style: 'engraving' }, DEFAULT_SET, 7).style).toBeUndefined();
  });

  it('is its own design in a mixed set', () => {
    const teeth: RenderTooth[] = [{ ...icedOpal, index: 7 }, { ...iced, index: 8 }, { ...icedOpal, type: 'plain', index: 9 }, { ...iced, style: 'engraving', index: 10 }];
    expect(groupTeeth(teeth).map((group) => group.map((tooth) => tooth.index))).toEqual([[8, 10], [7], [9]]);
  });

  it('reads right on the lead and to the photo model', () => {
    expect(describeTooth(icedOpal)).toBe('Yellow gold 10K · Iced with fire opal centre · Honeycomb · Moissanite');
    const prompt = buildPhotoPrompt({ ...DEFAULT_SET, teeth: sixTop(icedOpal) });
    expect(prompt).toContain('opal inlay with a pave stone border');
    expect(prompt).toContain('fire opal');
    expect(prompt).toContain('real stones');
    expect(prompt).toContain('real opal');
    expect(prompt).not.toContain('no openings or cut-outs');
  });

  it('is only accepted from shops that sell both iced and opals', () => {
    const spec = { ...DEFAULT_SET, teeth: sixTop(icedOpal) };
    const parsed = parseRenderSpec(spec, VVSLAB_CONFIG.catalog);
    expect(parsed?.teeth[0]).toMatchObject({ type: 'iced', style: 'opals', opal: 'fire' });
    expect(parseRenderSpec(spec, { ...VVSLAB_CONFIG.catalog, styles: VVSLAB_CONFIG.catalog.styles.filter((style) => style !== 'opals') })).toBeNull();
    expect(parseRenderSpec(spec, { ...VVSLAB_CONFIG.catalog, types: ['plain'] })).toBeNull();
  });
});
