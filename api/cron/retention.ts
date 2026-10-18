import { dailyAlerts } from '../../server/alerts.js';
import { enforceBilling } from '../../server/billing.js';
import { runRetention } from '../../server/retention.js';

// Vercel Cron (vercel.json "crons"): daily data retention, pausing shops
// whose trial ended without a plan or whose payment failed past the grace
// period, then spend and error alerts. Vercel sends
// Authorization: Bearer <CRON_SECRET>; anything else is refused.
export async function GET(request: Request): Promise<Response> {
  const secret = process.env.CRON_SECRET;
  if (!secret || request.headers.get('authorization') !== `Bearer ${secret}`) return new Response('Unauthorized', { status: 401 });
  const dryRun = new URL(request.url).searchParams.get('dry') === '1';
  const result = await runRetention(process.env, dryRun);
  const billing = dryRun ? { skipped: true } : await enforceBilling(process.env).catch((error: Error) => ({ error: error.message }));
  const alerts = dryRun ? { skipped: true } : await dailyAlerts(process.env).catch((error: Error) => ({ error: error.message }));
  console.log('daily', JSON.stringify({ retention: result, billing, alerts }));
  return Response.json({ retention: result, billing, alerts }, { status: result.ok ? 200 : 500, headers: { 'Cache-Control': 'no-store' } });
}
