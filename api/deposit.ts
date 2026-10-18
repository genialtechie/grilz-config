import { handleDeposit } from '../server/billing.js';

// Vercel function: POST /api/deposit { leadId, token } → the shop's Stripe
// Checkout page for that design's deposit. GET /api/deposit?lead=…&t=… is the
// same, as a link (the customer's confirmation email): it redirects to Checkout,
// or explains why it can't.
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

const escape = (text: string) => text.replace(/[&<>"']/g, (char) => `&#${char.charCodeAt(0)};`);

export async function GET(request: Request): Promise<Response> {
  const url = new URL(request.url);
  const result = await handleDeposit({ leadId: url.searchParams.get('lead'), token: url.searchParams.get('t') }, process.env);
  const { status } = result;
  const body = (result.body ?? {}) as Record<string, unknown>;
  if (status === 200 && typeof body.url === 'string') return Response.redirect(body.url, 303);
  const message = typeof body.message === 'string' ? body.message : 'This deposit link isn’t available. The shop will reach out to you.';
  const html = `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Deposit</title>
<style>body{margin:0;min-height:100vh;display:grid;place-items:center;background:#fbf7f0;color:#1b1714;font:17px/1.55 -apple-system,BlinkMacSystemFont,'Segoe UI',Helvetica,Arial,sans-serif}main{max-width:420px;padding:32px 24px;text-align:center}@media(prefers-color-scheme:dark){body{background:#1b1714;color:#f3ede4}}</style>
</head><body><main><p>${escape(message)}</p></main></body></html>`;
  return new Response(html, { status: status === 409 ? 200 : status, headers: { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'no-store' } });
}
