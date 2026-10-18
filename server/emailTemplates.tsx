import React from 'react';
import { render } from '@react-email/render';
import { displayContact } from '../src/lib/contact.js';
import { displayTotal, type PriceBreakdown } from '../src/lib/pricing.js';
import type { TenantConfig } from '../src/lib/tenant/schema.js';
import { shopBrand, vvsBrand, type Brand } from './email/brand.js';
import { CTA, EmailFrame, Eyebrow, Facts, Headline, InlineLink, Lines, Paragraph, Photo, SectionLabel } from './email/components.js';

// Every email we send, built from the kit in server/email/ (React Email).
// Design photos are inline attachments (cid:) so they show without "load
// remote images" and never expire; artwork and logos load from our origin.

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
const html = (element: React.ReactElement) => render(element);

const DesignPhoto = ({ brand, images, caption }: { brand: Brand; images: EmailImages; caption: string }) => {
  const cid = images.photo ? 'photo' : images.preview ? 'preview' : null;
  return cid ? <Photo brand={brand} src={`cid:${cid}`} alt={caption} caption={caption} /> : null;
};

const SpecList = ({ brand, summary }: { brand: Brand; summary: string[] }) =>
  summary.length ? (
    <>
      <SectionLabel brand={brand}>The design</SectionLabel>
      {summary.map((line, index) => (
        <Paragraph key={index} brand={brand} size={15} margin="0 0 5px">{line}</Paragraph>
      ))}
    </>
  ) : null;

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
  const rows: [string, React.ReactNode][] = [
    ['Customer', lead.name],
    [reach.action === 'Text' ? 'Phone' : 'Instagram', <InlineLink brand={brand} href={reach.href}>{reach.label}</InlineLink>],
    ...(lead.email ? [['Email', <InlineLink brand={brand} href={`mailto:${lead.email}`}>{lead.email}</InlineLink>] as [string, React.ReactNode]] : []),
    ['Estimate', <strong>{usd(lead.total)}</strong>],
    ...(lead.deposit !== null ? [['Deposit', usd(lead.deposit)] as [string, React.ReactNode]] : []),
    ...(lead.note ? [['Their note', lead.note] as [string, React.ReactNode]] : []),
  ];
  const element = (
    <EmailFrame
      brand={brand}
      title={subject}
      preheader={`${lead.name} · ${headline} · ${usd(lead.total)}`}
      footer={{ reason: `You're getting this because design requests for ${config.brand.name} go to this address. Change it in your dashboard. Lead ${lead.id.slice(0, 8)}.` }}
    >
      <Eyebrow brand={brand}>{test ? 'Test · ' : ''}New design request</Eyebrow>
      <Headline brand={brand}>{`New design from *${first}*`}</Headline>
      <Paragraph brand={brand} muted margin="14px 0 0">
        {headline} · estimate <strong>{usd(lead.total)}</strong>{shown}
      </Paragraph>
      <DesignPhoto brand={brand} images={images} caption={images.photo ? 'AI studio photo of the customer’s design' : '3D design the customer built'} />
      {photoPending && <Paragraph brand={brand} muted size={13} margin="6px 0 0">The studio photo is still rendering. It will follow in this thread.</Paragraph>}
      <CTA brand={brand} href={reach.href} margin="26px 0 22px">{`${reach.action} ${first}`}</CTA>
      <Facts brand={brand} rows={rows} />
      <SpecList brand={brand} summary={lead.summary} />
      <Lines brand={brand} lines={lead.price.lines.map((line) => [line.label, usd(line.amount)])} />
      <Paragraph brand={brand} muted size={12} margin="22px 0 0">
        {`Priced with your price list v${lead.configVersion}.${lead.email ? ' Reply to this email to answer the customer directly.' : ''}`}
      </Paragraph>
    </EmailFrame>
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
  const element = (
    <EmailFrame
      brand={brand}
      title={`Studio photo for ${lead.name}`}
      preheader={`Studio photo for ${lead.name}`}
      footer={{ reason: `You're getting this because design requests for ${config.brand.name} go to this address. Lead ${lead.id.slice(0, 8)}.` }}
    >
      <Eyebrow brand={brand}>Studio photo</Eyebrow>
      <Headline brand={brand} size={34}>{`The photo for *${first}*’s design`}</Headline>
      <DesignPhoto brand={brand} images={{ photo: true, preview: false }} caption="AI studio photo of the customer’s design" />
      <CTA brand={brand} href={reach.href}>{`${reach.action} ${first}`}</CTA>
    </EmailFrame>
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
  const element = (
    <EmailFrame
      brand={brand}
      title={`Your design is with ${shop.name}`}
      preheader={`${shop.name} has your design`}
      footer={{ reason: `You're getting this because you sent a design to ${shop.name} with the VVS Lab builder. This is a one-time confirmation.` }}
    >
      <Headline brand={brand}>{'Your design is *on its way*'}</Headline>
      <Paragraph brand={brand} margin="16px 0 0">
        {`Thanks, ${firstName(lead.name)}. ${shop.name} has your design and will reach out on ${reach.label} to confirm the details and the final price.`}
      </Paragraph>
      <DesignPhoto brand={brand} images={images} caption={images.photo ? AI_DISCLOSURE : 'Your 3D design'} />
      <SpecList brand={brand} summary={lead.summary} />
      <Facts
        brand={brand}
        rows={[
          [config.pricing.display === 'hidden' ? 'Price' : 'Estimate', <strong>{total}</strong>],
          ...(lead.deposit !== null ? [['Deposit to hold your spot', usd(lead.deposit)] as [string, React.ReactNode]] : []),
        ]}
      />
      <Paragraph brand={brand} muted size={12} margin="8px 0 0">{`Final price is confirmed by ${shop.name}.`}</Paragraph>
      {ig && <CTA brand={brand} href={ig} margin="24px 0 0">Message on Instagram</CTA>}
      <Paragraph brand={brand} muted size={14} margin="22px 0 0">
        {`Questions? Reply to this email${shop.phone ? ` or call ${displayContact(shop.phone)}` : ''}.`}
      </Paragraph>
    </EmailFrame>
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
  const hero = <img src={`${origin.replace(/\/$/, '')}/assets/email/welcome.png`} alt="" width={480} style={{ display: 'block', width: '100%', maxWidth: '480px', height: 'auto', border: 0, margin: '0 auto' }} />;
  const element = (
    <EmailFrame brand={brand} title="Your builder is ready" preheader={`${shop}'s grillz builder is ready to set up`} hero={hero} footer={{ reason: "You're getting this because you signed up for VVS Lab." }}>
      <Headline brand={brand}>{'Your builder is *ready*'}</Headline>
      <Paragraph brand={brand} margin="18px 0 10px">Hey there,</Paragraph>
      <Paragraph brand={brand}>
        {shop} now has its own 3D grillz builder at <strong>{`${host(origin)}/b/${slug}`}</strong>. Customers design their set, see your prices and send it straight to you, with a studio photo.
      </Paragraph>
      <Paragraph brand={brand}>{`Add your logo and prices, then switch it on. It takes about 10 minutes, and your free trial runs ${trialDays} days.`}</Paragraph>
      <CTA brand={brand} href={link}>Set up my builder</CTA>
      <Paragraph brand={brand} muted size={13} margin="0">
        The button works once and expires in 24 hours. After that, sign in any time at <InlineLink brand={brand} href={dashboardUrl(origin)}>{`${host(origin)}/dashboard`}</InlineLink>. Didn't sign up? Ignore this email.
      </Paragraph>
    </EmailFrame>
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
  const element = (
    <EmailFrame brand={brand} title={`Join ${shop}`} preheader={`${inviter} invited you to ${shop} on VVS Lab`} footer={{ reason: `You're getting this because ${inviter} invited this address to ${shop}.` }}>
      <Eyebrow brand={brand}>Team invite</Eyebrow>
      <Headline brand={brand}>{`Join *${shop.replace(/\*/g, '')}*`}</Headline>
      <Paragraph brand={brand} margin="18px 0 0">
        {`${inviter} invited you to join this shop on VVS Lab as ${role === 'owner' ? 'an owner' : 'staff'}. You'll see its design requests${role === 'owner' ? ' and can change its prices and options' : ''}.`}
      </Paragraph>
      <CTA brand={brand} href={link}>Accept and sign in</CTA>
      <Paragraph brand={brand} muted size={13} margin="0">
        The button works once and expires in 24 hours. The invite stays open for 7 days: sign in any time at <InlineLink brand={brand} href={dashboardUrl(origin)}>{`${host(origin)}/dashboard`}</InlineLink>. Not expecting this? Ignore it and nothing happens.
      </Paragraph>
    </EmailFrame>
  );
  return {
    subject: 'You’re invited to join a shop on VVS Lab',
    html: await html(element),
    text: `${inviter} invited you to join "${shop}" on VVS Lab.\n\nAccept and sign in: ${link}\n\nThe link works once and expires in 24 hours. The invite stays open for 7 days: sign in any time at ${dashboardUrl(origin)}. If you weren't expecting this, ignore it.`,
  };
}
