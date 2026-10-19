import { parseTenantConfig, type TenantConfig } from './schema';

export type LoadedTenant =
  | { state: 'ok'; slug: string; demo: boolean; status: 'live' | 'paused' | 'offboarded'; version: number; config: TenantConfig; preview: boolean; promos: boolean }
  | { state: 'not_found' }
  | { state: 'unavailable' }
  | { state: 'sign_in' };

/** Fetches a shop's published config from /api/tenant and validates it. */
export async function loadTenant(slug: string, signal?: AbortSignal, preview?: { version: number; token: string | null }): Promise<LoadedTenant> {
  try {
    const query = preview ? `?preview=${preview.version}` : '';
    const headers: Record<string, string> = { accept: 'application/json' };
    if (preview?.token) headers.authorization = `Bearer ${preview.token}`;
    const response = await fetch(`/api/tenant/${encodeURIComponent(slug)}${query}`, { signal, headers });
    if (response.status === 404) return { state: 'not_found' };
    if (response.status === 401) return { state: 'sign_in' };
    if (!response.ok) return { state: 'unavailable' };
    const body = (await response.json()) as { slug: string; kind: string; status: 'live' | 'paused' | 'offboarded'; version: number; config: unknown; promos?: boolean };
    const parsed = parseTenantConfig(body.config);
    if (!parsed.ok) return { state: 'not_found' };
    return { state: 'ok', slug: body.slug, demo: body.kind === 'demo', status: body.status, version: body.version, config: parsed.config, preview: Boolean(preview), promos: body.promos === true };
  } catch {
    return { state: 'unavailable' };
  }
}
