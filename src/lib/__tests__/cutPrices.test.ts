import { describe, expect, it } from 'vitest';
import { cutPrice, feeLabel, priceBreakdown, priceHints } from '../pricing';
import { checkLines, quickPricing } from '../quickPricing';
import { DEFAULT_SET, parseRenderSpec, summarizeDesign, type CutId, type RenderTooth, type ToothDesign } from '../renderSpec';
import { defaultSet, shopCatalog } from '../tenant/catalog';
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

// MAG-205: no forced cut, and a fee the shop names.
describe('no forced cut', () => {
  // Luckey's: $50 fee, permanent look $100, 10K gold $115 a tooth (a 6x6 is $1,380 of metal).
  const luckey: TenantPricing = { ...legacy, base: 50, baseLabel: 'Appointment fee', metalPerTooth: { ...legacy.metalPerTooth, yellow: 115 }, karatMultiplier: { ...legacy.karatMultiplier, '10k': 1 }, extras: { ...legacy.extras, permanent: 100 }, cuts: undefined };
  const sixBySix = [...SIX_TOP, ...SIX_BOTTOM];
  const permanentOnly = { ...VVSLAB_CONFIG.catalog, cuts: ['permanent' as const] };

  it('Atlanta (deep $5/tooth, permanent $100/arch, both paid): no free option, deep preselected, $30 Deep cut line', () => {
    const catalog = VVSLAB_CONFIG.catalog;
    expect(shopCatalog(catalog).cuts.map((cut) => cut.id)).toEqual(['deep', 'permanent']);
    const set = defaultSet(catalog, ceddy);
    expect(set.cut).toBe('deep');
    expect(priceBreakdown(ceddy, SIX_TOP, set).lines).toContainEqual({ label: 'Deep cut · 6 teeth', amount: 30 });
  });

  // Luckey sells Permanent look only, at $100. Every cut costs money, so the quote carries it:
  // that is CORRECT per the shop's pricing, not a bug. ($1,430 only ever applied while a Deep $0
  // workaround entry was in the config; that hack is gone.)
  it('Luckey, permanent look only: permanent preselected, a 10K 6x6 is $1,530 ($1,380 metal + $50 fee + $100)', () => {
    const set = defaultSet(permanentOnly, luckey);
    expect(set.cut).toBe('permanent');
    expect(shopCatalog(permanentOnly).cuts.map((cut) => cut.id)).toEqual(['permanent']);
    const quoted = priceBreakdown(luckey, sixBySix, set);
    expect(quoted.total).toBe(1530);
    expect(quoted.lines).toContainEqual({ label: 'Appointment fee', amount: 50 });
  });

  it('a shop with a free cut preselects the first free one', () => {
    expect(defaultSet(VVSLAB_CONFIG.catalog, luckey).cut).toBe('deep');
    // Deep is paid, permanent is free: the free one wins over the platform default.
    const permanentFree = { ...legacy, cuts: { deep: { amount: 5, per: 'tooth' as const }, permanent: { amount: 0, per: 'order' as const } } };
    expect(defaultSet(VVSLAB_CONFIG.catalog, permanentFree).cut).toBe('permanent');
  });

  it('with no cuts the config saves, the builder has no cuts and nothing is charged', () => {
    const none = { ...VVSLAB_CONFIG.catalog, cuts: [] };
    const parsed = parseTenantConfig({ ...VVSLAB_CONFIG, catalog: none, pricing: luckey });
    expect(parsed.ok).toBe(true);
    expect(shopCatalog(none).cuts).toEqual([]);
    const set = defaultSet(none, luckey);
    expect(set.cut).toBe('deep');
    const quoted = priceBreakdown(luckey, sixBySix, set);
    expect(quoted.total).toBe(1430);
    expect(quoted.lines.some((line) => /^(Deep cut|Permanent look)/.test(line.label))).toBe(false);
    const stored = parseRenderSpec(JSON.parse(JSON.stringify({ ...set, teeth: sixBySix })), none);
    expect(stored).not.toBeNull();
    // Nor does its summary name a cut the shop doesn't sell.
    expect(summarizeDesign(stored!, [], none.cuts)).not.toContain('Deep cut');
    expect(summarizeDesign(stored!)).toContain('Deep cut');
  });

  it('prunes stale cut prices, so turning every cut off stops the charge', () => {
    const none = { ...VVSLAB_CONFIG.catalog, cuts: [] };
    const parsed = parseTenantConfig({ ...VVSLAB_CONFIG, catalog: none, pricing: ceddy });
    expect(parsed.ok).toBe(true);
    if (!parsed.ok) return;
    expect(parsed.config.pricing.cuts).toBeUndefined();
    const quoted = priceBreakdown(parsed.config.pricing, SIX_TOP, defaultSet(none, parsed.config.pricing));
    expect(quoted.lines.some((line) => /^Deep cut/.test(line.label))).toBe(false);
    expect(quoted.total).toBe(priceBreakdown(legacy, SIX_TOP, DEFAULT_SET).total);
    // One cut left: only its price survives.
    const kept = parseTenantConfig({ ...VVSLAB_CONFIG, catalog: { ...VVSLAB_CONFIG.catalog, cuts: ['permanent'] }, pricing: ceddy });
    expect(kept.ok && kept.config.pricing.cuts).toEqual({ permanent: { amount: 100, per: 'arch' } });
  });

  it('the fee label shows in the breakdown, defaulting to "Service fee"', () => {
    expect(priceBreakdown(luckey, SIX_TOP, DEFAULT_SET).lines[0]).toEqual({ label: 'Appointment fee', amount: 50 });
    expect(priceBreakdown({ ...luckey, baseLabel: undefined }, SIX_TOP, DEFAULT_SET).lines[0].label).toBe('Service fee');
    expect(describeChanges({ ...VVSLAB_CONFIG, pricing: legacy }, { ...VVSLAB_CONFIG, pricing: luckey }).map((c) => c.text)).toContain(`Appointment fee: $${legacy.base} → $50`);
  });

  it('renaming the fee alone shows up as a change, so it can be published', () => {
    const renamed = { ...legacy, baseLabel: 'VIP fee' };
    expect(describeChanges({ ...VVSLAB_CONFIG, pricing: legacy }, { ...VVSLAB_CONFIG, pricing: renamed }).map((c) => c.text)).toEqual(['Fee name: Service fee → VIP fee']);
  });

  it('validates the fee label: optional, trimmed, up to 40 characters', () => {
    const withLabel = (baseLabel?: string) => parseTenantConfig({ ...VVSLAB_CONFIG, pricing: { ...legacy, baseLabel } }).ok;
    expect(withLabel(undefined)).toBe(true);
    expect(withLabel('Appointment fee')).toBe(true);
    expect(withLabel('x'.repeat(40))).toBe(true);
    // Blank is allowed and means the default name.
    expect(withLabel('')).toBe(true);
    expect(withLabel('   ')).toBe(true);
    expect(feeLabel({ baseLabel: '' })).toBe('Service fee');
    expect(feeLabel({ baseLabel: '   ' })).toBe('Service fee');
    expect(withLabel('x'.repeat(41))).toBe(false);
  });

  it('rejects an unknown cut id such as "standard"', () => {
    expect(parseTenantConfig({ ...VVSLAB_CONFIG, catalog: { ...VVSLAB_CONFIG.catalog, cuts: ['standard'] } }).ok).toBe(false);
    expect(parseTenantConfig({ ...VVSLAB_CONFIG, pricing: { ...legacy, cuts: { standard: { amount: 10, per: 'order' } } } }).ok).toBe(false);
  });
});
