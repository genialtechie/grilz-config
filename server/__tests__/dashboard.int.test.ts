import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import { handleDashboard } from '../dashboard';
import { slugForHost } from '../tenants';
import { VVSLAB_CONFIG } from '../../src/lib/tenant/vvslab';

// Dashboard API against a real (local) Supabase: publishing keeps plan fields,
// staff can't publish, invites stay pending until the invitee accepts, and
// members' drafts can't carry plan changes.
// Runs in CI's database job; skipped unless INTEGRATION_SUPABASE_URL is set.

const url = process.env.INTEGRATION_SUPABASE_URL;
const key = process.env.INTEGRATION_SERVICE_KEY;
const anon = process.env.INTEGRATION_ANON_KEY;
const env = { SUPABASE_URL: url ?? '', SUPABASE_SERVICE_ROLE_KEY: key ?? '', RESEND_API_KEY: 'test', RESEND_BASE_URL: 'https://resend.test', PUBLIC_ORIGIN: 'https://shop.test', VERCEL_DOMAINS_TOKEN: 'test', VERCEL_PROJECT_ID: 'prj_test' };
const realFetch = globalThis.fetch;
const sent: { to: string[]; subject: string; html: string }[] = [];
const stamp = Date.now();
const vercelCalls: string[] = [];
let dnsReady = false;
const domainName = `build-${stamp}.goldmouth.test`;
const slug = `dash-int-${stamp}`;

const admin = (path: string, body: unknown, method = 'POST') =>
  realFetch(`${url}/auth/v1/admin/${path}`, { method, headers: { apikey: key!, Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' }, body: body === undefined ? undefined : JSON.stringify(body) }).then((r) => r.json());
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
const used = async (email: string) => { const id = await user(email); await signIn(email); return id; };

let tenantId = '';
let ownerToken = '';
let staffToken = '';

describe.skipIf(!url || !key || !anon)('dashboard API (integration)', () => {
  beforeAll(async () => {
    vi.stubGlobal('fetch', async (input: string | URL | Request, init?: RequestInit) => {
      const target = typeof input === 'string' ? input : input instanceof URL ? input.href : input.url;
      if (target.startsWith('https://api.vercel.com/')) {
        vercelCalls.push(`${init?.method ?? 'GET'} ${target.split('?')[0]}`);
        if (target.includes('/config')) return Response.json({ misconfigured: dnsReady ? false : true });
        if ((init?.method ?? 'GET') === 'DELETE') return Response.json({});
        return Response.json({ name: domainName, verified: true, verification: [] });
      }
      if (target.startsWith('https://resend.test/')) {
        sent.push(JSON.parse(String(init?.body)));
        return Response.json({ id: `email-${sent.length}` });
      }
      return realFetch(input, init);
    });
    const owner = await used(`owner-${stamp}@int.test`);
    const staff = await used(`staff-${stamp}@int.test`);
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

  it('invites a new person: pending until they accept, same answer every time', async () => {
    const email = `new-${stamp}@int.test`;
    const result = await handleDashboard('invite', { tenantId, email, role: 'staff' }, ownerToken, env);
    expect(result.status).toBe(200);
    expect(result.body).toMatchObject({ invited: true });
    const mail = sent.find((item) => item.to.includes(email));
    expect(mail?.subject).not.toContain('Dash Int'); // shop names stay out of subjects
    expect(mail?.html).toContain(`https://shop.test/dashboard/welcome?token_hash=`); // our page signs them in (PKCE-safe)
    expect(mail?.html).not.toContain('/auth/v1/verify');
    expect((mail as { from?: string } | undefined)?.from).toBe('VVS Lab <hello@vvslab.magpollo.com>');
    expect(await rest(`members?tenant_id=eq.${tenantId}&select=user_id`)).toHaveLength(2);
    const [invite] = await rest(`member_invites?tenant_id=eq.${tenantId}&email=eq.${email}&select=role,accepted_at`);
    expect(invite).toMatchObject({ role: 'staff', accepted_at: null });

    // they accept by signing in with that email
    const users = (await admin('users?per_page=1000', undefined, 'GET')) as { users: { id: string; email: string }[] };
    const invitee = users.users.find((item) => item.email === email)!;
    await admin(`users/${invitee.id}`, { password: 'Int-test-pass-1!', email_confirm: true }, 'PUT');
    const token = await signIn(email);
    const accepted = await realFetch(`${url}/rest/v1/rpc/accept_member_invites`, { method: 'POST', headers: { apikey: anon!, Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' }, body: '{}' }).then((r) => r.json());
    expect(accepted).toBe(1);
    expect(await rest(`members?tenant_id=eq.${tenantId}&select=user_id`)).toHaveLength(3);

    // an existing account that has never been used isn't added, but the answer is the same
    const idle = `idle-${stamp}@int.test`;
    await user(idle);
    const quiet = await handleDashboard('invite', { tenantId, email: idle, role: 'owner' }, ownerToken, env);
    expect(quiet).toMatchObject({ status: 200, body: { invited: true } });
    expect(await rest(`member_invites?tenant_id=eq.${tenantId}&email=eq.${idle}&select=id`)).toHaveLength(0);
  });

  it("a member's draft can't change plan fields, even before publishing", async () => {
    const [liveRow] = await rest(`tenant_configs?tenant_id=eq.${tenantId}&status=eq.published&select=config,version`);
    const config = structuredClone(liveRow.config);
    config.ai.monthlyGenerations = 50000;
    config.brand.poweredBy = false;
    const response = await realFetch(`${url}/rest/v1/tenant_configs`, {
      method: 'POST',
      headers: { apikey: anon!, Authorization: `Bearer ${ownerToken}`, 'Content-Type': 'application/json', Prefer: 'return=representation' },
      body: JSON.stringify({ tenant_id: tenantId, version: 900, config, status: 'draft' }),
    });
    const [row] = (await response.json()) as { id: string; config: { ai: { monthlyGenerations: number }; brand: { poweredBy: boolean } } }[];
    expect(row.config.ai.monthlyGenerations).toBe(300);
    expect(row.config.brand.poweredBy).toBe(true);
    await rest(`tenant_configs?id=eq.${row.id}`, { method: 'DELETE' });
  });

  it("staff can't invite, and nobody can invite into a shop they're not in", async () => {
    expect((await handleDashboard('invite', { tenantId, email: `x-${stamp}@int.test`, role: 'owner' }, staffToken, env)).status).toBe(403);
    const outsider = await used(`outsider-${stamp}@int.test`);
    expect(outsider).toBeTruthy();
    const token = await signIn(`outsider-${stamp}@int.test`);
    expect((await handleDashboard('invite', { tenantId, email: `y-${stamp}@int.test`, role: 'owner' }, token, env)).status).toBe(404);
  });

  it('connects a custom domain: pending until DNS points at us, then serves the shop', async () => {
    expect((await handleDashboard('domain_add', { tenantId, domain: domainName }, staffToken, env)).status).toBe(403);
    const added = await handleDashboard('domain_add', { tenantId, domain: domainName.toUpperCase() }, ownerToken, env);
    expect(added).toMatchObject({ status: 200, body: { domain: domainName, status: 'pending' } });
    expect((await rest(`tenant_domains?domain=eq.${domainName}&select=status`))[0].status).toBe('pending'); // not live until verified
    const waiting = await handleDashboard('domain_check', { tenantId }, staffToken, env);
    expect(waiting.body).toMatchObject({ status: 'pending', problem: expect.stringContaining('DNS') });
    dnsReady = true;
    const live = await handleDashboard('domain_check', { tenantId }, ownerToken, env);
    expect(live.body).toMatchObject({ status: 'active' });
    expect(await slugForHost(`${domainName}:443`, env)).toBe(slug);
    // one domain per shop, and a domain can't be claimed twice
    expect((await handleDashboard('domain_add', { tenantId, domain: `other-${stamp}.goldmouth.test` }, ownerToken, env)).status).toBe(409);
    const removed = await handleDashboard('domain_remove', { tenantId }, ownerToken, env);
    expect(removed.body).toMatchObject({ removed: true });
    expect(vercelCalls.some((call) => call.startsWith('DELETE https://api.vercel.com/v9/projects/prj_test/domains/'))).toBe(true);
  });

  it('stats report analytics as unavailable without PostHog', async () => {
    const result = await handleDashboard('stats', { tenantId, days: 7 }, ownerToken, env);
    expect(result).toMatchObject({ status: 200, body: { available: false } });
  });
});
