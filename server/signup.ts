import { TEMPLATES } from '../src/admin/templates.js';
import { createDb, hasDb, type Db } from './db.js';
import { sendEmail, type EmailEnv } from './email.js';
import { hashIp, looksAutomated, verifyTurnstile, type SpamEnv } from './spam.js';
import type { ApiResult } from './tenantApi.js';
import { isValidSlug, type TenantEnv } from './tenants.js';

// POST /api/signup: a jeweler creates their shop without us.
// Creates the shop (draft, 7-day trial, small AI allowance, their email as the
// lead inbox), records an owner invite and emails a sign-in link. They finish
// setup in /dashboard and switch the shop live themselves.
//
// Abuse controls: Turnstile, honeypot and timing, per-IP / per-email / global
// daily limits, reserved slugs, and accounts created only here (public sign-up
// stays off). Every outcome after validation gets the same answer.

export type SignupEnv = TenantEnv & EmailEnv & SpamEnv & { PUBLIC_ORIGIN?: string; LEAD_TOKEN_SECRET?: string };

export const TRIAL_DAYS = 7;
export const TRIAL_GENERATIONS = 30;
export const SIGNUP_LIMITS = { perIpDay: 3, perEmailDay: 2, globalDay: 60 };

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
const IG = /^[A-Za-z0-9._]{1,30}$/;
/** Slugs we keep for ourselves or that would confuse customers. */
const RESERVED = new Set(['admin', 'api', 'app', 'b', 'www', 'dashboard', 'login', 'signup', 'help', 'support', 'assets', 'static', 'configurator', 'watch', 'vvslab', 'vvs', 'magpollo', 'demo', 'test', 'shop', 'shops', 'privacy', 'terms', 'billing', 'embed', 'status', 'official', 'jewelry', 'grillz']);

const reply = (status: number, body: unknown): ApiResult => ({ status, body, headers: { 'Cache-Control': 'no-store' } });

/** "Gold Mouth Jewelers!" → "gold-mouth-jewelers". */
export function slugFromName(name: string) {
  return name
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/&/g, ' and ')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 40)
    .replace(/-+$/g, '');
}

export function checkSlug(slug: string): string | null {
  if (!isValidSlug(slug) || slug.length < 3) return 'Use 3–40 letters, numbers or dashes.';
  if (RESERVED.has(slug)) return 'That link is reserved. Try another.';
  return null;
}

/** GET-style availability check for the form: is this link free? */
export async function slugAvailable(slug: string, env: TenantEnv): Promise<ApiResult> {
  const problem = checkSlug(slug);
  if (problem) return reply(200, { available: false, message: problem });
  if (!hasDb(env)) return reply(503, { error: 'unavailable' });
  const taken = await createDb(env).count('tenants', { slug: `eq.${slug}` });
  return reply(200, taken ? { available: false, message: 'That link is taken. Try another.' } : { available: true });
}

type LinkResponse = { action_link?: string; id?: string; email_confirmed_at?: string | null; invited_at?: string | null; last_sign_in_at?: string | null; properties?: { action_link?: string } };

async function signInLink(db: Db, email: string, redirect: string): Promise<{ link: string; userId: string } | null> {
  let result = await db.authAdmin<LinkResponse>('generate_link', { type: 'invite', email, redirect_to: redirect });
  let existing = false;
  if (!result.ok && (result.status === 422 || /already/i.test(result.message))) {
    existing = true;
    result = await db.authAdmin<LinkResponse>('generate_link', { type: 'magiclink', email, redirect_to: redirect });
  }
  if (!result.ok) return null;
  const data = result.data;
  const link = data.action_link ?? data.properties?.action_link;
  if (!data.id || !link) return null;
  // Same rule as team invites: a brand-new account, or one its owner has used.
  const trusted = existing ? Boolean(data.last_sign_in_at && data.email_confirmed_at) : Boolean(data.invited_at && !data.email_confirmed_at) || Boolean(data.last_sign_in_at);
  return trusted ? { link, userId: data.id } : null;
}

export async function handleSignup(payload: unknown, ip: string, env: SignupEnv): Promise<ApiResult> {
  const body = payload && typeof payload === 'object' ? (payload as Record<string, unknown>) : {};
  const name = typeof body.name === 'string' ? body.name.replace(/\s+/g, ' ').trim() : '';
  const email = typeof body.email === 'string' ? body.email.trim().toLowerCase() : '';
  const slug = typeof body.slug === 'string' ? body.slug.trim().toLowerCase() : '';
  const instagram = typeof body.instagram === 'string' ? body.instagram.trim().replace(/^@/, '') : '';
  if (name.length < 2 || name.length > 60) return reply(400, { error: 'invalid', field: 'name', message: 'Enter your shop’s name (2–60 characters).' });
  if (!EMAIL.test(email) || email.length > 254) return reply(400, { error: 'invalid', field: 'email', message: 'Enter a valid email.' });
  const slugProblem = checkSlug(slug);
  if (slugProblem) return reply(400, { error: 'invalid', field: 'slug', message: slugProblem });
  if (instagram && !IG.test(instagram)) return reply(400, { error: 'invalid', field: 'instagram', message: 'Instagram handle: letters, numbers, dots and underscores.' });
  if (body.terms !== true) return reply(400, { error: 'invalid', field: 'terms', message: 'Please accept the terms.' });
  if (!(await verifyTurnstile(body.turnstile, ip, env))) return reply(400, { error: 'verify', message: 'Please confirm you are human and try again.' });
  if (!hasDb(env)) return reply(503, { error: 'unavailable', message: 'Signups are down for a moment. Try again shortly.' });

  const db = createDb(env);
  const done = reply(200, { ok: true, message: `Check ${email} for a link to set up your shop.` });
  const ipHash = hashIp(ip, env.LEAD_TOKEN_SECRET ?? env.SUPABASE_SERVICE_ROLE_KEY ?? 'vvs');
  const log = (outcome: 'created' | 'blocked') => db.insert('signup_attempts', { ip_hash: ipHash, email, outcome }).catch(() => undefined);

  // Bots get the normal answer and nothing happens.
  if (looksAutomated({ honeypot: body.website, elapsedMs: body.elapsedMs })) {
    await log('blocked');
    return done;
  }
  const settings = await db.authSettings();
  if (!settings?.disable_signup) {
    console.error('signup refused: public sign-up is enabled in Supabase Auth');
    return reply(503, { error: 'unavailable', message: 'Signups are paused right now. Message us and we’ll set you up.' });
  }

  const since = new Date(Date.now() - 864e5).toISOString();
  const [perIp, perEmail, global] = await Promise.all([
    db.count('signup_attempts', { ip_hash: `eq.${ipHash}`, created_at: `gte.${since}` }),
    db.count('signup_attempts', { email: `eq.${email}`, created_at: `gte.${since}` }),
    db.count('signup_attempts', { outcome: 'eq.created', created_at: `gte.${since}` }),
  ]);
  if (perIp >= SIGNUP_LIMITS.perIpDay || perEmail >= SIGNUP_LIMITS.perEmailDay) return reply(429, { error: 'limit', message: 'Too many signups from here today. Try again tomorrow, or message us.' });
  if (global >= SIGNUP_LIMITS.globalDay) return reply(503, { error: 'busy', message: 'Lots of signups today. Try again tomorrow, or message us.' });
  if (await db.count('tenants', { slug: `eq.${slug}` })) return reply(409, { error: 'taken', field: 'slug', message: 'That link is taken. Try another.' });

  const origin = (env.PUBLIC_ORIGIN || 'https://vvslab.magpollo.com').replace(/\/$/, '');
  const access = await signInLink(db, email, `${origin}/dashboard`);
  if (!access) {
    // An account in an odd state: don't create anything, answer the same way.
    await log('blocked');
    console.error('signup skipped: account in an unexpected state');
    return done;
  }

  const config = TEMPLATES[0].build(name);
  config.brand.instagram = instagram || undefined;
  config.leads.email = [email];
  config.ai.monthlyGenerations = TRIAL_GENERATIONS;
  let tenantId: string;
  try {
    const tenant = await db.insert<{ id: string }>('tenants', {
      slug,
      name,
      kind: 'shop',
      status: 'draft',
      plan: 'trial',
      created_via: 'signup',
      trial_ends_at: new Date(Date.now() + TRIAL_DAYS * 864e5).toISOString(),
    });
    tenantId = tenant.id;
  } catch {
    return reply(409, { error: 'taken', field: 'slug', message: 'That link is taken. Try another.' });
  }
  const draft = await db.insert<{ id: string }>('tenant_configs', { tenant_id: tenantId, version: 1, config, status: 'draft', created_by: access.userId });
  // v1 is published straight away (the shop stays a draft until they go live), so
  // the trial allowance is the live value their later edits are held to.
  await db.rpc('publish_config_service', { config_id: draft.id, final_config: config, actor: access.userId });
  await db.insert('member_invites', { tenant_id: tenantId, email, role: 'owner', invited_by: access.userId });
  await log('created');

  const shop = name.replace(/[<>&"'\r\n]/g, '');
  await sendEmail(
    {
      fromName: 'VVS Lab',
      to: [email],
      subject: 'Set up your VVS Lab builder',
      text: `Welcome to VVS Lab.\n\nYour builder link is ${origin}/b/${slug}. Set it up and switch it on here: ${access.link}\n\nThe link works once and expires in 24 hours. After that, sign in any time at ${origin}/dashboard. Your free trial runs ${TRIAL_DAYS} days.`,
      html: `<div style="font-family:-apple-system,Segoe UI,Roboto,Helvetica,Arial,sans-serif;max-width:520px;margin:0 auto;padding:24px;color:#1b1714">
<p style="font-size:13px;letter-spacing:.12em;text-transform:uppercase;color:#8a8178;margin:0 0 18px">VVS Lab</p>
<h1 style="font-size:22px;margin:0 0 12px">Your builder is ready to set up</h1>
<p style="font-size:15px;line-height:1.5;margin:0 0 8px">${shop} gets its own 3D grillz builder at <strong>${origin.replace(/^https?:\/\//, '')}/b/${slug}</strong>.</p>
<p style="font-size:15px;line-height:1.5;margin:0 0 22px">Add your logo and prices, then switch it on. It takes about 10 minutes. Your free trial runs ${TRIAL_DAYS} days.</p>
<p style="margin:0 0 22px"><a href="${access.link}" style="display:inline-block;background:#1b1714;color:#fff;text-decoration:none;padding:12px 20px;border-radius:10px;font-weight:600">Set up my builder</a></p>
<p style="font-size:13px;color:#8a8178;line-height:1.5;margin:0">The button works once and expires in 24 hours. After that, sign in at <a href="${origin}/dashboard" style="color:#8a8178">${origin.replace(/^https?:\/\//, '')}/dashboard</a>. Didn't sign up? Ignore this email.</p></div>`,
      headers: { 'X-Entity-Ref-ID': `signup-${tenantId}` },
    },
    env,
  );
  return done;
}
