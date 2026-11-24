import { afterEach, describe, expect, it, vi } from 'vitest';
import { inscriptionsFrom, placeDrafts, type InscriptionDraft } from '../../../lib/inscriptionDrafts';
import { priceBreakdown } from '../../../lib/pricing';
import type { RenderSpec, SetOptions, ToothDesign } from '../../../lib/renderSpec';
import { startingDesign } from '../../../lib/savedDesign';
import { buildTenant } from '../../../lib/tenant/tenant';
import { VVSLAB_CONFIG } from '../../../lib/tenant/vvslab';
import { fromSnapshot, price, toSnapshot, toSpec } from '../model';

// Launch prep (Nov 24): links and saved designs made by the OLD builder
// (src/components/Configurator.tsx, still live on main) must open in the new
// builder as the same design at the same price. These are written in the old
// builder's format (main's src/lib/savedDesign.ts, version 1: `teeth`, `base`,
// `overrides`, `set` without inscriptions, and the letter `drafts` as edited,
// where a draft the customer didn't place has no teeth and is placed
// automatically by lib/inscriptionDrafts' placeDrafts).

const shop = buildTenant('vvslab', VVSLAB_CONFIG, true);
const SIX_BY_SIX = [5, 6, 7, 8, 9, 10, 21, 22, 23, 24, 25, 26];
const gold: ToothDesign = { metal: 'yellow', karat: '14k', type: 'plain', style: 'solid', setting: 'honeycomb', stone: 'moissanite' };

type OldSnapshot = { v: 1; teeth: number[]; base: ToothDesign; overrides: Record<number, ToothDesign>; set: Omit<SetOptions, 'inscriptions'>; drafts: Omit<InscriptionDraft, 'anchor' | 'auto'>[] };

const OLD: Record<string, OldSnapshot> = {
  // Iced opal (main's MAG-169) with fangs and a permanent look.
  icedOpal: {
    v: 1,
    teeth: SIX_BY_SIX,
    base: { ...gold, type: 'iced', style: 'opals', opal: 'fire', setting: 'prong', stone: 'moissanite' },
    overrides: {},
    set: { fangs: true, cut: 'permanent', vision: 'like my cousin’s', mold: 'own' },
    drafts: [],
  },
  // Two-tone: front two in white gold; short letters left to place themselves ("AB" goes on two teeth).
  twoTone: {
    v: 1,
    teeth: SIX_BY_SIX,
    base: gold,
    overrides: { 7: { ...gold, metal: 'white' }, 8: { ...gold, metal: 'white' } },
    set: { fangs: false, cut: 'deep', vision: '', mold: 'kit' },
    drafts: [{ text: 'AB', style: 'cut', font: 'block', enamel: null, teeth: [] }],
  },
  // Two lines: the first one unplaced, the second tapped onto the top row, so the first goes below.
  twoLines: {
    v: 1,
    teeth: SIX_BY_SIX,
    base: { ...gold, style: 'diamond-cut' },
    overrides: {},
    set: { fangs: false, cut: 'deep', vision: '', mold: 'kit' },
    drafts: [
      { text: 'Lainee', style: 'engraved', font: 'script', enamel: 'pink', teeth: [] },
      { text: 'KING', style: 'iced', font: 'block', enamel: null, teeth: [6, 7, 8, 9] },
    ],
  },
  // Plain open face on a top-only eight with one tapped letter run.
  topEight: {
    v: 1,
    teeth: [4, 5, 6, 7, 8, 9, 10, 11],
    base: { ...gold, metal: 'rose', karat: '10k', style: 'open-face' },
    overrides: { 4: { ...gold, metal: 'rose', karat: '10k', type: 'iced', style: 'solid', setting: 'honeycomb', stone: 'moissanite' } },
    set: { fangs: false, cut: 'deep', vision: '' },
    drafts: [{ text: 'LUV', style: 'cut', font: 'block', enamel: null, teeth: [7] }],
  },
};

/** What the old builder sent and priced for a snapshot: its inscriptions from placeDrafts, every tooth its design. */
function oldSpec(s: OldSnapshot): RenderSpec {
  const inSet = new Set(s.teeth);
  const inscriptions = inscriptionsFrom(placeDrafts(s.drafts.map((d) => ({ ...d, anchor: null })), inSet), inSet);
  // A design kept before the fit step (no `mold`) opens on the shop's default fit, which the new builder always has.
  const mold = s.set.mold ?? shop.defaultSet.mold;
  return { ...s.set, ...(mold ? { mold } : {}), inscriptions, teeth: s.teeth.map((index) => ({ index, ...(s.overrides[index] ?? s.base) })) };
}

/** The old builder's link: #design= and the snapshot as base64url JSON (main's designLink). */
const oldHash = (s: OldSnapshot) => `#design=${Buffer.from(JSON.stringify(s)).toString('base64url')}`;

/** Opens the new builder's start the way CreatorApp does: startingDesign, then fromSnapshot. */
function open(hash: string, stored: Record<string, string> = {}) {
  vi.stubGlobal('window', { location: { hash }, localStorage: { getItem: (k: string) => stored[k] ?? null, setItem: () => {}, removeItem: () => {} } });
  const start = startingDesign(shop);
  return start ? { source: start.source, design: fromSnapshot(shop, start.snapshot) } : null;
}

const comparable = (spec: RenderSpec | null) => spec && { ...spec, inscriptions: [...spec.inscriptions].sort((a, b) => a.teeth[0] - b.teeth[0]) };

describe('old builder links in the new builder', () => {
  afterEach(() => vi.unstubAllGlobals());

  for (const [name, snapshot] of Object.entries(OLD)) {
    it(`opens the ${name} link as the same design at the same price`, () => {
      const opened = open(oldHash(snapshot));
      expect(opened?.source).toBe('link');
      const expected = oldSpec(snapshot);
      expect(comparable(toSpec(opened!.design))).toEqual(comparable(expected));
      expect(price(shop, opened!.design).total).toBe(priceBreakdown(shop.config.pricing, expected.teeth, expected, shop.config.catalog.addOns ?? []).total);
    });

    it(`opens the ${name} design saved on this device by the old builder`, () => {
      const opened = open('', { 'vvslab:design:vvslab': JSON.stringify(snapshot) });
      expect(opened?.source).toBe('saved');
      expect(comparable(toSpec(opened!.design))).toEqual(comparable(oldSpec(snapshot)));
    });
  }

  it('keeps the design the same once the new builder saves it again', () => {
    for (const snapshot of Object.values(OLD)) {
      const first = open(oldHash(snapshot))!.design;
      const again = fromSnapshot(shop, JSON.parse(JSON.stringify(toSnapshot(first))));
      expect(toSpec(again)).toEqual(toSpec(first));
    }
  });

  it('reads a link copied from the live site byte for byte', () => {
    // Made by main's designLink for the twoTone design above.
    const link = 'https://vvslab.magpollo.com/b/vvslab' + oldHash(OLD.twoTone);
    const opened = open(new URL(link).hash);
    expect(toSpec(opened!.design)!.inscriptions).toEqual([{ text: 'AB', teeth: [7, 8], style: 'cut', font: 'block', enamel: null }]);
    expect(opened!.design.designs[7].metal).toBe('white');
  });

  it('starts empty, not broken, on a link the shop no longer sells', () => {
    const gone = { ...OLD.twoTone, base: { ...gold, metal: 'titanium' } } as unknown as OldSnapshot;
    expect(open(oldHash(gone))).toBeNull();
    expect(open('#design=not-base64!')).toBeNull();
  });
});
