import { describe, expect, it } from 'vitest';
import { checkoutTrialEnd, onFreeTrial, pickPrompt, reminderChance, TRIAL_DAYS, trialDaysLeft, trialExpired } from '../../src/lib/trial';

const now = Date.parse('2026-11-01T12:00:00Z');
const at = (days: number) => new Date(now + days * 864e5).toISOString();
const H = 3600_000;

describe('free trial', () => {
  it('is 14 days', () => expect(TRIAL_DAYS).toBe(14));

  it('gates when the trial ends without a card, and not before', () => {
    expect(trialExpired({ plan: 'trial', trial_ends_at: at(-0.01), billing_status: 'none' }, now)).toBe(true);
    expect(trialExpired({ plan: 'trial', trial_ends_at: at(0.5), billing_status: 'none' }, now)).toBe(false);
    expect(onFreeTrial({ plan: 'trial', trial_ends_at: at(0.5), billing_status: 'none' }, now)).toBe(true);
  });

  it('never gates a shop with a card on file or a plan VVS Lab manages', () => {
    for (const billing_status of ['trialing', 'active', 'past_due']) expect(trialExpired({ plan: 'trial', trial_ends_at: at(-3), billing_status }, now)).toBe(false);
    expect(trialExpired({ plan: 'paid', trial_ends_at: at(-3), billing_status: 'active' }, now)).toBe(false);
    expect(trialExpired({ plan: 'pilot', trial_ends_at: null }, now)).toBe(false);
  });

  it('counts days left, rounded up', () => {
    expect(trialDaysLeft({ trial_ends_at: at(13.2) }, now)).toBe(14);
    expect(trialDaysLeft({ trial_ends_at: at(0.1) }, now)).toBe(1);
    expect(trialDaysLeft({ trial_ends_at: at(-1) }, now)).toBe(0);
  });

  it('gives Stripe Checkout the same whole days the dashboard shows', () => {
    // Stripe shows floor(days to trial_end); the dashboard shows ceil(days to trial_ends_at).
    for (const left of [13.97, 13.2, 7.5, 2.1]) {
      const shop = { trial_ends_at: at(left) };
      const end = checkoutTrialEnd(shop, now)!;
      const stripeDays = Math.floor((end * 1000 - now) / 864e5);
      expect(stripeDays).toBe(trialDaysLeft(shop, now));
      // ...even if the customer opens Checkout a few minutes later.
      expect(Math.floor((end * 1000 - (now + 10 * 60_000)) / 864e5)).toBe(trialDaysLeft(shop, now));
    }
  });

  it('starts billing right away within 48 hours of the end', () => {
    expect(checkoutTrialEnd({ trial_ends_at: at(1.9) }, now)).toBeNull();
    expect(checkoutTrialEnd({ trial_ends_at: null }, now)).toBeNull();
  });
});

describe('card reminders', () => {
  it('asks on the first visit', () => expect(pickPrompt({}, 14, now, 0.99)).toBe('welcome'));

  it('waits at least ~a day between prompts', () => {
    expect(pickPrompt({ welcomed: now - 2 * H, last: now - 2 * H }, 12, now, 0)).toBeNull();
    expect(pickPrompt({ welcomed: now - 30 * H, last: now - 21 * H }, 12, now, 0)).toBe('reminder');
  });

  it('gets more likely as the trial runs out', () => {
    const seen = { welcomed: now - 100 * H, last: now - 25 * H };
    expect(pickPrompt(seen, 12, now, 0.3)).toBeNull(); // 1 in 5
    expect(pickPrompt(seen, 5, now, 0.3)).toBe('reminder'); // 2 in 5
    expect(pickPrompt(seen, 2, now, 0.7)).toBe('reminder'); // 3 in 4
    expect(pickPrompt({ welcomed: now - 100 * H, last: now - 7 * H }, 1, now, 0.999)).toBe('reminder'); // last day: every 6 hours
    expect(reminderChance(12).chance).toBeLessThan(reminderChance(5).chance);
  });
});
