import { afterEach, describe, expect, it, vi } from 'vitest';
import { inlineTenant, loadTenant } from '../tenant/loadTenant';
import { VVSLAB_CONFIG } from '../tenant/vvslab';

const body = (slug = 'icebox') => ({ slug, kind: 'shop', status: 'live', version: 3, promos: true, config: VVSLAB_CONFIG });
const page = (text: string | null) => vi.stubGlobal('document', { getElementById: (id: string) => (id === 'vvs-tenant' && text !== null ? { textContent: text } : null) });

afterEach(() => vi.unstubAllGlobals());

describe('the shop config a page arrives with', () => {
  it('is used when it is for this shop', () => {
    page(JSON.stringify(body()));
    expect(inlineTenant('icebox')).toMatchObject({ state: 'ok', slug: 'icebox', demo: false, version: 3, preview: false, promos: true });
  });

  it('is ignored for another shop, when missing, or when it does not parse', () => {
    page(JSON.stringify(body('other')));
    expect(inlineTenant('icebox')).toBeNull();
    page(null);
    expect(inlineTenant('icebox')).toBeNull();
    page('{not json');
    expect(inlineTenant('icebox')).toBeNull();
    page(JSON.stringify({ ...body(), config: { schemaVersion: 99 } }));
    expect(inlineTenant('icebox')).toBeNull();
  });
});

describe('the config request the page starts early', () => {
  it('is used once, then requests go to the network', async () => {
    const fetch = vi.fn(async () => Response.json(body()));
    vi.stubGlobal('fetch', fetch);
    vi.stubGlobal('window', { __vvsTenant: { slug: 'icebox', response: Promise.resolve(Response.json({ ...body(), version: 7 })) } });
    expect(await loadTenant('icebox')).toMatchObject({ state: 'ok', version: 7 });
    expect(fetch).not.toHaveBeenCalled();
    expect(await loadTenant('icebox')).toMatchObject({ state: 'ok', version: 3 });
    expect(fetch).toHaveBeenCalledTimes(1);
  });

  it('is skipped for another shop, for drafts, and when it failed', async () => {
    const fetch = vi.fn(async () => Response.json(body()));
    vi.stubGlobal('fetch', fetch);
    const early = () => ({ slug: 'icebox', response: Promise.resolve(Response.json({ ...body(), version: 7 })) });
    vi.stubGlobal('window', { __vvsTenant: { ...early(), slug: 'other' } });
    expect(await loadTenant('icebox')).toMatchObject({ version: 3 });
    vi.stubGlobal('window', { __vvsTenant: early() });
    expect(await loadTenant('icebox', undefined, { version: 4, token: 't' })).toMatchObject({ version: 3, preview: true });
    vi.stubGlobal('window', { __vvsTenant: { slug: 'icebox', response: Promise.reject(new Error('offline')) } });
    expect(await loadTenant('icebox')).toMatchObject({ version: 3 });
    expect(fetch).toHaveBeenCalledTimes(3);
  });
});
