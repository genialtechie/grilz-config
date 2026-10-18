import { createDb, hasDb, type Db } from './db.js';
import type { TenantEnv } from './tenants.js';

// Data retention, run daily by Vercel Cron (GET /api/cron/retention):
// leads older than 24 months, and every lead of a shop offboarded more than 90
// days ago, are deleted together with their 3D captures and studio photos; that
// shop's logos (tenant-assets) go at the same point.
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

/** Same window as the leads: 90 days after offboarding. */
export const OFFBOARD_KEEP_DAYS = 90;

/**
 * Deletes the logos of shops offboarded more than 90 days ago (tenant-assets/<tenant id>/).
 * A shop is marked purged only once its folder lists empty; a failing shop is
 * retried the next day and never blocks the others (or the rest of the cron).
 */
async function purgeOffboardedAssets(db: Db, dryRun: boolean) {
  const before = new Date(Date.now() - OFFBOARD_KEEP_DAYS * 864e5).toISOString();
  let shops: { id: string }[];
  try {
    shops = await db.select<{ id: string }>('tenants', { status: 'eq.offboarded', offboarded_at: `lt.${before}`, assets_purged_at: 'is.null', select: 'id', limit: '50' });
  } catch (error) {
    console.error('logo purge skipped', error instanceof Error ? error.message : error);
    return { shops: 0, files: 0, failed: 1 };
  }
  if (dryRun) return { shops: shops.length, files: 0 };
  let files = 0;
  let failed = 0;
  for (const shop of shops) {
    try {
      // Pages of up to 1000 until the folder is empty (bounded); logos sit at the folder's top level.
      let empty = false;
      for (let round = 0; round < 10 && !empty; round += 1) {
        const objects = (await db.listObjects('tenant-assets', shop.id)).filter((item) => item.id !== null);
        empty = objects.length === 0;
        if (empty) break;
        await db.removeObjects('tenant-assets', objects.map((item) => `${shop.id}/${item.name}`));
        files += objects.length;
      }
      if (empty) await db.update('tenants', { id: `eq.${shop.id}` }, { assets_purged_at: new Date().toISOString() });
    } catch (error) {
      failed += 1;
      console.error('logo purge failed', shop.id, error instanceof Error ? error.message : error);
    }
  }
  return { shops: shops.length, files, failed };
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
    if (dryRun) return { ok: true, dryRun: true, due: due.length, reasons, assets: await purgeOffboardedAssets(db, true) };
    deleted += await deleteLeads(db, due);
  }
  const assets = await purgeOffboardedAssets(db, dryRun);
  return dryRun ? { ok: true, dryRun: true, due: 0, reasons, assets } : { ok: true, deleted, reasons, assets };
}

/** Deletes one customer's lead (and its files) for the shop, on the customer's request. */
export async function deleteLead(db: Db, leadId: string) {
  const [lead] = await db.select<Expired>('leads', { id: `eq.${leadId}`, select: 'id,tenant_id,preview_path,photo_path' });
  if (!lead) return 0;
  return deleteLeads(db, [lead]);
}
