// Renders every email to HTML and screenshots it at phone and desktop widths,
// light and dark, for review. Images load from a local copy of /public.
//   npx tsx scripts/email-preview.ts <outDir>
// Needs Playwright's Chromium (see e2e/).

import { spawn } from 'node:child_process';
import { mkdirSync, writeFileSync } from 'node:fs';
import { chromium } from 'playwright';
import { trialEmail, type TrialShop } from '../server/trialEmails';
import { customerEmail, depositPaidEmail, inviteEmail, shopEmail, welcomeEmail, type LeadForEmail } from '../server/emailTemplates';
import { VVSLAB_CONFIG } from '../src/lib/tenant/vvslab';

const out = process.argv[2] ?? 'email-preview';
const PORT = 5310;
const local = `http://127.0.0.1:${PORT}`;
// Emails are rendered with the real origin (so links read right); only the
// image assets are pointed at the local server.
const origin = 'https://vvslab.magpollo.com';
const localAssets = (html: string) => html.replaceAll(`${origin}/assets/`, `${local}/assets/`);

const lead: LeadForEmail = {
  id: '7f3c2a10-5b1e-4c3a-9d1f-2a6b8e4c1d90',
  name: 'Marcus Reed',
  contact: '+14045550123',
  email: 'marcus@example.com',
  note: 'Want it done before my birthday on the 14th',
  summary: ['8 top · 8 bottom', 'Yellow gold 14k', 'Iced out · VVS moissanite · prong', 'Fangs on the canines'],
  price: { lines: [{ label: 'Yellow gold 14k × 16 teeth', amount: 2800 }, { label: 'Iced out (moissanite) × 6', amount: 1200 }, { label: 'Fangs', amount: 150 }], total: 4150 } as LeadForEmail['price'],
  total: 4150,
  deposit: 500,
  configVersion: 4,
  createdAt: new Date().toISOString(),
};

const shop = structuredClone(VVSLAB_CONFIG);
shop.brand = { ...shop.brand, name: 'Gold Mouth Jewelers', instagram: 'goldmouth.atl', logo: '/assets/vvs/logo-mark.png' };

const photo = `${local}/assets/vvs/photo-mixed.webp`;
const withPhoto = (html: string) => html.replace(/cid:(photo|preview)/g, photo);

const trialShop: TrialShop = { id: 'x', slug: 'gold-mouth', name: 'Gold Mouth Jewelers', live: false, hasLogo: true, pricesSet: false, leads: 0, estimates: 0, stripeReady: false, hasCard: false, daysLeft: 3 };
const unsubscribe = `${origin}/api/unsubscribe?e=preview&topic=tips&s=preview`;

const emails: Record<string, string> = {
  'design-request': withPhoto((await shopEmail({ lead, config: shop, origin, images: { photo: true, preview: false }, photoPending: false, test: false })).html),
  'customer-confirmation': withPhoto((await customerEmail({ lead, config: shop, origin, images: { photo: true, preview: false }, depositHref: `${origin}/api/deposit?lead=x&t=x` })).html),
  'deposit-paid': (await depositPaidEmail({ lead, config: shop, origin, amount: 500 })).html,
  welcome: (await welcomeEmail({ shop: 'Gold Mouth Jewelers', slug: 'gold-mouth', link: `${origin}/dashboard/welcome?token_hash=x&type=invite`, origin, trialDays: 14 })).html,
  'trial-day-1': (await trialEmail('day-1', trialShop, origin, unsubscribe)).html,
  'trial-day-3': (await trialEmail('day-3', { ...trialShop, live: true, pricesSet: true }, origin, unsubscribe)).html,
  'trial-day-7': (await trialEmail('day-7', { ...trialShop, live: true }, origin, unsubscribe)).html,
  'trial-day-12': (await trialEmail('day-12', { ...trialShop, live: true, leads: 3, estimates: 9450 }, origin, unsubscribe)).html,
  'trial-day-14': (await trialEmail('day-14', { ...trialShop, daysLeft: 1 }, origin, unsubscribe)).html,
  invite: (await inviteEmail({ shop: 'Gold Mouth Jewelers', inviter: 'dre@goldmouth.com', role: 'staff', link: `${origin}/dashboard/welcome?token_hash=x&type=invite`, origin })).html,
};

async function main() {
  mkdirSync(out, { recursive: true });
  const server = spawn('python3', ['-m', 'http.server', String(PORT), '-d', 'public', '--bind', '127.0.0.1'], { stdio: 'ignore' });
  await new Promise((resolve) => setTimeout(resolve, 800));
  const browser = await chromium.launch();
  try {
    for (const [name, html] of Object.entries(emails)) {
      writeFileSync(`${out}/${name}.html`, html);
      for (const [label, width] of [['phone', 390], ['desktop', 640]] as const) {
        for (const scheme of ['light', 'dark'] as const) {
          const page = await browser.newPage({ viewport: { width, height: 800 }, deviceScaleFactor: 2, colorScheme: scheme, ignoreHTTPSErrors: true });
          // Open from the local origin first: a blank page may not load loopback images.
          await page.goto(`${local}/robots.txt`);
          await page.setContent(localAssets(html), { waitUntil: 'networkidle' });
          await page.screenshot({ path: `${out}/${name}-${label}-${scheme}.png`, fullPage: true });
          await page.close();
        }
      }
      console.log(`${name}: ${Math.round(Buffer.byteLength(html) / 1024)} KB of HTML`);
    }
  } finally {
    await browser.close();
    server.kill();
  }
}

void main();
