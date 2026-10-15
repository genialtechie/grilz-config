import {
  CUTS,
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
} from '../renderSpec';
import type { TenantCatalog } from './schema';

// The platform catalog narrowed to what one shop sells, in the platform's order.

const only = <T extends { id: string }>(list: readonly T[], enabled: readonly string[]) => list.filter((item) => enabled.includes(item.id));

export const shopCatalog = (catalog: TenantCatalog) => ({
  metals: only(METALS, catalog.metals),
  karats: only(KARATS, catalog.karats),
  types: only(GRILLZ_TYPES, catalog.types),
  styles: only(STYLES, catalog.styles),
  settings: only(SETTINGS, catalog.settings),
  stones: only(STONES, catalog.stones),
  cuts: only(CUTS, catalog.cuts),
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

export const defaultSet = (catalog: TenantCatalog): SetOptions => ({ ...DEFAULT_SET, cut: pick(DEFAULT_SET.cut, catalog.cuts) });
