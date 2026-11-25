import { CUTS, DIAMOND_GRADES, fangCount, gradePairsWithStone, icedOpal, icedOpenFace, isGold, KARATS, label, METALS, MOLDS, TOOTH_EXTRAS, toothPosition, type AddOn, type CutId, type ExtraId, type GradeId, type GrillzType, type InscriptionStyleId, type KaratId, type MetalId, type RenderTooth, type SetOptions, type SettingId, type StoneId, type StyleId, type ToothDesign } from './renderSpec.js';
import type { CUT_UNITS, ICED_KEYS, TenantDeposit, TenantPricing } from './tenant/schema.js';

type IcedKey = (typeof ICED_KEYS)[number];
import { quoteKey } from './metalMarket.js';
import type { Promo } from './promo.js';

// The price engine: pure functions of a design and a tenant's pricing. The same
// code runs in the builder and on the server, which recomputes every total.

export type PriceLine = { label: string; amount: number };
/** `market`: the metal prices (USD per troy ounce) a market-linked quote used, kept with the lead. */
/**
 * `promo`: the code the customer used and what it took off; `amount` is 0 and
 * `minOrder` is set when the order is under the code's minimum.
 */
export type PriceBreakdown = {
  lines: PriceLine[];
  total: number;
  market?: { asOf: string; gold: number; silver: number; platinum: number };
  promo?: { code: string; amount: number; minOrder?: number };
};

/** One tooth's metal: today's market quote when the shop links to the market, else its fixed price. */
export const metalPerTooth = (pricing: TenantPricing, metal: MetalId, karat: KaratId) => {
  const quoted = pricing.market?.enabled ? pricing.market.quote?.perTooth[quoteKey(metal, karat)] : undefined;
  if (quoted !== undefined) return quoted;
  return Math.round((pricing.metalPerTooth[metal] ?? 0) * (isGold(metal) ? pricing.karatMultiplier[karat] ?? 1 : 1));
};

/** Whether a tooth's metal price comes from a market quote (metal-price items — the colour surcharge, set prices — don't apply on top of one; labour/finish charges like styles and extras still do). */
export const metalQuoted = (pricing: TenantPricing, metal: MetalId, karat: KaratId) =>
  Boolean(pricing.market?.enabled && pricing.market.quote?.perTooth[quoteKey(metal, karat)] !== undefined);

/** The set-price table's row for a tooth: gold by karat, the others by name (the iced-table key). */
export const setPriceKey = (metal: MetalId, karat: KaratId): IcedKey => icedKey(metal, karat);

/** The label for a set-price row: a karat ("10K") or a metal ("Silver"). */
export const setPriceKeyLabel = (key: IcedKey) => KARATS.find((karat) => karat.id === key)?.label ?? `${key[0].toUpperCase()}${key.slice(1)}`;

/**
 * The set price for this many teeth of one metal (gold by karat): the biggest
 * set size at or below the count that has a price for it. Undefined without
 * one — then the per-tooth price applies.
 */
export const setPriceCell = (pricing: TenantPricing, key: IcedKey, count: number) => {
  const cell = (pricing.setPrices ?? [])
    .filter((tier) => tier.size <= count && tier.prices[key] !== undefined)
    .sort((a, b) => b.size - a.size)[0];
  return cell ? { size: cell.size, price: cell.prices[key]! } : undefined;
};

/** A flat surcharge per tooth on a metal (white and rose gold cost extra, whatever the karat). */
export const colourPerTooth = (pricing: TenantPricing, metal: MetalId) => pricing.colourSurcharge?.[metal] ?? 0;

/** One named tooth extra's price per tooth. */
export const extraPrice = (pricing: TenantPricing, extra: ExtraId) => pricing.extraPerTooth?.[extra] ?? 0;

/** One diamond grade tier's price per tooth (MAG-215). */
export const gradePrice = (pricing: TenantPricing, grade: GradeId) => pricing.gradePerTooth?.[grade] ?? 0;

export type CutPrice = { amount: number; per: (typeof CUT_UNITS)[number] };

/** What the shop calls its per-order fee. */
export const feeLabel = (pricing: Pick<TenantPricing, 'baseLabel'>) => pricing.baseLabel?.trim() || 'Service fee';

/** What a fit costs and how it's counted. Shops without cut prices keep the first rule: permanent look per order, deep cut free. */
export const cutPrice = (pricing: TenantPricing, cut: CutId): CutPrice =>
  pricing.cuts?.[cut] ?? { amount: cut === 'permanent' ? pricing.extras.permanent : 0, per: 'order' };

/** The iced price table's column for a metal: gold by karat, the others by name. */
export const icedKey = (metal: MetalId, karat: KaratId): IcedKey => (isGold(metal) ? karat : (metal as IcedKey));

/** An iced tooth's all-in price from the shop's table; undefined without a table or when the shop doesn't offer it. */
export const icedAllIn = (pricing: TenantPricing, design: Pick<ToothDesign, 'metal' | 'karat' | 'stone'>) =>
  pricing.icedPerTooth?.[design.stone]?.[icedKey(design.metal, design.karat)];

/** Does the shop offer this tooth? Everything but iced does; iced needs a cell in the table, when there is one. */
export const offered = (pricing: TenantPricing, design: Pick<ToothDesign, 'type' | 'metal' | 'karat' | 'stone'>) =>
  design.type !== 'iced' || !pricing.icedPerTooth || icedAllIn(pricing, design) !== undefined;

/**
 * The nearest design the shop offers: an iced combination outside the table
 * keeps its metal and changes the stone, then the karat. Null when the metal
 * has no iced price at all.
 */
export const nearestOffered = (pricing: TenantPricing, design: ToothDesign, stones: readonly StoneId[], karats: readonly KaratId[]): ToothDesign | null => {
  if (offered(pricing, design)) return design;
  // A grade pairs with one stone: changing the stone drops a grade that no
  // longer pairs with it (MAG-215), so a design never carries a grade its
  // stone can't show.
  const withStone = (stone: StoneId): ToothDesign => {
    const next = { ...design, stone };
    if (next.grade && !gradePairsWithStone(next.grade, stone)) delete next.grade;
    return next;
  };
  const tries: ToothDesign[] = [
    ...stones.map(withStone),
    ...(isGold(design.metal) ? karats.flatMap((karat) => [design.stone, ...stones].map((stone) => ({ ...withStone(stone), karat }))) : []),
  ];
  return tries.find((attempt) => offered(pricing, attempt)) ?? null;
};

/**
 * Iced opal (MAG-169), as the shop priced it or from its other prices: the
 * opal labour defaults to the Opals finish price, the stone share to the iced
 * open-face share (both set stones round a border of the same size).
 */
export const icedOpalPrice = (pricing: TenantPricing) => ({
  stoneShare: pricing.icedOpal?.stoneShare ?? pricing.icedOpenFace?.stoneShare ?? 100,
  perTooth: pricing.icedOpal?.perTooth ?? pricing.stylePerTooth.opals ?? 0,
});

/** The share (%) of the stone and setting price an iced tooth with a border takes. */
const borderShare = (pricing: TenantPricing, tooth: ToothDesign) =>
  icedOpal(tooth) ? icedOpalPrice(pricing).stoneShare : pricing.icedOpenFace?.stoneShare ?? 100;

/** The arches (top, bottom) with at least one tooth in the set. */
export const archCount = (teeth: readonly { index: number }[]) => new Set(teeth.map((tooth) => (tooth.index < 16 ? 'top' : 'bottom'))).size;

/** The set-size discount (percent) for this many teeth: the biggest tier the set reaches. */
export const volumeDiscount = (pricing: TenantPricing, teeth: number) =>
  (pricing.volume ?? []).filter((tier) => teeth >= tier.minTeeth).reduce((best, tier) => Math.max(best, tier.percentOff), 0);

/** A live volume-discount hint: the next set-price tier within reach for one metal. */
export type VolumeHint = { key: IcedKey; label: string; more: number; saving: number };

/**
 * The next set-price tier for each metal in the set, as a live hint in the
 * summary — "4 more 14K teeth → −$50/tooth" (MAG-216). The saving is the
 * per-tooth metal price at the next tier against what the tooth costs now:
 * the current tier's price/size when the set already reaches one, else the
 * fixed per-tooth metal price. Only the next tier up, only when it actually
 * saves at least a dollar a tooth — a bigger tier's price can be worse per
 * tooth if the shop's table is off, and a hint must never promise a saving
 * that isn't there. All-in iced teeth take no set price, and a market-quoted
 * metal's price moves daily, so neither counts toward a tier. A shop hiding
 * its prices gets no hint either. Display-only: the hint names the tier, it
 * never applies anything. The % volume discount has no hint: it keys off the
 * total tooth count, not a per-metal ladder, and it never applies to
 * set-priced metal — a % hint on this set would not match what the customer
 * pays.
 */
export const volumeHints = (pricing: TenantPricing, teeth: readonly RenderTooth[]): VolumeHint[] => {
  if (pricing.display === 'hidden' || !(pricing.setPrices ?? []).length) return [];
  const byKey = new Map<IcedKey, { metal: MetalId; karat: KaratId; count: number }>();
  teeth.forEach((tooth) => {
    if (tooth.type === 'iced' && icedAllIn(pricing, tooth) !== undefined) return;
    if (metalQuoted(pricing, tooth.metal, tooth.karat)) return;
    const key = setPriceKey(tooth.metal, tooth.karat);
    const group = byKey.get(key) ?? { metal: tooth.metal, karat: tooth.karat, count: 0 };
    group.count += 1;
    byKey.set(key, group);
  });
  const hints: VolumeHint[] = [];
  byKey.forEach((group, key) => {
    const next = (pricing.setPrices ?? [])
      .filter((tier) => tier.size > group.count && tier.prices[key] !== undefined)
      .sort((a, b) => a.size - b.size)[0];
    if (!next) return;
    const current = setPriceCell(pricing, key, group.count);
    const nowPerTooth = current ? current.price / current.size : metalPerTooth(pricing, group.metal, group.karat);
    const saving = Math.round(nowPerTooth - next.prices[key]! / next.size);
    if (saving < 1) return;
    hints.push({ key, label: setPriceKeyLabel(key), more: next.size - group.count, saving });
  });
  return hints.sort((a, b) => b.saving - a.saving);
};

/** A tooth's share of the front-tooth price, by where it sits (1 = the same as the front). */
export const positionFactor = (pricing: TenantPricing, index: number) => {
  const position = toothPosition(index);
  return position === 'front' ? 1 : (pricing.positions?.[position] ?? 100) / 100;
};

/**
 * `addOns`: the shop's add-ons (from its catalog), to price the ones in `set.addOns`.
 * `promo`: a code the customer entered (already checked), taken off the order
 * before the shop's minimum applies.
 */
export const priceBreakdown = (pricing: TenantPricing, teeth: RenderTooth[], set: SetOptions, addOns: readonly AddOn[] = [], promo: Promo | null = null): PriceBreakdown => {
  const lines: PriceLine[] = [{ label: feeLabel(pricing), amount: pricing.base }];
  if (teeth.length === 0) return { lines, total: pricing.base };
  const sum = (fn: (tooth: ToothDesign) => number) => teeth.reduce((total, tooth) => total + fn(tooth), 0);
  const add = (label: string, amount: number) => amount && lines.push({ label, amount });
  // Iced open face and iced opal: a share of the stones (fewer fit round the border) and their own labour price.
  const openFaceShare = (tooth: ToothDesign) => (icedOpenFace(tooth) || icedOpal(tooth) ? borderShare(pricing, tooth) / 100 : 1);
  const finish = (tooth: ToothDesign) => {
    if (icedOpenFace(tooth)) return pricing.icedOpenFace?.perTooth ?? pricing.stylePerTooth['open-face'] ?? 0;
    if (icedOpal(tooth)) return icedOpalPrice(pricing).perTooth;
    return tooth.type === 'iced' ? 0 : pricing.stylePerTooth[tooth.style] ?? 0;
  };
  // Iced teeth from the shop's all-in table replace metal plus stones.
  const allIn = (tooth: ToothDesign) => (tooth.type === 'iced' ? icedAllIn(pricing, tooth) : undefined);
  // Set prices replace the metal part: the biggest set size at or below how
  // many teeth of this metal (gold by karat) the set has. Counted per key, so
  // a mixed set only discounts the metal that reaches a set size.
  const keyCounts = new Map<IcedKey, number>();
  teeth.forEach((tooth) => {
    if (allIn(tooth) === undefined) keyCounts.set(setPriceKey(tooth.metal, tooth.karat), (keyCounts.get(setPriceKey(tooth.metal, tooth.karat)) ?? 0) + 1);
  });
  const setPerTooth = (tooth: ToothDesign) => {
    if (allIn(tooth) !== undefined) return undefined;
    // A set price never overrides a market-linked quote: the quote is the
    // shop's live price for that metal, and a fixed set price would turn the
    // quote's daily movement into a phantom "saving" on the Set price line.
    // Set prices apply to fixed-price metal only (MAG-204 review).
    if (metalQuoted(pricing, tooth.metal, tooth.karat)) return undefined;
    const cell = setPriceCell(pricing, setPriceKey(tooth.metal, tooth.karat), keyCounts.get(setPriceKey(tooth.metal, tooth.karat)) ?? 0);
    return cell ? cell.price / cell.size : undefined;
  };
  const metalOf = (tooth: ToothDesign) => (allIn(tooth) === undefined ? (setPerTooth(tooth) ?? metalPerTooth(pricing, tooth.metal, tooth.karat)) : 0);
  // Colour is a flat surcharge on the fixed metal price, on top of a set
  // price too; all-in iced teeth already include everything.
  const colourOf = (tooth: ToothDesign) => (allIn(tooth) === undefined && !metalQuoted(pricing, tooth.metal, tooth.karat) ? colourPerTooth(pricing, tooth.metal) : 0);
  // Named extras never apply to iced teeth (MAG-204 review): the whole face
  // is covered edge to edge, so there is nowhere to put a cross or a
  // starburst — the same rule as the other finishes, which the builder
  // already gates for iced teeth. The picker hides them there too.
  const extrasOf = (tooth: ToothDesign) => (tooth.type === 'iced' ? 0 : (tooth.extras ?? []).reduce((total, extra) => total + extraPrice(pricing, extra), 0));
  const stonesOf = (tooth: ToothDesign) => (tooth.type === 'iced' && allIn(tooth) === undefined ? (pricing.stonePerTooth[tooth.stone] ?? 0) * openFaceShare(tooth) : 0);
  const settingOf = (tooth: ToothDesign) => (tooth.type === 'iced' ? (pricing.settingPerTooth[tooth.setting] ?? 0) * openFaceShare(tooth) : 0);
  // A diamond grade is a stone-quality upgrade (MAG-215): it stacks on
  // everything a stone price stacks on — the per-part model, an all-in iced
  // price (the table is keyed by stone, not by grade, so the grade is not
  // baked into the cell the way the colour surcharge's metal is), a set
  // price and a market quote (a stone price, not a metal price — the settled
  // engine rule is that only metal-price items are gated on quotes). Like
  // the stone price, it takes the open-face border share: fewer stones round
  // the frame, less of an upgrade to pay for.
  const gradeOf = (tooth: ToothDesign) => {
    const grade = tooth.type === 'iced' ? tooth.grade : undefined;
    return grade && gradePairsWithStone(grade, tooth.stone) ? gradePrice(pricing, grade) * openFaceShare(tooth) : 0;
  };
  // Open face takes its share of the stones: the part of the all-in price above the plain metal.
  const icedOf = (tooth: ToothDesign) => {
    const price = allIn(tooth);
    if (price === undefined) return 0;
    if (openFaceShare(tooth) === 1) return price;
    const plain = metalPerTooth(pricing, tooth.metal, tooth.karat);
    return Math.min(price, plain) + Math.max(0, price - plain) * openFaceShare(tooth);
  };
  // Metal is totalled per set-price row, rounded to the dollar: a set price
  // divided by its size rarely splits evenly (e.g. $1,250 / 12). The Metal
  // line shows the per-tooth total and the Set price line takes the saving
  // off, like the set-size discount below — never both at once.
  const metalGroups = [...keyCounts.entries()].map(([key, count]) => {
    const teethOfKey = teeth.filter((tooth) => allIn(tooth) === undefined && setPriceKey(tooth.metal, tooth.karat) === key);
    const list = teethOfKey.reduce((total, tooth) => total + metalPerTooth(pricing, tooth.metal, tooth.karat), 0);
    // The cell only applies when a tooth of this metal actually takes a set
    // price — market-quoted teeth never do (see setPerTooth above).
    const cell = teethOfKey.some((tooth) => setPerTooth(tooth) !== undefined) ? setPriceCell(pricing, key, count) : undefined;
    return { key, count, list, charged: cell ? Math.round((count * cell.price) / cell.size) : list, cell };
  });
  const metal = metalGroups.reduce((total, group) => total + group.list, 0);
  const iced = Math.round(sum(icedOf));
  const finishes = sum(finish);
  const stones = Math.round(sum(stonesOf));
  const settings = Math.round(sum(settingOf));
  const grades = Math.round(sum(gradeOf));
  const colour = sum(colourOf);
  const extras = Math.round(sum(extrasOf));
  const allInTeeth = teeth.filter((tooth) => allIn(tooth) !== undefined).length;
  const metalTeeth = teeth.length - allInTeeth;
  add(`Metal · ${metalTeeth} teeth`, metal);
  // Colour, per metal that charges it.
  const colourGroups = new Map<MetalId, { count: number; amount: number }>();
  teeth.forEach((tooth) => {
    const amount = colourOf(tooth);
    if (!amount) return;
    const group = colourGroups.get(tooth.metal) ?? { count: 0, amount: 0 };
    group.count += 1;
    group.amount += amount;
    colourGroups.set(tooth.metal, group);
  });
  colourGroups.forEach((group, metalId) => add(`${label(METALS, metalId)} colour · ${group.count} ${group.count === 1 ? 'tooth' : 'teeth'}`, group.amount));
  // Why the metal total is lower (or higher) than per tooth: one line per set-priced metal.
  metalGroups.forEach((group) => {
    if (!group.cell || group.list === group.charged) return;
    add(`Set price · ${setPriceKeyLabel(group.key)} · ${group.count} teeth`, -(group.list - group.charged));
  });
  add(`Iced · ${allInTeeth} ${allInTeeth === 1 ? 'tooth' : 'teeth'}`, iced);
  add('Style & finish', finishes);
  add('Stones', stones);
  add('Mosaic setting', settings);
  // Diamond grade tiers, per tier (iced teeth only — see gradeOf above).
  const gradeGroups = new Map<GradeId, { count: number; amount: number }>();
  teeth.forEach((tooth) => {
    if (tooth.type !== 'iced' || !tooth.grade) return;
    const group = gradeGroups.get(tooth.grade) ?? { count: 0, amount: 0 };
    group.count += 1;
    group.amount += gradeOf(tooth);
    gradeGroups.set(tooth.grade, group);
  });
  gradeGroups.forEach((group, grade) => add(`${label(DIAMOND_GRADES, grade)} · ${group.count} ${group.count === 1 ? 'tooth' : 'teeth'}`, group.amount));
  // Named extras, per extra (iced teeth take none — see extrasOf above).
  const extraGroups = new Map<ExtraId, { count: number; amount: number }>();
  teeth.forEach((tooth) =>
    (tooth.type === 'iced' ? [] : (tooth.extras ?? [])).forEach((extra) => {
      const group = extraGroups.get(extra) ?? { count: 0, amount: 0 };
      group.count += 1;
      group.amount += extraPrice(pricing, extra);
      extraGroups.set(extra, group);
    }),
  );
  extraGroups.forEach((group, extra) => add(`${label(TOOTH_EXTRAS, extra)} · ${group.count} ${group.count === 1 ? 'tooth' : 'teeth'}`, group.amount));
  // Back teeth at the shop's own share of the front price: the difference, on its own line.
  const back = teeth.filter((tooth) => positionFactor(pricing, tooth.index) !== 1);
  const backDelta = (tooth: RenderTooth) => (metalOf(tooth) + icedOf(tooth) + finish(tooth) + stonesOf(tooth) + settingOf(tooth) + gradeOf(tooth) + colourOf(tooth) + extrasOf(tooth)) * (positionFactor(pricing, tooth.index) - 1);
  // Split by whether the tooth's metal is set-priced: the % volume discount
  // never applies to set-priced metal, so the back-teeth delta on those teeth
  // must not sit in its base either — a cheaper back tooth would make the
  // base negative and flip the "discount" into a surcharge. Colour and extras
  // on set-priced teeth stay in the base: they are charged
  // on top of the set price, so the % discount does apply to them (MAG-204
  // review decision).
  const backSet = Math.round(back.filter((tooth) => setPerTooth(tooth) !== undefined).reduce((total, tooth) => total + backDelta(tooth), 0));
  const backRest = Math.round(back.filter((tooth) => setPerTooth(tooth) === undefined).reduce((total, tooth) => total + backDelta(tooth), 0));
  const backAdjustment = backSet + backRest;
  add(`Back teeth · ${back.length} ${back.length === 1 ? 'tooth' : 'teeth'}`, backAdjustment);
  // The set-size discount comes off everything charged per tooth — except the
  // metal of teeth a set price already covers (MAG-204: set prices win for
  // the metals that have them, the % applies to the rest), and except the
  // back-teeth delta on those teeth (backRest above, not the whole
  // backAdjustment).
  const volumeMetal = teeth.reduce((total, tooth) => {
    if (allIn(tooth) !== undefined || setPerTooth(tooth) !== undefined) return total;
    return total + metalPerTooth(pricing, tooth.metal, tooth.karat);
  }, 0);
  const percent = volumeDiscount(pricing, teeth.length);
  // A discount line can never be positive: on set-priced teeth the base can go
  // negative (a below-base finish is the only component — set-priced metal is
  // 0), which flipped the "discount" into a surcharge (MAG-219 re-review F2,
  // the same bug class MAG-204 fixed once by excluding backSet). Clamping the
  // line, not the base, preserves the MAG-204 decision that finishes on
  // set-priced teeth sit in the % base.
  if (percent) add(`Set discount · ${teeth.length} teeth, ${percent}% off`, Math.min(0, -Math.round(((volumeMetal + iced + finishes + stones + settings + grades + colour + extras + backRest) * percent) / 100)));
  if (teeth.some((tooth) => tooth.type === 'photo')) add('Photo artwork', pricing.extras.photo);
  // Fangs are built on the upper canines: none in the set, no fangs to charge for.
  const fangs = fangCount(teeth, set.fangs);
  if (fangs) add(pricing.fangsPer === 'fang' ? `Fangs · ${fangs}` : 'Fangs', pricing.extras.fangs * (pricing.fangsPer === 'fang' ? fangs : 1));
  // The fit, once per order, per arch or per tooth.
  const cut = cutPrice(pricing, set.cut);
  const cutName = label(CUTS, set.cut);
  if (cut.per === 'order') add(cutName, cut.amount);
  else if (cut.per === 'arch') {
    const arches = archCount(teeth);
    add(`${cutName} · ${arches} ${arches === 1 ? 'arch' : 'arches'}`, cut.amount * arches);
  } else add(`${cutName} · ${teeth.length} ${teeth.length === 1 ? 'tooth' : 'teeth'}`, cut.amount * teeth.length);
  // Letters are priced per tooth they cover (one tooth: the shop's inscription price).
  set.inscriptions.forEach((inscription) => {
    const each = pricing.inscription[inscription.style] ?? 0;
    const span = inscription.teeth.length;
    add(span > 1 ? `Inscription "${inscription.text}" · ${span} teeth` : `Inscription "${inscription.text}"`, each * span);
  });
  if (set.mold) add(label(MOLDS, set.mold), pricing.molds?.[set.mold] ?? 0);
  (set.addOns ?? []).forEach((id) => {
    const addOn = addOns.find((item) => item.id === id);
    if (addOn) add(addOn.per === 'tooth' ? `${addOn.label} · ${teeth.length} teeth` : addOn.label, addOn.per === 'tooth' ? addOn.price * teeth.length : addOn.price);
  });
  const beforePromo = lines.reduce((total, line) => total + line.amount, 0);
  let promoResult: PriceBreakdown['promo'];
  if (promo && beforePromo < promo.minOrder) promoResult = { code: promo.code, amount: 0, minOrder: promo.minOrder };
  else if (promo) {
    const amount = Math.min(beforePromo, promo.kind === 'percent' ? Math.round((beforePromo * promo.value) / 100) : promo.value);
    add(`Promo ${promo.code}`, -amount);
    promoResult = { code: promo.code, amount };
  }
  const subtotal = lines.reduce((total, line) => total + line.amount, 0);
  if (pricing.minimumOrder > subtotal) lines.push({ label: 'Minimum order adjustment', amount: pricing.minimumOrder - subtotal });
  const quote = pricing.market?.enabled ? pricing.market.quote : undefined;
  // The market prices ride along only when at least one tooth was actually
  // priced from the quote — not when every tooth took a set price, a fixed
  // price or an all-in iced price instead (MAG-204 review).
  const pricedFromQuote = (tooth: ToothDesign) => allIn(tooth) === undefined && setPerTooth(tooth) === undefined && metalQuoted(pricing, tooth.metal, tooth.karat);
  const market = quote && teeth.some(pricedFromQuote)
    ? { asOf: quote.asOf, gold: quote.gold, silver: quote.silver, platinum: quote.platinum }
    : undefined;
  return { lines, total: Math.max(subtotal, pricing.minimumOrder), ...(market ? { market } : {}), ...(promoResult ? { promo: promoResult } : {}) };
};

/** The deposit for an estimate, or null when the shop takes no deposit. */
export const depositFor = (deposit: TenantDeposit, total: number): number | null => {
  if (deposit.mode === 'none') return null;
  const { rule } = deposit;
  if (rule.type === 'fixed') return rule.amount;
  return Math.max(rule.min, Math.round((total * rule.value) / 100 / rule.roundTo) * rule.roundTo);
};

const usd = (value: number) => `$${value}`;

/** Short price hints on the option cards, following the shop's price display. */
export const priceHints = (pricing: TenantPricing) => {
  const hidden = pricing.display === 'hidden';
  const hint = (text: string) => (hidden ? undefined : text);
  return {
    /** With `icedStone`, the all-in iced price for that stone when the shop has a table. */
    metal: (metal: MetalId, karat: KaratId, icedStone?: StoneId) => {
      const price = icedStone && pricing.icedPerTooth ? icedAllIn(pricing, { metal, karat, stone: icedStone }) : metalPerTooth(pricing, metal, karat);
      if (price === undefined) return undefined;
      // A colour surcharge shows on the card (fixed prices only: a market quote already is that metal's price).
      const surcharge = icedStone || metalQuoted(pricing, metal, karat) ? 0 : colourPerTooth(pricing, metal);
      // A set price changes what the tooth actually costs at set sizes, so
      // say so on the card instead of showing only the per-tooth list price
      // (MAG-204 review): the smallest set size with a price for this metal.
      // No note for all-in iced or market-quoted metal — set prices apply to
      // neither.
      const setCell = icedStone || metalQuoted(pricing, metal, karat)
        ? undefined
        : (pricing.setPrices ?? []).filter((tier) => tier.prices[icedKey(metal, karat)] !== undefined).sort((a, b) => a.size - b.size)[0];
      const setNote = setCell ? ` · ${setCell.size} teeth $${setCell.prices[icedKey(metal, karat)]}` : '';
      return hint(`${usd(price + surcharge)} / tooth${setNote}`);
    },
    style: (style: StyleId) => {
      const price = pricing.stylePerTooth[style];
      if (!price) return hint('Included');
      // A below-base style (MAG-219): a negative price shows openly as a
      // saving, not as "+$-60". Solid at $0 stays "Included".
      return hint(`${price < 0 ? '-' : '+'}${usd(Math.abs(price))} / tooth`);
    },
    /** All-in for the chosen metal and karat when the shop prices iced teeth from a table. */
    stone: (stone: StoneId, metal?: MetalId, karat?: KaratId) => {
      if (!pricing.icedPerTooth || !metal || !karat) return hint(`+${usd(pricing.stonePerTooth[stone] ?? 0)} / tooth`);
      const price = icedAllIn(pricing, { metal, karat, stone });
      return price === undefined ? undefined : hint(`${usd(price)} / tooth`);
    },
    setting: (setting: SettingId) => hint(pricing.settingPerTooth[setting] ? `+${usd(pricing.settingPerTooth[setting]!)} / tooth` : 'Included'),
    type: (type: GrillzType) => hint(type === 'photo' ? `+${usd(pricing.extras.photo)} artwork` : type === 'iced' ? 'Stones priced below' : 'Included'),
    inscription: (style: InscriptionStyleId) => hint(`+${usd(pricing.inscription[style] ?? 0)} / tooth`),
    fangs: () => hint(pricing.extras.fangs ? `+${usd(pricing.extras.fangs)}${pricing.fangsPer === 'fang' ? ' / fang' : ''}` : 'Included'),
    cut: (cut: CutId) => {
      const { amount, per } = cutPrice(pricing, cut);
      return hint(amount ? `+${usd(amount)}${per === 'order' ? '' : ` / ${per}`}` : 'Included');
    },
    /** A flat or per-tooth extra (permanent look, a shop's add-on). */
    extra: (amount: number, perTooth = false) => hint(amount ? `+${usd(amount)}${perTooth ? ' / tooth' : ''}` : 'Included'),
  };
};

/** How a total is shown to the customer: the exact figure, a "from" figure, or nothing. */
export const displayTotal = (pricing: TenantPricing, total: number, format: (value: number) => string) => {
  if (pricing.display === 'hidden') return { text: 'Price on request', amount: null };
  if (pricing.display === 'from') return { text: `From ${format(total)}`, amount: total };
  return { text: format(total), amount: total };
};
