import { welcomeUrl } from './authLinks.js';
import type { AuthUser, Db } from './db.js';
import { sendEmail, type EmailEnv } from './email.js';
import { confirmEmail } from './emailTemplates.js';

// Signing in on the device that signs up (MAG-91), and confirming the email later.
//
// A new account from signup or a claim link is signed in right there: the
// server spends its one-time token and hands the phone the session. Nothing
// has proved the email yet, and design requests go to it, so the account is
// marked unconfirmed (app_metadata, which only the server can change) along
// with that first session's id. Every other way in comes through the inbox:
// the welcome or confirm email's link or 6-digit code, or a sign-in from
// another device. So a session other than the first one confirms the email.
// Until then payouts, team invites and custom domains stay locked, the
// account joins no other shop's team (accept_member_invites), and the first
// session ends once the email is confirmed elsewhere: whoever signed up with
// an address that isn't theirs is signed out when its owner shows up.

const UNCONFIRMED = 'email_unconfirmed';
const DEVICE = 'device_session';
const SENT = 'confirm_sent_at';
/** Gap between confirm emails, so the Resend button can't be used to spam an inbox. */
export const RESEND_GAP_MS = 60_000;

export const emailUnconfirmed = (user: Pick<AuthUser, 'app_metadata'>) => user.app_metadata?.[UNCONFIRMED] === true;

/** The session a Supabase access token belongs to (its `session_id` claim). The token was checked by the caller. */
export function sessionIdOf(accessToken: string): string | null {
  try {
    const claims = JSON.parse(Buffer.from(accessToken.split('.')[1] ?? '', 'base64url').toString('utf8')) as { session_id?: unknown };
    return typeof claims.session_id === 'string' ? claims.session_id : null;
  } catch {
    return null;
  }
}

/**
 * Spends a brand-new account's sign-in link here and returns the session for
 * the phone, marking the email unconfirmed. Only for accounts this request
 * just created: an existing account is never signed in from a form.
 */
export async function signInOnDevice(db: Db, signInUrl: string): Promise<{ access_token: string; refresh_token: string } | null> {
  const params = new URL(signInUrl).searchParams;
  const tokenHash = params.get('token_hash');
  const type = params.get('type');
  if (!tokenHash || (type !== 'invite' && type !== 'magiclink')) return null;
  const session = await db.authVerify(tokenHash, type);
  const device = session ? sessionIdOf(session.access_token) : null;
  if (!session || !device) return null;
  await db.authUpdateAppMetadata(session.user.id, { [UNCONFIRMED]: true, [DEVICE]: device });
  return { access_token: session.access_token, refresh_token: session.refresh_token };
}

/** A sign-in link and its 6-digit code for an email (Supabase's own one-time code: it expires with the link and works once). */
export async function emailSignIn(db: Db, email: string, origin: string, shop?: string): Promise<{ url: string; code: string } | null> {
  const result = await db.authAdmin<{ hashed_token?: string; email_otp?: string; properties?: { hashed_token?: string; email_otp?: string } }>('generate_link', { type: 'magiclink', email, redirect_to: `${origin.replace(/\/$/, '')}/dashboard` });
  if (!result.ok) return null;
  const tokenHash = result.data.hashed_token ?? result.data.properties?.hashed_token;
  const code = result.data.email_otp ?? result.data.properties?.email_otp;
  return tokenHash && code ? { url: welcomeUrl(origin, tokenHash, 'magiclink', shop), code } : null;
}

/** Ends a user's sign-in sessions: one, or all of them. */
export const endSessions = (db: Db, userId: string, sessionId: string | null = null) => db.rpc<number>('end_auth_sessions', { target_user: userId, target_session: sessionId });

/**
 * Whether the user's email is confirmed, confirming it now if this request
 * comes from a session other than the first one (which then ends).
 */
export async function checkEmailConfirmed(db: Db, user: AuthUser, accessToken: string): Promise<boolean> {
  if (!emailUnconfirmed(user)) return true;
  const device = user.app_metadata?.[DEVICE];
  const current = sessionIdOf(accessToken);
  if (!current || current === device) return false;
  if (typeof device === 'string') await endSessions(db, user.id, device);
  await db.authUpdateAppMetadata(user.id, { [UNCONFIRMED]: false, [DEVICE]: null });
  return true;
}

/** Emails a fresh confirm link and code (the dashboard's Resend button). */
export async function resendConfirmation(db: Db, user: AuthUser, env: EmailEnv & { PUBLIC_ORIGIN?: string }, shop?: string): Promise<'sent' | 'confirmed' | 'wait' | 'failed'> {
  if (!emailUnconfirmed(user)) return 'confirmed';
  if (!user.email) return 'failed';
  const last = Number(user.app_metadata?.[SENT] ?? 0);
  if (Date.now() - last < RESEND_GAP_MS) return 'wait';
  const origin = (env.PUBLIC_ORIGIN || 'https://vvslab.magpollo.com').replace(/\/$/, '');
  const link = await emailSignIn(db, user.email, origin, shop);
  if (!link) return 'failed';
  await db.authUpdateAppMetadata(user.id, { [SENT]: Date.now() });
  const email = await confirmEmail({ link: link.url, code: link.code, origin });
  const sent = await sendEmail({ fromName: 'VVS Lab', fromLocal: 'hello', to: [user.email], ...email }, env);
  return sent.ok ? 'sent' : 'failed';
}
