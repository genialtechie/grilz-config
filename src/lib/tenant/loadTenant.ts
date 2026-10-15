import { parseTenantConfig, type TenantConfig } from './schema';

export type LoadedTenant =
  | { state: 'ok'; slug: string; demo: boolean; status: 'live' | 'paused' | 'offboarded'; version: number; config: TenantConfig }
  | { state: 'not_found' }
  | { state: 'unavailable' };

/** Fetches a shop's published config from /api/tenant and validates it. */
export async function loadTenant(slug: string, signal?: AbortSignal): Promise<LoadedTenant> {
  try {
    const response = await fetch(`/api/tenant/${encodeURIComponent(slug)}`, { signal, headers: { accept: 'application/json' } });
    if (response.status === 404) return { state: 'not_found' };
    if (!response.ok) return { state: 'unavailable' };
    const body = (await response.json()) as { slug: string; kind: string; status: 'live' | 'paused' | 'offboarded'; version: number; config: unknown };
    const parsed = parseTenantConfig(body.config);
    if (!parsed.ok) return { state: 'not_found' };
    return { state: 'ok', slug: body.slug, demo: body.kind === 'demo', status: body.status, version: body.version, config: parsed.config };
  } catch {
    return { state: 'unavailable' };
  }
}
