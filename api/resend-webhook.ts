import { handleResendWebhook } from '../server/marketing.js';

// Vercel function: POST /api/resend-webhook. Resend calls it on delivery
// events; complaints and hard bounces become opt-outs. Set RESEND_WEBHOOK_SECRET
// to the endpoint's signing secret (Resend → Webhooks).
export async function POST(request: Request): Promise<Response> {
  const rawBody = await request.text();
  const { status, body } = await handleResendWebhook(
    rawBody,
    { id: request.headers.get('svix-id'), timestamp: request.headers.get('svix-timestamp'), signature: request.headers.get('svix-signature') },
    process.env,
  );
  return Response.json(body, { status });
}
