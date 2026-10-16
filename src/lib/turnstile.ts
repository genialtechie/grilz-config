/** Cloudflare Turnstile site key; empty when Turnstile isn't set up. */
export const TURNSTILE_SITE_KEY = (import.meta.env.VITE_TURNSTILE_SITE_KEY as string | undefined) ?? '';
