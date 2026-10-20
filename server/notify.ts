import { createDb, type Db } from './db.js';
import { sendEmail, type Attachment, type EmailEnv } from './email.js';
import { customerEmail, depositPaidEmail, shopEmail, shopPhotoEmail, type LeadForEmail } from './emailTemplates.js';
import { signLeadToken, type TokenEnv } from './leadTokens.js';
import { getPublishedTenant, type PublishedTenant, type TenantEnv } from './tenants.js';

// Delivers a lead to the shop exactly once. Two paths race to send the shop's
// email (the render finishing, or the fallback timer in the lead request); the
// first to set leads.notified_at wins, atomically, so the shop never gets two
// first emails. If the photo lands after the email went out, it follows as a
// reply in the same thread.

export type NotifyEnv = TenantEnv & EmailEnv & TokenEnv & {
  /** Where demo and test-shop leads go, and leads for a shop with no lead email yet. */
  PLATFORM_LEADS_EMAIL?: string;
  /** Public origin for logo links in emails. */
  PUBLIC_ORIGIN?: string;
};

/** timeout: fallback timer fired. photo: the photo just landed. final: no photo is coming. */
export type NotifyReason = 'timeout' | 'photo' | 'final';

type LeadRow = {
  id: string;
  tenant_id: string;
  created_at: string;
  name: string;
  contact: string;
  email: string | null;
  note: string | null;
  spec: { summary?: string[] };
  price: LeadForEmail['price'];
  total: number | string;
  deposit: number | string | null;
  config_version: number;
  preview_path: string | null;
  photo_path: string | null;
  render_status: string;
  notified_at: string | null;
  photo_notified_at: string | null;
  deposit_paid_at?: string | null;
};

const toEmailLead = (row: LeadRow): LeadForEmail => ({
  id: row.id,
  name: row.name,
  contact: row.contact,
  email: row.email,
  note: row.note,
  summary: row.spec.summary ?? [],
  price: row.price,
  total: Number(row.total),
  deposit: row.deposit === null ? null : Number(row.deposit),
  configVersion: row.config_version,
  createdAt: row.created_at,
});

/** Who receives a shop's leads. Demo and test shops never email made-up addresses. */
export function recipientsFor(tenant: PublishedTenant, env: NotifyEnv): { to: string[]; test: boolean } {
  const platform = env.PLATFORM_LEADS_EMAIL ? [env.PLATFORM_LEADS_EMAIL] : [];
  if (tenant.kind === 'demo') return { to: platform, test: false };
  if (tenant.kind === 'fixture') return { to: platform, test: true };
  const shop = tenant.config.leads.email;
  return { to: shop.length ? shop : platform, test: false };
}

/** "Icebox Jewelers via VVS Lab"; the demo's own leads just say VVS Lab Demo. */
const senderName = (tenant: PublishedTenant) => (tenant.kind === 'demo' ? 'VVS Lab Demo' : `${tenant.config.brand.name} via VVS Lab`);

const threadId = (leadId: string, env: NotifyEnv) => `<lead-${leadId}@${env.EMAIL_FROM_DOMAIN || 'vvslab.magpollo.com'}>`;

const event = (db: Db, row: LeadRow, type: string, data: Record<string, unknown> = {}) =>
  db.insert('lead_events', { lead_id: row.id, tenant_id: row.tenant_id, type, data }).catch(() => {});

const media = async (db: Db, path: string | null, name: 'photo' | 'preview'): Promise<Attachment | null> => {
  if (!path) return null;
  try {
    return { filename: `${name}.jpg`, content: await db.download('lead-media', path), contentId: name, contentType: 'image/jpeg' };
  } catch {
    return null;
  }
};

async function tenantFor(db: Db, tenantId: string, env: NotifyEnv): Promise<PublishedTenant | null> {
  const [row] = await db.select<{ slug: string }>('tenants', { id: `eq.${tenantId}`, select: 'slug' });
  if (!row) return null;
  const lookup = await getPublishedTenant(row.slug, env);
  return lookup.ok ? lookup.tenant : null;
}

export async function notifyLead(leadId: string, reason: NotifyReason, env: NotifyEnv): Promise<'sent' | 'skipped' | 'already' | 'failed' | 'photo_sent'> {
  const db = createDb(env);
  const origin = env.PUBLIC_ORIGIN || 'https://vvslab.magpollo.com';

  // Claim the first email. Only one caller gets the row back.
  const [claimed] = await db.update<LeadRow>('leads', { id: `eq.${leadId}`, notified_at: 'is.null' }, { notified_at: new Date().toISOString() });

  if (!claimed) {
    // The first email already went. If the photo just landed, send it as a follow-up.
    if (reason !== 'photo') return 'already';
    const [row] = await db.update<LeadRow>('leads', { id: `eq.${leadId}`, photo_notified_at: 'is.null', photo_path: 'not.is.null' }, { photo_notified_at: new Date().toISOString() });
    if (!row) return 'already';
    const tenant = await tenantFor(db, row.tenant_id, env);
    if (!tenant) return 'failed';
    const { to, test } = recipientsFor(tenant, env);
    const photo = await media(db, row.photo_path, 'photo');
    if (!photo) return 'failed';
    const lead = toEmailLead(row);
    const original = (await shopEmail({ lead, config: tenant.config, origin, images: { photo: false, preview: true }, photoPending: true, test })).subject;
    const email = await shopPhotoEmail({ lead, config: tenant.config, origin, subject: original });
    const sent = await sendEmail(
      {
        fromName: senderName(tenant),
        to,
        ...email,
        replyTo: lead.email ? [lead.email] : undefined,
        attachments: [photo],
        headers: { 'In-Reply-To': threadId(lead.id, env), References: threadId(lead.id, env) },
      },
      env,
    );
    await event(db, row, sent.ok ? 'photo_sent' : 'email_failed', sent.ok ? { id: sent.id } : { reason: sent.reason, detail: sent.detail, kind: 'photo' });
    return sent.ok ? 'photo_sent' : 'failed';
  }

  const row = claimed;
  const tenant = await tenantFor(db, row.tenant_id, env);
  if (!tenant) {
    await event(db, row, 'email_failed', { reason: 'tenant_missing' });
    return 'failed';
  }
  const lead = toEmailLead(row);
  const [photo, preview] = await Promise.all([media(db, row.photo_path, 'photo'), previewIfNoPhoto(db, row)]);
  const images = { photo: Boolean(photo), preview: Boolean(preview) };
  const attachments = [photo ?? preview].filter((item): item is Attachment => item !== null);
  const photoPending = !photo && row.render_status === 'rendering';
  if (photo) await db.update('leads', { id: `eq.${row.id}` }, { photo_notified_at: new Date().toISOString() }).catch(() => {});

  const { to, test } = recipientsFor(tenant, env);
  const depositOffer = test ? null : await depositOfferFor(db, row, tenant, origin);
  const shop = await shopEmail({ lead, config: tenant.config, origin, images, photoPending, test, depositOffer });
  let result: 'sent' | 'skipped' | 'failed' = 'skipped';
  if (to.length === 0) {
    await event(db, row, 'email_skipped', { reason: 'no_recipients' });
  } else {
    const sent = await sendEmail(
      {
        fromName: senderName(tenant),
        to,
        ...shop,
        replyTo: lead.email ? [lead.email] : undefined,
        attachments,
        headers: { 'Message-ID': threadId(lead.id, env), 'X-Entity-Ref-ID': lead.id },
      },
      env,
    );
    if (sent.ok) result = 'sent';
    else result = sent.reason === 'not_configured' ? 'skipped' : 'failed';
    await event(db, row, sent.ok ? 'email_sent' : sent.reason === 'not_configured' ? 'email_skipped' : 'email_failed', sent.ok ? { id: sent.id, reason } : { reason: sent.reason, detail: sent.detail });
    if (!sent.ok && sent.reason !== 'not_configured') console.error('lead email failed', lead.id, sent.reason, sent.detail);
  }

  // The customer's confirmation goes once. It only ever carries our own studio
  // photo, never the uploaded capture, so the form can't mail arbitrary images.
  if (lead.email) {
    const depositHref = await depositLink(db, row, tenant, origin, env);
    const confirmation = await customerEmail({ lead, config: tenant.config, origin, images: { photo: Boolean(photo), preview: false }, depositHref });
    const replyTo = tenant.kind === 'shop' && tenant.config.leads.email.length ? tenant.config.leads.email : to;
    const sent = await sendEmail({ fromName: tenant.config.brand.name, to: [lead.email], ...confirmation, replyTo, attachments: photo ? [photo] : [] }, env);
    if (sent.ok || sent.reason !== 'not_configured') await event(db, row, sent.ok ? 'confirmation_sent' : 'confirmation_failed', sent.ok ? { id: sent.id } : { reason: sent.reason });
  }
  return result;
}

/** Tells the shop a customer paid their deposit (from the Stripe webhook, once per lead). */
export async function notifyDepositPaid(leadId: string, amount: number, env: NotifyEnv): Promise<'sent' | 'skipped' | 'failed'> {
  const db = createDb(env);
  const origin = env.PUBLIC_ORIGIN || 'https://vvslab.magpollo.com';
  const [row] = await db.select<LeadRow>('leads', { id: `eq.${leadId}` });
  if (!row) return 'skipped';
  const tenant = await tenantFor(db, row.tenant_id, env);
  if (!tenant) return 'skipped';
  const { to } = recipientsFor(tenant, env);
  if (to.length === 0) return 'skipped';
  const lead = toEmailLead(row);
  const email = await depositPaidEmail({ lead, config: tenant.config, origin, amount });
  const sent = await sendEmail({ fromName: senderName(tenant), to, ...email, replyTo: lead.email ? [lead.email] : undefined, headers: { 'X-Entity-Ref-ID': `${lead.id}-deposit` } }, env);
  if (sent.ok || sent.reason !== 'not_configured') await event(db, row, sent.ok ? 'deposit_email_sent' : 'deposit_email_failed', sent.ok ? { id: sent.id } : { reason: sent.reason });
  return sent.ok ? 'sent' : sent.reason === 'not_configured' ? 'skipped' : 'failed';
}

/** Where the customer pays the deposit from their email: the shop's own payment link, or our Stripe Checkout link. */
/**
 * Deposits start off (MAG-91). A shop's first design request offers them, while
 * deposits are off and Stripe isn't connected: a link to the deposit settings.
 */
export async function depositOfferFor(db: Db, row: LeadRow, tenant: PublishedTenant, origin: string): Promise<string | null> {
  if (tenant.kind !== 'shop' || tenant.config.deposit.mode !== 'none') return null;
  const [shop] = await db.select<{ stripe_charges_enabled: boolean | null }>('tenants', { id: `eq.${row.tenant_id}`, select: 'stripe_charges_enabled' }).catch(() => []);
  if (!shop || shop.stripe_charges_enabled) return null;
  // This request is already counted (notified_at was just set).
  const sent = await db.count('leads', { tenant_id: `eq.${row.tenant_id}`, notified_at: 'not.is.null' }).catch(() => 0);
  return sent === 1 ? `${origin.replace(/\/$/, '')}/dashboard/${tenant.slug}/shop?advanced=1#deposit` : null;
}

async function depositLink(db: Db, row: LeadRow, tenant: PublishedTenant, origin: string, env: NotifyEnv): Promise<string | null> {
  const deposit = tenant.config.deposit;
  if (row.deposit === null || Number(row.deposit) <= 0 || row.deposit_paid_at) return null;
  if (deposit.mode === 'link') return deposit.link ?? null;
  if (deposit.mode !== 'stripe') return null;
  const [shop] = await db
    .select<{ stripe_account_id: string | null; stripe_charges_enabled: boolean | null; status: string }>('tenants', { id: `eq.${row.tenant_id}`, select: 'stripe_account_id,stripe_charges_enabled,status' })
    .catch(() => []);
  if (!shop?.stripe_account_id || !shop.stripe_charges_enabled || shop.status !== 'live') return null;
  return `${origin.replace(/\/$/, '')}/api/deposit?lead=${row.id}&t=${signLeadToken('deposit', row.id, row.tenant_id, env)}`;
}

// The 3D capture, only needed when there is no photo yet.
async function previewIfNoPhoto(db: Db, row: LeadRow) {
  return row.photo_path ? null : media(db, row.preview_path, 'preview');
}
