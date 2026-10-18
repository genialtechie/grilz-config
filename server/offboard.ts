import type { Db } from './db.js';
import { removeDomain, type DomainEnv } from './domains.js';
import { stripe, StripeError, type StripeEnv } from './stripe.js';
import type { ApiResult } from './tenantApi.js';

// Offboarding a shop (platform admins, POST /api/dashboard/offboard). Three steps,
// each safe to run again, so a retry finishes whatever failed:
//   1. close the page (status 'offboarded'; leads stay exportable for 90 days),
//   2. set the plan to cancel at the end of the paid period (no refund needed),
//   3. remove the custom domain from Vercel and from tenant_domains.
// The shop's own Stripe account (deposits) is theirs and is left alone; card
// deposits stop because the page is no longer live. Logos are deleted with the
// leads by the daily retention job.

export type OffboardEnv = StripeEnv & DomainEnv;

type Step = { ok: boolean; detail: string };

const BILLED = ['trialing', 'active', 'past_due'];

export async function offboardTenant(db: Db, env: OffboardEnv, tenantId: string): Promise<ApiResult> {
  const reply = (status: number, body: unknown): ApiResult => ({ status, body, headers: { 'Cache-Control': 'no-store' } });
  const [tenant] = await db.select<{ id: string; name: string; status: string; stripe_subscription_id: string | null; billing_status: string }>('tenants', {
    id: `eq.${tenantId}`,
    select: 'id,name,status,stripe_subscription_id,billing_status',
  });
  if (!tenant) return reply(404, { error: 'not_found' });

  const steps: Record<'page' | 'subscription' | 'domain', Step> = {
    page: { ok: false, detail: '' },
    subscription: { ok: false, detail: '' },
    domain: { ok: false, detail: '' },
  };

  try {
    if (tenant.status !== 'offboarded') await db.update('tenants', { id: `eq.${tenant.id}`, status: 'neq.offboarded' }, { status: 'offboarded' });
    steps.page = { ok: true, detail: 'Page closed.' };
  } catch (error) {
    console.error('offboard page', tenant.id, error instanceof Error ? error.message : error);
    steps.page = { ok: false, detail: 'Couldn’t close the page.' };
  }

  if (!tenant.stripe_subscription_id || !BILLED.includes(tenant.billing_status)) {
    steps.subscription = { ok: true, detail: 'No active plan.' };
  } else {
    try {
      const subscription = await stripe<{ cancel_at: number | null }>(
        env,
        'POST',
        `/v1/subscriptions/${encodeURIComponent(tenant.stripe_subscription_id)}`,
        // No idempotency key: this update is already safe to repeat, and a fixed key
        // would replay a cached failure (or a success from before an undo) for 24 hours.
        { cancel_at_period_end: true, metadata: { offboarded: 'true' } },
      );
      const ends = subscription.cancel_at ? new Date(subscription.cancel_at * 1000).toISOString().slice(0, 10) : null;
      // A past-due plan still has an open invoice that Stripe keeps retrying.
      const after = tenant.billing_status === 'past_due' ? 'Stripe may still collect the unpaid invoice.' : 'No further charges.';
      steps.subscription = { ok: true, detail: ends ? `Plan ends ${ends}. ${after}` : `Plan set to end at period end. ${after}` };
    } catch (error) {
      console.error('offboard subscription', tenant.id, error instanceof StripeError ? `${error.status} ${error.code}` : error);
      steps.subscription = { ok: false, detail: 'Couldn’t cancel the plan in Stripe.' };
    }
  }

  try {
    const removed = await removeDomain(db, env, tenant.id);
    const body = removed.body as { removed?: boolean };
    steps.domain = removed.status === 200 ? { ok: true, detail: body.removed ? 'Custom domain removed.' : 'No custom domain.' } : { ok: false, detail: 'Couldn’t remove the custom domain.' };
  } catch (error) {
    console.error('offboard domain', tenant.id, error instanceof Error ? error.message : error);
    steps.domain = { ok: false, detail: 'Couldn’t remove the custom domain.' };
  }

  const ok = Object.values(steps).every((step) => step.ok);
  console.log('offboard', JSON.stringify({ tenant: tenant.id, ok, steps: Object.fromEntries(Object.entries(steps).map(([key, step]) => [key, step.ok])) }));
  const summary = Object.values(steps).map((step) => step.detail).join(' ');
  return reply(ok ? 200 : 502, { ok, steps, message: ok ? `${tenant.name} is offboarded. ${summary}` : `${summary} Run Offboard again to finish.` });
}
