import { getTenant, type ConfigRow, type TenantRow } from '../admin/data';
import { parseTenantConfig, type TenantConfig } from '../lib/tenant/schema';

export type Loaded = { tenant: TenantRow; configs: ConfigRow[]; config: TenantConfig };

/** The shop's prices can be set the quick way: the starting prices, or prices it set with the questions. */
export const quickPricingFits = (config: TenantConfig | null) => config?.pricing.source === 'default' || config?.pricing.source === 'quick';

/** The newest config: a draft being edited, or the published one. */
export async function loadShopConfig(slug: string): Promise<Loaded | null> {
  const result = await getTenant(slug);
  const latest = result?.configs[0];
  const parsed = latest ? parseTenantConfig(latest.config) : null;
  return result && parsed?.ok ? { tenant: result.tenant, configs: result.configs, config: parsed.config } : null;
}
