import { describe, expect, it } from 'vitest';
import { moneyKeystroke } from '../../admin/moneyInput';

// The parse half of the Money input (MAG-219 re-review F1). There is no DOM
// test infra in this repo (vitest runs in node; no jsdom/testing-library),
// so the regression test pins the keystroke → published-value contract
// through the helper Money delegates to: what a shop owner types, in order,
// and what the draft must receive for each keystroke.

describe('moneyKeystroke', () => {
  it('typing "-" then "60" publishes -60, never 0 or +60', () => {
    // The keystrokes a shop owner makes to enter -$60 for open-face, as
    // Money sees them: a lone "-" is an intermediate (nothing published —
    // the old code published 0 here, which the controlled input then
    // showed, so the "60" landed as +$60), "-6" publishes -6, "-60"
    // publishes -60.
    const published: number[] = [];
    const publish = (raw: string) => {
      const value = moneyKeystroke(raw);
      if (value !== undefined) published.push(value);
    };
    publish('-');
    publish('-6');
    publish('-60');
    expect(published).toEqual([-6, -60]);
  });

  it('a cleared field still publishes 0 (today\'s behavior)', () => {
    expect(moneyKeystroke('')).toBe(0);
  });

  it('publishes plain numbers, decimals and the negative bound', () => {
    expect(moneyKeystroke('60')).toBe(60);
    expect(moneyKeystroke('6.5')).toBe(6.5);
    expect(moneyKeystroke('-100000')).toBe(-100000);
  });

  it('holds back intermediates and junk instead of publishing a wrong number', () => {
    // "6." publishes the whole part (6) — harmless, the draft updates
    // again at "6.5" — and the text is never wiped by the effect because
    // the value doesn't change on that keystroke.
    expect(moneyKeystroke('6.')).toBe(6);
    expect(moneyKeystroke('-.')).toBeUndefined();
    expect(moneyKeystroke('abc')).toBeUndefined();
  });
});
