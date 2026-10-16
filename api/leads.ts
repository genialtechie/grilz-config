import { waitUntil } from '@vercel/functions';
import { handleLead } from '../server/leads.js';

// Vercel function: POST /api/leads. A customer sends their design to the shop.
// Env: SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY (required); RESEND_API_KEY,
// TURNSTILE_SECRET_KEY, PLATFORM_LEADS_EMAIL, LEAD_TOKEN_SECRET (optional).
// waitUntil keeps the fallback email alive after the response is sent.

export async function POST(request: Request): Promise<Response> {
  let payload: unknown;
  try {
    payload = await request.json();
  } catch {
    return Response.json({ error: 'Invalid request.', code: 'invalid' }, { status: 400 });
  }
  const ip = (request.headers.get('x-forwarded-for') ?? 'unknown').split(',')[0].trim();
  const { status, body } = await handleLead(payload, ip, process.env, waitUntil);
  return Response.json(body, { status, headers: { 'Cache-Control': 'no-store' } });
}
