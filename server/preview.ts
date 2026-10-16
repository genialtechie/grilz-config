import { parseTenantConfig } from '../src/lib/tenant/schema.js';
import { createDb, hasDb } from './db.js';
import { isValidSlug, publicTenant, type TenantEnv } from './tenants.js';
import type { ApiResult } from './tenantApi.js';

// GET /api/tenant/<slug>?preview=<version> with the signed-in user's access token:
// any saved version (usually the draft) for a Magpollo admin or a member of that
// shop, so changes can be checked before they go live. Never cached.

const NO_STORE = { 'Cache-Control': 'private, no-store' };

export async function handlePreview(slug: string, version: number, token: string | null, env: TenantEnv): Promise<ApiResult> {
  if (!isValidSlug(slug) || !Number.isInteger(version) || version < 1) return { status: 404, body: { error: 'not_found' }, headers: NO_STORE };
  if (!token) return { status: 401, body: { error: 'sign_in' }, headers: NO_STORE };
  if (!hasDb(env)) return { status: 503, body: { error: 'unavailable' }, headers: NO_STORE };
  const db = createDb(env);
  try {
    const user = await db.userFromToken(token);
    if (!user) return { status: 401, body: { error: 'sign_in' }, headers: NO_STORE };
    const [tenant] = await db.select<{ id: string; slug: string; kind: 'demo' | 'shop' | 'fixture'; status: string }>('tenants', { slug: `eq.${slug}`, select: 'id,slug,kind,status' });
    if (!tenant) return { status: 404, body: { error: 'not_found' }, headers: NO_STORE };
    const [admins, members] = await Promise.all([
      db.count('platform_admins', { user_id: `eq.${user.id}`, select: 'user_id' }).catch(() => 0),
      db.select<{ user_id: string }>('members', { tenant_id: `eq.${tenant.id}`, user_id: `eq.${user.id}`, select: 'user_id' }).then((rows) => rows.length).catch(() => 0),
    ]);
    // Same answer for "no access" and "no such shop", so drafts can't be probed.
    if (!admins && !members) return { status: 404, body: { error: 'not_found' }, headers: NO_STORE };
    const [row] = await db.select<{ version: number; config: unknown }>('tenant_configs', { tenant_id: `eq.${tenant.id}`, version: `eq.${version}`, select: 'version,config' });
    if (!row) return { status: 404, body: { error: 'not_found' }, headers: NO_STORE };
    const parsed = parseTenantConfig(row.config);
    if (!parsed.ok) return { status: 422, body: { error: 'invalid_config', issues: parsed.issues.slice(0, 10) }, headers: NO_STORE };
    const view = publicTenant({ id: tenant.id, slug: tenant.slug, name: parsed.config.brand.name, status: 'live', kind: tenant.kind, version: row.version, config: parsed.config });
    return { status: 200, body: { ...view, preview: true }, headers: NO_STORE };
  } catch (error) {
    console.error('preview failed', slug, error instanceof Error ? error.message : error);
    return { status: 503, body: { error: 'unavailable' }, headers: NO_STORE };
  }
}
