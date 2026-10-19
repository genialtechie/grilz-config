import { priceHints } from '../pricing';
import { defaultSet, defaultTooth, shopCatalog } from './catalog';
import type { TenantConfig } from './schema';

/** A tenant ready for the builder: its config plus everything derived from it once. */
export type Tenant = {
  slug: string;
  /** The public demo: deposits and leads are simulated. */
  demo: boolean;
  /** The published config version this session is priced with. */
  version: number;
  /** An admin previewing an unpublished draft: leads and renders are disabled. */
  preview: boolean;
  /** The shop has an active promo code: show the code field on the Review step. */
  promos: boolean;
  config: TenantConfig;
  catalog: ReturnType<typeof shopCatalog>;
  hints: ReturnType<typeof priceHints>;
  defaultTooth: ReturnType<typeof defaultTooth>;
  defaultSet: ReturnType<typeof defaultSet>;
};

export const buildTenant = (slug: string, config: TenantConfig, demo = false, version = 0, preview = false, promos = false): Tenant => ({
  slug,
  demo,
  version,
  preview,
  promos,
  config,
  catalog: shopCatalog(config.catalog),
  hints: priceHints(config.pricing),
  defaultTooth: defaultTooth(config.catalog),
  defaultSet: defaultSet(config.catalog),
});
