import { randomBytes } from 'node:crypto';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import { handleDashboard } from '../dashboard';
import { handleSignup, TRIAL_DAYS, TRIAL_GENERATIONS } from '../signup';
import { forgetTenant, getPublishedTenant } from '../tenants';

// Throwaway accounts in the local test database; generated so no password sits in the repo.
const PASSWORD = `${randomBytes(12).toString('base64url')}-Aa1`;

// Self-serve signup against a real (local) Supabase: the shop is live from the
// start on the starting prices and a trial (MAG-90), the owner joins by
// accepting the emailed invite, and can pause it and switch it back on.

const url = process.env.INTEGRATION_SUPABASE_URL;
const key = process.env.INTEGRATION_SERVICE_KEY;
const anon = process.env.INTEGRATION_ANON_KEY;
const env = { SUPABASE_URL: url ?? '', SUPABASE_SERVICE_ROLE_KEY: key ?? '', RESEND_API_KEY: 'test', RESEND_BASE_URL: 'https://resend.test', PUBLIC_ORIGIN: 'https://shop.test', LEAD_TOKEN_SECRET: 'salt' };
const realFetch = globalThis.fetch;
const sent: { to: string[]; subject: string; html: string }[] = [];
const stamp = Date.now();
// A fresh test address block per run, so reruns on the same day don't hit the per-IP limit.
const ip = (n: number) => `10.${Math.floor(stamp / 1000) % 250}.${Math.floor(stamp / 250_000) % 250}.${n}`;
const slug = `signup-${stamp}`;
const email = `owner-${stamp}@signup.test`;

const rest = async (path: string, init: RequestInit = {}) => {
  const response = await realFetch(`${url}/rest/v1/${path}`, { ...init, headers: { apikey: key!, Authorization: `Bearer ${key}`, 'Content-Type': 'application/json', Prefer: 'return=representation', ...(init.headers ?? {}) } });
  const text = await response.text();
  return text ? JSON.parse(text) : null;
};
const admin = (path: string, body: unknown, method = 'POST') =>
  realFetch(`${url}/auth/v1/admin/${path}`, { method, headers: { apikey: key!, Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' }, body: body === undefined ? undefined : JSON.stringify(body) }).then((r) => r.json());

describe.skipIf(!url || !key || !anon)('self-serve signup (integration)', () => {
  beforeAll(() => {
    vi.stubGlobal('fetch', async (input: string | URL | Request, init?: RequestInit) => {
      const target = typeof input === 'string' ? input : input instanceof URL ? input.href : input.url;
      if (target.startsWith('https://resend.test/')) {
        sent.push(JSON.parse(String(init?.body)));
        return Response.json({ id: `email-${sent.length}` });
      }
      return realFetch(input, init);
    });
  });
  afterAll(async () => {
    vi.unstubAllGlobals();
    await rest(`tenants?slug=eq.${slug}`, { method: 'DELETE' });
  });

  it('creates a live trial shop on the starting prices, emails the owner, who joins by accepting', async () => {
    const result = await handleSignup({ name: 'Signup Test Gold', email, slug, instagram: 'signup.test', terms: true, elapsedMs: 20_000 }, ip(10), env);
    expect(result).toMatchObject({ status: 200, body: { ok: true } });
    const [tenant] = await rest(`tenants?slug=eq.${slug}&select=id,status,plan,created_via,trial_ends_at,published_version`);
    expect(tenant).toMatchObject({ status: 'live', plan: 'trial', created_via: 'signup', published_version: 1 });
    const days = (new Date(tenant.trial_ends_at).getTime() - Date.now()) / 864e5;
    expect(days).toBeGreaterThan(TRIAL_DAYS - 0.1);
    expect(days).toBeLessThan(TRIAL_DAYS + 0.1);
    const [config] = await rest(`tenant_configs?tenant_id=eq.${tenant.id}&status=eq.published&select=config`);
    expect(config.config.ai.monthlyGenerations).toBe(TRIAL_GENERATIONS);
    // Customers can use the builder straight away, on the starting prices.
    expect(config.config.pricing.source).toBe('default');
    const builder = await getPublishedTenant(slug, env);
    expect(builder.ok && builder.tenant.status).toBe('live');
    expect(config.config.leads.email).toEqual([email]);
    expect(config.config.brand.instagram).toBe('signup.test');
    const welcome = sent.find((mail) => mail.to.includes(email)) as { html: string; from?: string } | undefined;
    expect(welcome?.html).toContain(`https://shop.test/dashboard/welcome?token_hash=`);
    expect(welcome?.html).toContain(`&amp;shop=${slug}`);
    expect(welcome?.html).not.toContain('/auth/v1/verify');
    expect(welcome?.from).toBe('VVS Lab <hello@vvslab.magpollo.com>');

    // not a member until they accept by signing in
    expect(await rest(`members?tenant_id=eq.${tenant.id}&select=user_id`)).toHaveLength(0);
    const users = (await admin('users?per_page=1000', undefined, 'GET')) as { users: { id: string; email: string }[] };
    const owner = users.users.find((item) => item.email === email)!;
    await admin(`users/${owner.id}`, { password: PASSWORD, email_confirm: true }, 'PUT');
    const token = ((await (await realFetch(`${url}/auth/v1/token?grant_type=password`, { method: 'POST', headers: { apikey: anon!, 'Content-Type': 'application/json' }, body: JSON.stringify({ email, password: PASSWORD }) })).json()) as { access_token: string }).access_token;
    const accepted = await realFetch(`${url}/rest/v1/rpc/accept_member_invites`, { method: 'POST', headers: { apikey: anon!, Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' }, body: '{}' }).then((r) => r.json());
    expect(accepted).toBe(1);

    await forgetTenant(slug);
    expect(await handleDashboard('pause', { tenantId: tenant.id }, token, env)).toMatchObject({ status: 200, body: { status: 'paused' } });
    const live = await handleDashboard('go_live', { tenantId: tenant.id }, token, env);
    expect(live).toMatchObject({ status: 200, body: { status: 'live' } });
    const [after] = await rest(`tenants?id=eq.${tenant.id}&select=status`);
    expect(after.status).toBe('live');
  });

  it("won't take a link twice, and rate-limits one address", async () => {
    const again = await handleSignup({ name: 'Copycat', email: `other-${stamp}@signup.test`, slug, terms: true, elapsedMs: 20_000 }, ip(250), env);
    expect(again.status).toBe(409);
    await handleSignup({ name: 'Second', email, slug: `${slug}-b`, terms: true, elapsedMs: 20_000 }, ip(251), env);
    const third = await handleSignup({ name: 'Third', email, slug: `${slug}-c`, terms: true, elapsedMs: 20_000 }, ip(252), env);
    expect(third.status).toBe(429);
    await rest(`tenants?slug=in.(${slug}-b,${slug}-c)`, { method: 'DELETE' });
  });
});
