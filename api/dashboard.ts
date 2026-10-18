import { handleDashboard } from '../server/dashboard.js';

// Vercel function: POST /api/dashboard/<action> (publish, invite, stats) with the
// signed-in member's access token. /api/dashboard/:action is rewritten to
// /api/dashboard?action=:action in vercel.json.
export async function POST(request: Request): Promise<Response> {
  const action = new URL(request.url).searchParams.get('action') ?? '';
  const token = request.headers.get('authorization')?.replace(/^Bearer\s+/i, '') ?? null;
  let payload: unknown = null;
  try {
    payload = await request.json();
  } catch {
    // an empty or invalid body is handled as a bad request by the handler
  }
  const { status, body, headers } = await handleDashboard(action, payload, token, process.env);
  return Response.json(body, { status, headers });
}
