import { customDomainHead, shopHead } from '../server/shopPage.js';
import { getPublishedTenant, slugForHost } from '../server/tenants.js';

// /b/<slug> is rewritten here (vercel.json), and so is "/" on any host other
// than vvslab.magpollo.com (?domain=1): a shop's custom domain. Serves the app's
// index.html with the shop's title and preview image; the client then renders
// the shop page. An unknown host (a preview deployment) gets the plain app.
export async function GET(request: Request): Promise<Response> {
  const url = new URL(request.url);
  const host = request.headers.get('x-forwarded-host') ?? url.host;
  const origin = `${url.protocol}//${host}`;
  const page = await fetch(`${origin}/index.html`, { headers: { accept: 'text/html' } });
  let html = await page.text();
  const byDomain = url.searchParams.get('domain') === '1';
  const slug = byDomain ? await slugForHost(host, process.env) : (url.searchParams.get('slug') ?? '').toLowerCase();
  if (slug) {
    const lookup = await getPublishedTenant(slug, process.env);
    if (lookup.ok) html = byDomain ? customDomainHead(html, lookup.tenant, origin) : shopHead(html, lookup.tenant, origin);
  }
  return new Response(html, {
    status: 200,
    headers: { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': byDomain ? 'public, s-maxage=60, stale-while-revalidate=300' : 'public, s-maxage=300, stale-while-revalidate=600' },
  });
}
