// Launch checks (Nov 24) against the built app, with no backend:
//
//   npm run build && npx vite preview --port 4317
//   npx jiti scripts/launch-check/capture.ts [http://localhost:4317] [only]
//
// `only`: embed | opal | domain (default: all three).
//  - embed:  scripts/launch-check/embed-test.html frames /b/vvslab at 380 × 700 and 1000 × 700 and
//            through public/embed.js; screenshots, plus the panel's drag handle inside the short frame.
//  - opal:   the builder with an iced tooth + opal (6 × 6, honeycomb, opals, blue) at 390 × 844 and 1440 × 900.
//  - domain: "/" served the way api/shop-page.ts serves a shop's own domain (customDomainHead adds
//            <meta name="vvs-shop">) renders the shop's builder, not the landing page.
// /api/tenant/vvslab is answered here with the demo shop's public config (server/tenants.ts).
// Screens go to docs/redesign/case-study/2026-11-24-launch-*.jpg.
// CHROMIUM_PATH: a Chromium to use when Playwright's own download isn't installed.
import { readFileSync } from 'node:fs';
import { chromium, type BrowserContext, type Page } from 'playwright';
import { customDomainHead } from '../../server/shopPage';
import { publicTenant, TENANT_ZERO } from '../../server/tenants';

const base = process.argv[2] ?? 'http://localhost:4317';
const only = process.argv[3];
const root = new URL('../../', import.meta.url).pathname;
const shots = `${root}docs/redesign/case-study/2026-11-24-launch-`;

const browser = await chromium.launch({
  executablePath: process.env.CHROMIUM_PATH || undefined,
  args: ['--use-gl=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'],
});

async function serve(context: BrowserContext) {
  await context.route('**/api/tenant/**', (route) => route.fulfill({ json: publicTenant(TENANT_ZERO) }));
  // Nothing else of the backend runs here: answer it empty rather than with the app's HTML.
  await context.route(/\/api\/(?!tenant\/)/, (route) => route.fulfill({ status: 503, json: { error: 'offline' } }));
  await context.route(`${base}/__embed-test`, (route) => route.fulfill({ contentType: 'text/html', body: readFileSync(`${root}scripts/launch-check/embed-test.html`, 'utf8') }));
}

const FRAMES = ['narrow', 'wide', 'narrowShort', 'wideShort'];
const problems: string[] = [];
const check = (ok: boolean, what: string) => {
  console.log(`${ok ? 'ok  ' : 'FAIL'} ${what}`);
  if (!ok) problems.push(what);
};

/** Waits for the 3D canvas in a page or frame, then lets it settle. */
async function settled(page: Page, ms = 4000) {
  await page.waitForTimeout(ms);
}

if (!only || only === 'embed') {
  const context = await browser.newContext({ viewport: { width: 1480, height: 2340 }, deviceScaleFactor: 1 });
  await serve(context);
  const page = await context.newPage();
  page.on('pageerror', (error) => problems.push(`page error: ${error.message}`));
  await page.goto(`${base}/__embed-test`, { waitUntil: 'load' });
  for (const id of FRAMES) {
    const frame = page.frameLocator(`#${id}`);
    await frame.locator('.creator').first().waitFor({ timeout: 30000 });
  }
  await settled(page, 6000);
  await page.screenshot({ path: `${shots}embed-start.jpg`, type: 'jpeg', quality: 82, fullPage: true });
  // Into the builder in both frames: "Build it yourself" first.
  for (const id of FRAMES) {
    const frame = page.frameLocator(`#${id}`);
    const start = frame.getByRole('button', { name: /build it yourself/i }).first();
    if (await start.count()) await start.evaluate((button: HTMLElement) => button.click());
  }
  await settled(page, 6000);
  await page.screenshot({ path: `${shots}embed-builder.jpg`, type: 'jpeg', quality: 82, fullPage: true });
  // The drag handle in the shortest phone-width frame: a tap gives the panel the frame's height.
  const short = page.frameLocator('#narrowShort');
  const trayTop = () => short.locator('.tray').evaluate((tray: HTMLElement) => Math.round(tray.getBoundingClientRect().top));
  const before = await trayTop();
  await short.locator('.tray .tgrab').evaluate((grab: HTMLElement) => grab.click());
  await page.waitForTimeout(1200);
  const after = await trayTop();
  console.log('narrowShort tray top', before, '->', after);
  check(after < before - 100, 'narrowShort: the drag handle opens the panel up');
  await page.locator('#narrowShort').screenshot({ path: `${shots}embed-handle-phone.jpg`, type: 'jpeg', quality: 84 });
  await short.locator('.tray .tgrab').evaluate((grab: HTMLElement) => grab.click());
  await page.waitForTimeout(1200);
  check((await trayTop()) === before, 'narrowShort: a second tap puts the panel back');
  for (const id of FRAMES) {
    const report = await page.frameLocator(`#${id}`).locator('body').evaluate(() => {
      const doc = document.documentElement;
      const panel = document.querySelector<HTMLElement>('.tray');
      const r = panel?.getBoundingClientRect();
      return {
        scrollW: doc.scrollWidth,
        clientW: doc.clientWidth,
        scrollH: doc.scrollHeight,
        clientH: doc.clientHeight,
        panel: r ? { top: Math.round(r.top), bottom: Math.round(r.bottom), height: Math.round(r.height) } : null,
        innerHeight: window.innerHeight,
      };
    });
    console.log(id, JSON.stringify(report));
    check(report.scrollW <= report.clientW, `${id}: no sideways scroll inside the frame`);
    check(report.scrollH <= report.clientH + 1, `${id}: the builder fits the frame's height`);
    if (report.panel) check(report.panel.bottom <= report.innerHeight + 1 && report.panel.top >= 0, `${id}: the panel sits inside the frame`);
  }
  await context.close();
}

if (!only || only === 'opal') {
  for (const [name, viewport, scale] of [
    ['phone', { width: 390, height: 844 }, 2],
    ['desktop', { width: 1440, height: 900 }, 1],
  ] as const) {
    const context = await browser.newContext({ viewport, deviceScaleFactor: scale, isMobile: name === 'phone', hasTouch: name === 'phone' });
    await serve(context);
    const page = await context.newPage();
    page.on('pageerror', (error) => problems.push(`page error: ${error.message}`));
    // A saved design opens straight in the builder: 6 × 6, 10K yellow, iced honeycomb with a blue opal centre.
    const tooth = { metal: 'yellow', karat: '10k', type: 'iced', style: 'opals', opal: 'blue', setting: 'honeycomb', stone: 'moissanite' };
    const snapshot = { v: 1, teeth: [5, 6, 7, 8, 9, 10, 21, 22, 23, 24, 25, 26], base: tooth, overrides: {}, set: { fangs: false, cut: 'deep', vision: '', mold: 'kit' }, drafts: [], runs: 'centred' };
    const hash = Buffer.from(JSON.stringify(snapshot)).toString('base64url');
    await page.goto(`${base}/b/vvslab#design=${hash}`, { waitUntil: 'load' });
    await settled(page, 3000);
    const resume = page.getByRole('button', { name: /continue your build/i }).first();
    if (await resume.count()) await resume.click();
    await settled(page, 2000);
    // Open the Finish part so the opal colours show.
    await page.getByRole('tab', { name: /^Finish/ }).first().evaluate((tab: HTMLElement) => tab.click());
    await settled(page, 7000);
    // A quick question may have come up while it loaded: close it for the picture.
    const close = page.locator('.bubble .x');
    if (await close.count()) await close.first().evaluate((x: HTMLElement) => x.click());
    // Show the opal colours (the Blue chip is on) on phones, where the panel is short.
    if (name === 'phone') await page.getByText('Opal colour').first().evaluate((label: HTMLElement) => label.scrollIntoView({ block: 'start' }));
    await settled(page, 1000);
    await page.screenshot({ path: `${shots}iced-opal-${name}.jpg`, type: 'jpeg', quality: 84 });
    const text = await page.locator('body').innerText();
    check(/opal/i.test(text), `${name}: the builder shows the iced opal design`);
    await context.close();
  }
}

if (!only || only === 'domain') {
  const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  await serve(context);
  const html = customDomainHead(readFileSync(`${root}dist/index.html`, 'utf8'), TENANT_ZERO, 'https://build.shop.example');
  check(html.includes('<meta name="vvs-shop" content="vvslab"'), 'domain: the served page carries the shop marker');
  await context.route(`${base}/`, (route) => route.fulfill({ contentType: 'text/html', body: html }));
  const page = await context.newPage();
  page.on('pageerror', (error) => problems.push(`page error: ${error.message}`));
  await page.goto(`${base}/`, { waitUntil: 'load' });
  await settled(page, 5000);
  const text = await page.locator('body').innerText();
  check(/start your build/i.test(text), 'domain: "/" opens the shop\'s builder (CreatorApp start page)');
  await page.screenshot({ path: `${shots}custom-domain.jpg`, type: 'jpeg', quality: 80 });
  // Without the marker, "/" is the landing page.
  const plain = await context.newPage();
  await context.unroute(`${base}/`);
  await plain.goto(`${base}/`, { waitUntil: 'load' });
  await settled(plain, 2000);
  check(!/start your build/i.test(await plain.locator('body').innerText()), 'domain: without the marker "/" stays the landing page');
  await context.close();
}

await browser.close();
if (problems.length) {
  console.log(`\n${problems.length} problem(s):\n- ${problems.join('\n- ')}`);
  process.exitCode = 1;
}
