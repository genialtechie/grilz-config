import type { Db } from './db.js';
import { sendEmail, type EmailEnv } from './email.js';
import type { PublishedTenant } from './tenants.js';

// AI spend control. Each shop has a monthly allowance of FLUX generations from
// its config (one per main render or section edit); every render is recorded in
// render_usage, which also backs the global daily budget across all shops.

export type UsageOutcome = 'ok' | 'paused' | 'failed';

export type Reservation = { reservation: number | null; usedBefore: number; refused: 'allowance' | 'daily' | null };

/** Reserves a render's generations under a database lock; refused when the shop's month or the global day is full. */
export async function reserveGenerations(
  db: Db,
  input: { tenantId: string; generations: number; monthLimit: number; dayLimit: number; leadId: string | null },
): Promise<Reservation> {
  const [row] = await db.rpc<{ reservation: number | null; used_before: number; refused: 'allowance' | 'daily' | null }[]>('reserve_generations', {
    target: input.tenantId,
    wanted: input.generations,
    month_limit: input.monthLimit,
    day_limit: input.dayLimit,
    lead: input.leadId,
  });
  return { reservation: row?.reservation ?? null, usedBefore: row?.used_before ?? 0, refused: row ? row.refused : 'daily' };
}

/** Records what a reserved render actually used (a failed main render still costs one; a pause costs none). */
export async function settleReservation(db: Db, id: number, row: { generations: number; outcome: UsageOutcome; seconds?: number }) {
  try {
    await db.update('render_usage', { id: `eq.${id}` }, { generations: row.generations, outcome: row.outcome, seconds: row.seconds ?? null });
  } catch (error) {
    console.error('usage settle failed', error instanceof Error ? error.message : error);
  }
}

export const dayGenerations = (db: Db) => db.rpc<number>('day_generations');

export async function recordUsage(
  db: Db,
  row: { tenantId: string; generations: number; outcome: UsageOutcome; seconds?: number; leadId?: string | null },
) {
  try {
    await db.insert('render_usage', {
      tenant_id: row.tenantId,
      generations: row.generations,
      outcome: row.outcome,
      seconds: row.seconds ?? null,
      lead_id: row.leadId ?? null,
    });
  } catch (error) {
    console.error('usage record failed', error instanceof Error ? error.message : error);
  }
}

/** True when this render pushed the shop past 80% of its monthly allowance. */
export const crossedWarning = (before: number, after: number, limit: number) => limit > 0 && before < limit * 0.8 && after >= limit * 0.8;

/** Tells Magpollo a shop is close to its allowance, so we can add a pack before photos pause. */
export async function warnAllowance(tenant: PublishedTenant, allowance: { used: number; limit: number }, env: EmailEnv & { PLATFORM_LEADS_EMAIL?: string }) {
  if (!env.PLATFORM_LEADS_EMAIL) return;
  const name = tenant.config.brand.name;
  const text = `${name} (${tenant.slug}) has used ${allowance.used} of ${allowance.limit} studio-photo generations this month. Photos pause at ${allowance.limit}.`;
  await sendEmail(
    {
      fromName: 'VVS Lab',
      to: [env.PLATFORM_LEADS_EMAIL],
      subject: `${name} is at 80% of its AI photo allowance`,
      html: `<p style="font-family:-apple-system,Segoe UI,Helvetica,Arial,sans-serif;font-size:15px">${text.replace(/[<>&]/g, '')}</p>`,
      text,
    },
    env,
  );
}
