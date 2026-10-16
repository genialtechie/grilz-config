import { useMemo, type ReactNode } from 'react';
import type { TenantConfig } from './schema';
import { buildTenant } from './tenant';
import { TenantContext } from './tenantContext';

type Props = { slug: string; config: TenantConfig; demo?: boolean; version?: number; preview?: boolean; children: ReactNode };

export function TenantProvider({ slug, config, demo = false, version = 0, preview = false, children }: Props) {
  const tenant = useMemo(() => buildTenant(slug, config, demo, version, preview), [slug, config, demo, version, preview]);
  return <TenantContext.Provider value={tenant}>{children}</TenantContext.Provider>;
}
