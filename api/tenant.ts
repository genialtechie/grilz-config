import { handleTenant } from '../server/tenantApi.js';

// Vercel function. /api/tenant/<slug> is rewritten to /api/tenant?slug=<slug> in vercel.json.
export async function GET(request: Request): Promise<Response> {
  const slug = new URL(request.url).searchParams.get('slug') ?? '';
  const { status, body, headers } = await handleTenant(slug, process.env);
  return Response.json(body, { status, headers });
}
