import { describe, expect, it } from 'vitest';
import { MARKET_DEFAULTS } from '../metalMarket';
import { priceBreakdown, volumeHints } from '../pricing';
import { DEFAULT_SET, type KaratId, type MetalId, type RenderTooth, type ToothDesign } from '../renderSpec';
import type { TenantPricing } from '../tenant/schema';
import { VVSLAB_CONFIG } from '../tenant/vvslab';

// The next set-price tier, as a live hint in the summary (MAG-216) —
// "4 more 14K teeth → −$50/tooth". Luckey's real table: silver $80, 10K
// $115, 14K $180, 18K $220 a tooth, and a $50 appointment fee.

const LUCKEY: TenantPricing = {
  ...VVSLAB_CONFIG.pricing,
  base: 50,
  baseLabel: 'Appointment fee',
  metalPerTooth: { yellow: 100, white: 100, rose: 100, silver: 80, platinum: 320 },
  karatMultiplier: { '10k': 1.15, '14k': 1.8, '18k': 2.2, '22k': 2.3 },
  setPrices: [
    { size: 12, prices: { silver: 400, '10k': 1250, '14k': 1800, '18k': 2640 } },
    { size: 16, prices: { silver: 500, '10k': 1650, '14k': 2400, '18k': 3520 } },
    { size: 20, prices: { silver: 700, '10k': 2050, '14k': 3000, '18k': 4400 } },
    { size: 24, prices: { silver: 900, '10k': 2450, '14k': 3600, '18k': 5280 } },
  ],
};

// Trax's own ladder, from the teardown's price book: 14K $400 a tooth, and
// the 12-tooth set at $4,200 — $350 a tooth, $50 less per tooth.
const TRAX: TenantPricing = {
  ...VVSLAB_CONFIG.pricing,
  base: 0,
  metalPerTooth: { yellow: 400, white: 400, rose: 400, silver: 110, platinum: 3000 },
  karatMultiplier: { '10k': 1, '14k': 1, '18k': 1, '22k': 1 },
  setPrices: [
    { size: 12, prices: { '14k': 4200 } },
    { size: 16, prices: { '14k': 5200 } },
  ],
};

const tooth = (metal: MetalId, karat: KaratId, extra: Partial<ToothDesign> = {}): ToothDesign => ({
  metal, karat, type: 'plain', style: 'solid', setting: 'honeycomb', stone: 'moissanite', ...extra,
});

// Top teeth first, then bottom: 12 = 6/6, 16 = 8/8, 20 = 10/10, 24 = 12/12.
const setOf = (count: number, metal: MetalId, karat: KaratId, extra: Partial<ToothDesign> = {}): RenderTooth[] => {
  const top = Math.min(count, 12);
  const bottom = count - top;
  return [
    ...Array.from({ length: top }, (_, i) => ({ ...tooth(metal, karat, extra), index: i })),
    ...Array.from({ length: bottom }, (_, i) => ({ ...tooth(metal, karat, extra), index: 16 + i })),
  ];
};

describe('volume hints (MAG-216)', () => {
  it('reproduces the ticket example on a Trax-style ladder: 4 more 14K teeth → −$50/tooth', () => {
    expect(volumeHints(TRAX, setOf(8, 'yellow', '14k'))).toEqual([{ key: '14k', label: '14K', more: 4, saving: 50 }]);
    // And the hinted price is what the customer actually pays at that count:
    // the 12-tooth set is $4,200, $350 a tooth — $400 − $50, exactly.
    const breakdown = priceBreakdown(TRAX, setOf(12, 'yellow', '14k'), DEFAULT_SET);
    expect(breakdown.total).toBe(4200);
    expect(breakdown.lines.find((line) => line.label.startsWith('Metal'))).toEqual({ label: 'Metal · 12 teeth', amount: 4800 });
    expect(breakdown.lines.find((line) => line.label.startsWith('Set price'))).toEqual({ label: 'Set price · 14K · 12 teeth', amount: -600 });
  });

  it('hints below the smallest tier, where the saving is biggest: Luckey 14K at 8 teeth', () => {
    // List price $180 a tooth; the 12-tooth set price is $1,800, $150 a tooth.
    // $180 − $150 = $30/tooth. (The $1,850 total in the set-price table
    // includes the $50 appointment fee — the set price itself is $1,800.)
    expect(volumeHints(LUCKEY, setOf(8, 'yellow', '14k'))).toEqual([{ key: '14k', label: '14K', more: 4, saving: 30 }]);
    // The hinted count confirms it: 12 teeth of 14K cost $1,850 in total.
    expect(priceBreakdown(LUCKEY, setOf(12, 'yellow', '14k'), DEFAULT_SET).total).toBe(1850);
  });

  it('no hint when the ladder is flat above the first tier', () => {
    // Luckey's 14K set prices are $150 a tooth at every tier (12→$1,800,
    // 16→$2,400, 20→$3,000, 24→$3,600) — so at 12 teeth the next tier
    // saves nothing. A hint must never promise a saving that isn't there.
    expect(volumeHints(LUCKEY, setOf(12, 'yellow', '14k'))).toEqual([]);
  });

  it('hints on a tier already reached, against the tier price not the list price', () => {
    // 12 teeth of 10K already pay $1,250/12 = $104.17 a tooth; the 16-tooth
    // set is $1,650, $103.13 a tooth — a $1.04 saving, so −$1/tooth.
    expect(volumeHints(LUCKEY, setOf(12, 'yellow', '10k'))).toEqual([{ key: '10k', label: '10K', more: 4, saving: 1 }]);
  });

  it('no hint when the next tier saves less than a dollar a tooth', () => {
    // 20 teeth of 10K pay $102.50 a tooth; the 24-tooth set is $102.08 —
    // a $0.42 saving, which rounds to $0. A "−$0/tooth" nudge helps nobody.
    expect(volumeHints(LUCKEY, setOf(20, 'yellow', '10k'))).toEqual([]);
  });

  it('no hint at the biggest tier, or with no teeth', () => {
    expect(volumeHints(LUCKEY, setOf(24, 'yellow', '14k'))).toEqual([]);
    expect(volumeHints(LUCKEY, [])).toEqual([]);
  });

  it('no hint for a metal with no set prices', () => {
    expect(volumeHints(LUCKEY, setOf(8, 'platinum', '10k'))).toEqual([]);
    expect(volumeHints({ ...LUCKEY, setPrices: undefined }, setOf(8, 'yellow', '14k'))).toEqual([]);
  });

  it('mixed metals hint per metal, biggest saving first', () => {
    // 8 silver ($80 a tooth → $400/12 = $33.33, −$47) and 8 10K ($115 →
    // $1,250/12 = $104.17, −$11). Silver's saving is bigger, so it leads.
    const mixed = [...setOf(8, 'silver', '10k'), ...setOf(8, 'yellow', '10k')];
    expect(volumeHints(LUCKEY, mixed)).toEqual([
      { key: 'silver', label: 'Silver', more: 4, saving: 47 },
      { key: '10k', label: '10K', more: 4, saving: 11 },
    ]);
  });

  it('one more tooth reads as one more, not four', () => {
    expect(volumeHints(LUCKEY, setOf(11, 'yellow', '14k'))).toEqual([{ key: '14k', label: '14K', more: 1, saving: 30 }]);
  });

  it('no hint on a market-quoted metal — the quote is the price, it moves daily', () => {
    const quoted: TenantPricing = {
      ...LUCKEY,
      market: {
        ...MARKET_DEFAULTS,
        enabled: true,
        quote: { asOf: '2026-11-25T00:00:00.000Z', gold: 4000, silver: 50, platinum: 1600, perTooth: { 'yellow:10k': 140 } },
      },
    };
    expect(volumeHints(quoted, setOf(8, 'yellow', '10k'))).toEqual([]);
    // The same set in silver, which has no quote, still hints.
    expect(volumeHints(quoted, setOf(8, 'silver', '10k'))).toEqual([{ key: 'silver', label: 'Silver', more: 4, saving: 47 }]);
  });

  it('all-in iced teeth do not count toward a tier', () => {
    // 8 plain 14K + 4 iced-all-in 14K: the set-price count is 8, not 12, so
    // the hint still says 4 more — the same count priceBreakdown uses.
    const iced: TenantPricing = { ...LUCKEY, icedPerTooth: { moissanite: { '14k': 300 } } };
    const teeth = [...setOf(8, 'yellow', '14k'), ...setOf(4, 'yellow', '14k', { type: 'iced', style: 'solid' })];
    expect(volumeHints(iced, teeth)).toEqual([{ key: '14k', label: '14K', more: 4, saving: 30 }]);
  });

  it('no hint when the next tier costs more per tooth than the current price', () => {
    // A table where the 12-tooth set is $2,200 — $183.33 a tooth, worse than
    // the $180 list price. A hint must never promise a saving that isn't there.
    const badTable: TenantPricing = { ...LUCKEY, setPrices: [{ size: 12, prices: { '14k': 2200 } }] };
    expect(volumeHints(badTable, setOf(8, 'yellow', '14k'))).toEqual([]);
  });

  it('the % volume discount alone earns no hint — the hint is the set-price ladder', () => {
    const percentOnly: TenantPricing = { ...LUCKEY, setPrices: undefined, volume: [{ minTeeth: 12, percentOff: 10 }] };
    expect(volumeHints(percentOnly, setOf(8, 'yellow', '14k'))).toEqual([]);
  });

  it('a shop hiding its prices gets no hint', () => {
    expect(volumeHints({ ...LUCKEY, display: 'hidden' }, setOf(8, 'yellow', '14k'))).toEqual([]);
  });
});
