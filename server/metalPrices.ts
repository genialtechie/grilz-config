import { createDb, hasDb } from './db.js';
import type { TenantEnv } from './tenants.js';
import type { Commodity, Spot } from '../src/lib/metalMarket.js';

// The day's metal prices for market-linked pricing. Fetched by the daily crons
// from Yahoo Finance (front-month COMEX/NYMEX futures, close to spot; an
// unofficial endpoint, no key) with gold-api.com (spot, no key) as the
// fallback, sanity-checked, and stored in metal_prices. Quotes read the latest
// stored prices, so a feed outage never breaks a quote: the last good price
// keeps working, and the daily alert flags it once it's 2 days old.

const YAHOO: Record<Commodity, string> = { gold: 'GC=F', silver: 'SI=F', platinum: 'PL=F' };
const GOLD_API: Record<Commodity, string> = { gold: 'XAU', silver: 'XAG', platinum: 'XPT' };
/** Prices outside these (USD per troy ounce) are treated as a bad read, not a market move. */
const SANE: Record<Commodity, [number, number]> = { gold: [500, 20_000], silver: [5, 500], platinum: [200, 10_000] };
const COMMODITIES = Object.keys(YAHOO) as Commodity[];
export const STALE_MS = 2 * 864e5;

type Fetch = typeof fetch;
const sane = (commodity: Commodity, price: unknown): price is number =>
  typeof price === 'number' && Number.isFinite(price) && price >= SANE[commodity][0] && price <= SANE[commodity][1];

async function json(fetcher: Fetch, url: string) {
  const response = await fetcher(url, { headers: { 'User-Agent': 'Mozilla/5.0 (VVS Lab metal prices)', Accept: 'application/json' }, signal: AbortSignal.timeout(8000) });
  if (!response.ok) throw new Error(`${new URL(url).hostname} ${response.status}`);
  return response.json() as Promise<unknown>;
}

async function fromYahoo(commodity: Commodity, fetcher: Fetch) {
  const body = (await json(fetcher, `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(YAHOO[commodity])}?interval=1d&range=5d`)) as {
    chart?: { result?: { meta?: { regularMarketPrice?: number; currency?: string } }[] };
  };
  const meta = body.chart?.result?.[0]?.meta;
  if (meta?.currency !== 'USD' || !sane(commodity, meta.regularMarketPrice)) throw new Error(`yahoo ${commodity} unusable`);
  return meta.regularMarketPrice;
}

async function fromGoldApi(commodity: Commodity, fetcher: Fetch) {
  const body = (await json(fetcher, `https://api.gold-api.com/price/${GOLD_API[commodity]}`)) as { price?: number; currency?: string };
  if (body.currency !== 'USD' || !sane(commodity, body.price)) throw new Error(`gold-api ${commodity} unusable`);
  return body.price;
}

/** Today's prices from the first source that answers sensibly for every metal, or null. */
export async function fetchSpot(fetcher: Fetch = fetch, now = new Date()): Promise<Spot | null> {
  for (const [source, read] of [['yahoo', fromYahoo], ['gold-api', fromGoldApi]] as const) {
    try {
      const prices = await Promise.all(COMMODITIES.map((commodity) => read(commodity, fetcher)));
      return { gold: prices[0], silver: prices[1], platinum: prices[2], asOf: now.toISOString(), source };
    } catch (error) {
      console.error('metal prices', source, error instanceof Error ? error.message : error);
    }
  }
  return null;
}

type Row = { gold: number; silver: number; platinum: number; source: string; fetched_at: string };

/** Fetch and store today's prices (the daily crons). */
export async function refreshMetalPrices(env: TenantEnv, fetcher: Fetch = fetch) {
  if (!hasDb(env)) return { ok: false, error: 'database not configured' };
  const spot = await fetchSpot(fetcher);
  if (!spot) return { ok: false, error: 'no source answered' };
  await createDb(env).insert('metal_prices', { gold: spot.gold, silver: spot.silver, platinum: spot.platinum, source: spot.source, fetched_at: spot.asOf });
  cached = { at: Date.now(), spot };
  return { ok: true, source: spot.source, gold: spot.gold };
}

let cached: { at: number; spot: Spot | null } | null = null;
const CACHE_MS = 10 * 60_000;

/** The latest stored prices (cached for a few minutes per instance), or null if there are none. */
export async function latestSpot(env: TenantEnv): Promise<Spot | null> {
  if (cached && Date.now() - cached.at < CACHE_MS) return cached.spot;
  if (!hasDb(env)) return null;
  try {
    const [row] = await createDb(env).select<Row>('metal_prices', { select: 'gold,silver,platinum,source,fetched_at', order: 'fetched_at.desc', limit: '1' });
    const spot = row ? { gold: Number(row.gold), silver: Number(row.silver), platinum: Number(row.platinum), source: row.source, asOf: row.fetched_at } : null;
    cached = { at: Date.now(), spot };
    return spot;
  } catch (error) {
    console.error('metal prices read', error instanceof Error ? error.message : error);
    return cached?.spot ?? null;
  }
}

/** For tests. */
export const resetMetalPriceCache = () => {
  cached = null;
};
