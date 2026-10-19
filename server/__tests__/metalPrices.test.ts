import { describe, expect, it } from 'vitest';
import { fetchSpot } from '../metalPrices';

const yahoo = (prices: Record<string, number>) => (url: string) => {
  const symbol = decodeURIComponent(new URL(url).pathname.split('/').pop()!);
  return Response.json({ chart: { result: [{ meta: { currency: 'USD', regularMarketPrice: prices[symbol] } }] } });
};
const goldApi = (prices: Record<string, number>) => (url: string) => Response.json({ currency: 'USD', price: prices[new URL(url).pathname.split('/').pop()!] });

const fake = (routes: { yahoo?: (url: string) => Response; goldApi?: (url: string) => Response }) =>
  (async (input: string | URL | Request) => {
    const url = String(input);
    if (url.includes('yahoo')) return routes.yahoo ? routes.yahoo(url) : new Response('blocked', { status: 429 });
    return routes.goldApi ? routes.goldApi(url) : new Response('down', { status: 503 });
  }) as typeof fetch;

describe('metal price feed', () => {
  const now = new Date('2026-10-19T14:07:00Z');

  it('reads Yahoo Finance futures', async () => {
    const spot = await fetchSpot(fake({ yahoo: yahoo({ 'GC=F': 4196.8, 'SI=F': 57.4, 'PL=F': 1645.9 }) }), now);
    expect(spot).toEqual({ gold: 4196.8, silver: 57.4, platinum: 1645.9, asOf: now.toISOString(), source: 'yahoo' });
  });

  it('falls back to gold-api.com when Yahoo fails or answers nonsense', async () => {
    const backup = goldApi({ XAU: 4174.3, XAG: 57.42, XPT: 1640 });
    expect((await fetchSpot(fake({ goldApi: backup }), now))?.source).toBe('gold-api');
    // A gold price of $4 is a bad read, not a market move.
    expect((await fetchSpot(fake({ yahoo: yahoo({ 'GC=F': 4, 'SI=F': 57.4, 'PL=F': 1645.9 }), goldApi: backup }), now))?.gold).toBe(4174.3);
  });

  it('gives up cleanly when both fail', async () => {
    expect(await fetchSpot(fake({}), now)).toBeNull();
  });
});
