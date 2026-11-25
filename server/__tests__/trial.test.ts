import { describe, expect, it } from 'vitest';
import {
  ADMIN_STATUS_LABEL,
  adminStatus,
  checkoutTrialEnd,
  CLAIM_TRIAL_DAYS,
  extendTrialEnd,
  onFreeTrial,
  pickPrompt,
  reminderChance,
  TRIAL_DAYS,
  trialDaysLeft,
  trialDisplay,
  trialEndForDate,
  trialExpired,
  trialStartMs,
} from '../../src/lib/trial';

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

describe('trial admin (MAG-220)', () => {
  it('claims and owner invites start a 30-day trial; self-signup stays 14', () => {
    expect(CLAIM_TRIAL_DAYS).toBe(30);
    expect(TRIAL_DAYS).toBe(14);
  });

  it('extends from the current end while the trial runs, and from today once it ended', () => {
    expect(extendTrialEnd(at(5), 14, now)).toBe(at(19));
    expect(extendTrialEnd(at(-2), 30, now)).toBe(at(30));
    expect(extendTrialEnd(null, 7, now)).toBe(at(7));
  });

  it('extends to the end of a picked date, and rejects a past or malformed one', () => {
    expect(trialEndForDate('2026-11-20', now)).toBe('2026-11-20T23:59:59.000Z');
    expect(trialEndForDate('2026-11-01', now)).toBe('2026-11-01T23:59:59.000Z'); // today, still ahead
    expect(trialEndForDate('2026-10-31', now)).toBeNull();
    expect(trialEndForDate('not-a-date', now)).toBeNull();
    expect(trialEndForDate('', now)).toBeNull();
  });

  it('counts a trial from when it started, falling back for rows made before the start was recorded', () => {
    expect(trialStartMs({ trial_ends_at: at(10), trial_started_at: at(-4), created_at: at(-20) })).toBe(Date.parse(at(-4)));
    // Self-signup: the tenant and its trial start together.
    expect(trialStartMs({ trial_ends_at: at(10), created_at: at(-4), created_via: 'signup' })).toBe(Date.parse(at(-4)));
    // A claim trial with no start recorded: the end minus 14 days — every trial before MAG-220 was 14 days, and the 30-day ones write the start.
    expect(trialStartMs({ trial_ends_at: at(10), created_at: at(-20), created_via: 'admin' })).toBe(Date.parse(at(-4)));
    expect(trialStartMs({ trial_ends_at: null })).toBeNull();
  });

  it('reads a shop whose trial ended as paused, even when the stored status still says live', () => {
    const expired = { status: 'live', plan: 'trial', trial_ends_at: at(-1), billing_status: 'none' };
    expect(adminStatus(expired, now)).toBe('paused-trial');
    expect(ADMIN_STATUS_LABEL['paused-trial']).toBe('Paused (trial ended)');
    expect(adminStatus({ ...expired, status: 'paused' }, now)).toBe('paused-trial');
    expect(adminStatus({ status: 'live', plan: 'trial', trial_ends_at: at(5), billing_status: 'none' }, now)).toBe('live');
    expect(adminStatus({ status: 'live', plan: 'trial', trial_ends_at: at(-1), billing_status: 'active' }, now)).toBe('live'); // a card: not expired
    expect(adminStatus({ status: 'draft', plan: 'founding', trial_ends_at: null, billing_status: 'none' }, now)).toBe('draft');
  });

  it('shows the trial end, paid, ended, or nothing yet', () => {
    expect(trialDisplay({ plan: 'trial', trial_ends_at: at(5), billing_status: 'none' }, now)).toEqual({ kind: 'trial', endsAt: at(5), daysLeft: 5 });
    expect(trialDisplay({ plan: 'trial', trial_ends_at: at(-1), billing_status: 'none' }, now)).toEqual({ kind: 'ended', endsAt: at(-1) });
    expect(trialDisplay({ plan: 'paid', trial_ends_at: null, billing_status: 'active', current_period_end: at(30) }, now)).toEqual({ kind: 'paid', renewsAt: at(30) });
    expect(trialDisplay({ plan: 'trial', trial_ends_at: at(5), billing_status: 'active' }, now)).toEqual({ kind: 'paid', renewsAt: null });
    expect(trialDisplay({ plan: 'founding', trial_ends_at: null, billing_status: 'none' }, now)).toEqual({ kind: 'none' });
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
