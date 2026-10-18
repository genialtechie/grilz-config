import { createHmac, timingSafeEqual } from 'node:crypto';

// Signed, expiring tokens tied to one lead at one shop. "lead" tokens let the
// browser that just sent a design attach its photo or open the deposit
// checkout (30 minutes); "deposit" tokens are the pay-deposit link in the
// customer's confirmation email (30 days).

export type TokenEnv = { LEAD_TOKEN_SECRET?: string; SUPABASE_SERVICE_ROLE_KEY?: string };
export type TokenPurpose = 'lead' | 'deposit';

const TTL_S: Record<TokenPurpose, number> = { lead: 30 * 60, deposit: 30 * 24 * 60 * 60 };

const secretFor = (env: TokenEnv) => env.LEAD_TOKEN_SECRET || env.SUPABASE_SERVICE_ROLE_KEY || '';
const sign = (payload: string, env: TokenEnv) => createHmac('sha256', secretFor(env)).update(payload).digest('base64url').slice(0, 32);

export const signLeadToken = (purpose: TokenPurpose, leadId: string, tenantId: string, env: TokenEnv, now = Date.now()) => {
  const expires = Math.floor(now / 1000) + TTL_S[purpose];
  return `${expires}.${sign(`${purpose}:${tenantId}:${leadId}:${expires}`, env)}`;
};

export const checkLeadToken = (purpose: TokenPurpose, leadId: unknown, tenantId: string | null, token: unknown, env: TokenEnv, now = Date.now()): leadId is string => {
  if (typeof leadId !== 'string' || typeof token !== 'string' || !tenantId || !/^[0-9a-f-]{36}$/.test(leadId) || !secretFor(env)) return false;
  const [expiresText, signature = ''] = token.split('.');
  const expires = Number(expiresText);
  if (!Number.isInteger(expires) || expires < now / 1000) return false;
  const expected = Buffer.from(sign(`${purpose}:${tenantId}:${leadId}:${expires}`, env));
  const given = Buffer.from(signature);
  return expected.length === given.length && timingSafeEqual(expected, given);
};
