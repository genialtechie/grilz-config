import { isGold, type GrillzType, type InscriptionStyleId, type KaratId, type MetalId, type SetOptions, type SettingId, type StoneId, type StyleId, type ToothDesign } from './renderSpec.js';
import type { TenantDeposit, TenantPricing } from './tenant/schema.js';

// The price engine: pure functions of a design and a tenant's pricing. The same
// code runs in the builder and on the server, which recomputes every total.

export type PriceLine = { label: string; amount: number };
export type PriceBreakdown = { lines: PriceLine[]; total: number };

export const metalPerTooth = (pricing: TenantPricing, metal: MetalId, karat: KaratId) =>
  Math.round((pricing.metalPerTooth[metal] ?? 0) * (isGold(metal) ? pricing.karatMultiplier[karat] ?? 1 : 1));

export const priceBreakdown = (pricing: TenantPricing, teeth: ToothDesign[], set: SetOptions): PriceBreakdown => {
  const lines: PriceLine[] = [{ label: 'Service fee', amount: pricing.base }];
  if (teeth.length === 0) return { lines, total: pricing.base };
  const sum = (fn: (tooth: ToothDesign) => number) => teeth.reduce((total, tooth) => total + fn(tooth), 0);
  const add = (label: string, amount: number) => amount && lines.push({ label, amount });
  add(`Metal · ${teeth.length} teeth`, sum((tooth) => metalPerTooth(pricing, tooth.metal, tooth.karat)));
  add('Style & finish', sum((tooth) => (tooth.type === 'iced' ? 0 : pricing.stylePerTooth[tooth.style] ?? 0)));
  add('Stones', sum((tooth) => (tooth.type === 'iced' ? pricing.stonePerTooth[tooth.stone] ?? 0 : 0)));
  add('Mosaic setting', sum((tooth) => (tooth.type === 'iced' ? pricing.settingPerTooth[tooth.setting] ?? 0 : 0)));
  if (teeth.some((tooth) => tooth.type === 'photo')) add('Photo artwork', pricing.extras.photo);
  if (set.fangs) add('Fangs', pricing.extras.fangs);
  if (set.cut === 'permanent') add('Permanent look', pricing.extras.permanent);
  if (set.inscription) add(`Inscription "${set.inscription.text}"`, pricing.inscription[set.inscription.style] ?? 0);
  const subtotal = lines.reduce((total, line) => total + line.amount, 0);
  if (pricing.minimumOrder > subtotal) lines.push({ label: 'Minimum order adjustment', amount: pricing.minimumOrder - subtotal });
  return { lines, total: Math.max(subtotal, pricing.minimumOrder) };
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
  };
};

/** How a total is shown to the customer: the exact figure, a "from" figure, or nothing. */
export const displayTotal = (pricing: TenantPricing, total: number, format: (value: number) => string) => {
  if (pricing.display === 'hidden') return { text: 'Price on request', amount: null };
  if (pricing.display === 'from') return { text: `From ${format(total)}`, amount: total };
  return { text: format(total), amount: total };
};
