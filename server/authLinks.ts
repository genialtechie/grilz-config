import type { Db } from './db.js';

// Sign-in links we email ourselves (signup welcome, team invites).
// GoTrue's admin generate_link returns an implicit-flow link (session in the URL
// #hash), which the browser client ignores because it runs in PKCE mode. So we
// take the link's hashed_token and send people to our own page,
// /dashboard/welcome?token_hash=…&type=…, which signs them in with verifyOtp.
// The token is spent only when that page's script runs, not by a link
// scanner's GET, and the email shows our domain, not the Supabase project's.

type LinkFields = {
  id?: string;
  action_link?: string;
  hashed_token?: string;
  verification_type?: string;
  email_confirmed_at?: string | null;
  invited_at?: string | null;
  last_sign_in_at?: string | null;
};
type LinkResponse = LinkFields & { properties?: LinkFields; user?: LinkFields };

export type SignInLink = { ok: true; url: string; userId: string } | { ok: false; reason: 'auth' | 'untrusted' };

const SLUG = /^[a-z0-9](?:[a-z0-9-]{0,38}[a-z0-9])?$/;

/** Our sign-in page for a token. `shop` is where to land afterwards. */
export function welcomeUrl(origin: string, tokenHash: string, type: 'invite' | 'magiclink', shop?: string) {
  const params = new URLSearchParams({ token_hash: tokenHash, type });
  if (shop && SLUG.test(shop)) params.set('shop', shop);
  return `${origin.replace(/\/$/, '')}/dashboard/welcome?${params}`;
}

/**
 * A one-time sign-in link for this email: an invite for a new account, a magic
 * link for an existing one. Refused ('untrusted') for an account that exists but
 * was never used by its owner, so a pre-registered address can't be taken over.
 */
export async function signInLink(db: Db, email: string, origin: string, shop?: string): Promise<SignInLink> {
  const redirect = `${origin.replace(/\/$/, '')}/dashboard`;
  let result = await db.authAdmin<LinkResponse>('generate_link', { type: 'invite', email, redirect_to: redirect });
  let existing = false;
  if (!result.ok && (result.status === 422 || /already/i.test(result.message))) {
    existing = true;
    result = await db.authAdmin<LinkResponse>('generate_link', { type: 'magiclink', email, redirect_to: redirect });
  }
  if (!result.ok) return { ok: false, reason: 'auth' };
  const data = result.data;
  const user = data.user ?? data;
  const tokenHash = data.hashed_token ?? data.properties?.hashed_token;
  const type = (data.verification_type ?? data.properties?.verification_type) === 'invite' ? 'invite' : 'magiclink';
  if (!user.id || !tokenHash) return { ok: false, reason: 'auth' };
  // A brand-new invited account, or an account its owner has actually used.
  const trusted = existing ? Boolean(user.last_sign_in_at && user.email_confirmed_at) : Boolean(user.invited_at && !user.email_confirmed_at) || Boolean(user.last_sign_in_at);
  if (!trusted) return { ok: false, reason: 'untrusted' };
  return { ok: true, url: welcomeUrl(origin, tokenHash, existing ? 'magiclink' : type, shop), userId: user.id };
}
