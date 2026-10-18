import { parseTenantConfig } from '../src/lib/tenant/schema.js';
import { createDb, hasDb } from './db.js';
import type { TenantEnv } from './tenants.js';

// GET /api/health for uptime monitoring: the database answers and every live
// shop's published config is valid. Public, so it says nothing about volumes or
// customers; 503 when something is wrong.

export async function health(env: TenantEnv & { FLUX_API_KEY?: string; RESEND_API_KEY?: string; LEAD_TOKEN_SECRET?: string }) {
  const checks: Record<string, boolean> = {
    database: false,
    shopConfigs: false,
    aiPhotos: Boolean(env.FLUX_API_KEY),
    email: Boolean(env.RESEND_API_KEY),
    leadTokens: Boolean(env.LEAD_TOKEN_SECRET),
  };
  if (hasDb(env)) {
    try {
      const db = createDb(env);
      const live = await db.select<{ slug: string; tenant_configs: { config: unknown }[] }>('tenants', {
        status: 'eq.live',
        select: 'slug,tenant_configs!tenant_configs_tenant_id_fkey(config,status)',
        'tenant_configs.status': 'eq.published',
      });
      checks.database = true;
      checks.shopConfigs = live.every((tenant) => !tenant.tenant_configs[0] || parseTenantConfig(tenant.tenant_configs[0].config).ok);
    } catch {
      // database stays false
    }
  }
  const ok = Object.values(checks).every(Boolean);
  return { status: ok ? 200 : 503, body: { ok, checks, at: new Date().toISOString() } };
}
