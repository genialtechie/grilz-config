import { handleStripeWebhook } from '../../server/billing.js';

// Vercel function: Stripe webhooks. /api/stripe/webhook receives platform events
// (subscriptions); /api/stripe/webhook?connect=1 receives events from shops'
// connected accounts (deposits, account status). The raw body is needed to
// check Stripe's signature.
export async function POST(request: Request): Promise<Response> {
  const raw = await request.text();
  const connect = new URL(request.url).searchParams.get('connect') === '1';
  const { status, body, headers } = await handleStripeWebhook(raw, request.headers.get('stripe-signature'), connect, process.env);
  return Response.json(body, { status, headers });
}
