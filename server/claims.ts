import { createHash, randomBytes } from 'node:crypto';
import { priceBreakdown } from '../src/lib/pricing.js';
import { defaultSet, defaultTooth } from '../src/lib/tenant/catalog.js';
import { parseTenantConfig, type TenantConfig } from '../src/lib/tenant/schema.js';
import { TRIAL_DAYS } from '../src/lib/trial.js';
import { signInLink } from './authLinks.js';
import { createDb, hasDb, type Db } from './db.js';
import { sendEmail } from './email.js';
import { welcomeEmail } from './emailTemplates.js';
import type { SignupEnv } from './signup.js';
import { hashIp, looksAutomated, verifyTurnstile } from './spam.js';
import type { ApiResult } from './tenantApi.js';
import { forgetTenant } from './tenants.js';

// Claim links (MAG-89). VVS Lab builds a jeweler's shop ahead of time (a
// draft with no owner). At the counter the jeweler scans a QR code for
// /claim/<token>, enters their email, and the shop is theirs: owner, 14-day
// trial (card optional), published with their email as the lead inbox, the
// welcome email sent, and signed in on that phone.
//
// Only a hash of the token is stored; a link is single use, lasts 7 days and
// can be revoked. A new account is signed in on the spot. An email that
// already has an account gets the shop added and a sign-in link by email
// instead: anyone holding the claim link could type that address, so the
// phone in their hand doesn't get into someone else's account.

export const CLAIM_DAYS = 7;
/** Claims per IP a day; generous, since one shop's wifi may claim for several. */
export const CLAIM_LIMITS = { perIpDay: 10 };

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
const TOKEN = /^[A-Za-z0-9_-]{32}$/;

type LinkRow = { id: string; tenant_id: string; expires_at: string; revoked_at: string | null; claimed_at: string | null };
type TenantRow = { id: string; slug: string; name: string; kind: string; status: string };
export type ClaimState = 'open' | 'claimed' | 'expired' | 'revoked' | 'invalid';

const reply = (status: number, body: unknown): ApiResult => ({ status, body, headers: { 'Cache-Control': 'no-store' } });
export const hashToken = (token: string) => createHash('sha256').update(token).digest('hex');
const originOf = (env: { PUBLIC_ORIGIN?: string }) => (env.PUBLIC_ORIGIN || 'https://vvslab.magpollo.com').replace(/\/$/, '');

const stateOf = (link: LinkRow, owned: boolean, now = Date.now()): ClaimState => {
  if (link.claimed_at || owned) return 'claimed';
  if (link.revoked_at) return 'revoked';
  if (Date.parse(link.expires_at) <= now) return 'expired';
  return 'open';
};

async function findLink(db: Db, token: unknown) {
  if (typeof token !== 'string' || !TOKEN.test(token)) return null;
  const [link] = await db.select<LinkRow>('claim_links', { token_hash: `eq.${hashToken(token)}`, select: 'id,tenant_id,expires_at,revoked_at,claimed_at', limit: '1' });
  if (!link) return null;
  const [tenant] = await db.select<TenantRow>('tenants', { id: `eq.${link.tenant_id}`, select: 'id,slug,name,kind,status' });
  if (!tenant || tenant.status === 'offboarded') return null;
  const owned = (await db.count('members', { tenant_id: `eq.${tenant.id}`, role: 'eq.owner' })) > 0;
  return { link, tenant, state: stateOf(link, owned) };
}

/** The shop's newest config (a draft VVS Lab is still building, or the published one). */
async function latestConfig(db: Db, tenantId: string) {
  const [row] = await db.select<{ id: string; version: number; status: string; config: unknown }>('tenant_configs', { tenant_id: `eq.${tenantId}`, select: 'id,version,status,config', order: 'version.desc', limit: '1' });
  const parsed = row ? parseTenantConfig(row.config) : null;
  return row && parsed?.ok ? { row, config: parsed.config } : null;
}

/** What the claim page shows above the email field: the shop's look and a starting price. */
const preview = (tenant: TenantRow, config: TenantConfig | null) => {
  if (!config) return { name: tenant.name, slug: tenant.slug };
  const tooth = defaultTooth(config.catalog);
  const teeth = [5, 6, 7, 8, 9, 10].map((index) => ({ ...tooth, index }));
  const from = config.pricing.display === 'hidden' ? null : priceBreakdown(config.pricing, teeth, defaultSet(config.catalog), config.catalog.addOns).total;
  return { name: config.brand.name, slug: tenant.slug, logo: config.brand.logo ?? null, accent: config.brand.accent, fontPair: config.brand.fontPair, from };
};

/** GET /api/signup?claim=<token>: the link's state and, while it's open, the shop to preview. */
export async function claimStatus(token: string, env: SignupEnv): Promise<ApiResult> {
  if (!hasDb(env)) return reply(503, { error: 'unavailable' });
  const db = createDb(env);
  const found = await findLink(db, token);
  if (!found) return reply(404, { state: 'invalid' satisfies ClaimState });
  const latest = found.state === 'open' ? await latestConfig(db, found.tenant.id) : null;
  return reply(200, { state: found.state, shop: found.state === 'open' ? preview(found.tenant, latest?.config ?? null) : { name: found.tenant.name, slug: found.tenant.slug } });
}

const CLOSED: Record<Exclude<ClaimState, 'open'>, [number, string]> = {
  claimed: [409, 'This shop has already been claimed. Sign in to open it.'],
  expired: [410, 'This link has expired. Ask VVS Lab for a new one.'],
  revoked: [410, 'This link was cancelled. Ask VVS Lab for a new one.'],
  invalid: [404, 'This link isn’t valid. Check it, or ask VVS Lab for a new one.'],
};
const closed = (state: Exclude<ClaimState, 'open'>) => reply(CLOSED[state][0], { error: state, message: CLOSED[state][1] });

/**
 * Makes the shop theirs once the link is spent: the newest config is published
 * with their email as the lead inbox (if it has none), so the builder works the
 * moment they switch it on.
 */
async function handOver(db: Db, tenant: TenantRow, userId: string, email: string) {
  // Already on the team (as staff)? Then they're promoted.
  await db.insert('members', { tenant_id: tenant.id, user_id: userId, role: 'owner' }).catch(() => db.update('members', { tenant_id: `eq.${tenant.id}`, user_id: `eq.${userId}` }, { role: 'owner' }));
  // The trial starts now, card optional, as for self-serve signup. A shop already on a paid plan keeps it.
  await db.update('tenants', { id: `eq.${tenant.id}`, billing_status: 'in.(none,canceled)' }, { plan: 'trial', trial_ends_at: new Date(Date.now() + TRIAL_DAYS * 864e5).toISOString() });
  const latest = await latestConfig(db, tenant.id);
  if (!latest) {
    console.error('claim: no valid config to publish', tenant.slug);
    return;
  }
  const config = latest.config;
  const needsInbox = config.leads.email.length === 0;
  if (needsInbox) config.leads.email = [email];
  if (latest.row.status === 'draft') {
    await db.rpc('publish_config_service', { config_id: latest.row.id, final_config: config, actor: userId });
  } else if (needsInbox) {
    const draft = await db.insert<{ id: string }>('tenant_configs', { tenant_id: tenant.id, version: latest.row.version + 1, config, status: 'draft', created_by: userId });
    await db.rpc('publish_config_service', { config_id: draft.id, final_config: config, actor: userId });
  }
}

/** POST /api/signup with { claim }: the jeweler claims the shop with their email. */
export async function handleClaim(payload: unknown, ip: string, env: SignupEnv): Promise<ApiResult> {
  const body = payload && typeof payload === 'object' ? (payload as Record<string, unknown>) : {};
  const email = typeof body.email === 'string' ? body.email.trim().toLowerCase() : '';
  if (!EMAIL.test(email) || email.length > 254) return reply(400, { error: 'invalid', field: 'email', message: 'Enter a valid email.' });
  if (!(await verifyTurnstile(body.turnstile, ip, env))) return reply(400, { error: 'verify', message: 'Please confirm you are human and try again.' });
  if (!hasDb(env)) return reply(503, { error: 'unavailable', message: 'Something went wrong. Try again in a moment.' });

  const db = createDb(env);
  const ipHash = hashIp(ip, env.LEAD_TOKEN_SECRET ?? env.SUPABASE_SERVICE_ROLE_KEY ?? 'vvs');
  const log = (outcome: 'claimed' | 'blocked') => db.insert('signup_attempts', { ip_hash: ipHash, email, outcome }).catch(() => undefined);
  if (looksAutomated({ honeypot: body.website, elapsedMs: body.elapsedMs })) {
    await log('blocked');
    return reply(400, { error: 'verify', message: 'Please try again.' });
  }
  const since = new Date(Date.now() - 864e5).toISOString();
  if ((await db.count('signup_attempts', { ip_hash: `eq.${ipHash}`, outcome: 'in.(claimed,blocked)', created_at: `gte.${since}` })) >= CLAIM_LIMITS.perIpDay) {
    return reply(429, { error: 'limit', message: 'Too many tries from here today. Message VVS Lab and we’ll sort it out.' });
  }

  const found = await findLink(db, body.claim);
  if (!found) return closed('invalid');
  if (found.state !== 'open') return closed(found.state);
  const { link, tenant } = found;

  const origin = originOf(env);
  const signIn = await signInLink(db, email, origin, tenant.slug);
  if (!signIn.ok) {
    await log('blocked');
    return reply(409, { error: 'account', message: 'We couldn’t use that email. Try another, or message VVS Lab.' });
  }
  // One request wins the link; a second phone tapping at the same moment gets "already claimed".
  if (!(await db.rpc<boolean>('spend_claim_link', { link: link.id, claimer: signIn.userId, claimer_email: email }))) return closed('claimed');
  await handOver(db, tenant, signIn.userId, email);
  await forgetTenant(tenant.slug);
  await log('claimed');

  // A new account signs in right here; an existing one gets its sign-in link by email.
  const welcome = await welcomeEmail({ shop: tenant.name, slug: tenant.slug, link: signIn.existing ? signIn.url : `${origin}/dashboard/${tenant.slug}`, origin, trialDays: TRIAL_DAYS, claimed: true, oneTime: signIn.existing });
  await sendEmail({ fromName: 'VVS Lab', fromLocal: 'hello', to: [email], ...welcome, headers: { 'X-Entity-Ref-ID': `claim-${tenant.id}` } }, env);
  return signIn.existing
    ? reply(200, { ok: true, slug: tenant.slug, message: `${tenant.name} is yours. We added it to your account: check ${email} for a sign-in link.` })
    : reply(200, { ok: true, slug: tenant.slug, signIn: signIn.url });
}

// ---------- Admin ----------

/** A new claim link for a shop with no owner yet; any open link for it is cancelled. Admins only (checked by the caller). */
export async function createClaimLink(db: Db, adminId: string, tenantId: string, env: { PUBLIC_ORIGIN?: string }): Promise<ApiResult> {
  const [tenant] = await db.select<TenantRow>('tenants', { id: `eq.${tenantId}`, select: 'id,slug,name,kind,status' });
  if (!tenant) return reply(404, { error: 'not_found' });
  if (tenant.kind !== 'shop' || tenant.status === 'offboarded') return reply(409, { error: 'not_claimable', message: 'Only open shops can be claimed.' });
  if (await db.count('members', { tenant_id: `eq.${tenant.id}`, role: 'eq.owner' })) return reply(409, { error: 'owned', message: 'This shop already has an owner.' });
  const now = new Date().toISOString();
  await db.update('claim_links', { tenant_id: `eq.${tenant.id}`, claimed_at: 'is.null', revoked_at: 'is.null' }, { revoked_at: now });
  const token = randomBytes(24).toString('base64url');
  const expires = new Date(Date.now() + CLAIM_DAYS * 864e5).toISOString();
  const row = await db.insert<{ id: string }>('claim_links', { tenant_id: tenant.id, token_hash: hashToken(token), created_by: adminId, expires_at: expires });
  return reply(200, { id: row.id, url: `${originOf(env)}/claim/${token}`, expiresAt: expires });
}

export async function revokeClaimLink(db: Db, tenantId: string, linkId: string): Promise<ApiResult> {
  await db.update('claim_links', { id: `eq.${linkId}`, tenant_id: `eq.${tenantId}`, claimed_at: 'is.null', revoked_at: 'is.null' }, { revoked_at: new Date().toISOString() });
  return reply(200, { ok: true });
}
