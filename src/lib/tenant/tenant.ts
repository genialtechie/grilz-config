import { priceHints } from '../pricing';
import { defaultSet, defaultTooth, shopCatalog } from './catalog';
import type { TenantConfig } from './schema';

/** A tenant ready for the builder: its config plus everything derived from it once. */
export type Tenant = {
  slug: string;
  config: TenantConfig;
  catalog: ReturnType<typeof shopCatalog>;
  hints: ReturnType<typeof priceHints>;
  defaultTooth: ReturnType<typeof defaultTooth>;
  defaultSet: ReturnType<typeof defaultSet>;
};

export const buildTenant = (slug: string, config: TenantConfig): Tenant => ({
  slug,
  config,
  catalog: shopCatalog(config.catalog),
  hints: priceHints(config.pricing),
  defaultTooth: defaultTooth(config.catalog),
  defaultSet: defaultSet(config.catalog),
});
