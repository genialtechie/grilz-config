import { createElement as h, Fragment, type ReactElement } from 'react';
import { render } from '@react-email/render';
import { displayContact } from '../src/lib/contact.js';
import { displayTotal, type PriceBreakdown } from '../src/lib/pricing.js';
import type { TenantConfig } from '../src/lib/tenant/schema.js';
import { shopBrand, vvsBrand, type Brand } from './email/brand.js';
import { CTA, EmailFrame, Headline, Illustration, InlineLink, Paragraph, Photo, Quote, SectionLabel, SignOff, Steps } from './email/components.js';

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
export function contactLink(contact: string): { href: string; label: string; action: string; channel: 'text' | 'instagram' } {
  if (contact.startsWith('+')) return { href: `sms:${contact}`, label: displayContact(contact), action: 'Text', channel: 'text' };
  const handle = contact.replace(/^@/, '');
  return { href: `https://instagram.com/${encodeURIComponent(handle)}`, label: `@${handle}`, action: 'Message', channel: 'instagram' };
}

/** The button: "Text Marcus", "Message Marcus on Instagram". */
export const reachCta = (reach: ReturnType<typeof contactLink>, name: string) =>
  reach.channel === 'instagram' ? `${reach.action} ${name} on Instagram` : `${reach.action} ${name}`;

const firstName = (name: string) => name.split(/\s+/)[0] ?? name;
const host = (origin: string) => origin.replace(/^https?:\/\//, '').replace(/\/$/, '');
const dashboardUrl = (origin: string) => `${origin.replace(/\/$/, '')}/dashboard`;
const html = (element: ReactElement) => render(element);

function designPhoto(brand: Brand, images: EmailImages, caption: string) {
  const cid = images.photo ? 'photo' : images.preview ? 'preview' : null;
  return cid ? h(Photo, { brand, src: `cid:${cid}`, alt: caption, caption }) : null;
}

/** What the customer designed, one line per choice. */
function specList(brand: Brand, label: string, summary: string[]) {
  if (!summary.length) return null;
  return h(
    Fragment,
    null,
    h(SectionLabel, { brand }, label),
    ...summary.map((line, index) => h(Paragraph, { key: index, brand, size: 16, margin: '0 0 4px' }, line)),
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

/**
 * The jeweler's notification. Planned from the smallest form out (see
 * docs/email/vvs-lab.md): the inbox row says who and how much; the first
 * screen shows the design, the customer's words and the one action (reach
 * them, fast); everything below is reference. Each fact appears once.
 */
export async function shopEmail({ lead, config, origin, images, photoPending, test }: ShopEmailInput): Promise<RenderedEmail> {
  const brand = vvsBrand(origin);
  const reach = contactLink(lead.contact);
  const first = firstName(lead.name);
  const total = usd(lead.total);
  const subject = `${test ? '[Test shop] ' : ''}New design from ${lead.name} · ${total}`;
  // Market-linked metal: the day's price it used, so the shop can check the quote.
  const market = lead.price.market
    ? ` Metal at the market price of ${new Date(lead.price.market.asOf).toLocaleDateString('en-US', { month: 'short', day: 'numeric', timeZone: 'America/New_York' })} (gold ${usd(Math.round(lead.price.market.gold))}/oz, silver ${usd(Math.round(lead.price.market.silver * 100) / 100)}/oz, platinum ${usd(Math.round(lead.price.market.platinum))}/oz).`
    : '';
  const shown = config.pricing.display === 'exact' ? '' : config.pricing.display === 'from' ? ' The customer saw it as a "from" price.' : ' The customer saw "price on request".';
  const contacts = [h(InlineLink, { key: 'reach', brand, href: reach.href }, reach.label), ...(lead.email ? [' · ', h(InlineLink, { key: 'email', brand, href: `mailto:${lead.email}` }, lead.email)] : [])];
  // "Service fee $60 + Metal $900 − Set discount $45": a discount is subtracted, not added as a negative.
  const breakdown = lead.price.lines.map((line, i) => `${i ? (line.amount < 0 ? ' − ' : ' + ') : ''}${line.label} ${usd(Math.abs(line.amount))}`).join('');
  const element = h(
    EmailFrame,
    {
      brand,
      title: subject,
      // The preheader adds what the subject can't: their own words, or what they designed.
      preheader: lead.note ? `“${lead.note}”` : lead.summary.join(' · '),
      footer: { reason: `You're getting this because design requests for ${config.brand.name} go to this address. Change it in your dashboard. Lead ${lead.id.slice(0, 8)}.` },
    },
    test && h(Paragraph, { brand, muted: true, size: 14, margin: '0 0 12px' }, 'Test request from your own builder.'),
    h(Headline, { brand, text: `New ${total} design from *${first}*` }),
    designPhoto(brand, images, images.photo ? 'AI studio photo of the customer’s design' : '3D design the customer built'),
    photoPending && h(Paragraph, { brand, muted: true, size: 13, margin: '6px 0 0' }, 'The studio photo is still rendering. It will follow in this thread.'),
    lead.note && h(Quote, { brand }, lead.note),
    h(CTA, { brand, href: reach.href, margin: '26px 0 10px' }, reachCta(reach, first)),
    h(Paragraph, { brand, muted: true, size: 15, margin: '0' }, `${lead.name} · `, ...contacts),
    specList(brand, 'What they designed', lead.summary),
    h(Paragraph, { brand, muted: true, size: 13, margin: '24px 0 0' }, `${total} from your price list v${lead.configVersion}: ${breakdown}.${market}${shown}${lead.email ? ' Reply to this email to answer the customer directly.' : ''}`),
  );
  const text = [
    `New ${total} design from ${lead.name}`,
    lead.note ? `"${lead.note}"` : '',
    '',
    `${reachCta(reach, first)}: ${reach.label} (${reach.href})`,
    lead.email ? `Email: ${lead.email}` : '',
    '',
    'What they designed:',
    ...lead.summary.map((line) => `- ${line}`),
    '',
    `${total} from your price list v${lead.configVersion}: ${breakdown}.${market}${shown}`,
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
    h(Headline, { brand, text: `${first}’s *studio photo*` }),
    designPhoto(brand, { photo: true, preview: false }, 'AI studio photo of the customer’s design'),
    h(CTA, { brand, href: reach.href }, reachCta(reach, first)),
  );
  return {
    subject: subject.startsWith('Re: ') ? subject : `Re: ${subject}`,
    html: await html(element),
    text: `Studio photo for ${lead.name}'s design is attached.\n\nContact: ${reach.label} (${reach.href})\nLead ${lead.id}`,
  };
}

/**
 * Tells the jeweler a customer paid their deposit: the moment a lead turns into
 * a job. Inbox row: who paid how much. First screen: that, where the money is,
 * and the one action (reach them to book the next step). Then what they
 * designed and what's left to pay.
 */
export async function depositPaidEmail({ lead, config, origin, amount }: { lead: LeadForEmail; config: TenantConfig; origin: string; amount: number }): Promise<RenderedEmail> {
  const brand = vvsBrand(origin);
  const reach = contactLink(lead.contact);
  const first = firstName(lead.name);
  const left = Math.max(0, lead.total - amount);
  const balance = left > 0 ? `${usd(left)} left on the ${usd(lead.total)} estimate.` : `That covers the ${usd(lead.total)} estimate.`;
  const subject = `${lead.name} paid a ${usd(amount)} deposit`;
  const element = h(
    EmailFrame,
    {
      brand,
      title: subject,
      preheader: balance,
      footer: { reason: `You're getting this because design requests for ${config.brand.name} go to this address. Lead ${lead.id.slice(0, 8)}.` },
    },
    h(Illustration, { src: `${origin.replace(/\/$/, '')}/assets/mascot/karat-hype.png`, width: 132, align: 'left', alt: 'Karat celebrating' }),
    h(Headline, { brand, text: `*${first}* paid a ${usd(amount)} deposit` }),
    h(Paragraph, { brand, margin: '20px 0 0' }, `It's in your Stripe account and their spot is held. Reach out to book the next step.`),
    h(CTA, { brand, href: reach.href, margin: '24px 0 10px' }, reachCta(reach, first)),
    h(Paragraph, { brand, muted: true, size: 15, margin: '0' }, `${lead.name} · `, h(InlineLink, { brand, href: reach.href }, reach.label), ...(lead.email ? [' · ', h(InlineLink, { key: 'email', brand, href: `mailto:${lead.email}` }, lead.email)] : [])),
    specList(brand, 'What they designed', lead.summary),
    h(Paragraph, { brand, size: 16, margin: '16px 0 0' }, balance),
    h(Paragraph, { brand, muted: true, size: 13, margin: '24px 0 0' }, 'Paid by card through Stripe Checkout on your account. Refunds and payouts are in your Stripe dashboard.'),
  );
  const text = [
    `${lead.name} paid a ${usd(amount)} deposit.`,
    "It's in your Stripe account and their spot is held. Reach out to book the next step.",
    '',
    `${reachCta(reach, first)}: ${reach.label} (${reach.href})`,
    lead.email ? `Email: ${lead.email}` : '',
    '',
    'What they designed:',
    ...lead.summary.map((line) => `- ${line}`),
    '',
    balance,
    `\nLead ${lead.id}`,
  ]
    .filter((line) => line !== '')
    .join('\n');
  return { subject, html: await html(element), text };
}

/**
 * The customer's confirmation, in the shop's brand. They just hit send: the
 * inbox row confirms it arrived, the first screen keeps their design, and the
 * steps answer "what now, and what will it cost?".
 */
export async function customerEmail({ lead, config, origin, images, depositHref = null }: { lead: LeadForEmail; config: TenantConfig; origin: string; images: EmailImages; depositHref?: string | null }): Promise<RenderedEmail> {
  const shop = config.brand;
  const brand = shopBrand(shop, origin);
  const price = displayTotal(config.pricing, lead.total, usd).text;
  const hidden = config.pricing.display === 'hidden';
  const reach = contactLink(lead.contact);
  const ig = shop.instagram ? `https://instagram.com/${encodeURIComponent(shop.instagram.replace(/^@/, ''))}` : null;
  const deposit = lead.deposit !== null && lead.deposit > 0 ? usd(lead.deposit) : null;
  // With a pay link, the deposit is the one action; otherwise it's messaging the shop.
  const pay = deposit && depositHref ? { href: depositHref, label: `Pay ${deposit} deposit` } : null;
  const contactStep = `${shop.name} contacts you at ${reach.label} to go over your design${hidden ? ' and give you a price' : ' and confirm the final price'}.`;
  const steps = pay
    ? [`Hold your spot with a ${deposit} deposit.`, contactStep]
    : [contactStep, ...(deposit ? [`A ${deposit} deposit holds your spot. ${shop.name} will tell you how to pay.`] : [])];
  const questions = [
    'Questions? Reply to this email',
    ...(shop.phone ? [`, call ${displayContact(shop.phone)}`] : []),
    ...(pay && ig ? [', or ', h(InlineLink, { key: 'ig', brand, href: ig }, 'message them on Instagram')] : []),
    '.',
  ];
  const element = h(
    EmailFrame,
    {
      brand,
      title: `${shop.name} has your design`,
      preheader: reach.channel === 'instagram' ? `Next: they'll message you on Instagram at ${reach.label}.` : `Next: they'll text you at ${reach.label}.`,
      footer: { reason: `You're getting this because you sent a design to ${shop.name} with the VVS Lab builder. This is a one-time confirmation.` },
    },
    h(Headline, { brand, text: `${shop.name.replace(/\*/g, '')} has your *design*` }),
    h(Paragraph, { brand, margin: '18px 0 0' }, `Thanks, ${firstName(lead.name)}. `, hidden ? 'They’ll price it for you.' : h(Fragment, null, 'Your estimate is ', h('strong', null, price), '.')),
    designPhoto(brand, images, images.photo ? AI_DISCLOSURE : 'Your 3D design'),
    h(SectionLabel, { brand }, 'What happens next'),
    h(Steps, { brand, steps }),
    pay ? h(CTA, { brand, href: pay.href, margin: '18px 0 0' }, pay.label) : ig && h(CTA, { brand, href: ig, margin: '18px 0 0' }, `Message ${shop.name}`),
    specList(brand, 'Your design', lead.summary),
    h(Paragraph, { brand, muted: true, size: 14, margin: '24px 0 0' }, ...questions),
    h(SignOff, { brand }),
  );
  const text = [
    `${shop.name} has your design. Thanks, ${firstName(lead.name)}.`,
    hidden ? 'They’ll price it for you.' : `Your estimate is ${price}.`,
    '',
    'What happens next:',
    ...steps.map((step, index) => `${index + 1}. ${step}`),
    pay ? `\n${pay.label}: ${pay.href}` : '',
    '',
    'Your design:',
    ...lead.summary.map((line) => `- ${line}`),
    images.photo ? `\n${AI_DISCLOSURE}` : '',
    '\nQuestions? Reply to this email.',
  ]
    .filter((line) => line !== '')
    .join('\n');
  return { subject: `${shop.name} has your grillz design`, html: await html(element), text };
}

/** Self-serve signup: the one-time link that signs the new owner in. */
/**
 * The welcome after signup, or after claiming a shop VVS Lab built for them
 * (`claimed`). `oneTime`: the button is a one-time sign-in link (24 hours); when
 * they're already signed in on the phone they claimed from, it's the dashboard.
 */
export async function welcomeEmail({ shop, slug, link, origin, trialDays, claimed = false, oneTime = true }: { shop: string; slug: string; link: string; origin: string; trialDays: number; claimed?: boolean; oneTime?: boolean }): Promise<RenderedEmail> {
  const brand = vvsBrand(origin);
  const next = claimed ? 'It’s live now. Check your prices: it takes about 2 minutes.' : 'It’s live now with starting prices. Set your own with three quick questions.';
  const element = h(
    EmailFrame,
    { brand, title: 'Your builder is live', preheader: `${shop}'s grillz builder is live`, footer: { reason: claimed ? "You're getting this because you claimed your shop on VVS Lab." : "You're getting this because you signed up for VVS Lab." } },
    h(Headline, { brand, align: 'center', size: 54, text: 'Your builder is *live*' }),
    h(Illustration, { src: `${origin.replace(/\/$/, '')}/assets/mascot/karat-wink.png`, width: 216, alt: 'Karat, the VVS Lab mascot, winking' }),
    h(Paragraph, { brand, margin: '18px 0 16px' }, 'Hey there,'),
    h(Paragraph, { brand }, `${shop} now has its own 3D grillz builder at `, h('strong', null, `${host(origin)}/b/${slug}`), '. Customers design their set, see your prices and send it straight to you, with a studio photo.'),
    h(Paragraph, { brand }, `${next} Your free trial runs ${trialDays} days.`),
    h(CTA, { brand, href: link }, claimed ? 'Open my dashboard' : 'Set my prices'),
    oneTime
      ? h(
          Paragraph,
          { brand, muted: true, size: 13, margin: '0' },
          'The button works once and expires in 24 hours. After that, sign in any time at ',
          h(InlineLink, { brand, href: dashboardUrl(origin) }, `${host(origin)}/dashboard`),
          claimed ? '.' : ". Didn't sign up? Ignore this email.",
        )
      : h(Paragraph, { brand, muted: true, size: 13, margin: '0' }, 'On another phone or computer, sign in at ', h(InlineLink, { brand, href: dashboardUrl(origin) }, `${host(origin)}/dashboard`), ' with this email.'),
    h(SignOff, { brand }),
  );
  return {
    subject: claimed ? `${shop} is yours on VVS Lab` : 'Set up your VVS Lab builder',
    html: await html(element),
    text: oneTime
      ? `Welcome to VVS Lab.\n\nYour builder link is ${origin}/b/${slug}. ${claimed ? 'Open your dashboard' : 'Set your prices'} here: ${link}\n\nThe link works once and expires in 24 hours. After that, sign in any time at ${dashboardUrl(origin)}. Your free trial runs ${trialDays} days.`
      : `Welcome to VVS Lab.\n\nYour builder link is ${origin}/b/${slug}. ${next} Your dashboard: ${link}\n\nOn another phone or computer, sign in at ${dashboardUrl(origin)} with this email. Your free trial runs ${trialDays} days.`,
  };
}

/** A team invite: join a shop on VVS Lab. */
export async function inviteEmail({ shop, inviter, role, link, origin }: { shop: string; inviter: string; role: 'owner' | 'staff'; link: string; origin: string }): Promise<RenderedEmail> {
  const brand = vvsBrand(origin);
  const element = h(
    EmailFrame,
    { brand, title: `Join ${shop}`, preheader: `${inviter} invited you to ${shop} on VVS Lab`, footer: { reason: `You're getting this because ${inviter} invited this address to ${shop}.` } },
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
    h(SignOff, { brand }),
  );
  return {
    subject: 'You’re invited to join a shop on VVS Lab',
    html: await html(element),
    text: `${inviter} invited you to join "${shop}" on VVS Lab.\n\nAccept and sign in: ${link}\n\nThe link works once and expires in 24 hours. The invite stays open for 7 days: sign in any time at ${dashboardUrl(origin)}. If you weren't expecting this, ignore it.`,
  };
}
