import { getPublishedTenant, publicTenant, type TenantEnv } from './tenants.js';

// GET /api/tenant/<slug> → the published config a shop page needs. Cached at
// the edge for 30s (plus the function's own 20s cache) so a dashboard publish
// shows up within a minute.

export type ApiResult = { status: number; body: unknown; headers: Record<string, string> };

const CACHE = 'public, s-maxage=30, stale-while-revalidate=10';
// Public data (lead addresses are stripped), read cross-origin by embed.js on shops' own sites.
const CORS = { 'Access-Control-Allow-Origin': '*' };

export async function handleTenant(slug: string, env: TenantEnv): Promise<ApiResult> {
  const lookup = await getPublishedTenant(slug.toLowerCase(), env);
  if (lookup.ok) return { status: 200, body: publicTenant(lookup.tenant), headers: { 'Cache-Control': CACHE, ...CORS } };
  if (lookup.reason === 'unavailable') {
    return { status: 503, body: { error: 'unavailable' }, headers: { 'Cache-Control': 'no-store' } };
  }
  return { status: 404, body: { error: 'not_found' }, headers: { 'Cache-Control': 'public, s-maxage=30', ...CORS } };
}
