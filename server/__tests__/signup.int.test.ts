import { execFileSync } from 'node:child_process';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import { handleDashboard } from '../dashboard';
import { handleSignup, pickSlug, TRIAL_DAYS, TRIAL_GENERATIONS } from '../signup';
import { forgetTenant, getPublishedTenant } from '../tenants';

// Self-serve signup against a real (local) Supabase (MAG-90, MAG-91): three
// fields, the link from the Instagram handle, the shop live on the starting
// prices with deposits off, the new owner signed in on the spot with the
// email confirmed later by the welcome email's link or 6-digit code. Until
// then payouts, team invites and custom domains are locked.

const url = process.env.INTEGRATION_SUPABASE_URL;
const key = process.env.INTEGRATION_SERVICE_KEY;
const anon = process.env.INTEGRATION_ANON_KEY;
// The local database itself, to age a code past its hour.
const dbUrl = process.env.INTEGRATION_DB_URL;
const sql = (statement: string) => execFileSync('psql', [dbUrl!, '-v', 'ON_ERROR_STOP=1', '-qc', statement]);
const env = { SUPABASE_URL: url ?? '', SUPABASE_SERVICE_ROLE_KEY: key ?? '', RESEND_API_KEY: 'test', RESEND_BASE_URL: 'https://resend.test', PUBLIC_ORIGIN: 'https://shop.test', LEAD_TOKEN_SECRET: 'salt' };
const realFetch = globalThis.fetch;
const sent: { to: string[]; subject: string; html: string }[] = [];
const stamp = Date.now();
// A fresh test address block per run, so reruns on the same day don't hit the per-IP limit.
const ip = (n: number) => `10.${Math.floor(stamp / 1000) % 250}.${Math.floor(stamp / 250_000) % 250}.${n}`;
const handle = `gold.mouth_${stamp}`;
const slug = `gold-mouth-${stamp}`;
const email = `owner-${stamp}@signup.test`;

const rest = async (path: string, init: RequestInit = {}) => {
  const response = await realFetch(`${url}/rest/v1/${path}`, { ...init, headers: { apikey: key!, Authorization: `Bearer ${key}`, 'Content-Type': 'application/json', Prefer: 'return=representation', ...(init.headers ?? {}) } });
  const text = await response.text();
  return text ? JSON.parse(text) : null;
};
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
    await rest(`tenants?slug=like.*${stamp}*`, { method: 'DELETE' });
  });

  const asUser = (token: string) => (path: string) => realFetch(`${url}/rest/v1/${path}`, { headers: { apikey: anon!, Authorization: `Bearer ${token}` } }).then((r) => r.json());
  const verifyCode = (code: string) =>
    realFetch(`${url}/auth/v1/verify`, { method: 'POST', headers: { apikey: anon!, 'Content-Type': 'application/json' }, body: JSON.stringify({ type: 'email', email, token: code }) }).then(async (r) => ({ status: r.status, body: (await r.json()) as { access_token?: string } }));
  const codeIn = (mail: { html: string; text?: string } | undefined) => (mail as { text?: string } | undefined)?.text?.match(/enter this code: (\d{6})/)?.[1];
  let device = '';

  it('three fields: a live shop on the starting prices, deposits off, and the owner signed in right away', async () => {
    const result = await handleSignup({ name: 'Gold Mouth ATL', email, instagram: `@${handle}`, elapsedMs: 20_000 }, ip(10), env);
    expect(result.status).toBe(200);
    const reply = result.body as { ok: boolean; slug: string; session?: { access_token: string; refresh_token: string } };
    expect(reply.slug).toBe(slug); // from the handle
    expect(reply.session?.access_token).toBeTruthy();
    device = reply.session!.access_token;

    const [tenant] = await rest(`tenants?slug=eq.${slug}&select=id,status,plan,created_via,trial_ends_at,published_version`);
    expect(tenant).toMatchObject({ status: 'live', plan: 'trial', created_via: 'signup', published_version: 1 });
    const days = (new Date(tenant.trial_ends_at).getTime() - Date.now()) / 864e5;
    expect(days).toBeGreaterThan(TRIAL_DAYS - 0.1);
    const [config] = await rest(`tenant_configs?tenant_id=eq.${tenant.id}&status=eq.published&select=config`);
    expect(config.config.ai.monthlyGenerations).toBe(TRIAL_GENERATIONS);
    expect(config.config.leads.email).toEqual([email]);
    expect(config.config.brand.instagram).toBe(handle);
    expect(config.config.pricing.source).toBe('default');
    expect(config.config.deposit.mode).toBe('none');
    const builder = await getPublishedTenant(slug, env);
    expect(builder.ok && builder.tenant.status).toBe('live');

    // Signed in: joining the shop works with the session they were handed.
    const accepted = await realFetch(`${url}/rest/v1/rpc/accept_member_invites`, { method: 'POST', headers: { apikey: anon!, Authorization: `Bearer ${device}`, 'Content-Type': 'application/json' }, body: '{}' }).then((r) => r.json());
    expect(accepted).toBe(1);
    expect(await asUser(device)(`members?select=role,tenants(slug)`)).toEqual([{ role: 'owner', tenants: { slug } }]);

    // The welcome email links to their shop and carries a 6-digit code.
    const welcome = sent.find((mail) => mail.to.includes(email)) as { html: string; text: string; from?: string } | undefined;
    expect(welcome?.html).toContain(`https://shop.test/dashboard/welcome?token_hash=`);
    expect(welcome?.from).toBe('VVS Lab <hello@vvslab.magpollo.com>');
    expect(codeIn(welcome)).toMatch(/^\d{6}$/);
  });

  it('keeps payouts, team invites and custom domains locked until the email is confirmed', async () => {
    const [tenant] = await rest(`tenants?slug=eq.${slug}&select=id`);
    expect(await handleDashboard('email_status', {}, device, env)).toMatchObject({ status: 200, body: { confirmed: false } });
    expect(await handleDashboard('invite', { tenantId: tenant.id, email: `staff-${stamp}@signup.test`, role: 'staff' }, device, env)).toMatchObject({ status: 403, body: { error: 'confirm_email' } });
    expect(await handleDashboard('domain_add', { tenantId: tenant.id, domain: 'build.example.com' }, device, env)).toMatchObject({ status: 403, body: { error: 'confirm_email' } });
    expect(await handleDashboard('connect_onboard', { tenantId: tenant.id }, device, env)).toMatchObject({ status: 403, body: { error: 'confirm_email' } });
    // Another shop's team invite to this address waits: whoever holds this session may not own the email.
    const [other] = await rest('tenants', { method: 'POST', body: JSON.stringify({ slug: `other-${stamp}`, name: 'Other Shop', kind: 'fixture', status: 'draft' }) });
    await rest('member_invites', { method: 'POST', body: JSON.stringify({ tenant_id: other.id, email, role: 'staff' }) });
    const accept = () => realFetch(`${url}/rest/v1/rpc/accept_member_invites`, { method: 'POST', headers: { apikey: anon!, Authorization: `Bearer ${device}`, 'Content-Type': 'application/json' }, body: '{}' }).then((r) => r.json());
    expect(await accept()).toBe(0);
    expect(await rest(`members?tenant_id=eq.${other.id}&select=role`)).toEqual([]);
    // Pausing and switching back on aren't locked.
    await forgetTenant(slug);
    expect(await handleDashboard('pause', { tenantId: tenant.id }, device, env)).toMatchObject({ status: 200, body: { status: 'paused' } });
    expect(await handleDashboard('go_live', { tenantId: tenant.id }, device, env)).toMatchObject({ status: 200, body: { status: 'live' } });
  });

  it('confirms with the code: a wrong, expired or reused code does nothing', async () => {
    expect((await verifyCode('000000')).status).toBe(403);
    // Resend: a fresh code (the welcome one is replaced), not more than once a minute.
    const resent = await handleDashboard('email_resend', { shop: slug }, device, env);
    expect(resent).toMatchObject({ status: 200, body: { sent: true } });
    expect((await handleDashboard('email_resend', { shop: slug }, device, env)).status).toBe(429);
    const confirm = sent.filter((mail) => mail.to.includes(email)).at(-1) as { subject: string; html: string; text: string };
    const code = codeIn(confirm)!;
    expect(confirm.subject).toBe(`${code} is your VVS Lab code`);
    expect(confirm.html).toContain('https://shop.test/dashboard/welcome?token_hash=');
    // Expired: the code sent more than an hour ago.
    if (dbUrl) {
      sql(`update auth.users set recovery_sent_at = now() - interval '61 minutes' where email = '${email}'`);
      expect((await verifyCode(code)).status).toBe(403);
      sql(`update auth.users set recovery_sent_at = now() where email = '${email}'`);
    }
    const right = await verifyCode(code);
    expect(right.status).toBe(200);
    expect((await verifyCode(code)).status).toBe(403); // reused
    // A session from the email (this one) confirms it; the locks open, and the
    // first session ends (if it wasn't the owner's, they're out).
    const fromEmail = right.body.access_token!;
    expect(await handleDashboard('email_status', {}, fromEmail, env)).toMatchObject({ body: { confirmed: true } });
    expect(await handleDashboard('email_status', {}, device, env)).toMatchObject({ status: 401 });
    const [tenant] = await rest(`tenants?slug=eq.${slug}&select=id`);
    const invite = await handleDashboard('invite', { tenantId: tenant.id, email: `staff-${stamp}@signup.test`, role: 'staff' }, fromEmail, env);
    expect(invite.body).not.toMatchObject({ error: 'confirm_email' });
    // Confirmed: other shops' invites can be accepted now.
    const joined = await realFetch(`${url}/rest/v1/rpc/accept_member_invites`, { method: 'POST', headers: { apikey: anon!, Authorization: `Bearer ${fromEmail}`, 'Content-Type': 'application/json' }, body: '{}' }).then((r) => r.json());
    expect(joined).toBe(1);
  });

  it("signs an existing account in by email only, and finds a free link when the handle's is taken", async () => {
    const again = await handleSignup({ name: `Gold Mouth ${stamp}`, email, instagram: handle, elapsedMs: 20_000 }, ip(11), env);
    const reply = again.body as { slug: string; session?: unknown; message?: string };
    expect(again.status).toBe(200);
    expect(reply.session).toBeUndefined();
    expect(reply.message).toContain(email);
    expect(reply.slug).toBe(`${slug}-2`);
  });

  it('signs out a never-confirmed account before a second signup adds a shop to it', async () => {
    const squatted = `squat-${stamp}@signup.test`;
    const first = await handleSignup({ name: `Squat ${stamp}`, email: squatted, elapsedMs: 20_000 }, ip(20), env);
    const held = (first.body as { session: { access_token: string } }).session.access_token;
    expect(await handleDashboard('email_status', {}, held, env)).toMatchObject({ status: 200, body: { confirmed: false } });
    const second = await handleSignup({ name: `Real ${stamp}`, email: squatted, elapsedMs: 20_000 }, ip(21), env);
    expect(second.body).toMatchObject({ ok: true, message: expect.stringContaining(squatted) });
    expect((second.body as { session?: unknown }).session).toBeUndefined();
    expect(await handleDashboard('email_status', {}, held, env)).toMatchObject({ status: 401 });
  });

  it("won't take a chosen link twice, and rate-limits one address", async () => {
    const copy = await handleSignup({ name: 'Copycat', email: `other-${stamp}@signup.test`, slug, elapsedMs: 20_000 }, ip(250), env);
    expect(copy.status).toBe(409);
    await handleSignup({ name: `Third ${stamp}`, email, elapsedMs: 20_000 }, ip(251), env);
    const fourth = await handleSignup({ name: `Fourth ${stamp}`, email, elapsedMs: 20_000 }, ip(252), env);
    expect(fourth.status).toBe(429);
  });
});

describe('the link name', () => {
  const free = (taken: string[]) => async (slug: string) => taken.includes(slug);
  it('comes from the handle, then the name, then -2…-9, then a short random ending', async () => {
    expect(await pickSlug('Gold Mouth', 'gold.mouth_atl', free([]))).toBe('gold-mouth-atl');
    expect(await pickSlug('Gold Mouth', '', free([]))).toBe('gold-mouth');
    expect(await pickSlug('Gold Mouth', 'gold.mouth_atl', free(['gold-mouth-atl']))).toBe('gold-mouth');
    expect(await pickSlug('Gold Mouth', 'gold.mouth_atl', free(['gold-mouth-atl', 'gold-mouth']))).toBe('gold-mouth-atl-2');
    const everything = ['gold-mouth-atl', 'gold-mouth', ...Array.from({ length: 8 }, (_, i) => `gold-mouth-atl-${i + 2}`)];
    expect(await pickSlug('Gold Mouth', 'gold.mouth_atl', free(everything))).toMatch(/^gold-mouth-atl-[0-9a-f]{6}$/);
    // A reserved or too-short handle falls back to the name.
    expect(await pickSlug('Ice Box Jewelers', 'vvs', free([]))).toBe('ice-box-jewelers');
  });
});
