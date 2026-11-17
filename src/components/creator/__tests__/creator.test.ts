import { describe, expect, it } from 'vitest';
import { buildTenant } from '../../../lib/tenant/tenant';
import { VVSLAB_CONFIG } from '../../../lib/tenant/vvslab';
import { back, canUndo, freshHistory, openPart, track, undo, HISTORY_MAX } from '../history';
import { IDLE_MS, nextQuestion, seemsStuck } from '../guide';
import {
  apply,
  blankDesign,
  buildPrice,
  fromSnapshot,
  groupTeeth,
  matchingGroup,
  offeredGroups,
  partValue,
  price,
  selectionWord,
  setLabel,
  setRange,
  shopBuilds,
  summary,
  toSnapshot,
  toSpec,
  toggleTooth,
} from '../model';

const shop = buildTenant('vvslab', VVSLAB_CONFIG, true);

describe('history', () => {
  it('records changes and steps back through them', () => {
    let h = freshHistory();
    h = track(h, 'a');
    expect(canUndo(h)).toBe(false);
    h = track(h, 'a');
    expect(canUndo(h)).toBe(false);
    h = track(h, 'b');
    h = track(h, 'c');
    const one = undo(h)!;
    expect(one.design).toBe('b');
    const two = undo(one.history)!;
    expect(two.design).toBe('a');
    expect(undo(two.history)).toBeNull();
  });
  it('a change after undo carries on from there', () => {
    let h = track(track(track(freshHistory(), 'a'), 'b'), 'c');
    h = undo(h)!.history;
    h = track(h, 'x');
    expect(undo(h)!.design).toBe('b');
  });
  it('keeps at most HISTORY_MAX steps', () => {
    let h = freshHistory();
    for (let i = 0; i < HISTORY_MAX + 10; i++) h = track(h, String(i));
    expect(h.past.length).toBe(HISTORY_MAX);
  });
  it('Back returns to the part you were on, then the start page', () => {
    let stack = openPart<string>([], 'teeth', 'metal');
    stack = openPart(stack, 'metal', 'extras');
    stack = openPart(stack, 'extras', 'extras');
    expect(stack).toEqual(['teeth', 'metal']);
    const b1 = back(stack);
    expect(b1.to).toBe('metal');
    const b2 = back(b1.stack);
    expect(b2.to).toBe('teeth');
    expect(back(b2.stack).to).toBeNull();
  });
});

describe('quick groups', () => {
  const d = setRange(blankDesign(shop), 6, 6);
  it('names the teeth of each group', () => {
    expect(groupTeeth(d.teeth, 'top')).toEqual([5, 6, 7, 8, 9, 10]);
    expect(groupTeeth(d.teeth, 'bottom')).toEqual([21, 22, 23, 24, 25, 26]);
    expect(groupTeeth(d.teeth, 'front')).toEqual([6, 7, 8, 9, 22, 23, 24, 25]);
    expect(groupTeeth(d.teeth, 'canines')).toEqual([5, 10, 21, 26]);
    expect(groupTeeth(d.teeth, 'alt')).toEqual([5, 7, 9, 21, 23, 25]);
  });
  it('offers only groups that are some of the set', () => {
    const top = setRange(blankDesign(shop), 6, 0);
    expect(offeredGroups(top.teeth).map((g) => g.id)).toEqual(['front', 'canines', 'alt']);
  });
  it('says which group is picked', () => {
    expect(matchingGroup(d.teeth, [26, 5, 10, 21])).toBe('canines');
    expect(selectionWord(d.teeth, [])).toBe('Whole set');
    expect(selectionWord(d.teeth, [5, 10, 21, 26])).toBe('Canines');
    expect(selectionWord(d.teeth, [7])).toBe('1 tooth');
  });
});

describe('the design', () => {
  it('names sets and odd counts', () => {
    const d = setRange(blankDesign(shop), 6, 6);
    expect(setLabel(d)).toBe('6 × 6');
    expect(setLabel(toggleTooth(d, 5))).toBe('11 teeth');
    expect(setLabel(blankDesign(shop))).toBe('No teeth yet');
  });
  it('changes only the picked teeth, and the base when the whole set changes', () => {
    let d = setRange(blankDesign(shop), 6, 6);
    d = apply(shop, d, [7, 8], { g: 'metal', k: 'white' }, false);
    expect(d.designs[7].metal).toBe('white');
    expect(d.designs[5].metal).toBe('yellow');
    expect(d.base.metal).toBe('yellow');
    expect(partValue(d, 'metal')).toBe('2 metals');
    d = apply(shop, d, d.teeth, { g: 'setting', k: 'mosaic' }, true);
    expect(d.designs[5].type).toBe('iced');
    expect(d.base.setting).toBe('mosaic');
    // A tooth added later takes the base.
    d = toggleTooth(d, 4);
    expect(d.designs[4].type).toBe('iced');
  });
  it('prices with the shop’s own rules', () => {
    const d = setRange(blankDesign(shop), 6, 6);
    // Service fee $200 + 12 × $150 yellow 10K.
    expect(price(shop, d).total).toBe(2000);
    expect(summary(d)).toBe('6 × 6 · 10K yellow gold · solid');
  });
  it('keeps a design through the saved-design format', () => {
    let d = setRange(blankDesign(shop), 6, 6);
    d = apply(shop, d, [7], { g: 'metal', k: 'rose' }, false);
    d = { ...d, fangs: true, initials: { text: 'AB', style: 'cut', tooth: 7 } };
    const back = fromSnapshot(shop, toSnapshot(d));
    expect(toSpec(back)).toEqual(toSpec(d));
  });
  it('offers the lab’s builds the shop sells, with a price', () => {
    const builds = shopBuilds(shop);
    expect(builds.map((b) => b.id)).toEqual(['gold6', 'gold66', 'iced8', 'fangs', 'tone', 'open']);
    expect(buildPrice(shop, builds[1])).toBe('From $2,000');
    expect(builds.find((b) => b.id === 'tone')!.design.designs[7].metal).toBe('white');
  });
});

describe('the guide', () => {
  const base = { building: true, bubbleOpen: false, now: 100000, quietUntil: 0, lastTouch: 100000, hasTeeth: true };
  it('asks at once when the build is empty', () => {
    expect(seemsStuck({ ...base, hasTeeth: false })).toBe(true);
  });
  it('waits for the idle time otherwise', () => {
    expect(seemsStuck(base)).toBe(false);
    expect(seemsStuck({ ...base, lastTouch: base.now - IDLE_MS - 1 })).toBe(true);
  });
  it('never asks over a bubble, while quiet, off the builder or with the panel up', () => {
    const idle = { ...base, lastTouch: 0 };
    expect(seemsStuck({ ...idle, bubbleOpen: true })).toBe(false);
    expect(seemsStuck({ ...idle, quietUntil: base.now + 1 })).toBe(false);
    expect(seemsStuck({ ...idle, building: false })).toBe(false);
    expect(seemsStuck({ ...idle, panelBig: true })).toBe(false);
  });
  it('asks about the teeth, then parts not opened yet, then if they are happy', () => {
    expect(nextQuestion(false, {})).toBe('where');
    expect(nextQuestion(true, { teeth: true })).toBe('metal');
    expect(nextQuestion(true, { teeth: true, metal: true, finish: true })).toBe('stones');
    expect(nextQuestion(true, { metal: true, finish: true, stones: true, extras: true })).toBe('happy');
  });
});
