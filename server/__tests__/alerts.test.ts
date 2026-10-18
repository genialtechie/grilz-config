import { afterEach, describe, expect, it, vi } from 'vitest';
import { dailyAlerts } from '../alerts';

const env = { SUPABASE_URL: 'https://db.test', SUPABASE_SERVICE_ROLE_KEY: 'service', FLUX_API_KEY: 'flux', RESEND_API_KEY: 'test', RESEND_BASE_URL: 'https://resend.test', ALERT_EMAIL: 'ops@shop.test' };

function fake(options: { usage?: { generations: number; outcome: string }[]; failedEmails?: number; credits?: number | null }) {
  const sent: { to: string[]; subject: string; text: string }[] = [];
  vi.stubGlobal('fetch', vi.fn(async (input: string | URL | Request, init?: RequestInit) => {
    const url = String(input);
    if (url.includes('/rest/v1/render_usage')) return Response.json(options.usage ?? []);
    if (url.includes('/rest/v1/lead_events')) return new Response(null, { status: 200, headers: { 'content-range': `*/${options.failedEmails ?? 0}` } });
    if (url.startsWith('https://api.bfl.ai/v1/credits')) return options.credits === null ? new Response('no', { status: 500 }) : Response.json({ credits: options.credits ?? 5000 });
    if (url.startsWith('https://resend.test/')) {
      sent.push(JSON.parse(String(init?.body)));
      return Response.json({ id: 'e1' });
    }
    return new Response(`unexpected ${url}`, { status: 500 });
  }));
  return sent;
}

afterEach(() => vi.unstubAllGlobals());

describe('daily alerts', () => {
  it('sends nothing on a quiet day', async () => {
    const sent = fake({ usage: [{ generations: 3, outcome: 'ok' }] });
    expect(await dailyAlerts(env)).toMatchObject({ ok: true, generations: 3, alerted: false });
    expect(sent).toHaveLength(0);
  });

  it('warns when credits are low, the budget is nearly used, photos were refused or emails failed', async () => {
    const sent = fake({ usage: [{ generations: 30, outcome: 'ok' }, { generations: 8, outcome: 'ok' }, { generations: 0, outcome: 'paused' }], failedEmails: 2, credits: 400 });
    const result = await dailyAlerts(env);
    expect(result).toMatchObject({ alerted: true, generations: 38, paused: 1, failedEmails: 2, credits: 400, emailed: true });
    expect(sent).toHaveLength(1);
    expect(sent[0].to).toEqual(['ops@shop.test']);
    expect(sent[0].subject).toBe('VVS Lab alert: AI photo credits low, AI photo budget nearly used, Studio photos refused, Emails failing');
    expect(sent[0].text).toContain('400 left');
    expect(sent[0].text).toContain('38 of the 45-generation daily budget');
  });

  it('says so when the credit balance can’t be read', async () => {
    const sent = fake({ credits: null });
    expect(await dailyAlerts(env)).toMatchObject({ alerted: true });
    expect(sent[0].subject).toContain('AI photo credits unknown');
  });

  it('falls back to the platform leads inbox, and skips email with no address', async () => {
    const sent = fake({ failedEmails: 1 });
    await dailyAlerts({ ...env, ALERT_EMAIL: undefined, PLATFORM_LEADS_EMAIL: 'leads@shop.test' });
    expect(sent[0].to).toEqual(['leads@shop.test']);
    const none = fake({ failedEmails: 1 });
    expect(await dailyAlerts({ ...env, ALERT_EMAIL: undefined })).toMatchObject({ alerted: true });
    expect(none).toHaveLength(0);
  });
});
