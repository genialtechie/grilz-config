import { useMemo, type ReactNode } from 'react';
import type { TenantConfig } from './schema';
import { buildTenant } from './tenant';
import { TenantContext } from './tenantContext';

type Props = { slug: string; config: TenantConfig; demo?: boolean; version?: number; preview?: boolean; promos?: boolean; children: ReactNode };

export function TenantProvider({ slug, config, demo = false, version = 0, preview = false, promos = false, children }: Props) {
  const tenant = useMemo(() => buildTenant(slug, config, demo, version, preview, promos), [slug, config, demo, version, preview, promos]);
  return <TenantContext.Provider value={tenant}>{children}</TenantContext.Provider>;
}
