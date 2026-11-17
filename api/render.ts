import { waitUntil } from '@vercel/functions';
import { handleDescribe } from '../server/describe.js';
import { handleRender } from '../server/render.js';

// Vercel Node function: POST /api/render  { tenant, image: dataURL, spec: RenderSpec, leadId?, leadToken? }
// waitUntil keeps usage recording and the lead's photo email alive after the response.
// Env: FLUX_API_KEY (required); UPSTASH_REDIS_REST_URL, UPSTASH_REDIS_REST_TOKEN,
// RENDER_DAILY_GENERATIONS (optional daily budget in FLUX generations, default 45).
// Also POST /api/describe (rewritten to ?route=describe): "Describe it", the AI
// builds a grill from words or a picture (server/describe.ts). Shares this
// function because the plan allows 12. Env: OPENAI_API_KEY, FIREBASE_SERVICE_ACCOUNT
// or FIREBASE_PROJECT_ID; optional OPENAI_DESCRIBE_MODEL, OPENAI_DESCRIBE_EFFORT,
// DESCRIBE_DAILY_LIMIT, PHONE_HASH_SECRET, ALLOW_DEV_PHONE (never in production).

export async function POST(request: Request): Promise<Response> {
  let payload: unknown;
  try {
    payload = await request.json();
  } catch {
    return Response.json({ error: 'Invalid request.' }, { status: 400 });
  }
  const ip = (request.headers.get('x-forwarded-for') ?? 'unknown').split(',')[0].trim();
  const route = new URL(request.url).searchParams.get('route');
  const { status, body } = route === 'describe' ? await handleDescribe(payload, ip, process.env) : await handleRender(payload, ip, process.env, waitUntil);
  return Response.json(body, { status, headers: { 'Cache-Control': 'no-store' } });
}
