// The after-Done flow's rules, kept free of React so they can be tested on their own.
// Screens (signed off Nov 17): 1. Your grill (price, fitting, where to text) → 2. the code → 3. Sent.
import type { MoldId } from '../../../lib/renderSpec';

export type Screen = 'grill' | 'code' | 'sent';

/** The shop's name as the shopper sees it: on VVS Lab's own site that is VVS Lab. */
export const shopNameFor = (slug: string, brandName: string) => (slug === 'vvslab' ? 'VVS Lab' : brandName.trim() || 'the shop');

/** VVS Lab's own site has no store yet, so no in-store fitting there. */
export const fittingsFor = (molds: readonly MoldId[], ownSite: boolean): MoldId[] => molds.filter((mold) => !(ownSite && mold === 'store'));

/** The picked fitting if the shop offers it, else the shop's first. */
export const pickFitting = (offered: readonly MoldId[], current: MoldId | undefined): MoldId | undefined =>
  current && offered.includes(current) ? current : offered[0];

export const FIT_WORDS: Record<MoldId, { title: string; hint: (shop: string) => string }> = {
  kit: { title: 'Mold kit by mail', hint: () => 'They post you a kit. You bite, then mail it back.' },
  own: { title: 'Own mold or scan', hint: () => 'You already have one.' },
  store: { title: 'In-store fitting', hint: (shop) => `Visit ${shop}.` },
};

// ---------- phone numbers (US, 10 digits) ----------

/** The 10 digits of a US number, dropping a leading country code 1. */
export const phoneDigits = (value: string) => {
  const digits = value.replace(/\D/g, '');
  return digits.length === 11 && digits[0] === '1' ? digits.slice(1) : digits;
};

/** "(555) 012-3456", as they type. */
export const formatPhone = (value: string) => {
  const d = phoneDigits(value).slice(0, 10);
  if (d.length < 4) return d;
  if (d.length < 7) return `(${d.slice(0, 3)}) ${d.slice(3)}`;
  return `(${d.slice(0, 3)}) ${d.slice(3, 6)}-${d.slice(6)}`;
};

/** The number in the form the code service takes: +15550123456. */
export const e164 = (value: string) => `+1${phoneDigits(value)}`;

export type ContactError = { field: 'name' | 'phone'; message: string };

/** What stops the send, about the first field that needs it. A verified phone needs no number. */
export const contactError = (contact: { name: string; phone: string }, phoneVerified = false): ContactError | null => {
  if (contact.name.trim().length < 2) return { field: 'name', message: 'Add your first name.' };
  if (!phoneVerified && phoneDigits(contact.phone).length !== 10) return { field: 'phone', message: 'Add your 10-digit phone number.' };
  return null;
};

// ---------- the code ----------

export const CODE_LENGTH = 6;
export const RESEND_SECONDS = 30;

/** Digits only, at most six (a pasted "123 456" or "Your code is 123456" still works). */
export const cleanCode = (value: string) => value.replace(/\D/g, '').slice(0, CODE_LENGTH);

export const mmss = (seconds: number) => {
  const s = Math.max(0, Math.ceil(seconds));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
};

/** Under the code boxes: a countdown, then the way to ask again. */
export const resendState = (secondsLeft: number): { canResend: boolean; text: string } =>
  secondsLeft > 0 ? { canResend: false, text: `Send a new code in ${mmss(secondsLeft)}` } : { canResend: true, text: 'Send a new code' };

// ---------- which screen comes next ----------

export type FlowEvent =
  /** "Send to [Shop]" on Your grill. A phone verified on this device skips the code. */
  | { type: 'send'; verified: boolean }
  /** The 6th digit checked out and the design went. */
  | { type: 'confirmed' }
  /** "Back" or "Wrong number? Change it" on the code screen. */
  | { type: 'back' }
  /** The server turned the phone down (its token expired): ask for a code again. */
  | { type: 'phoneRejected' };

/** Where the flow goes; `sending` means the design goes now, with no screen between. */
export const nextScreen = (screen: Screen, event: FlowEvent): Screen | 'sending' => {
  switch (event.type) {
    case 'send':
      return screen === 'grill' ? (event.verified ? 'sending' : 'code') : screen;
    case 'confirmed':
      return screen === 'code' ? 'sent' : screen;
    case 'back':
      return screen === 'code' ? 'grill' : screen;
    case 'phoneRejected':
      return screen === 'sent' ? screen : 'code';
  }
};

// ---------- the deposit (offered on Sent, optional) ----------

export type DepositState = 'offer' | 'skipped' | 'opening' | 'opened' | 'paid';

export const money = (amount: number) => `${amount < 0 ? '−' : ''}$${Math.abs(Math.round(amount)).toLocaleString('en-US')}`;

/** The deposit row's words (owner's, Nov 17). */
export const depositWords = (shop: string, amount: number, state: DepositState) =>
  state === 'paid'
    ? { title: 'Order started', hint: `${money(amount)} deposit paid to ${shop}, counted toward your grill.` }
    : { title: 'Start your order', hint: `${money(amount)} now, counted toward your grill. ${shop} confirms the rest.` };

export type FootButton = { action: 'skip' | 'pay' | 'save'; label: string; ghost: boolean; busy?: boolean };

/** Sent's footer: Not now + Pay, then Pay (quiet) + Save my photo, then Save my photo. */
export const sentFooter = (state: DepositState | null, amount: number): FootButton[] => {
  const save: FootButton = { action: 'save', label: 'Save my photo', ghost: false };
  if (state === null || state === 'paid') return [save];
  if (state === 'offer') return [{ action: 'skip', label: 'Not now', ghost: true }, { action: 'pay', label: `Pay ${money(amount)} deposit`, ghost: false }];
  if (state === 'opening') return [{ action: 'pay', label: 'Opening secure checkout…', ghost: false, busy: true }];
  return [{ action: 'pay', label: 'Pay deposit', ghost: true }, save];
};

/** Whether this shop can take the deposit here: the demo (simulated), its own pay link, or its Stripe. */
export const canTakeDeposit = (amount: number | null, mode: 'stripe' | 'link' | 'none', link: string | undefined, demo: boolean) =>
  amount !== null && amount > 0 && (demo || (mode === 'link' && Boolean(link)) || mode === 'stripe');

// ---------- while the photo develops ----------

export const PHOTO_SECONDS = 30;

/** How far the still has developed (0..1) after `elapsed` seconds; it waits short of done until the photo arrives. */
export const developed = (elapsedSeconds: number, photoReady: boolean) => {
  if (photoReady) return 1;
  const p = Math.min(1, Math.max(0, elapsedSeconds / PHOTO_SECONDS));
  return 0.85 * (1 - Math.pow(1 - p, 2.2));
};

export const photoCaption = (status: 'developing' | 'ready' | 'none', elapsedSeconds: number) =>
  status === 'ready'
    ? 'Your studio photo'
    : status === 'none'
      ? 'Your design, as sent'
      : elapsedSeconds < PHOTO_SECONDS
        ? `Developing your studio photo… ${mmss(PHOTO_SECONDS - elapsedSeconds)}`
        : 'Developing your studio photo… almost there';

export const isEmail = (value: string) => /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(value.trim());

/** A handle as they typed it ("[Shop] sees it as you typed it"), only trimmed and capped. */
export const cleanHandle = (value: string) => value.trim().slice(0, 40);

/** The shop's Instagram for the Follow row: VVS Lab's on its own site. */
export const followHandle = (ownSite: boolean, brandInstagram: string | undefined) => (ownSite ? 'vvslab.ai' : brandInstagram || null);
