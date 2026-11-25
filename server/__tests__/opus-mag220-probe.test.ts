import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { runTrialSequence } from '../trialSequence';

// MAG-220 F1 regression: warnings must fire again after a trial extension
// starts a new cycle. The warning dedupe keys carry the trial end, so each
// cycle gets fresh keys; without the cycle in the key, a re-extended shop went
// dark a second time with no warning at all — the first cycle's keys were
// already spent (email_sends.dedupe_key is UNIQUE with no expiry).
// Reconstructed from the Opus reviewer's probe (scenarios A + B), with the
// expectations flipped: run 2 must SEND, not come back 'duplicate'.
// Runs the real runTrialSequence against a stub Supabase (fetch) + stub Resend.

const DAY = 864e5;
const start = Date.UTC(2026, 10, 11, 13, 5, 0); // Nov 11 13:05 UTC: claim trial starts
const ends1 = start + 30 * DAY; // Dec 11 13:05 UTC: cycle 1 ends
const ends2 = ends1 + 30 * DAY; // Jan 10 13:05 UTC: cycle 2 ends after a +30d extend
const weekLeft1 = ends1 - 7 * DAY + 3600_000; // Dec 4 14:05 UTC: 7 days left, cycle 1
const lastDay1 = ends1 - DAY + 3600_000; // Dec 10 14:05 UTC: last day, cycle 1
const weekLeft2 = ends2 - 7 * DAY + 3600_000; // Jan 3 14:05 UTC: 7 days left, cycle 2
const lastDay2 = ends2 - DAY + 3600_000; // Jan 9 14:05 UTC: last day, cycle 2

const tenantId = 'probe-tenant';
const ownerEmail = 'owner@probe.test';
const env = {
  SUPABASE_URL: 'https://supabase.test',
  SUPABASE_SERVICE_ROLE_KEY: 'test-key',
  RESEND_API_KEY: 'test-resend',
  RESEND_BASE_URL: 'https://resend.test',
  EMAIL_MARKETING_FROM_DOMAIN: 'news.vvslab.test',
  PUBLIC_ORIGIN: 'https://vvslab.test',
  LEAD_TOKEN_SECRET: 'trial-probe',
  MARKETING_REPLY_TO: 'team@vvslab.test',
  PLATFORM_LEADS_EMAIL: 'haleem@vvslab.test',
};

type SentMail = { to: string[]; subject: string };
let sent: SentMail[] = [];
let claimed: string[] = [];
let owner: string | null = ownerEmail;
let row: Record<string, unknown> = {};

const stubFetch = async (input: string | URL | Request, init?: RequestInit): Promise<Response> => {
  const target = typeof input === 'string' ? input : input instanceof URL ? input.href : input.url;
  if (target.startsWith('https://resend.test/')) {
    sent.push(JSON.parse(String(init?.body)) as SentMail);
    return Response.json({ id: `email-${sent.length}` });
  }
  if (!target.startsWith('https://supabase.test/rest/v1/')) throw new Error(`unexpected fetch: ${target}`);
  const url = new URL(target);
  const table = url.pathname.replace('/rest/v1/', '');
  const method = init?.method ?? 'GET';
  if (method === 'GET' && table === 'tenants') {
    const gt = url.searchParams.get('trial_ends_at')?.replace(/^gt\./, '');
    const live = !gt || new Date(String(row.trial_ends_at)).getTime() > new Date(gt).getTime();
    return Response.json(live ? [row] : []);
  }
  if (method === 'GET' && table === 'tenant_configs') return Response.json([]);
  if (method === 'GET' && table === 'leads') return Response.json([]);
  if (method === 'GET' && table === 'member_invites') return Response.json(owner ? [{ email: owner }] : []);
  if (method === 'GET' && table === 'members') return Response.json([]);
  if (method === 'GET' && table === 'email_unsubscribes') return Response.json([]);
  if (method === 'POST' && table === 'email_sends') {
    const body = JSON.parse(String(init?.body)) as { dedupe_key: string };
    if (claimed.includes(body.dedupe_key)) return new Response('duplicate', { status: 409 });
    claimed.push(body.dedupe_key);
    return Response.json([{ id: `send-${claimed.length}` }]);
  }
  if (method === 'PATCH' && table === 'email_sends') return Response.json([]);
  throw new Error(`unexpected ${method} ${target}`);
};

describe('trial warnings after an extension (MAG-220 F1)', () => {
  beforeEach(() => {
    sent = [];
    claimed = [];
    owner = ownerEmail;
    row = {
      id: tenantId,
      slug: 'probe-gold',
      name: 'Probe Gold',
      status: 'live',
      plan: 'trial',
      billing_status: 'none',
      trial_ends_at: new Date(ends1).toISOString(),
      trial_started_at: new Date(start).toISOString(),
      created_at: new Date(start).toISOString(),
      created_via: 'claim',
      stripe_charges_enabled: false,
    };
    vi.stubGlobal('fetch', stubFetch);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('A: extending before the last-day warning still warns in the new cycle', async () => {
    const run1 = await runTrialSequence(env, { now: weekLeft1 });
    expect(run1.due).toBe(1);
    expect(run1.results.sent).toBe(1);
    expect(run1.results.haleem_sent).toBe(1);

    // Extend on Dec 5, before the last-day warning: the end moves to Jan 10.
    row.trial_ends_at = new Date(ends2).toISOString();
    const run2 = await runTrialSequence(env, { now: weekLeft2 });
    expect(run2.due).toBe(1);
    expect(run2.results.sent).toBe(1); // pre-fix: 'duplicate' — no mail went out
    expect(run2.results.haleem_sent).toBe(1);
    expect(sent.filter((mail) => mail.subject === '7 days left on your trial')).toHaveLength(2);
    expect(claimed).toContain(`trial-week-left:${tenantId}:2026-12-11T13:05:00.000Z`);
    expect(claimed).toContain(`trial-week-left:${tenantId}:2027-01-10T13:05:00.000Z`);
    expect(claimed).toContain(`trial-haleem-week-left:${tenantId}:2026-12-11T13:05:00.000Z`);
    expect(claimed).toContain(`trial-haleem-week-left:${tenantId}:2027-01-10T13:05:00.000Z`);
  });

  it('B: extending after both warnings fired still warns in the new cycle', async () => {
    await runTrialSequence(env, { now: weekLeft1 });
    const lastDay = await runTrialSequence(env, { now: lastDay1 });
    expect(lastDay.results.sent).toBe(1);
    expect(lastDay.results.haleem_sent).toBe(1);

    // Extend on Dec 10, after both warnings fired: the end moves to Jan 10.
    row.trial_ends_at = new Date(ends2).toISOString();
    const run3 = await runTrialSequence(env, { now: weekLeft2 });
    expect(run3.results.sent).toBe(1); // pre-fix: 'duplicate'
    expect(run3.results.haleem_sent).toBe(1);
    const run4 = await runTrialSequence(env, { now: lastDay2 });
    expect(run4.results.sent).toBe(1); // pre-fix: 'duplicate' — zero warnings in cycle 2
    expect(run4.results.haleem_sent).toBe(1);
    expect(sent.filter((mail) => mail.subject === '7 days left on your trial')).toHaveLength(2);
    expect(sent.filter((mail) => mail.subject === 'Last day of your trial')).toHaveLength(2);
  });

  it('dryRun previews what is due, including shops with no owner, and sends nothing (F4)', async () => {
    owner = null;
    const run = await runTrialSequence(env, { dryRun: true, now: weekLeft1 });
    expect(run.shops).toBe(1);
    expect(run.due).toBe(1);
    expect(run.results.no_owner).toBe(1);
    expect(sent).toHaveLength(0);
    // A real run still tells Haleem even when the jeweler can't be reached.
    const live = await runTrialSequence(env, { now: weekLeft1 });
    expect(live.results.no_owner).toBe(1);
    expect(live.results.haleem_sent).toBe(1);
    expect(sent).toHaveLength(1);
  });
});
