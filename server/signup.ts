import { TEMPLATES } from '../src/admin/templates.js';
import { TRIAL_DAYS } from '../src/lib/trial.js';
import { randomBytes } from 'node:crypto';
import { signInLink } from './authLinks.js';
import { emailSignIn, endSessions, signInOnDevice } from './emailConfirm.js';
import { createDb, hasDb } from './db.js';
import { sendEmail, type EmailEnv } from './email.js';
import { welcomeEmail } from './emailTemplates.js';
import { hashIp, looksAutomated, verifyTurnstile, type SpamEnv } from './spam.js';
import type { ApiResult } from './tenantApi.js';
import { isValidSlug, type TenantEnv } from './tenants.js';

// POST /api/signup: a jeweler creates their shop without us.
// Three fields (MAG-91): shop name, email, Instagram; the link comes from the
// handle (or the name). Creates the shop live with the starting prices (14-day
// trial with the card optional, deposits off, small AI allowance, their email
// as the lead inbox) and records an owner invite. A new account is signed in
// right there and lands on its dashboard; the welcome email carries a link and
// a 6-digit code that confirm the email (see emailConfirm.ts). An email that
// already has an account gets the sign-in by email instead.
//
// Abuse controls: Turnstile, honeypot and timing, per-IP / per-email / global
// daily limits, reserved slugs, and accounts created only here (public sign-up
// stays off). Every outcome after validation gets the same answer.

export type SignupEnv = TenantEnv & EmailEnv & SpamEnv & { PUBLIC_ORIGIN?: string; LEAD_TOKEN_SECRET?: string };

export { TRIAL_DAYS };
export const TRIAL_GENERATIONS = 30;
export const SIGNUP_LIMITS = { perIpDay: 3, perEmailDay: 2, globalDay: 60 };

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
const IG = /^[A-Za-z0-9._]{1,30}$/;
/** Slugs we keep for ourselves or that would confuse customers. */
const RESERVED = new Set(['admin', 'api', 'app', 'b', 'www', 'dashboard', 'login', 'signup', 'help', 'support', 'assets', 'static', 'configurator', 'watch', 'vvslab', 'vvs', 'magpollo', 'demo', 'test', 'shop', 'shops', 'privacy', 'terms', 'billing', 'embed', 'status', 'official', 'jewelry', 'grillz', 'welcome']);

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

/** "@gold.mouth_atl" → "gold-mouth-atl": the link name from an Instagram handle. */
export const slugFromHandle = (handle: string) => slugFromName(handle.replace(/[._]+/g, ' '));

/** The first free link for this shop: from the handle (or the name), then -2…-9, then a short random ending. */
export async function pickSlug(name: string, instagram: string, taken: (slug: string) => Promise<boolean>): Promise<string> {
  const candidates = [instagram && slugFromHandle(instagram), slugFromName(name)].filter((slug): slug is string => Boolean(slug) && !checkSlug(slug));
  const base = candidates[0] ?? 'shop';
  for (const slug of [...candidates, ...Array.from({ length: 8 }, (_, i) => `${base.slice(0, 37)}-${i + 2}`)]) {
    if (!(await taken(slug))) return slug;
  }
  return `${base.slice(0, 33)}-${randomBytes(4).toString('hex').slice(0, 6)}`;
}

/** GET-style availability check for the form: is this link free? */
export async function slugAvailable(slug: string, env: TenantEnv): Promise<ApiResult> {
  const problem = checkSlug(slug);
  if (problem) return reply(200, { available: false, message: problem });
  if (!hasDb(env)) return reply(503, { error: 'unavailable' });
  const taken = await createDb(env).count('tenants', { slug: `eq.${slug}` });
  return reply(200, taken ? { available: false, message: 'That link is taken. Try another.' } : { available: true });
}

export async function handleSignup(payload: unknown, ip: string, env: SignupEnv): Promise<ApiResult> {
  const body = payload && typeof payload === 'object' ? (payload as Record<string, unknown>) : {};
  const name = typeof body.name === 'string' ? body.name.replace(/\s+/g, ' ').trim() : '';
  const email = typeof body.email === 'string' ? body.email.trim().toLowerCase() : '';
  const chosenSlug = typeof body.slug === 'string' ? body.slug.trim().toLowerCase() : '';
  const instagram = typeof body.instagram === 'string' ? body.instagram.trim().replace(/^@/, '') : '';
  if (name.length < 2 || name.length > 60) return reply(400, { error: 'invalid', field: 'name', message: 'Enter your shop’s name (2–60 characters).' });
  if (!EMAIL.test(email) || email.length > 254) return reply(400, { error: 'invalid', field: 'email', message: 'Enter a valid email.' });
  // The form no longer asks for a link; one chosen by an older form is still checked.
  const slugProblem = chosenSlug ? checkSlug(chosenSlug) : null;
  if (slugProblem) return reply(400, { error: 'invalid', field: 'slug', message: slugProblem });
  if (instagram && !IG.test(instagram)) return reply(400, { error: 'invalid', field: 'instagram', message: 'Instagram handle: letters, numbers, dots and underscores.' });
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
  const taken = async (candidate: string) => (await db.count('tenants', { slug: `eq.${candidate}` })) > 0;
  if (chosenSlug && (await taken(chosenSlug))) return reply(409, { error: 'taken', field: 'slug', message: 'That link is taken. Try another.' });
  const slug = chosenSlug || (await pickSlug(name, instagram, taken));

  const origin = (env.PUBLIC_ORIGIN || 'https://vvslab.magpollo.com').replace(/\/$/, '');
  const signIn = await signInLink(db, email, origin, slug);
  const access = signIn.ok ? { link: signIn.url, userId: signIn.userId } : null;
  if (!access) {
    // An account in an odd state: don't create anything, answer the same way.
    await log('blocked');
    console.error('signup skipped: account in an unexpected state');
    return done;
  }
  // An account signed in at an earlier signup and never confirmed: whoever holds
  // that session may not be the owner of this email, so it ends before a shop is added.
  if (signIn.ok && signIn.unconfirmed) await endSessions(db, access.userId);

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
      // Live from the start (MAG-90): customers can use the link while they set their prices.
      status: 'live',
      plan: 'trial',
      created_via: 'signup',
      trial_ends_at: new Date(Date.now() + TRIAL_DAYS * 864e5).toISOString(),
    });
    tenantId = tenant.id;
  } catch {
    return reply(409, { error: 'taken', field: 'slug', message: 'That link is taken. Try another.' });
  }
  const draft = await db.insert<{ id: string }>('tenant_configs', { tenant_id: tenantId, version: 1, config, status: 'draft', created_by: access.userId });
  // v1 is published straight away (the shop is live), so the trial allowance is
  // the live value their later edits are held to.
  await db.rpc('publish_config_service', { config_id: draft.id, final_config: config, actor: access.userId });
  await db.insert('member_invites', { tenant_id: tenantId, email, role: 'owner', invited_by: access.userId });
  await log('created');

  // A new account is signed in on this device; one that was already there signs in by email (never from a form).
  const session = signIn.ok && !signIn.existing ? await signInOnDevice(db, signIn.url).catch(() => null) : null;
  // The welcome email's own link and code (made after that sign-in: one token at a time per account).
  const emailed = (await emailSignIn(db, email, origin, slug)) ?? { url: access.link, code: undefined };
  const welcome = await welcomeEmail({ shop: name, slug, link: emailed.url, code: emailed.code, origin, trialDays: TRIAL_DAYS });
  await sendEmail({ fromName: 'VVS Lab', fromLocal: 'hello', to: [email], ...welcome, headers: { 'X-Entity-Ref-ID': `signup-${tenantId}` } }, env);
  return session ? reply(200, { ok: true, slug, session }) : reply(200, { ok: true, slug, message: `Check ${email} for a link to your shop.` });
}
