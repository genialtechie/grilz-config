import { dangerouslyDeleteByTag } from '@vercel/functions';
import { withMarketQuote } from '../src/lib/metalMarket.js';
import { parseTenantConfig, type TenantConfig } from '../src/lib/tenant/schema.js';
import { VVSLAB_CONFIG } from '../src/lib/tenant/vvslab.js';
import { trialExpired } from '../src/lib/trial.js';
import { latestSpot } from './metalPrices.js';

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
const CACHE_MS = 20_000;
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
  plan: string | null;
  trial_ends_at: string | null;
  billing_status: string | null;
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
      select: 'id,slug,name,status,kind,published_version,plan,trial_ends_at,billing_status,tenant_configs!tenant_configs_tenant_id_fkey!inner(version,config)',
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
            // The trial gate takes effect the moment it ends, not at the nightly cron.
            status: row.status === 'live' && trialExpired(row) ? 'paused' : (row.status as TenantStatus),
            kind: row.kind as PublishedTenant['kind'],
            version: published.version,
            // A shop on market pricing gets today's per-tooth quote (or its fixed prices without one).
            config: parsed.config.pricing.market ? { ...parsed.config, pricing: withMarketQuote(parsed.config.pricing, await latestSpot(env)) } : parsed.config,
          },
        };
      }
    }
  } catch (error) {
    console.error('tenant lookup error', slug, error instanceof Error ? error.message : error);
    return { ok: false, reason: 'unavailable' };
  }
  // Only live shops are kept in memory. Instances don't share memory, so a paused
  // shop that pays (or is switched back on) must show up on the next request.
  if (value.ok && value.tenant.status === 'live') cache.set(slug, { at: Date.now(), value });
  else cache.delete(slug);
  return value;
}

/** The CDN cache tag on a shop's /api/tenant response. */
export const tenantCacheTag = (slug: string) => `tenant:${slug}`;

/** Drops a shop's cached config here and at the edge, after its status or billing changed. */
export async function forgetTenant(slug: string) {
  cache.delete(slug);
  try {
    await dangerouslyDeleteByTag(tenantCacheTag(slug));
  } catch (error) {
    console.error('tenant cache purge failed', slug, error instanceof Error ? error.message : error);
  }
}

/** The public view of a tenant: never includes lead routes or internal ids. */
export const publicTenant = (tenant: PublishedTenant) => ({
  slug: tenant.slug,
  kind: tenant.kind,
  status: tenant.status,
  version: tenant.version,
  config: { ...tenant.config, leads: { email: [], sms: [] } },
});

const idCache = new Map<string, string>();

/** The database id for a tenant. Tenant zero is bundled without one, so it is looked up by slug. */
export async function tenantIdFor(tenant: PublishedTenant, env: TenantEnv): Promise<string | null> {
  if (tenant.id) return tenant.id;
  const cached = idCache.get(tenant.slug);
  if (cached) return cached;
  const url = env.SUPABASE_URL;
  const key = env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return null;
  try {
    const response = await fetch(`${url.replace(/\/$/, '')}/rest/v1/tenants?${new URLSearchParams({ slug: `eq.${tenant.slug}`, select: 'id' })}`, {
      headers: { apikey: key, Authorization: `Bearer ${key}` },
    });
    if (!response.ok) return null;
    const [row] = (await response.json()) as { id: string }[];
    if (row) idCache.set(tenant.slug, row.id);
    return row?.id ?? null;
  } catch {
    return null;
  }
}

/** How long the previous price list stays valid for sessions that started before a change. */
const GRACE_MS = 6 * 60 * 60 * 1000;

/**
 * The config a customer's session was priced with. A customer who started before
 * a new price list went live keeps the previous one for a few hours; any other
 * version (older lists, drafts) prices with the current config.
 */
export async function configForSession(tenant: PublishedTenant, version: unknown, env: TenantEnv): Promise<{ version: number; config: TenantConfig }> {
  const current = { version: tenant.version, config: tenant.config };
  if (typeof version !== 'number' || !Number.isInteger(version) || version === tenant.version || !tenant.id) return current;
  const url = env.SUPABASE_URL;
  const key = env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return current;
  try {
    const query = new URLSearchParams({
      tenant_id: `eq.${tenant.id}`,
      status: 'in.(published,archived)',
      published_at: 'not.is.null',
      select: 'version,config,published_at',
      order: 'published_at.desc',
      limit: '2',
    });
    const response = await fetch(`${url.replace(/\/$/, '')}/rest/v1/tenant_configs?${query}`, { headers: { apikey: key, Authorization: `Bearer ${key}` } });
    if (!response.ok) return current;
    const [latest, previous] = (await response.json()) as { version: number; config: unknown; published_at: string }[];
    if (!latest || !previous || previous.version !== version || Date.now() - Date.parse(latest.published_at) > GRACE_MS) return current;
    const parsed = parseTenantConfig(previous.config);
    return parsed.ok ? { version: previous.version, config: parsed.config } : current;
  } catch {
    return current;
  }
}

const hostCache = new Map<string, { at: number; slug: string | null }>();

/** The shop slug behind an active custom domain, or null. Cached for 60s (10s when not found, so a newly verified domain goes live quickly). */
export async function slugForHost(host: string, env: TenantEnv): Promise<string | null> {
  const domain = host.toLowerCase().replace(/:\d+$/, '');
  if (!/^[a-z0-9.-]{4,253}$/.test(domain)) return null;
  const hit = hostCache.get(domain);
  if (hit && Date.now() - hit.at < (hit.slug ? 60_000 : 10_000)) return hit.slug;
  if (!env.SUPABASE_URL || !env.SUPABASE_SERVICE_ROLE_KEY) return null;
  try {
    const query = new URLSearchParams({ domain: `eq.${domain}`, status: 'eq.active', select: 'tenants(slug,status)' });
    const response = await fetch(`${env.SUPABASE_URL.replace(/\/$/, '')}/rest/v1/tenant_domains?${query}`, {
      headers: { apikey: env.SUPABASE_SERVICE_ROLE_KEY, Authorization: `Bearer ${env.SUPABASE_SERVICE_ROLE_KEY}` },
    });
    if (!response.ok) return null;
    const rows = (await response.json()) as { tenants: { slug: string; status: string } | null }[];
    const slug = rows[0]?.tenants?.slug ?? null;
    hostCache.set(domain, { at: Date.now(), slug });
    return slug;
  } catch {
    return null;
  }
}
