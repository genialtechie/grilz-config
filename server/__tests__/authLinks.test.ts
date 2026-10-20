import { afterEach, describe, expect, it, vi } from 'vitest';
import { signInLink, welcomeUrl } from '../authLinks';
import type { Db } from '../db';
import { sendEmail } from '../email';
import { friendlyAuthError } from '../../src/admin/supabase';

type AuthResult = { ok: true; data: Record<string, unknown> } | { ok: false; status: number; message: string };
const fakeDb = (results: AuthResult[]) => {
  const calls: Record<string, unknown>[] = [];
  const db = { authAdmin: async (_path: string, body: Record<string, unknown>) => { calls.push(body); return results.shift()!; } } as unknown as Db;
  return { db, calls };
};
const HASH = 'a'.repeat(56);

afterEach(() => vi.unstubAllGlobals());

describe('emailed sign-in links', () => {
  it('point at our welcome page with the hashed token, never at Supabase', async () => {
    const { db } = fakeDb([{ ok: true, data: { id: 'u1', action_link: 'https://x.supabase.co/auth/v1/verify?token=t#', hashed_token: HASH, verification_type: 'invite', invited_at: '2026-10-18T00:00:00Z', email_confirmed_at: null } }]);
    const link = await signInLink(db, 'new@shop.test', 'https://vvslab.magpollo.com/', 'gold-mouth');
    expect(link).toEqual({ ok: true, userId: 'u1', existing: false, url: `https://vvslab.magpollo.com/dashboard/welcome?token_hash=${HASH}&type=invite&shop=gold-mouth` });
  });

  it('uses a magic link for an account its owner has used', async () => {
    const { db, calls } = fakeDb([
      { ok: false, status: 422, message: 'A user with this email address has already been registered' },
      { ok: true, data: { user: { id: 'u2', last_sign_in_at: '2026-10-01T00:00:00Z', email_confirmed_at: '2026-10-01T00:00:00Z' }, properties: { hashed_token: HASH, verification_type: 'magiclink' } } },
    ]);
    const link = await signInLink(db, 'owner@shop.test', 'https://vvslab.magpollo.com', 'gold-mouth');
    expect(calls.map((call) => call.type)).toEqual(['invite', 'magiclink']);
    expect(link.ok && new URL(link.url).searchParams.get('type')).toBe('magiclink');
    // So a claim never signs a phone into an account that was already there.
    expect(link.ok && link.existing).toBe(true);
  });

  it("refuses an account that exists but its owner never used", async () => {
    const { db } = fakeDb([
      { ok: false, status: 422, message: 'already registered' },
      { ok: true, data: { id: 'u3', hashed_token: HASH, verification_type: 'magiclink', last_sign_in_at: null, email_confirmed_at: '2026-10-01T00:00:00Z' } },
    ]);
    expect(await signInLink(db, 'squatted@shop.test', 'https://vvslab.magpollo.com')).toEqual({ ok: false, reason: 'untrusted' });
  });

  it('reports an auth failure, or a response without a token', async () => {
    expect(await signInLink(fakeDb([{ ok: false, status: 500, message: 'down' }]).db, 'a@shop.test', 'https://o.test')).toEqual({ ok: false, reason: 'auth' });
    expect(await signInLink(fakeDb([{ ok: true, data: { id: 'u4', invited_at: 'x' } }]).db, 'a@shop.test', 'https://o.test')).toEqual({ ok: false, reason: 'auth' });
  });

  it('only carries a valid shop slug', () => {
    expect(welcomeUrl('https://o.test', HASH, 'invite', '../admin')).toBe(`https://o.test/dashboard/welcome?token_hash=${HASH}&type=invite`);
  });
});

describe('account email sender', () => {
  it('sends account mail from hello@ and lead mail from leads@', async () => {
    const froms: string[] = [];
    vi.stubGlobal('fetch', vi.fn(async (_input: unknown, init?: RequestInit) => {
      froms.push(JSON.parse(String(init?.body)).from);
      return Response.json({ id: 'e1' });
    }));
    const env = { RESEND_API_KEY: 'test', RESEND_BASE_URL: 'https://resend.test' };
    await sendEmail({ fromName: 'VVS Lab', fromLocal: 'hello', to: ['a@test.com'], subject: 's', html: 'h', text: 't' }, env);
    await sendEmail({ fromName: 'Gold via VVS Lab', to: ['a@test.com'], subject: 's', html: 'h', text: 't' }, env);
    expect(froms).toEqual(['VVS Lab <hello@vvslab.magpollo.com>', 'Gold via VVS Lab <leads@vvslab.magpollo.com>']);
  });
});

describe('sign-in form errors', () => {
  it("replaces Supabase's rate-limit message", () => {
    expect(friendlyAuthError('For security purposes, you can only request this after 16 seconds.')).toBe('We just sent a link. Check your email, or try again in a minute.');
    expect(friendlyAuthError('Email rate limit exceeded')).toBe('We just sent a link. Check your email, or try again in a minute.');
    expect(friendlyAuthError('Something else')).toBe('Something else');
  });
});

describe('emailed token never reaches analytics', () => {
  it('is taken out of the URL at startup and handed to the welcome page once', async () => {
    const { captureEmailSignIn, takeEmailSignIn } = await import('../../src/lib/emailSignIn');
    const replaced: string[] = [];
    const location = { pathname: '/dashboard/welcome', search: `?token_hash=${HASH}&type=magiclink&shop=gold` };
    const history = { state: null, replaceState: (_s: unknown, _t: string, next: string) => void replaced.push(next) };
    captureEmailSignIn(location, history);
    expect(replaced).toEqual(['/dashboard/welcome']);
    expect(takeEmailSignIn()).toEqual({ tokenHash: HASH, type: 'magiclink', shop: 'gold' });
    expect(takeEmailSignIn()).toBeNull();
  });

  it('scrubs a token from URLs in analytics events', async () => {
    const { scrubToken } = await import('../../src/lib/emailSignIn');
    expect(scrubToken(`https://vvslab.magpollo.com/dashboard/welcome?token_hash=${HASH}&type=invite`)).toBe('https://vvslab.magpollo.com/dashboard/welcome?token_hash=redacted&type=invite');
    expect(scrubToken(42)).toBe(42);
  });
});

describe('claim links never reach analytics', () => {
  const TOKEN = 'AbCdEfGhIjKlMnOpQrStUvWxYz012345';
  it('moves the token out of the address bar into this tab, so a refresh still works', async () => {
    const { captureClaimToken, claimToken } = await import('../../src/lib/emailSignIn');
    const replaced: string[] = [];
    const stored = new Map<string, string>();
    const storage = { getItem: (key: string) => stored.get(key) ?? null, setItem: (key: string, value: string) => void stored.set(key, value) };
    captureClaimToken({ pathname: `/claim/${TOKEN}`, search: '' }, { state: null, replaceState: (_s: unknown, _t: string, next: string) => void replaced.push(next) }, storage);
    expect(replaced).toEqual(['/claim']);
    expect(claimToken(storage)).toBe(TOKEN);
    expect([...stored.values()]).toEqual([TOKEN]);
    // Other pages are left alone.
    captureClaimToken({ pathname: '/claim/short', search: '' }, { state: null, replaceState: () => void replaced.push('x') }, storage);
    expect(replaced).toEqual(['/claim']);
  });

  it('scrubs a claim token from URLs in analytics events', async () => {
    const { scrubToken } = await import('../../src/lib/emailSignIn');
    expect(scrubToken(`https://vvslab.magpollo.com/claim/${TOKEN}`)).toBe('https://vvslab.magpollo.com/claim/redacted');
  });
});

describe('claiming a shop', () => {
  it('checks the email and the human check before touching the database', async () => {
    const { handleClaim } = await import('../claims');
    const fetch = vi.fn();
    vi.stubGlobal('fetch', fetch);
    const env = { SUPABASE_URL: 'https://db.test', SUPABASE_SERVICE_ROLE_KEY: 'service', TURNSTILE_SECRET_KEY: 'secret' };
    expect(await handleClaim({ claim: 'x'.repeat(32), email: 'not-an-email' }, '1.2.3.4', env)).toMatchObject({ status: 400, body: { field: 'email' } });
    fetch.mockResolvedValueOnce(Response.json({ success: false }));
    expect(await handleClaim({ claim: 'x'.repeat(32), email: 'owner@shop.test' }, '1.2.3.4', env)).toMatchObject({ status: 400, body: { error: 'verify' } });
    expect(fetch.mock.calls.every(([url]) => !String(url).includes('db.test'))).toBe(true);
    vi.unstubAllGlobals();
  });

  it('welcomes a claimed shop without the signup wording', async () => {
    const { welcomeEmail } = await import('../emailTemplates');
    const onPhone = await welcomeEmail({ shop: 'Gold Mouth', slug: 'gold-mouth', link: 'https://vvslab.magpollo.com/dashboard/gold-mouth', origin: 'https://vvslab.magpollo.com', trialDays: 14, claimed: true, oneTime: false });
    expect(onPhone.subject).toBe('Gold Mouth is yours on VVS Lab');
    expect(onPhone.html).toContain('Open my dashboard');
    expect(onPhone.html).not.toContain('works once');
    expect(onPhone.html).not.toContain("Didn't sign up");
    const byEmail = await welcomeEmail({ shop: 'Gold Mouth', slug: 'gold-mouth', link: 'https://vvslab.magpollo.com/dashboard/welcome?token_hash=x', origin: 'https://vvslab.magpollo.com', trialDays: 14, claimed: true });
    expect(byEmail.html).toContain('works once');
  });
});
