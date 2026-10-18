import { createElement as h, Fragment, type ReactElement, type ReactNode } from 'react';
import { render } from '@react-email/render';
import { displayContact } from '../src/lib/contact.js';
import { displayTotal, type PriceBreakdown } from '../src/lib/pricing.js';
import type { TenantConfig } from '../src/lib/tenant/schema.js';
import { shopBrand, vvsBrand, type Brand } from './email/brand.js';
import { CTA, EmailFrame, Eyebrow, Facts, Headline, InlineLink, Lines, Paragraph, Photo, SectionLabel } from './email/components.js';

// Every email we send, built from the kit in server/email/ (React Email,
// written with createElement so Vercel bundles it). Design photos are inline
// attachments (cid:) so they show without "load remote images" and never
// expire; artwork and logos load from our origin.

export type LeadForEmail = {
  id: string;
  name: string;
  contact: string;
  email: string | null;
  note: string | null;
  summary: string[];
  price: PriceBreakdown;
  total: number;
  deposit: number | null;
  configVersion: number;
  createdAt: string;
};

export type EmailImages = { photo: boolean; preview: boolean };
export type RenderedEmail = { subject: string; html: string; text: string };

const usd = (value: number) => `$${value.toLocaleString('en-US', { maximumFractionDigits: 2 })}`;

export const AI_DISCLOSURE = 'AI studio photo of your design. The finished piece is handmade and may vary.';

/** A link the jeweler can tap to reach the customer, and what to call it. */
export function contactLink(contact: string): { href: string; label: string; action: string } {
  if (contact.startsWith('+')) return { href: `sms:${contact}`, label: displayContact(contact), action: 'Text' };
  const handle = contact.replace(/^@/, '');
  return { href: `https://instagram.com/${encodeURIComponent(handle)}`, label: `@${handle}`, action: 'Message on Instagram' };
}

const firstName = (name: string) => name.split(/\s+/)[0] ?? name;
const host = (origin: string) => origin.replace(/^https?:\/\//, '').replace(/\/$/, '');
const dashboardUrl = (origin: string) => `${origin.replace(/\/$/, '')}/dashboard`;
const html = (element: ReactElement) => render(element);

function designPhoto(brand: Brand, images: EmailImages, caption: string) {
  const cid = images.photo ? 'photo' : images.preview ? 'preview' : null;
  return cid ? h(Photo, { brand, src: `cid:${cid}`, alt: caption, caption }) : null;
}

function specList(brand: Brand, summary: string[]) {
  if (!summary.length) return null;
  return h(
    Fragment,
    null,
    h(SectionLabel, { brand }, 'The design'),
    ...summary.map((line, index) => h(Paragraph, { key: index, brand, size: 15, margin: '0 0 5px' }, line)),
  );
}

export type ShopEmailInput = {
  lead: LeadForEmail;
  config: TenantConfig;
  origin: string;
  images: EmailImages;
  photoPending: boolean;
  test: boolean;
};

/** The jeweler's notification: everything needed to quote and reach the customer. */
export async function shopEmail({ lead, config, origin, images, photoPending, test }: ShopEmailInput): Promise<RenderedEmail> {
  const brand = vvsBrand(origin);
  const reach = contactLink(lead.contact);
  const first = firstName(lead.name);
  const headline = lead.summary[0] ?? 'Custom grillz';
  const subject = `${test ? '[Test shop] ' : ''}New design from ${lead.name} · ${headline} · ${usd(lead.total)}`;
  const shown = config.pricing.display === 'exact' ? '' : config.pricing.display === 'from' ? ' (customer saw it as a "from" price)' : ' (customer saw "price on request")';
  const rows: [string, ReactNode][] = [
    ['Customer', lead.name],
    [reach.action === 'Text' ? 'Phone' : 'Instagram', h(InlineLink, { brand, href: reach.href }, reach.label)],
    ...(lead.email ? [['Email', h(InlineLink, { brand, href: `mailto:${lead.email}` }, lead.email)] as [string, ReactNode]] : []),
    ['Estimate', h('strong', null, usd(lead.total))],
    ...(lead.deposit !== null ? [['Deposit', usd(lead.deposit)] as [string, ReactNode]] : []),
    ...(lead.note ? [['Their note', lead.note] as [string, ReactNode]] : []),
  ];
  const element = h(
    EmailFrame,
    {
      brand,
      title: subject,
      preheader: `${lead.name} · ${headline} · ${usd(lead.total)}`,
      footer: { reason: `You're getting this because design requests for ${config.brand.name} go to this address. Change it in your dashboard. Lead ${lead.id.slice(0, 8)}.` },
    },
    h(Eyebrow, { brand }, `${test ? 'Test · ' : ''}New design request`),
    h(Headline, { brand, text: `New design from *${first}*` }),
    h(Paragraph, { brand, muted: true, margin: '14px 0 0' }, `${headline} · estimate `, h('strong', null, usd(lead.total)), shown),
    designPhoto(brand, images, images.photo ? 'AI studio photo of the customer’s design' : '3D design the customer built'),
    photoPending && h(Paragraph, { brand, muted: true, size: 13, margin: '6px 0 0' }, 'The studio photo is still rendering. It will follow in this thread.'),
    h(CTA, { brand, href: reach.href, margin: '26px 0 22px' }, `${reach.action} ${first}`),
    h(Facts, { brand, rows }),
    specList(brand, lead.summary),
    h(Lines, { brand, lines: lead.price.lines.map((line) => [line.label, usd(line.amount)] as [string, string]) }),
    h(Paragraph, { brand, muted: true, size: 12, margin: '22px 0 0' }, `Priced with your price list v${lead.configVersion}.${lead.email ? ' Reply to this email to answer the customer directly.' : ''}`),
  );
  const text = [
    `New design from ${lead.name}`,
    `${headline} · estimate ${usd(lead.total)}${shown}`,
    '',
    `Contact: ${reach.label} (${reach.href})`,
    lead.email ? `Email: ${lead.email}` : '',
    lead.note ? `Note: ${lead.note}` : '',
    '',
    'Design:',
    ...lead.summary.map((line) => `- ${line}`),
    '',
    ...lead.price.lines.map((line) => `${line.label}: ${usd(line.amount)}`),
    `Estimate: ${usd(lead.total)}`,
    lead.deposit !== null ? `Deposit: ${usd(lead.deposit)}` : '',
    photoPending ? '\nThe studio photo is still rendering and will follow in this thread.' : '',
    `\nLead ${lead.id}`,
  ]
    .filter((line) => line !== '')
    .join('\n');
  return { subject, html: await html(element), text };
}

/** Follow-up in the same thread once the photo is ready. */
export async function shopPhotoEmail({ lead, config, origin, subject }: { lead: LeadForEmail; config: TenantConfig; origin: string; subject: string }): Promise<RenderedEmail> {
  const brand = vvsBrand(origin);
  const reach = contactLink(lead.contact);
  const first = firstName(lead.name);
  const element = h(
    EmailFrame,
    {
      brand,
      title: `Studio photo for ${lead.name}`,
      preheader: `Studio photo for ${lead.name}`,
      footer: { reason: `You're getting this because design requests for ${config.brand.name} go to this address. Lead ${lead.id.slice(0, 8)}.` },
    },
    h(Eyebrow, { brand }, 'Studio photo'),
    h(Headline, { brand, size: 34, text: `The photo for *${first}*’s design` }),
    designPhoto(brand, { photo: true, preview: false }, 'AI studio photo of the customer’s design'),
    h(CTA, { brand, href: reach.href }, `${reach.action} ${first}`),
  );
  return {
    subject: subject.startsWith('Re: ') ? subject : `Re: ${subject}`,
    html: await html(element),
    text: `Studio photo for ${lead.name}'s design is attached.\n\nContact: ${reach.label} (${reach.href})\nLead ${lead.id}`,
  };
}

/** The customer's confirmation, in the shop's brand: their design, the price as the shop shows it, and what happens next. */
export async function customerEmail({ lead, config, origin, images }: { lead: LeadForEmail; config: TenantConfig; origin: string; images: EmailImages }): Promise<RenderedEmail> {
  const shop = config.brand;
  const brand = shopBrand(shop, origin);
  const total = displayTotal(config.pricing, lead.total, usd).text;
  const reach = contactLink(lead.contact);
  const ig = shop.instagram ? `https://instagram.com/${encodeURIComponent(shop.instagram.replace(/^@/, ''))}` : null;
  const element = h(
    EmailFrame,
    {
      brand,
      title: `Your design is with ${shop.name}`,
      preheader: `${shop.name} has your design`,
      footer: { reason: `You're getting this because you sent a design to ${shop.name} with the VVS Lab builder. This is a one-time confirmation.` },
    },
    h(Headline, { brand, text: 'Your design is *on its way*' }),
    h(Paragraph, { brand, margin: '16px 0 0' }, `Thanks, ${firstName(lead.name)}. ${shop.name} has your design and will reach out on ${reach.label} to confirm the details and the final price.`),
    designPhoto(brand, images, images.photo ? AI_DISCLOSURE : 'Your 3D design'),
    specList(brand, lead.summary),
    h(Facts, {
      brand,
      rows: [
        [config.pricing.display === 'hidden' ? 'Price' : 'Estimate', h('strong', null, total)],
        ...(lead.deposit !== null ? [['Deposit to hold your spot', usd(lead.deposit)] as [string, ReactNode]] : []),
      ],
    }),
    h(Paragraph, { brand, muted: true, size: 12, margin: '8px 0 0' }, `Final price is confirmed by ${shop.name}.`),
    ig && h(CTA, { brand, href: ig, margin: '24px 0 0' }, 'Message on Instagram'),
    h(Paragraph, { brand, muted: true, size: 14, margin: '22px 0 0' }, `Questions? Reply to this email${shop.phone ? ` or call ${displayContact(shop.phone)}` : ''}.`),
  );
  const text = [
    `Your design is with ${shop.name}`,
    `Thanks, ${firstName(lead.name)}. ${shop.name} will reach out on ${reach.label} to confirm the details and the final price.`,
    '',
    ...lead.summary.map((line) => `- ${line}`),
    '',
    `${config.pricing.display === 'hidden' ? 'Price' : 'Estimate'}: ${total}`,
    lead.deposit !== null ? `Deposit to hold your spot: ${usd(lead.deposit)}` : '',
    images.photo ? `\n${AI_DISCLOSURE}` : '',
    '\nQuestions? Reply to this email.',
  ]
    .filter((line) => line !== '')
    .join('\n');
  return { subject: `Your grillz design was sent to ${shop.name}`, html: await html(element), text };
}

/** Self-serve signup: the one-time link that signs the new owner in. */
export async function welcomeEmail({ shop, slug, link, origin, trialDays }: { shop: string; slug: string; link: string; origin: string; trialDays: number }): Promise<RenderedEmail> {
  const brand = vvsBrand(origin);
  const hero = h('img', {
    src: `${origin.replace(/\/$/, '')}/assets/email/welcome.png`,
    alt: '',
    width: 480,
    style: { display: 'block', width: '100%', maxWidth: '480px', height: 'auto', border: 0, margin: '0 auto' },
  });
  const element = h(
    EmailFrame,
    { brand, title: 'Your builder is ready', preheader: `${shop}'s grillz builder is ready to set up`, hero, footer: { reason: "You're getting this because you signed up for VVS Lab." } },
    h(Headline, { brand, text: 'Your builder is *ready*' }),
    h(Paragraph, { brand, margin: '18px 0 10px' }, 'Hey there,'),
    h(Paragraph, { brand }, `${shop} now has its own 3D grillz builder at `, h('strong', null, `${host(origin)}/b/${slug}`), '. Customers design their set, see your prices and send it straight to you, with a studio photo.'),
    h(Paragraph, { brand }, `Add your logo and prices, then switch it on. It takes about 10 minutes, and your free trial runs ${trialDays} days.`),
    h(CTA, { brand, href: link }, 'Set up my builder'),
    h(
      Paragraph,
      { brand, muted: true, size: 13, margin: '0' },
      'The button works once and expires in 24 hours. After that, sign in any time at ',
      h(InlineLink, { brand, href: dashboardUrl(origin) }, `${host(origin)}/dashboard`),
      ". Didn't sign up? Ignore this email.",
    ),
  );
  return {
    subject: 'Set up your VVS Lab builder',
    html: await html(element),
    text: `Welcome to VVS Lab.\n\nYour builder link is ${origin}/b/${slug}. Set it up and switch it on here: ${link}\n\nThe link works once and expires in 24 hours. After that, sign in any time at ${dashboardUrl(origin)}. Your free trial runs ${trialDays} days.`,
  };
}

/** A team invite: join a shop on VVS Lab. */
export async function inviteEmail({ shop, inviter, role, link, origin }: { shop: string; inviter: string; role: 'owner' | 'staff'; link: string; origin: string }): Promise<RenderedEmail> {
  const brand = vvsBrand(origin);
  const element = h(
    EmailFrame,
    { brand, title: `Join ${shop}`, preheader: `${inviter} invited you to ${shop} on VVS Lab`, footer: { reason: `You're getting this because ${inviter} invited this address to ${shop}.` } },
    h(Eyebrow, { brand }, 'Team invite'),
    h(Headline, { brand, text: `Join *${shop.replace(/\*/g, '')}*` }),
    h(
      Paragraph,
      { brand, margin: '18px 0 0' },
      `${inviter} invited you to join this shop on VVS Lab as ${role === 'owner' ? 'an owner' : 'staff'}. You'll see its design requests${role === 'owner' ? ' and can change its prices and options' : ''}.`,
    ),
    h(CTA, { brand, href: link }, 'Accept and sign in'),
    h(
      Paragraph,
      { brand, muted: true, size: 13, margin: '0' },
      'The button works once and expires in 24 hours. The invite stays open for 7 days: sign in any time at ',
      h(InlineLink, { brand, href: dashboardUrl(origin) }, `${host(origin)}/dashboard`),
      '. Not expecting this? Ignore it and nothing happens.',
    ),
  );
  return {
    subject: 'You’re invited to join a shop on VVS Lab',
    html: await html(element),
    text: `${inviter} invited you to join "${shop}" on VVS Lab.\n\nAccept and sign in: ${link}\n\nThe link works once and expires in 24 hours. The invite stays open for 7 days: sign in any time at ${dashboardUrl(origin)}. If you weren't expecting this, ignore it.`,
  };
}
