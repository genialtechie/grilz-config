import { useContext } from 'react';
import { TenantContext } from './tenantContext';

export const useTenant = () => useContext(TenantContext);
