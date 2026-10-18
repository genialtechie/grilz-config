import { handleDeposit } from '../server/billing.js';

// Vercel function: POST /api/deposit { leadId, token } → the shop's Stripe
// Checkout page for that design's deposit.
export async function POST(request: Request): Promise<Response> {
  let payload: unknown = null;
  try {
    payload = await request.json();
  } catch {
    // handled as invalid
  }
  const { status, body, headers } = await handleDeposit(payload, process.env);
  return Response.json(body, { status, headers });
}
