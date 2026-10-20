import type { Spot } from '../lib/metalMarket';
import { parseTenantConfig, type TenantConfig } from '../lib/tenant/schema';
import { supabase } from './supabase';

// Admin queries. Everything goes through row-level security as the signed-in
// user; the policies let platform admins read and write every shop.

export type TenantRow = {
  id: string;
  slug: string;
  name: string;
  kind: 'demo' | 'shop' | 'fixture';
  status: 'draft' | 'live' | 'paused' | 'offboarded';
  published_version: number | null;
  created_at: string;
};

export const STATUS_LABEL: Record<TenantRow['status'], string> = { draft: 'Draft', live: 'Live', paused: 'Paused', offboarded: 'Offboarded' };

export type ConfigRow = { id: string; version: number; status: 'draft' | 'published' | 'archived'; config: unknown; created_at: string; published_at: string | null };

export type LeadRow = {
  id: string;
  created_at: string;
  name: string;
  contact: string;
  email: string | null;
  note: string | null;
  status: string;
  total: number;
  deposit: number | null;
  render_status: string;
  notified_at: string | null;
  preview_path: string | null;
  photo_path: string | null;
  spec: { summary?: string[] };
  source: Record<string, string>;
  /** The promo code the customer used, and what it took off. */
  promo: { code: string; amount: number } | null;
};

const must = <T,>(result: { data: T | null; error: { message: string } | null }): T => {
  if (result.error) throw new Error(result.error.message);
  return result.data as T;
};

export const monthStart = () => {
  const now = new Date();
  return new Date(now.getFullYear(), now.getMonth(), 1).toISOString();
};

export async function isAdmin(): Promise<boolean> {
  const db = supabase();
  const { data: user } = await db.auth.getUser();
  if (!user.user) return false;
  // Admins are granted by hand in the database (see supabase/README.md).
  const rows = must(await db.from('platform_admins').select('user_id').eq('user_id', user.user.id));
  return rows.length > 0;
}

export async function listTenants() {
  const db = supabase();
  const tenants = must(await db.from('tenants').select('id,slug,name,kind,status,published_version,created_at').order('created_at')) as TenantRow[];
  const since = monthStart();
  const stats = await Promise.all(
    tenants.map(async (tenant) => {
      const [leads, usage] = await Promise.all([
        db.from('leads').select('id', { count: 'exact', head: true }).eq('tenant_id', tenant.id).gte('created_at', since),
        db.from('render_usage').select('generations').eq('tenant_id', tenant.id).gte('created_at', since),
      ]);
      const generations = ((usage.data ?? []) as { generations: number }[]).reduce((sum, row) => sum + row.generations, 0);
      return { leads: leads.count ?? 0, generations };
    }),
  );
  return tenants.map((tenant, index) => ({ ...tenant, ...stats[index] }));
}

export async function getTenant(slug: string) {
  const db = supabase();
  const [tenant] = must(await db.from('tenants').select('id,slug,name,kind,status,published_version,created_at').eq('slug', slug)) as TenantRow[];
  if (!tenant) return null;
  const configs = must(await db.from('tenant_configs').select('id,version,status,config,created_at,published_at').eq('tenant_id', tenant.id).order('version', { ascending: false }).limit(20)) as ConfigRow[];
  return { tenant, configs };
}

export async function createTenant(input: { slug: string; name: string; kind: 'shop' | 'fixture'; config: TenantConfig }) {
  const db = supabase();
  const { data: user } = await db.auth.getUser();
  const [tenant] = must(await db.from('tenants').insert({ slug: input.slug, name: input.name, kind: input.kind, status: 'draft' }).select('id,slug')) as { id: string; slug: string }[];
  must(await db.from('tenant_configs').insert({ tenant_id: tenant.id, version: 1, config: input.config, status: 'draft', created_by: user.user?.id }).select('id'));
  return tenant;
}

/** Saves the editor's config as the shop's draft: updates the open draft, or starts a new version. */
export async function saveDraft(tenant: TenantRow, configs: ConfigRow[], config: TenantConfig): Promise<ConfigRow> {
  const parsed = parseTenantConfig(config);
  if (!parsed.ok) throw new Error(parsed.issues[0]?.message ?? 'The config has errors.');
  const db = supabase();
  if (tenant.name !== parsed.config.brand.name) await db.from('tenants').update({ name: parsed.config.brand.name }).eq('id', tenant.id);
  const draft = configs.find((row) => row.status === 'draft');
  if (draft) {
    const [row] = must(await db.from('tenant_configs').update({ config: parsed.config }).eq('id', draft.id).select('id,version,status,config,created_at,published_at')) as ConfigRow[];
    return row;
  }
  const { data: user } = await db.auth.getUser();
  const version = Math.max(0, ...configs.map((row) => row.version)) + 1;
  const [row] = must(
    await db.from('tenant_configs').insert({ tenant_id: tenant.id, version, config: parsed.config, status: 'draft', created_by: user.user?.id }).select('id,version,status,config,created_at,published_at'),
  ) as ConfigRow[];
  return row;
}

export async function publish(configId: string) {
  return must(await supabase().rpc('publish_config', { config_id: configId })) as number;
}

export async function setStatus(tenantId: string, status: TenantRow['status']) {
  return must(await supabase().rpc('set_tenant_status', { target: tenantId, next_status: status })) as string;
}

export async function uploadLogo(tenantId: string, file: File): Promise<string> {
  const db = supabase();
  if (!['image/png', 'image/jpeg', 'image/webp'].includes(file.type)) throw new Error('Logos must be PNG, JPEG or WebP.');
  const ext = file.type === 'image/webp' ? 'webp' : file.type === 'image/jpeg' ? 'jpg' : 'png';
  const path = `${tenantId}/logo-${Date.now()}.${ext}`;
  const { error } = await db.storage.from('tenant-assets').upload(path, file, { contentType: file.type, cacheControl: '31536000', upsert: false });
  if (error) throw new Error(error.message);
  return db.storage.from('tenant-assets').getPublicUrl(path).data.publicUrl;
}

export async function listLeads(tenantId: string) {
  const db = supabase();
  const leads = must(
    await db
      .from('leads')
      .select('id,created_at,name,contact,email,note,status,total,deposit,render_status,notified_at,preview_path,photo_path,spec,source,promo:price->promo')
      .eq('tenant_id', tenantId)
      .order('created_at', { ascending: false })
      .limit(200),
  ) as LeadRow[];
  const paths = leads.map((lead) => lead.photo_path ?? lead.preview_path).filter((path): path is string => Boolean(path));
  const signed = paths.length ? ((await db.storage.from('lead-media').createSignedUrls(paths, 3600)).data ?? []) : [];
  const urls = new Map(signed.map((item) => [item.path, item.signedUrl]));
  const events = leads.length
    ? (must(await db.from('lead_events').select('lead_id,type,created_at').in('lead_id', leads.map((lead) => lead.id)).order('created_at')) as { lead_id: string; type: string }[])
    : [];
  return leads.map((lead) => ({
    ...lead,
    image: urls.get(lead.photo_path ?? lead.preview_path ?? '') ?? null,
    delivery: events.filter((item) => item.lead_id === lead.id && item.type.startsWith('email')).map((item) => item.type).at(-1) ?? null,
  }));
}

export async function setLeadStatus(leadId: string, status: string) {
  must(await supabase().from('leads').update({ status }).eq('id', leadId).select('id'));
}

// ---------- Shop dashboard (/dashboard) ----------
// The same queries serve shop members: row-level security limits them to their
// own shops. Publishing and inviting go through /api/dashboard so the server can
// validate the config and keep plan-controlled fields.

export type MemberRole = 'owner' | 'staff';
export type MyShop = TenantRow & { role: MemberRole | 'admin'; plan?: string; trial_ends_at?: string | null; billing_status?: string; current_period_end?: string | null };

export async function myShops(): Promise<MyShop[]> {
  const db = supabase();
  const { data: user } = await db.auth.getUser();
  if (!user.user) return [];
  const rows = must(await db.from('members').select('role,tenants(id,slug,name,kind,status,published_version,created_at,plan,trial_ends_at,billing_status,current_period_end)').eq('user_id', user.user.id)) as unknown as { role: MemberRole; tenants: (TenantRow & { plan: string; trial_ends_at: string | null; billing_status: string; current_period_end: string | null }) | null }[];
  return rows.filter((row) => row.tenants).map((row) => ({ ...(row.tenants as TenantRow), role: row.role })).sort((a, b) => a.name.localeCompare(b.name));
}

async function api<T>(action: string, body: Record<string, unknown>): Promise<T> {
  const { data } = await supabase().auth.getSession();
  const response = await fetch(`/api/dashboard/${action}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${data.session?.access_token ?? ''}` },
    body: JSON.stringify(body),
  });
  const json = (await response.json().catch(() => ({}))) as T & { message?: string; error?: string; issues?: { path: string; message: string }[] };
  if (!response.ok) throw new Error(json.message ?? json.issues?.[0]?.message ?? (response.status === 401 ? 'Your session ended. Sign in again.' : 'Something went wrong. Try again.'));
  return json;
}

export const publishAsMember = (configId: string) => api<{ version: number; reset: string[]; live: boolean; slug: string }>('publish', { configId });
/** Platform admins: closes the page, ends the plan at period end, removes the custom domain. Safe to run again. */
export const offboardShop = (tenantId: string) => api<{ ok: boolean; message: string }>('offboard', { tenantId });
export const inviteMember = (tenantId: string, email: string, role: MemberRole) => api<{ invited: boolean; message: string }>('invite', { tenantId, email, role });

/** Joins any shops this (confirmed) email was invited to. Returns how many. */
export async function acceptInvites() {
  return must(await supabase().rpc('accept_member_invites')) as number;
}

export type PendingInvite = { id: string; email: string; role: MemberRole; created_at: string };

export async function pendingInvites(tenantId: string) {
  const since = new Date(Date.now() - 7 * 864e5).toISOString();
  return must(await supabase().from('member_invites').select('id,email,role,created_at').eq('tenant_id', tenantId).is('accepted_at', null).is('revoked_at', null).gte('created_at', since).order('created_at', { ascending: false })) as PendingInvite[];
}

export async function revokeInvite(id: string) {
  must(await supabase().from('member_invites').update({ revoked_at: new Date().toISOString() }).eq('id', id).select('id'));
}
export const viewStats = (tenantId: string, days: number) => api<{ available: boolean; views?: number; started?: number; depositClicks?: number }>('stats', { tenantId, days });

export type TeamMember = { user_id: string; email: string; role: MemberRole; created_at: string; last_sign_in_at: string | null };

export async function shopTeam(tenantId: string) {
  return must(await supabase().rpc('shop_team', { target: tenantId })) as TeamMember[];
}

export async function setMemberRole(tenantId: string, userId: string, role: MemberRole) {
  must(await supabase().from('members').update({ role }).eq('tenant_id', tenantId).eq('user_id', userId).select('user_id'));
}

export async function removeMember(tenantId: string, userId: string) {
  must(await supabase().from('members').delete().eq('tenant_id', tenantId).eq('user_id', userId).select('user_id'));
}

export type ShopStats = { leads: number; contacted: number; deposits: number; won: number; value: number; wonValue: number; popular: { label: string; count: number }[] };

export async function shopStats(tenantId: string, since: Date) {
  return must(await supabase().rpc('shop_stats', { target: tenantId, since: since.toISOString() })) as ShopStats;
}

export type LeadEvent = { lead_id: string; type: string; created_at: string; data: Record<string, unknown> };

export async function leadNotes(leadIds: string[]) {
  if (!leadIds.length) return [] as LeadEvent[];
  return must(await supabase().from('lead_events').select('lead_id,type,created_at,data').in('lead_id', leadIds).in('type', ['note', 'status']).order('created_at')) as LeadEvent[];
}

export async function addLeadNote(lead: { id: string }, tenantId: string, text: string) {
  const db = supabase();
  const { data: user } = await db.auth.getUser();
  must(await db.from('lead_events').insert({ lead_id: lead.id, tenant_id: tenantId, type: 'note', actor: user.user?.id, data: { text: text.slice(0, 1000) } }).select('lead_id'));
}

export type DnsRecord = { type: 'CNAME' | 'A' | 'TXT'; name: string; value: string; why: string };
export type DomainInfo = { domain: string; status: 'pending' | 'active'; records: DnsRecord[]; problem?: string };

export const getDomain = (tenantId: string) => api<{ domain: DomainInfo | null }>('domain', { tenantId }).then((result) => result.domain);
export const connectDomain = (tenantId: string, domain: string) => api<DomainInfo>('domain_add', { tenantId, domain });
export const checkDomain = (tenantId: string) => api<DomainInfo>('domain_check', { tenantId });
export const disconnectDomain = (tenantId: string) => api<{ removed: boolean }>('domain_remove', { tenantId });

export const deleteLeadData = (leadId: string) => api<{ deleted: boolean }>('lead_delete', { leadId });

/** Everything the shop has with us, as one JSON file: config history, leads with their history, team. */
export async function exportShopData(tenant: { id: string; slug: string; name: string }) {
  const db = supabase();
  const [configs, leads, events, team] = await Promise.all([
    db.from('tenant_configs').select('version,status,config,created_at,published_at').eq('tenant_id', tenant.id).order('version'),
    db.from('leads').select('id,created_at,status,name,contact,email,note,spec,price,total,deposit,config_version,source').eq('tenant_id', tenant.id).order('created_at'),
    db.from('lead_events').select('lead_id,type,created_at,data').eq('tenant_id', tenant.id).order('created_at'),
    db.rpc('shop_team', { target: tenant.id }),
  ]);
  for (const result of [configs, leads, events, team]) if (result.error) throw new Error(result.error.message);
  return { exportedAt: new Date().toISOString(), shop: { slug: tenant.slug, name: tenant.name }, configs: configs.data, leads: leads.data, leadEvents: events.data, team: team.data };
}

export const goLive = (tenantId: string) => api<{ status: string }>('go_live', { tenantId });
export const pauseShop = (tenantId: string) => api<{ status: string }>('pause', { tenantId });

export const startPlan = (tenantId: string) => api<{ url: string }>('billing_checkout', { tenantId });
export const billingPortal = (tenantId: string) => api<{ url: string }>('billing_portal', { tenantId });
export const connectStripe = (tenantId: string) => api<{ url: string }>('connect_onboard', { tenantId });
export type ConnectStatus = { connected: boolean; chargesEnabled: boolean; detailsSubmitted?: boolean; due?: number };
export const stripeStatus = (tenantId: string) => api<ConnectStatus>('connect_status', { tenantId });

/** The latest stored metal prices (public market data, written by the daily crons), or null. */
export async function latestMetalPrices(): Promise<Spot | null> {
  const rows = must(await supabase().from('metal_prices').select('gold,silver,platinum,source,fetched_at').order('fetched_at', { ascending: false }).limit(1)) as { gold: number; silver: number; platinum: number; source: string; fetched_at: string }[];
  const row = rows[0];
  return row ? { gold: Number(row.gold), silver: Number(row.silver), platinum: Number(row.platinum), source: row.source, asOf: row.fetched_at } : null;
}

// ---------- Promo codes ----------
// Read by the shop's team, managed by owners (row-level security). Use counts are the server's.

export type PromoCodeRow = { id: string; code: string; kind: 'percent' | 'amount'; value: number; min_order: number; expires_at: string | null; max_uses: number | null; uses: number; active: boolean; created_at: string };
export type NewPromoCode = Pick<PromoCodeRow, 'code' | 'kind' | 'value' | 'min_order' | 'expires_at' | 'max_uses'>;

const PROMO_COLUMNS = 'id,code,kind,value,min_order,expires_at,max_uses,uses,active,created_at';

export async function listPromoCodes(tenantId: string) {
  const rows = must(await supabase().from('promo_codes').select(PROMO_COLUMNS).eq('tenant_id', tenantId).order('created_at', { ascending: false })) as PromoCodeRow[];
  return rows.map((row) => ({ ...row, value: Number(row.value), min_order: Number(row.min_order) }));
}

export async function createPromoCode(tenantId: string, input: NewPromoCode) {
  const { error } = await supabase().from('promo_codes').insert({ tenant_id: tenantId, ...input });
  if (error?.code === '23505') throw new Error(`You already have a code called ${input.code}.`);
  if (error) throw new Error(error.message);
}

export async function updatePromoCode(id: string, patch: Partial<Pick<PromoCodeRow, 'active' | 'expires_at' | 'max_uses'>>) {
  must(await supabase().from('promo_codes').update(patch).eq('id', id).select('id'));
}

export async function deletePromoCode(id: string) {
  must(await supabase().from('promo_codes').delete().eq('id', id).select('id'));
}

// ---------- Claim links (MAG-89) ----------
// VVS Lab builds a shop ahead of time; the jeweler claims it at /claim/<token>.

export type ClaimLinkRow = { id: string; created_at: string; expires_at: string; revoked_at: string | null; claimed_at: string | null; claimed_email: string | null };

/** The shop's newest link and whether it has an owner (admins only, by row-level security). */
export async function claimInfo(tenantId: string) {
  const db = supabase();
  const [links, owners] = await Promise.all([
    db.from('claim_links').select('id,created_at,expires_at,revoked_at,claimed_at,claimed_email').eq('tenant_id', tenantId).order('created_at', { ascending: false }).limit(1),
    db.from('members').select('user_id', { count: 'exact', head: true }).eq('tenant_id', tenantId).eq('role', 'owner'),
  ]);
  if (links.error) throw new Error(links.error.message);
  return { link: (links.data?.[0] as ClaimLinkRow | undefined) ?? null, owned: (owners.count ?? 0) > 0 };
}

/** A new link (any open one is cancelled). The URL is shown once: only its hash is stored. */
export const createClaimLink = (tenantId: string) => api<{ id: string; url: string; expiresAt: string }>('claim_create', { tenantId });
export const revokeClaimLink = (tenantId: string, linkId: string) => api<{ ok: boolean }>('claim_revoke', { tenantId, linkId });
