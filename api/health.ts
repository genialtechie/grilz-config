import { health } from '../server/health.js';

// Vercel function: GET /api/health (uptime monitors). Never cached.
export async function GET(): Promise<Response> {
  const { status, body } = await health(process.env);
  return Response.json(body, { status, headers: { 'Cache-Control': 'no-store' } });
}
