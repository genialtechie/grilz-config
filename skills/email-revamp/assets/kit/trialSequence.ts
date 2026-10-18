import { hasCard, TRIAL_DAYS, trialDaysLeft } from '../src/lib/trial.js';
import { createDb, hasDb, type Db } from './db.js';
import { marketingReplyTo, ownerEmail, sendMarketingEmail, type MarketingEnv, type MarketingResult } from './marketing.js';
import { trialEmail, type TrialShop, type TrialStep } from './trialEmails.js';

// The trial sequence, run once a day by /api/cron/marketing. Each shop on a
// free trial gets at most one email a day, and only the step that's due:
//   day 1  go live          (skip if live)
//   day 3  share the link   (skip if it already had a design request; not live → "still off")
//   day 7  card deposits    (skip if Stripe is connected)
//   3–2 days left  keep it on, with their numbers  (skip if a card is on file)
//   last day       a plain letter from Haleem      (skip if a card is on file)
// A step is only sent inside its window, so a missed day is skipped rather
// than stacked, and email_sends makes each step go out once per shop.

const DAY = 864e5;

export type ShopRow = {
  id: string;
  slug: string;
  name: string;
  status: string;
  plan: string | null;
  billing_status: string | null;
  trial_ends_at: string | null;
  stripe_charges_enabled: boolean | null;
};

/** The step due today, or null. */
export function stepFor(shop: TrialShop, row: Pick<ShopRow, 'trial_ends_at'>, now = Date.now()): TrialStep | null {
  if (!row.trial_ends_at) return null;
  const ends = new Date(row.trial_ends_at).getTime();
  if (ends <= now) return null;
  const day = Math.floor((now - (ends - TRIAL_DAYS * DAY)) / DAY);
  const left = shop.daysLeft;
  if (left === 1) return shop.hasCard ? null : 'day-14';
  if (left === 2 || left === 3) return shop.hasCard ? null : 'day-12';
  if (day === 7 || day === 8) return shop.stripeReady ? null : 'day-7';
  if (day === 3 || day === 4) return shop.leads > 0 ? null : 'day-3';
  if (day === 1 || day === 2) return shop.live ? null : 'day-1';
  return null;
}

async function loadShop(db: Db, row: ShopRow, now: number): Promise<{ shop: TrialShop; owner: string | null }> {
  const [published] = await db.select<{ version: number; logo: string | null }>('tenant_configs', {
    tenant_id: `eq.${row.id}`,
    status: 'eq.published',
    select: 'version,logo:config->brand->>logo',
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
      pricesSet: (published?.version ?? 0) > 1,
      leads: leads.length,
      estimates: leads.reduce((sum, lead) => sum + Number(lead.total || 0), 0),
      stripeReady: Boolean(row.stripe_charges_enabled),
      hasCard: hasCard(row),
      daysLeft: trialDaysLeft(row, now),
    },
  };
}

export type TrialRun = { shops: number; due: number; results: Partial<Record<MarketingResult | 'no_owner', number>> };

/** Sends today's trial emails. `dryRun` reports what would go out without sending. */
export async function runTrialSequence(env: MarketingEnv & { MARKETING_REPLY_TO?: string; PLATFORM_LEADS_EMAIL?: string }, { dryRun = false, now = Date.now() } = {}): Promise<TrialRun> {
  const run: TrialRun = { shops: 0, due: 0, results: {} };
  if (!hasDb(env)) return run;
  const db = createDb(env);
  const rows = await db.select<ShopRow>('tenants', {
    kind: 'eq.shop',
    created_via: 'eq.signup',
    plan: 'eq.trial',
    status: 'in.(draft,live)',
    trial_ends_at: `gt.${new Date(now).toISOString()}`,
    select: 'id,slug,name,status,plan,billing_status,trial_ends_at,stripe_charges_enabled',
  });
  run.shops = rows.length;
  const origin = env.PUBLIC_ORIGIN || 'https://vvslab.magpollo.com';
  const replyTo = marketingReplyTo(env);
  const count = (key: MarketingResult | 'no_owner') => (run.results[key] = (run.results[key] ?? 0) + 1);
  for (const row of rows) {
    const { shop, owner } = await loadShop(db, row, now);
    const step = stepFor(shop, row, now);
    if (!step) continue;
    run.due += 1;
    if (!owner) {
      count('no_owner');
      continue;
    }
    if (dryRun) continue;
    const result = await sendMarketingEmail(
      {
        to: owner,
        topic: 'tips',
        kind: `trial-${step}`,
        dedupeKey: `trial-${step}:${row.id}`,
        tenantId: row.id,
        fromName: step === 'day-14' ? 'Haleem at VVS Lab' : 'Karat from VVS Lab',
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
  return run;
}
