import { spawn, type ChildProcess } from 'node:child_process';
import { createServer, type Server } from 'node:http';
import type { AddressInfo } from 'node:net';
import { chromium, type Browser } from 'playwright';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { VVSLAB_CONFIG } from '../src/lib/tenant/vvslab';

// End to end: the links in our signup and team-invite emails sign people in.
// Runs the real app (Vite dev server with the same /api handlers as Vercel)
// against a local Supabase, catches outgoing email with a mock Resend, and
// opens each emailed link in a fresh browser, like a person tapping it.
// Runs in CI's database job; skipped unless INTEGRATION_SUPABASE_URL is set.

const url = process.env.INTEGRATION_SUPABASE_URL;
const key = process.env.INTEGRATION_SERVICE_KEY;
const anon = process.env.INTEGRATION_ANON_KEY;
const stamp = Date.now();
const PORT = 5180 + (stamp % 500);
const origin = `http://127.0.0.1:${PORT}`;

type Mail = { from: string; to: string[]; subject: string; html: string; text: string };
const mails: Mail[] = [];
let mailServer: Server;
let app: ChildProcess;
let browser: Browser;
const tenantIds: string[] = [];

const rest = async (path: string, init: RequestInit = {}) => {
  const response = await fetch(`${url}/rest/v1/${path}`, { ...init, headers: { apikey: key!, Authorization: `Bearer ${key}`, 'Content-Type': 'application/json', Prefer: 'return=representation', ...(init.headers ?? {}) } });
  const text = await response.text();
  return text ? JSON.parse(text) : null;
};
const authAdmin = (path: string, body: unknown) =>
  fetch(`${url}/auth/v1/admin/${path}`, { method: 'POST', headers: { apikey: key!, Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' }, body: JSON.stringify(body) }).then((r) => r.json());

/** The sign-in link in the newest email to this address, as a mail client would open it. */
async function linkFor(email: string) {
  for (let i = 0; i < 50 && !mails.some((mail) => mail.to.includes(email)); i += 1) await new Promise((resolve) => setTimeout(resolve, 100));
  const mail = [...mails].reverse().find((item) => item.to.includes(email));
  const href = mail?.html.match(/href="([^"]*\/dashboard\/welcome\?[^"]*)"/)?.[1];
  if (!mail || !href) throw new Error(`no sign-in link emailed to ${email}`);
  return { mail, link: href.replace(/&amp;/g, '&') };
}

/** Opens a link in a brand-new browser profile (no session, no storage). */
async function openFresh(link: string) {
  const context = await browser.newContext();
  const page = await context.newPage();
  await page.goto(link);
  return { context, page };
}

async function waitForApp() {
  for (let i = 0; i < 120; i += 1) {
    try {
      if ((await fetch(`${origin}/dashboard`)).ok) return;
    } catch {
      // not up yet
    }
    await new Promise((resolve) => setTimeout(resolve, 500));
  }
  throw new Error('dev server did not start');
}

describe.skipIf(!url || !key || !anon)('emailed sign-in links (e2e)', () => {
  beforeAll(async () => {
    mailServer = createServer((request, response) => {
      let body = '';
      request.on('data', (chunk) => (body += chunk));
      request.on('end', () => {
        mails.push(JSON.parse(body));
        response.writeHead(200, { 'Content-Type': 'application/json' }).end(JSON.stringify({ id: `email-${mails.length}` }));
      });
    });
    await new Promise<void>((resolve) => mailServer.listen(0, '127.0.0.1', resolve));
    const mailUrl = `http://127.0.0.1:${(mailServer.address() as AddressInfo).port}`;

    app = spawn('npx', ['vite', '--port', String(PORT), '--strictPort', '--host', '127.0.0.1'], {
      env: {
        ...process.env,
        SUPABASE_URL: url,
        SUPABASE_SERVICE_ROLE_KEY: key,
        VITE_SUPABASE_URL: url,
        VITE_SUPABASE_ANON_KEY: anon,
        RESEND_API_KEY: 'test',
        RESEND_BASE_URL: mailUrl,
        PUBLIC_ORIGIN: origin,
        LEAD_TOKEN_SECRET: 'e2e',
      },
      stdio: 'ignore',
    });
    await waitForApp();
    browser = await chromium.launch();
    // Signups from this machine's address are rate limited per day; clear earlier e2e runs.
    await rest('signup_attempts?email=like.*@e2e.test', { method: 'DELETE' });
  }, 120_000);

  afterAll(async () => {
    await browser?.close();
    app?.kill();
    mailServer?.close();
    for (const id of tenantIds) await rest(`tenants?id=eq.${id}`, { method: 'DELETE' });
  });

  it('signup: the welcome email signs the new owner in and opens their shop', async () => {
    const slug = `e2e-signup-${stamp}`;
    const email = `owner-${stamp}@e2e.test`;
    const response = await fetch(`${origin}/api/signup`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: 'E2E Gold Teeth', email, slug, terms: true, elapsedMs: 20_000 }),
    });
    expect(response.status).toBe(200);
    const [tenant] = await rest(`tenants?slug=eq.${slug}&select=id`);
    tenantIds.push(tenant.id);

    const { mail, link } = await linkFor(email);
    expect(mail.from).toBe('VVS Lab <hello@vvslab.magpollo.com>');
    expect(link.startsWith(`${origin}/dashboard/welcome?token_hash=`)).toBe(true);
    expect(mail.html).not.toContain('/auth/v1/verify');

    const { context, page } = await openFresh(link);
    await page.waitForURL(`${origin}/dashboard/${slug}`, { timeout: 60_000 });
    await expect.poll(() => page.locator('.admin-header__brand').textContent(), { timeout: 30_000 }).toBe('E2E Gold Teeth');
    expect(page.url()).not.toContain('token_hash');
    expect(await rest(`members?tenant_id=eq.${tenant.id}&select=role`)).toEqual([{ role: 'owner' }]);
    await context.close();

    // The link works once.
    const again = await openFresh(link);
    await expect.poll(() => again.page.getByRole('alert').textContent(), { timeout: 30_000 }).toContain('expired or was already used');
    expect(again.page.url()).toBe(`${origin}/dashboard/welcome`);
    await again.context.close();
  }, 180_000);

  it('team invite: the invite email signs the teammate in and adds them to the shop', async () => {
    const slug = `e2e-invite-${stamp}`;
    const ownerEmail = `inviter-${stamp}@e2e.test`;
    const invitee = `staff-${stamp}@e2e.test`;
    const owner = (await authAdmin('users', { email: ownerEmail, password: 'E2e-test-pass-1!', email_confirm: true })) as { id: string };
    const [tenant] = await rest('tenants', { method: 'POST', body: JSON.stringify({ slug, name: 'E2E Invite Shop', kind: 'fixture', status: 'live' }) });
    tenantIds.push(tenant.id);
    const config = structuredClone(VVSLAB_CONFIG);
    config.brand = { ...config.brand, name: 'E2E Invite Shop' };
    await rest('tenant_configs', { method: 'POST', body: JSON.stringify({ tenant_id: tenant.id, version: 1, config, status: 'published', published_at: new Date().toISOString() }) });
    await rest(`tenants?id=eq.${tenant.id}`, { method: 'PATCH', body: JSON.stringify({ published_version: 1 }) });
    await rest('members', { method: 'POST', body: JSON.stringify({ tenant_id: tenant.id, user_id: owner.id, role: 'owner' }) });
    const session = (await (await fetch(`${url}/auth/v1/token?grant_type=password`, {
      method: 'POST',
      headers: { apikey: anon!, 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: ownerEmail, password: 'E2e-test-pass-1!' }),
    })).json()) as { access_token: string };

    const invited = await fetch(`${origin}/api/dashboard/invite`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session.access_token}` },
      body: JSON.stringify({ tenantId: tenant.id, email: invitee, role: 'staff' }),
    });
    expect(invited.status).toBe(200);

    const { mail, link } = await linkFor(invitee);
    expect(mail.from).toBe('VVS Lab <hello@vvslab.magpollo.com>');
    expect(link.startsWith(`${origin}/dashboard/welcome?token_hash=`)).toBe(true);

    const { context, page } = await openFresh(link);
    await page.waitForURL(`${origin}/dashboard/${slug}`, { timeout: 60_000 });
    await expect.poll(() => page.locator('.admin-header__brand').textContent(), { timeout: 30_000 }).toBe('E2E Invite Shop');
    expect(page.url()).not.toContain('token_hash');
    const members = (await rest(`members?tenant_id=eq.${tenant.id}&select=role`)) as { role: string }[];
    expect(members.map((member) => member.role).sort()).toEqual(['owner', 'staff']);
    await context.close();
  }, 180_000);
});
