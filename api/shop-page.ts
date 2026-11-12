import { addCacheTag } from '@vercel/functions';
import { customDomainHead, shopHead } from '../server/shopPage.js';
import { getPublishedTenant, slugForHost, tenantCacheTag } from '../server/tenants.js';

// /b/<slug> is rewritten here (vercel.json), and so is "/" on any host other
// than vvslab.magpollo.com (?domain=1): a shop's custom domain. Serves the app's
// index.html with the shop's title, preview image and public config; the client
// then renders the shop page. An unknown host (a preview deployment) gets the plain app.
export async function GET(request: Request): Promise<Response> {
  const url = new URL(request.url);
  const host = request.headers.get('x-forwarded-host') ?? url.host;
  const origin = `${url.protocol}//${host}`;
  // A preview deployment sits behind Vercel's sign-in, so this function's own request for
  // index.html has to carry the visitor's session, or it is answered with the sign-in page.
  // Production is public and sends nothing extra.
  const headers: Record<string, string> = { accept: 'text/html' };
  const cookie = request.headers.get('cookie');
  if (process.env.VERCEL_ENV === 'preview' && cookie) headers.cookie = cookie;
  const page = await fetch(`${origin}/index.html`, { headers });
  let html = await page.text();
  const byDomain = url.searchParams.get('domain') === '1';
  const slug = byDomain ? await slugForHost(host, process.env) : (url.searchParams.get('slug') ?? '').toLowerCase();
  // A /b/<slug> that doesn't exist answers 404 (the app still shows its
  // "this builder doesn't exist" card), so dead links don't look like pages.
  let status = 200;
  if (slug) {
    const lookup = await getPublishedTenant(slug, process.env);
    if (lookup.ok) {
      html = byDomain ? customDomainHead(html, lookup.tenant, origin) : shopHead(html, lookup.tenant, origin);
      // The page carries the shop's config, so it is purged with /api/tenant when the shop publishes or its billing changes.
      try {
        await addCacheTag(tenantCacheTag(lookup.tenant.slug));
      } catch {
        // Outside Vercel (tests, local): no edge cache to tag.
      }
    } else if (!byDomain && lookup.reason !== 'unavailable') status = 404;
  } else if (!byDomain) status = 404;
  if (status === 404) html = html.replace('</head>', '    <meta name="robots" content="noindex" />\n  </head>');
  return new Response(html, {
    status,
    headers: {
      'Content-Type': 'text/html; charset=utf-8',
      'Cache-Control': status === 404 ? 'public, s-maxage=30' : byDomain ? 'public, s-maxage=60, stale-while-revalidate=300' : 'public, s-maxage=300, stale-while-revalidate=600',
    },
  });
}
