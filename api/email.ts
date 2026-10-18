import { handleResendWebhook, handleUnsubscribe } from '../server/marketing.js';

// Vercel function for marketing email's public endpoints, one function to stay
// inside the plan's function limit. vercel.json rewrites the public paths here:
//   /api/unsubscribe     → ?route=unsubscribe   GET shows the confirm page; POST acts
//                          (the page's buttons, or a mail client's one-click
//                          List-Unsubscribe-Post)
//   /api/resend-webhook  → ?route=resend-webhook  Resend events (Svix-signed);
//                          complaints and hard bounces become opt-outs

const page = ({ status, html }: { status: number; html: string }) =>
  new Response(html, { status, headers: { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'no-store', 'X-Robots-Tag': 'noindex' } });

const route = (request: Request) => new URL(request.url).searchParams.get('route');

export async function GET(request: Request): Promise<Response> {
  if (route(request) !== 'unsubscribe') return new Response('Not found', { status: 404 });
  return page(await handleUnsubscribe('GET', new URL(request.url), new URLSearchParams(), process.env));
}

export async function POST(request: Request): Promise<Response> {
  const which = route(request);
  const rawBody = await request.text().catch(() => '');
  if (which === 'unsubscribe') return page(await handleUnsubscribe('POST', new URL(request.url), new URLSearchParams(rawBody), process.env));
  if (which === 'resend-webhook') {
    const { status, body } = await handleResendWebhook(
      rawBody,
      { id: request.headers.get('svix-id'), timestamp: request.headers.get('svix-timestamp'), signature: request.headers.get('svix-signature') },
      process.env,
    );
    return Response.json(body, { status });
  }
  return new Response('Not found', { status: 404 });
}
