import { parseTenantConfig, type TenantConfig } from '../src/lib/tenant/schema.js';
import { createDb, DbError, hasDb, type Db } from './db.js';
import { fromDomain, sendEmail, type EmailEnv } from './email.js';
import type { ApiResult } from './tenantApi.js';
import type { TenantEnv } from './tenants.js';

// POST /api/dashboard/<action> with the signed-in user's access token.
// The two things a member can't do through row-level security alone:
//   publish  — validate the draft with the shared schema and keep the fields the
//              plan controls (AI allowance, "Powered by" footer), then publish.
//   invite   — add a teammate: create or find their account and send a sign-in link.
// Plus stats, which reads views from PostHog when it's configured.

export type DashboardEnv = TenantEnv &
  EmailEnv & {
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
  const [tenant] = await db.select<TenantRow>('tenants', { id: `eq.${row.tenant_id}`, select: 'id,slug,name,kind,status,stripe_account_id' });
  const [liveRow] = await db.select<{ config: unknown }>('tenant_configs', { tenant_id: `eq.${row.tenant_id}`, status: 'eq.published', select: 'config' });
  const liveParsed = liveRow ? parseTenantConfig(liveRow.config) : null;
  const live = liveParsed?.ok ? liveParsed.config : null;

  const locked = role === 'admin' ? { config: parsed.config, reset: [] as string[] } : lockPlanFields(parsed.config, live, Boolean(tenant?.stripe_account_id));
  if ('error' in locked && locked.error) return reply(422, { error: 'deposit', message: locked.error });
  const version = await db.rpc<number>('publish_config_service', { config_id: row.id, final_config: locked.config, actor: userId });
  return reply(200, { version, reset: locked.reset, live: tenant?.status === 'live', slug: tenant?.slug });
}

type LinkResponse = { action_link?: string; id?: string; email?: string; email_confirmed_at?: string | null; properties?: { action_link?: string } };

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
  const addedToday = await db.count('members', { tenant_id: `eq.${tenantId}`, created_at: `gte.${new Date(Date.now() - 864e5).toISOString()}` });
  if (addedToday >= 20) return reply(429, { error: 'limit', message: 'Too many invites today. Try again tomorrow.' });

  const origin = (env.PUBLIC_ORIGIN || 'https://vvslab.magpollo.com').replace(/\/$/, '');
  const redirect = `${origin}/dashboard`;
  // A new address gets an account created here (public sign-up is off), so nobody
  // can register it first. An existing account must already be confirmed.
  let link = await db.authAdmin<LinkResponse>('generate_link', { type: 'invite', email, redirect_to: redirect });
  let existing = false;
  if (!link.ok && (link.status === 422 || /already/i.test(link.message))) {
    existing = true;
    link = await db.authAdmin<LinkResponse>('generate_link', { type: 'magiclink', email, redirect_to: redirect });
  }
  if (!link.ok) return reply(502, { error: 'auth', message: 'Couldn’t create the sign-in link. Try again in a minute.' });
  const data = link.data;
  const actionLink = data.action_link ?? data.properties?.action_link;
  if (!data.id || !actionLink) return reply(502, { error: 'auth', message: 'Couldn’t create the sign-in link. Try again in a minute.' });
  if (existing && !data.email_confirmed_at) {
    return reply(409, { error: 'unconfirmed', message: 'That email has an unfinished account. Ask VVS Lab support to add them.' });
  }

  const already = await db.select<{ role: string }>('members', { tenant_id: `eq.${tenantId}`, user_id: `eq.${data.id}`, select: 'role' });
  if (already.length) return reply(200, { added: false, message: `${email} is already on the team.` });
  await db.insert('members', { tenant_id: tenantId, user_id: data.id, role: memberRole });

  const shop = tenant.name.replace(/[<>&"']/g, '');
  const sent = await sendEmail(
    {
      fromName: 'VVS Lab',
      to: [email],
      subject: `You're invited to manage ${shop} on VVS Lab`,
      text: `${user.email ?? 'The shop owner'} added you to ${shop} on VVS Lab.\n\nSign in: ${actionLink}\n\nThe link works once and expires in 24 hours. Afterwards, sign in any time at ${redirect}.`,
      html: `<div style="font-family:-apple-system,Segoe UI,Roboto,Helvetica,Arial,sans-serif;max-width:520px;margin:0 auto;padding:24px;color:#1b1714">
<p style="font-size:13px;letter-spacing:.12em;text-transform:uppercase;color:#8a8178;margin:0 0 18px">VVS Lab</p>
<h1 style="font-size:22px;margin:0 0 12px">You're on the ${shop} team</h1>
<p style="font-size:15px;line-height:1.5;margin:0 0 22px">${(user.email ?? 'The shop owner').replace(/[<>&"']/g, '')} added you to ${shop} on VVS Lab. You can see the shop's design requests and${memberRole === 'owner' ? ' change its prices and options' : ' work its leads'}.</p>
<p style="margin:0 0 22px"><a href="${actionLink}" style="display:inline-block;background:#1b1714;color:#fff;text-decoration:none;padding:12px 20px;border-radius:10px;font-weight:600">Sign in to ${shop}</a></p>
<p style="font-size:13px;color:#8a8178;line-height:1.5;margin:0">The button works once and expires in 24 hours. After that, sign in any time at <a href="${redirect}" style="color:#8a8178">${redirect.replace(/^https?:\/\//, '')}</a>.</p></div>`,
      headers: { 'X-Entity-Ref-ID': `invite-${tenantId}-${data.id}` },
    },
    env,
  );
  return reply(200, { added: true, emailed: sent.ok, from: `leads@${fromDomain(env)}` });
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
    return reply(404, { error: 'not_found' });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error('dashboard', action, message);
    if (error instanceof DbError && /at least one owner/.test(message)) return reply(409, { error: 'owner', message: 'A shop needs at least one owner.' });
    return reply(503, { error: 'unavailable', message: 'Something went wrong. Try again.' });
  }
}
