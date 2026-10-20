import { describe, expect, it } from 'vitest';
import { VVSLAB_CONFIG } from '../../src/lib/tenant/vvslab';
import type { Db } from '../db';
import { shopEmail, type LeadForEmail } from '../emailTemplates';
import { depositOfferFor } from '../notify';
import { TENANT_ZERO, type PublishedTenant } from '../tenants';

// Deposits start off (MAG-91). A shop's first design request offers them, but
// only while deposits are off and Stripe isn't connected.

const origin = 'https://vvslab.magpollo.com';
const offer = `${origin}/dashboard/gold-mouth/shop?advanced=1#deposit`;
const shop = (mode: 'none' | 'link' | 'stripe' = 'none'): PublishedTenant => ({
  ...TENANT_ZERO,
  slug: 'gold-mouth',
  kind: 'shop',
  config: { ...VVSLAB_CONFIG, deposit: { ...VVSLAB_CONFIG.deposit, mode } },
});
const db = ({ stripe = false, sent = 1 } = {}) =>
  ({ select: async () => [{ stripe_charges_enabled: stripe }], count: async () => sent }) as unknown as Db;
const row = { tenant_id: 't1' } as Parameters<typeof depositOfferFor>[1];

describe('deposit offer', () => {
  it('rides the first request when deposits are off and Stripe isn’t connected', async () => {
    expect(await depositOfferFor(db(), row, shop(), origin)).toBe(offer);
  });

  it('not once Stripe is connected, after the first request, with deposits on, or for the demo', async () => {
    expect(await depositOfferFor(db({ stripe: true }), row, shop(), origin)).toBeNull();
    expect(await depositOfferFor(db({ sent: 2 }), row, shop(), origin)).toBeNull();
    expect(await depositOfferFor(db(), row, shop('link'), origin)).toBeNull();
    expect(await depositOfferFor(db(), row, shop('stripe'), origin)).toBeNull();
    expect(await depositOfferFor(db(), row, { ...shop(), kind: 'demo' }, origin)).toBeNull();
  });

  it('shows in the email only when offered', async () => {
    const lead: LeadForEmail = {
      id: '00000000-0000-4000-8000-000000000001', name: 'Ava', contact: '+14045550100', email: null, note: null, summary: ['6 top · 10K yellow'],
      total: 600, deposit: null, configVersion: 1, price: { lines: [{ label: 'Gold', amount: 600 }], total: 600 }, createdAt: new Date().toISOString(),
    } as unknown as LeadForEmail;
    const input = { lead, config: shop().config, origin, images: { photo: false, preview: true }, photoPending: false, test: false };
    const offered = await shopEmail({ ...input, depositOffer: offer });
    expect(offered.text).toContain(`Take a deposit on orders like this? Set it up in 2 minutes: ${offer}`);
    expect(offered.html).toContain('Set it up in 2 minutes');
    expect(offered.html).toContain('shop?advanced=1#deposit');
    const plain = await shopEmail(input);
    expect(plain.text).not.toContain('Take a deposit');
    expect(plain.html).not.toContain('Set it up in 2 minutes');
  });
});
