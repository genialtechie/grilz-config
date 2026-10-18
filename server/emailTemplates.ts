import { displayContact } from '../src/lib/contact.js';
import { displayTotal, type PriceBreakdown } from '../src/lib/pricing.js';
import type { TenantConfig } from '../src/lib/tenant/schema.js';
import { button, esc, eyebrow, facts, frame, headline, image, link, paragraph, SANS, shopTheme, vvsTheme, type Theme } from './email/layout.js';

// Every email we send, on one layout (server/email/layout.ts). Design photos
// are inline attachments (cid:) so they show without "load remote images" and
// never expire; artwork and logos load from our own origin.

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

const usd = (value: number) => `$${value.toLocaleString('en-US', { maximumFractionDigits: 2 })}`;

export const AI_DISCLOSURE = 'AI studio photo of your design. The finished piece is handmade and may vary.';

/** A link the jeweler can tap to reach the customer, and what to call it. */
export function contactLink(contact: string): { href: string; label: string; action: string } {
  if (contact.startsWith('+')) return { href: `sms:${contact}`, label: displayContact(contact), action: 'Text' };
  const handle = contact.replace(/^@/, '');
  return { href: `https://instagram.com/${encodeURIComponent(handle)}`, label: `@${handle}`, action: 'Message on Instagram' };
}

const firstName = (name: string) => name.split(/\s+/)[0] ?? name;
const dashboard = (origin: string) => `${origin.replace(/\/$/, '')}/dashboard`;
const legalLinks = (origin: string): [string, string][] => [
  ['Your dashboard', dashboard(origin)],
  ['Terms', `${origin.replace(/\/$/, '')}/terms`],
  ['Privacy', `${origin.replace(/\/$/, '')}/privacy`],
];

const designPhoto = (theme: Theme, images: EmailImages, caption: string) => {
  const cid = images.photo ? 'photo' : images.preview ? 'preview' : null;
  return cid ? `<div style="margin:22px 0 6px">${image(theme, `cid:${cid}`, caption, caption)}</div>` : '';
};

const specList = (theme: Theme, summary: string[]) =>
  summary.length
    ? `<p class="em-muted" style="margin:24px 0 8px;font-family:${SANS};font-size:12px;font-weight:600;letter-spacing:.12em;text-transform:uppercase;color:${theme.muted}">The design</p>${summary
        .map((line) => `<p class="em-text" style="margin:0 0 5px;font-family:${SANS};font-size:15px;line-height:1.5;color:${theme.text}">${esc(line)}</p>`)
        .join('')}`
    : '';

const priceLines = (theme: Theme, price: PriceBreakdown) =>
  `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin-top:18px">${price.lines
    .map(
      (line) =>
        `<tr><td class="em-muted" style="padding:3px 0;font-family:${SANS};font-size:13px;color:${theme.muted}">${esc(line.label)}</td><td align="right" class="em-muted" style="padding:3px 0;font-family:${SANS};font-size:13px;color:${theme.muted}">${usd(line.amount)}</td></tr>`,
    )
    .join('')}</table>`;

export type ShopEmailInput = {
  lead: LeadForEmail;
  config: TenantConfig;
  origin: string;
  images: EmailImages;
  photoPending: boolean;
  test: boolean;
};

/** The jeweler's notification: everything needed to quote and reach the customer. */
export function shopEmail({ lead, config, origin, images, photoPending, test }: ShopEmailInput) {
  const theme = vvsTheme(origin);
  const reach = contactLink(lead.contact);
  const headlineText = lead.summary[0] ?? 'Custom grillz';
  const subject = `${test ? '[Test shop] ' : ''}New design from ${lead.name} · ${headlineText} · ${usd(lead.total)}`;
  const shown = config.pricing.display === 'exact' ? '' : config.pricing.display === 'from' ? ' (customer saw it as a "from" price)' : ' (customer saw "price on request")';
  const contactRow: [string, string] = [reach.action === 'Text' ? 'Phone' : 'Instagram', link(theme, reach.href, reach.label)];
  const body = `
${eyebrow(theme, `${test ? 'Test · ' : ''}New design request`)}
${headline(theme, `New design from *${firstName(lead.name)}*`)}
${paragraph(theme, `${esc(headlineText)} · estimate <strong>${usd(lead.total)}</strong>${esc(shown)}`, { margin: '14px 0 0', muted: true })}
${designPhoto(theme, images, images.photo ? 'AI studio photo of the customer’s design' : '3D design the customer built')}
${photoPending ? paragraph(theme, 'The studio photo is still rendering. It will follow in this thread.', { size: 13, muted: true, margin: '6px 0 0' }) : ''}
<div style="margin:26px 0 22px">${button(theme, reach.href, `${reach.action} ${firstName(lead.name)}`)}</div>
${facts(theme, [
  ['Customer', esc(lead.name)],
  contactRow,
  ...(lead.email ? [['Email', link(theme, `mailto:${lead.email}`, lead.email)] as [string, string]] : []),
  ['Estimate', `<strong>${usd(lead.total)}</strong>`],
  ...(lead.deposit !== null ? [['Deposit', usd(lead.deposit)] as [string, string]] : []),
  ...(lead.note ? [['Their note', esc(lead.note)] as [string, string]] : []),
])}
${specList(theme, lead.summary)}
${priceLines(theme, lead.price)}
${paragraph(theme, `Priced with your price list v${lead.configVersion}.${lead.email ? ' Reply to this email to answer the customer directly.' : ''}`, { size: 12, muted: true, margin: '22px 0 0' })}`;
  const text = [
    `New design from ${lead.name}`,
    `${headlineText} · estimate ${usd(lead.total)}${shown}`,
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
  const html = frame(theme, {
    title: subject,
    preheader: `${lead.name} · ${headlineText} · ${usd(lead.total)}`,
    body,
    footer: {
      reason: `You're getting this because design requests for ${config.brand.name} go to this address. Change it in your dashboard. Lead ${lead.id.slice(0, 8)}.`,
      links: legalLinks(origin),
      instagram: 'vvslab.ai',
    },
  });
  return { subject, html, text };
}

/** Follow-up in the same thread once the photo is ready. */
export function shopPhotoEmail({ lead, config, origin, subject }: { lead: LeadForEmail; config: TenantConfig; origin: string; subject: string }) {
  const theme = vvsTheme(origin);
  const reach = contactLink(lead.contact);
  const body = `
${eyebrow(theme, `Studio photo · ${config.brand.name}`)}
${headline(theme, `The photo for *${firstName(lead.name)}*’s design`, 34)}
${designPhoto(theme, { photo: true, preview: false }, 'AI studio photo of the customer’s design')}
<div style="margin:24px 0 0">${button(theme, reach.href, `${reach.action} ${firstName(lead.name)}`)}</div>`;
  return {
    subject: subject.startsWith('Re: ') ? subject : `Re: ${subject}`,
    html: frame(theme, {
      title: `Studio photo for ${lead.name}`,
      preheader: `Studio photo for ${lead.name}`,
      body,
      footer: { reason: `You're getting this because design requests for ${config.brand.name} go to this address. Lead ${lead.id.slice(0, 8)}.`, links: legalLinks(origin), instagram: 'vvslab.ai' },
    }),
    text: `Studio photo for ${lead.name}'s design is attached.\n\nContact: ${reach.label} (${reach.href})\nLead ${lead.id}`,
  };
}

/** The customer's confirmation, in the shop's brand: their design, the price as the shop shows it, and what happens next. */
export function customerEmail({ lead, config, origin, images }: { lead: LeadForEmail; config: TenantConfig; origin: string; images: EmailImages }) {
  const brand = config.brand;
  const theme = shopTheme(brand, origin);
  const total = displayTotal(config.pricing, lead.total, usd).text;
  const reach = contactLink(lead.contact);
  const ig = brand.instagram ? `https://instagram.com/${encodeURIComponent(brand.instagram.replace(/^@/, ''))}` : null;
  const body = `
${headline(theme, `Your design is *on its way*`)}
${paragraph(theme, `Thanks, ${esc(firstName(lead.name))}. ${esc(brand.name)} has your design and will reach out on ${esc(reach.label)} to confirm the details and the final price.`, { margin: '16px 0 0' })}
${designPhoto(theme, images, images.photo ? AI_DISCLOSURE : 'Your 3D design')}
${specList(theme, lead.summary)}
<div style="margin:20px 0 0">${facts(theme, [
  [config.pricing.display === 'hidden' ? 'Price' : 'Estimate', `<strong>${esc(total)}</strong>`],
  ...(lead.deposit !== null ? [['Deposit to hold your spot', usd(lead.deposit)] as [string, string]] : []),
])}</div>
${paragraph(theme, `Final price is confirmed by ${esc(brand.name)}.`, { size: 12, muted: true, margin: '8px 0 0' })}
${ig ? `<div style="margin:24px 0 0">${button(theme, ig, 'Message on Instagram')}</div>` : ''}
${paragraph(theme, `Questions? Reply to this email${brand.phone ? ` or call ${esc(displayContact(brand.phone))}` : ''}.`, { size: 14, muted: true, margin: '22px 0 0' })}`;
  const text = [
    `Your design is with ${brand.name}`,
    `Thanks, ${firstName(lead.name)}. ${brand.name} will reach out on ${reach.label} to confirm the details and the final price.`,
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
  return {
    subject: `Your grillz design was sent to ${brand.name}`,
    html: frame(theme, {
      title: `Your design is with ${brand.name}`,
      preheader: `${brand.name} has your design`,
      body,
      footer: {
        reason: `You're getting this because you sent a design to ${brand.name} with the VVS Lab builder. This is a one-time confirmation.`,
      },
    }),
    text,
  };
}

/** Self-serve signup: the one-time link that signs the new owner in. */
export function welcomeEmail({ shop, slug, link: signInUrl, origin, trialDays }: { shop: string; slug: string; link: string; origin: string; trialDays: number }) {
  const theme = vvsTheme(origin);
  const host = origin.replace(/^https?:\/\//, '').replace(/\/$/, '');
  const hero = `<img src="${esc(`${origin.replace(/\/$/, '')}/assets/email/welcome.png`)}" alt="" width="480" style="display:block;width:100%;max-width:480px;height:auto;border:0">`;
  const body = `
${headline(theme, 'Your builder is *ready*')}
${paragraph(theme, 'Hey there,', { margin: '18px 0 10px' })}
${paragraph(theme, `${esc(shop)} now has its own 3D grillz builder at <strong>${esc(host)}/b/${esc(slug)}</strong>. Customers design their set, see your prices and send it straight to you, with a studio photo.`)}
${paragraph(theme, `Add your logo and prices, then switch it on. It takes about 10 minutes, and your free trial runs ${trialDays} days.`)}
<div style="margin:24px 0 18px">${button(theme, signInUrl, 'Set up my builder')}</div>
${paragraph(theme, `The button works once and expires in 24 hours. After that, sign in any time at ${link(theme, dashboard(origin), `${host}/dashboard`)}. Didn't sign up? Ignore this email.`, { size: 13, muted: true, margin: '0' })}`;
  return {
    subject: 'Set up your VVS Lab builder',
    html: frame(theme, {
      title: 'Your builder is ready',
      preheader: `${shop}'s grillz builder is ready to set up`,
      hero,
      body,
      footer: { reason: "You're getting this because you signed up for VVS Lab.", links: legalLinks(origin), instagram: 'vvslab.ai' },
    }),
    text: `Welcome to VVS Lab.\n\nYour builder link is ${origin}/b/${slug}. Set it up and switch it on here: ${signInUrl}\n\nThe link works once and expires in 24 hours. After that, sign in any time at ${dashboard(origin)}. Your free trial runs ${trialDays} days.`,
  };
}

/** A team invite: join a shop on VVS Lab. */
export function inviteEmail({ shop, inviter, role, link: joinUrl, origin }: { shop: string; inviter: string; role: 'owner' | 'staff'; link: string; origin: string }) {
  const theme = vvsTheme(origin);
  const host = origin.replace(/^https?:\/\//, '').replace(/\/$/, '');
  const body = `
${eyebrow(theme, 'Team invite')}
${headline(theme, `Join *${shop}*`)}
${paragraph(theme, `${esc(inviter)} invited you to join this shop on VVS Lab as ${role === 'owner' ? 'an owner' : 'staff'}. You'll see its design requests${role === 'owner' ? ' and can change its prices and options' : ''}.`, { margin: '18px 0 0' })}
<div style="margin:24px 0 18px">${button(theme, joinUrl, 'Accept and sign in')}</div>
${paragraph(theme, `The button works once and expires in 24 hours. The invite stays open for 7 days: sign in any time at ${link(theme, dashboard(origin), `${host}/dashboard`)}. Not expecting this? Ignore it and nothing happens.`, { size: 13, muted: true, margin: '0' })}`;
  return {
    subject: 'You’re invited to join a shop on VVS Lab',
    html: frame(theme, {
      title: `Join ${shop}`,
      preheader: `${inviter} invited you to ${shop} on VVS Lab`,
      body,
      footer: { reason: `You're getting this because ${inviter} invited this address to ${shop}.`, links: legalLinks(origin), instagram: 'vvslab.ai' },
    }),
    text: `${inviter} invited you to join "${shop}" on VVS Lab.\n\nAccept and sign in: ${joinUrl}\n\nThe link works once and expires in 24 hours. The invite stays open for 7 days: sign in any time at ${dashboard(origin)}. If you weren't expecting this, ignore it.`,
  };
}
