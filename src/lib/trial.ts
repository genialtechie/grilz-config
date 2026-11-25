// The free trial, shared by the server (public page gate, actions) and the dashboard.
// 14 days, card optional. When it ends without a plan, the public builder stops
// and the dashboard is locked to "Start your plan" and "Download your data".
// Claim links and owner invites start a longer trial: 30 days, the offer we make
// (MAG-220). Self-signup stays 14 unless Haleem changes it.

export const TRIAL_DAYS = 14;
/** Claim links and owner invites: the 30-day trial we promise (MAG-220). */
export const CLAIM_TRIAL_DAYS = 30;

export type TrialFields = { plan?: string | null; trial_ends_at?: string | null; trial_started_at?: string | null; billing_status?: string | null; current_period_end?: string | null };

/** On a card (trialing/active/past_due) means Stripe owns the trial from here. */
export const hasCard = (shop: TrialFields) => ['trialing', 'active', 'past_due'].includes(shop.billing_status ?? '');

/** A no-card trial that is still running. */
export const onFreeTrial = (shop: TrialFields, now = Date.now()) =>
  shop.plan === 'trial' && !hasCard(shop) && Boolean(shop.trial_ends_at) && new Date(shop.trial_ends_at as string).getTime() > now;

/** The trial ran out and no plan was started. */
export const trialExpired = (shop: TrialFields, now = Date.now()) =>
  shop.plan === 'trial' && !hasCard(shop) && Boolean(shop.trial_ends_at) && new Date(shop.trial_ends_at as string).getTime() <= now;

/** Whole days left, rounded up (0 once it's over). */
export const trialDaysLeft = (shop: TrialFields, now = Date.now()) =>
  shop.trial_ends_at ? Math.max(0, Math.ceil((new Date(shop.trial_ends_at).getTime() - now) / 864e5)) : 0;

/**
 * The trial_end to give Stripe Checkout, as a Unix timestamp. Stripe rounds the
 * time left down ("13 days free") while the dashboard rounds up ("14 days left"),
 * so this ends the Stripe trial on the dashboard's whole-day count, plus an hour
 * so Stripe's rounding lands on the same number. Null within 48 hours of the
 * end (Stripe's minimum): billing then starts right away.
 */
export const checkoutTrialEnd = (shop: TrialFields, now = Date.now()): number | null => {
  if (!shop.trial_ends_at || new Date(shop.trial_ends_at).getTime() - now <= 48 * 3600_000) return null;
  return Math.floor((now + trialDaysLeft(shop, now) * 864e5 + 3600_000) / 1000);
};

// ---------- Admin: what the shop's trial looks like from the inside ----------

/** The admin's view of a shop's status: a shop whose trial ran out reads as paused, even when the stored status still says live (the public page already gates it) or was paused by hand. */
export type AdminStatus = 'draft' | 'live' | 'paused' | 'offboarded' | 'paused-trial';
export const ADMIN_STATUS_LABEL: Record<AdminStatus, string> = { draft: 'Draft', live: 'Live', paused: 'Paused', offboarded: 'Offboarded', 'paused-trial': 'Paused (trial ended)' };

export function adminStatus(shop: TrialFields & { status: string }, now = Date.now()): AdminStatus {
  if ((shop.status === 'live' || shop.status === 'paused') && trialExpired(shop, now)) return 'paused-trial';
  return shop.status as AdminStatus;
}

export type TrialDisplay =
  | { kind: 'trial'; endsAt: string; daysLeft: number }
  | { kind: 'paid'; renewsAt: string | null }
  | { kind: 'ended'; endsAt: string }
  | { kind: 'none' };

/** What the admin shows for a shop's trial: the end date, paid, ended, or nothing yet. */
export function trialDisplay(shop: TrialFields, now = Date.now()): TrialDisplay {
  if (hasCard(shop) || shop.plan === 'paid') return { kind: 'paid', renewsAt: shop.current_period_end ?? null };
  if (onFreeTrial(shop, now)) return { kind: 'trial', endsAt: shop.trial_ends_at as string, daysLeft: trialDaysLeft(shop, now) };
  if (trialExpired(shop, now)) return { kind: 'ended', endsAt: shop.trial_ends_at as string };
  return { kind: 'none' };
}

/**
 * The new trial end for an extension. Days count from the later of now and the
 * current end, so extending an expired trial brings the shop back today, and
 * extending a running one adds days to what it already has.
 */
export function extendTrialEnd(endsAt: string | null, days: number, now = Date.now()): string {
  const base = Math.max(now, endsAt ? new Date(endsAt).getTime() : now);
  return new Date(base + days * 864e5).toISOString();
}

/** A picked calendar date as a trial end: the end of that day (UTC). Null when the date is past or invalid. */
export function trialEndForDate(date: string, now = Date.now()): string | null {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return null;
  const end = Date.parse(`${date}T23:59:59.000Z`);
  return Number.isFinite(end) && end > now ? new Date(end).toISOString() : null;
}

export type TrialStartRow = { trial_ends_at: string | null; trial_started_at?: string | null; created_at?: string | null; created_via?: string | null };

/**
 * When this trial started, for the sequence's day count. Rows made before the
 * start was recorded fall back to the signup date for self-signups (the tenant
 * and its trial start together), else the end minus 14 days: every trial
 * before MAG-220 was 14 days, and the 30-day claim/invite trials write the
 * start, so the fallback only ever fires for legacy rows.
 */
export function trialStartMs(row: TrialStartRow): number | null {
  if (row.trial_started_at) return new Date(row.trial_started_at).getTime();
  if (!row.trial_ends_at) return null;
  if (row.created_via === 'signup' && row.created_at) return new Date(row.created_at).getTime();
  return new Date(row.trial_ends_at).getTime() - TRIAL_DAYS * 864e5;
}

// The card is optional at signup. The first visit asks once; after that a
// reminder pops up at random, more often as the trial runs out:
//   8+ days left: 1 in 5 visits · 4–7 days: 2 in 5 · 2–3 days: 3 in 4 · last day: every visit.
// Never more than once a day (every 6 hours on the last day). Owners only.

export type Seen = { welcomed?: number; last?: number };

export function reminderChance(daysLeft: number) {
  if (daysLeft <= 1) return { chance: 1, gapMs: 6 * 3600_000 };
  if (daysLeft <= 3) return { chance: 0.75, gapMs: 20 * 3600_000 };
  if (daysLeft <= 7) return { chance: 0.4, gapMs: 20 * 3600_000 };
  return { chance: 0.2, gapMs: 20 * 3600_000 };
}

/** Decides whether to pop a card prompt this visit: 'welcome' (first time), 'reminder' or null. */
export function pickPrompt(seen: Seen, daysLeft: number, now = Date.now(), roll = Math.random()): 'welcome' | 'reminder' | null {
  if (!seen.welcomed) return 'welcome';
  const { chance, gapMs } = reminderChance(daysLeft);
  if (now - Math.max(seen.last ?? 0, seen.welcomed) < gapMs) return null;
  return roll < chance ? 'reminder' : null;
}
