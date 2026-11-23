import { describe, expect, it } from 'vitest';
import middleware, { config, isPlatformHost } from '../../middleware';

// Custom domains (MAG-198): "/" on a shop's own domain goes to shop-page; our own hosts keep the landing page.

const route = (url: string) => {
  const response = middleware(new Request(url, { headers: { host: new URL(url).host } }));
  const rewrite = response.headers.get('x-middleware-rewrite');
  return rewrite ? new URL(rewrite) : 'next';
};

describe('routing middleware', () => {
  it('only runs on "/"', () => {
    expect(config.matcher).toBe('/');
  });

  it('sends "/" on a custom domain to the shop page, keeping the query', () => {
    const to = route('https://build.genialtechie.site/?design=abc&utm_source=ig');
    if (to === 'next') throw new Error('not rewritten');
    expect(to.host).toBe('build.genialtechie.site');
    expect(to.pathname).toBe('/api/shop-page');
    expect(Object.fromEntries(to.searchParams)).toEqual({ design: 'abc', utm_source: 'ig', domain: '1', host: 'build.genialtechie.site' });
    // An apex domain too, and a visitor can't switch the lookup off.
    const apex = route('https://GoldMouth.com/?domain=0');
    expect(apex !== 'next' && Object.fromEntries(apex.searchParams)).toEqual({ domain: '1', host: 'goldmouth.com' });
  });

  it('keeps the landing page on our own hosts and previews', () => {
    for (const host of ['vvslab.magpollo.com', 'commerce.magpollo.com', 'grillz.magpollo.com', 'magpollo.com', 'grilz-config.vercel.app', 'grilz-config-git-x-team.vercel.app', 'localhost:5173', '127.0.0.1:4173']) {
      expect(isPlatformHost(host), host).toBe(true);
      expect(route(`http://${host}/`), host).toBe('next');
    }
    for (const host of ['build.genialtechie.site', 'magpollo.com.evil.site', 'notmagpollo.com', 'vercel.app.shop.com']) expect(isPlatformHost(host), host).toBe(false);
  });

  it('leaves every other path alone', () => {
    for (const path of ['/index.html', '/b/video-demo-shop', '/admin', '/dashboard', '/api/tenant/x', '/assets/app.js']) {
      expect(route(`https://build.genialtechie.site${path}`), path).toBe('next');
    }
  });
});
