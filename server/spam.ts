import { createHash } from 'node:crypto';

export { isEmail, normaliseContact } from '../src/lib/contact.js';

// Spam protection for the lead form. Junk leads cost a jeweler's trust fast, so
// several cheap checks stack: a honeypot field, a minimum time on the form,
// contact-format checks, per-IP and per-shop rate limits, and Cloudflare
// Turnstile when it is configured.

export type SpamEnv = { TURNSTILE_SECRET_KEY?: string; SUPABASE_SERVICE_ROLE_KEY?: string };

/** Leads from one IP to one shop per hour, per shop per day, and confirmations to one address per day. */
export const LIMITS = { perIpHour: 5, perShopDay: 150, perEmailDay: 3 };
/** A real person needs at least this long between opening the builder and sending. */
export const MIN_FORM_MS = 4_000;

/** Salted so the stored hash can't be reversed into an IP with a lookup table. */
export const hashIp = (ip: string, salt: string) => createHash('sha256').update(`${salt}:${ip}`).digest('hex').slice(0, 32);

export type BotSignals = { honeypot?: unknown; elapsedMs?: unknown };

/** True when the request looks automated. Silent: bots get a normal-looking success. */
export function looksAutomated({ honeypot, elapsedMs }: BotSignals): boolean {
  if (typeof honeypot === 'string' && honeypot.trim() !== '') return true;
  if (typeof elapsedMs !== 'number' || !Number.isFinite(elapsedMs) || elapsedMs < MIN_FORM_MS) return true;
  return false;
}

/** Verifies a Turnstile token. Passes when Turnstile isn't configured; fails closed on a bad token. */
export async function verifyTurnstile(token: unknown, ip: string, env: SpamEnv): Promise<boolean> {
  const secret = env.TURNSTILE_SECRET_KEY;
  if (!secret) return true;
  if (typeof token !== 'string' || token.length < 10 || token.length > 4096) return false;
  try {
    const response = await fetch('https://challenges.cloudflare.com/turnstile/v0/siteverify', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({ secret, response: token, remoteip: ip }),
    });
    const result = (await response.json()) as { success?: boolean };
    return result.success === true;
  } catch {
    // Cloudflare unreachable: let the other checks decide rather than lose a real lead.
    console.error('turnstile unreachable');
    return true;
  }
}
