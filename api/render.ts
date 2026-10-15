import { handleRender } from '../server/render.js';

// Vercel Node function: POST /api/render  { image: dataURL, spec: RenderSpec }
// Env: FLUX_API_KEY (required); UPSTASH_REDIS_REST_URL, UPSTASH_REDIS_REST_TOKEN,
// RENDER_DAILY_GENERATIONS (optional daily budget in FLUX generations, default 45).

export async function POST(request: Request): Promise<Response> {
  let payload: unknown;
  try {
    payload = await request.json();
  } catch {
    return Response.json({ error: 'Invalid request.' }, { status: 400 });
  }
  const ip = (request.headers.get('x-forwarded-for') ?? 'unknown').split(',')[0].trim();
  const { status, body } = await handleRender(payload, ip, process.env);
  return Response.json(body, { status, headers: { 'Cache-Control': 'no-store' } });
}
