import { addCacheTag } from '@vercel/functions';
import { handlePreview } from '../server/preview.js';
import { handleTenant } from '../server/tenantApi.js';
import { tenantCacheTag } from '../server/tenants.js';

// Vercel function. /api/tenant/<slug> is rewritten to /api/tenant?slug=<slug> in vercel.json.
// Responses carry a per-shop cache tag so a billing change can purge them at the edge.
export async function GET(request: Request): Promise<Response> {
  const params = new URL(request.url).searchParams;
  const slug = (params.get('slug') ?? '').toLowerCase();
  const preview = params.get('preview');
  const token = request.headers.get('authorization')?.replace(/^Bearer\s+/i, '') ?? null;
  const { status, body, headers } = preview ? await handlePreview(slug, Number(preview), token, process.env) : await handleTenant(slug, process.env);
  if (!preview && slug) await addCacheTag(tenantCacheTag(slug));
  return Response.json(body, { status, headers });
}
