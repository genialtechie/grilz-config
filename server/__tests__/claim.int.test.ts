import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import { claimStatus, handleClaim } from '../claims';
import { handleDashboard } from '../dashboard';
import { TRIAL_DAYS } from '../../src/lib/trial';
import { VVSLAB_CONFIG } from '../../src/lib/tenant/vvslab';

// Claim links against a real (local) Supabase: VVS Lab builds a shop with no
// owner, makes a claim link, and the jeweler claims it with their email and is
// signed in on that phone.

const url = process.env.INTEGRATION_SUPABASE_URL;
const key = process.env.INTEGRATION_SERVICE_KEY;
const anon = process.env.INTEGRATION_ANON_KEY;
const env = { SUPABASE_URL: url ?? '', SUPABASE_SERVICE_ROLE_KEY: key ?? '', RESEND_API_KEY: 'test', RESEND_BASE_URL: 'https://resend.test', PUBLIC_ORIGIN: 'https://shop.test', LEAD_TOKEN_SECRET: 'salt' };
const realFetch = globalThis.fetch;
const sent: { to: string[]; subject: string; html: string }[] = [];
const stamp = Date.now();
const ip = (n: number) => `10.${Math.floor(stamp / 1000) % 250}.${Math.floor(stamp / 250_000) % 250}.${n}`;
const jeweler = `jeweler-${stamp}@claim.test`;
const adminEmail = `admin-${stamp}@claim.test`;
const slugs = ['a', 'b', 'c', 'd'].map((suffix) => `claim-${stamp}-${suffix}`);

const rest = async (path: string, init: RequestInit = {}, token = key!) => {
  const response = await realFetch(`${url}/rest/v1/${path}`, { ...init, headers: { apikey: token === key ? key! : anon!, Authorization: `Bearer ${token}`, 'Content-Type': 'application/json', Prefer: 'return=representation', ...(init.headers ?? {}) } });
  const text = await response.text();
  return text ? JSON.parse(text) : null;
};
const authAdmin = (path: string, body: unknown, method = 'POST') =>
  realFetch(`${url}/auth/v1/admin/${path}`, { method, headers: { apikey: key!, Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' }, body: body === undefined ? undefined : JSON.stringify(body) }).then((r) => r.json());
const password = async (email: string) =>
  ((await (await realFetch(`${url}/auth/v1/token?grant_type=password`, { method: 'POST', headers: { apikey: anon!, 'Content-Type': 'application/json' }, body: JSON.stringify({ email, password: 'Int-test-pass-1!' }) })).json()) as { access_token: string }).access_token;

/** A shop as VVS Lab builds it in Admin → New shop: a draft config, no owner. */
const buildShop = async (slug: string) => {
  const [tenant] = await rest('tenants', { method: 'POST', body: JSON.stringify({ slug, name: `Claim ${slug.slice(-1).toUpperCase()}`, kind: 'shop', status: 'draft' }) });
  const config = { ...structuredClone(VVSLAB_CONFIG), brand: { ...VVSLAB_CONFIG.brand, name: `Claim ${slug.slice(-1).toUpperCase()}` }, leads: { email: [], sms: [] } };
  await rest('tenant_configs', { method: 'POST', body: JSON.stringify({ tenant_id: tenant.id, version: 1, config, status: 'draft' }) });
  return tenant.id as string;
};
const tokenOf = (link: string) => link.split('/claim/')[1];

describe.skipIf(!url || !key || !anon)('claim links (integration)', () => {
  let adminToken = '';
  const tenantIds: string[] = [];

  beforeAll(async () => {
    vi.stubGlobal('fetch', async (input: string | URL | Request, init?: RequestInit) => {
      const target = typeof input === 'string' ? input : input instanceof URL ? input.href : input.url;
      if (target.startsWith('https://resend.test/')) {
        sent.push(JSON.parse(String(init?.body)));
        return Response.json({ id: `email-${sent.length}` });
      }
      return realFetch(input, init);
    });
    const admin = (await authAdmin('users', { email: adminEmail, password: 'Int-test-pass-1!', email_confirm: true })) as { id: string };
    await rest('platform_admins', { method: 'POST', body: JSON.stringify({ user_id: admin.id }) });
    adminToken = await password(adminEmail);
    for (const slug of slugs) tenantIds.push(await buildShop(slug));
  });
  afterAll(async () => {
    vi.unstubAllGlobals();
    await rest(`tenants?slug=in.(${slugs.join(',')})`, { method: 'DELETE' });
    const users = (await authAdmin('users?per_page=1000', undefined, 'GET')) as { users: { id: string; email: string }[] };
    for (const user of users.users.filter((item) => item.email?.endsWith('@claim.test') && item.email.includes(String(stamp)))) await authAdmin(`users/${user.id}`, undefined, 'DELETE');
  });

  it('builds ahead, claims with an email, and signs the jeweler in on that phone', async () => {
    const made = await handleDashboard('claim_create', { tenantId: tenantIds[0] }, adminToken, env);
    expect(made.status).toBe(200);
    const link = (made.body as { url: string }).url;
    expect(link).toMatch(/^https:\/\/shop\.test\/claim\/[A-Za-z0-9_-]{32}$/);
    // Only the hash is stored.
    const [row] = await rest(`claim_links?tenant_id=eq.${tenantIds[0]}&select=token_hash`);
    expect(row.token_hash).not.toContain(tokenOf(link));

    const status = await claimStatus(tokenOf(link), env);
    expect(status).toMatchObject({ status: 200, body: { state: 'open', shop: { name: 'Claim A', slug: slugs[0] } } });

    const claimed = await handleClaim({ claim: tokenOf(link), email: jeweler, elapsedMs: 10_000 }, ip(1), env);
    expect(claimed.status).toBe(200);
    const signIn = (claimed.body as { signIn: string }).signIn;
    expect(signIn).toContain(`https://shop.test/dashboard/welcome?token_hash=`);
    expect(signIn).toContain(`shop=${slugs[0]}`);

    // The welcome page signs them in with that token (verifyOtp), on this phone.
    const tokenHash = new URL(signIn).searchParams.get('token_hash');
    const type = new URL(signIn).searchParams.get('type');
    const session = (await (await realFetch(`${url}/auth/v1/verify`, { method: 'POST', headers: { apikey: anon!, 'Content-Type': 'application/json' }, body: JSON.stringify({ token_hash: tokenHash, type }) })).json()) as { access_token?: string; user?: { email: string } };
    expect(session.access_token).toBeTruthy();
    expect(session.user?.email).toBe(jeweler);

    // As the jeweler: they own the shop.
    const mine = await rest(`members?select=role,tenants(slug)`, {}, session.access_token);
    expect(mine).toEqual([{ role: 'owner', tenants: { slug: slugs[0] } }]);
    const [tenant] = await rest(`tenants?id=eq.${tenantIds[0]}&select=plan,status,trial_ends_at,published_version`);
    expect(tenant.plan).toBe('trial');
    expect(tenant.status).toBe('live'); // live from the moment it's claimed (MAG-90)
    const days = (Date.parse(tenant.trial_ends_at) - Date.now()) / 864e5;
    expect(days).toBeGreaterThan(TRIAL_DAYS - 0.1);
    expect(days).toBeLessThan(TRIAL_DAYS + 0.1);
    // Published, with their email as the lead inbox.
    const [config] = await rest(`tenant_configs?tenant_id=eq.${tenantIds[0]}&status=eq.published&select=version,config`);
    expect(config.version).toBe(tenant.published_version);
    expect(config.config.leads.email).toEqual([jeweler]);
    // The welcome email went to them and links to the dashboard (they're already signed in).
    const welcome = sent.find((mail) => mail.to.includes(jeweler));
    expect(welcome?.subject).toBe('Claim A is yours on VVS Lab');
    expect(welcome?.html).toContain(`https://shop.test/dashboard/${slugs[0]}`);
    // Logged for admin: who and when.
    const [log] = await rest(`claim_links?tenant_id=eq.${tenantIds[0]}&select=claimed_at,claimed_email`, {}, adminToken);
    expect(log.claimed_email).toBe(jeweler);
    expect(log.claimed_at).toBeTruthy();

    // Spent: the same link now says "already claimed", and an owned shop gets no new link.
    expect(await handleClaim({ claim: tokenOf(link), email: `other-${stamp}@claim.test`, elapsedMs: 10_000 }, ip(2), env)).toMatchObject({ status: 409, body: { error: 'claimed' } });
    expect(await claimStatus(tokenOf(link), env)).toMatchObject({ body: { state: 'claimed' } });
    expect(await handleDashboard('claim_create', { tenantId: tenantIds[0] }, adminToken, env)).toMatchObject({ status: 409, body: { error: 'owned' } });
  });

  it('refuses expired and revoked links, and only admins make them', async () => {
    const expiredLink = (await handleDashboard('claim_create', { tenantId: tenantIds[1] }, adminToken, env)).body as { id: string; url: string };
    await rest(`claim_links?id=eq.${expiredLink.id}`, { method: 'PATCH', body: JSON.stringify({ expires_at: new Date(Date.now() - 1000).toISOString() }) });
    expect(await handleClaim({ claim: tokenOf(expiredLink.url), email: `late-${stamp}@claim.test`, elapsedMs: 10_000 }, ip(3), env)).toMatchObject({ status: 410, body: { error: 'expired' } });

    const revokedLink = (await handleDashboard('claim_create', { tenantId: tenantIds[2] }, adminToken, env)).body as { id: string; url: string };
    expect((await handleDashboard('claim_revoke', { tenantId: tenantIds[2], linkId: revokedLink.id }, adminToken, env)).status).toBe(200);
    expect(await handleClaim({ claim: tokenOf(revokedLink.url), email: `late-${stamp}@claim.test`, elapsedMs: 10_000 }, ip(4), env)).toMatchObject({ status: 410, body: { error: 'revoked' } });
    // A new link cancels the old one.
    const first = (await handleDashboard('claim_create', { tenantId: tenantIds[2] }, adminToken, env)).body as { url: string };
    await handleDashboard('claim_create', { tenantId: tenantIds[2] }, adminToken, env);
    expect(await claimStatus(tokenOf(first.url), env)).toMatchObject({ body: { state: 'revoked' } });
    // Nobody can read links without being an admin; the jeweler can't make one.
    const jewelerToken = await (async () => {
      const users = (await authAdmin('users?per_page=1000', undefined, 'GET')) as { users: { id: string; email: string }[] };
      await authAdmin(`users/${users.users.find((user) => user.email === jeweler)!.id}`, { password: 'Int-test-pass-1!' }, 'PUT');
      return password(jeweler);
    })();
    expect(await rest(`claim_links?select=id`, {}, jewelerToken)).toEqual([]);
    expect((await handleDashboard('claim_create', { tenantId: tenantIds[3] }, jewelerToken, env)).status).toBe(403);
    expect(await handleClaim({ claim: 'x'.repeat(32), email: jeweler, elapsedMs: 10_000 }, ip(5), env)).toMatchObject({ status: 404, body: { error: 'invalid' } });
  });

  it('adds the shop to an existing account and emails the sign-in instead of signing in here', async () => {
    const link = ((await handleDashboard('claim_create', { tenantId: tenantIds[3] }, adminToken, env)).body as { url: string }).url;
    const claimed = await handleClaim({ claim: tokenOf(link), email: jeweler, elapsedMs: 10_000 }, ip(6), env);
    expect(claimed.status).toBe(200);
    expect(claimed.body).not.toHaveProperty('signIn');
    expect((claimed.body as { message: string }).message).toContain(`check ${jeweler}`);
    const owners = await rest(`members?tenant_id=eq.${tenantIds[3]}&select=role,user_id`);
    expect(owners).toHaveLength(1);
    expect(owners[0].role).toBe('owner');
    const welcome = sent.filter((mail) => mail.to.includes(jeweler)).at(-1);
    expect(welcome?.subject).toBe('Claim D is yours on VVS Lab');
    expect(welcome?.html).toContain('https://shop.test/dashboard/welcome?token_hash=');
  });
});
