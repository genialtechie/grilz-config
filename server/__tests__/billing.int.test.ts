import { createHmac } from 'node:crypto';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { billingCheckout, connectOnboard, connectStatus, enforceBilling, handleDeposit, handleStripeWebhook } from '../billing';
import { createDb } from '../db';
import { leadToken } from '../leads';

// Billing and deposits against a local Supabase and the real Stripe test API.
// Webhooks are signed locally with test secrets. Skipped unless both are set:
//   INTEGRATION_SUPABASE_URL, INTEGRATION_SERVICE_KEY, INTEGRATION_STRIPE_KEY (sk_test_…), INTEGRATION_STRIPE_PRICE

const url = process.env.INTEGRATION_SUPABASE_URL;
const key = process.env.INTEGRATION_SERVICE_KEY;
const stripeKey = process.env.INTEGRATION_STRIPE_KEY;
const price = process.env.INTEGRATION_STRIPE_PRICE;
const env = {
  SUPABASE_URL: url ?? '',
  SUPABASE_SERVICE_ROLE_KEY: key ?? '',
  STRIPE_SECRET_KEY: stripeKey,
  STRIPE_PRICE_ID: price,
  STRIPE_WEBHOOK_SECRET: 'whsec_platform_test',
  STRIPE_CONNECT_WEBHOOK_SECRET: 'whsec_connect_test',
  LEAD_TOKEN_SECRET: 'lead-secret',
  PUBLIC_ORIGIN: 'https://shop.test',
};
const stamp = Date.now();
const slug = `billing-${stamp}`;
let tenantId = '';
let leadId = '';

const sign = (body: string, secret: string) => {
  const t = Math.floor(Date.now() / 1000);
  return `t=${t},v1=${createHmac('sha256', secret).update(`${t}.${body}`).digest('hex')}`;
};
const event = (type: string, object: Record<string, unknown>, account?: string) => JSON.stringify({ id: `evt_${type}_${stamp}_${Math.random()}`, type, account, data: { object } });

describe.skipIf(!url || !key || !stripeKey?.startsWith('sk_test_') || !price)('billing and deposits (integration)', () => {
  const db = () => createDb(env);
  beforeAll(async () => {
    const tenant = await db().insert<{ id: string }>('tenants', { slug, name: 'Billing Test Gold', kind: 'shop', status: 'live', plan: 'trial', trial_ends_at: new Date(Date.now() + 7 * 864e5).toISOString() });
    tenantId = tenant.id;
    const lead = await db().insert<{ id: string }>('leads', { tenant_id: tenantId, name: 'Ava', contact: '@ava', spec: { summary: ['6 top', 'Yellow gold'] }, price: {}, total: 1300, deposit: 330, config_version: 1 });
    leadId = lead.id;
  });
  afterAll(async () => {
    await db().remove('tenants', { id: `eq.${tenantId}` });
  });

  it('starts a plan: Stripe customer created, Checkout with the trial carried over', async () => {
    const result = await billingCheckout(db(), env, tenantId, `owner-${stamp}@billing.test`);
    expect(result.status).toBe(200);
    expect((result.body as { url: string }).url).toMatch(/^https:\/\/checkout\.stripe\.com\//);
    const [tenant] = await db().select<{ stripe_customer_id: string }>('tenants', { id: `eq.${tenantId}`, select: 'stripe_customer_id' });
    expect(tenant.stripe_customer_id).toMatch(/^cus_/);
  });

  it('applies subscription webhooks, and refuses bad signatures', async () => {
    const [tenant] = await db().select<{ stripe_customer_id: string }>('tenants', { id: `eq.${tenantId}`, select: 'stripe_customer_id' });
    const subscription = { id: `sub_${stamp}`, customer: tenant.stripe_customer_id, status: 'trialing', metadata: { tenant_id: tenantId }, items: { data: [{ current_period_end: Math.floor(Date.now() / 1000) + 7 * 86400 }] } };
    const body = event('customer.subscription.created', subscription);
    expect((await handleStripeWebhook(body, sign(body, 'wrong'), false, env)).status).toBe(400);
    expect((await handleStripeWebhook(body, sign(body, env.STRIPE_WEBHOOK_SECRET), false, env)).status).toBe(200);
    let [row] = await db().select<{ billing_status: string; plan: string; stripe_subscription_id: string }>('tenants', { id: `eq.${tenantId}`, select: 'billing_status,plan,stripe_subscription_id' });
    expect(row).toMatchObject({ billing_status: 'trialing', plan: 'paid', stripe_subscription_id: `sub_${stamp}` });
    // the same event again is acknowledged and not re-applied
    expect((await handleStripeWebhook(body, sign(body, env.STRIPE_WEBHOOK_SECRET), false, env)).body).toMatchObject({ duplicate: true });

    const past = event('customer.subscription.updated', { ...subscription, status: 'past_due' });
    await handleStripeWebhook(past, sign(past, env.STRIPE_WEBHOOK_SECRET), false, env);
    [row] = await db().select('tenants', { id: `eq.${tenantId}`, select: 'billing_status,plan,stripe_subscription_id' });
    expect(row.billing_status).toBe('past_due');
    // grace period: not paused yet; 8 days later it is
    expect((await enforceBilling(env)).unpaid).toBe(0);
    await db().update('tenants', { id: `eq.${tenantId}` }, { past_due_since: new Date(Date.now() - 8 * 864e5).toISOString() });
    await enforceBilling(env);
    const [paused] = await db().select<{ status: string }>('tenants', { id: `eq.${tenantId}`, select: 'status' });
    expect(paused.status).toBe('paused');
    // paying again switches the page back on
    const active = event('customer.subscription.updated', { ...subscription, status: 'active' });
    await handleStripeWebhook(active, sign(active, env.STRIPE_WEBHOOK_SECRET), false, env);
    const [back] = await db().select<{ status: string; billing_status: string }>('tenants', { id: `eq.${tenantId}`, select: 'status,billing_status' });
    expect(back).toMatchObject({ status: 'live', billing_status: 'active' });
  });

  it('connects a shop to Stripe (standard account, Stripe-hosted onboarding)', async () => {
    const result = await connectOnboard(db(), env, tenantId, `owner-${stamp}@billing.test`);
    expect(result.status).toBe(200);
    expect((result.body as { url: string }).url).toMatch(/^https:\/\/(connect|accounts)\.stripe\.com\//);
    const status = await connectStatus(db(), env, tenantId);
    expect(status.body).toMatchObject({ connected: true, chargesEnabled: false });
  });

  it('takes a deposit only with the lead token and an account that can charge; the webhook marks the lead', async () => {
    expect((await handleDeposit({ leadId, token: 'bad' }, env)).status).toBe(403);
    const token = leadToken(leadId, tenantId, env);
    expect((await handleDeposit({ leadId, token }, env)).status).toBe(409); // onboarding not finished
    const [tenant] = await db().select<{ stripe_account_id: string }>('tenants', { id: `eq.${tenantId}`, select: 'stripe_account_id' });
    const session = { id: `cs_${stamp}`, payment_status: 'paid', amount_total: 33000, metadata: { purpose: 'deposit', lead_id: leadId, tenant_id: tenantId } };
    // from some other account: ignored
    const forged = event('checkout.session.completed', session, 'acct_someone_else');
    await handleStripeWebhook(forged, sign(forged, env.STRIPE_CONNECT_WEBHOOK_SECRET), true, env);
    let [lead] = await db().select<{ deposit_paid_at: string | null; status: string }>('leads', { id: `eq.${leadId}`, select: 'deposit_paid_at,status' });
    expect(lead.deposit_paid_at).toBeNull();
    const real = event('checkout.session.completed', session, tenant.stripe_account_id);
    await handleStripeWebhook(real, sign(real, env.STRIPE_CONNECT_WEBHOOK_SECRET), true, env);
    [lead] = await db().select('leads', { id: `eq.${leadId}`, select: 'deposit_paid_at,status' });
    expect(lead.status).toBe('deposit_paid');
    expect(lead.deposit_paid_at).toBeTruthy();
    expect(await db().count('lead_events', { lead_id: `eq.${leadId}`, type: 'eq.deposit_paid' })).toBe(1);
    expect((await handleDeposit({ leadId, token }, env)).status).toBe(409); // already paid
  });

  it('pauses a live shop whose trial ended without a plan', async () => {
    const other = await db().insert<{ id: string }>('tenants', { slug: `${slug}-t`, name: 'Expired Trial', kind: 'shop', status: 'live', plan: 'trial', trial_ends_at: new Date(Date.now() - 3600_000).toISOString() });
    await enforceBilling(env);
    const [row] = await db().select<{ status: string }>('tenants', { id: `eq.${other.id}`, select: 'status' });
    expect(row.status).toBe('paused');
    await db().remove('tenants', { id: `eq.${other.id}` });
  });
});
