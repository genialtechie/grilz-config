// The free trial, shared by the server (public page gate, actions) and the dashboard.
// 14 days, card optional. When it ends without a plan, the public builder stops
// and the dashboard is locked to "Start your plan" and "Download your data".

export const TRIAL_DAYS = 14;

export type TrialFields = { plan?: string | null; trial_ends_at?: string | null; billing_status?: string | null };

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
