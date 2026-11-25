import { CUTS, fangCount, icedOpal, icedOpenFace, isGold, KARATS, label, METALS, MOLDS, TOOTH_EXTRAS, toothPosition, type AddOn, type CutId, type ExtraId, type GrillzType, type InscriptionStyleId, type KaratId, type MetalId, type RenderTooth, type SetOptions, type SettingId, type StoneId, type StyleId, type ToothDesign } from './renderSpec.js';
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

/** Whether a tooth's metal price comes from a market quote (fixed-price extras don't apply on top of one). */
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
  const tries: ToothDesign[] = [
    ...stones.map((stone) => ({ ...design, stone })),
    ...(isGold(design.metal) ? karats.flatMap((karat) => [design.stone, ...stones].map((stone) => ({ ...design, karat, stone }))) : []),
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
    const cell = setPriceCell(pricing, setPriceKey(tooth.metal, tooth.karat), keyCounts.get(setPriceKey(tooth.metal, tooth.karat)) ?? 0);
    return cell ? cell.price / cell.size : undefined;
  };
  const metalOf = (tooth: ToothDesign) => (allIn(tooth) === undefined ? (setPerTooth(tooth) ?? metalPerTooth(pricing, tooth.metal, tooth.karat)) : 0);
  // Colour is a flat surcharge on the fixed metal price, on top of a set
  // price too; all-in iced teeth already include everything.
  const colourOf = (tooth: ToothDesign) => (allIn(tooth) === undefined && !metalQuoted(pricing, tooth.metal, tooth.karat) ? colourPerTooth(pricing, tooth.metal) : 0);
  const extrasOf = (tooth: ToothDesign) => (tooth.extras ?? []).reduce((total, extra) => total + extraPrice(pricing, extra), 0);
  const stonesOf = (tooth: ToothDesign) => (tooth.type === 'iced' && allIn(tooth) === undefined ? (pricing.stonePerTooth[tooth.stone] ?? 0) * openFaceShare(tooth) : 0);
  const settingOf = (tooth: ToothDesign) => (tooth.type === 'iced' ? (pricing.settingPerTooth[tooth.setting] ?? 0) * openFaceShare(tooth) : 0);
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
    const cell = setPriceCell(pricing, key, count);
    return { key, count, list, charged: cell ? Math.round((count * cell.price) / cell.size) : list, cell };
  });
  const metal = metalGroups.reduce((total, group) => total + group.list, 0);
  const iced = Math.round(sum(icedOf));
  const finishes = sum(finish);
  const stones = Math.round(sum(stonesOf));
  const settings = Math.round(sum(settingOf));
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
  // Named extras, per extra.
  const extraGroups = new Map<ExtraId, { count: number; amount: number }>();
  teeth.forEach((tooth) =>
    (tooth.extras ?? []).forEach((extra) => {
      const group = extraGroups.get(extra) ?? { count: 0, amount: 0 };
      group.count += 1;
      group.amount += extraPrice(pricing, extra);
      extraGroups.set(extra, group);
    }),
  );
  extraGroups.forEach((group, extra) => add(`${label(TOOTH_EXTRAS, extra)} · ${group.count} ${group.count === 1 ? 'tooth' : 'teeth'}`, group.amount));
  // Back teeth at the shop's own share of the front price: the difference, on its own line.
  const back = teeth.filter((tooth) => positionFactor(pricing, tooth.index) !== 1);
  const backAdjustment = Math.round(back.reduce((total, tooth) => total + (metalOf(tooth) + icedOf(tooth) + finish(tooth) + stonesOf(tooth) + settingOf(tooth) + colourOf(tooth) + extrasOf(tooth)) * (positionFactor(pricing, tooth.index) - 1), 0));
  add(`Back teeth · ${back.length} ${back.length === 1 ? 'tooth' : 'teeth'}`, backAdjustment);
  // The set-size discount comes off everything charged per tooth — except the
  // metal of teeth a set price already covers (MAG-204: set prices win for
  // the metals that have them, the % applies to the rest). The back-teeth
  // delta on set-priced teeth stays in the base: splitting it out is not
  // worth the complexity, and it only matters when a shop uses both.
  const volumeMetal = teeth.reduce((total, tooth) => {
    if (allIn(tooth) !== undefined || setPerTooth(tooth) !== undefined) return total;
    return total + metalPerTooth(pricing, tooth.metal, tooth.karat);
  }, 0);
  const percent = volumeDiscount(pricing, teeth.length);
  if (percent) add(`Set discount · ${teeth.length} teeth, ${percent}% off`, -Math.round(((volumeMetal + iced + finishes + stones + settings + colour + extras + backAdjustment) * percent) / 100));
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
  const market = quote && teeth.some((tooth) => quote.perTooth[quoteKey(tooth.metal, tooth.karat)] !== undefined)
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
      return hint(`${usd(price + surcharge)} / tooth`);
    },
    style: (style: StyleId) => hint(pricing.stylePerTooth[style] ? `+${usd(pricing.stylePerTooth[style]!)} / tooth` : 'Included'),
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
