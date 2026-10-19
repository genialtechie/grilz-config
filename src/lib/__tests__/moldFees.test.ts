import { describe, expect, it } from 'vitest';
import { priceBreakdown } from '../pricing';
import { DEFAULT_SET, parseRenderSpec, summarizeDesign, type ToothDesign } from '../renderSpec';
import { defaultSet } from '../tenant/catalog';
import { parseTenantConfig } from '../tenant/schema';
import { VVSLAB_CONFIG } from '../tenant/vvslab';

const tooth: ToothDesign = { metal: 'yellow', karat: '10k', type: 'plain', style: 'solid', setting: 'honeycomb', stone: 'moissanite' };
const teeth = [6, 7].map((index) => ({ ...tooth, index }));

describe('fit (mould) fees', () => {
  it('charges the fee for the chosen fit, once per order', () => {
    const pricing = { ...VVSLAB_CONFIG.pricing, minimumOrder: 0, molds: { kit: 30, store: 0 } };
    const kit = priceBreakdown(pricing, teeth, { ...DEFAULT_SET, mold: 'kit' });
    const store = priceBreakdown(pricing, teeth, { ...DEFAULT_SET, mold: 'store' });
    expect(kit.lines.find((line) => line.label === 'Mold kit by mail')?.amount).toBe(30);
    expect(kit.total - store.total).toBe(30);
    // No fees set: totals are as before.
    expect(priceBreakdown(VVSLAB_CONFIG.pricing, teeth, { ...DEFAULT_SET, mold: 'kit' }).total).toBe(priceBreakdown(VVSLAB_CONFIG.pricing, teeth, DEFAULT_SET).total);
    expect(parseTenantConfig({ ...VVSLAB_CONFIG, pricing }).ok).toBe(true);
  });

  it('only accepts fits the shop offers, and tells the shop which one', () => {
    const catalog = { ...VVSLAB_CONFIG.catalog, molds: ['kit', 'store'] as ('kit' | 'store')[] };
    const spec = parseRenderSpec({ ...DEFAULT_SET, teeth, mold: 'store' }, catalog);
    expect(spec?.mold).toBe('store');
    expect(summarizeDesign(spec!)).toContain('Fit: In-store fitting');
    expect(parseRenderSpec({ ...DEFAULT_SET, teeth, mold: 'own' }, catalog)).toBeNull();
    expect(parseRenderSpec({ ...DEFAULT_SET, teeth, mold: 'teleport' }, catalog)).toBeNull();
    expect(parseRenderSpec({ ...DEFAULT_SET, teeth }, catalog)).not.toHaveProperty('mold');
  });

  it("starts on the mail-in kit, or the shop's first fit", () => {
    expect(defaultSet(VVSLAB_CONFIG.catalog).mold).toBe('kit');
    expect(defaultSet({ ...VVSLAB_CONFIG.catalog, molds: ['store'] }).mold).toBe('store');
  });
});
