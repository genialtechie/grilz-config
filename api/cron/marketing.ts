import { runAnnouncements } from '../../server/announcements.js';
import { runTrialSequence } from '../../server/trialSequence.js';
import { runWinback } from '../../server/winback.js';

// Vercel Cron (vercel.json "crons"), daily at 14:07 UTC (10am US Eastern):
// the trial sequence, win-back, then any announcement whose window is open.
// Vercel sends Authorization: Bearer <CRON_SECRET>; anything else is refused.
// ?dry=1 reports what would go out without sending.
export async function GET(request: Request): Promise<Response> {
  const secret = process.env.CRON_SECRET;
  if (!secret || request.headers.get('authorization') !== `Bearer ${secret}`) return new Response('Unauthorized', { status: 401 });
  const dryRun = new URL(request.url).searchParams.get('dry') === '1';
  const fail = (error: Error) => ({ error: error.message });
  const trial = await runTrialSequence(process.env, { dryRun }).catch(fail);
  const winback = await runWinback(process.env, { dryRun }).catch(fail);
  const announcements = await runAnnouncements(process.env, { dryRun }).catch(fail);
  const report = { trial, winback, announcements, dryRun };
  console.log('marketing', JSON.stringify(report));
  const failed = [trial, winback, announcements].some((part) => 'error' in part);
  return Response.json(report, { status: failed ? 500 : 200, headers: { 'Cache-Control': 'no-store' } });
}
