import { parseTenantConfig, type TenantConfig } from '../src/lib/tenant/schema.js';
import { VVSLAB_CONFIG } from '../src/lib/tenant/vvslab.js';

// Loads a tenant's published config from Supabase (PostgREST, service role).
// Shared by /api/tenant, /api/render and the link-preview page. Tenant zero
// (vvslab) is bundled with the app so the public demo never depends on the
// database being reachable.

export type TenantEnv = { SUPABASE_URL?: string; SUPABASE_SERVICE_ROLE_KEY?: string };

export type TenantStatus = 'live' | 'paused' | 'offboarded';

export type PublishedTenant = {
  id: string | null;
  slug: string;
  name: string;
  status: TenantStatus;
  kind: 'demo' | 'shop' | 'fixture';
  version: number;
  config: TenantConfig;
};

export type TenantLookup =
  | { ok: true; tenant: PublishedTenant }
  | { ok: false; reason: 'invalid_slug' | 'not_found' | 'unavailable' };

const SLUG = /^[a-z0-9](?:[a-z0-9-]{0,38}[a-z0-9])?$/;
const CACHE_MS = 30_000;
const cache = new Map<string, { at: number; value: TenantLookup }>();

export const TENANT_ZERO: PublishedTenant = {
  id: null,
  slug: 'vvslab',
  name: 'VVS Lab',
  status: 'live',
  kind: 'demo',
  version: 0,
  config: VVSLAB_CONFIG,
};

export const isValidSlug = (slug: string) => SLUG.test(slug);

type Row = {
  id: string;
  slug: string;
  name: string;
  status: string;
  kind: string;
  published_version: number | null;
  tenant_configs: { version: number; config: unknown }[];
};

export async function getPublishedTenant(slug: string, env: TenantEnv): Promise<TenantLookup> {
  if (slug === TENANT_ZERO.slug) return { ok: true, tenant: TENANT_ZERO };
  if (!isValidSlug(slug)) return { ok: false, reason: 'invalid_slug' };
  const hit = cache.get(slug);
  if (hit && Date.now() - hit.at < CACHE_MS) return hit.value;

  const url = env.SUPABASE_URL;
  const key = env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return { ok: false, reason: 'unavailable' };

  let value: TenantLookup;
  try {
    const query = new URLSearchParams({
      slug: `eq.${slug}`,
      status: 'in.(live,paused,offboarded)',
      select: 'id,slug,name,status,kind,published_version,tenant_configs!tenant_configs_tenant_id_fkey!inner(version,config)',
      'tenant_configs.status': 'eq.published',
    });
    const response = await fetch(`${url.replace(/\/$/, '')}/rest/v1/tenants?${query}`, {
      headers: { apikey: key, Authorization: `Bearer ${key}`, Accept: 'application/json' },
    });
    if (!response.ok) {
      console.error('tenant lookup failed', slug, response.status);
      return { ok: false, reason: 'unavailable' };
    }
    const rows = (await response.json()) as Row[];
    const row = rows[0];
    const published = row?.tenant_configs.find((config) => config.version === row.published_version);
    if (!row || !published) {
      value = { ok: false, reason: 'not_found' };
    } else {
      const parsed = parseTenantConfig(published.config);
      if (!parsed.ok) {
        console.error('tenant config invalid', slug, parsed.issues.slice(0, 3));
        value = { ok: false, reason: 'not_found' };
      } else {
        value = {
          ok: true,
          tenant: {
            id: row.id,
            slug: row.slug,
            name: row.name,
            status: row.status as TenantStatus,
            kind: row.kind as PublishedTenant['kind'],
            version: published.version,
            config: parsed.config,
          },
        };
      }
    }
  } catch (error) {
    console.error('tenant lookup error', slug, error instanceof Error ? error.message : error);
    return { ok: false, reason: 'unavailable' };
  }
  cache.set(slug, { at: Date.now(), value });
  return value;
}

/** The public view of a tenant: never includes lead routes or internal ids. */
export const publicTenant = (tenant: PublishedTenant) => ({
  slug: tenant.slug,
  kind: tenant.kind,
  status: tenant.status,
  version: tenant.version,
  config: { ...tenant.config, leads: { email: [], sms: [] } },
});
