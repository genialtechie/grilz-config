import { parseTenantConfig, type TenantConfig } from '../src/lib/tenant/schema.js';
import { signInLink } from './authLinks.js';
import { createDb, DbError, hasDb, type Db } from './db.js';
import { addDomain, checkDomain, domainState, removeDomain, type DomainEnv } from './domains.js';
import { sendEmail, type EmailEnv } from './email.js';
import { inviteEmail } from './emailTemplates.js';
import { deleteLead } from './retention.js';
import { billingCheckout, billingPortal, connectOnboard, connectStatus, type BillingEnv } from './billing.js';
import { offboardTenant } from './offboard.js';
import { trialExpired, type TrialFields } from '../src/lib/trial.js';
import type { ApiResult } from './tenantApi.js';
import { forgetTenant, type TenantEnv } from './tenants.js';

// POST /api/dashboard/<action> with the signed-in user's access token.
// The two things a member can't do through row-level security alone:
//   publish  — validate the draft with the shared schema and keep the fields the
//              plan controls (AI allowance, "Powered by" footer), then publish.
//   invite   — invite a teammate: create or find their account, record a pending
//              invite and email a sign-in link. They join when they accept.
// Plus stats, which reads views from PostHog when it's configured.

export type DashboardEnv = TenantEnv &
  EmailEnv &
  DomainEnv &
  BillingEnv & {
    PUBLIC_ORIGIN?: string;
    POSTHOG_PERSONAL_API_KEY?: string;
    POSTHOG_PROJECT_ID?: string;
    POSTHOG_HOST?: string;
  };

type Role = 'admin' | 'owner' | 'staff';
type TenantRow = { id: string; slug: string; name: string; kind: string; status: string; stripe_account_id: string | null };

/** The AI photo allowance for a shop with no published config yet (the $199 plan). */
export const PLAN_GENERATIONS = 300;

const NO_STORE = { 'Cache-Control': 'no-store' };
const reply = (status: number, body: unknown): ApiResult => ({ status, body, headers: NO_STORE });
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

async function roleFor(db: Db, userId: string, tenantId: string): Promise<Role | null> {
  const [admins, members] = await Promise.all([
    db.count('platform_admins', { user_id: `eq.${userId}` }),
    db.select<{ role: 'owner' | 'staff' }>('members', { tenant_id: `eq.${tenantId}`, user_id: `eq.${userId}`, select: 'role' }),
  ]);
  if (admins) return 'admin';
  return members[0]?.role ?? null;
}

/**
 * Plan-controlled fields a member can't change: they always come from the live
 * config (or the plan default for a first publish). Returns the config to publish
 * and the paths that were reset, so the dashboard can say so.
 */
export function lockPlanFields(draft: TenantConfig, live: TenantConfig | null, stripeConnected: boolean): { config: TenantConfig; reset: string[]; error?: string } {
  const config = structuredClone(draft);
  const reset: string[] = [];
  const allowance = live?.ai.monthlyGenerations ?? PLAN_GENERATIONS;
  if (config.ai.monthlyGenerations !== allowance) {
    config.ai.monthlyGenerations = allowance;
    reset.push('ai.monthlyGenerations');
  }
  const poweredBy = live?.brand.poweredBy ?? true;
  if (config.brand.poweredBy !== poweredBy) {
    config.brand.poweredBy = poweredBy;
    reset.push('brand.poweredBy');
  }
  if (config.deposit.mode === 'stripe' && !stripeConnected && live?.deposit.mode !== 'stripe') {
    return { config, reset, error: 'Connect Stripe before taking deposits by card, or use your own payment link.' };
  }
  return { config, reset };
}

async function publish(db: Db, userId: string, payload: Record<string, unknown>): Promise<ApiResult> {
  const configId = String(payload.configId ?? '');
  if (!UUID.test(configId)) return reply(400, { error: 'invalid' });
  const [row] = await db.select<{ id: string; tenant_id: string; status: string; config: unknown }>('tenant_configs', { id: `eq.${configId}`, select: 'id,tenant_id,status,config' });
  if (!row) return reply(404, { error: 'not_found' });
  const role = await roleFor(db, userId, row.tenant_id);
  if (!role) return reply(404, { error: 'not_found' });
  if (role === 'staff') return reply(403, { error: 'owner_only', message: 'Only the shop owner can publish. Your changes are saved as a draft.' });
  if (row.status !== 'draft') return reply(409, { error: 'not_draft', message: 'This version is already published. Make a change to start a new draft.' });

  const parsed = parseTenantConfig(row.config);
  if (!parsed.ok) return reply(422, { error: 'invalid_config', issues: parsed.issues.slice(0, 10) });
  const [tenant] = await db.select<TenantRow & { stripe_charges_enabled: boolean }>('tenants', { id: `eq.${row.tenant_id}`, select: 'id,slug,name,kind,status,stripe_account_id,stripe_charges_enabled' });
  const [liveRow] = await db.select<{ config: unknown }>('tenant_configs', { tenant_id: `eq.${row.tenant_id}`, status: 'eq.published', select: 'config' });
  const liveParsed = liveRow ? parseTenantConfig(liveRow.config) : null;
  const live = liveParsed?.ok ? liveParsed.config : null;

  const locked = role === 'admin' ? { config: parsed.config, reset: [] as string[] } : lockPlanFields(parsed.config, live, Boolean(tenant?.stripe_charges_enabled));
  if ('error' in locked && locked.error) return reply(422, { error: 'deposit', message: locked.error });
  const version = await db.rpc<number>('publish_config_service', { config_id: row.id, final_config: locked.config, actor: userId });
  // New prices show on the builder now, not when the cached config runs out.
  if (tenant?.slug) await forgetTenant(tenant.slug);
  return reply(200, { version, reset: locked.reset, live: tenant?.status === 'live', slug: tenant?.slug });
}

const strip = (value: string) => value.replace(/[<>&"'\r\n]/g, '').slice(0, 80);

async function invite(db: Db, user: { id: string; email?: string }, payload: Record<string, unknown>, env: DashboardEnv): Promise<ApiResult> {
  const tenantId = String(payload.tenantId ?? '');
  const email = String(payload.email ?? '').trim().toLowerCase();
  const memberRole = payload.role === 'owner' ? 'owner' : 'staff';
  if (!UUID.test(tenantId) || !EMAIL.test(email) || email.length > 254) return reply(400, { error: 'invalid', message: 'Enter a valid email address.' });
  const role = await roleFor(db, user.id, tenantId);
  if (!role) return reply(404, { error: 'not_found' });
  if (role === 'staff') return reply(403, { error: 'owner_only', message: 'Only the shop owner can add people.' });
  const [tenant] = await db.select<TenantRow>('tenants', { id: `eq.${tenantId}`, select: 'id,slug,name,kind,status,stripe_account_id' });
  if (!tenant) return reply(404, { error: 'not_found' });

  // Accounts are created only here. If public sign-up were on, someone could
  // register a teammate's address first and keep a password to it.
  const settings = await db.authSettings();
  if (!settings?.disable_signup) {
    console.error('invite refused: public sign-up is enabled in Supabase Auth');
    return reply(503, { error: 'signup_open', message: 'Invites are switched off for now. Message VVS Lab to add someone.' });
  }

  // Limits come from the append-only invite log, which removing people doesn't reset.
  const since = new Date(Date.now() - 864e5).toISOString();
  const [perShop, perEmail] = await Promise.all([
    db.count('member_invites', { tenant_id: `eq.${tenantId}`, created_at: `gte.${since}` }),
    db.count('member_invites', { email: `eq.${email}`, created_at: `gte.${since}` }),
  ]);
  if (perShop >= 20 || perEmail >= 3) return reply(429, { error: 'limit', message: 'Too many invites today. Try again tomorrow.' });

  // Every outcome gets the same answer, so this can't be used to learn who has an account.
  const done = reply(200, { invited: true, message: `If ${email} can be added, they'll get an email to join. They appear on the team once they sign in.` });

  const origin = (env.PUBLIC_ORIGIN || 'https://vvslab.magpollo.com').replace(/\/$/, '');
  const link = await signInLink(db, email, origin, tenant.slug);
  if (!link.ok && link.reason === 'auth') return reply(502, { error: 'auth', message: 'Couldn’t send the invite. Try again in a minute.' });
  if (!link.ok) {
    console.error('invite skipped: account in an unexpected state', tenantId);
    return done;
  }
  const already = await db.count('members', { tenant_id: `eq.${tenantId}`, user_id: `eq.${link.userId}` });
  if (already) return done;

  await db.insert('member_invites', { tenant_id: tenantId, email, role: memberRole, invited_by: user.id });
  const invitation = await inviteEmail({ shop: strip(tenant.name), inviter: strip(user.email ?? 'The shop owner'), role: memberRole, link: link.url, origin });
  await sendEmail({ fromName: 'VVS Lab', fromLocal: 'hello', to: [email], ...invitation, headers: { 'X-Entity-Ref-ID': `invite-${tenantId}-${link.userId}` } }, env);
  return done;
}

async function stats(db: Db, userId: string, payload: Record<string, unknown>, env: DashboardEnv): Promise<ApiResult> {
  const tenantId = String(payload.tenantId ?? '');
  const days = Math.min(90, Math.max(1, Number(payload.days) || 7));
  if (!UUID.test(tenantId)) return reply(400, { error: 'invalid' });
  if (!(await roleFor(db, userId, tenantId))) return reply(404, { error: 'not_found' });
  const [tenant] = await db.select<TenantRow>('tenants', { id: `eq.${tenantId}`, select: 'id,slug,name,kind,status,stripe_account_id' });
  if (!tenant || !env.POSTHOG_PERSONAL_API_KEY || !env.POSTHOG_PROJECT_ID) return reply(200, { available: false });
  const host = (env.POSTHOG_HOST || 'https://us.posthog.com').replace(/\/$/, '');
  // Slugs are validated on creation (lowercase letters, digits, hyphens), so the
  // literal can't break out of the query; it's still passed as a placeholder.
  const query = {
    kind: 'HogQLQuery',
    query: `select countIf(event = 'sample_configurator_opened') as views, countIf(event = 'sample_design_started') as started, countIf(event = 'sample_deposit_clicked') as deposit_clicks
            from events where properties.tenant = {slug} and timestamp > now() - interval {days} day`,
    values: { slug: tenant.slug, days },
  };
  try {
    const response = await fetch(`${host}/api/projects/${encodeURIComponent(env.POSTHOG_PROJECT_ID)}/query/`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${env.POSTHOG_PERSONAL_API_KEY}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ query }),
    });
    if (!response.ok) return reply(200, { available: false });
    const body = (await response.json()) as { results?: number[][] };
    const [views = 0, started = 0, depositClicks = 0] = body.results?.[0] ?? [];
    return reply(200, { available: true, views, started, depositClicks, days });
  } catch {
    return reply(200, { available: false });
  }
}

/** Plan billing and Stripe Connect. Owners only, except reading the Connect status. */
async function money(db: Db, user: { id: string; email?: string }, action: string, payload: Record<string, unknown>, env: DashboardEnv): Promise<ApiResult> {
  const tenantId = String(payload.tenantId ?? '');
  if (!UUID.test(tenantId)) return reply(400, { error: 'invalid' });
  const role = await roleFor(db, user.id, tenantId);
  if (!role) return reply(404, { error: 'not_found' });
  if (action === 'connect_status') return connectStatus(db, env, tenantId);
  if (role === 'staff') return reply(403, { error: 'owner_only', message: 'Only the shop owner can manage payments.' });
  // A closed shop can't restart its plan or reopen Stripe (its plan ends at period end).
  const [tenant] = await db.select<{ status: string }>('tenants', { id: `eq.${tenantId}`, select: 'status' });
  if (tenant?.status === 'offboarded') return reply(409, { error: 'closed', message: 'This shop is closed. Message VVS Lab.' });
  if (action === 'billing_checkout') return billingCheckout(db, env, tenantId, user.email);
  if (action === 'billing_portal') return billingPortal(db, env, tenantId);
  return connectOnboard(db, env, tenantId, user.email);
}

/** Owners switch their own page on (once it has a published version) or pause it. */
async function setLive(db: Db, userId: string, action: string, payload: Record<string, unknown>): Promise<ApiResult> {
  const tenantId = String(payload.tenantId ?? '');
  if (!UUID.test(tenantId)) return reply(400, { error: 'invalid' });
  const role = await roleFor(db, userId, tenantId);
  if (!role) return reply(404, { error: 'not_found' });
  if (role === 'staff') return reply(403, { error: 'owner_only', message: 'Only the shop owner can switch the page on or off.' });
  const [tenant] = await db.select<{ slug: string; status: string; published_version: number | null } & TrialFields>('tenants', { id: `eq.${tenantId}`, select: 'slug,status,published_version,plan,trial_ends_at,billing_status' });
  if (!tenant || tenant.status === 'offboarded') return reply(409, { error: 'closed', message: 'This shop is closed. Message VVS Lab.' });
  if (action === 'go_live' && trialExpired(tenant)) return reply(402, { error: 'trial_over', message: 'Your free trial has ended. Start your plan to switch your builder back on.' });
  if (action === 'go_live' && tenant.published_version === null) return reply(409, { error: 'unpublished', message: 'Publish your page first.' });
  const status = action === 'go_live' ? 'live' : 'paused';
  await db.update('tenants', { id: `eq.${tenantId}`, status: 'in.(draft,live,paused)' }, { status });
  // The link works (or stops) the moment the owner presses the button, not after a cached "not found" runs out.
  await forgetTenant(tenant.slug);
  return reply(200, { status });
}

/** A customer asked the shop to delete their data: the lead, its history and its files. Owners only. */
async function removeLead(db: Db, userId: string, payload: Record<string, unknown>): Promise<ApiResult> {
  const leadId = String(payload.leadId ?? '');
  if (!UUID.test(leadId)) return reply(400, { error: 'invalid' });
  const [lead] = await db.select<{ tenant_id: string }>('leads', { id: `eq.${leadId}`, select: 'tenant_id' });
  if (!lead) return reply(404, { error: 'not_found' });
  const role = await roleFor(db, userId, lead.tenant_id);
  if (!role) return reply(404, { error: 'not_found' });
  if (role === 'staff') return reply(403, { error: 'owner_only', message: 'Only the shop owner can delete a customer’s data.' });
  await deleteLead(db, leadId);
  console.log('lead deleted on request', lead.tenant_id);
  return reply(200, { deleted: true });
}

// domain: read · domain_check: re-check DNS (any member) · domain_add / domain_remove: owners.
async function domain(db: Db, userId: string, action: string, payload: Record<string, unknown>, env: DashboardEnv): Promise<ApiResult> {
  const tenantId = String(payload.tenantId ?? '');
  if (!UUID.test(tenantId)) return reply(400, { error: 'invalid' });
  const role = await roleFor(db, userId, tenantId);
  if (!role) return reply(404, { error: 'not_found' });
  if (action === 'domain') return reply(200, { domain: await domainState(db, tenantId) });
  if (action === 'domain_check') {
    const result = await checkDomain(db, env, tenantId);
    return reply(result.status, result.body);
  }
  if (role === 'staff') return reply(403, { error: 'owner_only', message: 'Only the shop owner can change the domain.' });
  const result = action === 'domain_add' ? await addDomain(db, env, tenantId, userId, String(payload.domain ?? '')) : action === 'domain_remove' ? await removeDomain(db, env, tenantId) : { status: 404, body: { error: 'not_found' } };
  return reply(result.status, result.body);
}

export async function handleDashboard(action: string, payload: unknown, token: string | null, env: DashboardEnv): Promise<ApiResult> {
  if (!token) return reply(401, { error: 'sign_in' });
  if (!hasDb(env)) return reply(503, { error: 'unavailable' });
  const body = payload && typeof payload === 'object' ? (payload as Record<string, unknown>) : {};
  const db = createDb(env);
  try {
    const user = await db.userFromToken(token);
    if (!user) return reply(401, { error: 'sign_in' });
    if (action === 'publish') return await publish(db, user.id, body);
    if (action === 'invite') return await invite(db, user, body, env);
    if (action === 'stats') return await stats(db, user.id, body, env);
    if (action.startsWith('domain')) return await domain(db, user.id, action, body, env);
    if (action === 'lead_delete') return await removeLead(db, user.id, body);
    if (action === 'go_live' || action === 'pause') return await setLive(db, user.id, action, body);
    if (action === 'offboard') {
      const tenantId = String(body.tenantId ?? '');
      if (!UUID.test(tenantId)) return reply(400, { error: 'invalid' });
      const role = await roleFor(db, user.id, tenantId);
      if (!role) return reply(404, { error: 'not_found' });
      if (role !== 'admin') return reply(403, { error: 'admin_only', message: 'Only VVS Lab can offboard a shop.' });
      return await offboardTenant(db, env, tenantId);
    }
    if (['billing_checkout', 'billing_portal', 'connect_onboard', 'connect_status'].includes(action)) return await money(db, user, action, body, env);
    return reply(404, { error: 'not_found' });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error('dashboard', action, message);
    if (error instanceof DbError && /at least one owner/.test(message)) return reply(409, { error: 'owner', message: 'A shop needs at least one owner.' });
    return reply(503, { error: 'unavailable', message: 'Something went wrong. Try again.' });
  }
}
