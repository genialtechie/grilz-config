// Phone codes for shoppers (owner's pick: Firebase phone auth, about $7 per 1,000 sign-ups).
// startPhoneCode texts a 6-digit code (an invisible reCAPTCHA runs first); confirmPhoneCode checks it and
// returns the Firebase ID token, which the server verifies (server/phoneAuth.ts) to read the phone.
// The Firebase SDK is loaded only when a code is needed, so the builder doesn't carry it.
//
// Without VITE_FIREBASE_* (local dev), any 6 digits pass and the token is "dev:<phone>", which the server
// accepts only when ALLOW_DEV_PHONE=1. The exported signatures are the contract between tracks.

import { normaliseContact } from './contact';

export type PhoneStart = { ok: true } | { ok: false; error: string };
export type PhoneConfirm = { ok: true; token: string; phone: string } | { ok: false; error: string };

const KEY = 'vvs-verified-phone';

const config = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID,
};
const firebaseOn = () => Boolean(config.apiKey && config.projectId);

/** +14045550199 from whatever they typed, or null for anything but a US number. */
const e164 = (phone: string) => {
  const contact = normaliseContact(phone);
  return contact?.kind === 'phone' ? contact.value : null;
};

type Firebase = { auth: import('firebase/auth').Auth; sdk: typeof import('firebase/auth') };
let loading: Promise<Firebase> | null = null;

const firebase = () =>
  (loading ??= (async () => {
    const [{ initializeApp, getApps }, sdk] = await Promise.all([import('firebase/app'), import('firebase/auth')]);
    const app = getApps()[0] ?? initializeApp(config);
    const auth = sdk.getAuth(app);
    auth.useDeviceLanguage();
    return { auth, sdk };
  })().catch((error) => {
    loading = null;
    throw error;
  }));

let pending: { phone: string; confirmation: import('firebase/auth').ConfirmationResult } | null = null;
let verifier: import('firebase/auth').RecaptchaVerifier | null = null;

/** Firebase's error codes, in the shopper's words. */
const say = (error: unknown, fallback: string) => {
  const code = (error as { code?: string })?.code ?? '';
  if (code === 'auth/invalid-phone-number') return 'Check your phone number.';
  if (code === 'auth/too-many-requests' || code === 'auth/quota-exceeded') return 'Too many tries. Wait a few minutes and try again.';
  if (code === 'auth/invalid-verification-code') return "That code didn't match. Check it and try again.";
  if (code === 'auth/code-expired' || code === 'auth/missing-verification-id') return 'That code expired. Send a new one.';
  if (code === 'auth/network-request-failed') return 'No connection. Try again.';
  if (code.includes('captcha')) return "We couldn't check this device. Reload and try again.";
  return fallback;
};

export async function startPhoneCode(phone: string): Promise<PhoneStart> {
  const number = e164(phone);
  if (!number) return { ok: false, error: 'Add your 10-digit phone number.' };
  if (!firebaseOn()) {
    // Only `npm run dev` may fake the text; a deployed build without the Firebase keys says so instead of
    // pretending a code went out (it happened on the preview built before the keys were added, Nov 26).
    if (import.meta.env.DEV) return { ok: true };
    console.error('Phone codes: VITE_FIREBASE_* were missing when this site was built. Add them in Vercel and redeploy.');
    return { ok: false, error: "We can't text codes right now. Please try again later." };
  }
  try {
    const { auth, sdk } = await firebase();
    if (!verifier) {
      // Invisible reCAPTCHA needs an element on the page; it never shows unless Google asks for a challenge.
      const holder = document.createElement('div');
      holder.style.cssText = 'position:fixed;bottom:0;left:0;z-index:2147483647';
      document.body.appendChild(holder);
      verifier = new sdk.RecaptchaVerifier(auth, holder, { size: 'invisible' });
    }
    pending = { phone: number, confirmation: await sdk.signInWithPhoneNumber(auth, number, verifier) };
    return { ok: true };
  } catch (error) {
    // A used-up reCAPTCHA can't be run again: start fresh next time.
    verifier?.clear();
    verifier = null;
    return { ok: false, error: say(error, "We couldn't send the code. Try again.") };
  }
}

export async function confirmPhoneCode(phone: string, code: string): Promise<PhoneConfirm> {
  if (!/^\d{6}$/.test(code)) return { ok: false, error: 'Enter the 6-digit code.' };
  const number = e164(phone);
  if (!number) return { ok: false, error: 'Add your 10-digit phone number.' };
  let token: string;
  if (!firebaseOn()) {
    token = `dev:${number.slice(2)}`;
  } else {
    if (!pending || pending.phone !== number) return { ok: false, error: 'Send a code to this number first.' };
    try {
      const credential = await pending.confirmation.confirm(code);
      token = await credential.user.getIdToken();
      pending = null;
    } catch (error) {
      return { ok: false, error: say(error, "That code didn't work. Try again.") };
    }
  }
  try {
    localStorage.setItem(KEY, JSON.stringify({ phone, token }));
  } catch {
    /* private mode */
  }
  return { ok: true, token, phone };
}

/** A phone already verified on this device skips the code. Its token may be old: see freshPhoneToken. */
export function rememberedPhone(): { phone: string; token: string } | null {
  try {
    const v = localStorage.getItem(KEY);
    return v ? (JSON.parse(v) as { phone: string; token: string }) : null;
  } catch {
    return null;
  }
}

/** Seconds since 1970 when a Firebase ID token expires (they last an hour), or 0. */
const expiresAt = (token: string) => {
  try {
    const payload = JSON.parse(atob(token.split('.')[1].replace(/-/g, '+').replace(/_/g, '/'))) as { exp?: number };
    return payload.exp ?? 0;
  } catch {
    return 0;
  }
};

/**
 * A current token for the remembered phone: the stored one while it has 5+ minutes left, else a new one
 * from Firebase (the sign-in stays on the device). Null when the phone needs a new code.
 */
export async function freshPhoneToken(): Promise<string | null> {
  const remembered = rememberedPhone();
  if (!remembered) return null;
  if (remembered.token.startsWith('dev:') || expiresAt(remembered.token) * 1000 > Date.now() + 5 * 60_000) return remembered.token;
  if (!firebaseOn()) return null;
  try {
    const { auth } = await firebase();
    await auth.authStateReady();
    const user = auth.currentUser;
    if (!user || !user.phoneNumber || user.phoneNumber !== e164(remembered.phone)) return null;
    const token = await user.getIdToken();
    localStorage.setItem(KEY, JSON.stringify({ phone: remembered.phone, token }));
    return token;
  } catch {
    return null;
  }
}

/** Forget the verified phone on this device (when the server says it's no longer verified). */
export function forgetPhone() {
  try {
    localStorage.removeItem(KEY);
  } catch {
    /* private mode */
  }
}
