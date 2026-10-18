import { handleUnsubscribe } from '../server/marketing.js';

// Vercel function: the unsubscribe link in every marketing email.
// GET /api/unsubscribe?e=…&topic=…&s=… shows the confirm page; POST acts (the
// page's buttons, or a mail client's one-click List-Unsubscribe-Post).

const respond = ({ status, html }: { status: number; html: string }) =>
  new Response(html, { status, headers: { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'no-store', 'X-Robots-Tag': 'noindex' } });

export async function GET(request: Request): Promise<Response> {
  return respond(await handleUnsubscribe('GET', new URL(request.url), new URLSearchParams(), process.env));
}

export async function POST(request: Request): Promise<Response> {
  const form = new URLSearchParams(await request.text().catch(() => ''));
  return respond(await handleUnsubscribe('POST', new URL(request.url), form, process.env));
}
