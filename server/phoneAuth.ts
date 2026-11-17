import { createHash } from 'node:crypto';

// Verified phones for shoppers (owner's pick, Nov 17: Firebase phone auth). The
// browser signs in with a texted code (src/lib/phoneAuth.ts) and sends the
// Firebase ID token; this checks it with firebase-admin and reads the phone
// Firebase verified. firebase-admin is loaded only when a token is checked, so
// the functions that never see one don't pay for it at cold start.
//
// Dev mode: without Firebase, tokens "dev:<10 digits>" pass when
// ALLOW_DEV_PHONE=1, never on a Vercel production deployment.

export type PhoneEnv = {
  /** The service account JSON from Firebase (Project settings, Service accounts). */
  FIREBASE_SERVICE_ACCOUNT?: string;
  /** Enough on its own to check ID tokens (they are signed by Google; no secret needed). */
  FIREBASE_PROJECT_ID?: string;
  ALLOW_DEV_PHONE?: string;
  VERCEL_ENV?: string;
  /** Salt for the stored phone hash (falls back to LEAD_TOKEN_SECRET, then the service key). */
  PHONE_HASH_SECRET?: string;
  LEAD_TOKEN_SECRET?: string;
  SUPABASE_SERVICE_ROLE_KEY?: string;
};

export type PhoneCheck = { ok: true; phone: string; dev: boolean } | { ok: false; reason: 'missing' | 'invalid' | 'not_phone' | 'unconfigured' };

/** What a verified Firebase ID token says (the fields used here). */
export type DecodedPhoneToken = { phone_number?: string; firebase?: { sign_in_provider?: string } };
export type TokenVerifier = (token: string) => Promise<DecodedPhoneToken>;

const E164 = /^\+[1-9]\d{6,14}$/;
const MAX_TOKEN = 4096;

const devAllowed = (env: PhoneEnv) => env.ALLOW_DEV_PHONE === '1' && env.VERCEL_ENV !== 'production';
export const firebaseConfigured = (env: PhoneEnv) => Boolean(env.FIREBASE_SERVICE_ACCOUNT || env.FIREBASE_PROJECT_ID);

/** "dev:4045550199" (or 1 + 10 digits) as +14045550199. */
const devPhone = (token: string): string | null => {
  const match = token.match(/^dev:\+?1?(\d{10})$/);
  return match ? `+1${match[1]}` : null;
};

let cached: { key: string; verify: TokenVerifier } | null = null;

/** The firebase-admin verifier for this env, made once per instance. */
async function adminVerifier(env: PhoneEnv): Promise<TokenVerifier> {
  const key = `${env.FIREBASE_PROJECT_ID ?? ''}|${env.FIREBASE_SERVICE_ACCOUNT ?? ''}`;
  if (cached?.key === key) return cached.verify;
  const [{ initializeApp, getApps, cert }, { getAuth }] = await Promise.all([import('firebase-admin/app'), import('firebase-admin/auth')]);
  const account = env.FIREBASE_SERVICE_ACCOUNT ? (JSON.parse(env.FIREBASE_SERVICE_ACCOUNT) as { project_id?: string }) : null;
  const projectId = env.FIREBASE_PROJECT_ID || account?.project_id;
  const name = 'vvs-phone';
  const app =
    getApps().find((existing) => existing.name === name) ??
    initializeApp({ ...(account ? { credential: cert(account as Parameters<typeof cert>[0]) } : {}), ...(projectId ? { projectId } : {}) }, name);
  const auth = getAuth(app);
  const verify: TokenVerifier = (token) => auth.verifyIdToken(token);
  cached = { key, verify };
  return verify;
}

/**
 * The phone a token proves, or why not. Never throws. `verifier` replaces
 * firebase-admin in tests.
 */
export async function verifyPhoneToken(token: unknown, env: PhoneEnv, verifier?: TokenVerifier): Promise<PhoneCheck> {
  if (typeof token !== 'string' || !token.trim()) return { ok: false, reason: 'missing' };
  if (token.length > MAX_TOKEN) return { ok: false, reason: 'invalid' };
  if (token.startsWith('dev:')) {
    const phone = devAllowed(env) ? devPhone(token) : null;
    return phone ? { ok: true, phone, dev: true } : { ok: false, reason: 'invalid' };
  }
  if (!verifier && !firebaseConfigured(env)) return { ok: false, reason: 'unconfigured' };
  try {
    const decoded = await (verifier ?? (await adminVerifier(env)))(token);
    // Only a phone sign-in proves the phone (an account linked to one later doesn't count here).
    const phone = decoded.phone_number;
    if (decoded.firebase?.sign_in_provider !== 'phone' || typeof phone !== 'string' || !E164.test(phone)) return { ok: false, reason: 'not_phone' };
    return { ok: true, phone, dev: false };
  } catch (error) {
    // Expired, forged, another project's, or a malformed service account: all mean "not verified".
    console.error('phone token rejected', error instanceof Error ? error.message.slice(0, 160) : 'unknown');
    return { ok: false, reason: 'invalid' };
  }
}

/** A salted hash of the phone, so the free-build count never stores the number itself. */
export const phoneHash = (phone: string, env: PhoneEnv) =>
  createHash('sha256')
    .update(`phone:${env.PHONE_HASH_SECRET || env.LEAD_TOKEN_SECRET || env.SUPABASE_SERVICE_ROLE_KEY || ''}:${phone}`)
    .digest('hex')
    .slice(0, 40);
