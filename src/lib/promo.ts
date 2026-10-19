// Promo codes a shop gives its customers (MAG-88). Codes live in their own
// table, never in the shop's public config: the builder checks one through
// /api/promo and gets back only that code's terms. The server checks it again
// when the design is sent, and counts the use then.

export type PromoKind = 'percent' | 'amount';

/** The terms of one code, as the price engine needs them. */
export type Promo = { code: string; kind: PromoKind; value: number; minOrder: number };

/** Letters, numbers and dashes, 3 to 24 long, stored and compared in capitals. */
export const PROMO_PATTERN = /^[A-Z0-9][A-Z0-9-]{1,22}[A-Z0-9]$/;

export const normalizePromoCode = (value: unknown) => (typeof value === 'string' ? value.trim().toUpperCase().replace(/\s+/g, '') : '');

/** How a code reads to a customer: "15% off" or "$50 off". */
export const promoTerms = (promo: Pick<Promo, 'kind' | 'value'>) => (promo.kind === 'percent' ? `${promo.value}% off` : `$${promo.value} off`);

/** Why a code a customer typed doesn't apply, in their words. */
export const PROMO_REASONS = {
  unknown: "That code isn't valid for this shop.",
  paused: "That code isn't active right now.",
  expired: 'That code has expired.',
  used_up: 'That code has been used up.',
  throttled: 'Too many tries. Wait a few minutes and try again.',
} as const;
export type PromoReason = keyof typeof PROMO_REASONS;

/** A stored code's state for a customer right now: its terms, or why not. */
export function promoStatus(
  row: { code: string; kind: PromoKind; value: number | string; min_order: number | string; expires_at: string | null; max_uses: number | null; uses: number; active: boolean } | undefined,
  now = Date.now(),
): { ok: true; promo: Promo } | { ok: false; reason: PromoReason } {
  if (!row) return { ok: false, reason: 'unknown' };
  if (!row.active) return { ok: false, reason: 'paused' };
  if (row.expires_at && Date.parse(row.expires_at) <= now) return { ok: false, reason: 'expired' };
  if (row.max_uses !== null && row.uses >= row.max_uses) return { ok: false, reason: 'used_up' };
  return { ok: true, promo: { code: row.code, kind: row.kind, value: Number(row.value), minOrder: Number(row.min_order) } };
}
