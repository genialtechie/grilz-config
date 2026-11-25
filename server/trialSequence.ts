import { DbError, createDb, hasDb, type Db } from './db.js';
import { sendEmail } from './email.js';
import { hasCard, trialDaysLeft, trialStartMs } from '../src/lib/trial.js';
import { marketingReplyTo, ownerEmail, sendMarketingEmail, type MarketingEnv, type MarketingResult } from './marketing.js';
import { trialEmail, type TrialShop, type TrialStep } from './trialEmails.js';

// The trial sequence, run once a day by /api/cron/marketing. Each shop on a
// free trial gets at most one email a day, and only the step that's due:
//   day 1  go live          (skip if live)
//   day 3  share the link   (skip if it already had a design request; not live → "still off")
//   day 7  card deposits    (skip if Stripe is connected)
//   7 days left  keep it on, with their numbers  (skip if a card is on file)
//   last day     a plain letter from Haleem      (skip if a card is on file)
// The two warnings also go to Haleem the same day, so no shop goes dark
// without him knowing. A step is only sent inside its window, so a missed day
// is skipped rather than stacked, and email_sends makes each step go out once
// per shop per trial cycle: the dedupe key carries the trial end, so an
// extension starts a new cycle and the warnings fire again (MAG-220 F1 —
// without the cycle in the key, a re-extended shop went dark a second time
// with no warning at all, because the first cycle's keys were already spent).
// Every trial shop is covered — signup, claim and invite alike
// (MAG-220: the old run only looked at self-signups, which is how Frost went
// dark with no warning at all).

const DAY = 864e5;

export type ShopRow = {
  id: string;
  slug: string;
  name: string;
  status: string;
  plan: string | null;
  billing_status: string | null;
  trial_ends_at: string | null;
  trial_started_at: string | null;
  created_at: string;
  created_via: string | null;
  stripe_charges_enabled: boolean | null;
};

/** The step due today, or null. Warnings come first: they have a deadline. */
export function stepFor(
  shop: TrialShop,
  row: { trial_ends_at: string | null; trial_started_at?: string | null; created_at?: string | null; created_via?: string | null },
  now = Date.now(),
): TrialStep | null {
  if (!row.trial_ends_at) return null;
  const ends = new Date(row.trial_ends_at).getTime();
  if (ends <= now) return null;
  const left = shop.daysLeft;
  if (left === 1) return shop.hasCard ? null : 'last-day';
  if (left === 7) return shop.hasCard ? null : 'week-left';
  const start = trialStartMs(row);
  if (start === null) return null;
  const day = Math.floor((now - start) / DAY);
  if (day === 7 || day === 8) return shop.stripeReady ? null : 'day-7';
  if (day === 3 || day === 4) return shop.leads > 0 ? null : 'day-3';
  // New shops start live (MAG-90): day 1 is about making the prices theirs, or switching on an older shop.
  if (day === 1 || day === 2) return shop.live && shop.pricesSet ? null : 'day-1';
  return null;
}

async function loadShop(db: Db, row: ShopRow, now: number): Promise<{ shop: TrialShop; owner: string | null }> {
  const [published] = await db.select<{ version: number; logo: string | null; source: string | null }>('tenant_configs', {
    tenant_id: `eq.${row.id}`,
    status: 'eq.published',
    select: 'version,logo:config->brand->>logo,source:config->pricing->>source',
  });
  const leads = await db.select<{ total: number | string }>('leads', { tenant_id: `eq.${row.id}`, select: 'total' });
  return {
    owner: await ownerEmail(db, row.id),
    shop: {
      id: row.id,
      slug: row.slug,
      name: row.name,
      live: row.status === 'live',
      hasLogo: Boolean(published?.logo),
      // Still on the starting prices, or (shops from before quick pricing) never republished.
      pricesSet: published?.source ? published.source !== 'default' : (published?.version ?? 0) > 1,
      leads: leads.length,
      estimates: leads.reduce((sum, lead) => sum + Number(lead.total || 0), 0),
      stripeReady: Boolean(row.stripe_charges_enabled),
      hasCard: hasCard(row),
      daysLeft: trialDaysLeft(row, now),
    },
  };
}

type HaleemResult = 'haleem_sent' | 'haleem_failed' | 'haleem_duplicate' | 'haleem_no_address';

export type TrialRun = {
  shops: number;
  due: number;
  results: Partial<Record<MarketingResult | 'no_owner' | HaleemResult, number>>;
};

/** Haleem hears about a trial ending the same day the jeweler does. Plain alert mail, not marketing: no unsubscribe, no stream. */
async function notifyHaleem(
  db: Db,
  env: MarketingEnv & { ALERT_EMAIL?: string; PLATFORM_LEADS_EMAIL?: string },
  row: ShopRow,
  shop: TrialShop,
  step: 'week-left' | 'last-day',
  owner: string | null,
  origin: string,
): Promise<HaleemResult> {
  const to = env.ALERT_EMAIL || env.PLATFORM_LEADS_EMAIL;
  if (!to) return 'haleem_no_address';
  const kind = step === 'week-left' ? 'trial-haleem-week-left' : 'trial-haleem-last-day';
  // Claim the send: the unique key means only one caller ever gets past here.
  // The key carries the trial end, so an extension starts a new cycle and the
  // alert fires again (MAG-220 F1); trial_ends_at is non-null wherever a
  // warning step is due.
  let send: { id: string };
  try {
    send = await db.insert<{ id: string }>('email_sends', { dedupe_key: `${kind}:${row.id}:${row.trial_ends_at}`, kind, topic: 'alert', email: to, tenant_id: row.id });
  } catch (error) {
    if (error instanceof DbError && error.status === 409) return 'haleem_duplicate';
    throw error;
  }
  const when = step === 'week-left' ? '7 days' : 'tomorrow';
  const ends = new Date(row.trial_ends_at as string).toISOString().slice(0, 10);
  const admin = `${origin}/admin/shops/${row.slug}`;
  const text = `${shop.name}'s trial ends in ${when} (${ends}). Owner: ${owner ?? 'no owner email on file'}. They got the warning email today. Extend it from the admin: ${admin}`;
  const html = `<div style="font-family:-apple-system,Segoe UI,Roboto,Helvetica,Arial,sans-serif;font-size:15px;line-height:1.5;color:#1b1714;max-width:560px"><p style="margin:0 0 12px"><strong>${shop.name}</strong>'s trial ends in ${when} (${ends}).</p><p style="margin:0 0 12px">Owner: ${owner ?? 'no owner email on file'}. They got the warning email today.</p><p style="margin:0">Extend it from the admin: <a href="${admin}">${admin}</a></p></div>`;
  const sent = await sendEmail({ fromName: 'VVS Lab alerts', fromLocal: 'hello', to: [to], subject: `[VVS Lab] ${shop.name} trial ends in ${when}`, text, html }, env);
  await db.update('email_sends', { id: `eq.${send.id}` }, sent.ok
    ? { status: 'sent', resend_id: sent.id, updated_at: new Date().toISOString() }
    : { status: sent.reason === 'not_configured' ? 'skipped' : 'failed', detail: `${sent.reason} ${sent.detail ?? ''}`.trim().slice(0, 300), updated_at: new Date().toISOString() });
  return sent.ok ? 'haleem_sent' : 'haleem_failed';
}

/** Sends today's trial emails. `dryRun` reports what would go out without sending. */
export async function runTrialSequence(env: MarketingEnv & { MARKETING_REPLY_TO?: string; PLATFORM_LEADS_EMAIL?: string; ALERT_EMAIL?: string }, { dryRun = false, now = Date.now() } = {}): Promise<TrialRun> {
  const run: TrialRun = { shops: 0, due: 0, results: {} };
  if (!hasDb(env)) return run;
  const db = createDb(env);
  const rows = await db.select<ShopRow>('tenants', {
    kind: 'eq.shop',
    plan: 'eq.trial',
    status: 'in.(draft,live)',
    trial_ends_at: `gt.${new Date(now).toISOString()}`,
    select: 'id,slug,name,status,plan,billing_status,trial_ends_at,trial_started_at,created_at,created_via,stripe_charges_enabled',
  });
  run.shops = rows.length;
  const origin = env.PUBLIC_ORIGIN || 'https://vvslab.magpollo.com';
  const replyTo = marketingReplyTo(env);
  const count = (key: MarketingResult | 'no_owner' | HaleemResult) => (run.results[key] = (run.results[key] ?? 0) + 1);
  for (const row of rows) {
    const { shop, owner } = await loadShop(db, row, now);
    const step = stepFor(shop, row, now);
    if (!step) continue;
    run.due += 1;
    const warning = step === 'week-left' || step === 'last-day';
    // The preview counts shops with no owner to mail, then skips both sends.
    if (!owner) count('no_owner');
    if (dryRun) continue;
    if (owner) {
      const result = await sendMarketingEmail(
        {
          to: owner,
          topic: 'tips',
          kind: `trial-${step}`,
          // Scoped to the trial cycle (MAG-220 F1): an extension moves the
          // end, so the step fires again instead of hitting the old key.
          dedupeKey: `trial-${step}:${row.id}:${row.trial_ends_at}`,
          tenantId: row.id,
          fromName: step === 'last-day' ? 'Haleem at VVS Lab' : 'Karat from VVS Lab',
          replyTo,
          render: (unsubscribe) => trialEmail(step, shop, origin, unsubscribe),
        },
        env,
      ).catch((error: Error) => {
        console.error('trial email failed', row.id, step, error.message);
        return 'failed' as const;
      });
      count(result);
    }
    if (warning) {
      const haleem = await notifyHaleem(db, env, row, shop, step, owner, origin).catch((error: Error) => {
        console.error('trial haleem alert failed', row.id, step, error.message);
        return 'haleem_failed' as const;
      });
      count(haleem);
    }
  }
  return run;
}
