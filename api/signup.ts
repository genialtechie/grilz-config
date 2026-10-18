import { handleSignup, slugAvailable } from '../server/signup.js';

// Vercel function: POST /api/signup creates a shop (self-serve); GET
// /api/signup?slug=<slug> says whether a link is free, for the signup form.
export async function POST(request: Request): Promise<Response> {
  let payload: unknown = null;
  try {
    payload = await request.json();
  } catch {
    // handled as invalid input
  }
  const ip = (request.headers.get('x-forwarded-for') ?? 'unknown').split(',')[0].trim();
  const { status, body, headers } = await handleSignup(payload, ip, process.env);
  return Response.json(body, { status, headers });
}

export async function GET(request: Request): Promise<Response> {
  const slug = (new URL(request.url).searchParams.get('slug') ?? '').toLowerCase();
  const { status, body, headers } = await slugAvailable(slug, process.env);
  return Response.json(body, { status, headers });
}
