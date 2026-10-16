import { handlePreview } from '../server/preview.js';
import { handleTenant } from '../server/tenantApi.js';

// Vercel function. /api/tenant/<slug> is rewritten to /api/tenant?slug=<slug> in vercel.json.
export async function GET(request: Request): Promise<Response> {
  const params = new URL(request.url).searchParams;
  const slug = (params.get('slug') ?? '').toLowerCase();
  const preview = params.get('preview');
  const token = request.headers.get('authorization')?.replace(/^Bearer\s+/i, '') ?? null;
  const { status, body, headers } = preview ? await handlePreview(slug, Number(preview), token, process.env) : await handleTenant(slug, process.env);
  return Response.json(body, { status, headers });
}
