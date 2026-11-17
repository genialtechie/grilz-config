// What a sent design leaves on this device, so the deposit's return (?deposit=paid, often in another tab)
// can open the Sent screen with "Order started", and the first tab can hear that it was paid.
import type { LeadReceipt } from '../../../lib/leads';

export type SentRecord = { tenant: string; receipt: LeadReceipt; name: string; phone: string; at: number };

const SENT_KEY = 'vvs-after-sent';
const PAID_KEY = 'vvs-after-paid';
const NAME_KEY = 'vvs-first-name';
const DAY = 24 * 60 * 60 * 1000;

const read = (key: string) => {
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
};
const write = (key: string, value: string) => {
  try {
    localStorage.setItem(key, value);
  } catch {
    // private mode: the flow still works, only the return after paying can't find it
  }
};

export const saveSent = (record: SentRecord) => write(SENT_KEY, JSON.stringify(record));

export const loadSent = (tenant: string, now = Date.now()): SentRecord | null => {
  try {
    const record = JSON.parse(read(SENT_KEY) ?? 'null') as SentRecord | null;
    return record && record.tenant === tenant && record.receipt?.leadId && now - record.at < DAY ? record : null;
  } catch {
    return null;
  }
};

/** True when Stripe sent the shopper back after paying (server/billing.ts: `?deposit=paid`). The builder opens the flow on it. */
export const isDepositReturn = () => typeof window !== 'undefined' && new URLSearchParams(window.location.search).get('deposit') === 'paid';

/** Takes `deposit=paid` off the address so a reload doesn't say it again. */
export const clearDepositReturn = () => {
  try {
    const url = new URL(window.location.href);
    url.searchParams.delete('deposit');
    window.history.replaceState(window.history.state, '', url.pathname + url.search + url.hash);
  } catch {
    // some frames don't allow it
  }
};

/** Tells other tabs (the one the shopper paid from) that this lead's deposit is paid. */
export const markPaid = (leadId: string) => write(PAID_KEY, leadId);
export const PAID_STORAGE_KEY = PAID_KEY;

/** The first name used last time, since a remembered phone carries only the number. */
export const rememberedName = () => read(NAME_KEY) ?? '';
export const rememberName = (name: string) => write(NAME_KEY, name.trim());
