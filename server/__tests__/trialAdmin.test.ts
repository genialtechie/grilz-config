import { describe, expect, it } from 'vitest';
import type { Db } from '../db';
import { extendTrial } from '../trialAdmin';

// The extend control, against a fake database: the shop, the audit log, and
// the status flip are all in memory here.

const now = Date.parse('2026-11-25T12:00:00Z');
const at = (days: number) => new Date(now + days * 864e5).toISOString();

type Tenant = { id: string; slug: string; name: string; kind: string; status: string; plan: string | null; trial_ends_at: string | null; billing_status: string | null };

const shop = (patch: Partial<Tenant> = {}): Tenant => ({
  id: 't1',
  slug: 'frost',
  name: 'Mr Frost',
  kind: 'shop',
  status: 'live',
  plan: 'trial',
  trial_ends_at: at(5),
  billing_status: 'none',
  ...patch,
});

function setup(tenant: Tenant | null) {
  const events: Record<string, unknown>[] = [];
  const db = {
    select: async () => (tenant ? [tenant] : []),
    insert: async (_table: string, row: Record<string, unknown>) => {
      events.push(row);
      return row;
    },
    update: async (_table: string, _filter: unknown, patch: Record<string, unknown>) => {
      if (tenant) Object.assign(tenant, patch);
      return tenant ? [tenant] : [];
    },
  } as unknown as Db;
  return { db, events, tenant };
}

describe('extendTrial', () => {
  it('extends a running trial from its current end, and logs who did it', async () => {
    const { db, events, tenant } = setup(shop());
    const result = await extendTrial(db, 'admin-1', 't1', { days: 14 }, now);
    expect(result.status).toBe(200);
    expect(result.body).toMatchObject({ ok: true, endsAt: at(19), restored: false });
    expect(tenant?.trial_ends_at).toBe(at(19));
    expect(tenant?.status).toBe('live');
    expect(events).toHaveLength(1);
    expect(events[0]).toMatchObject({ tenant_id: 't1', type: 'trial_extended', actor: 'admin-1', data: { from: at(5), to: at(19), days: 14, restored: false } });
  });

  it('extends an expired trial from today, and brings a paused shop back live', async () => {
    const { db, events, tenant } = setup(shop({ status: 'paused', trial_ends_at: at(-1) }));
    const result = await extendTrial(db, 'admin-1', 't1', { days: 30 }, now);
    expect(result.status).toBe(200);
    expect(result.body).toMatchObject({ ok: true, endsAt: at(30), restored: true });
    expect(tenant?.trial_ends_at).toBe(at(30));
    expect(tenant?.status).toBe('live');
    expect(events[0]).toMatchObject({ data: { from: at(-1), to: at(30), days: 30, restored: true } });
  });

  it('does not unpause a shop paused by hand while its trial still runs', async () => {
    const { db, tenant } = setup(shop({ status: 'paused', trial_ends_at: at(5) }));
    const result = await extendTrial(db, 'admin-1', 't1', { days: 7 }, now);
    expect(result.body).toMatchObject({ ok: true, endsAt: at(12), restored: false });
    expect(tenant?.status).toBe('paused');
  });

  it('extends to the end of a picked date', async () => {
    const { db, tenant } = setup(shop());
    const result = await extendTrial(db, 'admin-1', 't1', { date: '2026-12-10' }, now);
    expect(result.status).toBe(200);
    expect(result.body).toMatchObject({ ok: true, endsAt: '2026-12-10T23:59:59.000Z' });
    expect(tenant?.trial_ends_at).toBe('2026-12-10T23:59:59.000Z');
  });

  it('rejects shops with no trial to extend, and a shop whose card is on file', async () => {
    const founding = setup(shop({ plan: null, trial_ends_at: null }));
    const foundingResult = await extendTrial(founding.db, 'admin-1', 't1', { days: 7 }, now);
    expect(foundingResult.status).toBe(409);
    expect(foundingResult.body).toMatchObject({ error: 'not_on_trial' });
    expect(founding.events).toHaveLength(0); // nothing logged, no end date written
    const paid = setup(shop({ plan: 'paid', trial_ends_at: null }));
    expect((await extendTrial(paid.db, 'admin-1', 't1', { days: 7 }, now)).status).toBe(409);
    expect(paid.events).toHaveLength(0);
    const card = setup(shop({ billing_status: 'trialing' }));
    const cardResult = await extendTrial(card.db, 'admin-1', 't1', { days: 7 }, now);
    expect(cardResult.status).toBe(409);
    expect(cardResult.body).toMatchObject({ error: 'not_on_trial' });
    expect(card.events).toHaveLength(0);
  });

  it('still extends a trial with no end date yet', async () => {
    const { db, tenant } = setup(shop({ trial_ends_at: null }));
    const result = await extendTrial(db, 'admin-1', 't1', { days: 30 }, now);
    expect(result.status).toBe(200);
    expect(result.body).toMatchObject({ ok: true, endsAt: at(30) });
    expect(tenant?.trial_ends_at).toBe(at(30));
  });

  it('rejects a missing shop, a non-shop, a closed shop, and bad options', async () => {
    const missing = setup(null);
    expect((await extendTrial(missing.db, 'admin-1', 'nope', { days: 7 }, now)).status).toBe(404);
    const demo = setup(shop({ kind: 'demo' }));
    expect((await extendTrial(demo.db, 'admin-1', 't1', { days: 7 }, now)).status).toBe(409);
    const closed = setup(shop({ status: 'offboarded' }));
    expect((await extendTrial(closed.db, 'admin-1', 't1', { days: 7 }, now)).status).toBe(409);
    const live = setup(shop());
    for (const option of [{ days: 0 }, { days: 400 }, { days: NaN }, { date: '2026-11-01' }, { date: 'junk' }] as const) {
      expect((await extendTrial(live.db, 'admin-1', 't1', option, now)).status, JSON.stringify(option)).toBe(400);
    }
    expect(live.events).toHaveLength(0); // nothing was logged for a rejected extend
  });
});
