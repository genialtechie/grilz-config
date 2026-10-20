import { priceBreakdown } from './pricing.js';
import { DEFAULT_SET, type RenderTooth, type ToothDesign } from './renderSpec.js';
import type { TenantPricing } from './tenant/schema.js';

// Quick pricing (MAG-90): a jeweler answers three questions and every other
// price comes from them by these ratios, taken from how Atlanta shops price
// (the VVS Lab sample prices follow them too). Tune them here after asking
// jewelers on the shop run; the builder, the server and the tests all read
// them from this one place.

export const QUICK_RATIOS = {
  /** Per-tooth gold by karat, against 10K. */
  karat: { '10k': 1, '14k': 1.4, '18k': 1.85, '22k': 2.3 },
  /** White and rose gold cost the same as yellow; silver and platinum against 10K gold. */
  silver: 0.57,
  platinum: 2.1,
  /** Diamonds against the moissanite add-on (the iced price minus the gold). */
  lab: 2.1,
  natural: 4.3,
  /** Finishes as a share of a 10K gold tooth (about 25–30%; opals are inlaid stones). */
  finish: { solid: 0, 'open-face': 0.27, 'diamond-cut': 0.25, 'diamond-dust': 0.25, engraving: 0.3, opals: 0.6 },
  /** The mosaic setting against the moissanite add-on; honeycomb and prong are in the iced price. */
  mosaic: 0.33,
  /** A pair of fangs costs about one gold tooth. */
  fangs: 1,
} as const;

export type QuickAnswers = {
  /** 10K gold, per tooth. */
  gold: number;
  /** Iced in 10K with moissanite, per tooth, all in. */
  iced: number;
  /** A service fee on every order, or a minimum order, or neither. */
  fee: { kind: 'service' | 'minimum' | 'none'; amount: number };
};

const round5 = (value: number) => Math.round(value / 5) * 5;
const round2 = (value: number) => Math.round(value * 100) / 100;

/** The three answers a shop's prices give back (to prefill the questions). */
export function quickAnswers(pricing: TenantPricing): QuickAnswers {
  const gold = pricing.metalPerTooth.yellow ?? pricing.metalPerTooth.white ?? 0;
  const fee: QuickAnswers['fee'] = pricing.base > 0 ? { kind: 'service', amount: pricing.base } : pricing.minimumOrder > 0 ? { kind: 'minimum', amount: pricing.minimumOrder } : { kind: 'none', amount: 0 };
  return { gold, iced: gold + (pricing.stonePerTooth.moissanite ?? 0), fee };
}

/**
 * Every price from the three answers. What the questions don't cover stays as
 * it was: price display, deposits, inscription, photo and permanent-look fees,
 * fit fees, set discounts, back teeth, iced open face and market-linked metal.
 */
export function quickPricing(pricing: TenantPricing, answers: QuickAnswers): TenantPricing {
  const gold = Math.max(0, Math.round(answers.gold));
  const stone = Math.max(0, Math.round(answers.iced) - gold);
  const finish = Object.fromEntries(Object.entries(QUICK_RATIOS.finish).map(([style, share]) => [style, round5(gold * share)]));
  return {
    ...pricing,
    source: 'quick',
    base: answers.fee.kind === 'service' ? Math.max(0, Math.round(answers.fee.amount)) : 0,
    minimumOrder: answers.fee.kind === 'minimum' ? Math.max(0, Math.round(answers.fee.amount)) : 0,
    metalPerTooth: { yellow: gold, white: gold, rose: gold, silver: round5(gold * QUICK_RATIOS.silver), platinum: round5(gold * QUICK_RATIOS.platinum) },
    karatMultiplier: { ...QUICK_RATIOS.karat },
    stylePerTooth: finish,
    stonePerTooth: { moissanite: stone, lab: round5(stone * QUICK_RATIOS.lab), natural: round5(stone * QUICK_RATIOS.natural) },
    settingPerTooth: { honeycomb: 0, mosaic: round5(stone * QUICK_RATIOS.mosaic), prong: 0 },
    extras: { ...pricing.extras, fangs: round5(gold * QUICK_RATIOS.fangs) },
  };
}

// ---------- The check screen ----------

/** A line on the check screen: a 6-top in one option, and the per-tooth price that sets it. */
export type CheckLine = { id: 'gold10k' | 'gold14k' | 'gold18k' | 'iced' | 'icedLab'; label: string; total: number; perTooth: number };

const SIX_TOP = [5, 6, 7, 8, 9, 10];
const tooth = (design: Partial<ToothDesign>): ToothDesign => ({ metal: 'yellow', karat: '10k', type: 'plain', style: 'solid', setting: 'honeycomb', stone: 'moissanite', ...design });

/** What a 6-top costs in each option, before any service fee or minimum. */
export function checkLines(pricing: TenantPricing): CheckLine[] {
  const teethOnly = { ...pricing, base: 0, minimumOrder: 0 };
  const six = (design: Partial<ToothDesign>) => priceBreakdown(teethOnly, SIX_TOP.map((index): RenderTooth => ({ ...tooth(design), index })), DEFAULT_SET).total;
  const lines: Omit<CheckLine, 'perTooth'>[] = [
    { id: 'gold10k', label: '10K gold', total: six({}) },
    { id: 'gold14k', label: '14K gold', total: six({ karat: '14k' }) },
    { id: 'gold18k', label: '18K gold', total: six({ karat: '18k' }) },
    { id: 'iced', label: 'Iced, moissanite (10K)', total: six({ type: 'iced' }) },
    { id: 'icedLab', label: 'Iced, lab diamonds (10K)', total: six({ type: 'iced', stone: 'lab' }) },
  ];
  return lines.map((line) => ({ ...line, perTooth: Math.round(line.total / SIX_TOP.length) }));
}

/** Tapping a line and changing its per-tooth price: the one price behind it changes. */
export function editLine(pricing: TenantPricing, id: CheckLine['id'], perTooth: number): TenantPricing {
  const value = Math.max(0, Math.round(perTooth));
  const gold = pricing.metalPerTooth.yellow ?? 0;
  const next: TenantPricing = { ...pricing, source: 'quick' };
  if (id === 'gold10k') {
    // The new gold price flows through the ratios, but a 14K/18K or lab price set on this screen stays as set.
    const derived = quickPricing(pricing, { ...quickAnswers(pricing), gold: value, iced: value + (pricing.stonePerTooth.moissanite ?? 0) });
    return { ...derived, karatMultiplier: { ...pricing.karatMultiplier }, stonePerTooth: { ...derived.stonePerTooth, lab: pricing.stonePerTooth.lab ?? derived.stonePerTooth.lab, natural: pricing.stonePerTooth.natural ?? derived.stonePerTooth.natural } };
  }
  if (id === 'gold14k' || id === 'gold18k') {
    const karat = id === 'gold14k' ? '14k' : '18k';
    return { ...next, karatMultiplier: { ...pricing.karatMultiplier, [karat]: gold > 0 ? round2(value / gold) : QUICK_RATIOS.karat[karat] } };
  }
  if (id === 'iced') return { ...next, stonePerTooth: { ...pricing.stonePerTooth, moissanite: Math.max(0, value - gold) } };
  return { ...next, stonePerTooth: { ...pricing.stonePerTooth, lab: Math.max(0, value - gold) } };
}
