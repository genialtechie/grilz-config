import { shopHead } from '../server/shopPage.js';
import { getPublishedTenant } from '../server/tenants.js';

// /b/<slug> is rewritten here (vercel.json). Serves the app's index.html with
// the shop's title and preview image; the client then renders the shop page.
export async function GET(request: Request): Promise<Response> {
  const url = new URL(request.url);
  const slug = (url.searchParams.get('slug') ?? '').toLowerCase();
  const origin = `${url.protocol}//${request.headers.get('x-forwarded-host') ?? url.host}`;
  const page = await fetch(`${origin}/index.html`, { headers: { accept: 'text/html' } });
  let html = await page.text();
  const lookup = await getPublishedTenant(slug, process.env);
  if (lookup.ok) html = shopHead(html, lookup.tenant, origin);
  return new Response(html, {
    status: 200,
    headers: { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'public, s-maxage=300, stale-while-revalidate=600' },
  });
}
