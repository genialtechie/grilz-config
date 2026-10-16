import { readFileSync } from 'node:fs';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { shopHead } from '../shopPage';
import { handleTenant } from '../tenantApi';
import { TENANT_ZERO, getPublishedTenant, isValidSlug, publicTenant, type PublishedTenant } from '../tenants';
import { VVSLAB_CONFIG } from '../../src/lib/tenant/vvslab';
import { contrast, usableAccent } from '../../src/lib/tenant/theme';

const env = { SUPABASE_URL: 'https://db.test', SUPABASE_SERVICE_ROLE_KEY: 'service' };

const shopConfig = () => {
  const config = structuredClone(VVSLAB_CONFIG);
  config.brand = { name: 'Ice "Box" & Co', accent: '#1E5AA8', fontPair: 'serif-classic', poweredBy: true, logo: '/shops/icebox.png' };
  config.leads = { email: ['owner@icebox.test'], sms: ['+15555550100'] };
  return config;
};

const row = (slug: string, config: unknown, extra: Record<string, unknown> = {}) => ({
  id: `id-${slug}`, slug, name: slug, status: 'live', kind: 'shop', published_version: 2,
  tenant_configs: [{ version: 2, config }], ...extra,
});

const mockFetch = (impl: () => Promise<Response>) => vi.stubGlobal('fetch', vi.fn(impl));
afterEach(() => vi.unstubAllGlobals());

describe('tenant lookup', () => {
  it('serves tenant zero without touching the database', async () => {
    const fetch = vi.fn();
    vi.stubGlobal('fetch', fetch);
    expect(await getPublishedTenant('vvslab', {})).toEqual({ ok: true, tenant: TENANT_ZERO });
    expect(fetch).not.toHaveBeenCalled();
  });

  it('rejects malformed slugs before querying', async () => {
    for (const slug of ['', '-x', 'x-', 'UPPER', 'a/b', 'a'.repeat(41), "x';drop"]) expect(isValidSlug(slug)).toBe(false);
    expect((await getPublishedTenant('../etc', env))).toEqual({ ok: false, reason: 'invalid_slug' });
  });

  it('is unavailable without database credentials', async () => {
    expect(await getPublishedTenant('no-creds-shop', {})).toEqual({ ok: false, reason: 'unavailable' });
  });

  it('loads and validates a published config', async () => {
    mockFetch(async () => Response.json([row('lookup-ok', shopConfig())]));
    const lookup = await getPublishedTenant('lookup-ok', env);
    expect(lookup.ok && lookup.tenant.config.brand.name).toBe('Ice "Box" & Co');
    expect(lookup.ok && lookup.tenant.version).toBe(2);
  });

  it('treats an invalid stored config as not found', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
    mockFetch(async () => Response.json([row('lookup-bad', { brand: {} })]));
    expect(await getPublishedTenant('lookup-bad', env)).toEqual({ ok: false, reason: 'not_found' });
  });

  it('ignores configs other than the published version', async () => {
    mockFetch(async () => Response.json([row('lookup-draft', shopConfig(), { published_version: 3 })]));
    expect(await getPublishedTenant('lookup-draft', env)).toEqual({ ok: false, reason: 'not_found' });
  });

  it('reports database errors as unavailable and does not cache them', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
    mockFetch(async () => new Response('down', { status: 500 }));
    expect(await getPublishedTenant('lookup-flaky', env)).toEqual({ ok: false, reason: 'unavailable' });
    mockFetch(async () => Response.json([row('lookup-flaky', shopConfig())]));
    expect((await getPublishedTenant('lookup-flaky', env)).ok).toBe(true);
  });
});

describe('GET /api/tenant/:slug', () => {
  it('returns the public config with lead routes removed', async () => {
    mockFetch(async () => Response.json([row('api-ok', shopConfig())]));
    const result = await handleTenant('API-OK', env);
    expect(result.status).toBe(200);
    expect(result.headers['Cache-Control']).toContain('s-maxage=60');
    const body = JSON.stringify(result.body);
    expect(body).not.toContain('owner@icebox.test');
    expect(body).not.toContain('+15555550100');
    expect(body).not.toContain('id-api-ok');
  });

  it('maps lookups to 404 and 503', async () => {
    mockFetch(async () => Response.json([]));
    expect((await handleTenant('api-missing', env)).status).toBe(404);
    expect((await handleTenant('api-down', {})).status).toBe(503);
    expect((await handleTenant('api-down', {})).headers['Cache-Control']).toBe('no-store');
  });

  it('publicTenant never exposes internal ids', () => {
    const view = publicTenant({ ...TENANT_ZERO, id: 'secret-id' });
    expect(JSON.stringify(view)).not.toContain('secret-id');
  });
});

describe('shop link previews', () => {
  const html = readFileSync(new URL('../../index.html', import.meta.url), 'utf8');
  const tenant: PublishedTenant = { ...TENANT_ZERO, id: 'x', slug: 'icebox', kind: 'shop', config: shopConfig() };
  const out = shopHead(html, tenant, 'https://vvslab.magpollo.com');

  it('uses the shop name, url and logo', () => {
    expect(out).toContain('<title>Design your custom grillz · Ice &quot;Box&quot; &amp; Co</title>');
    expect(out).toContain('<meta property="og:url" content="https://vvslab.magpollo.com/b/icebox" />');
    expect(out).toContain('<meta property="og:image" content="https://vvslab.magpollo.com/shops/icebox.png" />');
    expect(out).toContain('<link rel="canonical" href="https://vvslab.magpollo.com/b/icebox" />');
    expect(out).not.toMatch(/og:image:(width|height)/);
    expect(out).toContain('<link rel="preload" as="image" href="https://vvslab.magpollo.com/shops/icebox.png" fetchpriority="high" />');
  });

  it('replaces tags rather than duplicating them', () => {
    for (const tag of ['<title>', 'property="og:title"', 'property="og:image"', 'name="description"', 'name="twitter:title"']) {
      expect(out.split(tag).length - 1, tag).toBe(1);
    }
    expect(out).not.toContain('VVS Lab');
  });

  it('escapes brand text so it cannot break out of the tag', () => {
    const evil = { ...tenant, config: { ...tenant.config, brand: { ...tenant.config.brand, name: '"><script>x</script>' } } };
    expect(shopHead(html, evil, 'https://o.test')).not.toContain('<script>x');
  });
});

describe('brand accent', () => {
  it('darkens pale accents until they read on the page', () => {
    for (const accent of ['#FFE066', '#F5F5F5', '#00FFAA', '#1E5AA8', '#CE4257']) {
      expect(contrast(usableAccent(accent), '#faf8f5')).toBeGreaterThanOrEqual(3);
    }
    expect(usableAccent('#1E5AA8').toLowerCase()).toBe('#1e5aa8');
  });
});
