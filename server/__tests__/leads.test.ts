import { describe, expect, it } from 'vitest';
import { displayContact, isEmail, normaliseContact } from '../../src/lib/contact';
import { priceBreakdown } from '../../src/lib/pricing';
import { summarizeDesign } from '../../src/lib/renderSpec';
import { VVSLAB_CONFIG } from '../../src/lib/tenant/vvslab';
import { DESIGNS } from '../../src/lib/__tests__/designs';
import { contactLink, customerEmail, shopEmail, type LeadForEmail } from '../emailTemplates';
import { leadToken, verifyLeadToken } from '../leads';
import { recipientsFor } from '../notify';
import { hashIp, looksAutomated } from '../spam';
import { TENANT_ZERO, type PublishedTenant } from '../tenants';
import { crossedWarning } from '../usage';

describe('contact checks', () => {
  it('normalises US phones and Instagram handles', () => {
    expect(normaliseContact('(404) 555-0199')).toEqual({ kind: 'phone', value: '+14045550199' });
    expect(normaliseContact('1 404 555 0199')).toEqual({ kind: 'phone', value: '+14045550199' });
    expect(normaliseContact('@Ava.Test')).toEqual({ kind: 'instagram', value: '@ava.test' });
    expect(normaliseContact('ava_test')).toEqual({ kind: 'instagram', value: '@ava_test' });
  });

  it('rejects things that are neither', () => {
    for (const value of ['', 'call me', '555-0199', '+44 20 7946 0958', '@a..b', '.ava', 'a'.repeat(31), '<script>']) {
      expect(normaliseContact(value), value).toBeNull();
    }
  });

  it('checks emails and formats phones for display', () => {
    expect(isEmail('ava@example.com')).toBe(true);
    expect(isEmail('ava@example')).toBe(false);
    expect(displayContact('+14045550199')).toBe('(404) 555-0199');
    expect(displayContact('+1 404 555 0142')).toBe('(404) 555-0142');
    expect(displayContact('@ava')).toBe('@ava');
  });
});

describe('spam signals', () => {
  it('flags the honeypot and impossibly fast forms', () => {
    expect(looksAutomated({ honeypot: '', elapsedMs: 30_000 })).toBe(false);
    expect(looksAutomated({ honeypot: 'http://x', elapsedMs: 30_000 })).toBe(true);
    expect(looksAutomated({ elapsedMs: 900 })).toBe(true);
    expect(looksAutomated({})).toBe(true);
  });

  it('hashes IPs with a salt', () => {
    expect(hashIp('203.0.113.1', 'a')).not.toBe(hashIp('203.0.113.1', 'b'));
    expect(hashIp('203.0.113.1', 'a')).toMatch(/^[0-9a-f]{32}$/);
  });
});

describe('lead tokens', () => {
  const env = { LEAD_TOKEN_SECRET: 'secret-one' };
  const id = '5761243a-6f73-4206-8c71-0eee46349627';
  const shop = 'eae3e55c-610b-47d4-b5cc-665289f37eb9';
  it('only verifies for the lead, shop and secret they were made for', () => {
    const token = leadToken(id, shop, env);
    expect(verifyLeadToken(id, shop, token, env)).toBe(true);
    expect(verifyLeadToken(id, '806cc381-f33c-4ec3-be95-e490d15aa965', token, env)).toBe(false);
    expect(verifyLeadToken(id, shop, token, { LEAD_TOKEN_SECRET: 'secret-two' })).toBe(false);
    expect(verifyLeadToken('00000000-0000-0000-0000-000000000000', shop, token, env)).toBe(false);
    expect(verifyLeadToken(id, shop, token.slice(0, -1), env)).toBe(false);
    expect(verifyLeadToken(id, null, token, env)).toBe(false);
    expect(verifyLeadToken(id, shop, token, {})).toBe(false);
  });

  it('expires after 30 minutes and cannot be extended', () => {
    const issued = Date.UTC(2026, 9, 16, 12, 0, 0);
    const token = leadToken(id, shop, env, issued);
    expect(verifyLeadToken(id, shop, token, env, issued + 29 * 60_000)).toBe(true);
    expect(verifyLeadToken(id, shop, token, env, issued + 31 * 60_000)).toBe(false);
    const [, signature] = token.split('.');
    expect(verifyLeadToken(id, shop, `${Math.floor(issued / 1000) + 99_999}.${signature}`, env, issued)).toBe(false);
  });
});

const lead = (patch: Partial<LeadForEmail> = {}): LeadForEmail => {
  const price = priceBreakdown(VVSLAB_CONFIG.pricing, DESIGNS.plain6x6.teeth, DESIGNS.plain6x6);
  return {
    id: '5761243a-6f73-4206-8c71-0eee46349627',
    name: 'Ava <b>Test</b>',
    contact: '@ava.test',
    email: 'ava@example.com',
    note: '"><img src=x onerror=alert(1)>',
    summary: summarizeDesign(DESIGNS.plain6x6),
    price,
    total: price.total,
    deposit: 500,
    configVersion: 3,
    createdAt: new Date().toISOString(),
    ...patch,
  };
};

describe('lead emails', () => {
  const origin = 'https://vvslab.magpollo.com';
  it('escapes everything the customer typed', async () => {
    const shop = await shopEmail({ lead: lead(), config: VVSLAB_CONFIG, origin, images: { photo: true, preview: false }, photoPending: false, test: false });
    expect(shop.html).not.toContain('<img src=x');
    expect(shop.html).not.toContain('<b>Test</b>');
    expect(shop.html).toContain('Ava &lt;b&gt;Test&lt;/b&gt;');
    expect(shop.html).toContain('cid:photo');
  });

  it('gives the jeweler a one-tap way to reach the customer', () => {
    expect(contactLink('+14045550199')).toEqual({ href: 'sms:+14045550199', label: '(404) 555-0199', action: 'Text' });
    expect(contactLink('@ava.test').href).toBe('https://instagram.com/ava.test');
  });

  it('shows the customer the price the way the shop displays it', async () => {
    const hidden = structuredClone(VVSLAB_CONFIG);
    hidden.pricing.display = 'hidden';
    const email = await customerEmail({ lead: lead(), config: hidden, origin, images: { photo: true, preview: false } });
    expect(email.html).toContain('price it for you');
    expect(email.html).not.toContain(`$${lead().total.toLocaleString('en-US')}<`);
    expect(email.html).toContain('handmade and may vary');
  });

  it('tells the shop when the photo will follow', async () => {
    const shop = await shopEmail({ lead: lead(), config: VVSLAB_CONFIG, origin, images: { photo: false, preview: true }, photoPending: true, test: true });
    expect(shop.subject.startsWith('[Test shop] ')).toBe(true);
    expect(shop.html).toContain('cid:preview');
    expect(shop.text).toContain('will follow');
  });
});

describe('lead routing', () => {
  const env = { PLATFORM_LEADS_EMAIL: 'platform@example.com' };
  const shop = (patch: Partial<PublishedTenant>, emails: string[] = ['orders@shop.com']): PublishedTenant => ({
    ...TENANT_ZERO,
    id: 'x',
    slug: 'shop',
    kind: 'shop',
    config: { ...structuredClone(VVSLAB_CONFIG), leads: { email: emails, sms: [] } },
    ...patch,
  });
  it('sends a shop its own leads, and demo or test leads to Magpollo', () => {
    expect(recipientsFor(shop({}), env)).toEqual({ to: ['orders@shop.com'], test: false });
    expect(recipientsFor(shop({ kind: 'fixture' }), env)).toEqual({ to: ['platform@example.com'], test: true });
    expect(recipientsFor(shop({ kind: 'demo' }), env)).toEqual({ to: ['platform@example.com'], test: false });
    expect(recipientsFor(shop({}, []), env)).toEqual({ to: ['platform@example.com'], test: false });
  });
});

describe('AI allowance warning', () => {
  it('fires once, on the render that crosses 80%', () => {
    expect(crossedWarning(230, 241, 300)).toBe(true);
    expect(crossedWarning(240, 245, 300)).toBe(false);
    expect(crossedWarning(100, 110, 300)).toBe(false);
    expect(crossedWarning(0, 5, 0)).toBe(false);
  });
});

describe('lead source', () => {
  it('keeps UTM tags and where the builder ran (hostnames only), drops anything else', async () => {
    const { readSource } = await import('../leads');
    expect(readSource({ utm_source: 'embed', embed: 'GoldMouth.myshopify.com', domain: 'build.goldmouth.com', email: 'a@b.c' })).toEqual({ utm_source: 'embed', embed: 'goldmouth.myshopify.com', domain: 'build.goldmouth.com' });
    expect(readSource({ embed: '<script>', domain: 'javascript:alert(1)' })).toEqual({});
  });
});
