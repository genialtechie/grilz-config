import { useMemo, type ReactNode } from 'react';
import type { TenantConfig } from './schema';
import { buildTenant } from './tenant';
import { TenantContext } from './tenantContext';

export function TenantProvider({ slug, config, demo = false, children }: { slug: string; config: TenantConfig; demo?: boolean; children: ReactNode }) {
  const tenant = useMemo(() => buildTenant(slug, config, demo), [slug, config, demo]);
  return <TenantContext.Provider value={tenant}>{children}</TenantContext.Provider>;
}
