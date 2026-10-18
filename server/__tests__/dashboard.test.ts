import { afterEach, describe, expect, it, vi } from 'vitest';
import { handleDashboard, lockPlanFields, PLAN_GENERATIONS } from '../dashboard';
import { describeChanges } from '../../src/lib/tenant/diff';
import { csvCell } from '../../src/admin/leadsCsv';
import { VVSLAB_CONFIG } from '../../src/lib/tenant/vvslab';

const cfg = () => structuredClone(VVSLAB_CONFIG);
afterEach(() => vi.unstubAllGlobals());

describe('plan-controlled fields', () => {
  it('keeps the live AI allowance and footer whatever the draft says', () => {
    const live = cfg();
    live.ai.monthlyGenerations = 300;
    live.brand.poweredBy = true;
    const draft = cfg();
    draft.ai.monthlyGenerations = 100000;
    draft.brand.poweredBy = false;
    draft.deposit = { mode: 'none', rule: { type: 'fixed', amount: 0 } };
    const { config, reset, error } = lockPlanFields(draft, live, false);
    expect(error).toBeUndefined();
    expect(config.ai.monthlyGenerations).toBe(300);
    expect(config.brand.poweredBy).toBe(true);
    expect(reset).toEqual(['ai.monthlyGenerations', 'brand.poweredBy']);
    expect(draft.ai.monthlyGenerations).toBe(100000); // input untouched
  });

  it('uses the plan default on a first publish', () => {
    const draft = cfg();
    draft.ai.monthlyGenerations = 5000;
    expect(lockPlanFields(draft, null, false).config.ai.monthlyGenerations).toBe(PLAN_GENERATIONS);
  });

  it('refuses card deposits until Stripe is connected', () => {
    const draft = cfg();
    draft.deposit = { mode: 'stripe', rule: { type: 'percent', value: 25, min: 100, roundTo: 10 } };
    const live = cfg();
    live.deposit = { mode: 'none', rule: { type: 'fixed', amount: 0 } };
    expect(lockPlanFields(draft, live, false).error).toMatch(/Connect Stripe/);
    expect(lockPlanFields(draft, live, true).error).toBeUndefined();
  });
});

describe('describeChanges', () => {
  it('lists price, catalog, brand and deposit changes in plain words', () => {
    const live = cfg();
    const draft = cfg();
    draft.pricing.metalPerTooth.yellow = 165;
    draft.catalog.metals = draft.catalog.metals.filter((id) => id !== 'platinum');
    draft.brand.name = 'Gold Mouth';
    draft.catalog.fangs = false;
    draft.deposit = { mode: 'link', link: 'https://pay.test/x', rule: { type: 'fixed', amount: 100 } };
    const text = describeChanges(live, draft).map((change) => change.text);
    expect(text).toContain('Yellow gold: $150 → $165 per tooth');
    expect(text).toContain('Metals: removed Platinum');
    expect(text).toContain('Name: VVS Lab → Gold Mouth');
    expect(text).toContain('Fangs turned off');
    expect(text.some((item) => item.startsWith('$100 by payment link') || item.endsWith('$100 by payment link'))).toBe(true);
  });

  it('is empty when nothing changed, and says so for a first version', () => {
    expect(describeChanges(cfg(), cfg())).toEqual([]);
    expect(describeChanges(null, cfg())).toHaveLength(1);
  });
});

describe('CSV export', () => {
  it('quotes cells and defuses spreadsheet formulas', () => {
    expect(csvCell('Ava "AJ" Test')).toBe('"Ava ""AJ"" Test"');
    expect(csvCell('=HYPERLINK("x")')).toBe(`"'=HYPERLINK(""x"")"`);
    expect(csvCell('+15555550100')).toBe(`"'+15555550100"`);
    expect(csvCell(null)).toBe('""');
  });
});

describe('dashboard API guards', () => {
  const env = { SUPABASE_URL: 'https://db.test', SUPABASE_SERVICE_ROLE_KEY: 'service' };

  it('needs a token', async () => {
    expect((await handleDashboard('publish', {}, null, env)).status).toBe(401);
  });

  it('rejects an invalid session', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => new Response('{}', { status: 401 })));
    expect((await handleDashboard('publish', { configId: '00000000-0000-0000-0000-000000000000' }, 'bad', env)).status).toBe(401);
  });

  it('answers 404 for unknown actions and for configs the user has no role on', async () => {
    vi.stubGlobal('fetch', vi.fn(async (input: string | URL | Request) => {
      const url = String(input);
      if (url.endsWith('/auth/v1/user')) return Response.json({ id: 'u1', email: 'a@test' });
      if (url.includes('/rest/v1/tenant_configs')) return Response.json([{ id: 'c', tenant_id: '11111111-1111-1111-1111-111111111111', status: 'draft', config: VVSLAB_CONFIG }]);
      if (url.includes('/rest/v1/platform_admins')) return new Response(null, { status: 200, headers: { 'content-range': '*/0' } });
      if (url.includes('/rest/v1/members')) return Response.json([]);
      return new Response('unexpected', { status: 500 });
    }));
    expect((await handleDashboard('nope', {}, 'tok', env)).status).toBe(404);
    expect((await handleDashboard('publish', { configId: '22222222-2222-2222-2222-222222222222' }, 'tok', env)).status).toBe(404);
  });
});

describe('invites need sign-up switched off', () => {
  it('refuses to invite while public sign-up is on', async () => {
    const env = { SUPABASE_URL: 'https://db.test', SUPABASE_SERVICE_ROLE_KEY: 'service' };
    vi.stubGlobal('fetch', vi.fn(async (input: string | URL | Request) => {
      const url = String(input);
      if (url.endsWith('/auth/v1/user')) return Response.json({ id: 'u1', email: 'owner@test' });
      if (url.includes('/rest/v1/platform_admins')) return new Response(null, { status: 200, headers: { 'content-range': '*/0' } });
      if (url.includes('/rest/v1/members')) return Response.json([{ role: 'owner' }]);
      if (url.includes('/rest/v1/tenants')) return Response.json([{ id: '11111111-1111-1111-1111-111111111111', slug: 's', name: 'S', kind: 'shop', status: 'live', stripe_account_id: null }]);
      if (url.endsWith('/auth/v1/settings')) return Response.json({ disable_signup: false });
      return new Response('unexpected', { status: 500 });
    }));
    const result = await handleDashboard('invite', { tenantId: '11111111-1111-1111-1111-111111111111', email: 'new@test.com', role: 'staff' }, 'tok', env);
    expect(result.status).toBe(503);
  });
});
