import { createHmac, timingSafeEqual } from 'node:crypto';

// A minimal Stripe client (REST, form-encoded) and webhook signature check.
// Env: STRIPE_SECRET_KEY (sk_test_… or sk_live_…).

export type StripeEnv = { STRIPE_SECRET_KEY?: string };

export class StripeError extends Error {
  constructor(readonly status: number, readonly code: string, message: string) {
    super(message);
  }
}

export const hasStripe = (env: StripeEnv) => Boolean(env.STRIPE_SECRET_KEY);

/** Flattens {a: {b: 1}, c: [x]} into Stripe's form keys: a[b]=1, c[0]=x. */
export function formEncode(value: Record<string, unknown>, prefix = '', out = new URLSearchParams()): URLSearchParams {
  for (const [key, item] of Object.entries(value)) {
    if (item === undefined || item === null) continue;
    const name = prefix ? `${prefix}[${key}]` : key;
    if (Array.isArray(item)) item.forEach((entry, index) => (typeof entry === 'object' && entry !== null ? formEncode(entry as Record<string, unknown>, `${name}[${index}]`, out) : out.append(`${name}[${index}]`, String(entry))));
    else if (typeof item === 'object') formEncode(item as Record<string, unknown>, name, out);
    else out.append(name, String(item));
  }
  return out;
}

export async function stripe<T = Record<string, unknown>>(
  env: StripeEnv,
  method: 'GET' | 'POST' | 'DELETE',
  path: string,
  params: Record<string, unknown> = {},
  options: { account?: string; idempotencyKey?: string } = {},
): Promise<T> {
  if (!env.STRIPE_SECRET_KEY) throw new StripeError(503, 'not_configured', 'Stripe is not configured');
  const query = method === 'GET' && Object.keys(params).length ? `?${formEncode(params)}` : '';
  const headers: Record<string, string> = { Authorization: `Bearer ${env.STRIPE_SECRET_KEY}`, 'Stripe-Version': '2025-03-31.basil' };
  if (method !== 'GET') headers['Content-Type'] = 'application/x-www-form-urlencoded';
  if (options.account) headers['Stripe-Account'] = options.account;
  if (options.idempotencyKey) headers['Idempotency-Key'] = options.idempotencyKey;
  const response = await fetch(`https://api.stripe.com${path}${query}`, { method, headers, body: method === 'GET' ? undefined : formEncode(params).toString() });
  const body = (await response.json().catch(() => ({}))) as T & { error?: { code?: string; type?: string; message?: string } };
  if (!response.ok) throw new StripeError(response.status, body.error?.code ?? body.error?.type ?? 'stripe_error', body.error?.message ?? `Stripe ${response.status}`);
  return body;
}

/**
 * Stripe API v2 (JSON bodies). Used for Connect accounts: new platforms must
 * create them through /v2/core/accounts. Everything else stays on v1.
 */
export const STRIPE_V2_VERSION = '2026-09-30.endive';

export async function stripeV2<T = Record<string, unknown>>(
  env: StripeEnv,
  method: 'GET' | 'POST',
  path: string,
  body?: Record<string, unknown>,
  options: { idempotencyKey?: string } = {},
): Promise<T> {
  if (!env.STRIPE_SECRET_KEY) throw new StripeError(503, 'not_configured', 'Stripe is not configured');
  const headers: Record<string, string> = { Authorization: `Bearer ${env.STRIPE_SECRET_KEY}`, 'Stripe-Version': STRIPE_V2_VERSION };
  if (body) headers['Content-Type'] = 'application/json';
  if (options.idempotencyKey) headers['Idempotency-Key'] = options.idempotencyKey;
  const response = await fetch(`https://api.stripe.com${path}`, { method, headers, body: body ? JSON.stringify(body) : undefined });
  const data = (await response.json().catch(() => ({}))) as T & { error?: { code?: string; type?: string; message?: string } };
  if (!response.ok) throw new StripeError(response.status, data.error?.code ?? data.error?.type ?? 'stripe_error', data.error?.message ?? `Stripe ${response.status}`);
  return data;
}

/**
 * Verifies a Stripe-Signature header (t=…,v1=…) against the raw body.
 * Rejects events older than 5 minutes to stop replays.
 */
export function verifyStripeSignature(rawBody: string, header: string | null, secret: string | undefined, now = Date.now()): boolean {
  if (!header || !secret) return false;
  const parts = Object.fromEntries(header.split(',').map((part) => part.split('=') as [string, string]).filter((pair) => pair.length === 2));
  const timestamp = Number(parts.t);
  if (!Number.isFinite(timestamp) || Math.abs(now / 1000 - timestamp) > 300) return false;
  const expected = createHmac('sha256', secret).update(`${timestamp}.${rawBody}`).digest('hex');
  const signatures = header.split(',').filter((part) => part.startsWith('v1=')).map((part) => part.slice(3));
  return signatures.some((signature) => signature.length === expected.length && timingSafeEqual(Buffer.from(signature), Buffer.from(expected)));
}
