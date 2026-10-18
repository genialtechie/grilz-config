import { afterEach, describe, expect, it, vi } from 'vitest';
import { dnsRecords, normaliseDomain } from '../domains';
import { customDomainHead } from '../shopPage';
import { slugForHost, TENANT_ZERO } from '../tenants';
import { handleDashboard } from '../dashboard';
import { GET as shopPage } from '../../api/shop-page';

afterEach(() => {
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
});

describe('custom domains', () => {
  it('normalises what owners type and refuses domains that are not theirs to claim', () => {
    expect(normaliseDomain(' https://Build.GoldMouth.com/ ')).toEqual({ ok: true, domain: 'build.goldmouth.com' });
    expect(normaliseDomain('goldmouth.com')).toEqual({ ok: true, domain: 'goldmouth.com' });
    for (const bad of ['vvslab.magpollo.com', 'evil.vercel.app', 'shop.supabase.co', 'www.goldmouth.com', 'not a domain', 'localhost', 'a.b']) {
      expect(normaliseDomain(bad).ok, bad).toBe(false);
    }
  });

  it('gives a CNAME for subdomains, an A record for apex domains, plus any ownership TXT', () => {
    expect(dnsRecords('build.goldmouth.com')).toEqual([{ type: 'CNAME', name: 'build', value: 'cname.vercel-dns.com', why: expect.any(String) }]);
    expect(dnsRecords('goldmouth.com')[0]).toMatchObject({ type: 'A', name: '@', value: '76.76.21.21' });
    const records = dnsRecords('build.goldmouth.com', [{ type: 'TXT', domain: '_vercel.goldmouth.com', value: 'vc-domain-verify=abc' }]);
    expect(records[1]).toMatchObject({ type: 'TXT', name: '_vercel', value: 'vc-domain-verify=abc' });
  });

  it('marks the page with the shop and uses the domain as the canonical URL', () => {
    const html = '<html><head><title>VVS Lab</title><link rel="canonical" href="https://vvslab.magpollo.com/" /></head><body></body></html>';
    const out = customDomainHead(html, { ...TENANT_ZERO, slug: 'gold-mouth' }, 'https://build.goldmouth.com');
    expect(out).toContain('<meta name="vvs-shop" content="gold-mouth" />');
    expect(out).toContain('<link rel="canonical" href="https://build.goldmouth.com/" />');
  });

  it('looks up the shop for an active domain only', async () => {
    const fetch = vi.fn(async (input: string | URL | Request) => {
      const url = String(input);
      expect(url).toContain('status=eq.active');
      return Response.json(url.includes('build.goldmouth.com') ? [{ tenants: { slug: 'gold-mouth', status: 'live' } }] : []);
    });
    vi.stubGlobal('fetch', fetch);
    const env = { SUPABASE_URL: 'https://db.test', SUPABASE_SERVICE_ROLE_KEY: 'k' };
    expect(await slugForHost('Build.GoldMouth.com:443', env)).toBe('gold-mouth');
    expect(await slugForHost('nobody.example.com', env)).toBeNull();
  });

  it('serves the shop at "/" on its domain, and the plain app on unknown hosts', async () => {
    vi.stubEnv('SUPABASE_URL', 'https://db.test');
    vi.stubEnv('SUPABASE_SERVICE_ROLE_KEY', 'k');
    vi.stubGlobal('fetch', vi.fn(async (input: string | URL | Request) => {
      const url = String(input);
      if (url.endsWith('/index.html')) return new Response('<html><head><title>VVS Lab</title></head><body></body></html>');
      if (url.includes('tenant_domains')) return Response.json(url.includes('build.shop-a.com') ? [{ tenants: { slug: 'vvslab', status: 'live' } }] : []);
      return new Response('unexpected', { status: 500 });
    }));
    const hit = await shopPage(new Request('https://build.shop-a.com/api/shop-page?domain=1', { headers: { host: 'build.shop-a.com' } }));
    expect(await hit.text()).toContain('name="vvs-shop" content="vvslab"');
    const miss = await shopPage(new Request('https://preview-123.vercel.app/api/shop-page?domain=1'));
    expect(await miss.text()).not.toContain('vvs-shop');
  });
});

describe('domain actions', () => {
  const env = { SUPABASE_URL: 'https://db.test', SUPABASE_SERVICE_ROLE_KEY: 'service', VERCEL_DOMAINS_TOKEN: 't', VERCEL_PROJECT_ID: 'p' };
  const tenantId = '11111111-1111-1111-1111-111111111111';
  const stub = (role: 'owner' | 'staff' | null, vercel: (url: string, init?: RequestInit) => Response = () => new Response('no', { status: 500 })) => {
    const calls: string[] = [];
    vi.stubGlobal('fetch', vi.fn(async (input: string | URL | Request, init?: RequestInit) => {
      const url = String(input);
      calls.push(`${init?.method ?? 'GET'} ${url}`);
      if (url.endsWith('/auth/v1/user')) return Response.json({ id: 'u1' });
      if (url.includes('/rest/v1/platform_admins')) return new Response(null, { status: 200, headers: { 'content-range': '*/0' } });
      if (url.includes('/rest/v1/members')) return Response.json(role ? [{ role }] : []);
            if (url.includes('/rest/v1/tenant_domains') && (init?.method ?? 'GET') === 'GET') return Response.json([]);
      if (url.includes('/rest/v1/tenant_domains') && init?.method === 'POST') return Response.json([{}]);
      if (url.startsWith('https://api.vercel.com')) return vercel(url, init);
      return new Response('unexpected', { status: 500 });
    }));
    return calls;
  };

  it('staff can read but not connect a domain; outsiders get 404', async () => {
    stub('staff');
    expect((await handleDashboard('domain_add', { tenantId, domain: 'build.shop.com' }, 'tok', env)).status).toBe(403);
    stub(null);
    expect((await handleDashboard('domain', { tenantId }, 'tok', env)).status).toBe(404);
  });

  it('an owner connects a domain: added to the Vercel project, saved as pending, DNS returned', async () => {
    const calls = stub('owner', () => Response.json({ name: 'build.shop.com', verified: true, verification: [] }));
    const result = await handleDashboard('domain_add', { tenantId, domain: 'Build.Shop.com' }, 'tok', env);
    expect(result.status).toBe(200);
    expect(result.body).toMatchObject({ domain: 'build.shop.com', status: 'pending', records: [{ type: 'CNAME', name: 'build' }] });
    expect(calls.some((call) => call.startsWith('POST https://api.vercel.com/v10/projects/p/domains'))).toBe(true);
  });

  it('says so when the domain belongs to another Vercel site', async () => {
    stub('owner', () => Response.json({ error: { code: 'domain_already_in_use' } }, { status: 409 }));
    const result = await handleDashboard('domain_add', { tenantId, domain: 'build.shop.com' }, 'tok', env);
    expect(result.status).toBe(409);
  });
});
