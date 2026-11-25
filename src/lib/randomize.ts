// Randomize a set within a customer budget (MAG-213): "Roll it" builds a
// random set inside the shop's own prices. Every candidate is priced with
// priceBreakdown — the same engine the builder and the server use — so the
// rolled total is exactly what the customer pays, and no option is ever
// picked that the shop hasn't priced.

import { inscriptionsFrom, placeDrafts } from './inscriptionDrafts.js';
import { colourPerTooth, metalPerTooth, metalQuoted, nearestOffered, priceBreakdown } from './pricing.js';
import { validSnapshot, type DesignSnapshot } from './savedDesign.js';
import {
  FANG_TEETH,
  isGold,
  type ExtraId,
  type KaratId,
  type MetalId,
  type RenderTooth,
  type SetOptions,
  type StoneId,
  type StyleId,
  type ToothDesign,
} from './renderSpec.js';
import type { Tenant } from './tenant/tenant.js';

/** A shop the builder can randomize for: its config plus the derived catalog and defaults. */
export type RandomizeShop = Pick<Tenant, 'slug' | 'config' | 'catalog' | 'defaultTooth' | 'defaultSet'>;

export type RandomizeResult = { ok: true; snapshot: DesignSnapshot; total: number } | { ok: false; minTotal: number };

export type Rng = () => number;

/** A small deterministic PRNG (mulberry32) for tests and repeatable rolls. */
export const seededRng = (seed: number): Rng => {
  let state = seed >>> 0;
  return () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let value = state;
    value = Math.imul(value ^ (value >>> 15), value | 1);
    value ^= value + Math.imul(value ^ (value >>> 7), value | 61);
    return ((value ^ (value >>> 14)) >>> 0) / 4294967296;
  };
};

/** Price calls per roll, so a pathological shop can't spin the repair loop forever. */
const MAX_PRICE_CALLS = 500;
/** Below this share of the budget, the roll tries one upgrade so a big budget doesn't return a small set. */
const SPEND_UP_SHARE = 0.85;
/** The front two teeth get a second metal this often — the two-tone look. */
const TWO_TONE_CHANCE = 0.25;
/** A plain set gets a named extra on a few teeth this often. */
const EXTRA_CHANCE = 0.3;
/** Fangs go on this often, when the shop sells them and the set has an upper canine. */
const FANG_CHANCE = 0.25;

/** Set sizes from the builder's own Popular sets menu, smallest first; 'single' is not a roll. */
const SET_SIZES = [
  { id: 'two', top: 2, bottom: 0 },
  { id: 'top6', top: 6, bottom: 0 },
  { id: 'top8', top: 8, bottom: 0 },
  { id: '6x6', top: 6, bottom: 6 },
  { id: '8x8', top: 8, bottom: 8 },
  { id: '10x10', top: 10, bottom: 10 },
  { id: 'full', top: 16, bottom: 16 },
] as const;

type SetSize = (typeof SET_SIZES)[number];

/** The finishes an iced tooth can take (solid, or stones round a border). */
const ICED_STYLES: StyleId[] = ['solid', 'open-face', 'opals'];

const pick = <T>(items: readonly T[], rng: Rng): T => items[Math.floor(rng() * items.length)];

const shuffle = <T>(items: readonly T[], rng: Rng): T[] => {
  const out = [...items];
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
};

/** Centred teeth in one row, mirroring the builder's own centred sets. */
const centeredRow = (count: number, offset: 0 | 16): number[] => {
  const start = Math.floor((16 - count) / 2);
  return Array.from({ length: count }, (_, i) => offset + start + i);
};

const teethFor = (size: SetSize): number[] => [...centeredRow(size.top, 0), ...centeredRow(size.bottom, 16)];

/** One metal/karat combination the shop sells, with what a tooth of it costs (metal plus any colour surcharge). */
type MetalCombo = { metal: MetalId; karat: KaratId };

const combosOf = (shop: RandomizeShop): MetalCombo[] => {
  const list: MetalCombo[] = [];
  for (const metal of shop.catalog.metals) {
    const karats = isGold(metal.id) ? shop.catalog.karats.map((karat) => karat.id) : (['10k'] as const);
    for (const karat of karats) list.push({ metal: metal.id, karat });
  }
  return list;
};

/** One metal/karat combination's list price per tooth — aligned with the engine: the colour surcharge does NOT apply on top of a market quote (the engine's colourOf returns 0 for quoted teeth), so a quoted rose tooth costs the same as a quoted yellow one. Used only to order combinations; the engine always prices the roll. */
const comboPrice = (shop: RandomizeShop, combo: MetalCombo) =>
  metalPerTooth(shop.config.pricing, combo.metal, combo.karat) +
  (metalQuoted(shop.config.pricing, combo.metal, combo.karat) ? 0 : colourPerTooth(shop.config.pricing, combo.metal));

/** The shop's metal/karat combinations, cheapest first. */
const sortedCombos = (shop: RandomizeShop) => combosOf(shop).sort((a, b) => comboPrice(shop, a) - comboPrice(shop, b));

/**
 * Styles and extras the roll may pick: only ones with a price entry. A shop
 * sells an option it never priced charges $0 for it (the engine's `?? 0`),
 * which would invent a free option — so an unpriced option is out of the
 * pool. An explicit $0 (brushed, laser) is a real price and stays in.
 */
const pricedStyles = (shop: RandomizeShop): StyleId[] => {
  const priced = shop.catalog.styles.map((style) => style.id).filter((style) => shop.config.pricing.stylePerTooth?.[style] !== undefined);
  return priced.length ? priced : [shop.defaultTooth.style];
};

/**
 * The cheapest finish the shop actually prices — the fallback plain style
 * for rolls and repairs. Never 'solid' by assumption: a shop can turn solid
 * off, and a plain tooth in a style the shop doesn't sell fails validation.
 * Falls back to the shop's default tooth style, which is always in the
 * catalog (and priced in every schema-valid config).
 */
const cheapestStyle = (shop: RandomizeShop): StyleId => {
  const priced = pricedStyles(shop);
  return priced.reduce((cheapest, style) =>
    (shop.config.pricing.stylePerTooth?.[style] ?? 0) <= (shop.config.pricing.stylePerTooth?.[cheapest] ?? 0) ? style : cheapest,
  );
};

const pricedExtras = (shop: RandomizeShop): ExtraId[] =>
  shop.catalog.extras.map((extra) => extra.id).filter((extra) => shop.config.pricing.extraPerTooth?.[extra] !== undefined);

/** Two designs the same tooth? (For dropping overrides that no longer differ from the base.) */
const sameTooth = (a: ToothDesign, b: ToothDesign) =>
  a.metal === b.metal &&
  a.karat === b.karat &&
  a.type === b.type &&
  a.style === b.style &&
  a.setting === b.setting &&
  a.stone === b.stone &&
  (a.opal ?? 'white') === (b.opal ?? 'white') &&
  JSON.stringify(a.extras ?? []) === JSON.stringify(b.extras ?? []);

/** A candidate roll: the set size, the shared tooth design, per-tooth differences, and fangs. */
type Candidate = { size: SetSize; base: ToothDesign; overrides: Record<number, ToothDesign>; fangs: boolean };

/** Drop overrides for teeth no longer in the set, and ones that no longer differ from the base. */
const prune = (candidate: Candidate): Candidate => {
  const teeth = new Set(teethFor(candidate.size));
  const overrides = Object.fromEntries(
    Object.entries(candidate.overrides).filter(([index, design]) => teeth.has(Number(index)) && !sameTooth(design, candidate.base)),
  );
  return { ...candidate, overrides };
};

const toTeeth = (candidate: Candidate): RenderTooth[] =>
  teethFor(candidate.size).map((index) => ({ index, ...(candidate.overrides[index] ?? candidate.base) }));

/** The candidate as the engine prices it: the customer's own cut, fit, add-ons and text stay in. */
const toSet = (candidate: Candidate, keep: DesignSnapshot, teeth: number[]): SetOptions => {
  const inSet = new Set(teeth);
  return { ...keep.set, fangs: candidate.fangs, inscriptions: inscriptionsFrom(placeDrafts(keep.drafts, inSet), inSet) };
};

/** The cheapest set the roll can make: a 2-piece in the cheapest metal, plain, no extras, no fangs. */
const cheapestTotal = (shop: RandomizeShop, keep: DesignSnapshot): number => {
  const combos = sortedCombos(shop);
  const teeth = centeredRow(2, 0);
  if (!combos.length) {
    return priceBreakdown(shop.config.pricing, [], { ...keep.set, fangs: false, inscriptions: [] }, shop.config.catalog.addOns ?? []).total;
  }
  const cheapest = combos[0];
  const base: ToothDesign = { ...shop.defaultTooth, metal: cheapest.metal, karat: cheapest.karat, type: 'plain', style: cheapestStyle(shop) };
  const set: SetOptions = {
    ...keep.set,
    fangs: false,
    inscriptions: inscriptionsFrom(placeDrafts(keep.drafts, new Set(teeth)), new Set(teeth)),
  };
  return priceBreakdown(shop.config.pricing, teeth.map((index) => ({ index, ...base })), set, shop.config.catalog.addOns ?? []).total;
};

/**
 * The cheapest set the shop sells, as a snapshot — the design cheapestTotal
 * prices. Returned when the repair loop runs out of price calls (N4): a fit
 * exists, so failing the roll would be wrong. Null when there is no metal
 * to roll with, or the cheapest set fails validation.
 */
const cheapestSnapshot = (shop: RandomizeShop, keep: DesignSnapshot): DesignSnapshot | null => {
  const combos = sortedCombos(shop);
  if (!combos.length) return null;
  const teeth = centeredRow(2, 0);
  const snapshot: DesignSnapshot = {
    teeth,
    base: { ...shop.defaultTooth, metal: combos[0].metal, karat: combos[0].karat, type: 'plain', style: cheapestStyle(shop) },
    overrides: {},
    set: { ...keep.set, fangs: false },
    drafts: keep.drafts,
  };
  return validSnapshot(snapshot, { slug: shop.slug, config: shop.config }) ? snapshot : null;
};

/** One base tooth design from what the shop sells; iced lands on a combination the shop prices, else plain. */
const rollBase = (shop: RandomizeShop, styles: StyleId[], combos: MetalCombo[], rng: Rng): ToothDesign | null => {
  const { catalog, config: { pricing } } = shop;
  const types = catalog.types.map((type) => type.id).filter((type) => type !== 'photo');
  if (!types.length || !combos.length) return null;
  const type = pick(types, rng);
  const combo = pick(combos, rng);
  const settings = catalog.settings.map((setting) => setting.id);
  const stones: StoneId[] = catalog.stones.map((stone) => stone.id);
  const karats: KaratId[] = catalog.karats.map((karat) => karat.id);
  // Iced teeth take no finish but solid/open-face/opals: other finishes are
  // invisible on an iced tooth, so they are not in the iced pool.
  const stylePool = type === 'iced' ? ICED_STYLES.filter((style) => styles.includes(style)) : styles;
  const base: ToothDesign = {
    ...shop.defaultTooth,
    metal: combo.metal,
    karat: combo.karat,
    type,
    style: pick(stylePool.length ? stylePool : [cheapestStyle(shop)], rng),
    setting: settings.length ? pick(settings, rng) : shop.defaultTooth.setting,
    stone: stones.length ? pick(stones, rng) : shop.defaultTooth.stone,
  };
  if (type !== 'iced') return base;
  if (!settings.length || !stones.length) return { ...base, type: 'plain', style: cheapestStyle(shop) };
  return nearestOffered(pricing, base, stones, karats) ?? { ...base, type: 'plain', style: cheapestStyle(shop) };
};

/** The front two teeth in a second metal, when the set has them and the shop sells another metal. */
const withTwoTone = (shop: RandomizeShop, candidate: Candidate, rng: Rng): Record<number, ToothDesign> => {
  const overrides = { ...candidate.overrides };
  if (rng() >= TWO_TONE_CHANCE) return overrides;
  const teeth = teethFor(candidate.size);
  const front = [7, 8].filter((index) => teeth.includes(index));
  if (!front.length) return overrides;
  const others = shop.catalog.metals.map((metal) => metal.id).filter((metal) => metal !== candidate.base.metal);
  if (!others.length) return overrides;
  const metal = pick(others, rng);
  const karatIds = shop.catalog.karats.map((item) => item.id);
  const karat = isGold(metal) ? (karatIds.length ? pick(karatIds, rng) : '10k') : '10k';
  const { pricing } = shop.config;
  const stones: StoneId[] = shop.catalog.stones.map((stone) => stone.id);
  const karats: KaratId[] = shop.catalog.karats.map((item) => item.id);
  for (const index of front) {
    const design = { ...(overrides[index] ?? candidate.base), metal, karat };
    // An iced front tooth in the new metal needs a combination the shop
    // prices; when there is none the tooth keeps the base design.
    const resolved = design.type === 'iced' ? nearestOffered(pricing, design, stones, karats) : design;
    if (resolved) overrides[index] = resolved;
  }
  return overrides;
};

/** A named extra on a few plain teeth, when the shop prices one. Never on iced teeth. */
const withExtras = (candidate: Candidate, extras: ExtraId[], rng: Rng): Record<number, ToothDesign> => {
  const overrides = { ...candidate.overrides };
  if (candidate.base.type === 'iced' || !extras.length || rng() >= EXTRA_CHANCE) return overrides;
  const extra = pick(extras, rng);
  const teeth = shuffle(teethFor(candidate.size), rng);
  const count = 1 + Math.floor(rng() * Math.min(3, teeth.length));
  teeth.slice(0, count).forEach((index) => {
    const design = overrides[index] ?? candidate.base;
    if (design.type !== 'iced' && !(design.extras ?? []).length) overrides[index] = { ...design, extras: [extra] };
  });
  return overrides;
};

const rollCandidate = (shop: RandomizeShop, styles: StyleId[], extras: ExtraId[], combos: MetalCombo[], rng: Rng): Candidate | null => {
  const size = pick(SET_SIZES, rng);
  const base = rollBase(shop, styles, combos, rng);
  if (!base) return null;
  const candidate: Candidate = { size, base, overrides: {}, fangs: false };
  candidate.overrides = withTwoTone(shop, candidate, rng);
  candidate.overrides = withExtras(candidate, extras, rng);
  candidate.fangs = shop.catalog.fangs && teethFor(size).some((index) => FANG_TEETH.includes(index)) && rng() < FANG_CHANCE;
  return prune(candidate);
};

// ---- Downgrades: each returns the next candidate, or null when it doesn't apply. ----

const dropExtras = (candidate: Candidate): Candidate | null => {
  if (!Object.values(candidate.overrides).some((design) => design.extras?.length)) return null;
  const overrides = Object.fromEntries(
    Object.entries(candidate.overrides).map(([index, design]) => {
      if (!design.extras?.length) return [index, design];
      const rest = { ...design };
      delete rest.extras;
      return [index, rest];
    }),
  );
  return prune({ ...candidate, overrides });
};

const dropFangs = (candidate: Candidate): Candidate | null => (candidate.fangs ? { ...candidate, fangs: false } : null);

/** The two-tone front teeth go back to the base design. */
const dropTwoTone = (candidate: Candidate): Candidate | null => {
  const overrides = Object.fromEntries(
    Object.entries(candidate.overrides).filter(([index, design]) => !([7, 8].includes(Number(index)) && design.metal !== candidate.base.metal)),
  );
  return Object.keys(overrides).length === Object.keys(candidate.overrides).length ? null : prune({ ...candidate, overrides });
};

// ---- Upgrades: one random applicable one, kept only when it still fits. ----

/** The base (and its two-tone teeth) in iced, when the shop prices that combination. */
const toIced = (shop: RandomizeShop, candidate: Candidate, styles: StyleId[], rng: Rng): Candidate | null => {
  if (candidate.base.type !== 'plain') return null;
  if (!shop.catalog.types.some((type) => type.id === 'iced')) return null;
  const settings = shop.catalog.settings.map((setting) => setting.id);
  const stones: StoneId[] = shop.catalog.stones.map((stone) => stone.id);
  const karats: KaratId[] = shop.catalog.karats.map((item) => item.id);
  if (!settings.length || !stones.length) return null;
  const stylePool = ICED_STYLES.filter((style) => styles.includes(style));
  const style = pick(stylePool.length ? stylePool : [cheapestStyle(shop)], rng);
  const setting = pick(settings, rng);
  const stone = pick(stones, rng);
  const { pricing } = shop.config;
  const make = (design: ToothDesign): ToothDesign | null => {
    const iced = { ...design, type: 'iced' as const, style, setting, stone };
    delete iced.extras;
    return nearestOffered(pricing, iced, stones, karats);
  };
  const base = make(candidate.base);
  if (!base) return null;
  const overrides: Record<number, ToothDesign> = {};
  for (const [index, design] of Object.entries(candidate.overrides)) {
    const resolved = make(design);
    if (!resolved) return null;
    overrides[Number(index)] = resolved;
  }
  return prune({ ...candidate, base, overrides });
};

const addExtra = (candidate: Candidate, extras: ExtraId[], rng: Rng): Candidate | null => {
  if (candidate.base.type === 'iced' || !extras.length) return null;
  const bare = teethFor(candidate.size).filter((index) => (candidate.overrides[index] ?? candidate.base).type !== 'iced' && !((candidate.overrides[index] ?? candidate.base).extras ?? []).length);
  if (!bare.length) return null;
  const extra = pick(extras, rng);
  const index = pick(bare, rng);
  const design = candidate.overrides[index] ?? candidate.base;
  return prune({ ...candidate, overrides: { ...candidate.overrides, [index]: { ...design, extras: [extra] } } });
};

const fangsOn = (shop: RandomizeShop, candidate: Candidate): Candidate | null =>
  !candidate.fangs && shop.catalog.fangs && teethFor(candidate.size).some((index) => FANG_TEETH.includes(index)) ? { ...candidate, fangs: true } : null;

const dearerMetal = (shop: RandomizeShop, combos: MetalCombo[], candidate: Candidate): Candidate | null => {
  const current = comboPrice(shop, { metal: candidate.base.metal, karat: candidate.base.karat });
  const { pricing } = shop.config;
  const stones: StoneId[] = shop.catalog.stones.map((stone) => stone.id);
  const karats: KaratId[] = shop.catalog.karats.map((item) => item.id);
  for (const combo of combos.filter((item) => comboPrice(shop, item) > current)) {
    const base: ToothDesign = { ...candidate.base, metal: combo.metal, karat: combo.karat };
    if (base.type !== 'iced') return prune({ ...candidate, base });
    const resolved = nearestOffered(pricing, base, stones, karats);
    if (resolved) return prune({ ...candidate, base: resolved });
  }
  return null;
};

const biggerSet = (candidate: Candidate): Candidate | null => {
  const index = SET_SIZES.findIndex((size) => size.id === candidate.size.id);
  if (index < 0 || index >= SET_SIZES.length - 1) return null;
  return prune({ ...candidate, size: SET_SIZES[index + 1] });
};

/**
 * Roll a random set that fits the budget (whole dollars, out the door: the
 * shop's fee and minimum order are in the total, and so are the customer's
 * own cut, fit, add-ons and text). The customer's design choices stay — only
 * the teeth, their designs and fangs are rolled. Returns null with the
 * cheapest set's total when nothing the shop sells fits the budget.
 */
export function randomizeDesign(shop: RandomizeShop, budget: number, keep: DesignSnapshot, rng: Rng = Math.random): RandomizeResult {
  const dollars = Math.floor(budget);
  const minTotal = cheapestTotal(shop, keep);
  if (!Number.isFinite(dollars) || dollars <= 0 || minTotal > dollars) return { ok: false, minTotal };
  const combos = sortedCombos(shop);
  const styles = pricedStyles(shop);
  const extras = pricedExtras(shop);
  /**
   * Price calls ran out: return the cheapest set the shop sells (it fits —
   * the entry check already proved minTotal ≤ budget) instead of failing a
   * roll that has a fit. The bound is still reachable in a pathological
   * shop (a perverse set-price table can make every step-down try many
   * combinations before one adopts), so exhaustion fails safe, never wrong.
   */
  const onExhausted = (): RandomizeResult => {
    const snapshot = cheapestSnapshot(shop, keep);
    return snapshot && minTotal <= dollars ? { ok: true, snapshot, total: minTotal } : { ok: false, minTotal };
  };
  let calls = 0;
  const price = (candidate: Candidate): number | null => {
    if (calls >= MAX_PRICE_CALLS) return null;
    calls += 1;
    const teeth = toTeeth(candidate);
    return priceBreakdown(shop.config.pricing, teeth, toSet(candidate, keep, teeth.map((tooth) => tooth.index)), shop.config.catalog.addOns ?? []).total;
  };
  const first = rollCandidate(shop, styles, extras, combos, rng);
  if (!first) return { ok: false, minTotal };
  // Typed as Candidate (not Candidate | null) so the upgrade closures below keep the narrow type.
  let candidate: Candidate = first;
  let total = price(candidate);
  if (total === null) return onExhausted();

  /**
   * Iced teeth become plain in the cheapest finish the shop prices, keeping
   * their metal — the finish was the expensive part. Never 'solid' by
   * assumption: a shop can turn solid off, and a plain tooth in a style the
   * shop doesn't sell fails validation, throwing the fit away.
   */
  const toPlain = (next: Candidate): Candidate | null => {
    if (next.base.type !== 'iced' && !Object.values(next.overrides).some((design) => design.type === 'iced')) return null;
    const style = cheapestStyle(shop);
    const convert = (design: ToothDesign): ToothDesign => (design.type === 'iced' ? { ...design, type: 'plain', style } : design);
    return prune({
      ...next,
      base: convert(next.base),
      overrides: Object.fromEntries(Object.entries(next.overrides).map(([index, design]) => [index, convert(design)])),
    });
  };

  /**
   * Drop the finish: every tooth back to the cheapest finish the shop
   * prices. A pricey finish (opals $60 a tooth, diamond-cut over
   * open-face) survives every other downgrade, so without this a 2-piece
   * can stay over budget on the finish alone. In a shop that sells solid
   * that is solid ($0); in a shop that turned solid off it is the cheapest
   * priced finish instead — the step is never a free option, because the
   * style always has a price entry (see cheapestStyle).
   */
  const toCheapestFinish = (next: Candidate): Candidate | null => {
    const style = cheapestStyle(shop);
    if (next.base.style === style && !Object.values(next.overrides).some((design) => design.style !== style)) return null;
    const plain = (design: ToothDesign): ToothDesign => (design.style === style ? design : { ...design, style });
    return prune({
      ...next,
      base: plain(next.base),
      overrides: Object.fromEntries(Object.entries(next.overrides).map(([index, design]) => [index, plain(design)])),
    });
  };

  /**
   * Step a metal down: for each tooth that sets the price (the base first,
   * then each override), try EVERY cheaper combination, most expensive
   * first, and take the first that actually brings the total down. A set
   * price — or a market quote the list price disagrees with — can make a
   * nominally cheaper metal cost the same or more, so one try per target
   * stalls: the priced total, not the metal's list price, decides, and the
   * search steps past the combinations that don't help. The base is tried
   * first, then each override: a two-tone can cover the whole set (a
   * 2-piece IS the front two teeth), so the base alone is not always the
   * design the price answers to.
   */
  const cheaperMetal = (next: Candidate, currentTotal: number): { candidate: Candidate; total: number } | null => {
    const { pricing } = shop.config;
    const stones: StoneId[] = shop.catalog.stones.map((stone) => stone.id);
    const karats: KaratId[] = shop.catalog.karats.map((item) => item.id);
    const cheaperCombos = (design: ToothDesign): ToothDesign[] => {
      const current = comboPrice(shop, { metal: design.metal, karat: design.karat });
      const out: ToothDesign[] = [];
      for (const combo of [...combos].reverse().filter((item) => comboPrice(shop, item) < current)) {
        const stepped: ToothDesign = { ...design, metal: combo.metal, karat: combo.karat };
        const resolved = stepped.type === 'iced' ? nearestOffered(pricing, stepped, stones, karats) : stepped;
        if (resolved) out.push(resolved);
      }
      return out;
    };
    const targets: { key: number | 'base'; design: ToothDesign }[] = [
      { key: 'base', design: next.base },
      ...Object.entries(next.overrides).map(([index, design]) => ({ key: Number(index) as number | 'base', design })),
    ];
    for (const target of targets) {
      for (const stepped of cheaperCombos(target.design)) {
        const priced =
          target.key === 'base'
            ? prune({ ...next, base: stepped })
            : prune({ ...next, overrides: { ...next.overrides, [target.key]: stepped } });
        const nextTotal = price(priced);
        if (nextTotal === null) return null;
        if (nextTotal < currentTotal) return { candidate: priced, total: nextTotal };
      }
    }
    return null;
  };

  /**
   * Step the set down: try every smaller size (largest first) and take the
   * first that actually brings the total down. A set price can make a
   * smaller set cost MORE than the one it replaces (a 12-tooth set price
   * beats 8 teeth at per-tooth), so the loop must be allowed to step past
   * the sizes that don't help.
   */
  const smallerSet = (next: Candidate, currentTotal: number): { candidate: Candidate; total: number } | null => {
    const index = SET_SIZES.findIndex((size) => size.id === next.size.id);
    for (let i = index - 1; i >= 0; i--) {
      const priced = prune({ ...next, size: SET_SIZES[i] });
      const nextTotal = price(priced);
      if (nextTotal === null) return null;
      if (nextTotal < currentTotal) return { candidate: priced, total: nextTotal };
    }
    return null;
  };

  // Over budget: simplify in order — extras, fangs, the two-tone, iced to
  // plain, the finish to the cheapest one, a cheaper metal, a smaller set —
  // adopting only a step that actually brings the total down, so a set price
  // can never flip a downgrade into a surcharge.
  const steps = [dropExtras, dropFangs, dropTwoTone, toPlain, toCheapestFinish];
  while (total > dollars) {
    let advanced = false;
    for (const step of steps) {
      const next = step(candidate);
      if (!next) continue;
      const nextTotal = price(next);
      if (nextTotal === null) return onExhausted();
      if (nextTotal < total) {
        candidate = next;
        total = nextTotal;
        advanced = true;
        break;
      }
    }
    if (!advanced) {
      const cheaper = cheaperMetal(candidate, total);
      if (cheaper) {
        candidate = cheaper.candidate;
        total = cheaper.total;
        advanced = true;
      }
    }
    if (!advanced) {
      const smaller = smallerSet(candidate, total);
      if (smaller) {
        candidate = smaller.candidate;
        total = smaller.total;
        advanced = true;
      }
    }
    if (!advanced) break;
  }
  // Out of the loop over budget: out of price calls, the cheapest set is
  // the answer (see onExhausted); a stall with calls to spare is a real
  // no-fit — the repair tried every step it has.
  if (total > dollars) return calls >= MAX_PRICE_CALLS ? onExhausted() : { ok: false, minTotal };
  // Under budget with room: try one random upgrade and keep it only when it still fits.
  if (total < SPEND_UP_SHARE * dollars) {
    const upgrades = shuffle(
      [
        () => biggerSet(candidate),
        () => dearerMetal(shop, combos, candidate),
        () => toIced(shop, candidate, styles, rng),
        () => addExtra(candidate, extras, rng),
        () => fangsOn(shop, candidate),
      ],
      rng,
    );
    for (const upgrade of upgrades) {
      const next = upgrade();
      if (!next) continue;
      const nextTotal = price(next);
      if (nextTotal === null) break;
      // A no-op (an upgrade that changes nothing — a dearer base no tooth
      // wears, on a set the two-tone covers whole) is not an upgrade: try
      // the next kind. A real upgrade that doesn't fit ends the attempt.
      if (nextTotal === total) continue;
      if (nextTotal <= dollars) {
        candidate = next;
        total = nextTotal;
      }
      break;
    }
  }
  const snapshot: DesignSnapshot = {
    teeth: teethFor(candidate.size),
    base: candidate.base,
    overrides: candidate.overrides,
    set: { ...keep.set, fangs: candidate.fangs },
    drafts: keep.drafts,
  };
  if (!validSnapshot(snapshot, { slug: shop.slug, config: shop.config })) return { ok: false, minTotal };
  return { ok: true, snapshot, total };
}
