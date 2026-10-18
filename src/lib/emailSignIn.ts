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

/** Removes a sign-in token from any URL-like string (analytics guard). */
export const scrubToken = (value: unknown) => (typeof value === 'string' ? value.replace(/([?&])token_hash=[^&#]*/g, '$1token_hash=redacted') : value);

const browser = globalThis as { location?: UrlLike; history?: HistoryLike };
if (browser.location && browser.history) captureEmailSignIn(browser.location, browser.history);
