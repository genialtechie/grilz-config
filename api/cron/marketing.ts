import { runTrialSequence } from '../../server/trialSequence.js';

// Vercel Cron (vercel.json "crons"), daily at 14:07 UTC (10am US Eastern):
// the trial sequence. Vercel sends Authorization: Bearer <CRON_SECRET>;
// anything else is refused. ?dry=1 reports what would go out.
export async function GET(request: Request): Promise<Response> {
  const secret = process.env.CRON_SECRET;
  if (!secret || request.headers.get('authorization') !== `Bearer ${secret}`) return new Response('Unauthorized', { status: 401 });
  const dryRun = new URL(request.url).searchParams.get('dry') === '1';
  const trial = await runTrialSequence(process.env, { dryRun }).catch((error: Error) => ({ error: error.message }));
  console.log('marketing', JSON.stringify({ trial, dryRun }));
  return Response.json({ trial, dryRun }, { status: 'error' in trial ? 500 : 200, headers: { 'Cache-Control': 'no-store' } });
}
