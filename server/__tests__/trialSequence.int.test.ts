import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import { handleSignup } from '../signup';
import { runTrialSequence } from '../trialSequence';

// The trial sequence against a real (local) Supabase: a shop made by the real
// signup flow, the daily run at chosen moments in its trial, Resend mocked.
// Runs in CI's database job; skipped unless INTEGRATION_SUPABASE_URL is set.

const url = process.env.INTEGRATION_SUPABASE_URL;
const key = process.env.INTEGRATION_SERVICE_KEY;
const stamp = Date.now();
const slug = `trial-seq-${stamp}`;
const owner = `owner-${stamp}@trial.test`;
const DAY = 864e5;
const env = {
  SUPABASE_URL: url ?? '',
  SUPABASE_SERVICE_ROLE_KEY: key ?? '',
  RESEND_API_KEY: 'test',
  RESEND_BASE_URL: 'https://resend.test',
  EMAIL_MARKETING_FROM_DOMAIN: 'news.vvslab.test',
  PUBLIC_ORIGIN: 'https://vvslab.test',
  LEAD_TOKEN_SECRET: 'trial-seq',
  MARKETING_REPLY_TO: 'team@vvslab.test',
};
const realFetch = globalThis.fetch;
type Sent = { from: string; to: string[]; subject: string; reply_to?: string[]; headers?: Record<string, string> };
let sent: Sent[] = [];
const mine = () => sent.filter((mail) => mail.to.includes(owner));

const rest = async (path: string, init: RequestInit = {}) => {
  const response = await realFetch(`${url}/rest/v1/${path}`, { ...init, headers: { apikey: key!, Authorization: `Bearer ${key}`, 'Content-Type': 'application/json', Prefer: 'return=representation', ...(init.headers ?? {}) } });
  const text = await response.text();
  return text ? JSON.parse(text) : null;
};

describe.skipIf(!url || !key)('trial sequence (integration)', () => {
  let tenantId = '';
  let start = 0;
  const at = (days: number) => runTrialSequence(env, { now: start + days * DAY });

  beforeAll(async () => {
    vi.stubGlobal('fetch', async (input: string | URL | Request, init?: RequestInit) => {
      const target = typeof input === 'string' ? input : input instanceof URL ? input.href : input.url;
      if (target.startsWith('https://resend.test/')) {
        sent.push(JSON.parse(String(init?.body)) as Sent);
        return Response.json({ id: `email-${sent.length}-${stamp}` });
      }
      return realFetch(input, init);
    });
    const ip = `10.${(stamp >> 8) % 250}.${stamp % 250}.77`;
    const result = await handleSignup({ name: 'Trial Seq Gold', email: owner, slug, terms: true, elapsedMs: 20_000 }, ip, env);
    expect(result.status).toBe(200);
    const [tenant] = await rest(`tenants?slug=eq.${slug}&select=id,trial_ends_at`);
    tenantId = tenant.id;
    start = new Date(tenant.trial_ends_at).getTime() - 14 * DAY;
  });

  afterAll(async () => {
    vi.unstubAllGlobals();
    await rest(`email_sends?tenant_id=eq.${tenantId}`, { method: 'DELETE' });
    await rest(`email_unsubscribes?email=eq.${owner}`, { method: 'DELETE' });
    await rest(`tenants?slug=eq.${slug}`, { method: 'DELETE' });
  });

  it('sends day 1 once, from the marketing domain, with a working reply-to', async () => {
    sent = [];
    await at(1.2);
    await at(1.5); // the same day again: nothing new
    expect(mine()).toHaveLength(1);
    // New shops start live on the starting prices (MAG-90): day 1 asks for their prices.
    expect(mine()[0]).toMatchObject({ from: 'Karat from VVS Lab <hello@news.vvslab.test>', subject: 'Your builder is live. Are those your prices?', reply_to: ['team@vvslab.test'] });
    expect(mine()[0].headers?.['List-Unsubscribe-Post']).toBe('List-Unsubscribe=One-Click');
  });

  it('follows what the shop does: live on day 3 gets the share email; Stripe connected skips day 7', async () => {
    sent = [];
    await rest(`tenants?id=eq.${tenantId}`, { method: 'PATCH', body: JSON.stringify({ status: 'live', stripe_charges_enabled: true }) });
    await at(3.2);
    await at(7.2);
    expect(mine().map((mail) => mail.subject)).toEqual(['Put your builder where customers already are']);
  });

  it('stops when the owner unsubscribes, and never mails a shop with a card', async () => {
    sent = [];
    await rest('email_unsubscribes', { method: 'POST', body: JSON.stringify({ email: owner, topic: 'tips', source: 'link' }) });
    const run = await at(11.2);
    expect(run.results.opted_out).toBeGreaterThanOrEqual(1);
    await rest(`email_unsubscribes?email=eq.${owner}`, { method: 'DELETE' });
    await rest(`tenants?id=eq.${tenantId}`, { method: 'PATCH', body: JSON.stringify({ billing_status: 'trialing' }) });
    await at(13.2);
    expect(mine()).toHaveLength(0);
  });

  it('sends the founder letter on the last day when there is no card', async () => {
    sent = [];
    await rest(`tenants?id=eq.${tenantId}`, { method: 'PATCH', body: JSON.stringify({ billing_status: 'none' }) });
    await at(13.2);
    expect(mine()).toHaveLength(1);
    expect(mine()[0]).toMatchObject({ from: 'Haleem at VVS Lab <hello@news.vvslab.test>', subject: 'Last day of your trial' });
  });
});
