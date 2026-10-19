import { createDb, hasDb } from './db.js';
import { sendEmail, type EmailEnv } from './email.js';
import { latestSpot, STALE_MS } from './metalPrices.js';
import type { TenantEnv } from './tenants.js';

// Daily spend and error alerts, run by the cron after retention and billing.
// Emails ALERT_EMAIL (or PLATFORM_LEADS_EMAIL) only when something needs a
// look; a quiet day sends nothing. Covers what /api/health can't: money
// running out and failures that already happened.

export type AlertEnv = TenantEnv &
  EmailEnv & {
    FLUX_API_KEY?: string;
    RENDER_DAILY_GENERATIONS?: string;
    ALERT_EMAIL?: string;
    PLATFORM_LEADS_EMAIL?: string;
    /** Below this many Black Forest Labs credits (1 credit = $0.01), warn. */
    ALERT_LOW_CREDITS?: string;
  };

/** Rough cost of one generation, to show spend in dollars. */
const DOLLARS_PER_GENERATION = 0.07;
const DEFAULT_DAILY_GENERATIONS = 45;
const DEFAULT_LOW_CREDITS = 1000;

async function bflCredits(apiKey: string | undefined): Promise<number | null> {
  if (!apiKey) return null;
  try {
    const response = await fetch('https://api.bfl.ai/v1/credits', { headers: { 'x-key': apiKey, accept: 'application/json' } });
    if (!response.ok) return null;
    const { credits } = (await response.json()) as { credits?: number };
    return typeof credits === 'number' ? credits : null;
  } catch {
    return null;
  }
}

export async function dailyAlerts(env: AlertEnv, now = Date.now()) {
  if (!hasDb(env)) return { ok: false, error: 'database not configured' };
  const db = createDb(env);
  const since = new Date(now - 864e5).toISOString();
  const [usage, failedEmails, credits, spot] = await Promise.all([
    db.select<{ generations: number; outcome: string }>('render_usage', { created_at: `gte.${since}`, select: 'generations,outcome' }),
    db.count('lead_events', { type: 'eq.email_failed', created_at: `gte.${since}` }),
    bflCredits(env.FLUX_API_KEY),
    latestSpot(env),
  ]);
  const generations = usage.reduce((sum, row) => sum + (row.generations || 0), 0);
  const paused = usage.filter((row) => row.outcome === 'paused').length;
  const failed = usage.filter((row) => row.outcome === 'failed').length;
  const dailyCap = Number(env.RENDER_DAILY_GENERATIONS) || DEFAULT_DAILY_GENERATIONS;
  const lowCredits = Number(env.ALERT_LOW_CREDITS) || DEFAULT_LOW_CREDITS;

  const reasons: { title: string; detail: string }[] = [];
  const add = (title: string, detail: string) => reasons.push({ title, detail });
  if (credits !== null && credits < lowCredits) add('AI photo credits low', `Black Forest Labs credits are low: ${credits} left (about ${Math.floor(credits / 7)} studio-photo generations). Top up before photos pause.`);
  if (env.FLUX_API_KEY && credits === null) add('AI photo credits unknown', 'Couldn’t read the Black Forest Labs credit balance. Check FLUX_API_KEY and the BFL account.');
  if (generations >= dailyCap * 0.8) add('AI photo budget nearly used', `AI photos used ${generations} of the ${dailyCap}-generation daily budget in the last 24 hours (about $${(generations * DOLLARS_PER_GENERATION).toFixed(2)}).`);
  if (paused) add('Studio photos refused', `${paused} studio photo${paused === 1 ? ' was' : 's were'} refused (budget, allowance or credits). Customers saw the 3D preview instead.`);
  if (failed >= 3) add('Studio photos failing', `${failed} studio photos failed at Black Forest Labs in the last 24 hours.`);
  // Only matters once a shop prices metal from the market; the last good price keeps quoting meanwhile.
  if (spot && now - Date.parse(spot.asOf) > STALE_MS) add('Metal prices stale', `Metal prices haven't updated since ${spot.asOf.slice(0, 10)} (Yahoo Finance and gold-api.com both failing). Market-linked quotes are using that price.`);
  if (failedEmails) add('Emails failing', `${failedEmails} email${failedEmails === 1 ? '' : 's'} to shops or customers failed to send. Leads are saved; check Resend logs.`);

  const summary = { ok: true, generations, paused, failed, failedEmails, credits, alerted: reasons.length > 0 };
  const to = env.ALERT_EMAIL || env.PLATFORM_LEADS_EMAIL;
  if (!reasons.length || !to) return summary;

  const text = `VVS Lab daily check found ${reasons.length} thing${reasons.length === 1 ? '' : 's'} to look at:\n\n${reasons.map((reason) => `- ${reason.detail}`).join('\n')}\n\nRunbook: docs/runbooks/incident.md`;
  const html = `<div style="font-family:-apple-system,Segoe UI,Roboto,Helvetica,Arial,sans-serif;font-size:15px;line-height:1.5;color:#1b1714;max-width:560px">
<p style="margin:0 0 12px">VVS Lab daily check found ${reasons.length} thing${reasons.length === 1 ? '' : 's'} to look at:</p>
<ul style="margin:0 0 12px;padding-left:20px">${reasons.map((reason) => `<li style="margin:0 0 6px">${reason.detail.replace(/[<>&]/g, '')}</li>`).join('')}</ul>
<p style="margin:0;color:#8a8178;font-size:13px">Runbook: docs/runbooks/incident.md</p></div>`;
  const sent = await sendEmail({ fromName: 'VVS Lab alerts', fromLocal: 'hello', to: [to], subject: `VVS Lab alert: ${reasons.map((reason) => reason.title).join(', ')}`, text, html }, env);
  return { ...summary, emailed: sent.ok };
}
