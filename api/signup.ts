import { claimStatus, handleClaim } from '../server/claims.js';
import { handleSignup, slugAvailable } from '../server/signup.js';

// Vercel function: POST /api/signup creates a shop (self-serve); GET
// /api/signup?slug=<slug> says whether a link is free, for the signup form.
// Claim links share it (the plan allows 12 functions): POST { claim, email }
// claims a shop, GET ?claim=<token> shows the claim page what it's claiming.
export async function POST(request: Request): Promise<Response> {
  let payload: unknown = null;
  try {
    payload = await request.json();
  } catch {
    // handled as invalid input
  }
  const ip = (request.headers.get('x-forwarded-for') ?? 'unknown').split(',')[0].trim();
  const claim = payload && typeof payload === 'object' && 'claim' in payload;
  const { status, body, headers } = claim ? await handleClaim(payload, ip, process.env) : await handleSignup(payload, ip, process.env);
  return Response.json(body, { status, headers });
}

export async function GET(request: Request): Promise<Response> {
  const params = new URL(request.url).searchParams;
  const claim = params.get('claim');
  const slug = (params.get('slug') ?? '').toLowerCase();
  const { status, body, headers } = claim !== null ? await claimStatus(claim, process.env) : await slugAvailable(slug, process.env);
  return Response.json(body, { status, headers });
}
