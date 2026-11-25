// Randomize a set within a customer budget (MAG-213).
import { describe, expect, it } from 'vitest';
import { MARKET_DEFAULTS } from '../metalMarket';
import { offered, priceBreakdown } from '../pricing';
import { randomizeDesign, seededRng } from '../randomize';
import { validSnapshot, type DesignSnapshot } from '../savedDesign';
import { TOOTH_EXTRAS, type ExtraId, type StyleId } from '../renderSpec';
import { type TenantPricing } from '../tenant/schema';
import { buildTenant, type Tenant } from '../tenant/tenant';
import { VVSLAB_CONFIG } from '../tenant/vvslab';
import { DESIGNS } from './designs';

// Luckey's real table (MAG-204): silver $80, 10K $115, 14K $180, 18K $220 a
// tooth, a $50 appointment fee, deep cuts free, permanent $100 an order.
// Kept in step with the same fixture in setPrices.test.ts.
const LUCKEY: TenantPricing = {
  ...VVSLAB_CONFIG.pricing,
  base: 50,
  baseLabel: 'Appointment fee',
  metalPerTooth: { yellow: 100, white: 100, rose: 100, silver: 80, platinum: 320 },
  karatMultiplier: { '10k': 1.15, '14k': 1.8, '18k': 2.2, '22k': 2.3 },
  stylePerTooth: { solid: 0, 'open-face': 15, 'diamond-cut': 20, 'diamond-dust': 20, engraving: 30, opals: 60 },
  cuts: { deep: { amount: 0, per: 'tooth' }, permanent: { amount: 100, per: 'order' } },
  setPrices: [
    { size: 12, prices: { silver: 400, '10k': 1250, '14k': 1800, '18k': 2640 } },
    { size: 16, prices: { silver: 500, '10k': 1650, '14k': 2400, '18k': 3520 } },
    { size: 20, prices: { silver: 700, '10k': 2050, '14k': 3000, '18k': 4400 } },
    { size: 24, prices: { silver: 900, '10k': 2450, '14k': 3600, '18k': 5280 } },
  ],
  colourSurcharge: { white: 40, rose: 40 },
  extraPerTooth: {
    starburst: 25, pineapple: 25, princess: 20, nugget: 35, 'enamel-fill': 30,
    cross: 150, star: 150, heart: 150, lightning: 175, '3d': 200, 'diamond-shapes': 250, '3d-animal': 250,
    brushed: 0, laser: 0,
  },
};

const LUCKEY_SHOP = buildTenant('luckey', {
  ...VVSLAB_CONFIG,
  catalog: { ...VVSLAB_CONFIG.catalog, extras: TOOTH_EXTRAS.map((extra) => extra.id) },
  pricing: LUCKEY,
});

/** The customer's design as it stands: a plain yellow 10K 6x6 with a deep cut, nothing extra. */
const keep: DesignSnapshot = {
  teeth: DESIGNS.plain6x6.teeth.map((tooth) => tooth.index),
  base: { metal: 'yellow', karat: '10k', type: 'plain', style: 'solid', setting: 'honeycomb', stone: 'moissanite' },
  overrides: {},
  set: { fangs: false, cut: 'deep', vision: '' },
  drafts: [],
};

/** The rolled snapshot priced the same way the builder prices it. The stored
 * snapshot carries no inscriptions — they are derived from its drafts at
 * pricing time, and every test snapshot has no drafts. */
const quote = (shop: Tenant, snapshot: DesignSnapshot) =>
  priceBreakdown(
    shop.config.pricing,
    snapshot.teeth.map((index) => ({ index, ...(snapshot.overrides[index] ?? snapshot.base) })),
    { ...snapshot.set, inscriptions: [] },
    shop.config.catalog.addOns ?? [],
  );

const rollOrThrow = (shop: Tenant, budget: number, seed: number) => {
  const result = randomizeDesign(shop, budget, keep, seededRng(seed));
  if (!result.ok) throw new Error(`expected a roll to fit $${budget}, got minTotal $${result.minTotal}`);
  return result;
};

describe('randomizeDesign', () => {
  it('rolls a set inside the budget and prices it exactly like the builder', () => {
    const result = rollOrThrow(LUCKEY_SHOP, 1500, 7);
    expect(result.total).toBeLessThanOrEqual(1500);
    expect(result.total).toBe(quote(LUCKEY_SHOP, result.snapshot).total);
    expect(validSnapshot(result.snapshot, { slug: LUCKEY_SHOP.slug, config: LUCKEY_SHOP.config })).not.toBeNull();
  });

  it('only rolls what the shop sells, never iced extras or a photo tooth', () => {
    for (let seed = 0; seed < 20; seed++) {
      const { snapshot } = rollOrThrow(LUCKEY_SHOP, 2000, seed);
      const teeth = snapshot.teeth.map((index) => ({ index, ...(snapshot.overrides[index] ?? snapshot.base) }));
      expect(snapshot.teeth.length).toBeGreaterThanOrEqual(2);
      for (const tooth of teeth) {
        expect(LUCKEY_SHOP.catalog.metals.map((metal) => metal.id)).toContain(tooth.metal);
        expect(LUCKEY_SHOP.catalog.karats.map((karat) => karat.id)).toContain(tooth.karat);
        expect(LUCKEY_SHOP.catalog.types.map((type) => type.id)).toContain(tooth.type);
        expect(tooth.type).not.toBe('photo');
        expect(LUCKEY_SHOP.catalog.styles.map((style) => style.id)).toContain(tooth.style);
        expect(LUCKEY_SHOP.catalog.settings.map((setting) => setting.id)).toContain(tooth.setting);
        expect(LUCKEY_SHOP.catalog.stones.map((stone) => stone.id)).toContain(tooth.stone);
        if (tooth.type === 'iced') {
          expect(offered(LUCKEY_SHOP.config.pricing, tooth)).toBe(true);
          expect(tooth.extras ?? []).toEqual([]);
        }
      }
      // The roll adds nothing of its own: no text, no add-ons, no fit choice.
      // (Inscriptions live on the stored snapshot as drafts, not on the set.)
      expect('inscriptions' in snapshot.set).toBe(false);
      expect(snapshot.set.addOns).toBeUndefined();
      expect(snapshot.set.mold).toBeUndefined();
      expect(snapshot.drafts).toEqual([]);
    }
  });

  it('returns null with the cheapest set total when nothing fits', () => {
    const result = randomizeDesign(LUCKEY_SHOP, 200, keep, seededRng(1));
    expect(result.ok).toBe(false);
    if (result.ok) throw new Error('expected no roll to fit $200');
    // The cheapest set the engine can price: a plain 2-piece in silver plus the fee.
    const cheapest = priceBreakdown(
      LUCKEY_SHOP.config.pricing,
      [7, 8].map((index) => ({ index, metal: 'silver' as const, karat: '10k' as const, type: 'plain' as const, style: 'solid' as const, setting: 'honeycomb' as const, stone: 'moissanite' as const })),
      { fangs: false, cut: 'deep', vision: '', inscriptions: [] },
      LUCKEY_SHOP.config.catalog.addOns ?? [],
    );
    expect(result.minTotal).toBe(cheapest.total);
    expect(result.minTotal).toBe(210);
  });

  it('never picks an option the shop sells but never priced', () => {
    // Cross is on the menu and so is the engraving style — but neither has a
    // price entry, so picking one would invent a free option.
    const { cross, ...extraPerTooth } = LUCKEY.extraPerTooth!;
    const { engraving, ...stylePerTooth } = LUCKEY.stylePerTooth!;
    const trap = buildTenant('luckey', {
      ...VVSLAB_CONFIG,
      catalog: { ...VVSLAB_CONFIG.catalog, extras: TOOTH_EXTRAS.map((extra) => extra.id) },
      pricing: { ...LUCKEY, extraPerTooth, stylePerTooth },
    });
    const pickedExtras = new Set<ExtraId>();
    const pickedStyles = new Set<StyleId>();
    for (let seed = 0; seed < 50; seed++) {
      const { snapshot } = rollOrThrow(trap, 2000, seed);
      for (const index of snapshot.teeth) {
        const tooth = snapshot.overrides[index] ?? snapshot.base;
        (tooth.extras ?? []).forEach((extra) => pickedExtras.add(extra));
        pickedStyles.add(tooth.style);
      }
    }
    expect(pickedExtras.has('cross')).toBe(false);
    expect(pickedStyles.has('engraving')).toBe(false);
    expect(pickedExtras.size).toBeGreaterThan(0);
  });

  it('is deterministic for the same seed', () => {
    const first = rollOrThrow(LUCKEY_SHOP, 1500, 42);
    const second = rollOrThrow(LUCKEY_SHOP, 1500, 42);
    expect(second.snapshot).toEqual(first.snapshot);
    expect(second.total).toBe(first.total);
  });

  it('respects set prices: a 12-tooth 10K roll shows the Set price line', () => {
    // One metal, one karat, plain solid only — every roll is a plain 10K set,
    // so a 12-tooth roll must price through the 12-tooth set price.
    const shop = buildTenant('luckey', {
      ...VVSLAB_CONFIG,
      catalog: {
        ...VVSLAB_CONFIG.catalog,
        metals: ['yellow'],
        karats: ['10k'],
        types: ['plain'],
        styles: ['solid'],
        settings: ['honeycomb'],
        stones: ['moissanite'],
        extras: [],
        fangs: false,
      },
      pricing: LUCKEY,
    });
    const twelveTooth = [];
    for (let seed = 0; seed < 20; seed++) {
      const { snapshot } = rollOrThrow(shop, 1300, seed);
      if (snapshot.teeth.length !== 12) continue;
      expect(new Set(snapshot.teeth.map((index) => JSON.stringify(snapshot.overrides[index] ?? snapshot.base)))).toHaveLength(1);
      const lines = quote(shop, snapshot).lines;
      expect(lines.some((line) => line.label.startsWith('Set price'))).toBe(true);
      twelveTooth.push(seed);
    }
    expect(twelveTooth.length).toBeGreaterThan(0);
  });

  it('never rolls below the shop fee, and a budget at the cheapest set lands on it exactly', () => {
    for (let seed = 0; seed < 10; seed++) {
      const { total } = rollOrThrow(LUCKEY_SHOP, 2000, seed);
      expect(total).toBeGreaterThanOrEqual(LUCKEY.base);
    }
    // A budget at the cheapest set lands on it exactly, whatever the roll
    // starts as — including a set-priced 12-tooth candidate, which costs LESS
    // than 8 teeth at per-tooth, so the repair has to step past the sizes
    // that don't bring the total down before it reaches the 2-piece.
    for (let seed = 0; seed < 100; seed++) {
      const exact = rollOrThrow(LUCKEY_SHOP, 210, seed);
      expect(exact.total).toBe(210);
    }
  });

  it('rolls at every budget at or above the cheapest set', () => {
    for (const budget of [210, 250, 300, 500, 1000, 1500, 2000, 3000]) {
      for (let seed = 0; seed < 20; seed++) {
        const result = rollOrThrow(LUCKEY_SHOP, budget, seed);
        expect(result.total).toBeLessThanOrEqual(budget);
        expect(result.total).toBe(quote(LUCKEY_SHOP, result.snapshot).total);
      }
    }
  });

  it('returns null when the budget is below the minimum order', () => {
    const shop = buildTenant('luckey', {
      ...VVSLAB_CONFIG,
      catalog: { ...VVSLAB_CONFIG.catalog, extras: TOOTH_EXTRAS.map((extra) => extra.id) },
      pricing: { ...LUCKEY, minimumOrder: 500 },
    });
    const result = randomizeDesign(shop, 400, keep, seededRng(1));
    expect(result.ok).toBe(false);
    if (result.ok) throw new Error('expected no roll below the $500 minimum order');
    expect(result.minTotal).toBe(500);
  });

  it('rolls a variety of sets across seeds', () => {
    const counts = new Set<number>();
    const metals = new Set<string>();
    for (let seed = 0; seed < 10; seed++) {
      const { snapshot } = rollOrThrow(LUCKEY_SHOP, 2000, seed);
      counts.add(snapshot.teeth.length);
      metals.add(snapshot.base.metal);
    }
    expect(counts.size >= 3 || metals.size >= 3).toBe(true);
  });

  it('rolls for a shop that turned solid off — no phantom solid set (MAG-213 review F1)', () => {
    // Solid is not on the menu: the cheapest finish the shop prices is
    // open-face ($15), so the cheapest 2-piece is 2× silver $80 + 2× $15 +
    // $50 fee = $240. A roll that assumes solid exists prices a phantom
    // $210 set that fails validation and throws the fit away.
    const shop = buildTenant('luckey', {
      ...VVSLAB_CONFIG,
      catalog: {
        ...VVSLAB_CONFIG.catalog,
        styles: ['open-face', 'diamond-cut'],
        extras: TOOTH_EXTRAS.map((extra) => extra.id),
      },
      pricing: { ...LUCKEY, stylePerTooth: { 'open-face': 15, 'diamond-cut': 20 } },
    });
    const tooSmall = randomizeDesign(shop, 230, keep, seededRng(1));
    expect(tooSmall.ok).toBe(false);
    if (tooSmall.ok) throw new Error('expected no roll to fit $230');
    expect(tooSmall.minTotal).toBe(240);
    // At the cheapest set's price and above, every roll fits, prices
    // exactly, and never wears a style the shop doesn't sell.
    for (let seed = 0; seed < 20; seed++) {
      for (const budget of [240, 500, 2000]) {
        const result = randomizeDesign(shop, budget, keep, seededRng(seed));
        expect(result.ok).toBe(true);
        if (!result.ok) throw new Error(`expected a roll to fit $${budget} (seed ${seed}), got minTotal $${result.minTotal}`);
        expect(result.total).toBeLessThanOrEqual(budget);
        expect(result.total).toBe(quote(shop, result.snapshot).total);
        for (const index of result.snapshot.teeth) {
          expect((result.snapshot.overrides[index] ?? result.snapshot.base).style).not.toBe('solid');
        }
      }
    }
  });

  it('steps past quoted metals whose list price disagrees with the engine (MAG-213 review F2)', () => {
    // Gold quoted per tooth; the colour surcharge does NOT apply on top of
    // a quote, so rose 18k costs the engine $230 a tooth — the same as
    // yellow 18k — even though the fixed-price list says $260. A step-down
    // that trusts the list price stalls above the budget instead of
    // reaching silver or yellow 10k.
    const quoted: TenantPricing = {
      ...LUCKEY,
      market: {
        ...MARKET_DEFAULTS,
        enabled: true,
        quote: {
          asOf: '2026-11-25T00:00:00.000Z', gold: 4000, silver: 50, platinum: 1600,
          perTooth: {
            'yellow:10k': 140, 'yellow:14k': 180, 'yellow:18k': 230,
            'white:10k': 140, 'white:14k': 180, 'white:18k': 230,
            'rose:10k': 140, 'rose:14k': 180, 'rose:18k': 230,
          },
        },
      },
    };
    const shop = buildTenant('luckey', {
      ...VVSLAB_CONFIG,
      catalog: { ...VVSLAB_CONFIG.catalog, extras: TOOTH_EXTRAS.map((extra) => extra.id) },
      pricing: quoted,
    });
    for (let seed = 0; seed < 100; seed++) {
      const result = randomizeDesign(shop, 500, keep, seededRng(seed));
      expect(result.ok).toBe(true);
      if (!result.ok) throw new Error(`expected a roll to fit $500 (seed ${seed}), got minTotal $${result.minTotal}`);
      expect(result.total).toBeLessThanOrEqual(500);
      expect(result.total).toBe(quote(shop, result.snapshot).total);
    }
  });

  it('spends up toward the budget: a $5,000 roll lands much closer than $1,510 (MAG-222)', () => {
    // Cowork's preview test (Nov 25): nine rolls at $800/$2,000/$5,000 all
    // came in under budget, but one $5,000 roll came to only $1,510 — the
    // old spend-up was a single upgrade attempt. The roll now keeps
    // upgrading until it reaches 85% of the budget (or no fitting upgrade
    // exists), so the distribution, not just the best seed, must sit near
    // the budget. (Thresholds are the design target — confirm against the
    // real distribution when the suite runs; adjust with evidence if the
    // loop stalls below them on some seeds.)
    const totals: number[] = [];
    for (let seed = 0; seed < 20; seed++) {
      const result = rollOrThrow(LUCKEY_SHOP, 5000, seed);
      expect(result.total).toBeLessThanOrEqual(5000);
      expect(result.total).toBe(quote(LUCKEY_SHOP, result.snapshot).total);
      // The spend-up never touches the customer's own choices.
      expect(result.snapshot.set.cut).toBe('deep');
      totals.push(result.total);
    }
    totals.sort((a, b) => a - b);
    const median = (totals[9] + totals[10]) / 2;
    // At least half the rolls land within 85% of the budget, and even the
    // worst roll spends half of it — the old worst was 30% ($1,510).
    expect(median).toBeGreaterThanOrEqual(0.85 * 5000);
    expect(totals[0]).toBeGreaterThanOrEqual(0.5 * 5000);
  });

  it('spends up at smaller budgets too, without breaking the budget', () => {
    for (const budget of [800, 2000]) {
      const totals: number[] = [];
      for (let seed = 0; seed < 20; seed++) {
        const result = rollOrThrow(LUCKEY_SHOP, budget, seed);
        expect(result.total).toBeLessThanOrEqual(budget);
        expect(result.total).toBe(quote(LUCKEY_SHOP, result.snapshot).total);
        totals.push(result.total);
      }
      totals.sort((a, b) => a - b);
      const median = (totals[9] + totals[10]) / 2;
      expect(median).toBeGreaterThanOrEqual(0.85 * budget);
    }
  });

  it('spends up on a different shop table, not just Luckey (MAG-222)', () => {
    // Fresh fixture, different numbers: no colour surcharge, smaller set
    // ladder, $30 fee. The ceiling (~$1,930 for 16 teeth 14K) sits above
    // the 85% target ($1,700), so the target is reachable here too.
    const fresh: TenantPricing = {
      ...VVSLAB_CONFIG.pricing,
      base: 30,
      metalPerTooth: { yellow: 100, white: 100, rose: 100, silver: 70, platinum: 300 },
      karatMultiplier: { '10k': 1.1, '14k': 1.6, '18k': 2.0, '22k': 2.3 },
      stylePerTooth: { solid: 0, 'open-face': 10, 'diamond-cut': 15, 'diamond-dust': 15, engraving: 25, opals: 50 },
      cuts: { deep: { amount: 0, per: 'tooth' }, permanent: { amount: 80, per: 'order' } },
      setPrices: [
        { size: 12, prices: { silver: 700, '10k': 1100, '14k': 1500 } },
        { size: 16, prices: { silver: 850, '10k': 1350, '14k': 1900 } },
        { size: 20, prices: { silver: 1000, '10k': 1600, '14k': 2300 } },
        { size: 24, prices: { silver: 1150, '10k': 1850, '14k': 2600 } },
      ],
      colourSurcharge: { white: 0, rose: 0 },
      extraPerTooth: { starburst: 20, pineapple: 20, princess: 15, nugget: 30, 'enamel-fill': 25, brushed: 0, laser: 0 },
    };
    const shop = buildTenant('fresh', {
      ...VVSLAB_CONFIG,
      catalog: { ...VVSLAB_CONFIG.catalog, extras: TOOTH_EXTRAS.map((extra) => extra.id) },
      pricing: fresh,
    });
    const totals: number[] = [];
    for (let seed = 0; seed < 20; seed++) {
      const result = rollOrThrow(shop, 2000, seed);
      expect(result.total).toBeLessThanOrEqual(2000);
      expect(result.total).toBe(quote(shop, result.snapshot).total);
      totals.push(result.total);
    }
    totals.sort((a, b) => a - b);
    const median = (totals[9] + totals[10]) / 2;
    expect(median).toBeGreaterThanOrEqual(0.85 * 2000);
    // Worst-seed floor is 40%, not 50%: the worst seed ($970, seed 7) is a
    // 2-piece platinum iced set — every upgrade kind is unavailable (already
    // platinum, already iced, no extras on iced, no canine for fangs) or
    // overshoots (biggerSet jumps to 6 teeth past the budget). It is a
    // structural local maximum, not a loop failure: the old code produced
    // the same $970 on that seed. The old worst across 20 seeds was $480
    // (24%), so a 40% floor still catches a regression to single-upgrade
    // while the new worst ($970) clears it with margin.
    expect(totals[0]).toBeGreaterThanOrEqual(0.4 * 2000);
  });
});
