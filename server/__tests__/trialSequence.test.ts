import { describe, expect, it } from 'vitest';
import { trialEmail, type TrialShop } from '../trialEmails';
import { stepFor } from '../trialSequence';

const DAY = 864e5;
const start = Date.UTC(2026, 9, 1, 15, 0, 0);
const row = { trial_ends_at: new Date(start + 14 * DAY).toISOString() };
const shop = (patch: Partial<TrialShop> = {}): TrialShop => ({
  id: 'eae3e55c-610b-47d4-b5cc-665289f37eb9',
  slug: 'gold-mouth',
  name: 'Gold Mouth Jewelers',
  live: false,
  hasLogo: true,
  pricesSet: false,
  leads: 0,
  estimates: 0,
  stripeReady: false,
  hasCard: false,
  daysLeft: 14,
  ...patch,
});
/** The step due at a moment `days` into the trial, with daysLeft computed like the cron does. */
const at = (days: number, patch: Partial<TrialShop> = {}) => {
  const now = start + days * DAY;
  return stepFor(shop({ daysLeft: Math.max(0, Math.ceil((start + 14 * DAY - now) / DAY)), ...patch }), row, now);
};

describe('trial sequence: which step is due', () => {
  it('walks a shop that does nothing through every step, one a day at most', () => {
    expect(at(0.5)).toBeNull();
    expect(at(1.2)).toBe('day-1');
    expect(at(3.2)).toBe('day-3');
    expect(at(5.2)).toBeNull();
    expect(at(7.2)).toBe('day-7');
    expect(at(11.2)).toBe('day-12'); // 3 days left
    expect(at(13.2)).toBe('day-14'); // last day
    expect(at(14.1)).toBeNull(); // trial over
  });

  it('skips a step the shop has already done', () => {
    expect(at(1.2, { live: true, pricesSet: true })).toBeNull();
    // Live from the start (MAG-90) but still on the starting prices: day 1 asks for theirs.
    expect(at(1.2, { live: true })).toBe('day-1');
    expect(at(3.2, { leads: 2 })).toBeNull();
    expect(at(7.2, { stripeReady: true })).toBeNull();
    expect(at(11.2, { hasCard: true })).toBeNull();
    expect(at(13.2, { hasCard: true })).toBeNull();
  });

  it('only sends inside a step’s window: a missed day is skipped, not stacked', () => {
    expect(at(2.5)).toBe('day-1'); // a day late is fine
    expect(at(6)).toBeNull(); // day 3's window has passed
  });
});

describe('trial emails', () => {
  const origin = 'https://vvslab.magpollo.com';
  const unsubscribe = 'https://vvslab.magpollo.com/api/unsubscribe?e=x&topic=tips&s=y';

  it('show setup progress on day 1 and switch to "still off" on day 3 when not live', async () => {
    const day1 = await trialEmail('day-1', shop(), origin, unsubscribe);
    expect(day1.subject).toBe('Your builder is 10 minutes from live');
    expect(day1.text).toContain('[x] Add your logo');
    expect(day1.text).toContain('[ ] Switch your builder on');
    const day3 = await trialEmail('day-3', shop(), origin, unsubscribe);
    expect(day3.subject).toBe('Your builder is still switched off');
    const live = await trialEmail('day-3', shop({ live: true }), origin, unsubscribe);
    expect(live.html).toContain('vvslab.magpollo.com/b/gold-mouth');
  });

  it('asks a live shop on the starting prices for its own on day 1', async () => {
    const day1 = await trialEmail('day-1', shop({ live: true }), origin, unsubscribe);
    expect(day1.subject).toBe('Your builder is live. Are those your prices?');
    expect(day1.html).toContain('Set my prices');
    expect(day1.html).toContain('vvslab.magpollo.com/b/gold-mouth');
  });

  it('use the shop’s own numbers on day 12, and every email has the unsubscribe link', async () => {
    const email = await trialEmail('day-12', shop({ leads: 3, estimates: 9450.4, daysLeft: 3 }), origin, unsubscribe);
    expect(email.subject).toBe('3 days left on your trial');
    expect(email.html).toContain('3 design requests');
    expect(email.html).toContain('$9,450');
    for (const step of ['day-1', 'day-3', 'day-7', 'day-12', 'day-14'] as const) {
      const rendered = await trialEmail(step, shop({ daysLeft: 2 }), origin, unsubscribe);
      expect(rendered.html, step).toContain(unsubscribe.replace(/&/g, '&amp;'));
      expect(rendered.text, step).toContain(unsubscribe);
    }
  });

  it('escape a shop name', async () => {
    const email = await trialEmail('day-14', shop({ name: '<b>Ice</b>' }), origin, unsubscribe);
    expect(email.html).not.toContain('<b>Ice</b>');
  });
});
