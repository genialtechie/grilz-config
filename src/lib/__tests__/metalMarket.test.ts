import { describe, expect, it } from 'vitest';
import { GRAMS_PER_TROY_OUNCE, MARKET_DEFAULTS, marketPerTooth, purity, withMarketQuote, type Spot } from '../metalMarket';
import { metalPerTooth, priceBreakdown } from '../pricing';
import { DEFAULT_SET, type RenderTooth } from '../renderSpec';
import { parseTenantConfig, type TenantPricing } from '../tenant/schema';
import { VVSLAB_CONFIG } from '../tenant/vvslab';

const spot: Spot = { gold: 4000, silver: 50, platinum: 1600, asOf: '2026-10-19T14:07:00.000Z', source: 'yahoo' };
const pricing: TenantPricing = { ...VVSLAB_CONFIG.pricing, minimumOrder: 0, market: { ...MARKET_DEFAULTS } };
const tooth: RenderTooth = { index: 7, metal: 'yellow', karat: '14k', type: 'plain', style: 'solid', setting: 'honeycomb', stone: 'moissanite' };

describe('market-linked metal', () => {
  it('prices a tooth from grams, purity, markup and labour', () => {
    const expected = Math.round(2.5 * (4000 / GRAMS_PER_TROY_OUNCE) * (14 / 24) + 75);
    expect(marketPerTooth(pricing, spot, 'yellow', '14k')).toBe(expected);
    const marked = { ...pricing, market: { ...pricing.market!, markupPercent: 20 } };
    expect(marketPerTooth(marked, spot, 'yellow', '14k')).toBe(Math.round(2.5 * (4000 / GRAMS_PER_TROY_OUNCE) * (14 / 24) * 1.2 + 75));
    expect(purity('silver', '10k')).toBe(0.925);
    expect(marketPerTooth({ ...pricing, market: { ...pricing.market!, gramsPerTooth: {} } }, spot, 'yellow', '14k')).toBeNull();
  });

  it('quotes today and the engine uses the quote, recording the prices', () => {
    const quoted = withMarketQuote(pricing, spot);
    expect(metalPerTooth(quoted, 'yellow', '14k')).toBe(marketPerTooth(pricing, spot, 'yellow', '14k'));
    expect(metalPerTooth(quoted, 'yellow', '22k')).toBeGreaterThan(metalPerTooth(quoted, 'yellow', '14k'));
    const breakdown = priceBreakdown(quoted, [tooth], DEFAULT_SET);
    expect(breakdown.market).toEqual({ asOf: spot.asOf, gold: 4000, silver: 50, platinum: 1600 });
  });

  it('falls back to fixed prices without a price, when switched off, and never trusts a saved quote', () => {
    const fixed = metalPerTooth(VVSLAB_CONFIG.pricing, 'yellow', '14k');
    expect(metalPerTooth(withMarketQuote(pricing, null), 'yellow', '14k')).toBe(fixed);
    expect(priceBreakdown(withMarketQuote(pricing, null), [tooth], DEFAULT_SET).market).toBeUndefined();
    const off = withMarketQuote({ ...pricing, market: { ...pricing.market!, enabled: false } }, spot);
    expect(metalPerTooth(off, 'yellow', '14k')).toBe(fixed);
    const forged = { ...pricing, market: { ...pricing.market!, quote: { asOf: 'x', gold: 1, silver: 1, platinum: 1, perTooth: { 'yellow:14k': 1 } } } };
    expect(metalPerTooth(withMarketQuote(forged, null), 'yellow', '14k')).toBe(fixed);
    expect(metalPerTooth(withMarketQuote(forged, spot), 'yellow', '14k')).toBe(marketPerTooth(pricing, spot, 'yellow', '14k'));
  });

  it('validates market settings in a shop config', () => {
    expect(parseTenantConfig({ ...VVSLAB_CONFIG, pricing }).ok).toBe(true);
    expect(parseTenantConfig({ ...VVSLAB_CONFIG, pricing: { ...pricing, market: { ...pricing.market!, markupPercent: -5 } } }).ok).toBe(false);
  });
});
