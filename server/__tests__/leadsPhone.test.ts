import { afterEach, describe, expect, it, vi } from 'vitest';
import { DESIGNS } from '../../src/lib/__tests__/designs';
import { handleLead, leadContact } from '../leads';
import type { TokenVerifier } from '../phoneAuth';

// Leads with a verified phone (redesign, Nov 17): a first name and a phone
// proved by a texted code are enough; Instagram is optional. Older clients
// that type an Instagram handle or phone keep working. The database is
// stubbed at the network edge.

const firebase = { FIREBASE_PROJECT_ID: 'vvs-test' };
const phoneSignIn: TokenVerifier = async () => ({ phone_number: '+14045550199', firebase: { sign_in_provider: 'phone' } });
const expired: TokenVerifier = async () => {
  throw new Error('Firebase ID token has expired');
};

describe('who the shop reaches', () => {
  it('uses the verified phone when a token comes with the lead', async () => {
    expect(await leadContact({ phoneToken: 'eyJ.t', contact: '' }, firebase, phoneSignIn)).toEqual({ ok: true, kind: 'phone', value: '+14045550199', verified: true });
    // A typed number can't replace the verified one; a handle rides along.
    expect(await leadContact({ phoneToken: 'eyJ.t', contact: '(212) 555-0100' }, firebase, phoneSignIn)).toMatchObject({ value: '+14045550199' });
    expect(await leadContact({ phoneToken: 'eyJ.t', contact: '@ava.test' }, firebase, phoneSignIn)).toMatchObject({ value: '+14045550199', instagram: '@ava.test' });
  });

  it('refuses a token that does not verify, rather than falling back to what was typed', async () => {
    const result = await leadContact({ phoneToken: 'eyJ.t', contact: '@ava.test' }, firebase, expired);
    expect(result).toMatchObject({ ok: false, result: { status: 401, body: { code: 'unverified' } } });
    expect(await leadContact({ phoneToken: 'dev:4045550199', contact: '' }, {})).toMatchObject({ ok: false });
  });

  it('keeps the old behaviour without a token', async () => {
    expect(await leadContact({ contact: '@Ava.Test' }, firebase)).toEqual({ ok: true, kind: 'instagram', value: '@ava.test', verified: false });
    expect(await leadContact({ contact: '404 555 0199' }, firebase)).toEqual({ ok: true, kind: 'phone', value: '+14045550199', verified: false });
    expect(await leadContact({ contact: 'call me' }, firebase)).toMatchObject({ ok: false, result: { status: 400 } });
  });
});

describe('POST /api/leads with a phone token', () => {
  afterEach(() => vi.unstubAllGlobals());

  const stubDb = () => {
    const leads: Record<string, unknown>[] = [];
    vi.stubGlobal(
      'fetch',
      vi.fn(async (input: string | URL | Request, init?: RequestInit) => {
        const url = String(input);
        if (url.includes('/rest/v1/rpc/create_lead')) {
          leads.push((JSON.parse(String(init?.body)) as { lead: Record<string, unknown> }).lead);
          return new Response('"ok"', { status: 200 });
        }
        if (url.includes('/rest/v1/tenants')) return Response.json([{ id: 'eae3e55c-610b-47d4-b5cc-665289f37eb9' }]);
        return Response.json([]);
      }),
    );
    return leads;
  };
  const env = { ...firebase, SUPABASE_URL: 'http://db.test', SUPABASE_SERVICE_ROLE_KEY: 'k', LEAD_TOKEN_SECRET: 's' };
  const lead = (patch: Record<string, unknown>) => ({ tenant: 'vvslab', configVersion: 0, name: 'Ava', spec: DESIGNS.plain6x6, preview: '', photo: false, elapsedMs: 30_000, ...patch });

  it('stores the verified phone as the contact and marks it verified', async () => {
    const leads = stubDb();
    const result = await handleLead(lead({ contact: '', phoneToken: 'eyJ.t' }), '203.0.113.9', env, () => {}, phoneSignIn);
    expect(result.status).toBe(200);
    expect(leads[0]).toMatchObject({ name: 'Ava', contact: '+14045550199', phone_verified: true, event: { contact_kind: 'phone', phone_verified: true } });
  });

  it('turns away an expired code before storing anything', async () => {
    const leads = stubDb();
    const result = await handleLead(lead({ contact: '', phoneToken: 'eyJ.t' }), '203.0.113.9', env, () => {}, expired);
    expect(result).toMatchObject({ status: 401, body: { code: 'unverified' } });
    expect(leads).toEqual([]);
  });

  it('still takes an Instagram handle from older clients, unverified', async () => {
    const leads = stubDb();
    const result = await handleLead(lead({ contact: '@ava.test' }), '203.0.113.9', env, () => {});
    expect(result.status).toBe(200);
    expect(leads[0]).toMatchObject({ contact: '@ava.test', phone_verified: false });
  });
});
