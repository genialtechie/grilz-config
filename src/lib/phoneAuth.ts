// Phone codes for shoppers (owner's pick: Firebase phone auth). STAND-IN until the backend track lands:
// in this stand-in any 6 digits pass and the token is "dev:<phone>", which the server accepts only when
// ALLOW_DEV_PHONE=1. The signatures are the contract; the backend track replaces the insides.

export type PhoneStart = { ok: true } | { ok: false; error: string };
export type PhoneConfirm = { ok: true; token: string; phone: string } | { ok: false; error: string };

const KEY = 'vvs-verified-phone';

export async function startPhoneCode(phone: string): Promise<PhoneStart> {
  return /^\+?1?\d{10}$/.test(phone.replace(/\D/g, '')) ? { ok: true } : { ok: false, error: 'Add your 10-digit phone number.' };
}

export async function confirmPhoneCode(phone: string, code: string): Promise<PhoneConfirm> {
  if (!/^\d{6}$/.test(code)) return { ok: false, error: 'Enter the 6-digit code.' };
  const token = `dev:${phone.replace(/\D/g, '')}`;
  try { localStorage.setItem(KEY, JSON.stringify({ phone, token })); } catch { /* private mode */ }
  return { ok: true, token, phone };
}

/** A phone already verified on this device skips the code. */
export function rememberedPhone(): { phone: string; token: string } | null {
  try { const v = localStorage.getItem(KEY); return v ? (JSON.parse(v) as { phone: string; token: string }) : null; } catch { return null; }
}
