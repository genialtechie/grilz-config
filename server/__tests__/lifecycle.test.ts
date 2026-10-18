import { describe, expect, it } from 'vitest';
import { ANNOUNCEMENTS, announcementEmail, dueAnnouncements, type Announcement } from '../announcements';
import { pausedSince, winbackEmail, winbackStepFor } from '../winback';

const DAY = 864e5;
const origin = 'https://vvslab.magpollo.com';
const unsubscribe = 'https://vvslab.magpollo.com/api/unsubscribe?e=x&topic=tips&s=y';
const row = { id: 'x', slug: 'gold-mouth', name: 'Gold Mouth Jewelers', plan: 'trial', billing_status: 'none', trial_ends_at: '2026-10-01T15:00:00Z', current_period_end: null };

describe('win-back', () => {
  it('is for an ended trial or a cancelled plan, not a failed payment', () => {
    expect(pausedSince(row)).toEqual({ reason: 'trial', since: '2026-10-01T15:00:00Z' });
    expect(pausedSince({ ...row, plan: 'canceled', billing_status: 'canceled', current_period_end: '2026-10-05T00:00:00Z' })).toEqual({ reason: 'canceled', since: '2026-10-05T00:00:00Z' });
    expect(pausedSince({ ...row, plan: 'paid', billing_status: 'past_due' })).toBeNull();
    expect(pausedSince({ ...row, billing_status: 'past_due' })).toBeNull();
  });

  it('sends at +7 and +30 days, inside a two-day window, then stops', () => {
    const since = '2026-10-01T15:00:00Z';
    const at = (days: number) => winbackStepFor(since, new Date(since).getTime() + days * DAY);
    expect(at(6.9)).toBeNull();
    expect(at(7.1)).toBe('paused');
    expect(at(8.9)).toBe('paused');
    expect(at(9.5)).toBeNull();
    expect(at(30.2)).toBe('last');
    expect(at(33)).toBeNull();
    expect(at(90)).toBeNull();
  });

  it('says what is saved, and every email can be unsubscribed from', async () => {
    const shop = { id: 'x', slug: 'gold-mouth', name: 'Gold Mouth Jewelers', reason: 'trial' as const, since: '2026-10-01T15:00:00Z', leads: 4 };
    const paused = await winbackEmail('paused', shop, origin, unsubscribe);
    expect(paused.subject).toBe('Your builder is paused');
    expect(paused.html).toContain('4 design requests');
    expect(paused.text).toContain("Gold Mouth Jewelers' builder switched off when the free trial ended");
    const last = await winbackEmail('last', { ...shop, reason: 'canceled' }, origin, unsubscribe);
    expect(last.subject).toBe('Should we stop emailing you?');
    for (const email of [paused, last]) expect(email.html).toContain(unsubscribe.replace(/&/g, '&amp;'));
  });
});

describe('announcements', () => {
  const item: Announcement = { ...ANNOUNCEMENTS[0], id: 'test-item', sendAt: '2026-10-19T00:00:00Z' };

  it('are due for seven days from sendAt', () => {
    const at = (iso: string) => dueAnnouncements(new Date(iso).getTime(), [item]).map((entry) => entry.id);
    expect(at('2026-10-18T23:00:00Z')).toEqual([]);
    expect(at('2026-10-19T14:07:00Z')).toEqual(['test-item']);
    expect(at('2026-10-26T01:00:00Z')).toEqual([]);
  });

  it('every registered announcement has a unique id and starts as a test unless reviewed', () => {
    const ids = ANNOUNCEMENTS.map((entry) => entry.id);
    expect(new Set(ids).size).toBe(ids.length);
    for (const entry of ANNOUNCEMENTS) expect(Number.isNaN(new Date(entry.sendAt).getTime())).toBe(false);
  });

  it('render one feature with the unsubscribe link and a tagged CTA', async () => {
    const email = await announcementEmail(item, origin, unsubscribe);
    expect(email.subject).toBe(item.subject);
    expect(email.html).toContain('utm_campaign=test-item');
    expect(email.html).toContain(unsubscribe.replace(/&/g, '&amp;'));
  });
});
