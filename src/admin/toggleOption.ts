import { CUTS, GRILLZ_TYPES, KARATS, METALS, MOLDS, SETTINGS, STONES, STYLES } from '../lib/renderSpec';
import type { TenantConfig } from '../lib/tenant/schema';
import { SAMPLE_PRICING } from './templates';

export type OptionList = keyof Pick<TenantConfig['catalog'], 'metals' | 'karats' | 'types' | 'styles' | 'settings' | 'stones' | 'cuts' | 'molds'>;

const ORDER = { metals: METALS, karats: KARATS, types: GRILLZ_TYPES, styles: STYLES, settings: SETTINGS, stones: STONES, cuts: CUTS, molds: MOLDS } as const;
const PRICES = { metals: 'metalPerTooth', karats: 'karatMultiplier', styles: 'stylePerTooth', settings: 'settingPerTooth', stones: 'stonePerTooth' } as const;

/**
 * Turns an option on or off in a draft (mutates it). Turning one on gives it a sample price so the config stays valid.
 * A cut's price is deliberately kept when the cut is turned off, so turning it back on restores it exactly;
 * the parse/save transform (`pruneCutPrices`) is what drops prices for cuts the shop doesn't offer.
 */
export const toggleOption = (next: TenantConfig, list: OptionList, id: string, on: boolean) => {
  const current = next.catalog[list] as string[];
  next.catalog[list] = (on ? [...current, id] : current.filter((item) => item !== id)) as never;
  const order = ORDER[list] as readonly { id: string }[];
  (next.catalog[list] as string[]).sort((a, b) => order.findIndex((item) => item.id === a) - order.findIndex((item) => item.id === b));
  const key = PRICES[list as keyof typeof PRICES];
  if (on && key) {
    const map = next.pricing[key] as Record<string, number>;
    if (map[id] === undefined) map[id] = (SAMPLE_PRICING[key] as Record<string, number>)[id] ?? 0;
  }
};
