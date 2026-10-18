import { afterEach, describe, expect, it, vi } from 'vitest';
import { handleDashboard } from '../dashboard';
import { runRetention } from '../retention';

const TENANT = '11111111-1111-1111-1111-111111111111';
const env = {
  SUPABASE_URL: 'https://db.test',
  SUPABASE_SERVICE_ROLE_KEY: 'service',
  STRIPE_SECRET_KEY: 'sk_test_x',
  VERCEL_DOMAINS_TOKEN: 'vercel',
  VERCEL_PROJECT_ID: 'prj_test',
};

type Call = { method: string; url: string; body: string };

/** A fake Supabase + Stripe + Vercel. `role` is the caller's role for the shop. */
function fakeServices(options: { role: 'admin' | 'owner' | 'staff'; status?: string; subscription?: string | null; billing?: string; domain?: string | null; stripeFails?: boolean }) {
  const calls: Call[] = [];
  vi.stubGlobal('fetch', vi.fn(async (input: string | URL | Request, init?: RequestInit) => {
    const url = String(input);
    const method = init?.method ?? 'GET';
    calls.push({ method, url, body: String(init?.body ?? '') });
    if (url.endsWith('/auth/v1/user')) return Response.json({ id: 'u1', email: 'admin@test' });
    if (url.includes('/rest/v1/platform_admins')) return new Response(null, { status: 200, headers: { 'content-range': `*/${options.role === 'admin' ? 1 : 0}` } });
    if (url.includes('/rest/v1/members')) return Response.json(options.role === 'admin' ? [] : [{ role: options.role }]);
    if (url.includes('/rest/v1/tenants') && method === 'GET') {
      return Response.json([{ id: TENANT, name: 'Gold Mouth', status: options.status ?? 'live', stripe_subscription_id: options.subscription ?? null, billing_status: options.billing ?? 'none' }]);
    }
    if (url.includes('/rest/v1/tenants') && method === 'PATCH') return Response.json([{ id: TENANT }]);
    if (url.includes('/rest/v1/tenant_domains') && method === 'GET') return Response.json(options.domain ? [{ id: 'd1', domain: options.domain }] : []);
    if (url.includes('/rest/v1/tenant_domains') && method === 'DELETE') return new Response(null, { status: 204 });
    if (url.startsWith('https://api.stripe.com/v1/subscriptions/')) {
      return options.stripeFails ? Response.json({ error: { code: 'api_error', message: 'down' } }, { status: 500 }) : Response.json({ id: options.subscription, cancel_at: Date.UTC(2026, 10, 3) / 1000 });
    }
    if (url.startsWith('https://api.vercel.com/')) return Response.json({});
    return new Response(`unexpected ${method} ${url}`, { status: 500 });
  }));
  return calls;
}

afterEach(() => vi.unstubAllGlobals());

describe('offboarding', () => {
  it('closes the page, ends the plan at period end and removes the domain', async () => {
    const calls = fakeServices({ role: 'admin', subscription: 'sub_1', billing: 'active', domain: 'build.goldmouth.test' });
    const result = await handleDashboard('offboard', { tenantId: TENANT }, 'tok', env);
    expect(result.status).toBe(200);
    expect(result.body).toMatchObject({ ok: true, message: expect.stringContaining('Plan ends 2026-11-03') });

    const close = calls.find((call) => call.method === 'PATCH' && call.url.includes('/rest/v1/tenants'));
    expect(close?.body).toBe(JSON.stringify({ status: 'offboarded' }));
    const cancel = calls.find((call) => call.url.startsWith('https://api.stripe.com/v1/subscriptions/sub_1'));
    expect(cancel?.method).toBe('POST');
    expect(new URLSearchParams(cancel?.body).get('cancel_at_period_end')).toBe('true');
    expect(calls.some((call) => call.method === 'DELETE' && call.url.startsWith('https://api.vercel.com/v9/projects/prj_test/domains/build.goldmouth.test'))).toBe(true);
    expect(calls.some((call) => call.method === 'DELETE' && call.url.includes('/rest/v1/tenant_domains'))).toBe(true);
  });

  it('skips Stripe when there is no paid plan, and is safe to run again', async () => {
    const calls = fakeServices({ role: 'admin', status: 'offboarded', subscription: null });
    const result = await handleDashboard('offboard', { tenantId: TENANT }, 'tok', env);
    expect(result).toMatchObject({ status: 200, body: { ok: true } });
    expect(calls.some((call) => call.url.startsWith('https://api.stripe.com/'))).toBe(false);
    expect(calls.some((call) => call.method === 'PATCH')).toBe(false);
  });

  it('finishes the other steps when Stripe fails, and says to run it again', async () => {
    const calls = fakeServices({ role: 'admin', subscription: 'sub_1', billing: 'past_due', domain: 'build.goldmouth.test', stripeFails: true });
    const result = await handleDashboard('offboard', { tenantId: TENANT }, 'tok', env);
    expect(result.status).toBe(502);
    expect(result.body).toMatchObject({ ok: false, steps: { page: { ok: true }, subscription: { ok: false }, domain: { ok: true } }, message: expect.stringContaining('Run Offboard again') });
    expect(calls.some((call) => call.method === 'DELETE' && call.url.startsWith('https://api.vercel.com/'))).toBe(true);
  });

  it('is for platform admins only', async () => {
    fakeServices({ role: 'owner', subscription: 'sub_1', billing: 'active' });
    expect((await handleDashboard('offboard', { tenantId: TENANT }, 'tok', env)).status).toBe(403);
    fakeServices({ role: 'staff' });
    expect((await handleDashboard('offboard', { tenantId: TENANT }, 'tok', env)).status).toBe(403);
  });

  it("an offboarded shop can't restart its plan or reopen Stripe", async () => {
    for (const action of ['billing_checkout', 'billing_portal', 'connect_onboard']) {
      const calls = fakeServices({ role: 'owner', status: 'offboarded' });
      const result = await handleDashboard(action, { tenantId: TENANT }, 'tok', { ...env, STRIPE_PRICE_ID: 'price_x' });
      expect(result).toMatchObject({ status: 409, body: { error: 'closed' } });
      expect(calls.some((call) => call.url.startsWith('https://api.stripe.com/'))).toBe(false);
    }
  });
});

describe('retention: logos of offboarded shops', () => {
  it('deletes the folder once, then marks the shop purged', async () => {
    const calls: Call[] = [];
    let listed = 0;
    vi.stubGlobal('fetch', vi.fn(async (input: string | URL | Request, init?: RequestInit) => {
      const url = String(input);
      const method = init?.method ?? 'GET';
      calls.push({ method, url, body: String(init?.body ?? '') });
      if (url.includes('/rpc/expired_leads')) return Response.json([]);
      if (url.includes('/rest/v1/tenants') && method === 'GET') return Response.json([{ id: TENANT }]);
      if (url.includes('/storage/v1/object/list/tenant-assets')) {
        listed += 1;
        return Response.json(listed === 1 ? [{ name: 'logo-1.png', id: 'o1' }, { name: 'logo-2.webp', id: 'o2' }] : []);
      }
      if (url.endsWith('/storage/v1/object/tenant-assets') && method === 'DELETE') return Response.json([]);
      if (url.includes('/rest/v1/tenants') && method === 'PATCH') return Response.json([{ id: TENANT }]);
      return new Response(`unexpected ${method} ${url}`, { status: 500 });
    }));
    const result = await runRetention(env);
    expect(result).toMatchObject({ ok: true, deleted: 0, assets: { shops: 1, files: 2 } });
    const query = new URL(calls.find((call) => call.method === 'GET' && call.url.includes('/rest/v1/tenants'))!.url).searchParams;
    expect(query.get('status')).toBe('eq.offboarded');
    expect(query.get('assets_purged_at')).toBe('is.null');
    const removed = calls.find((call) => call.method === 'DELETE' && call.url.endsWith('/storage/v1/object/tenant-assets'));
    expect(JSON.parse(removed!.body)).toEqual({ prefixes: [`${TENANT}/logo-1.png`, `${TENANT}/logo-2.webp`] });
    expect(calls.some((call) => call.method === 'PATCH' && call.body.includes('assets_purged_at'))).toBe(true);
  });

  it('only reports in a dry run', async () => {
    const calls: Call[] = [];
    vi.stubGlobal('fetch', vi.fn(async (input: string | URL | Request, init?: RequestInit) => {
      calls.push({ method: init?.method ?? 'GET', url: String(input), body: '' });
      if (String(input).includes('/rpc/expired_leads')) return Response.json([]);
      return Response.json([{ id: TENANT }]);
    }));
    expect(await runRetention(env, true)).toMatchObject({ dryRun: true, assets: { shops: 1, files: 0 } });
    expect(calls.some((call) => call.method === 'DELETE' || call.method === 'PATCH' || call.url.includes('/storage/'))).toBe(false);
  });
});
