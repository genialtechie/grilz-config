import { afterEach, describe, expect, it, vi } from 'vitest';
import { handleLead } from '../leads';
import { handlePromo } from '../promos';
import { forgetTenant } from '../tenants';
import { priceBreakdown } from '../../src/lib/pricing';
import { promoStatus } from '../../src/lib/promo';
import { DEFAULT_SET, type RenderTooth } from '../../src/lib/renderSpec';
import { VVSLAB_CONFIG } from '../../src/lib/tenant/vvslab';

vi.mock('@vercel/functions', () => ({ dangerouslyDeleteByTag: vi.fn(async () => undefined) }));

const env = { SUPABASE_URL: 'https://db.test', SUPABASE_SERVICE_ROLE_KEY: 'service' };
const TENANT = '11111111-1111-1111-1111-111111111111';
const PROMO_ID = '22222222-2222-2222-2222-222222222222';
const config = { ...structuredClone(VVSLAB_CONFIG), pricing: { ...VVSLAB_CONFIG.pricing, minimumOrder: 0 } };
const shop = { id: TENANT, slug: 'promo-shop', name: 'Promo Shop', status: 'live', kind: 'shop', published_version: 1, tenant_configs: [{ version: 1, config }] };
const code = (extra: Record<string, unknown> = {}) => ({ id: PROMO_ID, code: 'SUMMER15', kind: 'percent', value: '15', min_order: '0', expires_at: null, max_uses: null, uses: 0, active: true, ...extra });
const teeth: RenderTooth[] = [6, 7, 8, 9].map((index) => ({ index, metal: 'yellow', karat: '10k', type: 'plain', style: 'solid', setting: 'honeycomb', stone: 'moissanite' }));

/** A fake database: the shop, its one code, and a record of the calls that change things. */
function fakeDb(promoRow: Record<string, unknown> | null, options: { attempt?: boolean; redeem?: boolean; created?: string } = {}) {
  const calls: { fn: string; body: Record<string, unknown> }[] = [];
  vi.stubGlobal('fetch', vi.fn(async (input: string | URL | Request, init?: RequestInit) => {
    const url = String(input);
    const body = init?.body ? JSON.parse(String(init.body)) : {};
    if (url.includes('/rest/v1/tenants')) return Response.json([shop]);
    if (url.includes('/rest/v1/promo_codes')) return Response.json(promoRow ? [promoRow] : []);
    const rpc = url.match(/\/rest\/v1\/rpc\/(\w+)/)?.[1];
    if (rpc) {
      calls.push({ fn: rpc, body });
      if (rpc === 'promo_attempt') return Response.json(options.attempt ?? true);
      if (rpc === 'redeem_promo') return Response.json(options.redeem ?? true);
      if (rpc === 'create_lead') return Response.json(options.created ?? 'ok');
      return Response.json(null);
    }
    return Response.json([]);
  }));
  return calls;
}

const lead = (promo?: string) => ({ tenant: 'promo-shop', configVersion: 1, name: 'Dana', contact: '@dana.pass', spec: { ...DEFAULT_SET, teeth }, elapsedMs: 10_000, ...(promo ? { promo } : {}) });

afterEach(async () => {
  vi.unstubAllGlobals();
  await forgetTenant('promo-shop');
});

describe('promo terms', () => {
  it('takes a percent or an amount off the order, before the shop minimum', () => {
    const without = priceBreakdown(config.pricing, teeth, DEFAULT_SET).total;
    const percent = priceBreakdown(config.pricing, teeth, DEFAULT_SET, [], { code: 'SUMMER15', kind: 'percent', value: 15, minOrder: 0 });
    expect(percent.lines.at(-1)).toEqual({ label: 'Promo SUMMER15', amount: -Math.round(without * 0.15) });
    expect(percent.promo).toEqual({ code: 'SUMMER15', amount: Math.round(without * 0.15) });
    expect(priceBreakdown(config.pricing, teeth, DEFAULT_SET, [], { code: 'TAKE50', kind: 'amount', value: 50, minOrder: 0 }).total).toBe(without - 50);
    // Never below zero, and the shop's minimum order still applies.
    expect(priceBreakdown(config.pricing, teeth, DEFAULT_SET, [], { code: 'ALL', kind: 'amount', value: 1e5, minOrder: 0 }).total).toBe(0);
    expect(priceBreakdown({ ...config.pricing, minimumOrder: without }, teeth, DEFAULT_SET, [], { code: 'TAKE50', kind: 'amount', value: 50, minOrder: 0 }).total).toBe(without);
  });

  it("doesn't apply under the code's minimum order, and says what it needs", () => {
    const under = priceBreakdown(config.pricing, teeth, DEFAULT_SET, [], { code: 'BIG', kind: 'percent', value: 10, minOrder: 1e6 });
    expect(under.promo).toEqual({ code: 'BIG', amount: 0, minOrder: 1e6 });
    expect(under.lines.some((line) => line.label.startsWith('Promo'))).toBe(false);
  });

  it('refuses paused, expired and used-up codes', () => {
    const row = { ...code(), kind: 'percent' as const };
    expect(promoStatus(undefined)).toEqual({ ok: false, reason: 'unknown' });
    expect(promoStatus({ ...row, active: false })).toEqual({ ok: false, reason: 'paused' });
    expect(promoStatus({ ...row, expires_at: '2026-01-01T00:00:00Z' }, Date.parse('2026-10-19T00:00:00Z'))).toEqual({ ok: false, reason: 'expired' });
    expect(promoStatus({ ...row, max_uses: 3, uses: 3 })).toEqual({ ok: false, reason: 'used_up' });
    expect(promoStatus(row)).toEqual({ ok: true, promo: { code: 'SUMMER15', kind: 'percent', value: 15, minOrder: 0 } });
  });
});

describe('checking a code from the builder', () => {
  it("returns one code's terms, matching whatever case the customer typed", async () => {
    fakeDb(code());
    expect(await handlePromo({ tenant: 'promo-shop', code: ' summer15 ' }, '1.2.3.4', env)).toEqual({ status: 200, body: { ok: true, promo: { code: 'SUMMER15', kind: 'percent', value: 15, minOrder: 0 } } });
  });

  it('says why a code is refused, without querying for nonsense', async () => {
    const calls = fakeDb(null);
    expect((await handlePromo({ tenant: 'promo-shop', code: 'NOPE' }, '1.2.3.4', env)).body).toMatchObject({ ok: false, reason: 'unknown' });
    expect((await handlePromo({ tenant: 'promo-shop', code: '<script>' }, '1.2.3.4', env)).body).toMatchObject({ ok: false, reason: 'unknown' });
    expect(calls.filter((call) => call.fn === 'promo_attempt')).toHaveLength(2);
  });

  it('slows down a visitor trying code after code', async () => {
    fakeDb(code(), { attempt: false });
    const result = await handlePromo({ tenant: 'promo-shop', code: 'SUMMER15' }, '1.2.3.4', env);
    expect(result.status).toBe(429);
    expect(result.body).toMatchObject({ ok: false, reason: 'throttled' });
  });
});

describe('a design request with a code', () => {
  it('prices the code in on the server and counts one use', async () => {
    const calls = fakeDb(code());
    const result = await handleLead(lead('summer15'), '1.2.3.4', env, () => undefined);
    expect(result.status).toBe(200);
    const stored = calls.find((call) => call.fn === 'create_lead')!.body.lead as { price: { promo: unknown; lines: { label: string }[] } };
    expect(stored.price.lines.some((line) => line.label === 'Promo SUMMER15')).toBe(true);
    expect(calls.filter((call) => call.fn === 'redeem_promo')).toEqual([{ fn: 'redeem_promo', body: { promo: PROMO_ID } }]);
    expect(calls.some((call) => call.fn === 'release_promo')).toBe(false);
  });

  it('refuses a code that stopped being valid, before storing anything', async () => {
    const calls = fakeDb(code({ active: false }));
    const result = await handleLead(lead('SUMMER15'), '1.2.3.4', env, () => undefined);
    expect(result).toMatchObject({ status: 400, body: { code: 'promo' } });
    expect(calls.some((call) => call.fn === 'create_lead' || call.fn === 'redeem_promo')).toBe(false);
  });

  it('refuses when the last use went to someone else a moment ago', async () => {
    const calls = fakeDb(code({ max_uses: 1 }), { redeem: false });
    expect(await handleLead(lead('SUMMER15'), '1.2.3.4', env, () => undefined)).toMatchObject({ status: 409, body: { code: 'promo' } });
    expect(calls.some((call) => call.fn === 'create_lead')).toBe(false);
  });

  it('gives the use back when the request is turned away', async () => {
    const calls = fakeDb(code(), { created: 'ip' });
    expect((await handleLead(lead('SUMMER15'), '1.2.3.4', env, () => undefined)).status).toBe(429);
    expect(calls.map((call) => call.fn)).toEqual(['redeem_promo', 'create_lead', 'release_promo']);
  });

  it("doesn't count a use when the order is under the code's minimum", async () => {
    const calls = fakeDb(code({ min_order: '1000000' }));
    expect((await handleLead(lead('SUMMER15'), '1.2.3.4', env, () => undefined)).status).toBe(200);
    expect(calls.some((call) => call.fn === 'redeem_promo')).toBe(false);
  });
});
