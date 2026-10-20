// The one-time token in our emailed sign-in links (/dashboard/welcome?token_hash=…).
// Imported first in main.tsx: it takes the token out of the address bar before
// analytics, session replay or the router ever see the URL, and keeps it in
// memory for the welcome page to spend.

export type EmailSignIn = { tokenHash: string; type: 'invite' | 'magiclink'; shop: string };

let pending: EmailSignIn | null = null;

type UrlLike = { pathname: string; search: string };
type HistoryLike = { state: unknown; replaceState: (state: unknown, unused: string, url: string) => void };

export function captureEmailSignIn(location: UrlLike, history: HistoryLike) {
  if (location.pathname.replace(/\/$/, '') !== '/dashboard/welcome') return;
  const params = new URLSearchParams(location.search);
  const tokenHash = params.get('token_hash');
  const type = params.get('type');
  if (tokenHash && (type === 'invite' || type === 'magiclink')) pending = { tokenHash, type, shop: params.get('shop') ?? '' };
  if (location.search) history.replaceState(history.state, '', '/dashboard/welcome');
}

/** The captured link, once. */
export function takeEmailSignIn(): EmailSignIn | null {
  const value = pending;
  pending = null;
  return value;
}

/** Removes a sign-in or claim token from any URL-like string (analytics guard). */
export const scrubToken = (value: unknown) =>
  typeof value === 'string' ? value.replace(/([?&])token_hash=[^&#]*/g, '$1token_hash=redacted').replace(/\/claim\/[A-Za-z0-9_-]+/g, '/claim/redacted') : value;

// Claim links (/claim/<token>): the token moves to this tab's storage and the
// address bar shows /claim, so analytics never sees it. Unlike a sign-in token
// it stays usable until the shop is claimed, so a refresh in the same tab works.
const CLAIM_KEY = 'vvs-claim-token';
type StorageLike = { getItem: (key: string) => string | null; setItem: (key: string, value: string) => void };

export function captureClaimToken(location: UrlLike, history: HistoryLike, storage: StorageLike | null) {
  const match = location.pathname.match(/^\/claim\/([A-Za-z0-9_-]{32})\/?$/);
  if (!match) return;
  try {
    storage?.setItem(CLAIM_KEY, match[1]);
  } catch {
    // Storage blocked (private mode): the page reads it from memory instead.
  }
  claimInMemory = match[1];
  history.replaceState(history.state, '', '/claim');
}

let claimInMemory: string | null = null;
/** The claim token for this tab, if one was opened. */
export function claimToken(storage: StorageLike | null = safeSession()): string | null {
  if (claimInMemory) return claimInMemory;
  try {
    return storage?.getItem(CLAIM_KEY) ?? null;
  } catch {
    return null;
  }
}

function safeSession(): StorageLike | null {
  try {
    return globalThis.sessionStorage ?? null;
  } catch {
    return null;
  }
}

const browser = globalThis as { location?: UrlLike; history?: HistoryLike };
if (browser.location && browser.history) {
  captureEmailSignIn(browser.location, browser.history);
  captureClaimToken(browser.location, browser.history, safeSession());
}
