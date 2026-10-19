import { isGold, KARATS, METALS, type KaratId, type MetalId } from './renderSpec.js';
import type { TenantPricing } from './tenant/schema.js';

// Metal priced from the live market: grams of metal per tooth × today's price
// for the pure metal × the alloy's purity, marked up, plus labour per tooth.
// The server turns the day's prices into a per-tooth quote on the shop's
// pricing (`market.quote`); the price engine just reads it, in the builder and
// on the server alike. Without a quote the shop's fixed prices apply.

export type Commodity = 'gold' | 'silver' | 'platinum';

/** US dollars per troy ounce of the pure metal. */
export type Spot = Record<Commodity, number> & { asOf: string; source: string };

export const GRAMS_PER_TROY_OUNCE = 31.1035;

const COMMODITY: Record<MetalId, Commodity> = { yellow: 'gold', white: 'gold', rose: 'gold', silver: 'silver', platinum: 'platinum' };

/** Share of pure metal in the alloy: karat for gold, sterling for silver, 950 platinum. */
export const purity = (metal: MetalId, karat: KaratId) => {
  if (metal === 'silver') return 0.925;
  if (metal === 'platinum') return 0.95;
  return { '10k': 10 / 24, '14k': 14 / 24, '18k': 18 / 24, '22k': 22 / 24 }[karat];
};

/** The quote's key: gold prices differ by karat, silver and platinum don't. */
export const quoteKey = (metal: MetalId, karat: KaratId) => (isGold(metal) ? `${metal}:${karat}` : metal);

/** One tooth's metal price from the market, or null when the shop hasn't set grams for this metal. */
export function marketPerTooth(pricing: TenantPricing, spot: Spot, metal: MetalId, karat: KaratId): number | null {
  const market = pricing.market;
  const grams = market?.gramsPerTooth[metal];
  if (!market || !grams) return null;
  const perGram = spot[COMMODITY[metal]] / GRAMS_PER_TROY_OUNCE;
  const metalValue = grams * perGram * purity(metal, karat) * (1 + market.markupPercent / 100);
  return Math.round(metalValue + (market.labourPerTooth[metal] ?? 0));
}

/**
 * The shop's pricing with today's per-tooth quote attached (market pricing on
 * and a price available), or with any quote removed (fixed prices apply).
 * A quote saved in a config is never trusted: the server always rebuilds it.
 */
export function withMarketQuote(pricing: TenantPricing, spot: Spot | null): TenantPricing {
  if (!pricing.market) return pricing;
  const market = { ...pricing.market };
  delete market.quote;
  if (!market.enabled || !spot) return { ...pricing, market };
  const perTooth: Record<string, number> = {};
  for (const metal of METALS) {
    for (const karat of isGold(metal.id) ? KARATS : KARATS.slice(0, 1)) {
      const price = marketPerTooth(pricing, spot, metal.id, karat.id);
      if (price !== null) perTooth[quoteKey(metal.id, karat.id)] = price;
    }
  }
  return {
    ...pricing,
    market: { ...market, quote: { asOf: spot.asOf, gold: spot.gold, silver: spot.silver, platinum: spot.platinum, perTooth } },
  };
}

/** Starting points a shop then adjusts: a typical cap's metal, by density. */
export const MARKET_DEFAULTS: NonNullable<TenantPricing['market']> = {
  enabled: true,
  gramsPerTooth: { yellow: 2.5, white: 2.5, rose: 2.5, silver: 1.6, platinum: 3 },
  labourPerTooth: { yellow: 75, white: 75, rose: 75, silver: 40, platinum: 90 },
  markupPercent: 0,
};
