import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import { handleDashboard } from '../dashboard';
import { VVSLAB_CONFIG } from '../../src/lib/tenant/vvslab';

// Dashboard API against a real (local) Supabase: publishing keeps plan fields,
// staff can't publish, invites create the account and the membership.
// Runs in CI's database job; skipped unless INTEGRATION_SUPABASE_URL is set.

const url = process.env.INTEGRATION_SUPABASE_URL;
const key = process.env.INTEGRATION_SERVICE_KEY;
const anon = process.env.INTEGRATION_ANON_KEY;
const env = { SUPABASE_URL: url ?? '', SUPABASE_SERVICE_ROLE_KEY: key ?? '', RESEND_API_KEY: 'test', RESEND_BASE_URL: 'https://resend.test', PUBLIC_ORIGIN: 'https://shop.test' };
const realFetch = globalThis.fetch;
const sent: { to: string[]; subject: string; html: string }[] = [];
const stamp = Date.now();
const slug = `dash-int-${stamp}`;

const admin = (path: string, body: unknown, method = 'POST') =>
  realFetch(`${url}/auth/v1/admin/${path}`, { method, headers: { apikey: key!, Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' }, body: JSON.stringify(body) }).then((r) => r.json());
const rest = async (path: string, init: RequestInit = {}) => {
  const response = await realFetch(`${url}/rest/v1/${path}`, { ...init, headers: { apikey: key!, Authorization: `Bearer ${key}`, 'Content-Type': 'application/json', Prefer: 'return=representation', ...(init.headers ?? {}) } });
  const text = await response.text();
  return text ? JSON.parse(text) : null;
};
const signIn = async (email: string) => {
  const response = await realFetch(`${url}/auth/v1/token?grant_type=password`, { method: 'POST', headers: { apikey: anon!, 'Content-Type': 'application/json' }, body: JSON.stringify({ email, password: 'Int-test-pass-1!' }) });
  return ((await response.json()) as { access_token: string }).access_token;
};
const user = async (email: string) => ((await admin('users', { email, password: 'Int-test-pass-1!', email_confirm: true })) as { id: string }).id;

let tenantId = '';
let ownerToken = '';
let staffToken = '';

describe.skipIf(!url || !key || !anon)('dashboard API (integration)', () => {
  beforeAll(async () => {
    vi.stubGlobal('fetch', async (input: string | URL | Request, init?: RequestInit) => {
      const target = typeof input === 'string' ? input : input instanceof URL ? input.href : input.url;
      if (target.startsWith('https://resend.test/')) {
        sent.push(JSON.parse(String(init?.body)));
        return Response.json({ id: `email-${sent.length}` });
      }
      return realFetch(input, init);
    });
    const owner = await user(`owner-${stamp}@int.test`);
    const staff = await user(`staff-${stamp}@int.test`);
    const [tenant] = await rest('tenants', { method: 'POST', body: JSON.stringify({ slug, name: 'Dash Int', kind: 'fixture', status: 'live' }) });
    tenantId = tenant.id;
    const live = structuredClone(VVSLAB_CONFIG);
    live.brand = { ...live.brand, name: 'Dash Int', poweredBy: true };
    live.ai.monthlyGenerations = 300;
    live.deposit = { mode: 'none', rule: { type: 'fixed', amount: 0 } };
    await rest('tenant_configs', { method: 'POST', body: JSON.stringify({ tenant_id: tenantId, version: 1, config: live, status: 'published', published_at: new Date().toISOString() }) });
    await rest(`tenants?id=eq.${tenantId}`, { method: 'PATCH', body: JSON.stringify({ published_version: 1 }) });
    await rest('members', { method: 'POST', body: JSON.stringify([{ tenant_id: tenantId, user_id: owner, role: 'owner' }, { tenant_id: tenantId, user_id: staff, role: 'staff' }]) });
    ownerToken = await signIn(`owner-${stamp}@int.test`);
    staffToken = await signIn(`staff-${stamp}@int.test`);
  });

  afterAll(async () => {
    vi.unstubAllGlobals();
    await rest(`tenants?id=eq.${tenantId}`, { method: 'DELETE' });
  });

  const draft = async (patch: (config: typeof VVSLAB_CONFIG) => void) => {
    const [liveRow] = await rest(`tenant_configs?tenant_id=eq.${tenantId}&status=eq.published&select=config,version`);
    const config = structuredClone(liveRow.config);
    patch(config);
    const versions = await rest(`tenant_configs?tenant_id=eq.${tenantId}&select=version`);
    const version = Math.max(...versions.map((row: { version: number }) => row.version)) + 1;
    const [row] = await rest('tenant_configs', { method: 'POST', body: JSON.stringify({ tenant_id: tenantId, version, config, status: 'draft' }) });
    return row.id as string;
  };

  it('publishes an owner draft, keeping the plan allowance and footer', async () => {
    const id = await draft((config) => {
      config.pricing.metalPerTooth.yellow = 175;
      config.ai.monthlyGenerations = 99999;
      config.brand.poweredBy = false;
    });
    const result = await handleDashboard('publish', { configId: id }, ownerToken, env);
    expect(result.status).toBe(200);
    expect(result.body).toMatchObject({ reset: ['ai.monthlyGenerations', 'brand.poweredBy'], live: true });
    const [row] = await rest(`tenant_configs?id=eq.${id}&select=status,config`);
    expect(row.status).toBe('published');
    expect(row.config.pricing.metalPerTooth.yellow).toBe(175);
    expect(row.config.ai.monthlyGenerations).toBe(300);
    expect(row.config.brand.poweredBy).toBe(true);
    const [tenant] = await rest(`tenants?id=eq.${tenantId}&select=published_version`);
    expect(tenant.published_version).toBeGreaterThan(1);
  });

  it("won't publish for staff, or an invalid config", async () => {
    const id = await draft((config) => { config.pricing.base = 10; });
    expect((await handleDashboard('publish', { configId: id }, staffToken, env)).status).toBe(403);
    const bad = await draft((config) => { (config.brand as { accent: string }).accent = 'red'; });
    const result = await handleDashboard('publish', { configId: bad }, ownerToken, env);
    expect(result.status).toBe(422);
  });

  it('invites a new person: account created, membership added, email sent', async () => {
    const email = `new-${stamp}@int.test`;
    const result = await handleDashboard('invite', { tenantId, email, role: 'staff' }, ownerToken, env);
    expect(result.status).toBe(200);
    expect(result.body).toMatchObject({ added: true, emailed: true });
    const mail = sent.find((item) => item.to.includes(email));
    expect(mail?.subject).toContain('Dash Int');
    expect(mail?.html).toContain('/auth/v1/verify');
    const members = await rest(`members?tenant_id=eq.${tenantId}&select=role,user_id`);
    expect(members).toHaveLength(3);
    // inviting again is a no-op
    const again = await handleDashboard('invite', { tenantId, email, role: 'staff' }, ownerToken, env);
    expect(again.body).toMatchObject({ added: false });
  });

  it("staff can't invite, and nobody can invite into a shop they're not in", async () => {
    expect((await handleDashboard('invite', { tenantId, email: `x-${stamp}@int.test`, role: 'owner' }, staffToken, env)).status).toBe(403);
    const outsider = await user(`outsider-${stamp}@int.test`);
    expect(outsider).toBeTruthy();
    const token = await signIn(`outsider-${stamp}@int.test`);
    expect((await handleDashboard('invite', { tenantId, email: `y-${stamp}@int.test`, role: 'owner' }, token, env)).status).toBe(404);
  });

  it('stats report analytics as unavailable without PostHog', async () => {
    const result = await handleDashboard('stats', { tenantId, days: 7 }, ownerToken, env);
    expect(result).toMatchObject({ status: 200, body: { available: false } });
  });
});
