import { next, rewrite } from '@vercel/functions';

// Custom domains (MAG-198). Vercel serves a static file before it applies the
// rewrites in vercel.json, and "/" is always index.html, so a rewrite of "/"
// never runs. Routing middleware runs before that file check: on a shop's own
// domain it sends "/" to /api/shop-page?domain=1, which looks the shop up by
// host and serves the app with the shop marked in the page. Only "/" goes
// through here (see config.matcher); every other path is served as before.

/**
 * Our own hosts keep the VVS Lab landing page: magpollo.com and its
 * subdomains (vvslab., commerce., grillz.; shops can't claim them, see
 * server/domains.ts), Vercel deployment and preview URLs, and local dev.
 * A host missing from this list is still safe: shop-page finds no shop for it
 * and serves the plain app.
 */
export const isPlatformHost = (host: string) => {
  const name = host.toLowerCase().replace(/:\d+$/, '');
  return (
    name === 'magpollo.com' ||
    name.endsWith('.magpollo.com') ||
    name.endsWith('.vercel.app') ||
    name === 'localhost' ||
    name === '127.0.0.1'
  );
};

export const config = { matcher: '/' };

export default function middleware(request: Request): Response {
  const url = new URL(request.url);
  const host = request.headers.get('host') ?? url.host;
  if (url.pathname !== '/' || isPlatformHost(host)) return next();
  // Keep the visitor's query (?design=, ?preview=, UTMs). The host goes in the URL too, so
  // the page is cached per domain even if the edge cache key ever left the host out.
  const destination = new URL('/api/shop-page', url);
  url.searchParams.forEach((value, key) => {
    if (key !== 'domain' && key !== 'host') destination.searchParams.append(key, value);
  });
  destination.searchParams.set('domain', '1');
  destination.searchParams.set('host', host.toLowerCase());
  return rewrite(destination);
}
