import { useMemo, type ReactNode } from 'react';
import type { TenantConfig } from './schema';
import { buildTenant } from './tenant';
import { TenantContext } from './tenantContext';

export function TenantProvider({ slug, config, children }: { slug: string; config: TenantConfig; children: ReactNode }) {
  const tenant = useMemo(() => buildTenant(slug, config), [slug, config]);
  return <TenantContext.Provider value={tenant}>{children}</TenantContext.Provider>;
}
