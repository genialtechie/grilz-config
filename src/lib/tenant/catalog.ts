import {
  CUTS,
  SELLABLE_CUTS,
  DEFAULT_SET,
  DEFAULT_TOOTH,
  GRILLZ_TYPES,
  INSCRIPTION_STYLES,
  KARATS,
  METALS,
  MOLDS,
  SETTINGS,
  STONES,
  STYLES,
  type SetOptions,
  type ToothDesign,
} from '../renderSpec.js';
import { cutPrice } from '../pricing.js';
import type { TenantCatalog, TenantPricing } from './schema.js';

// The platform catalog narrowed to what one shop sells, in the platform's order.

const only = <T extends { id: string }>(list: readonly T[], enabled: readonly string[]) => list.filter((item) => enabled.includes(item.id));

/**
 * The cuts the builder offers (MAG-205): none when the shop has none turned on,
 * and a free "Standard" first when every cut it has costs something, so a paid
 * cut is never the only choice.
 */
export const shopCuts = (catalog: TenantCatalog, pricing: TenantPricing) => {
  const cuts = only(SELLABLE_CUTS, catalog.cuts);
  const free = cuts.some((cut) => cutPrice(pricing, cut.id).amount === 0);
  return cuts.length && !free ? [CUTS.find((cut) => cut.id === 'standard')!, ...cuts] : cuts;
};

export const shopCatalog = (catalog: TenantCatalog, pricing: TenantPricing) => ({
  metals: only(METALS, catalog.metals),
  karats: only(KARATS, catalog.karats),
  types: only(GRILLZ_TYPES, catalog.types),
  styles: only(STYLES, catalog.styles),
  settings: only(SETTINGS, catalog.settings),
  stones: only(STONES, catalog.stones),
  cuts: shopCuts(catalog, pricing),
  molds: only(MOLDS, catalog.molds),
  inscriptionStyles: catalog.inscription.enabled ? only(INSCRIPTION_STYLES, catalog.inscription.styles) : [],
  fangs: catalog.fangs,
  vision: catalog.vision,
});

const pick = <T extends string>(preferred: T, enabled: readonly T[]) => (enabled.includes(preferred) ? preferred : enabled[0]);

/** The starting tooth design: the platform default, moved onto options the shop sells. */
export const defaultTooth = (catalog: TenantCatalog): ToothDesign => ({
  metal: pick(DEFAULT_TOOTH.metal, catalog.metals),
  karat: pick(DEFAULT_TOOTH.karat, catalog.karats),
  type: pick(DEFAULT_TOOTH.type, catalog.types),
  style: pick(DEFAULT_TOOTH.style, catalog.styles),
  setting: pick(DEFAULT_TOOTH.setting, catalog.settings),
  stone: pick(DEFAULT_TOOTH.stone, catalog.stones),
});

/** The first free cut; with no cuts on, Standard (the set always has one, the builder just doesn't show it). */
export const defaultSet = (catalog: TenantCatalog, pricing: TenantPricing): SetOptions => {
  const cuts = shopCuts(catalog, pricing);
  const free = cuts.find((cut) => cutPrice(pricing, cut.id).amount === 0);
  return { ...DEFAULT_SET, cut: free?.id ?? 'standard', mold: pick('kit', catalog.molds) };
};
