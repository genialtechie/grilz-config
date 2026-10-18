import type { Db } from './db.js';

// Custom domains (build.theirshop.com). The server adds the domain to the Vercel
// project, which issues the TLS certificate once DNS points at Vercel; we then
// map the host to the shop. Env: VERCEL_DOMAINS_TOKEN, VERCEL_PROJECT_ID and
// (for team projects) VERCEL_TEAM_ID.

export type DomainEnv = { VERCEL_DOMAINS_TOKEN?: string; VERCEL_PROJECT_ID?: string; VERCEL_TEAM_ID?: string };

export type DnsRecord = { type: 'CNAME' | 'A' | 'TXT'; name: string; value: string; why: string };
export type DomainState = { domain: string; status: 'pending' | 'active'; records: DnsRecord[]; problem?: string };
type DomainRow = { id: string; tenant_id: string; domain: string; status: 'pending' | 'active'; verification: { type: string; domain: string; value: string }[] };

const HOST = /^([a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z]{2,63}$/;
/** Our own and shared hosting domains can't be claimed by a shop. */
const BLOCKED = ['magpollo.com', 'vercel.app', 'vercel.com', 'vercel.sh', 'now.sh', 'supabase.co', 'supabase.com', 'localhost', 'github.io', 'netlify.app', 'pages.dev', 'workers.dev'];

export const hasDomains = (env: DomainEnv) => Boolean(env.VERCEL_DOMAINS_TOKEN && env.VERCEL_PROJECT_ID);

/** Normalises what an owner types ("https://Build.Shop.com/") to a hostname, or explains why it can't be used. */
export function normaliseDomain(input: string): { ok: true; domain: string } | { ok: false; message: string } {
  const domain = input.trim().toLowerCase().replace(/^https?:\/\//, '').replace(/\/.*$/, '').replace(/\.$/, '');
  if (!HOST.test(domain) || domain.length > 253) return { ok: false, message: 'Enter a domain like build.yourshop.com.' };
  if (BLOCKED.some((blocked) => domain === blocked || domain.endsWith(`.${blocked}`))) return { ok: false, message: 'That domain can’t be used. Use one your shop owns.' };
  if (domain.startsWith('www.')) return { ok: false, message: 'Use a subdomain such as build.yourshop.com, so your main website keeps working.' };
  return { ok: true, domain };
}

/** A subdomain points a CNAME at Vercel; an apex domain uses an A record. */
export function dnsRecords(domain: string, verification: DomainRow['verification'] = []): DnsRecord[] {
  const parts = domain.split('.');
  const apex = parts.length === 2;
  const records: DnsRecord[] = apex
    ? [{ type: 'A', name: '@', value: '76.76.21.21', why: 'Points your domain at VVS Lab' }]
    : [{ type: 'CNAME', name: parts.slice(0, -2).join('.'), value: 'cname.vercel-dns.com', why: 'Points this address at VVS Lab' }];
  for (const item of verification) {
    if (item.type === 'TXT') records.push({ type: 'TXT', name: item.domain.replace(`.${parts.slice(-2).join('.')}`, ''), value: item.value, why: 'Proves you own the domain' });
  }
  return records;
}

async function vercel<T>(env: DomainEnv, method: string, path: string, body?: unknown): Promise<{ ok: boolean; status: number; data: T & { error?: { code?: string; message?: string } } }> {
  const url = new URL(`https://api.vercel.com${path}`);
  if (env.VERCEL_TEAM_ID) url.searchParams.set('teamId', env.VERCEL_TEAM_ID);
  const response = await fetch(url, {
    method,
    headers: { Authorization: `Bearer ${env.VERCEL_DOMAINS_TOKEN}`, 'Content-Type': 'application/json' },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const data = (await response.json().catch(() => ({}))) as T & { error?: { code?: string; message?: string } };
  return { ok: response.ok, status: response.status, data };
}

type ProjectDomain = { name: string; verified: boolean; verification?: DomainRow['verification'] };

const project = (env: DomainEnv) => encodeURIComponent(env.VERCEL_PROJECT_ID ?? '');

export async function domainState(db: Db, tenantId: string): Promise<DomainState | null> {
  const [row] = await db.select<DomainRow>('tenant_domains', { tenant_id: `eq.${tenantId}`, select: 'id,tenant_id,domain,status,verification' });
  return row ? { domain: row.domain, status: row.status, records: dnsRecords(row.domain, row.verification) } : null;
}

export async function addDomain(db: Db, env: DomainEnv, tenantId: string, userId: string, input: string): Promise<{ status: number; body: unknown }> {
  if (!hasDomains(env)) return { status: 503, body: { error: 'not_configured', message: 'Custom domains aren’t switched on yet. Message VVS Lab.' } };
  const parsed = normaliseDomain(input);
  if (!parsed.ok) return { status: 400, body: { error: 'invalid', message: parsed.message } };
  const existing = await db.select<DomainRow>('tenant_domains', { tenant_id: `eq.${tenantId}`, select: 'id,domain' });
  if (existing.length) return { status: 409, body: { error: 'has_domain', message: `Remove ${existing[0].domain} first. A shop has one custom domain.` } };
  // A claim that never got its DNS set up lapses after 48 hours, so nobody can
  // block a domain they don't control by claiming it first.
  const [taken] = await db.select<{ id: string; status: string; created_at: string }>('tenant_domains', { domain: `eq.${parsed.domain}`, select: 'id,status,created_at' });
  if (taken) {
    const stale = taken.status === 'pending' && Date.now() - new Date(taken.created_at).getTime() > 48 * 3600_000;
    if (!stale) return { status: 409, body: { error: 'taken', message: 'That domain is already connected to another shop.' } };
    await db.remove('tenant_domains', { id: `eq.${taken.id}` });
  }

  const added = await vercel<ProjectDomain>(env, 'POST', `/v10/projects/${project(env)}/domains`, { name: parsed.domain });
  if (!added.ok && added.data.error?.code !== 'domain_already_in_use_by_project') {
    const code = added.data.error?.code ?? '';
    const message = /in_use|already/.test(code) ? 'That domain is used by another website on Vercel. Remove it there first, or use a different subdomain.' : 'Couldn’t add the domain. Check it and try again.';
    console.error('vercel add domain', added.status, code);
    return { status: 409, body: { error: 'vercel', message } };
  }
  const verification = added.data.verification ?? [];
  await db.insert('tenant_domains', { tenant_id: tenantId, domain: parsed.domain, status: 'pending', verification, created_by: userId });
  return { status: 200, body: { domain: parsed.domain, status: 'pending', records: dnsRecords(parsed.domain, verification) } };
}

/** Asks Vercel whether the domain is verified and DNS points at it; marks it active when both are true. */
export async function checkDomain(db: Db, env: DomainEnv, tenantId: string): Promise<{ status: number; body: unknown }> {
  if (!hasDomains(env)) return { status: 503, body: { error: 'not_configured', message: 'Custom domains aren’t switched on yet.' } };
  const [row] = await db.select<DomainRow>('tenant_domains', { tenant_id: `eq.${tenantId}`, select: 'id,tenant_id,domain,status,verification' });
  if (!row) return { status: 404, body: { error: 'not_found' } };
  let info = await vercel<ProjectDomain>(env, 'GET', `/v9/projects/${project(env)}/domains/${encodeURIComponent(row.domain)}`);
  if (info.ok && !info.data.verified) info = await vercel<ProjectDomain>(env, 'POST', `/v9/projects/${project(env)}/domains/${encodeURIComponent(row.domain)}/verify`);
  const config = await vercel<{ misconfigured?: boolean }>(env, 'GET', `/v6/domains/${encodeURIComponent(row.domain)}/config`);
  const verified = Boolean(info.ok && info.data.verified);
  const pointed = Boolean(config.ok && config.data.misconfigured === false);
  const verification = info.data.verification ?? row.verification;
  const status = verified && pointed ? 'active' : 'pending';
  const now = new Date().toISOString();
  await db.update('tenant_domains', { id: `eq.${row.id}` }, { status, verification, checked_at: now, ...(status === 'active' && row.status !== 'active' ? { verified_at: now } : {}) });
  const problem = status === 'active' ? undefined : !pointed ? 'DNS isn’t pointing at VVS Lab yet. Changes can take up to an hour.' : 'Waiting for Vercel to confirm you own the domain (the TXT record).';
  return { status: 200, body: { domain: row.domain, status, records: dnsRecords(row.domain, verification), problem } };
}

export async function removeDomain(db: Db, env: DomainEnv, tenantId: string): Promise<{ status: number; body: unknown }> {
  const [row] = await db.select<DomainRow>('tenant_domains', { tenant_id: `eq.${tenantId}`, select: 'id,domain' });
  if (!row) return { status: 200, body: { removed: false } };
  if (hasDomains(env)) {
    const removed = await vercel(env, 'DELETE', `/v9/projects/${project(env)}/domains/${encodeURIComponent(row.domain)}`);
    if (!removed.ok && removed.status !== 404) return { status: 502, body: { error: 'vercel', message: 'Couldn’t remove the domain. Try again.' } };
  }
  await db.remove('tenant_domains', { id: `eq.${row.id}` });
  return { status: 200, body: { removed: true } };
}
