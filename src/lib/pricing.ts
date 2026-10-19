import { fangCount, icedOpenFace, isGold, label, MOLDS, toothPosition, type AddOn, type GrillzType, type InscriptionStyleId, type KaratId, type MetalId, type RenderTooth, type SetOptions, type SettingId, type StoneId, type StyleId, type ToothDesign } from './renderSpec.js';
import type { TenantDeposit, TenantPricing } from './tenant/schema.js';
import { quoteKey } from './metalMarket.js';

// The price engine: pure functions of a design and a tenant's pricing. The same
// code runs in the builder and on the server, which recomputes every total.

export type PriceLine = { label: string; amount: number };
/** `market`: the metal prices (USD per troy ounce) a market-linked quote used, kept with the lead. */
export type PriceBreakdown = { lines: PriceLine[]; total: number; market?: { asOf: string; gold: number; silver: number; platinum: number } };

/** One tooth's metal: today's market quote when the shop links to the market, else its fixed price. */
export const metalPerTooth = (pricing: TenantPricing, metal: MetalId, karat: KaratId) => {
  const quoted = pricing.market?.enabled ? pricing.market.quote?.perTooth[quoteKey(metal, karat)] : undefined;
  if (quoted !== undefined) return quoted;
  return Math.round((pricing.metalPerTooth[metal] ?? 0) * (isGold(metal) ? pricing.karatMultiplier[karat] ?? 1 : 1));
};

/** The set-size discount (percent) for this many teeth: the biggest tier the set reaches. */
export const volumeDiscount = (pricing: TenantPricing, teeth: number) =>
  (pricing.volume ?? []).filter((tier) => teeth >= tier.minTeeth).reduce((best, tier) => Math.max(best, tier.percentOff), 0);

/** A tooth's share of the front-tooth price, by where it sits (1 = the same as the front). */
export const positionFactor = (pricing: TenantPricing, index: number) => {
  const position = toothPosition(index);
  return position === 'front' ? 1 : (pricing.positions?.[position] ?? 100) / 100;
};

/** `addOns`: the shop's add-ons (from its catalog), to price the ones in `set.addOns`. */
export const priceBreakdown = (pricing: TenantPricing, teeth: RenderTooth[], set: SetOptions, addOns: readonly AddOn[] = []): PriceBreakdown => {
  const lines: PriceLine[] = [{ label: 'Service fee', amount: pricing.base }];
  if (teeth.length === 0) return { lines, total: pricing.base };
  const sum = (fn: (tooth: ToothDesign) => number) => teeth.reduce((total, tooth) => total + fn(tooth), 0);
  const add = (label: string, amount: number) => amount && lines.push({ label, amount });
  // Iced open face: a share of the stones (fewer fit) and its own labour price.
  const openFaceShare = (tooth: ToothDesign) => (icedOpenFace(tooth) ? (pricing.icedOpenFace?.stoneShare ?? 100) / 100 : 1);
  const finish = (tooth: ToothDesign) => {
    if (icedOpenFace(tooth)) return pricing.icedOpenFace?.perTooth ?? pricing.stylePerTooth['open-face'] ?? 0;
    return tooth.type === 'iced' ? 0 : pricing.stylePerTooth[tooth.style] ?? 0;
  };
  const metalOf = (tooth: ToothDesign) => metalPerTooth(pricing, tooth.metal, tooth.karat);
  const stonesOf = (tooth: ToothDesign) => (tooth.type === 'iced' ? (pricing.stonePerTooth[tooth.stone] ?? 0) * openFaceShare(tooth) : 0);
  const settingOf = (tooth: ToothDesign) => (tooth.type === 'iced' ? (pricing.settingPerTooth[tooth.setting] ?? 0) * openFaceShare(tooth) : 0);
  const metal = sum(metalOf);
  const finishes = sum(finish);
  const stones = Math.round(sum(stonesOf));
  const settings = Math.round(sum(settingOf));
  add(`Metal · ${teeth.length} teeth`, metal);
  add('Style & finish', finishes);
  add('Stones', stones);
  add('Mosaic setting', settings);
  // Back teeth at the shop's own share of the front price: the difference, on its own line.
  const back = teeth.filter((tooth) => positionFactor(pricing, tooth.index) !== 1);
  const backAdjustment = Math.round(back.reduce((total, tooth) => total + (metalOf(tooth) + finish(tooth) + stonesOf(tooth) + settingOf(tooth)) * (positionFactor(pricing, tooth.index) - 1), 0));
  add(`Back teeth · ${back.length} ${back.length === 1 ? 'tooth' : 'teeth'}`, backAdjustment);
  // The set-size discount comes off everything charged per tooth.
  const percent = volumeDiscount(pricing, teeth.length);
  if (percent) add(`Set discount · ${teeth.length} teeth, ${percent}% off`, -Math.round(((metal + finishes + stones + settings + backAdjustment) * percent) / 100));
  if (teeth.some((tooth) => tooth.type === 'photo')) add('Photo artwork', pricing.extras.photo);
  // Fangs are built on the upper canines: none in the set, no fangs to charge for.
  const fangs = fangCount(teeth, set.fangs);
  if (fangs) add(pricing.fangsPer === 'fang' ? `Fangs · ${fangs}` : 'Fangs', pricing.extras.fangs * (pricing.fangsPer === 'fang' ? fangs : 1));
  if (set.cut === 'permanent') add('Permanent look', pricing.extras.permanent);
  if (set.inscription) add(`Inscription "${set.inscription.text}"`, pricing.inscription[set.inscription.style] ?? 0);
  if (set.mold) add(label(MOLDS, set.mold), pricing.molds?.[set.mold] ?? 0);
  (set.addOns ?? []).forEach((id) => {
    const addOn = addOns.find((item) => item.id === id);
    if (addOn) add(addOn.per === 'tooth' ? `${addOn.label} · ${teeth.length} teeth` : addOn.label, addOn.per === 'tooth' ? addOn.price * teeth.length : addOn.price);
  });
  const subtotal = lines.reduce((total, line) => total + line.amount, 0);
  if (pricing.minimumOrder > subtotal) lines.push({ label: 'Minimum order adjustment', amount: pricing.minimumOrder - subtotal });
  const quote = pricing.market?.enabled ? pricing.market.quote : undefined;
  const market = quote && teeth.some((tooth) => quote.perTooth[quoteKey(tooth.metal, tooth.karat)] !== undefined)
    ? { asOf: quote.asOf, gold: quote.gold, silver: quote.silver, platinum: quote.platinum }
    : undefined;
  return { lines, total: Math.max(subtotal, pricing.minimumOrder), ...(market ? { market } : {}) };
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
    metal: (metal: MetalId, karat: KaratId) => hint(`${usd(metalPerTooth(pricing, metal, karat))} / tooth`),
    style: (style: StyleId) => hint(pricing.stylePerTooth[style] ? `+${usd(pricing.stylePerTooth[style]!)} / tooth` : 'Included'),
    stone: (stone: StoneId) => hint(`+${usd(pricing.stonePerTooth[stone] ?? 0)} / tooth`),
    setting: (setting: SettingId) => hint(pricing.settingPerTooth[setting] ? `+${usd(pricing.settingPerTooth[setting]!)} / tooth` : 'Included'),
    type: (type: GrillzType) => hint(type === 'photo' ? `+${usd(pricing.extras.photo)} artwork` : type === 'iced' ? 'Stones priced next' : 'Included'),
    inscription: (style: InscriptionStyleId) => hint(`+${usd(pricing.inscription[style] ?? 0)}`),
    fangs: () => hint(pricing.extras.fangs ? `+${usd(pricing.extras.fangs)}${pricing.fangsPer === 'fang' ? ' / fang' : ''}` : 'Included'),
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
