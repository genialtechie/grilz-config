import { describe, expect, it } from 'vitest';
import { priceBreakdown, priceHints } from '../pricing';
import { DEFAULT_SET, parseRenderSpec, summarizeDesign, type AddOn, type ToothDesign } from '../renderSpec';
import { parseTenantConfig } from '../tenant/schema';
import { VVSLAB_CONFIG } from '../tenant/vvslab';

const ADD_ONS: AddOn[] = [
  { id: 'rush', label: 'Rush order', detail: 'Two weeks', price: 100, per: 'order' },
  { id: 'polish', label: 'Extra polish', price: 5, per: 'tooth' },
];
const tooth: ToothDesign = { metal: 'yellow', karat: '10k', type: 'plain', style: 'solid', setting: 'honeycomb', stone: 'moissanite' };
const teeth = [5, 6, 7, 8].map((index) => ({ ...tooth, index }));
const catalog = { ...VVSLAB_CONFIG.catalog, addOns: ADD_ONS };

describe('shop add-ons', () => {
  it('prices picked add-ons per order or per tooth', () => {
    const lines = priceBreakdown(VVSLAB_CONFIG.pricing, teeth, { ...DEFAULT_SET, addOns: ['rush', 'polish'] }, ADD_ONS).lines;
    expect(lines.find((line) => line.label === 'Rush order')?.amount).toBe(100);
    expect(lines.find((line) => line.label === 'Extra polish · 4 teeth')?.amount).toBe(20);
  });

  it('only accepts add-ons the shop offers', () => {
    expect(parseRenderSpec({ ...DEFAULT_SET, teeth, addOns: ['rush'] }, catalog)?.addOns).toEqual(['rush']);
    expect(parseRenderSpec({ ...DEFAULT_SET, teeth, addOns: ['free-gold'] }, catalog)).toBeNull();
    expect(parseRenderSpec({ ...DEFAULT_SET, teeth, addOns: ['rush', 'rush'] }, catalog)).toBeNull();
    expect(parseRenderSpec({ ...DEFAULT_SET, teeth, addOns: ['rush'] }, VVSLAB_CONFIG.catalog)).toBeNull();
    // Designs without add-ons parse exactly as before.
    expect(parseRenderSpec({ ...DEFAULT_SET, teeth }, VVSLAB_CONFIG.catalog)).not.toHaveProperty('addOns');
  });

  it('names picked add-ons in the design summary', () => {
    const spec = parseRenderSpec({ ...DEFAULT_SET, teeth, addOns: ['polish'] }, catalog)!;
    expect(summarizeDesign(spec, ADD_ONS)).toContain('Extra polish');
  });

  it('validates add-ons in the shop config', () => {
    expect(parseTenantConfig({ ...VVSLAB_CONFIG, catalog }).ok).toBe(true);
    expect(parseTenantConfig({ ...VVSLAB_CONFIG, catalog: { ...catalog, addOns: [{ ...ADD_ONS[0], label: '' }] } }).ok).toBe(false);
    expect(parseTenantConfig({ ...VVSLAB_CONFIG, catalog: { ...catalog, addOns: [ADD_ONS[0], ADD_ONS[0]] } }).ok).toBe(false);
  });

  it("shows the shop's own extra prices, and none when prices are hidden", () => {
    expect(priceHints(VVSLAB_CONFIG.pricing).extra(VVSLAB_CONFIG.pricing.extras.fangs)).toBe(`+$${VVSLAB_CONFIG.pricing.extras.fangs}`);
    expect(priceHints(VVSLAB_CONFIG.pricing).extra(5, true)).toBe('+$5 / tooth');
    expect(priceHints({ ...VVSLAB_CONFIG.pricing, display: 'hidden' }).extra(100)).toBeUndefined();
  });
});
