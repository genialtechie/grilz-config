import { describe, expect, it } from 'vitest';
import { checkSnapshot } from '../../../lib/savedDesign';
import { parseRenderSpec } from '../../../lib/renderSpec';
import { buildTenant } from '../../../lib/tenant/tenant';
import { VVSLAB_CONFIG } from '../../../lib/tenant/vvslab';
import { back, canUndo, freshHistory, openPart, track, undo, HISTORY_MAX } from '../history';
import { IDLE_MS, nextQuestion, seemsStuck } from '../guide';
import {
  apply,
  blankDesign,
  buildPrice,
  centredRun,
  charmList,
  charmTooth,
  fromSnapshot,
  fromSpec,
  initialsInscription,
  initialsRun,
  inscriptionsOf,
  withLine,
  groupTeeth,
  matchingGroup,
  offeredGroups,
  partValue,
  placeCharm,
  price,
  selectionWord,
  setLabel,
  setRange,
  shopBuilds,
  setOptions,
  summary,
  tapLetters,
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
    d = { ...d, fangs: true, initials: { text: 'AB', style: 'cut', font: 'block', enamel: null, teeth: [7] } };
    const back = fromSnapshot(shop, toSnapshot(d));
    expect(toSpec(back)).toEqual(toSpec(d));
  });
  it('keeps letters across teeth, script, enamel and charms through a saved design and the shop’s check', () => {
    let d = setRange(blankDesign(shop), 6, 6);
    d = { ...d, initials: { text: 'Lainee', style: 'engraved', font: 'script', enamel: 'pink', teeth: [22, 23, 24, 25] } };
    d = placeCharm(d, [8], 'crown');
    const snap = checkSnapshot(JSON.parse(JSON.stringify({ v: 1, ...toSnapshot(d) })), shop);
    expect(snap).not.toBeNull();
    const back = fromSnapshot(shop, snap!);
    expect(toSpec(back)).toEqual(toSpec(d));
    expect(toSpec(back)!.inscriptions).toEqual([{ text: 'Lainee', teeth: [22, 23, 24, 25], style: 'engraved', font: 'script', enamel: 'pink' }]);
    expect(toSpec(back)!.charms).toEqual([{ id: 'crown', tooth: 8 }]);
    // Every design the creator makes passes the server's check.
    expect(parseRenderSpec(toSpec(d), shop.config.catalog)).toEqual(toSpec(d));
  });
  it('reads designs saved before charms and multi-tooth letters', () => {
    const old = { v: 1, teeth: [5, 6, 7, 8, 9, 10], base: shop.defaultTooth, overrides: {}, set: { fangs: false, cut: 'deep', vision: '' }, drafts: [{ text: 'AB', style: 'cut', font: 'block', enamel: null, teeth: [7] }] };
    const back = fromSnapshot(shop, checkSnapshot(old, shop)!);
    expect(back.charms).toEqual({});
    expect(toSpec(back)!.inscriptions[0]).toMatchObject({ text: 'AB', teeth: [7] });
    expect(toSpec(back)).not.toHaveProperty('charms');
  });
  it('offers the lab’s builds the shop sells, with a price', () => {
    const builds = shopBuilds(shop);
    expect(builds.map((b) => b.id)).toEqual(['gold6', 'gold66', 'iced8', 'fangs', 'tone', 'open', 'oneof']);
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

describe('letters', () => {
  const six = setRange(blankDesign(shop), 6, 6);
  const withText = (text: string, patch = {}) => ({ ...six, initials: { ...six.initials, text, ...patch } });
  it('sit on the front of the top row, as many teeth as the letters need', () => {
    expect(initialsRun(withText('AB'))).toEqual([7]);
    expect(initialsRun(withText('LAINEE7'))).toEqual([7, 8]);
    expect(initialsRun({ ...withText('AB'), teeth: [21, 22, 23, 24, 25, 26] })).toEqual([23]);
  });
  it('go across a centred run of the teeth asked for', () => {
    expect(centredRun(six, 0, 2)).toEqual([7, 8]);
    expect(centredRun(six, 0, 4)).toEqual([6, 7, 8, 9]);
    expect(centredRun(six, 1, 6)).toEqual([21, 22, 23, 24, 25, 26]);
    expect(centredRun(six, 0, 10)).toEqual([5, 6, 7, 8, 9, 10]);
  });
  it('take the first and last tooth tapped, in one row, at most eight', () => {
    let t = tapLetters(six, null, 6);
    expect(t).toEqual({ teeth: [6], anchor: 6 });
    t = tapLetters(six, t.anchor, 9);
    expect(t).toEqual({ teeth: [6, 7, 8, 9], anchor: null });
    // The other row starts over.
    expect(tapLetters(six, 6, 24)).toEqual({ teeth: [24], anchor: 24 });
    // A tooth outside the set does nothing.
    expect(tapLetters(six, 6, 2)).toEqual({ teeth: [], anchor: 6 });
  });
  it('keep script in its case, block in capitals, and enamel only when engraved', () => {
    expect(initialsInscription(withText('Lainee', { font: 'script', style: 'cut', enamel: 'pink' }))).toMatchObject({ text: 'Lainee', font: 'script', enamel: null });
    expect(initialsInscription(withText('ab', { style: 'engraved', enamel: 'blue' }))).toMatchObject({ text: 'AB', enamel: 'blue' });
  });
  it('count only when they fit their teeth (six letters a tooth)', () => {
    expect(initialsInscription(withText('ABCDEFGH', { teeth: [7] }))).toBeNull();
    expect(initialsInscription(withText('ABCDEFGH', { teeth: [7, 8] }))?.teeth).toEqual([7, 8]);
    expect(setOptions(withText('ABCDEFGH', { teeth: [7] })).inscriptions).toEqual([]);
  });
  it('are priced per tooth they cover', () => {
    const one = price(shop, withText('AB', { style: 'engraved', teeth: [7] })).total;
    const four = price(shop, withText('AB', { style: 'engraved', teeth: [6, 7, 8, 9] })).total;
    expect(four - one).toBe(3 * VVSLAB_CONFIG.pricing.inscription.engraved!);
  });
});

describe('charms', () => {
  const six = setRange(blankDesign(shop), 6, 6);
  it('go on the first front tooth without one, and come off with a second tap', () => {
    expect(charmTooth(six)).toBe(7);
    let d = placeCharm(six, [7], 'owl');
    expect(charmTooth(d)).toBe(8);
    expect(charmList(d)).toEqual([{ id: 'owl', tooth: 7 }]);
    d = placeCharm(d, [7], 'owl');
    expect(charmList(d)).toEqual([]);
  });
  it('leave with their tooth', () => {
    const d = placeCharm(six, [5], 'crown');
    expect(toggleTooth(d, 5).charms).toEqual({});
    expect(setRange(d, 2, 0).charms).toEqual({});
  });
  it('are quoted by the demo shop: in the summary, out of the total', () => {
    const d = placeCharm(six, [7, 8], 'crown');
    expect(price(shop, d).total).toBe(price(shop, six).total);
    expect(price(shop, d).quoted).toEqual(['Crown charm', 'Crown charm']);
    expect(summary(d)).toContain('2 charms');
    expect(partValue(d, 'extras')).toBe('2 charms');
  });
  it('come back from the AI on teeth still in the set only', () => {
    const spec = toSpec(placeCharm(six, [7], 'crown'))!;
    expect(fromSpec(shop, spec).charms).toEqual({ 7: 'crown' });
  });
  it('make the One-of-one build: a charm on all twelve teeth, quoted', () => {
    const one = shopBuilds(shop).find((b) => b.id === 'oneof')!;
    expect(charmList(one.design)).toHaveLength(12);
    expect(one.design.designs[5].type).toBe('iced');
    expect(one.design.designs[7]).toMatchObject({ type: 'plain', karat: '18k' });
    expect(buildPrice(shop, one)).toBe('Quoted');
    expect(parseRenderSpec(toSpec(one.design), shop.config.catalog)).toEqual(toSpec(one.design));
  });
  it('leave One-of-one out at shops without charms', () => {
    const plain = buildTenant('plain', { ...VVSLAB_CONFIG, catalog: { ...VVSLAB_CONFIG.catalog, charms: undefined } });
    expect(shopBuilds(plain).map((b) => b.id)).not.toContain('oneof');
    const priced = buildTenant('priced', { ...VVSLAB_CONFIG, pricing: { ...VVSLAB_CONFIG.pricing, charms: { each: 100 } } });
    const one = shopBuilds(priced).find((b) => b.id === 'oneof')!;
    expect(buildPrice(priced, one)).toMatch(/^From \$/);
  });
});

describe('a second line of letters', () => {
  const six = setRange(blankDesign(shop), 6, 6);
  const two = withLine(withLine(six, 0, { text: 'AB' }), 1, { text: 'Lainee', font: 'script', style: 'engraved', enamel: 'pink' });
  it('goes on the other row, top row first in the spec', () => {
    expect(inscriptionsOf(two).map((x) => [x.text, x.teeth])).toEqual([
      ['AB', [7]],
      ['Lainee', [23]],
    ]);
    // The first line moves to the bottom: the second takes the top.
    const moved = withLine(two, 0, { teeth: [22, 23, 24, 25] });
    expect(initialsRun(moved, 1)).toEqual([7]);
    // A second line asked for on the first one's row keeps off it.
    expect(initialsRun(withLine(two, 1, { teeth: [6, 7] }), 1)).toEqual([23]);
  });
  it('is priced per tooth like the first', () => {
    const one = withLine(six, 0, { text: 'AB' });
    const diff = price(shop, withLine(two, 1, { teeth: [22, 23, 24, 25] })).total - price(shop, one).total;
    expect(diff).toBe(4 * VVSLAB_CONFIG.pricing.inscription.engraved!);
  });
  it('passes the shop check and comes back from a saved design', () => {
    const d = withLine(two, 1, { teeth: [22, 23, 24, 25] });
    expect(parseRenderSpec(toSpec(d), shop.config.catalog)).toEqual(toSpec(d));
    const back = fromSnapshot(shop, checkSnapshot(JSON.parse(JSON.stringify({ v: 1, ...toSnapshot(d) })), shop)!);
    expect(toSpec(back)).toEqual(toSpec(d));
    expect(back.second.text).toBe('Lainee');
    expect(summary(d)).toContain('"AB" · "Lainee"');
  });
  it('needs a row of its own: none on a top-only set', () => {
    const top = withLine(withLine(setRange(blankDesign(shop), 6, 0), 0, { text: 'AB' }), 1, { text: 'CD' });
    expect(initialsInscription(top, 1)).toBeNull();
    expect(inscriptionsOf(top)).toHaveLength(1);
  });
  it('comes back from the AI as the second line', () => {
    const spec = toSpec(withLine(two, 1, { teeth: [22, 23, 24, 25] }))!;
    expect(fromSpec(shop, spec).second.text).toBe('Lainee');
  });
});
