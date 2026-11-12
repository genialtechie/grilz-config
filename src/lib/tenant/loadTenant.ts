import { parseTenantConfig, type TenantConfig } from './schema';

export type LoadedTenant =
  | { state: 'ok'; slug: string; demo: boolean; status: 'live' | 'paused' | 'offboarded'; version: number; config: TenantConfig; preview: boolean; promos: boolean }
  | { state: 'not_found' }
  | { state: 'unavailable' }
  | { state: 'sign_in' };

declare global {
  interface Window {
    /** The shop's config request, started by the page before the app's code arrived (vite.config.ts). */
    __vvsTenant?: { slug: string; response: Promise<Response> } | null;
  }
}

/** The request the page started early for this shop, if any. It can be used once. */
function earlyResponse(slug: string, preview: boolean): Promise<Response | null> | null {
  if (typeof window === 'undefined') return null;
  const early = window.__vvsTenant;
  window.__vvsTenant = null;
  if (!early || preview || early.slug !== slug) return null;
  return early.response.catch(() => null);
}

type TenantBody = { slug: string; kind: string; status: 'live' | 'paused' | 'offboarded'; version: number; config: unknown; promos?: boolean };

function fromBody(body: TenantBody, preview: boolean): LoadedTenant {
  const parsed = parseTenantConfig(body.config);
  if (!parsed.ok) return { state: 'not_found' };
  return { state: 'ok', slug: body.slug, demo: body.kind === 'demo', status: body.status, version: body.version, config: parsed.config, preview, promos: body.promos === true };
}

/**
 * The shop's config as the server wrote it into the page (server/shopPage.ts),
 * so the builder can start at once. The page is cached for a few minutes, so
 * callers still run loadTenant() and take its answer if it differs.
 */
export function inlineTenant(slug: string): LoadedTenant | null {
  if (typeof document === 'undefined') return null;
  try {
    const text = document.getElementById('vvs-tenant')?.textContent;
    if (!text) return null;
    const body = JSON.parse(text) as TenantBody;
    if (body.slug !== slug) return null;
    const loaded = fromBody(body, false);
    return loaded.state === 'ok' ? loaded : null;
  } catch {
    return null;
  }
}

/** Fetches a shop's published config from /api/tenant and validates it. */
export async function loadTenant(slug: string, signal?: AbortSignal, preview?: { version: number; token: string | null }): Promise<LoadedTenant> {
  try {
    const query = preview ? `?preview=${preview.version}` : '';
    const headers: Record<string, string> = { accept: 'application/json' };
    if (preview?.token) headers.authorization = `Bearer ${preview.token}`;
    const response = (await earlyResponse(slug, Boolean(preview))) ?? (await fetch(`/api/tenant/${encodeURIComponent(slug)}${query}`, { signal, headers }));
    if (response.status === 404) return { state: 'not_found' };
    if (response.status === 401) return { state: 'sign_in' };
    if (!response.ok) return { state: 'unavailable' };
    return fromBody((await response.json()) as TenantBody, Boolean(preview));
  } catch {
    return { state: 'unavailable' };
  }
}
