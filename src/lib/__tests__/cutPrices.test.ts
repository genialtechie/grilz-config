import { describe, expect, it } from 'vitest';
import { cutPrice, priceBreakdown, priceHints } from '../pricing';
import { checkLines, quickPricing } from '../quickPricing';
import { DEFAULT_SET, parseRenderSpec, type CutId, type RenderTooth, type ToothDesign } from '../renderSpec';
import { describeChanges } from '../tenant/diff';
import { parseTenantConfig, type TenantPricing } from '../tenant/schema';
import { VVSLAB_CONFIG } from '../tenant/vvslab';

// What a fit costs, per order, per arch or per tooth (MAG-96).

const tooth: ToothDesign = { metal: 'yellow', karat: '10k', type: 'plain', style: 'solid', setting: 'honeycomb', stone: 'moissanite' };
const at = (...indices: number[]): RenderTooth[] => indices.map((index) => ({ ...tooth, index }));
const SIX_TOP = at(5, 6, 7, 8, 9, 10);
const SIX_BOTTOM = at(21, 22, 23, 24, 25, 26);
const legacy: TenantPricing = { ...VVSLAB_CONFIG.pricing, minimumOrder: 0 };
// Atlanta Custom Gold Grillz: deep cut $5 a tooth, permanent look $100 an arch.
const ceddy: TenantPricing = { ...legacy, cuts: { deep: { amount: 5, per: 'tooth' }, permanent: { amount: 100, per: 'arch' } } };
const quote = (pricing: TenantPricing, teeth: RenderTooth[], cut: CutId) => priceBreakdown(pricing, teeth, { ...DEFAULT_SET, cut });
const cutLine = (pricing: TenantPricing, teeth: RenderTooth[], cut: CutId) => quote(pricing, teeth, cut).lines.find((line) => /^(Deep cut|Permanent look)/.test(line.label));

describe('cut prices', () => {
  it('a 6-top with deep cut adds $30', () => {
    expect(cutLine(ceddy, SIX_TOP, 'deep')).toEqual({ label: 'Deep cut · 6 teeth', amount: 30 });
    expect(quote(ceddy, SIX_TOP, 'deep').total - quote(legacy, SIX_TOP, 'deep').total).toBe(30);
  });

  it('a 6-top plus 6-bottom with permanent adds $200', () => {
    expect(cutLine(ceddy, [...SIX_TOP, ...SIX_BOTTOM], 'permanent')).toEqual({ label: 'Permanent look · 2 arches', amount: 200 });
  });

  it('a top-only set with permanent adds $100', () => {
    expect(cutLine(ceddy, SIX_TOP, 'permanent')).toEqual({ label: 'Permanent look · 1 arch', amount: 100 });
    // A bottom-only set is one arch too.
    expect(cutLine(ceddy, SIX_BOTTOM, 'permanent')?.amount).toBe(100);
  });

  it('a shop with no cut prices quotes exactly as before', () => {
    expect(cutPrice(legacy, 'permanent')).toEqual({ amount: legacy.extras.permanent, per: 'order' });
    expect(cutPrice(legacy, 'deep')).toEqual({ amount: 0, per: 'order' });
    expect(cutLine(legacy, [...SIX_TOP, ...SIX_BOTTOM], 'permanent')).toEqual({ label: 'Permanent look', amount: legacy.extras.permanent });
    expect(cutLine(legacy, SIX_TOP, 'deep')).toBeUndefined();
    // A shop that prices only one cut keeps the old rule for the other.
    expect(cutPrice({ ...legacy, cuts: { deep: { amount: 5, per: 'tooth' } } }, 'permanent')).toEqual({ amount: legacy.extras.permanent, per: 'order' });
  });

  it('shows the unit on the fit options', () => {
    expect(priceHints(ceddy).cut('deep')).toBe('+$5 / tooth');
    expect(priceHints(ceddy).cut('permanent')).toBe('+$100 / arch');
    expect(priceHints(legacy).cut('permanent')).toBe(`+$${legacy.extras.permanent}`);
    expect(priceHints(legacy).cut('deep')).toBe('Included');
    expect(priceHints({ ...ceddy, display: 'hidden' }).cut('deep')).toBeUndefined();
  });

  it('the server, from the stored config and the posted design, gets the builder’s total', () => {
    const config = { ...VVSLAB_CONFIG, pricing: ceddy };
    const set = { ...DEFAULT_SET, cut: 'permanent' as const };
    const teeth = [...SIX_TOP, ...SIX_BOTTOM];
    const builder = priceBreakdown(config.pricing, teeth, set, config.catalog.addOns);
    const stored = parseTenantConfig(JSON.parse(JSON.stringify(config)));
    expect(stored.ok).toBe(true);
    if (!stored.ok) return;
    const spec = parseRenderSpec(JSON.parse(JSON.stringify({ ...set, teeth })), stored.config.catalog);
    expect(spec).not.toBeNull();
    const server = priceBreakdown(stored.config.pricing, spec!.teeth, spec!, stored.config.catalog.addOns);
    expect(server.total).toBe(builder.total);
    expect(server.lines).toEqual(builder.lines);
  });

  it('only takes order, arch or tooth as the unit', () => {
    const parse = (cuts: unknown) => parseTenantConfig({ ...VVSLAB_CONFIG, pricing: { ...VVSLAB_CONFIG.pricing, cuts } }).ok;
    expect(parse({ permanent: { amount: 100, per: 'arch' } })).toBe(true);
    expect(parse({ permanent: { amount: 100, per: 'jaw' } })).toBe(false);
    expect(parse({ permanent: { amount: -5, per: 'arch' } })).toBe(false);
  });

  it('lists a changed cut price in the change log', () => {
    const changes = describeChanges({ ...VVSLAB_CONFIG, pricing: legacy }, { ...VVSLAB_CONFIG, pricing: ceddy }).map((change) => change.text);
    expect(changes).toContain('Deep cut: free → $5 per tooth');
    expect(changes).toContain(`Permanent look: $${legacy.extras.permanent} per order → $100 per arch`);
  });

  it('quick pricing leaves cut prices alone, and its check screen prices the teeth only', () => {
    const answers = { gold: 150, iced: 225, fee: { kind: 'service' as const, amount: 0 } };
    expect(quickPricing(ceddy, answers).cuts).toEqual(ceddy.cuts);
    expect(checkLines(ceddy)).toEqual(checkLines(legacy));
  });
});
