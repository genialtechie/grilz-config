import { normalizePromoCode, PROMO_PATTERN, PROMO_REASONS, promoStatus, type Promo, type PromoReason } from '../src/lib/promo.js';
import { createDb, hasDb, type Db } from './db.js';
import { hashIp } from './spam.js';
import { getPublishedTenant, tenantIdFor, type TenantEnv } from './tenants.js';

// POST /api/promo: the builder checks a code a customer typed, and gets back
// that code's terms or why it doesn't apply. Never a list: codes stay private.
// Checks are throttled per visitor so codes can't be guessed by trying them all.

export type PromoEnv = TenantEnv & { LEAD_TOKEN_SECRET?: string };
export type PromoRow = { id: string; code: string; kind: 'percent' | 'amount'; value: number | string; min_order: number | string; expires_at: string | null; max_uses: number | null; uses: number; active: boolean };

/** Checks per visitor in the window, across shops. Plenty for a person retyping a code. */
export const PROMO_CHECKS = { perWindow: 12, windowMinutes: 15 };

const reply = (status: number, body: Record<string, unknown>) => ({ status, body });
const refuse = (status: number, reason: PromoReason) => reply(status, { ok: false, reason, error: PROMO_REASONS[reason] });

/** A shop's code as typed by a customer: its row and whether it applies now. */
export async function findPromo(db: Db, tenantId: string, typed: unknown): Promise<{ row?: PromoRow; status: ReturnType<typeof promoStatus> }> {
  const code = normalizePromoCode(typed);
  if (!PROMO_PATTERN.test(code)) return { status: { ok: false, reason: 'unknown' } };
  const [row] = await db.select<PromoRow>('promo_codes', { tenant_id: `eq.${tenantId}`, code: `eq.${code}`, select: 'id,code,kind,value,min_order,expires_at,max_uses,uses,active', limit: '1' });
  return { row, status: promoStatus(row) };
}

export async function handlePromo(payload: unknown, ip: string, env: PromoEnv): Promise<{ status: number; body: Record<string, unknown> }> {
  const body = payload && typeof payload === 'object' ? (payload as Record<string, unknown>) : {};
  const lookup = await getPublishedTenant(typeof body.tenant === 'string' ? body.tenant.toLowerCase() : '', env);
  if (!lookup.ok || lookup.tenant.status !== 'live' || !hasDb(env)) return refuse(404, 'unknown');
  const tenantId = await tenantIdFor(lookup.tenant, env);
  if (!tenantId) return refuse(404, 'unknown');
  const db = createDb(env);
  try {
    const visitor = hashIp(ip, env.LEAD_TOKEN_SECRET || env.SUPABASE_SERVICE_ROLE_KEY || '');
    const allowed = await db.rpc<boolean>('promo_attempt', { target: tenantId, visitor, per_window: PROMO_CHECKS.perWindow, window_minutes: PROMO_CHECKS.windowMinutes });
    if (!allowed) return refuse(429, 'throttled');
    const { status } = await findPromo(db, tenantId, body.code);
    return status.ok ? reply(200, { ok: true, promo: status.promo satisfies Promo }) : refuse(200, status.reason);
  } catch (error) {
    console.error('promo check failed', lookup.tenant.slug, error instanceof Error ? error.message : error);
    return reply(503, { ok: false, error: 'Couldn’t check that code. Try again.' });
  }
}
