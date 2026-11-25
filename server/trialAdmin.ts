import { extendTrialEnd, hasCard, trialEndForDate, trialExpired } from '../src/lib/trial.js';
import type { Db } from './db.js';
import type { ApiResult } from './tenantApi.js';
import { forgetTenant } from './tenants.js';

// Admin: extend a shop's trial (MAG-220). Only platform admins (checked by the
// caller). The extension is written to tenant_events first, so a failed write
// never leaves a trial moved without a log of who moved it.
//
// Days count from the later of now and the current end; a picked date is the
// end of that day (UTC). A shop paused because its trial ended comes back live
// when the trial is extended — that's the point of extending it.

type TenantRow = { id: string; slug: string; name: string; kind: string; status: string; plan: string | null; trial_ends_at: string | null; billing_status: string | null };

const reply = (status: number, body: unknown): ApiResult => ({ status, body, headers: { 'Cache-Control': 'no-store' } });

export type ExtendOption = { days: number } | { date: string };

function newEnd(option: ExtendOption, current: string | null, now: number): string | null {
  if ('days' in option) {
    if (!Number.isInteger(option.days) || option.days < 1 || option.days > 365) return null;
    return extendTrialEnd(current, option.days, now);
  }
  return trialEndForDate(option.date, now);
}

export async function extendTrial(db: Db, adminId: string, tenantId: string, option: ExtendOption, now = Date.now()): Promise<ApiResult> {
  const [tenant] = await db.select<TenantRow>('tenants', { id: `eq.${tenantId}`, select: 'id,slug,name,kind,status,plan,trial_ends_at,billing_status' });
  if (!tenant) return reply(404, { error: 'not_found' });
  if (tenant.kind !== 'shop') return reply(409, { error: 'not_shop', message: 'Only shops have trials.' });
  if (tenant.status === 'offboarded') return reply(409, { error: 'closed', message: 'This shop is closed.' });
  // Only a shop on a free trial can be extended: a founding shop has no trial
  // to extend (extending it would write an end date nothing reads), and a
  // shop with a card is Stripe's — its trial is the checkout's, not ours.
  // A trial with no end date yet stays extendable: extending gives it an end.
  if (tenant.plan !== 'trial' || hasCard(tenant)) return reply(409, { error: 'not_on_trial', message: 'This shop is not on a trial.' });
  const endsAt = newEnd(option, tenant.trial_ends_at, now);
  if (!endsAt) return reply(400, { error: 'invalid', message: 'Pick a number of days, or a future date.' });
  // A paused shop whose trial ran out comes back on; a shop paused by hand
  // while its trial still runs stays paused.
  const restore = tenant.status === 'paused' && trialExpired(tenant, now) && !hasCard(tenant);
  const from = tenant.trial_ends_at;
  await db.insert('tenant_events', {
    tenant_id: tenant.id,
    type: 'trial_extended',
    actor: adminId,
    data: { from, to: endsAt, ...('days' in option ? { days: option.days } : { date: option.date }), restored: restore },
  });
  await db.update('tenants', { id: `eq.${tenant.id}` }, { trial_ends_at: endsAt, ...(restore ? { status: 'live' } : {}) });
  await forgetTenant(tenant.slug);
  return reply(200, { ok: true, endsAt, restored: restore });
}
