import { createHmac } from 'node:crypto';
import sharp from 'sharp';
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { DESIGNS } from '../../src/lib/__tests__/designs';
import { handleLead, leadToken, type LeadEnv } from '../leads';
import { notifyLead } from '../notify';
import { handleRender } from '../render';
import { handleStripeWebhook } from '../billing';

// End-to-end lead pipeline against a real (local) Supabase: lead → render →
// photo → emails, with FLUX and Resend mocked at the network edge.
// Runs in CI's database job; skipped unless INTEGRATION_SUPABASE_URL is set.
//   INTEGRATION_SUPABASE_URL=http://127.0.0.1:54321 INTEGRATION_SERVICE_KEY=... npx vitest run server/__tests__/pipeline.int.test.ts

const url = process.env.INTEGRATION_SUPABASE_URL;
const key = process.env.INTEGRATION_SERVICE_KEY;

const env: LeadEnv & Record<string, string> = {
  SUPABASE_URL: url ?? '',
  SUPABASE_SERVICE_ROLE_KEY: key ?? '',
  FLUX_API_KEY: 'test-flux',
  RESEND_API_KEY: 'test-resend',
  RESEND_BASE_URL: 'https://resend.test',
  PLATFORM_LEADS_EMAIL: 'platform@example.com',
  RENDER_DAILY_GENERATIONS: '100000',
  STRIPE_CONNECT_WEBHOOK_SECRET: 'whsec_pipeline_test',
};

type Sent = { to: string[]; subject: string; html: string; reply_to?: string[]; headers?: Record<string, string>; attachments?: { content_id: string }[] };
let sent: Sent[] = [];
let bflMode: 'ok' | 'fail' = 'ok';
let jpeg = '';
const realFetch = globalThis.fetch;

const rest = async (path: string, init: RequestInit = {}) => {
  const response = await realFetch(`${url}/rest/v1/${path}`, { ...init, headers: { apikey: key!, Authorization: `Bearer ${key}`, 'Content-Type': 'application/json', Prefer: 'return=representation', ...(init.headers ?? {}) } });
  const text = await response.text();
  return text ? JSON.parse(text) : null;
};

let ipCounter = 0;
const nextIp = () => `203.0.113.${(ipCounter += 1)}`;

const leadBody = (patch: Record<string, unknown> = {}) => ({
  tenant: 'fixture',
  configVersion: 1,
  name: 'Ava Test',
  contact: '@ava.test',
  email: 'ava@example.com',
  spec: DESIGNS.plain6x6,
  preview: `data:image/jpeg;base64,${jpeg}`,
  photo: true,
  elapsedMs: 30_000,
  ...patch,
});

const deferred: Promise<unknown>[] = [];
const defer = (work: Promise<unknown>) => void deferred.push(work);
const settleDeferred = async () => {
  // Background work that waits for the fallback timer is not awaited here.
  await new Promise((resolve) => setTimeout(resolve, 300));
};

const leadRow = async (id: string) => (await rest(`leads?id=eq.${id}&select=*`))[0];
const waitFor = async <T>(fn: () => Promise<T | null | undefined>, ms = 15_000): Promise<T> => {
  const stop = Date.now() + ms;
  for (;;) {
    const value = await fn();
    if (value) return value;
    if (Date.now() > stop) throw new Error('timed out');
    await new Promise((resolve) => setTimeout(resolve, 200));
  }
};

describe.skipIf(!url || !key)('lead pipeline (integration)', () => {
  beforeAll(async () => {
    jpeg = (await sharp({ create: { width: 64, height: 64, channels: 3, background: '#c9a45c' } }).jpeg().toBuffer()).toString('base64');
    vi.stubGlobal('fetch', async (input: string | URL | Request, init?: RequestInit) => {
      const target = typeof input === 'string' ? input : input instanceof URL ? input.href : input.url;
      if (target.startsWith('https://resend.test/')) {
        const body = JSON.parse(String(init?.body)) as Sent;
        sent.push(body);
        return Response.json({ id: `email-${sent.length}` });
      }
      if (target.startsWith('https://api.bfl.ai/v1/credits')) return Response.json({ credits: 10_000 });
      if (target.startsWith('https://api.bfl.ai/v1/get_result')) {
        return Response.json(bflMode === 'ok' ? { status: 'Ready', result: { sample: 'https://bfl.test/sample.jpg' } } : { status: 'Error' });
      }
      if (target.startsWith('https://api.bfl.ai/v1/')) return Response.json({ id: 'job-1' });
      if (target === 'https://bfl.test/sample.jpg') return new Response(Buffer.from(jpeg, 'base64'), { headers: { 'Content-Type': 'image/jpeg' } });
      return realFetch(input, init);
    });
  });

  beforeEach(() => {
    sent = [];
    bflMode = 'ok';
    vi.spyOn(console, 'error').mockImplementation(() => {});
  });

  afterAll(async () => {
    vi.unstubAllGlobals();
    const [fixture] = await rest('tenants?slug=eq.fixture&select=id');
    await rest(`render_usage?tenant_id=eq.${fixture.id}`, { method: 'DELETE' });
    await rest(`leads?tenant_id=eq.${fixture.id}`, { method: 'DELETE' });
  });

  it('records a paid deposit once and tells the shop once, even when Stripe sends two events', async () => {
    const lead = await handleLead(leadBody({ photo: false }), nextIp(), env, defer);
    const { leadId } = lead.body as { leadId: string };
    await settleDeferred();
    const [fixture] = await rest('tenants?slug=eq.fixture&select=id,stripe_account_id');
    const account = 'acct_pipeline_test';
    await rest(`tenants?id=eq.${fixture.id}`, { method: 'PATCH', body: JSON.stringify({ stripe_account_id: account }) });
    try {
      sent = [];
      const session = { id: 'cs_test_1', payment_status: 'paid', amount_total: 25_000, metadata: { purpose: 'deposit', lead_id: leadId } };
      for (const type of ['checkout.session.completed', 'checkout.session.async_payment_succeeded']) {
        const body = JSON.stringify({ id: `evt_${type}_${leadId}`, type, account, data: { object: session } });
        const t = Math.floor(Date.now() / 1000);
        const signature = `t=${t},v1=${createHmac('sha256', env.STRIPE_CONNECT_WEBHOOK_SECRET).update(`${t}.${body}`).digest('hex')}`;
        expect((await handleStripeWebhook(body, signature, true, env)).status).toBe(200);
      }
      const row = await leadRow(leadId);
      expect(row.deposit_paid_at).toBeTruthy();
      const deposits = sent.filter((mail) => mail.subject.endsWith('paid a $250 deposit'));
      expect(deposits).toHaveLength(1);
      expect(deposits[0].to).toEqual(['platform@example.com']);
    } finally {
      await rest(`tenants?id=eq.${fixture.id}`, { method: 'PATCH', body: JSON.stringify({ stripe_account_id: fixture.stripe_account_id }) });
    }
  });

  it('stores the lead with the server price, then emails the shop once with the photo', async () => {
    const lead = await handleLead(leadBody({ total: 1 }), nextIp(), env, defer);
    expect(lead.status).toBe(200);
    const { leadId, token } = lead.body as { leadId: string; token: string };

    const row = await leadRow(leadId);
    expect(Number(row.total)).toBeGreaterThan(1); // the browser's number is ignored
    expect(row.render_status).toBe('rendering');
    expect(row.preview_path).toMatch(new RegExp(`/${leadId}/preview\\.jpg$`));
    expect(row.ip_hash).toMatch(/^[0-9a-f]{32}$/);

    const render = await handleRender({ tenant: 'fixture', image: `data:image/jpeg;base64,${jpeg}`, spec: DESIGNS.plain6x6, masks: [], leadId, leadToken: token }, nextIp(), env, defer);
    expect(render.status).toBe(200);
    await settleDeferred();
    const done = await waitFor(async () => {
      const current = await leadRow(leadId);
      return current.notified_at ? current : null;
    });
    expect(done.render_status).toBe('ready');
    expect(done.photo_path).toMatch(/photo\.jpg$/);

    await waitFor(async () => (sent.length >= 2 ? true : null));
    const shop = sent.find((email) => email.to.includes('platform@example.com'))!;
    expect(shop.subject).toMatch(/^\[Test shop\] New design from Ava Test/);
    expect(shop.attachments?.map((item) => item.content_id)).toEqual(['photo']);
    expect(shop.reply_to).toEqual(['ava@example.com']);
    const customer = sent.find((email) => email.to.includes('ava@example.com'))!;
    expect(customer.subject).toBe('Fixture Jewelers has your grillz design');

    // The fallback timer firing later sends nothing more.
    expect(await notifyLead(leadId, 'timeout', env)).toBe('already');
    expect(sent).toHaveLength(2);

    const usage = await rest(`render_usage?lead_id=eq.${leadId}&select=generations,outcome`);
    expect(usage).toEqual([{ generations: 1, outcome: 'ok' }]);
  });

  it('emails without the photo when it is late, then follows up in the same thread', async () => {
    const lead = await handleLead(leadBody({ email: '' }), nextIp(), env, defer);
    const { leadId, token } = lead.body as { leadId: string; token: string };
    expect(await notifyLead(leadId, 'timeout', env)).toBe('sent');
    expect(sent).toHaveLength(1);
    expect(sent[0].attachments?.map((item) => item.content_id)).toEqual(['preview']);
    expect(sent[0].html).toContain('still rendering');

    await handleRender({ tenant: 'fixture', image: `data:image/jpeg;base64,${jpeg}`, spec: DESIGNS.plain6x6, masks: [], leadId, leadToken: token }, nextIp(), env, defer);
    await waitFor(async () => (sent.length >= 2 ? true : null));
    expect(sent[1].subject.startsWith('Re: ')).toBe(true);
    expect(sent[1].headers?.['In-Reply-To']).toBe(sent[0].headers?.['Message-ID']);
    expect(sent[1].attachments?.map((item) => item.content_id)).toEqual(['photo']);
  });

  it('sends the lead without a photo when the render fails', async () => {
    bflMode = 'fail';
    const lead = await handleLead(leadBody({ email: '' }), nextIp(), env, defer);
    const { leadId, token } = lead.body as { leadId: string; token: string };
    const render = await handleRender({ tenant: 'fixture', image: `data:image/jpeg;base64,${jpeg}`, spec: DESIGNS.plain6x6, masks: [], leadId, leadToken: token }, nextIp(), env, defer);
    expect(render.status).toBe(422);
    const row = await waitFor(async () => {
      const current = await leadRow(leadId);
      return current.notified_at ? current : null;
    });
    expect(row.render_status).toBe('failed');
    await waitFor(async () => (sent.length >= 1 ? true : null));
    expect(sent[0].html).not.toContain('still rendering');
  });

  it('pauses photos once the shop has used its monthly allowance, and still delivers the lead', async () => {
    const [fixture] = await rest('tenants?slug=eq.fixture&select=id');
    await rest('render_usage', { method: 'POST', body: JSON.stringify({ tenant_id: fixture.id, generations: 100_000, outcome: 'ok' }) });
    try {
      const lead = await handleLead(leadBody({ email: '' }), nextIp(), env, defer);
      const { leadId, token } = lead.body as { leadId: string; token: string };
      const render = await handleRender({ tenant: 'fixture', image: `data:image/jpeg;base64,${jpeg}`, spec: DESIGNS.plain6x6, masks: [], leadId, leadToken: token }, nextIp(), env, defer);
      expect(render.body.code).toBe('paused');
      const row = await waitFor(async () => {
        const current = await leadRow(leadId);
        return current.notified_at ? current : null;
      });
      expect(row.render_status).toBe('paused');
    } finally {
      await rest(`render_usage?tenant_id=eq.${fixture.id}&generations=eq.100000`, { method: 'DELETE' });
    }
  });

  it('refuses a render that claims a lead without its token', async () => {
    const lead = await handleLead(leadBody({ email: '' }), nextIp(), env, defer);
    const { leadId } = lead.body as { leadId: string };
    const forged = await handleRender({ tenant: 'fixture', image: `data:image/jpeg;base64,${jpeg}`, spec: DESIGNS.plain6x6, masks: [], leadId, leadToken: 'x'.repeat(32) }, nextIp(), env, defer);
    expect(forged.status).toBe(403);

    // A real token for this lead doesn't work at another shop.
    const [other] = await rest('tenants?slug=eq.gold-block&select=id');
    expect(other).toBeTruthy();
    const crossShop = await handleRender({ tenant: 'gold-block', image: `data:image/jpeg;base64,${jpeg}`, spec: DESIGNS.plain6x6, masks: [], leadId, leadToken: (lead.body as { token: string }).token }, nextIp(), env, defer);
    expect(crossShop.status).toBe(403);
    expect(leadToken(leadId, other.id, env)).not.toBe((lead.body as { token: string }).token);
  });

  it('will not replace a lead photo once its render has settled', async () => {
    const lead = await handleLead(leadBody({ email: '' }), nextIp(), env, defer);
    const { leadId, token } = lead.body as { leadId: string; token: string };
    const body = { tenant: 'fixture', image: `data:image/jpeg;base64,${jpeg}`, spec: DESIGNS.plain6x6, masks: [], leadId, leadToken: token };
    expect((await handleRender(body, nextIp(), env, defer)).status).toBe(200);
    await waitFor(async () => ((await leadRow(leadId)).render_status === 'ready' ? true : null));
    expect((await handleRender(body, nextIp(), env, defer)).status).toBe(409);
  });

  it('holds bursts of parallel leads to the limits', async () => {
    const ip = nextIp();
    const results = await Promise.all(Array.from({ length: 10 }, () => handleLead(leadBody({ email: '', photo: false }), ip, env, () => {})));
    expect(results.filter((result) => result.status === 200)).toHaveLength(5);
    expect(results.filter((result) => result.status === 429)).toHaveLength(5);
  });

  it('caps confirmations to one address per day, across shops', async () => {
    const statuses: number[] = [];
    for (let i = 0; i < 4; i += 1) statuses.push((await handleLead(leadBody({ email: 'repeat@example.com', photo: false }), nextIp(), env, () => {})).status);
    expect(statuses).toEqual([200, 200, 200, 429]);
  });

  it('stores only a re-encoded image, and still takes the lead if the upload is junk', async () => {
    const junk = await handleLead(leadBody({ email: '', photo: false, preview: `data:image/png;base64,${Buffer.from('<svg onload=alert(1)>').toString('base64')}` }), nextIp(), env, () => {});
    expect(junk.status).toBe(200);
    expect((await leadRow((junk.body as { leadId: string }).leadId)).preview_path).toBeNull();
  });

  it('reserves generations atomically so a burst cannot overspend', async () => {
    const [fixture] = await rest('tenants?slug=eq.fixture&select=id');
    const before = (await rest(`rpc/month_generations`, { method: 'POST', body: JSON.stringify({ target: fixture.id }) })) as number;
    // Leave room for exactly 3 more single-generation renders.
    await rest('render_usage', { method: 'POST', body: JSON.stringify({ tenant_id: fixture.id, generations: 1000 - before - 3, outcome: 'ok' }) });
    try {
      const renders = await Promise.all(
        Array.from({ length: 8 }, () => handleRender({ tenant: 'fixture', image: `data:image/jpeg;base64,${jpeg}`, spec: DESIGNS.plain6x6, masks: [] }, nextIp(), env, defer)),
      );
      expect(renders.filter((result) => result.status === 200)).toHaveLength(3);
      expect(renders.filter((result) => result.body.code === 'paused')).toHaveLength(5);
    } finally {
      await rest(`render_usage?tenant_id=eq.${fixture.id}&generations=eq.${1000 - before - 3}`, { method: 'DELETE' });
    }
  });

  it('sends exactly one first email when both paths race', async () => {
    // A lead waiting on its photo: nothing is sent until one of the paths fires.
    const lead = await handleLead(leadBody({ email: '' }), nextIp(), env, () => {});
    const { leadId } = lead.body as { leadId: string };
    const results = await Promise.all([notifyLead(leadId, 'timeout', env), notifyLead(leadId, 'final', env), notifyLead(leadId, 'timeout', env)]);
    expect(results.filter((result) => result === 'sent')).toHaveLength(1);
    expect(sent).toHaveLength(1);
  });

  it('drops bots silently and rate-limits one visitor', async () => {
    const before = (await rest('leads?select=id')).length;
    const bot = await handleLead(leadBody({ website: 'http://spam.example' }), nextIp(), env, defer);
    expect(bot.status).toBe(200);
    const fast = await handleLead(leadBody({ elapsedMs: 500 }), nextIp(), env, defer);
    expect(fast.status).toBe(200);
    expect((await rest('leads?select=id')).length).toBe(before);

    const ip = nextIp();
    const statuses: number[] = [];
    for (let i = 0; i < 6; i += 1) statuses.push((await handleLead(leadBody({ email: '', photo: false }), ip, env, () => {})).status);
    expect(statuses).toEqual([200, 200, 200, 200, 200, 429]);
  });

  it('rejects designs the shop does not sell and bad contacts', async () => {
    const offCatalog = await handleLead(leadBody({ spec: { ...DESIGNS.plain6x6, teeth: DESIGNS.plain6x6.teeth.map((tooth) => ({ ...tooth, metal: 'unobtanium' })) } }), nextIp(), env, defer);
    expect(offCatalog.status).toBe(400);
    const badContact = await handleLead(leadBody({ contact: 'call me maybe' }), nextIp(), env, defer);
    expect(badContact.status).toBe(400);
  });
});
