import { checkoutTrialEnd } from '../src/lib/trial.js';
import { createDb, hasDb, type Db } from './db.js';
import { verifyLeadToken, type LeadEnv } from './leads.js';
import { stripe, stripeV2, StripeError, verifyStripeSignature, type StripeEnv } from './stripe.js';
import type { ApiResult } from './tenantApi.js';
import { forgetTenant, type TenantEnv } from './tenants.js';

// Stage 5: money.
//   Billing — a shop's $199/mo subscription through Stripe Checkout (trial days
//   carried over), managed in the Stripe customer portal, kept in sync by webhooks.
//   Deposits — shops connect their own Stripe account (standard Connect account,
//   Stripe-hosted onboarding); customers pay the exact deposit there and the
//   webhook marks the lead "deposit paid". Money never passes through Magpollo.

export type BillingEnv = TenantEnv &
  StripeEnv &
  LeadEnv & {
    STRIPE_PRICE_ID?: string;
    STRIPE_WEBHOOK_SECRET?: string;
    STRIPE_CONNECT_WEBHOOK_SECRET?: string;
    PUBLIC_ORIGIN?: string;
  };

type Tenant = {
  id: string;
  slug: string;
  name: string;
  status: string;
  plan: string;
  trial_ends_at: string | null;
  stripe_customer_id: string | null;
  stripe_subscription_id: string | null;
  stripe_account_id: string | null;
  stripe_charges_enabled: boolean;
  billing_status: string;
};
const TENANT = 'id,slug,name,status,plan,trial_ends_at,stripe_customer_id,stripe_subscription_id,stripe_account_id,stripe_charges_enabled,billing_status';

const reply = (status: number, body: unknown): ApiResult => ({ status, body, headers: { 'Cache-Control': 'no-store' } });
const origin = (env: BillingEnv) => (env.PUBLIC_ORIGIN || 'https://vvslab.magpollo.com').replace(/\/$/, '');

/** Days past a failed payment before a shop's page is paused. */
export const GRACE_DAYS = 7;

async function tenantById(db: Db, id: string) {
  const [tenant] = await db.select<Tenant>('tenants', { id: `eq.${id}`, select: TENANT });
  return tenant ?? null;
}

const stripeFail = (error: unknown) => {
  console.error('stripe', error instanceof StripeError ? `${error.status} ${error.code}: ${error.message}` : error);
  return reply(error instanceof StripeError && error.code === 'not_configured' ? 503 : 502, { error: 'stripe', message: 'Payments aren’t available right now. Try again in a minute.' });
};

// ---------- Billing (owner actions from the dashboard) ----------

/** Checkout for the plan. Any trial days left carry over; the card is charged when the trial ends. */
export async function billingCheckout(db: Db, env: BillingEnv, tenantId: string, email: string | undefined): Promise<ApiResult> {
  if (!env.STRIPE_PRICE_ID) return reply(503, { error: 'not_configured', message: 'Billing isn’t switched on yet. Message VVS Lab.' });
  const tenant = await tenantById(db, tenantId);
  if (!tenant) return reply(404, { error: 'not_found' });
  if (['active', 'trialing', 'past_due'].includes(tenant.billing_status) && tenant.stripe_subscription_id) return billingPortal(db, env, tenantId);
  try {
    let customer = tenant.stripe_customer_id;
    if (!customer) {
      const created = await stripe<{ id: string }>(
        env,
        'POST',
        '/v1/customers',
        { email, name: tenant.name, metadata: { tenant_id: tenant.id, slug: tenant.slug } },
        { idempotencyKey: `customer-${tenant.id}` },
      );
      customer = created.id;
      await db.update('tenants', { id: `eq.${tenant.id}` }, { stripe_customer_id: customer });
    }
    // Trial days left carry over (the same whole days the dashboard shows), so
    // starting the plan early never costs a day. Within 48 hours, billing starts now.
    const trialEnd = checkoutTrialEnd(tenant);
    const back = `${origin(env)}/dashboard/${tenant.slug}`;
    const session = await stripe<{ url: string }>(
      env,
      'POST',
      '/v1/checkout/sessions',
      {
        mode: 'subscription',
        customer,
        client_reference_id: tenant.id,
        line_items: [{ price: env.STRIPE_PRICE_ID, quantity: 1 }],
        subscription_data: { metadata: { tenant_id: tenant.id }, trial_end: trialEnd ?? undefined },
        metadata: { tenant_id: tenant.id, purpose: 'plan' },
        allow_promotion_codes: true,
        success_url: `${back}?billing=done`,
        cancel_url: back,
      },
      { idempotencyKey: `plan-${tenant.id}-${Math.floor(Date.now() / 600_000)}` },
    );
    return reply(200, { url: session.url });
  } catch (error) {
    return stripeFail(error);
  }
}

/** The Stripe customer portal: change card, see invoices, cancel. */
export async function billingPortal(db: Db, env: BillingEnv, tenantId: string): Promise<ApiResult> {
  const tenant = await tenantById(db, tenantId);
  if (!tenant) return reply(404, { error: 'not_found' });
  if (!tenant.stripe_customer_id) return reply(409, { error: 'no_plan', message: 'Start your plan first.' });
  try {
    const session = await stripe<{ url: string }>(env, 'POST', '/v1/billing_portal/sessions', { customer: tenant.stripe_customer_id, return_url: `${origin(env)}/dashboard/${tenant.slug}` });
    return reply(200, { url: session.url });
  } catch (error) {
    return stripeFail(error);
  }
}

// ---------- Connect (a shop's own Stripe account, for deposits) ----------

/** Creates the shop's Stripe account if needed and returns a Stripe-hosted onboarding link. */
export async function connectOnboard(db: Db, env: BillingEnv, tenantId: string, email: string | undefined): Promise<ApiResult> {
  const tenant = await tenantById(db, tenantId);
  if (!tenant) return reply(404, { error: 'not_found' });
  try {
    let account = tenant.stripe_account_id;
    if (!account) {
      // Standard-style account: full Stripe Dashboard, the shop pays its own
      // Stripe fees, Stripe holds loss liability and collects KYC.
      const created = await stripeV2<{ id: string }>(
        env,
        'POST',
        '/v2/core/accounts',
        {
          contact_email: email,
          display_name: tenant.name,
          dashboard: 'full',
          identity: { country: 'us' },
          defaults: { responsibilities: { fees_collector: 'stripe', losses_collector: 'stripe' } },
          configuration: { merchant: { mcc: '5944', capabilities: { card_payments: { requested: true } } } },
          metadata: { tenant_id: tenant.id, slug: tenant.slug },
        },
        { idempotencyKey: `account-v2-${tenant.id}` },
      );
      account = created.id;
      await db.update('tenants', { id: `eq.${tenant.id}` }, { stripe_account_id: account });
    }
    const link = await stripeV2<{ url: string }>(env, 'POST', '/v2/core/account_links', {
      account,
      use_case: {
        type: 'account_onboarding',
        account_onboarding: {
          refresh_url: `${origin(env)}/dashboard/${tenant.slug}/shop?stripe=retry`,
          return_url: `${origin(env)}/dashboard/${tenant.slug}/shop?stripe=done`,
        },
      },
    });
    return reply(200, { url: link.url });
  } catch (error) {
    return stripeFail(error);
  }
}

/** Refreshes whether the shop's account can take card payments yet. */
export async function connectStatus(db: Db, env: BillingEnv, tenantId: string): Promise<ApiResult> {
  const tenant = await tenantById(db, tenantId);
  if (!tenant) return reply(404, { error: 'not_found' });
  if (!tenant.stripe_account_id) return reply(200, { connected: false, chargesEnabled: false });
  try {
    const account = await stripe<{ charges_enabled: boolean; details_submitted: boolean; requirements?: { currently_due?: string[] } }>(env, 'GET', `/v1/accounts/${tenant.stripe_account_id}`);
    if (account.charges_enabled !== tenant.stripe_charges_enabled) await db.update('tenants', { id: `eq.${tenant.id}` }, { stripe_charges_enabled: account.charges_enabled });
    return reply(200, { connected: true, chargesEnabled: account.charges_enabled, detailsSubmitted: account.details_submitted, due: account.requirements?.currently_due?.length ?? 0 });
  } catch (error) {
    return stripeFail(error);
  }
}

// ---------- Deposit checkout (customer, right after sending a design) ----------

/** POST /api/deposit { leadId, token }: a Checkout page on the shop's account for the lead's exact deposit. */
export async function handleDeposit(payload: unknown, env: BillingEnv): Promise<ApiResult> {
  const body = payload && typeof payload === 'object' ? (payload as Record<string, unknown>) : {};
  if (!hasDb(env)) return reply(503, { error: 'unavailable' });
  const db = createDb(env);
  const leadId = typeof body.leadId === 'string' ? body.leadId : '';
  const [lead] = leadId ? await db.select<{ id: string; tenant_id: string; deposit: number | null; deposit_paid_at: string | null; spec: { summary?: string[] } }>('leads', { id: `eq.${leadId}`, select: 'id,tenant_id,deposit,deposit_paid_at,spec' }) : [];
  // The lead token proves this browser just sent this design (valid 30 minutes).
  if (!lead || !verifyLeadToken(leadId, lead.tenant_id, body.token, env)) return reply(403, { error: 'expired', message: 'This link expired. The shop will reach out about your deposit.' });
  if (lead.deposit_paid_at) return reply(409, { error: 'paid', message: 'Your deposit is already paid.' });
  if (!lead.deposit || lead.deposit <= 0) return reply(409, { error: 'no_deposit' });
  const tenant = await tenantById(db, lead.tenant_id);
  if (!tenant?.stripe_account_id || !tenant.stripe_charges_enabled || tenant.status !== 'live') return reply(409, { error: 'not_available', message: 'Card deposits aren’t available for this shop. They’ll reach out to you.' });
  try {
    const summary = (lead.spec.summary ?? []).join(' · ').slice(0, 480) || 'Custom grillz';
    const back = `${origin(env)}/b/${tenant.slug}`;
    const session = await stripe<{ id: string; url: string }>(
      env,
      'POST',
      '/v1/checkout/sessions',
      {
        mode: 'payment',
        line_items: [{ quantity: 1, price_data: { currency: 'usd', unit_amount: Math.round(Number(lead.deposit) * 100), product_data: { name: `Deposit · ${tenant.name}`, description: summary } } }],
        payment_intent_data: { description: `Deposit for custom grillz: ${summary}`.slice(0, 1000), metadata: { lead_id: lead.id, tenant_id: tenant.id } },
        metadata: { lead_id: lead.id, tenant_id: tenant.id, purpose: 'deposit' },
        success_url: `${back}?deposit=paid`,
        cancel_url: back,
      },
      { account: tenant.stripe_account_id, idempotencyKey: `deposit-${lead.id}-${Math.floor(Date.now() / 600_000)}` },
    );
    await db.update('leads', { id: `eq.${lead.id}` }, { deposit_checkout_id: session.id });
    return reply(200, { url: session.url });
  } catch (error) {
    return stripeFail(error);
  }
}

// ---------- Webhooks ----------

type StripeEvent = { id: string; type: string; account?: string; data: { object: Record<string, unknown> } };
const statusFrom = (status: string): string => (['trialing', 'active', 'past_due', 'canceled'].includes(status) ? status : status === 'unpaid' ? 'past_due' : status === 'incomplete_expired' ? 'canceled' : 'none');

async function applySubscription(db: Db, subscription: Record<string, unknown>) {
  const customer = String(subscription.customer ?? '');
  const tenantId = (subscription.metadata as Record<string, string> | undefined)?.tenant_id;
  const filter: Record<string, string> = tenantId ? { id: `eq.${tenantId}` } : { stripe_customer_id: `eq.${customer}` };
  const status = statusFrom(String(subscription.status ?? ''));
  const items = (subscription.items as { data?: { current_period_end?: number }[] } | undefined)?.data ?? [];
  const periodEnd = Number(items[0]?.current_period_end ?? subscription.current_period_end ?? 0);
  const [tenant] = await db.select<Tenant & { past_due_since: string | null }>('tenants', { ...filter, select: `${TENANT},past_due_since` });
  if (!tenant) return;
  await db.update('tenants', { id: `eq.${tenant.id}` }, {
    stripe_subscription_id: String(subscription.id ?? ''),
    stripe_customer_id: customer || tenant.stripe_customer_id,
    billing_status: status,
    plan: status === 'active' || status === 'trialing' || status === 'past_due' ? 'paid' : tenant.plan === 'paid' ? 'canceled' : tenant.plan,
    current_period_end: periodEnd ? new Date(periodEnd * 1000).toISOString() : null,
    past_due_since: status === 'past_due' ? tenant.past_due_since ?? new Date().toISOString() : null,
  });
  // A paying shop that had been paused for billing comes back on.
  if ((status === 'active' || status === 'trialing') && tenant.status === 'paused' && (tenant.billing_status === 'past_due' || tenant.billing_status === 'canceled' || tenant.plan === 'trial')) {
    await db.update('tenants', { id: `eq.${tenant.id}`, status: 'eq.paused' }, { status: 'live' });
  }
  if (status === 'canceled') await db.update('tenants', { id: `eq.${tenant.id}`, status: 'eq.live' }, { status: 'paused' });
  // Billing decides whether the public page is on (status, and the trial gate), so
  // the page must not wait for its cache to expire.
  await forgetTenant(tenant.slug);
}

async function applyDeposit(db: Db, session: Record<string, unknown>, account: string | undefined) {
  const metadata = (session.metadata as Record<string, string> | undefined) ?? {};
  if (metadata.purpose !== 'deposit' || session.payment_status !== 'paid' || !metadata.lead_id) return;
  const [lead] = await db.select<{ id: string; tenant_id: string; status: string; deposit_paid_at: string | null }>('leads', { id: `eq.${metadata.lead_id}`, select: 'id,tenant_id,status,deposit_paid_at' });
  if (!lead || lead.deposit_paid_at) return;
  // The event must come from the account that belongs to the lead's shop.
  const [tenant] = await db.select<{ stripe_account_id: string | null }>('tenants', { id: `eq.${lead.tenant_id}`, select: 'stripe_account_id' });
  if (!tenant?.stripe_account_id || tenant.stripe_account_id !== account) return;
  const now = new Date().toISOString();
  await db.update('leads', { id: `eq.${lead.id}` }, { deposit_paid_at: now, ...(lead.status === 'new' || lead.status === 'contacted' ? { status: 'deposit_paid' } : {}) });
  await db.insert('lead_events', { lead_id: lead.id, tenant_id: lead.tenant_id, type: 'deposit_paid', data: { amount: Number(session.amount_total ?? 0) / 100, checkout: session.id } });
}

/** POST /api/stripe/webhook (platform events) and ?connect=1 (events from shops' accounts). */
export async function handleStripeWebhook(rawBody: string, signature: string | null, connect: boolean, env: BillingEnv): Promise<ApiResult> {
  const secret = connect ? env.STRIPE_CONNECT_WEBHOOK_SECRET : env.STRIPE_WEBHOOK_SECRET;
  if (!verifyStripeSignature(rawBody, signature, secret)) return reply(400, { error: 'signature' });
  if (!hasDb(env)) return reply(503, { error: 'unavailable' });
  const event = JSON.parse(rawBody) as StripeEvent;
  const db = createDb(env);
  // Each event applies once; a retry of a handled event is acknowledged.
  const seen = await db.count('stripe_events', { id: `eq.${event.id}` });
  if (seen) return reply(200, { received: true, duplicate: true });
  const object = event.data.object;
  switch (event.type) {
    case 'customer.subscription.created':
    case 'customer.subscription.updated':
    case 'customer.subscription.deleted':
      if (!connect) await applySubscription(db, object);
      break;
    case 'checkout.session.completed':
    case 'checkout.session.async_payment_succeeded':
      if (connect) await applyDeposit(db, object, event.account);
      break;
    case 'account.updated':
      if (connect && event.account) await db.update('tenants', { stripe_account_id: `eq.${event.account}` }, { stripe_charges_enabled: Boolean(object.charges_enabled) });
      break;
    default:
      break;
  }
  await db.insert('stripe_events', { id: event.id, type: event.type }).catch(() => undefined);
  return reply(200, { received: true });
}

// ---------- Daily: trials and grace periods ----------

/** Pauses live shops whose trial ended without a plan, or whose payment failed more than GRACE_DAYS ago. */
export async function enforceBilling(env: TenantEnv) {
  if (!hasDb(env)) return { paused: 0 };
  const db = createDb(env);
  const now = new Date().toISOString();
  const grace = new Date(Date.now() - GRACE_DAYS * 864e5).toISOString();
  const trialOver = await db.update<{ id: string }>('tenants', { status: 'eq.live', plan: 'eq.trial', billing_status: 'in.(none,canceled)', trial_ends_at: `lt.${now}` }, { status: 'paused' });
  const unpaid = await db.update<{ id: string }>('tenants', { status: 'eq.live', billing_status: 'eq.past_due', past_due_since: `lt.${grace}` }, { status: 'paused' });
  return { paused: trialOver.length + unpaid.length, trialOver: trialOver.length, unpaid: unpaid.length };
}

