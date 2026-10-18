import { createHmac, timingSafeEqual } from 'node:crypto';
import { createDb, DbError, hasDb, type Db } from './db.js';
import { sendEmail, type Email, type EmailEnv } from './email.js';
import type { RenderedEmail } from './emailTemplates.js';
import type { TokenEnv } from './leadTokens.js';
import type { TenantEnv } from './tenants.js';

// Marketing email: the trial sequence, product news and win-back. Everything
// here follows the bulk-sender rules (Gmail, Yahoo) and CAN-SPAM:
//   - every send checks the opt-out list first, and is logged once
//     (email_sends.dedupe_key), so a sequence step never goes out twice;
//   - every email carries List-Unsubscribe + List-Unsubscribe-Post (one-click,
//     RFC 8058) and a visible unsubscribe link in the footer;
//   - it goes out from the marketing subdomain, never the lead-mail domain.

export type Topic = 'tips' | 'news';
export const TOPICS: Record<Topic, string> = {
  tips: 'tips and trial emails',
  news: 'product news',
};

export type MarketingEnv = TenantEnv & EmailEnv & TokenEnv & { PUBLIC_ORIGIN?: string };

const origin = (env: MarketingEnv) => (env.PUBLIC_ORIGIN || 'https://vvslab.magpollo.com').replace(/\/$/, '');
const secretFor = (env: TokenEnv) => env.LEAD_TOKEN_SECRET || env.SUPABASE_SERVICE_ROLE_KEY || '';
const normalise = (email: string) => email.trim().toLowerCase();

// ---------- Unsubscribe links ----------

/** Signs an address (not a topic), so one link can also offer "unsubscribe from all". Never expires. */
const signature = (email: string, env: TokenEnv) => createHmac('sha256', secretFor(env)).update(`unsubscribe:${normalise(email)}`).digest('base64url').slice(0, 32);

export function unsubscribeUrl(email: string, topic: Topic, env: MarketingEnv): string {
  const params = new URLSearchParams({ e: Buffer.from(normalise(email)).toString('base64url'), topic, s: signature(email, env) });
  return `${origin(env)}/api/unsubscribe?${params}`;
}

/** The address an unsubscribe link was made for, or null if the link was altered. */
export function readUnsubscribeLink(params: URLSearchParams, env: TokenEnv): { email: string; topic: Topic } | null {
  const email = Buffer.from(params.get('e') ?? '', 'base64url').toString('utf8');
  const topic = params.get('topic');
  const given = Buffer.from(params.get('s') ?? '');
  if (!email.includes('@') || (topic !== 'tips' && topic !== 'news') || !secretFor(env)) return null;
  const expected = Buffer.from(signature(email, env));
  return expected.length === given.length && timingSafeEqual(expected, given) ? { email: normalise(email), topic } : null;
}

// ---------- Opt-outs ----------

export type UnsubscribeSource = 'link' | 'one_click' | 'complaint' | 'bounce' | 'admin';

/** Records an opt-out; doing it twice is fine. */
export async function unsubscribe(db: Db, email: string, topic: Topic | 'all', source: UnsubscribeSource) {
  try {
    await db.insert('email_unsubscribes', { email: normalise(email), topic, source });
  } catch (error) {
    if (!(error instanceof DbError && error.status === 409)) throw error;
  }
}

export const resubscribe = (db: Db, email: string) => db.remove('email_unsubscribes', { email: `eq.${normalise(email)}`, topic: 'in.(all,tips,news)' });

/** The topics this address has opted out of ('all' included). */
export async function optOuts(db: Db, email: string): Promise<Set<Topic | 'all'>> {
  const rows = await db.select<{ topic: Topic | 'all' }>('email_unsubscribes', { email: `eq.${normalise(email)}`, select: 'topic' });
  return new Set(rows.map((row) => row.topic));
}

// ---------- Sending ----------

export type MarketingSend = {
  to: string;
  topic: Topic;
  /** What this email is, e.g. 'trial-day-3'. */
  kind: string;
  /** Unique per intended send, e.g. 'trial-day-3:<tenant id>'. */
  dedupeKey: string;
  tenantId?: string | null;
  fromName: string;
  /** Builds the email with its unsubscribe link (for the footer). */
  render: (unsubscribe: string) => Promise<RenderedEmail>;
  replyTo?: string[];
};

export type MarketingResult = 'sent' | 'duplicate' | 'opted_out' | 'not_configured' | 'failed';

export async function sendMarketingEmail(send: MarketingSend, env: MarketingEnv): Promise<MarketingResult> {
  if (!hasDb(env) || !env.EMAIL_MARKETING_FROM_DOMAIN || !env.RESEND_API_KEY) return 'not_configured';
  const db = createDb(env);
  const email = normalise(send.to);
  const opted = await optOuts(db, email);
  if (opted.has('all') || opted.has(send.topic)) return 'opted_out';

  // Claim the send: the unique key means only one caller ever gets past here.
  let row: { id: string };
  try {
    row = await db.insert<{ id: string }>('email_sends', { dedupe_key: send.dedupeKey, kind: send.kind, topic: send.topic, email, tenant_id: send.tenantId ?? null });
  } catch (error) {
    if (error instanceof DbError && error.status === 409) return 'duplicate';
    throw error;
  }

  const link = unsubscribeUrl(email, send.topic, env);
  const rendered = await send.render(link);
  const message: Email = {
    fromName: send.fromName,
    fromLocal: 'hello',
    stream: 'marketing',
    to: [email],
    ...rendered,
    replyTo: send.replyTo,
    headers: { 'List-Unsubscribe': `<${link}>`, 'List-Unsubscribe-Post': 'List-Unsubscribe=One-Click', 'X-Entity-Ref-ID': row.id },
  };
  const sent = await sendEmail(message, env);
  await db.update('email_sends', { id: `eq.${row.id}` }, sent.ok
    ? { status: 'sent', resend_id: sent.id, updated_at: new Date().toISOString() }
    : { status: sent.reason === 'not_configured' ? 'skipped' : 'failed', detail: `${sent.reason} ${sent.detail ?? ''}`.trim().slice(0, 300), updated_at: new Date().toISOString() });
  return sent.ok ? 'sent' : sent.reason === 'not_configured' ? 'not_configured' : 'failed';
}

// ---------- The unsubscribe page (GET shows it, POST acts) ----------

const escape = (text: string) => text.replace(/[&<>"']/g, (char) => `&#${char.charCodeAt(0)};`);

function page(title: string, body: string) {
  return `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="robots" content="noindex"><link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Instrument+Serif&display=swap"><title>${escape(title)} · VVS Lab</title>
<style>
body{margin:0;min-height:100vh;display:grid;place-items:center;background:#fbf7f0;color:#1b1714;font:17px/1.55 -apple-system,BlinkMacSystemFont,'Segoe UI',Helvetica,Arial,sans-serif}
main{max-width:440px;padding:40px 24px;text-align:center}
img{width:96px;height:96px}
h1{font:400 34px/1.1 'Instrument Serif',Georgia,serif;margin:12px 0 12px}
p{margin:0 0 16px;color:#6f655a}
button{font-family:inherit;font-size:16px;font-weight:600;line-height:1;border:0;border-radius:999px;padding:15px 26px;cursor:pointer}
.primary{background:#ce4257;color:#fff}
.quiet{background:none;color:#b02f45;text-decoration:underline;padding:10px}
form{margin:0 0 8px}
@media(prefers-color-scheme:dark){body{background:#1b1714;color:#f3ede4}p{color:#b5a995}.quiet{color:#ec7385}.primary{background:#ec7385;color:#1b1714}}
</style></head><body><main>${body}</main></body></html>`;
}

const karat = (env: MarketingEnv, expression: 'nudge' | 'tarnished' | 'wink') => `<img src="${origin(env)}/assets/mascot/karat-${expression}.png" alt="">`;

export type PageResult = { status: number; html: string };

/**
 * GET shows a confirm page (link scanners prefetch GETs, so a GET never
 * unsubscribes). POST acts: a mail client's one-click
 * ("List-Unsubscribe=One-Click"), or the page's buttons (action=topic|all|resubscribe).
 */
export async function handleUnsubscribe(method: string, url: URL, form: URLSearchParams, env: MarketingEnv): Promise<PageResult> {
  const link = readUnsubscribeLink(url.searchParams, env);
  if (!link) return { status: 400, html: page('Link not valid', `<h1>This link isn't valid</h1><p>It may have been cut off. Use the unsubscribe link at the bottom of any of our emails, or reply to one and we'll take you off.</p>`) };
  if (!hasDb(env)) return { status: 503, html: page('Try again', '<h1>Try again in a minute</h1><p>We couldn’t reach our list just now.</p>') };
  const db = createDb(env);
  const { email, topic } = link;
  const self = escape(url.pathname + url.search);
  const who = `<strong>${escape(email)}</strong>`;

  if (method === 'POST') {
    const action = form.get('List-Unsubscribe') === 'One-Click' ? 'one_click' : form.get('action');
    if (action === 'resubscribe') {
      await resubscribe(db, email);
      return { status: 200, html: page('Resubscribed', `${karat(env, 'wink')}<h1>Welcome back</h1><p>${who} will get VVS Lab emails again.</p>`) };
    }
    const scope: Topic | 'all' = action === 'all' ? 'all' : topic;
    await unsubscribe(db, email, scope, action === 'one_click' ? 'one_click' : 'link');
    if (action === 'one_click') return { status: 200, html: page('Unsubscribed', '<h1>Unsubscribed</h1>') };
    return {
      status: 200,
      html: page(
        'Unsubscribed',
        `${karat(env, 'tarnished')}<h1>You're unsubscribed</h1><p>${who} won't get ${scope === 'all' ? 'any VVS Lab marketing emails' : TOPICS[scope]} anymore. Emails about your account and your design requests still arrive.</p>
<form method="post" action="${self}"><input type="hidden" name="action" value="resubscribe"><button class="quiet" type="submit">Changed your mind? Resubscribe</button></form>`,
      ),
    };
  }

  const opted = await optOuts(db, email);
  if (opted.has('all') || opted.has(topic)) {
    return {
      status: 200,
      html: page('Unsubscribed', `${karat(env, 'tarnished')}<h1>You're already unsubscribed</h1><p>${who} doesn't get ${opted.has('all') ? 'any VVS Lab marketing emails' : TOPICS[topic]}.</p>
<form method="post" action="${self}"><input type="hidden" name="action" value="resubscribe"><button class="quiet" type="submit">Resubscribe</button></form>`),
    };
  }
  return {
    status: 200,
    html: page(
      'Unsubscribe',
      `${karat(env, 'nudge')}<h1>Unsubscribe?</h1><p>Stop sending ${TOPICS[topic]} to ${who}.</p>
<form method="post" action="${self}"><input type="hidden" name="action" value="topic"><button class="primary" type="submit">Unsubscribe</button></form>
<form method="post" action="${self}"><input type="hidden" name="action" value="all"><button class="quiet" type="submit">Unsubscribe from all VVS Lab marketing</button></form>`,
    ),
  };
}

// ---------- Complaints and bounces (Resend webhook) ----------

export type WebhookEnv = MarketingEnv & { RESEND_WEBHOOK_SECRET?: string };

/** Resend signs webhooks with Svix: HMAC-SHA256 over "id.timestamp.body", base64, "v1,<sig>" entries. */
export function verifyResendSignature(rawBody: string, headers: { id: string | null; timestamp: string | null; signature: string | null }, secret: string | undefined, now = Date.now()): boolean {
  if (!secret || !headers.id || !headers.timestamp || !headers.signature) return false;
  const timestamp = Number(headers.timestamp);
  if (!Number.isFinite(timestamp) || Math.abs(now / 1000 - timestamp) > 300) return false;
  const key = Buffer.from(secret.replace(/^whsec_/, ''), 'base64');
  const expected = Buffer.from(createHmac('sha256', key).update(`${headers.id}.${headers.timestamp}.${rawBody}`).digest('base64'));
  return headers.signature.split(' ').some((entry) => {
    const [version, value = ''] = entry.split(',');
    const given = Buffer.from(value);
    return version === 'v1' && given.length === expected.length && timingSafeEqual(given, expected);
  });
}

type ResendEvent = { type?: string; data?: { email_id?: string; to?: string[]; bounce?: { type?: string } } };

/**
 * POST /api/resend-webhook: a spam complaint or a hard bounce takes the address
 * off all marketing mail at once (Gmail and Yahoo require complaints under 0.3%).
 * Account and lead email still go to it.
 */
export async function handleResendWebhook(rawBody: string, headers: { id: string | null; timestamp: string | null; signature: string | null }, env: WebhookEnv): Promise<{ status: number; body: Record<string, unknown> }> {
  if (!verifyResendSignature(rawBody, headers, env.RESEND_WEBHOOK_SECRET)) return { status: 400, body: { error: 'signature' } };
  if (!hasDb(env)) return { status: 503, body: { error: 'unavailable' } };
  const event = JSON.parse(rawBody) as ResendEvent;
  const bounceType = (event.data?.bounce?.type ?? '').toLowerCase();
  const source: UnsubscribeSource | null = event.type === 'email.complained' ? 'complaint' : event.type === 'email.bounced' && !/transient|temporary|soft/.test(bounceType) ? 'bounce' : null;
  if (!source) return { status: 200, body: { received: true, ignored: event.type ?? 'unknown' } };
  const db = createDb(env);
  for (const address of event.data?.to ?? []) await unsubscribe(db, address, 'all', source);
  if (event.data?.email_id) await db.update('email_sends', { resend_id: `eq.${event.data.email_id}` }, { status: 'failed', detail: source, updated_at: new Date().toISOString() }).catch(() => []);
  return { status: 200, body: { received: true, suppressed: event.data?.to?.length ?? 0 } };
}
