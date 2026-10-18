import { createElement as h, type ReactElement } from 'react';
import { render } from '@react-email/render';
import { createDb, hasDb, type Db } from './db.js';
import { vvsBrand } from './email/brand.js';
import { CTA, EmailFrame, Headline, Illustration, InlineLink, Paragraph, SignOff } from './email/components.js';
import type { RenderedEmail } from './emailTemplates.js';
import { marketingReplyTo, ownerEmail, sendMarketingEmail, type MarketingEnv, type MarketingResult } from './marketing.js';

// Win-back (marketing, topic "tips"), run daily by /api/cron/marketing.
// For shops whose builder is paused because the trial ended without a plan,
// or because the plan was cancelled. Not for a failed payment (that's billing,
// handled in the dashboard) and not for shops that chose to leave (offboarded).
// Duolingo's pattern: no guilt, a loss-framed fact, one easy way back, then stop.
//   +7 days   "Your builder is paused"        their saved work, switch it back on
//   +30 days  "Should we stop emailing you?"  the last one
// Paused shops keep their designs, prices and requests (retention only
// deletes leads after 24 months, or 90 days after offboarding).

const DAY = 864e5;

export type WinbackStep = 'paused' | 'last';
export type WinbackShop = { id: string; slug: string; name: string; reason: 'trial' | 'canceled'; since: string; leads: number };

type Row = { id: string; slug: string; name: string; plan: string | null; billing_status: string | null; trial_ends_at: string | null; current_period_end: string | null };

const html = (element: ReactElement) => render(element);
const base = (origin: string) => origin.replace(/\/$/, '');
const dashboard = (origin: string, shop: WinbackShop) => `${base(origin)}/dashboard/${shop.slug}?utm_source=email&utm_medium=winback`;
const possessive = (name: string) => (/s$/i.test(name) ? `${name}'` : `${name}'s`);
const longDate = (iso: string) => new Date(iso).toLocaleDateString('en-US', { month: 'long', day: 'numeric', timeZone: 'America/New_York' });

/** When the shop was paused and why, or null if it isn't a win-back case. */
export function pausedSince(row: Row): { reason: 'trial' | 'canceled'; since: string } | null {
  if (row.billing_status === 'past_due') return null;
  if (row.plan === 'trial' && row.trial_ends_at && !['trialing', 'active'].includes(row.billing_status ?? '')) return { reason: 'trial', since: row.trial_ends_at };
  if (row.plan === 'canceled' && row.current_period_end) return { reason: 'canceled', since: row.current_period_end };
  return null;
}

/** The step due `now`, inside its window (missed → skipped, never stacked). */
export function winbackStepFor(since: string, now = Date.now()): WinbackStep | null {
  const days = (now - new Date(since).getTime()) / DAY;
  if (days >= 7 && days < 9) return 'paused';
  if (days >= 30 && days < 32) return 'last';
  return null;
}

export async function winbackEmail(step: WinbackStep, shop: WinbackShop, origin: string, unsubscribe: string): Promise<RenderedEmail> {
  const brand = vvsBrand(origin);
  const footer = { reason: `You're getting this because ${shop.name} had a VVS Lab builder.`, unsubscribe };
  const saved = shop.leads > 0 ? `your designs, prices and ${shop.leads} design request${shop.leads === 1 ? '' : 's'}` : 'your designs and prices';
  const why = shop.reason === 'trial' ? 'when the free trial ended' : 'when the plan ended';
  const link = dashboard(origin, shop);

  if (step === 'paused') {
    const subject = 'Your builder is paused';
    const element = h(
      EmailFrame,
      { brand, title: subject, preheader: `Everything's saved. Start your plan and it's back on right away.`, footer },
      h(Headline, { brand, align: 'center', size: 50, text: 'Your builder is *paused*' }),
      h(Illustration, { src: `${base(origin)}/assets/mascot/karat-tarnished.png`, width: 168, alt: '' }),
      h(Paragraph, { brand, margin: '18px 0 16px' }, 'Hey there,'),
      h(Paragraph, { brand }, `${possessive(shop.name)} builder switched off ${why}, on ${longDate(shop.since)}. Customers who open your link can't send designs right now.`),
      h(Paragraph, { brand }, `Nothing's lost: ${saved} are saved. Start your plan and the builder is back on right away, exactly as you left it.`),
      h(Paragraph, { brand }, h('strong', null, '$199 a month'), ', cancel any time.'),
      h(CTA, { brand, href: link }, 'Switch it back on'),
      h(SignOff, { brand }),
    );
    return {
      subject,
      html: await html(element),
      text: `${possessive(shop.name)} builder switched off ${why}, on ${longDate(shop.since)}.\n\nNothing's lost: ${saved} are saved. Start your plan ($199/mo, cancel any time) and it's back on right away: ${link}\n\nUnsubscribe: ${unsubscribe}`,
    };
  }

  const subject = 'Should we stop emailing you?';
  const element = h(
    EmailFrame,
    { brand, title: subject, preheader: 'This is the last email about your paused builder.', footer },
    h(Paragraph, { brand, margin: '8px 0 16px' }, 'Hey there,'),
    h(Paragraph, { brand }, `${possessive(shop.name)} builder has been paused for a month, so this is the last email we'll send about it.`),
    h(Paragraph, { brand }, `It's all still there (${saved}) and comes back the moment you start your plan.`),
    h(Paragraph, { brand }, 'If VVS Lab wasn’t right for you, would you tell us why? Just reply. And if you’re done, you don’t need to do anything.'),
    h(CTA, { brand, href: link }, 'Switch it back on'),
    h(Paragraph, { brand, muted: true, size: 14, margin: '0' }, 'Or sign in any time at ', h(InlineLink, { brand, href: link }, `${base(origin).replace(/^https?:\/\//, '')}/dashboard`), '.'),
    h(SignOff, { brand }),
  );
  return {
    subject,
    html: await html(element),
    text: `${possessive(shop.name)} builder has been paused for a month, so this is the last email we'll send about it.\n\nIt's all still there and comes back the moment you start your plan: ${link}\n\nIf VVS Lab wasn't right for you, just reply and tell us why.\n\nUnsubscribe: ${unsubscribe}`,
  };
}

export type WinbackRun = { shops: number; due: number; results: Partial<Record<MarketingResult | 'no_owner', number>> };

async function leadCount(db: Db, tenantId: string) {
  return db.count('leads', { tenant_id: `eq.${tenantId}` });
}

export async function runWinback(env: MarketingEnv & { MARKETING_REPLY_TO?: string; PLATFORM_LEADS_EMAIL?: string }, { dryRun = false, now = Date.now() } = {}): Promise<WinbackRun> {
  const run: WinbackRun = { shops: 0, due: 0, results: {} };
  if (!hasDb(env)) return run;
  const db = createDb(env);
  const rows = await db.select<Row>('tenants', {
    kind: 'eq.shop',
    status: 'eq.paused',
    plan: 'in.(trial,canceled)',
    select: 'id,slug,name,plan,billing_status,trial_ends_at,current_period_end',
  });
  run.shops = rows.length;
  const origin = env.PUBLIC_ORIGIN || 'https://vvslab.magpollo.com';
  const count = (key: MarketingResult | 'no_owner') => (run.results[key] = (run.results[key] ?? 0) + 1);
  for (const row of rows) {
    const paused = pausedSince(row);
    const step = paused && winbackStepFor(paused.since, now);
    if (!paused || !step) continue;
    run.due += 1;
    const owner = await ownerEmail(db, row.id);
    if (!owner) {
      count('no_owner');
      continue;
    }
    if (dryRun) continue;
    const shop: WinbackShop = { id: row.id, slug: row.slug, name: row.name, ...paused, leads: await leadCount(db, row.id) };
    const result = await sendMarketingEmail(
      {
        to: owner,
        topic: 'tips',
        kind: `winback-${step}`,
        // Keyed to the pause, so a shop that comes back and is paused again later gets them again.
        dedupeKey: `winback-${step}:${row.id}:${paused.since.slice(0, 10)}`,
        tenantId: row.id,
        fromName: 'Karat from VVS Lab',
        replyTo: marketingReplyTo(env),
        render: (unsubscribe) => winbackEmail(step, shop, origin, unsubscribe),
      },
      env,
    ).catch((error: Error) => {
      console.error('win-back email failed', row.id, step, error.message);
      return 'failed' as const;
    });
    count(result);
  }
  return run;
}
