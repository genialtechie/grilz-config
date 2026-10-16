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
  const rows = must(await db.from('platform_admins').select('user_id').eq('user_id', user.user.id));
  if (rows.length) return true;
  // An invited email that signed up before the invite existed.
  const { data } = await db.rpc('claim_admin_invite');
  return data === true;
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
      .select('id,created_at,name,contact,email,note,status,total,deposit,render_status,notified_at,preview_path,photo_path,spec,source')
      .eq('tenant_id', tenantId)
      .order('created_at', { ascending: false })
      .limit(50),
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
