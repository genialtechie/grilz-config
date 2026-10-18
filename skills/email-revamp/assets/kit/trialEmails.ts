import { createElement as h, Fragment, type ReactElement } from 'react';
import { render } from '@react-email/render';
import { vvsBrand } from './email/brand.js';
import { Checklist, CTA, EmailFrame, Headline, Illustration, InlineLink, Paragraph, SectionLabel, SignOff, Steps } from './email/components.js';
import type { RenderedEmail } from './emailTemplates.js';

// The trial sequence (marketing, topic "tips"). Each email is planned in
// docs/email/vvs-lab.md: one job, the inbox row first, one action, and it
// uses what we know about the shop (its setup progress, its requests).

/** What the sequence knows about a shop on a given day. */
export type TrialShop = {
  id: string;
  slug: string;
  name: string;
  live: boolean;
  hasLogo: boolean;
  pricesSet: boolean;
  /** Design requests so far, and what they add up to. */
  leads: number;
  estimates: number;
  stripeReady: boolean;
  hasCard: boolean;
  daysLeft: number;
};

export type TrialStep = 'day-1' | 'day-3' | 'day-7' | 'day-12' | 'day-14';

const html = (element: ReactElement) => render(element);
/** "Gold Mouth Jewelers'", "Ice Box's". */
const possessive = (name: string) => (/s$/i.test(name) ? `${name}'` : `${name}'s`);
const usd = (value: number) => `$${Math.round(value).toLocaleString('en-US')}`;
const base = (origin: string) => origin.replace(/\/$/, '');
const host = (origin: string) => base(origin).replace(/^https?:\/\//, '');
const dashboard = (origin: string, shop: TrialShop, path = '') => `${base(origin)}/dashboard/${shop.slug}${path}?utm_source=email&utm_medium=trial`;
const karat = (origin: string, face: 'cool' | 'nudge' | 'hype') => `${base(origin)}/assets/mascot/karat-${face}.png`;

const footer = (shop: TrialShop, unsubscribe: string) => ({ reason: `You're getting this because you started a VVS Lab trial for ${shop.name}.`, unsubscribe });

const setup = (shop: TrialShop) => [
  { label: 'Add your logo', done: shop.hasLogo },
  { label: 'Set what you sell and your prices, then Publish', done: shop.pricesSet },
  { label: 'Switch your builder on', done: shop.live },
];

/** Day 1, not live yet: the one action that makes the product real. */
async function goLive(shop: TrialShop, origin: string, unsubscribe: string, still: boolean): Promise<RenderedEmail> {
  const brand = vvsBrand(origin);
  const done = setup(shop).filter((item) => item.done).length;
  const subject = still ? 'Your builder is still switched off' : 'Your builder is 10 minutes from live';
  const element = h(
    EmailFrame,
    { brand, title: subject, preheader: `You've done ${done} of 3 steps. Customers can send designs once it's on.`, footer: footer(shop, unsubscribe) },
    h(Headline, { brand, align: 'center', size: 50, text: still ? 'Your builder is still *off*' : 'Your builder is *10 minutes* from live' }),
    h(Illustration, { src: karat(origin, 'nudge'), width: 168, alt: '' }),
    h(Paragraph, { brand, margin: '18px 0 16px' }, 'Hey there,'),
    h(
      Paragraph,
      { brand },
      still
        ? `${possessive(shop.name)} builder is set up but switched off, so customers can't send you designs yet. Here's what's left:`
        : `${possessive(shop.name)} 3D builder is ready for your logo and prices. Three steps and customers can start sending you designs:`,
    ),
    h(Checklist, { brand, items: setup(shop) }),
    h(CTA, { brand, href: dashboard(origin, shop) }, still ? 'Switch it on' : 'Finish setting up'),
    h(SignOff, { brand }),
  );
  return {
    subject,
    html: await html(element),
    text: `${still ? `${possessive(shop.name)} builder is still switched off.` : `${possessive(shop.name)} builder is 10 minutes from live.`}\n\n${setup(shop)
      .map((item) => `${item.done ? '[x]' : '[ ]'} ${item.label}`)
      .join('\n')}\n\nFinish setting up: ${dashboard(origin, shop)}\n\nUnsubscribe: ${unsubscribe}`,
  };
}

/** Day 3, live: put the link where customers already are. */
async function share(shop: TrialShop, origin: string, unsubscribe: string): Promise<RenderedEmail> {
  const brand = vvsBrand(origin);
  const link = `${host(origin)}/b/${shop.slug}`;
  const subject = 'Put your builder where customers already are';
  const element = h(
    EmailFrame,
    { brand, title: subject, preheader: `Your link: ${link}`, footer: footer(shop, unsubscribe) },
    h(Headline, { brand, align: 'center', size: 50, text: 'Put it where your *customers* are' }),
    h(Illustration, { src: karat(origin, 'cool'), width: 168, alt: '' }),
    h(Paragraph, { brand, margin: '18px 0 16px' }, 'Hey there,'),
    h(Paragraph, { brand }, `${possessive(shop.name)} builder is live at `, h('strong', null, link), '. It gets design requests once customers can find it. Two places do most of the work:'),
    h(Steps, {
      brand,
      steps: [
        h(Fragment, null, h('strong', null, 'Your Instagram bio. '), 'Most custom orders start in your DMs. Put the link where they already look.'),
        h(Fragment, null, h('strong', null, 'Your website. '), 'Add it as a button, or embed the builder right on the page.'),
      ],
    }),
    h(CTA, { brand, href: dashboard(origin, shop, '/website') }, 'Get my link and embed code'),
    h(SignOff, { brand }),
  );
  return {
    subject,
    html: await html(element),
    text: `${possessive(shop.name)} builder is live at https://${link}.\n\n1. Put it in your Instagram bio.\n2. Add it to your website as a button or an embed.\n\nGet your link and embed code: ${dashboard(origin, shop, '/website')}\n\nUnsubscribe: ${unsubscribe}`,
  };
}

/** Day 7, no card deposits yet: get paid up front. */
async function deposits(shop: TrialShop, origin: string, unsubscribe: string): Promise<RenderedEmail> {
  const brand = vvsBrand(origin);
  const subject = 'Take the deposit when they send the design';
  const element = h(
    EmailFrame,
    { brand, title: subject, preheader: 'Customers can pay a deposit by card the moment they send a design.', footer: footer(shop, unsubscribe) },
    h(Headline, { brand, align: 'center', size: 50, text: 'Get the *deposit* up front' }),
    h(Illustration, { src: karat(origin, 'hype'), width: 168, alt: '' }),
    h(Paragraph, { brand, margin: '18px 0 16px' }, 'Hey there,'),
    h(Paragraph, { brand }, 'A customer is most sure about a set the moment they send it. With card deposits on, your builder asks for the deposit right then, and the money goes straight to your own Stripe account. You get an email the moment it’s paid.'),
    h(SectionLabel, { brand }, 'Two minutes to switch on'),
    h(Steps, { brand, steps: ['Connect Stripe from the Shop tab.', 'Pick the deposit: a fixed amount or a percentage of the estimate.', 'Publish. Customers can pay as soon as they send a design.'] }),
    h(CTA, { brand, href: dashboard(origin, shop, '/shop') }, 'Turn on card deposits'),
    h(SignOff, { brand }),
  );
  return {
    subject,
    html: await html(element),
    text: `Take the deposit when they send the design.\n\n1. Connect Stripe from the Shop tab.\n2. Pick the deposit: a fixed amount or a percentage.\n3. Publish.\n\nTurn on card deposits: ${dashboard(origin, shop, '/shop')}\n\nUnsubscribe: ${unsubscribe}`,
  };
}

/** Day 12, no card: what they'd lose, in their own numbers. */
async function ending(shop: TrialShop, origin: string, unsubscribe: string): Promise<RenderedEmail> {
  const brand = vvsBrand(origin);
  const days = `${shop.daysLeft} day${shop.daysLeft === 1 ? '' : 's'}`;
  const subject = `${days} left on your trial`;
  const recap =
    shop.leads > 0
      ? h(Fragment, null, 'So far ', h('strong', null, `${shop.leads} design request${shop.leads === 1 ? '' : 's'}`), ' came through your builder, worth ', h('strong', null, usd(shop.estimates)), ' in estimates.')
      : shop.live
        ? 'Your builder is live and ready for its first design request.'
        : 'Your builder is set up and waiting to be switched on.';
  const element = h(
    EmailFrame,
    {
      brand,
      title: subject,
      preheader: shop.leads > 0 ? `${shop.leads} design request${shop.leads === 1 ? '' : 's'} so far. Keep it on for $199/mo.` : 'Keep your builder on for $199/mo.',
      footer: footer(shop, unsubscribe),
    },
    h(Headline, { brand, align: 'center', size: 50, text: `*${days}* left on your trial` }),
    h(Illustration, { src: karat(origin, 'nudge'), width: 168, alt: '' }),
    h(Paragraph, { brand, margin: '18px 0 16px' }, 'Hey there,'),
    h(Paragraph, { brand }, recap),
    h(Paragraph, { brand }, `When the trial ends, ${possessive(shop.name)} builder switches off until you start your plan. Your designs, prices and requests are kept.`),
    h(Paragraph, { brand }, h('strong', null, '$199 a month'), ', no setup fee, cancel any time.'),
    h(CTA, { brand, href: dashboard(origin, shop) }, 'Keep my builder on'),
    h(SignOff, { brand }),
  );
  return {
    subject,
    html: await html(element),
    text: `${days} left on your ${shop.name} trial.\n\nWhen it ends, the builder switches off until you start your plan ($199/mo, cancel any time). Your designs, prices and requests are kept.\n\nKeep your builder on: ${dashboard(origin, shop)}\n\nUnsubscribe: ${unsubscribe}`,
  };
}

/** Day 14, last day, no card: a plain letter from the founder that invites a reply. */
async function lastDay(shop: TrialShop, origin: string, unsubscribe: string): Promise<RenderedEmail> {
  const brand = vvsBrand(origin);
  const subject = 'Last day of your trial';
  const element = h(
    EmailFrame,
    { brand, title: subject, preheader: 'One quick question before it ends.', footer: footer(shop, unsubscribe) },
    h(Paragraph, { brand, margin: '8px 0 16px' }, 'Hey there,'),
    h(Paragraph, { brand }, `It's Haleem, I built VVS Lab. Your free trial for ${shop.name} ends within a day.`),
    h(Paragraph, { brand }, 'If VVS Lab isn’t right for your shop, I’d really like to know why. Just reply to this email. I read every one.'),
    h(Paragraph, { brand }, 'If it is, start your plan and your builder stays on without a gap.'),
    h(CTA, { brand, href: dashboard(origin, shop) }, 'Start my plan'),
    h(Paragraph, { brand, muted: true, size: 14, margin: '0' }, 'Or sign in any time at ', h(InlineLink, { brand, href: dashboard(origin, shop) }, `${host(origin)}/dashboard`), '.'),
    h(SignOff, { brand }, '— Haleem, founder of VVS Lab'),
  );
  return {
    subject,
    html: await html(element),
    text: `Hey there,\n\nIt's Haleem, I built VVS Lab. Your free trial for ${shop.name} ends within a day.\n\nIf VVS Lab isn't right for your shop, I'd really like to know why. Just reply to this email.\n\nIf it is, start your plan: ${dashboard(origin, shop)}\n\n— Haleem\n\nUnsubscribe: ${unsubscribe}`,
  };
}

export function trialEmail(step: TrialStep, shop: TrialShop, origin: string, unsubscribe: string): Promise<RenderedEmail> {
  switch (step) {
    case 'day-1':
      return goLive(shop, origin, unsubscribe, false);
    case 'day-3':
      return shop.live ? share(shop, origin, unsubscribe) : goLive(shop, origin, unsubscribe, true);
    case 'day-7':
      return deposits(shop, origin, unsubscribe);
    case 'day-12':
      return ending(shop, origin, unsubscribe);
    case 'day-14':
      return lastDay(shop, origin, unsubscribe);
  }
}
