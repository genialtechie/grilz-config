import { runRetention } from '../../server/retention.js';

// Vercel Cron (vercel.json "crons"): daily data retention. Vercel sends
// Authorization: Bearer <CRON_SECRET>; anything else is refused.
export async function GET(request: Request): Promise<Response> {
  const secret = process.env.CRON_SECRET;
  if (!secret || request.headers.get('authorization') !== `Bearer ${secret}`) return new Response('Unauthorized', { status: 401 });
  const dryRun = new URL(request.url).searchParams.get('dry') === '1';
  const result = await runRetention(process.env, dryRun);
  console.log('retention', JSON.stringify(result));
  return Response.json(result, { status: result.ok ? 200 : 500, headers: { 'Cache-Control': 'no-store' } });
}
