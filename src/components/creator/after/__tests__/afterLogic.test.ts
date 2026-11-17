import { describe, expect, it } from 'vitest';
import {
  canTakeDeposit,
  cleanCode,
  contactError,
  depositWords,
  developed,
  e164,
  fittingsFor,
  followHandle,
  formatPhone,
  isEmail,
  nextScreen,
  phoneDigits,
  photoCaption,
  pickFitting,
  resendState,
  sentFooter,
  shopNameFor,
} from '../afterLogic';

describe('who the shopper is talking to', () => {
  it('is VVS Lab on its own site, the shop elsewhere', () => {
    expect(shopNameFor('vvslab', 'Anything')).toBe('VVS Lab');
    expect(shopNameFor('gold-lab', 'Gold Lab')).toBe('Gold Lab');
  });
  it('offers no in-store fitting on VVS Lab’s own site', () => {
    expect(fittingsFor(['kit', 'own', 'store'], true)).toEqual(['kit', 'own']);
    expect(fittingsFor(['kit', 'own', 'store'], false)).toEqual(['kit', 'own', 'store']);
  });
  it('keeps the picked fitting when offered, else the shop’s first', () => {
    expect(pickFitting(['kit', 'own'], 'own')).toBe('own');
    expect(pickFitting(['kit', 'own'], 'store')).toBe('kit');
    expect(pickFitting(['own'], undefined)).toBe('own');
  });
  it('follows VVS Lab on its site and the shop’s own handle elsewhere', () => {
    expect(followHandle(true, 'goldlab')).toBe('vvslab.ai');
    expect(followHandle(false, 'goldlab')).toBe('goldlab');
    expect(followHandle(false, undefined)).toBeNull();
  });
});

describe('the contact fields', () => {
  it('formats a US number as it is typed', () => {
    expect(formatPhone('555')).toBe('555');
    expect(formatPhone('55501')).toBe('(555) 01');
    expect(formatPhone('5550123456')).toBe('(555) 012-3456');
    expect(formatPhone('+1 555 012 3456')).toBe('(555) 012-3456');
    expect(phoneDigits('1-555-012-3456')).toBe('5550123456');
    expect(e164('(555) 012-3456')).toBe('+15550123456');
  });
  it('asks for the first missing thing, under its own field', () => {
    expect(contactError({ name: '', phone: '' })).toEqual({ field: 'name', message: 'Add your first name.' });
    expect(contactError({ name: 'Marcus', phone: '555012' })).toEqual({ field: 'phone', message: 'Add your 10-digit phone number.' });
    expect(contactError({ name: 'Marcus', phone: '(555) 012-3456' })).toBeNull();
  });
  it('needs no number when the phone is verified on this device', () => {
    expect(contactError({ name: 'Marcus', phone: '' }, true)).toBeNull();
    expect(contactError({ name: ' ', phone: '' }, true)?.field).toBe('name');
  });
  it('checks an email loosely', () => {
    expect(isEmail('a@b.co')).toBe(true);
    expect(isEmail('a@b')).toBe(false);
  });
});

describe('the code', () => {
  it('takes digits only, six at most', () => {
    expect(cleanCode('Your code is 123 456')).toBe('123456');
    expect(cleanCode('12345678')).toBe('123456');
  });
  it('counts down before a new code can be sent', () => {
    expect(resendState(24)).toEqual({ canResend: false, text: 'Send a new code in 0:24' });
    expect(resendState(0)).toEqual({ canResend: true, text: 'Send a new code' });
  });
});

describe('which screen comes next', () => {
  it('goes to the code, or straight to sending for a verified phone', () => {
    expect(nextScreen('grill', { type: 'send', verified: false })).toBe('code');
    expect(nextScreen('grill', { type: 'send', verified: true })).toBe('sending');
  });
  it('opens Sent once the code checks out', () => {
    expect(nextScreen('code', { type: 'confirmed' })).toBe('sent');
  });
  it('goes back from the code to Your grill', () => {
    expect(nextScreen('code', { type: 'back' })).toBe('grill');
  });
  it('asks for a code again when the server turns the phone down', () => {
    expect(nextScreen('grill', { type: 'phoneRejected' })).toBe('code');
    expect(nextScreen('sent', { type: 'phoneRejected' })).toBe('sent');
  });
});

describe('the deposit', () => {
  it('says the owner’s words', () => {
    expect(depositWords('VVS Lab', 150, 'offer')).toEqual({ title: 'Start your order', hint: '$150 now, counted toward your grill. VVS Lab confirms the rest.' });
    expect(depositWords('Gold Lab', 1500, 'paid')).toEqual({ title: 'Order started', hint: '$1,500 deposit paid to Gold Lab, counted toward your grill.' });
  });
  it('steps the footer from the offer to Save my photo', () => {
    expect(sentFooter('offer', 150).map((b) => b.label)).toEqual(['Not now', 'Pay $150 deposit']);
    expect(sentFooter('skipped', 150).map((b) => b.label)).toEqual(['Pay deposit', 'Save my photo']);
    expect(sentFooter('paid', 150).map((b) => b.label)).toEqual(['Save my photo']);
    expect(sentFooter(null, 0).map((b) => b.label)).toEqual(['Save my photo']);
  });
  it('is offered only where it can be taken', () => {
    expect(canTakeDeposit(150, 'stripe', undefined, false)).toBe(true);
    expect(canTakeDeposit(150, 'link', undefined, false)).toBe(false);
    expect(canTakeDeposit(150, 'link', 'https://pay.example', false)).toBe(true);
    expect(canTakeDeposit(null, 'stripe', undefined, true)).toBe(false);
    expect(canTakeDeposit(150, 'none', undefined, true)).toBe(true);
  });
});

describe('the photo developing', () => {
  it('develops most of the way, then waits for the photo', () => {
    expect(developed(0, false)).toBe(0);
    expect(developed(60, false)).toBeCloseTo(0.85);
    expect(developed(3, true)).toBe(1);
  });
  it('counts down, then names the photo', () => {
    expect(photoCaption('developing', 6)).toBe('Developing your studio photo… 0:24');
    expect(photoCaption('developing', 40)).toBe('Developing your studio photo… almost there');
    expect(photoCaption('ready', 40)).toBe('Your studio photo');
    expect(photoCaption('none', 0)).toBe('Your design, as sent');
  });
});
