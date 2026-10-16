import { displayContact } from '../src/lib/contact.js';
import { displayTotal, type PriceBreakdown } from '../src/lib/pricing.js';
import type { TenantConfig } from '../src/lib/tenant/schema.js';
import { usableAccent } from '../src/lib/tenant/theme.js';

// Branded, table-based emails that render in Gmail, Apple Mail and Outlook.
// Every interpolated value goes through esc(); images are inline attachments
// (cid:) so they show without "load remote images" and never expire.

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

const esc = (value: string) =>
  value.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;');

const usd = (value: number) => `$${value.toLocaleString('en-US', { maximumFractionDigits: 2 })}`;

export const AI_DISCLOSURE = 'AI studio photo of your design. The finished piece is handmade and may vary.';

/** A link the jeweler can tap to reach the customer, and what to call it. */
export function contactLink(contact: string): { href: string; label: string; action: string } {
  if (contact.startsWith('+')) return { href: `sms:${contact}`, label: displayContact(contact), action: 'Text' };
  const handle = contact.replace(/^@/, '');
  return { href: `https://instagram.com/${encodeURIComponent(handle)}`, label: `@${handle}`, action: 'Message on Instagram' };
}

const firstName = (name: string) => name.split(/\s+/)[0] ?? name;

const shell = (brand: TenantConfig['brand'], origin: string, preheader: string, body: string, footer: string) => {
  const accent = usableAccent(brand.accent, '#ffffff');
  const logo = brand.logo ? (brand.logo.startsWith('http') ? brand.logo : `${origin}${brand.logo.startsWith('/') ? '' : '/'}${brand.logo}`) : null;
  const header = logo
    ? `<img src="${esc(logo)}" alt="${esc(brand.name)}" height="32" style="height:32px;max-width:200px;display:block;border:0">`
    : `<span style="font:700 20px/1.2 -apple-system,Segoe UI,Helvetica,Arial,sans-serif;color:#1a1714">${esc(brand.name)}</span>`;
  return `<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="color-scheme" content="light"><title>${esc(brand.name)}</title></head>
<body style="margin:0;padding:0;background:#f4f1ec">
<span style="display:none!important;opacity:0;color:transparent;height:0;width:0;overflow:hidden">${esc(preheader)}</span>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f4f1ec"><tr><td align="center" style="padding:24px 12px">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;background:#ffffff;border-radius:14px;overflow:hidden">
<tr><td style="height:4px;background:${accent};font-size:0;line-height:0">&nbsp;</td></tr>
<tr><td style="padding:20px 24px 4px">${header}</td></tr>
${body}
</table>
<p style="margin:16px 0 0;font:12px/1.5 -apple-system,Segoe UI,Helvetica,Arial,sans-serif;color:#8a8178;max-width:560px">${footer}</p>
</td></tr></table></body></html>`;
};

const font = 'font-family:-apple-system,Segoe UI,Helvetica,Arial,sans-serif';
const row = (label: string, value: string) =>
  `<tr><td style="${font};font-size:13px;color:#8a8178;padding:6px 0;width:96px;vertical-align:top">${esc(label)}</td><td style="${font};font-size:15px;color:#1a1714;padding:6px 0">${value}</td></tr>`;

const image = (images: EmailImages, caption: string) => {
  const cid = images.photo ? 'photo' : images.preview ? 'preview' : null;
  if (!cid) return '';
  return `<tr><td style="padding:16px 24px 0"><img src="cid:${cid}" alt="${esc(caption)}" width="512" style="width:100%;max-width:512px;border-radius:10px;display:block;border:0;background:#f4f1ec">
<p style="margin:6px 0 0;${font};font-size:12px;color:#8a8178">${esc(caption)}</p></td></tr>`;
};

const button = (href: string, text: string, accent: string) =>
  `<tr><td style="padding:20px 24px 4px"><a href="${esc(href)}" style="display:inline-block;background:${accent};color:#ffffff;text-decoration:none;${font};font-size:15px;font-weight:600;padding:12px 20px;border-radius:999px">${esc(text)}</a></td></tr>`;

const designList = (summary: string[]) =>
  `<tr><td style="padding:12px 24px 0"><p style="margin:0 0 6px;${font};font-size:13px;color:#8a8178">Design</p>${summary
    .map((line) => `<p style="margin:0 0 4px;${font};font-size:15px;color:#1a1714">${esc(line)}</p>`)
    .join('')}</td></tr>`;

const priceTable = (price: PriceBreakdown, deposit: number | null) =>
  `<tr><td style="padding:12px 24px 0"><table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border-top:1px solid #ece6de">${price.lines
    .map((line) => `<tr><td style="${font};font-size:14px;color:#5c544c;padding:6px 0">${esc(line.label)}</td><td align="right" style="${font};font-size:14px;color:#5c544c;padding:6px 0">${usd(line.amount)}</td></tr>`)
    .join('')}<tr><td style="${font};font-size:15px;font-weight:700;color:#1a1714;padding:8px 0;border-top:1px solid #ece6de">Estimate</td><td align="right" style="${font};font-size:15px;font-weight:700;color:#1a1714;padding:8px 0;border-top:1px solid #ece6de">${usd(price.total)}</td></tr>${
    deposit !== null ? `<tr><td style="${font};font-size:14px;color:#5c544c;padding:2px 0">Deposit</td><td align="right" style="${font};font-size:14px;color:#5c544c;padding:2px 0">${usd(deposit)}</td></tr>` : ''
  }</table></td></tr>`;

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
  const accent = usableAccent(config.brand.accent, '#ffffff');
  const reach = contactLink(lead.contact);
  const headline = lead.summary[0] ?? 'Custom grillz';
  const subject = `${test ? '[Test shop] ' : ''}New design from ${lead.name} · ${headline} · ${usd(lead.total)}`;
  const shown = config.pricing.display === 'exact' ? '' : config.pricing.display === 'from' ? ' (customer saw it as a "from" price)' : ' (customer saw "price on request")';
  const body = `
<tr><td style="padding:12px 24px 0"><h1 style="margin:0;${font};font-size:22px;line-height:1.3;color:#1a1714">New design from ${esc(lead.name)}</h1>
<p style="margin:6px 0 0;${font};font-size:15px;color:#5c544c">${esc(headline)} · estimate ${usd(lead.total)}${esc(shown)}</p></td></tr>
${image(images, images.photo ? 'AI studio photo of the customer’s design' : '3D design the customer built')}
${photoPending ? `<tr><td style="padding:8px 24px 0"><p style="margin:0;${font};font-size:13px;color:#8a8178">The studio photo is still rendering. It will follow in this thread.</p></td></tr>` : ''}
<tr><td style="padding:16px 24px 0"><table role="presentation" width="100%" cellpadding="0" cellspacing="0">
${row('Customer', esc(lead.name))}
${row(reach.action === 'Text' ? 'Phone' : 'Instagram', `<a href="${esc(reach.href)}" style="color:${accent}">${esc(reach.label)}</a>`)}
${lead.email ? row('Email', `<a href="mailto:${esc(lead.email)}" style="color:${accent}">${esc(lead.email)}</a>`) : ''}
${lead.note ? row('Note', esc(lead.note)) : ''}
</table></td></tr>
${designList(lead.summary)}
${priceTable(lead.price, lead.deposit)}
${button(reach.href, `${reach.action} ${firstName(lead.name)}`, accent)}
<tr><td style="padding:16px 24px 24px"><p style="margin:0;${font};font-size:12px;color:#8a8178">Priced with your price list v${lead.configVersion}.${lead.email ? ' Reply to this email to answer the customer directly.' : ''}</p></td></tr>`;
  const footer = `Sent by VVS Lab for ${esc(config.brand.name)} · lead ${esc(lead.id.slice(0, 8))}`;
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
  return { subject, html: shell(config.brand, origin, `${lead.name} · ${headline} · ${usd(lead.total)}`, body, footer), text };
}

/** Follow-up in the same thread once the photo is ready. */
export function shopPhotoEmail({ lead, config, origin, subject }: { lead: LeadForEmail; config: TenantConfig; origin: string; subject: string }) {
  const accent = usableAccent(config.brand.accent, '#ffffff');
  const reach = contactLink(lead.contact);
  const body = `
<tr><td style="padding:12px 24px 0"><h1 style="margin:0;${font};font-size:20px;color:#1a1714">Studio photo for ${esc(lead.name)}’s design</h1></td></tr>
${image({ photo: true, preview: false }, 'AI studio photo of the customer’s design')}
${button(reach.href, `${reach.action} ${firstName(lead.name)}`, accent)}
<tr><td style="padding:16px 24px 24px">&nbsp;</td></tr>`;
  return {
    subject: subject.startsWith('Re: ') ? subject : `Re: ${subject}`,
    html: shell(config.brand, origin, `Studio photo for ${lead.name}`, body, `Sent by VVS Lab for ${esc(config.brand.name)} · lead ${esc(lead.id.slice(0, 8))}`),
    text: `Studio photo for ${lead.name}'s design is attached.\n\nContact: ${reach.label} (${reach.href})\nLead ${lead.id}`,
  };
}

/** The customer's confirmation: their design, the price as the shop shows it, and what happens next. */
export function customerEmail({ lead, config, origin, images }: { lead: LeadForEmail; config: TenantConfig; origin: string; images: EmailImages }) {
  const brand = config.brand;
  const accent = usableAccent(brand.accent, '#ffffff');
  const total = displayTotal(config.pricing, lead.total, usd).text;
  const reach = contactLink(lead.contact);
  const ig = brand.instagram ? `https://instagram.com/${encodeURIComponent(brand.instagram.replace(/^@/, ''))}` : null;
  const body = `
<tr><td style="padding:12px 24px 0"><h1 style="margin:0;${font};font-size:22px;line-height:1.3;color:#1a1714">Your design is with ${esc(brand.name)}</h1>
<p style="margin:6px 0 0;${font};font-size:15px;color:#5c544c">Thanks, ${esc(firstName(lead.name))}. ${esc(brand.name)} will reach out on ${esc(reach.label)} to confirm the details and the final price.</p></td></tr>
${image(images, images.photo ? AI_DISCLOSURE : 'Your 3D design')}
${designList(lead.summary)}
<tr><td style="padding:12px 24px 0"><table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border-top:1px solid #ece6de">
<tr><td style="${font};font-size:15px;font-weight:700;color:#1a1714;padding:8px 0">${config.pricing.display === 'hidden' ? 'Price' : 'Estimate'}</td><td align="right" style="${font};font-size:15px;font-weight:700;color:#1a1714;padding:8px 0">${esc(total)}</td></tr>
${lead.deposit !== null ? `<tr><td style="${font};font-size:14px;color:#5c544c;padding:2px 0">Deposit to hold your spot</td><td align="right" style="${font};font-size:14px;color:#5c544c;padding:2px 0">${usd(lead.deposit)}</td></tr>` : ''}
</table><p style="margin:8px 0 0;${font};font-size:12px;color:#8a8178">Final price is confirmed by ${esc(brand.name)}.</p></td></tr>
${ig ? button(ig, `${brand.name} on Instagram`, accent) : ''}
<tr><td style="padding:16px 24px 24px"><p style="margin:0;${font};font-size:13px;color:#5c544c">Questions? Reply to this email${brand.phone ? ` or call ${esc(displayContact(brand.phone))}` : ''}.</p></td></tr>`;
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
    html: shell(brand, origin, `${brand.name} has your design`, body, `You're getting this because you sent a design to ${esc(brand.name)} with the VVS Lab builder. This is a one-time confirmation.`),
    text,
  };
}
