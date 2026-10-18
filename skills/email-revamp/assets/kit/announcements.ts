import { createElement as h, type ReactElement } from 'react';
import { render } from '@react-email/render';
import { createDb, hasDb } from './db.js';
import { vvsBrand } from './email/brand.js';
import { CTA, EmailFrame, Headline, Illustration, Paragraph, SignOff } from './email/components.js';
import type { RenderedEmail } from './emailTemplates.js';
import { marketingReplyTo, ownerEmail, sendMarketingEmail, type MarketingEnv, type MarketingResult } from './marketing.js';

// Product announcements (marketing, topic "news"), sent by the daily
// /api/cron/marketing run. An announcement is an entry below, so every send
// is reviewed in a pull request:
//   1. Add it with audience 'test' and a sendAt: only ANNOUNCE_TEST_TO gets it.
//   2. Check it in a real inbox. Then change audience to 'all' (a new id is
//      not needed: each address gets each announcement once).
// It goes to every shop owner (not offboarded) who hasn't opted out of news,
// paced for Resend's rate limit; a big list finishes over the next runs,
// within 7 days of sendAt. One hero feature per email (playbook section 8).

export type Announcement = {
  id: string;
  /** ISO time; sent on the first daily run after it, for 7 days. */
  sendAt: string;
  audience: 'test' | 'all';
  subject: string;
  preheader: string;
  /** `*word*` sets one word in the accent italic. */
  headline: string;
  karat: 'cool' | 'hype' | 'wink';
  paragraphs: string[];
  cta: { label: string; path: string };
};

export const ANNOUNCEMENTS: Announcement[] = [
  {
    id: '2026-10-deposits-from-the-inbox',
    sendAt: '2026-10-19T00:00:00Z',
    audience: 'test',
    subject: 'Get the deposit, even after they close the tab',
    preheader: 'Customers can now pay your deposit from their confirmation email.',
    headline: 'Deposits, *from the inbox*',
    karat: 'hype',
    paragraphs: [
      'Hey there,',
      'When a customer sends a design, your shop emails them a confirmation. If you take card deposits, that email now has a Pay deposit button, so a customer who closed the tab can still hold their spot later. The link works for 30 days and opens your own Stripe checkout.',
      'And the moment a deposit is paid, you get an email: who paid, how much, and what’s left on the estimate.',
      'Not taking card deposits yet? Connect Stripe from the Shop tab in your dashboard. It takes about two minutes.',
    ],
    cta: { label: 'Open my dashboard', path: '/dashboard' },
  },
];

const WINDOW_DAYS = 7;
/** Resend allows 2 requests a second; each send is one request. */
const PACE_MS = 600;
/** Sends per run, to finish well inside the function's time limit. */
const MAX_PER_RUN = 80;

const html = (element: ReactElement) => render(element);
const base = (origin: string) => origin.replace(/\/$/, '');

export async function announcementEmail(item: Announcement, origin: string, unsubscribe: string): Promise<RenderedEmail> {
  const brand = vvsBrand(origin);
  const link = `${base(origin)}${item.cta.path}?utm_source=email&utm_medium=announcement&utm_campaign=${encodeURIComponent(item.id)}`;
  const element = h(
    EmailFrame,
    { brand, title: item.subject, preheader: item.preheader, footer: { reason: 'You’re getting this because you have a VVS Lab builder. Product news, a few times a year.', unsubscribe } },
    h(Headline, { brand, align: 'center', size: 50, text: item.headline }),
    h(Illustration, { src: `${base(origin)}/assets/mascot/karat-${item.karat}.png`, width: 168, alt: '' }),
    ...item.paragraphs.map((text, index) => h(Paragraph, { key: index, brand, margin: index === 0 ? '18px 0 16px' : undefined }, text)),
    h(CTA, { brand, href: link }, item.cta.label),
    h(SignOff, { brand }),
  );
  return {
    subject: item.subject,
    html: await html(element),
    text: `${item.paragraphs.join('\n\n')}\n\n${item.cta.label}: ${link}\n\nUnsubscribe: ${unsubscribe}`,
  };
}

/** Announcements whose send window is open. */
export const dueAnnouncements = (now = Date.now(), list = ANNOUNCEMENTS) =>
  list.filter((item) => {
    const at = new Date(item.sendAt).getTime();
    return at <= now && now < at + WINDOW_DAYS * 864e5;
  });

export type AnnouncementRun = { due: string[]; recipients: number; results: Partial<Record<MarketingResult, number>>; capped: boolean };

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

export async function runAnnouncements(
  env: MarketingEnv & { ANNOUNCE_TEST_TO?: string; MARKETING_REPLY_TO?: string; PLATFORM_LEADS_EMAIL?: string },
  { dryRun = false, now = Date.now(), list = ANNOUNCEMENTS, paceMs = PACE_MS } = {},
): Promise<AnnouncementRun> {
  const due = dueAnnouncements(now, list);
  const run: AnnouncementRun = { due: due.map((item) => item.id), recipients: 0, results: {}, capped: false };
  if (!due.length || !hasDb(env)) return run;
  const db = createDb(env);
  const origin = env.PUBLIC_ORIGIN || 'https://vvslab.magpollo.com';
  const testers = (env.ANNOUNCE_TEST_TO ?? '').split(',').map((address) => address.trim().toLowerCase()).filter(Boolean);

  let owners: string[] | null = null;
  const everyone = async () => {
    if (owners) return owners;
    const shops = await db.select<{ id: string }>('tenants', { kind: 'eq.shop', status: 'in.(draft,live,paused)', select: 'id' });
    const found = new Set<string>();
    for (const shop of shops) {
      const owner = await ownerEmail(db, shop.id);
      if (owner) found.add(owner);
    }
    owners = [...found];
    return owners;
  };

  let sends = 0;
  for (const item of due) {
    const recipients = item.audience === 'test' ? testers : await everyone();
    run.recipients += recipients.length;
    if (dryRun) continue;
    for (const to of recipients) {
      if (sends >= MAX_PER_RUN) {
        run.capped = true;
        return run;
      }
      const result = await sendMarketingEmail(
        {
          to,
          topic: 'news',
          kind: `announcement-${item.id}`,
          dedupeKey: `announcement-${item.id}:${to}`,
          fromName: 'Karat from VVS Lab',
          replyTo: marketingReplyTo(env),
          render: (unsubscribe) => announcementEmail(item, origin, unsubscribe),
        },
        env,
      ).catch((error: Error) => {
        console.error('announcement failed', item.id, error.message);
        return 'failed' as const;
      });
      run.results[result] = (run.results[result] ?? 0) + 1;
      if (result === 'sent' || result === 'failed') {
        sends += 1;
        await sleep(paceMs);
      }
    }
  }
  return run;
}
