import { createHmac } from 'node:crypto';
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { handleResendWebhook, handleUnsubscribe, sendMarketingEmail, unsubscribeUrl, type MarketingSend } from '../marketing';

// Marketing sends, opt-outs and the Resend webhook against a real (local)
// Supabase, with Resend mocked at the network edge.
// Runs in CI's database job; skipped unless INTEGRATION_SUPABASE_URL is set.

const url = process.env.INTEGRATION_SUPABASE_URL;
const key = process.env.INTEGRATION_SERVICE_KEY;
const webhookKey = Buffer.from('webhook-key');

const env = {
  SUPABASE_URL: url ?? '',
  SUPABASE_SERVICE_ROLE_KEY: key ?? '',
  RESEND_API_KEY: 'test-resend',
  RESEND_BASE_URL: 'https://resend.test',
  EMAIL_MARKETING_FROM_DOMAIN: 'news.vvslab.test',
  PUBLIC_ORIGIN: 'https://vvslab.test',
  LEAD_TOKEN_SECRET: 'marketing-test',
  RESEND_WEBHOOK_SECRET: `whsec_${webhookKey.toString('base64')}`,
};

type Sent = { from: string; to: string[]; subject: string; html: string; headers?: Record<string, string> };
let sent: Sent[] = [];
const realFetch = globalThis.fetch;
const stamp = Date.now();
const address = (name: string) => `${name}-${stamp}@example.com`;

const rest = (path: string, init: RequestInit = {}) =>
  realFetch(`${url}/rest/v1/${path}`, { ...init, headers: { apikey: key!, Authorization: `Bearer ${key}`, 'Content-Type': 'application/json', ...(init.headers ?? {}) } });

const send = (to: string, patch: Partial<MarketingSend> = {}): MarketingSend => ({
  to,
  topic: 'tips',
  kind: 'test-step',
  dedupeKey: `test-step:${to}`,
  fromName: 'Karat from VVS Lab',
  render: async (unsubscribe) => ({ subject: 'A tip', html: `<p>Hi</p><a href="${unsubscribe}">Unsubscribe</a>`, text: `Unsubscribe: ${unsubscribe}` }),
  ...patch,
});

describe.skipIf(!url || !key)('marketing email (integration)', () => {
  beforeAll(() => {
    vi.stubGlobal('fetch', async (input: string | URL | Request, init?: RequestInit) => {
      const target = typeof input === 'string' ? input : input instanceof URL ? input.href : input.url;
      if (target.startsWith('https://resend.test/')) {
        sent.push(JSON.parse(String(init?.body)) as Sent);
        return Response.json({ id: `email-${sent.length}-${stamp}` });
      }
      return realFetch(input, init);
    });
  });
  beforeEach(() => {
    sent = [];
  });
  afterAll(async () => {
    vi.unstubAllGlobals();
    await rest(`email_sends?email=like.*-${stamp}@example.com`, { method: 'DELETE' });
    await rest(`email_unsubscribes?email=like.*-${stamp}@example.com`, { method: 'DELETE' });
  });

  it('sends once from the marketing domain with one-click unsubscribe headers', async () => {
    const to = address('ava');
    expect(await sendMarketingEmail(send(to), env)).toBe('sent');
    expect(await sendMarketingEmail(send(to), env)).toBe('duplicate');
    expect(sent).toHaveLength(1);
    expect(sent[0].from).toBe('Karat from VVS Lab <hello@news.vvslab.test>');
    expect(sent[0].headers?.['List-Unsubscribe-Post']).toBe('List-Unsubscribe=One-Click');
    const link = sent[0].headers?.['List-Unsubscribe']?.slice(1, -1) ?? '';
    expect(link).toBe(unsubscribeUrl(to, 'tips', env));
    expect(sent[0].html).toContain(link);
    const [row] = (await (await rest(`email_sends?dedupe_key=eq.test-step:${to}&select=status,resend_id`)).json()) as { status: string; resend_id: string }[];
    expect(row).toMatchObject({ status: 'sent', resend_id: `email-1-${stamp}` });
  });

  it('only unsubscribes on POST: one-click from the mail client, or the page buttons', async () => {
    const to = address('bob');
    const link = new URL(unsubscribeUrl(to, 'tips', env));
    const page = await handleUnsubscribe('GET', link, new URLSearchParams(), env);
    expect(page.html).toContain('Unsubscribe?');
    expect(await sendMarketingEmail(send(to, { dedupeKey: `a:${to}` }), env)).toBe('sent'); // a GET (link scanner) changed nothing

    await handleUnsubscribe('POST', link, new URLSearchParams('List-Unsubscribe=One-Click'), env);
    expect(await sendMarketingEmail(send(to, { dedupeKey: `b:${to}` }), env)).toBe('opted_out');
    // Other topics still go, until "all".
    expect(await sendMarketingEmail(send(to, { topic: 'news', dedupeKey: `c:${to}` }), env)).toBe('sent');
    await handleUnsubscribe('POST', link, new URLSearchParams('action=all'), env);
    expect(await sendMarketingEmail(send(to, { topic: 'news', dedupeKey: `d:${to}` }), env)).toBe('opted_out');

    const back = await handleUnsubscribe('POST', link, new URLSearchParams('action=resubscribe'), env);
    expect(back.html).toContain('Welcome back');
    expect(await sendMarketingEmail(send(to, { dedupeKey: `e:${to}` }), env)).toBe('sent');
  });

  it('refuses a tampered link', async () => {
    const link = new URL(unsubscribeUrl(address('cy'), 'tips', env));
    link.searchParams.set('e', Buffer.from(address('someone-else')).toString('base64url'));
    expect((await handleUnsubscribe('POST', link, new URLSearchParams('List-Unsubscribe=One-Click'), env)).status).toBe(400);
  });

  it('takes complaints and hard bounces off all marketing, but not soft bounces', async () => {
    const event = async (type: string, to: string, bounce?: string) => {
      const body = JSON.stringify({ type, data: { email_id: 'x', to: [to], ...(bounce ? { bounce: { type: bounce } } : {}) } });
      const id = `msg_${Math.random()}`;
      const timestamp = String(Math.floor(Date.now() / 1000));
      const signature = `v1,${createHmac('sha256', webhookKey).update(`${id}.${timestamp}.${body}`).digest('base64')}`;
      return handleResendWebhook(body, { id, timestamp, signature }, env);
    };
    const complainer = address('dee');
    expect((await event('email.complained', complainer)).status).toBe(200);
    expect(await sendMarketingEmail(send(complainer, { topic: 'news' }), env)).toBe('opted_out');

    const soft = address('eve');
    await event('email.bounced', soft, 'Transient');
    expect(await sendMarketingEmail(send(soft), env)).toBe('sent');
    const hard = address('fay');
    await event('email.bounced', hard, 'Permanent');
    expect(await sendMarketingEmail(send(hard), env)).toBe('opted_out');

    expect((await handleResendWebhook('{}', { id: 'x', timestamp: String(Math.floor(Date.now() / 1000)), signature: 'v1,nope' }, env)).status).toBe(400);
  });
});
