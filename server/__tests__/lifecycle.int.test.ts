import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import { ANNOUNCEMENTS, runAnnouncements, type Announcement } from '../announcements';
import { handleSignup } from '../signup';
import { runWinback } from '../winback';

// Win-back and announcements against a real (local) Supabase: a shop from the
// real signup flow, paused, and the daily runs at chosen moments; Resend mocked.
// Runs in CI's database job; skipped unless INTEGRATION_SUPABASE_URL is set.

const url = process.env.INTEGRATION_SUPABASE_URL;
const key = process.env.INTEGRATION_SERVICE_KEY;
const stamp = Date.now();
const slug = `lifecycle-${stamp}`;
const owner = `owner-${stamp}@lifecycle.test`;
const tester = `tester-${stamp}@lifecycle.test`;
const DAY = 864e5;
const env = {
  SUPABASE_URL: url ?? '',
  SUPABASE_SERVICE_ROLE_KEY: key ?? '',
  RESEND_API_KEY: 'test',
  RESEND_BASE_URL: 'https://resend.test',
  EMAIL_MARKETING_FROM_DOMAIN: 'news.vvslab.test',
  PUBLIC_ORIGIN: 'https://vvslab.test',
  LEAD_TOKEN_SECRET: 'lifecycle',
  ANNOUNCE_TEST_TO: tester,
};
const realFetch = globalThis.fetch;
type Sent = { to: string[]; subject: string };
let sent: Sent[] = [];
const to = (address: string) => sent.filter((mail) => mail.to.includes(address));

const rest = async (path: string, init: RequestInit = {}) => {
  const response = await realFetch(`${url}/rest/v1/${path}`, { ...init, headers: { apikey: key!, Authorization: `Bearer ${key}`, 'Content-Type': 'application/json', Prefer: 'return=representation', ...(init.headers ?? {}) } });
  const text = await response.text();
  return text ? JSON.parse(text) : null;
};

describe.skipIf(!url || !key)('win-back and announcements (integration)', () => {
  let tenantId = '';
  const ended = new Date(Date.now() - 2 * DAY).toISOString();

  beforeAll(async () => {
    vi.stubGlobal('fetch', async (input: string | URL | Request, init?: RequestInit) => {
      const target = typeof input === 'string' ? input : input instanceof URL ? input.href : input.url;
      if (target.startsWith('https://resend.test/')) {
        sent.push(JSON.parse(String(init?.body)) as Sent);
        return Response.json({ id: `email-${sent.length}-${stamp}` });
      }
      return realFetch(input, init);
    });
    const ip = `10.${(stamp >> 9) % 250}.${(stamp >> 2) % 250}.88`;
    expect((await handleSignup({ name: 'Lifecycle Gold', email: owner, slug, terms: true, elapsedMs: 20_000 }, ip, env)).status).toBe(200);
    const [tenant] = await rest(`tenants?slug=eq.${slug}&select=id`);
    tenantId = tenant.id;
    // The trial ended two days ago without a card, and the daily run paused it.
    await rest(`tenants?id=eq.${tenantId}`, { method: 'PATCH', body: JSON.stringify({ status: 'paused', trial_ends_at: ended }) });
  });

  afterAll(async () => {
    vi.unstubAllGlobals();
    await rest(`email_sends?email=in.(${owner},${tester})`, { method: 'DELETE' });
    await rest(`email_unsubscribes?email=eq.${owner}`, { method: 'DELETE' });
    await rest(`tenants?slug=eq.${slug}`, { method: 'DELETE' });
  });

  it('sends "paused" a week after the trial ended, once, and the last one at a month', async () => {
    sent = [];
    const since = new Date(ended).getTime();
    await runWinback(env, { now: since + 7.2 * DAY });
    await runWinback(env, { now: since + 8 * DAY });
    await runWinback(env, { now: since + 15 * DAY });
    await runWinback(env, { now: since + 30.5 * DAY });
    await runWinback(env, { now: since + 45 * DAY });
    expect(to(owner).map((mail) => mail.subject)).toEqual(['Your builder is paused', 'Should we stop emailing you?']);
  });

  it('leaves a shop paused for a failed payment alone', async () => {
    sent = [];
    await rest(`tenants?id=eq.${tenantId}`, { method: 'PATCH', body: JSON.stringify({ billing_status: 'past_due', trial_ends_at: new Date(Date.now() - 7.5 * DAY).toISOString() }) });
    await runWinback(env, { now: Date.now() });
    expect(to(owner)).toHaveLength(0);
    await rest(`tenants?id=eq.${tenantId}`, { method: 'PATCH', body: JSON.stringify({ billing_status: 'none' }) });
  });

  it('sends a test announcement only to the testers, then the reviewed one to owners once, minus opt-outs', async () => {
    sent = [];
    const draft: Announcement = { ...ANNOUNCEMENTS[0], id: `int-${stamp}`, sendAt: new Date(Date.now() - DAY).toISOString(), audience: 'test' };
    await runAnnouncements(env, { list: [draft], paceMs: 0 });
    expect(to(tester)).toHaveLength(1);
    expect(to(owner)).toHaveLength(0);

    const live: Announcement = { ...draft, audience: 'all' };
    await runAnnouncements(env, { list: [live], paceMs: 0 });
    await runAnnouncements(env, { list: [live], paceMs: 0 });
    expect(to(owner)).toHaveLength(1);
    expect(to(tester)).toHaveLength(1); // not a shop owner: only the test copy

    sent = [];
    await rest('email_unsubscribes', { method: 'POST', body: JSON.stringify({ email: owner, topic: 'news', source: 'link' }) });
    const next: Announcement = { ...live, id: `int2-${stamp}` };
    const run = await runAnnouncements(env, { list: [next], paceMs: 0 });
    expect(to(owner)).toHaveLength(0);
    expect(run.results.opted_out).toBeGreaterThanOrEqual(1);
  });
});
