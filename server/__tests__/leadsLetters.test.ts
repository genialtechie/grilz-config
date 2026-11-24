import { readFileSync } from 'node:fs';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { leadsCsv } from '../../src/admin/leadsCsv';
import type { LeadRow } from '../../src/admin/data';
import { priceBreakdown } from '../../src/lib/pricing';
import type { RenderSpec } from '../../src/lib/renderSpec';
import { VVSLAB_CONFIG } from '../../src/lib/tenant/vvslab';
import { shopEmail, type LeadForEmail } from '../emailTemplates';
import { handleLead } from '../leads';

// Launch prep (Nov 24): what the new builder sends reaches the shop whole. Its
// second line of letters (Design.second) and its charms are in the lead's
// server-built summary and in the shop's request email; the dashboard's CSV
// says whether the phone was verified.

// The builder's own spec for a 6 × 6 with "AB" on top, "Lainee" below and a Crown charm
// (src/components/creator/__tests__/leadSpec.test.ts checks the builder still makes exactly this).
const spec = JSON.parse(readFileSync(new URL('../../src/components/creator/__tests__/fixtures/lead-two-lines.json', import.meta.url), 'utf8')) as RenderSpec;

describe('a lead from the new builder', () => {
  afterEach(() => vi.unstubAllGlobals());

  it('keeps both lines of letters and the charm in the summary and the shop email', async () => {
    const stored: Record<string, unknown>[] = [];
    vi.stubGlobal(
      'fetch',
      vi.fn(async (input: string | URL | Request, init?: RequestInit) => {
        const url = String(input);
        if (url.includes('/rest/v1/rpc/create_lead')) {
          stored.push((JSON.parse(String(init?.body)) as { lead: Record<string, unknown> }).lead);
          return new Response('"ok"', { status: 200 });
        }
        if (url.includes('/rest/v1/tenants')) return Response.json([{ id: 'eae3e55c-610b-47d4-b5cc-665289f37eb9' }]);
        return Response.json([]);
      }),
    );
    expect(spec.inscriptions).toHaveLength(2);
    const env = { SUPABASE_URL: 'http://db.test', SUPABASE_SERVICE_ROLE_KEY: 'k', LEAD_TOKEN_SECRET: 's' };
    const result = await handleLead({ tenant: 'vvslab', configVersion: 0, name: 'Ava', contact: '@ava.test', spec, preview: '', photo: false, elapsedMs: 30_000 }, '203.0.113.9', env, () => {});
    expect(result.status).toBe(200);
    const summary = (stored[0].spec as { summary: string[] }).summary;
    expect(summary).toContain('"AB" in block, diamond-cut, on upper left central incisor');
    expect(summary.some((line) => line.startsWith('"Lainee" in script, engraved with pink enamel, across 4'))).toBe(true);
    expect(summary).toContain('Crown charm on the upper right central incisor');

    const breakdown = priceBreakdown(VVSLAB_CONFIG.pricing, spec.teeth, spec, VVSLAB_CONFIG.catalog.addOns ?? []);
    const lead: LeadForEmail = { id: '5761243a-6f73-4206-8c71-0eee46349627', name: 'Ava', contact: '@ava.test', email: null, note: null, summary, price: breakdown, total: breakdown.total, deposit: null, configVersion: 0, createdAt: new Date().toISOString() };
    const email = await shopEmail({ lead, config: VVSLAB_CONFIG, origin: 'https://vvslab.magpollo.com', images: { photo: false, preview: false }, photoPending: false, test: false });
    for (const line of summary.filter((x) => x.startsWith('"') || x.includes('charm'))) {
      expect(email.text).toContain(line);
      expect(email.html).toContain(line.replace(/"/g, '&quot;'));
    }
  });
});

describe('leads CSV', () => {
  it('says whether the phone was verified', () => {
    const row = (patch: Partial<LeadRow>): LeadRow => ({
      id: 'a',
      created_at: '2026-11-24T10:00:00Z',
      name: 'Ava',
      contact: '+14045550199',
      email: null,
      note: null,
      status: 'new',
      total: 2000,
      deposit: null,
      render_status: 'none',
      notified_at: null,
      preview_path: null,
      photo_path: null,
      spec: { summary: ['6 top + 6 bottom'] },
      source: {},
      promo: null,
      phone_verified: false,
      ...patch,
    });
    const csv = leadsCsv([row({ phone_verified: true }), row({ contact: '@ava.test' })], []).split('\r\n');
    expect(csv[0]).toContain('"Contact","Phone verified","Email"');
    expect(csv[1]).toContain('"(404) 555-0199","Yes"');
    expect(csv[2]).toContain('"\'@ava.test","No"');
  });
});
