import { afterEach, describe, expect, it, vi } from 'vitest';
import { checkSlug, handleSignup, slugFromName } from '../signup';

afterEach(() => vi.unstubAllGlobals());

describe('signup', () => {
  it('turns shop names into links', () => {
    expect(slugFromName('Gold Mouth Jewelers!')).toBe('gold-mouth-jewelers');
    expect(slugFromName('Halo & Fang')).toBe('halo-and-fang');
    expect(slugFromName('Café Grillz')).toBe('cafe-grillz');
  });

  it('refuses reserved and malformed links', () => {
    expect(checkSlug('admin')).toMatch(/reserved/);
    expect(checkSlug('vvslab')).toMatch(/reserved/);
    expect(checkSlug('ab')).toBeTruthy();
    expect(checkSlug('-bad-')).toBeTruthy();
    expect(checkSlug('gold-mouth')).toBeNull();
  });

  it('validates input before touching anything', async () => {
    const fetch = vi.fn();
    vi.stubGlobal('fetch', fetch);
    const env = { SUPABASE_URL: 'https://db.test', SUPABASE_SERVICE_ROLE_KEY: 'k' };
    const base = { name: 'Gold Mouth', email: 'owner@goldmouth.com', slug: 'gold-mouth', terms: true, elapsedMs: 10_000 };
    expect((await handleSignup({ ...base, email: 'nope' }, '1.2.3.4', env)).status).toBe(400);
    expect((await handleSignup({ ...base, slug: 'admin' }, '1.2.3.4', env)).status).toBe(400);
    expect((await handleSignup({ ...base, terms: false }, '1.2.3.4', env)).status).toBe(400);
    expect((await handleSignup({ ...base, instagram: 'bad handle!' }, '1.2.3.4', env)).status).toBe(400);
    expect(fetch).not.toHaveBeenCalled();
  });

  it('a bot gets the normal answer and nothing is created', async () => {
    const calls: string[] = [];
    vi.stubGlobal('fetch', vi.fn(async (input: string | URL | Request, init?: RequestInit) => {
      calls.push(`${init?.method ?? 'GET'} ${String(input)}`);
      return Response.json([{}]);
    }));
    const env = { SUPABASE_URL: 'https://db.test', SUPABASE_SERVICE_ROLE_KEY: 'k' };
    const result = await handleSignup({ name: 'Gold Mouth', email: 'owner@goldmouth.com', slug: 'gold-mouth', terms: true, website: 'spam.com', elapsedMs: 10_000 }, '1.2.3.4', env);
    expect(result).toMatchObject({ status: 200, body: { ok: true } });
    expect(calls.every((call) => call.includes('/signup_attempts'))).toBe(true);
  });
});
