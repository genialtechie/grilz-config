import { createDb, hasDb, type Db } from './db.js';
import type { TenantEnv } from './tenants.js';

// Data retention, run daily by Vercel Cron (GET /api/cron/retention):
// leads older than 24 months, and every lead of a shop offboarded more than 90
// days ago, are deleted together with their 3D captures and studio photos.
// Also used when a shop deletes one customer's data on request.

type Expired = { id: string; tenant_id: string; preview_path: string | null; photo_path: string | null; reason: string };

async function deleteLeads(db: Db, leads: Pick<Expired, 'id' | 'preview_path' | 'photo_path'>[]) {
  if (!leads.length) return 0;
  const paths = leads.flatMap((lead) => [lead.preview_path, lead.photo_path]).filter((path): path is string => Boolean(path));
  // Files first: a lead row without files is harmless, files without a row are orphans.
  for (let i = 0; i < paths.length; i += 100) await db.removeObjects('lead-media', paths.slice(i, i + 100));
  for (let i = 0; i < leads.length; i += 100) {
    await db.remove('leads', { id: `in.(${leads.slice(i, i + 100).map((lead) => lead.id).join(',')})` });
  }
  return leads.length;
}

export async function runRetention(env: TenantEnv, dryRun = false) {
  if (!hasDb(env)) return { ok: false, error: 'database not configured' };
  const db = createDb(env);
  let deleted = 0;
  const reasons: Record<string, number> = {};
  // Batches of 500 until nothing is due (bounded so one run can't loop forever).
  for (let round = 0; round < 20; round += 1) {
    const due = await db.rpc<Expired[]>('expired_leads', { max_rows: 500 });
    if (!due.length) break;
    due.forEach((lead) => { reasons[lead.reason] = (reasons[lead.reason] ?? 0) + 1; });
    if (dryRun) return { ok: true, dryRun: true, due: due.length, reasons };
    deleted += await deleteLeads(db, due);
  }
  return { ok: true, deleted, reasons };
}

/** Deletes one customer's lead (and its files) for the shop, on the customer's request. */
export async function deleteLead(db: Db, leadId: string) {
  const [lead] = await db.select<Expired>('leads', { id: `eq.${leadId}`, select: 'id,tenant_id,preview_path,photo_path' });
  if (!lead) return 0;
  return deleteLeads(db, [lead]);
}
