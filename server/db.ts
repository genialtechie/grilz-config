import type { TenantEnv } from './tenants.js';

// Minimal server-side Supabase client (PostgREST + Storage) using the service
// role. Server code only: the service key bypasses row-level security, so every
// caller is responsible for scoping by tenant_id.

export class DbError extends Error {
  constructor(readonly status: number, message: string) {
    super(message);
  }
}

export type Db = ReturnType<typeof createDb>;

export const hasDb = (env: TenantEnv) => Boolean(env.SUPABASE_URL && env.SUPABASE_SERVICE_ROLE_KEY);

export function createDb(env: TenantEnv) {
  const base = (env.SUPABASE_URL ?? '').replace(/\/$/, '');
  const key = env.SUPABASE_SERVICE_ROLE_KEY ?? '';
  if (!base || !key) throw new DbError(503, 'database not configured');
  const headers = (extra: Record<string, string> = {}) => ({ apikey: key, Authorization: `Bearer ${key}`, ...extra });

  const request = async <T>(path: string, init: RequestInit & { headers?: Record<string, string> } = {}): Promise<T> => {
    const response = await fetch(`${base}${path}`, { ...init, headers: headers(init.headers) });
    const text = await response.text();
    if (!response.ok) throw new DbError(response.status, `${init.method ?? 'GET'} ${path.split('?')[0]} → ${response.status} ${text.slice(0, 200)}`);
    return (text ? JSON.parse(text) : null) as T;
  };

  return {
    /** GET /rest/v1/<table>?<query> */
    select: <T>(table: string, query: Record<string, string>) =>
      request<T[]>(`/rest/v1/${table}?${new URLSearchParams(query)}`, { headers: { Accept: 'application/json' } }),

    /** Rows matching the filter, counted without returning them. */
    count: async (table: string, query: Record<string, string>) => {
      const response = await fetch(`${base}/rest/v1/${table}?${new URLSearchParams({ select: '*', ...query })}`, {
        method: 'HEAD',
        headers: headers({ Prefer: 'count=exact', Range: '0-0' }),
      });
      if (!response.ok && response.status !== 206) throw new DbError(response.status, `count ${table} → ${response.status}`);
      return Number(response.headers.get('content-range')?.split('/')[1] ?? 0) || 0;
    },

    insert: <T>(table: string, row: Record<string, unknown>) =>
      request<T[]>(`/rest/v1/${table}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Prefer: 'return=representation' },
        body: JSON.stringify(row),
      }).then((rows) => rows[0]),

    /** PATCH rows matching the filter; returns the rows that changed (empty if none matched). */
    update: <T>(table: string, filter: Record<string, string>, patch: Record<string, unknown>) =>
      request<T[]>(`/rest/v1/${table}?${new URLSearchParams(filter)}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', Prefer: 'return=representation' },
        body: JSON.stringify(patch),
      }),

    /** DELETE rows matching the filter. */
    remove: (table: string, filter: Record<string, string>) =>
      request<unknown>(`/rest/v1/${table}?${new URLSearchParams(filter)}`, { method: 'DELETE', headers: { Prefer: 'return=minimal' } }),

    rpc: <T>(fn: string, args: Record<string, unknown> = {}) =>
      request<T>(`/rest/v1/rpc/${fn}`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(args) }),

    upload: (bucket: string, path: string, body: Uint8Array, contentType: string) =>
      request<unknown>(`/storage/v1/object/${bucket}/${path}`, {
        method: 'POST',
        headers: { 'Content-Type': contentType, 'x-upsert': 'true', 'Cache-Control': 'max-age=31536000' },
        body: Buffer.from(body),
      }),

    /** Deletes storage objects (missing ones are ignored). */
    removeObjects: (bucket: string, paths: string[]) =>
      paths.length
        ? request<unknown>(`/storage/v1/object/${bucket}`, { method: 'DELETE', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ prefixes: paths }) })
        : Promise.resolve(null),

    /** Object names directly under a folder (one page). */
    listObjects: (bucket: string, folder: string, limit = 1000) =>
      request<{ name: string; id: string | null }[]>(`/storage/v1/object/list/${bucket}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ prefix: folder, limit, offset: 0 }),
      }),

    download: async (bucket: string, path: string): Promise<Uint8Array> => {
      const response = await fetch(`${base}/storage/v1/object/${bucket}/${path}`, { headers: headers() });
      if (!response.ok) throw new DbError(response.status, `download ${bucket} → ${response.status}`);
      return new Uint8Array(await response.arrayBuffer());
    },

    signedUrl: async (bucket: string, path: string, seconds: number) => {
      const { signedURL } = await request<{ signedURL: string }>(`/storage/v1/object/sign/${bucket}/${path}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ expiresIn: seconds }),
      });
      return `${base}/storage/v1${signedURL}`;
    },

    /** POST to the Auth admin API (service role): user creation and sign-in links. */
    authAdmin: async <T>(path: string, body: Record<string, unknown>): Promise<{ ok: true; data: T } | { ok: false; status: number; message: string }> => {
      const response = await fetch(`${base}/auth/v1/admin/${path}`, { method: 'POST', headers: headers({ 'Content-Type': 'application/json' }), body: JSON.stringify(body) });
      const data = (await response.json().catch(() => ({}))) as T & { msg?: string; message?: string; error_description?: string };
      if (!response.ok) return { ok: false, status: response.status, message: data.msg ?? data.message ?? data.error_description ?? `auth admin ${response.status}` };
      return { ok: true, data };
    },

    /** Public Auth settings; disable_signup must be true for invite-only accounts. */
    authSettings: async (): Promise<{ disable_signup?: boolean } | null> => {
      const response = await fetch(`${base}/auth/v1/settings`, { headers: { apikey: key } });
      return response.ok ? ((await response.json()) as { disable_signup?: boolean }) : null;
    },

    /** The signed-in user behind a Supabase access token, or null. */
    userFromToken: async (token: string): Promise<{ id: string; email?: string } | null> => {
      const response = await fetch(`${base}/auth/v1/user`, { headers: { apikey: key, Authorization: `Bearer ${token}` } });
      if (!response.ok) return null;
      return (await response.json()) as { id: string; email?: string };
    },
  };
}
