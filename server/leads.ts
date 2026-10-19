import { randomUUID } from 'node:crypto';
import sharp from 'sharp';
import { withMarketQuote } from '../src/lib/metalMarket.js';
import { depositFor, priceBreakdown } from '../src/lib/pricing.js';
import { parseRenderSpec, summarizeDesign } from '../src/lib/renderSpec.js';
import { createDb, DbError, hasDb } from './db.js';
import { latestSpot } from './metalPrices.js';
import { checkLeadToken, signLeadToken } from './leadTokens.js';
import { notifyLead, type NotifyEnv } from './notify.js';
import { findPromo, type PromoRow } from './promos.js';
import { PROMO_REASONS, type Promo } from '../src/lib/promo.js';
import { hashIp, isEmail, LIMITS, looksAutomated, normaliseContact, verifyTurnstile, type SpamEnv } from './spam.js';
import { configForSession, getPublishedTenant, tenantIdFor } from './tenants.js';

// POST /api/leads: a customer sends their design to the shop.
// The server re-validates the design against the shop's catalog, recomputes the
// price from the shop's config (never the browser's number), stores the lead and
// its 3D capture, and makes sure the shop is emailed: right after the studio
// photo finishes, or after FALLBACK_MS without it, whichever comes first.

export type LeadEnv = NotifyEnv & SpamEnv & { LEAD_TOKEN_SECRET?: string; FLUX_API_KEY?: string };
export type LeadResult = { status: number; body: Record<string, unknown> };
/** Keeps background work (the fallback email) alive after the response is sent. */
export type Defer = (work: Promise<unknown>) => void;

/** How long the shop's email waits for the studio photo before going without it. */
export const FALLBACK_MS = 40_000;
const MAX_PREVIEW_BYTES = 3 * 1024 * 1024;

const fail = (status: number, error: string, code = 'invalid'): LeadResult => ({ status, body: { error, code } });
const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

const secretFor = (env: LeadEnv) => env.LEAD_TOKEN_SECRET || env.SUPABASE_SERVICE_ROLE_KEY || '';

/** Proves a render request may attach its photo to this lead, at this shop, for the next 30 minutes. */
export const leadToken = (leadId: string, tenantId: string, env: LeadEnv, now = Date.now()) => signLeadToken('lead', leadId, tenantId, env, now);

export const verifyLeadToken = (leadId: unknown, tenantId: string | null, token: unknown, env: LeadEnv, now = Date.now()): leadId is string =>
  checkLeadToken('lead', leadId, tenantId, token, env, now);

/** The browser's 3D capture, decoded and re-encoded so only a real, bounded JPEG is stored. */
async function readPreview(value: unknown): Promise<Uint8Array | null> {
  if (typeof value !== 'string') return null;
  const match = value.match(/^data:image\/(jpeg|png|webp);base64,([A-Za-z0-9+/=]+)$/);
  if (!match || (match[2].length * 3) / 4 > MAX_PREVIEW_BYTES) return null;
  try {
    const jpeg = await sharp(Buffer.from(match[2], 'base64'), { limitInputPixels: 4096 * 4096 })
      .resize({ width: 1024, height: 1024, fit: 'inside', withoutEnlargement: true })
      .flatten({ background: '#ffffff' })
      .jpeg({ quality: 85 })
      .toBuffer();
    return new Uint8Array(jpeg);
  } catch {
    return null;
  }
}

const text = (value: unknown, max: number) => (typeof value === 'string' ? value.trim().slice(0, max) : '');

/** UTM tags and the landing path only; anything else the browser sends is dropped. */
export const readSource = (value: unknown) => {
  if (!value || typeof value !== 'object') return {};
  const raw = value as Record<string, unknown>;
  const source: Record<string, string> = {};
  for (const key of ['utm_source', 'utm_medium', 'utm_campaign', 'utm_content', 'utm_term', 'ref', 'path']) {
    const item = text(raw[key], 120);
    if (item) source[key] = item;
  }
  // Where the builder ran: embedded on the shop's site, or on its custom domain (hostnames only).
  for (const key of ['embed', 'domain']) {
    const item = text(raw[key], 253).toLowerCase();
    if (/^[a-z0-9.-]{1,253}(:\d{1,5})?$/.test(item)) source[key] = item;
  }
  return source;
};

export async function handleLead(payload: unknown, ip: string, env: LeadEnv, defer: Defer): Promise<LeadResult> {
  if (!payload || typeof payload !== 'object') return fail(400, 'Invalid request.');
  const body = payload as Record<string, unknown>;

  const lookup = await getPublishedTenant(typeof body.tenant === 'string' ? body.tenant.toLowerCase() : '', env);
  if (!lookup.ok) return lookup.reason === 'unavailable' ? fail(503, 'Something went wrong. Please try again.', 'unavailable') : fail(404, 'Shop not found.', 'not_found');
  const tenant = lookup.tenant;
  if (tenant.status !== 'live') return fail(503, `${tenant.config.brand.name} isn't taking designs right now.`, 'paused');
  if (!hasDb(env)) return fail(503, 'Something went wrong. Please try again.', 'unavailable');

  // Bots get a success that goes nowhere, so they learn nothing about the checks.
  if (looksAutomated({ honeypot: body.website, elapsedMs: body.elapsedMs })) {
    return { status: 200, body: { ok: true, leadId: randomUUID(), token: '' } };
  }
  if (!(await verifyTurnstile(body.turnstile, ip, env))) return fail(400, 'Please confirm you are human and try again.', 'verify');

  const name = text(body.name, 80);
  if (name.length < 2) return fail(400, 'Add your name.');
  const contact = normaliseContact(text(body.contact, 80));
  if (!contact) return fail(400, 'Add your Instagram handle or a US phone number.');
  const email = text(body.email, 120).toLowerCase();
  if (email && !isEmail(email)) return fail(400, 'Check your email address.');
  const note = text(body.note, 300);

  const session = await configForSession(tenant, body.configVersion, env);
  // Market-linked metal is priced at today's stored price, whatever the browser had.
  if (session.config.pricing.market) session.config = { ...session.config, pricing: withMarketQuote(session.config.pricing, await latestSpot(env)) };
  const spec = parseRenderSpec(body.spec, session.config.catalog);
  if (!spec || spec.teeth.length === 0) return fail(400, 'Your design has an option this shop no longer offers. Refresh and try again.', 'design');
  const tenantId = await tenantIdFor(tenant, env);
  if (!tenantId) return fail(503, 'Something went wrong. Please try again.', 'unavailable');
  const db = createDb(env);
  const ipHash = hashIp(ip, secretFor(env));

  // A promo code is checked again here (the builder's check is only a preview) and priced in.
  let promo: Promo | null = null;
  let promoRow: PromoRow | undefined;
  if (typeof body.promo === 'string' && body.promo.trim()) {
    try {
      const found = await findPromo(db, tenantId, body.promo);
      if (!found.status.ok) return fail(400, `${PROMO_REASONS[found.status.reason]} Remove it and send your design again.`, 'promo');
      promo = found.status.promo;
      promoRow = found.row;
    } catch (error) {
      console.error('lead promo lookup failed', tenant.slug, error instanceof Error ? error.message : error);
      return fail(503, 'Something went wrong. Please try again.', 'unavailable');
    }
  }
  const price = priceBreakdown(session.config.pricing, spec.teeth, spec, session.config.catalog.addOns, promo);
  const deposit = depositFor(session.config.deposit, price.total);

  // The use is counted just before the lead is stored, and given back if it isn't.
  let redeemed = false;
  const release = async () => {
    if (!redeemed || !promoRow) return;
    redeemed = false;
    await db.rpc('release_promo', { promo: promoRow.id }).catch((error) => console.error('promo release failed', error instanceof Error ? error.message : error));
  };

  try {
    if (promoRow && price.promo?.amount) {
      redeemed = await db.rpc<boolean>('redeem_promo', { promo: promoRow.id });
      if (!redeemed) return fail(409, `${PROMO_REASONS.used_up} Remove it and send your design again.`, 'promo');
    }
    const leadId = randomUUID();
    const preview = await readPreview(body.preview);

    // A photo will follow when the shop has AI photos and the browser asked for one.
    const wantsPhoto = body.photo === true && Boolean(env.FLUX_API_KEY) && tenant.config.ai.monthlyGenerations > 0;
    // Limits are checked and the lead inserted under one database lock, so a burst can't slip past them.
    const created = await db.rpc<string>('create_lead', {
      per_ip_hour: LIMITS.perIpHour,
      per_shop_day: LIMITS.perShopDay,
      per_email_day: LIMITS.perEmailDay,
      lead: {
        id: leadId,
        tenant_id: tenantId,
        name,
        contact: contact.value,
        email: email || null,
        note: note || null,
        spec: { ...spec, summary: summarizeDesign(spec, session.config.catalog.addOns) },
        price,
        total: price.total,
        deposit,
        config_version: session.version,
        source: readSource(body.source),
        ip_hash: ipHash,
        render_status: wantsPhoto ? 'rendering' : 'none',
        event: { contact_kind: contact.kind },
      },
    });
    if (created !== 'ok') {
      await release();
      if (created === 'shop') console.error('lead daily cap reached', tenant.slug);
      const message =
        created === 'shop'
          ? 'The shop is getting a lot of designs right now. Please try again later.'
          : created === 'email'
            ? 'That email has sent a few designs today already. Leave it blank, or try again tomorrow.'
            : 'You have sent a few designs already. Message the shop directly, or try again later.';
      return fail(429, message, 'throttled');
    }

    // Stored only once the lead is accepted, so throttled requests never reach storage.
    if (preview) {
      const path = `${tenantId}/${leadId}/preview.jpg`;
      try {
        await db.upload('lead-media', path, preview, 'image/jpeg');
        await db.update('leads', { id: `eq.${leadId}` }, { preview_path: path });
      } catch (error) {
        console.error('lead preview upload failed', error instanceof Error ? error.message : error);
      }
    }

    // Safety net: the shop hears about every lead even if the photo never arrives.
    defer(
      (async () => {
        if (wantsPhoto) await sleep(FALLBACK_MS);
        await notifyLead(leadId, wantsPhoto ? 'timeout' : 'final', env);
      })().catch((error) => console.error('lead notify failed', leadId, error instanceof Error ? error.message : error)),
    );

    return { status: 200, body: { ok: true, leadId, token: leadToken(leadId, tenantId, env), total: price.total, deposit } };
  } catch (error) {
    await release();
    console.error('lead failed', tenant.slug, error instanceof DbError ? error.message : error);
    return fail(503, 'Something went wrong. Please try again.', 'unavailable');
  }
}
