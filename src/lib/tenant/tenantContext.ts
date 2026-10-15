import { createContext } from 'react';
import { buildTenant, type Tenant } from './tenant';
import { VVSLAB_CONFIG } from './vvslab';

export const TenantContext = createContext<Tenant>(buildTenant('vvslab', VVSLAB_CONFIG));
