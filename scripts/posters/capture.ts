// The posters the builder shows while its 3D code and model download: a still
// of the default set (6 x 6, plain, solid) in each metal, on a transparent
// background, framed exactly like the live view (src/lib/poster.ts explains how
// the two line up). Rerun whenever the model, the metals or the lighting change:
//
//   npm run dev            (in another terminal; the /lab page is dev-only)
//   npx tsx scripts/posters/capture.ts [http://localhost:5173]
//
// Software rendering is fine: the poster is on screen for a fraction of a second.
import { mkdirSync } from 'node:fs';
import { chromium } from 'playwright';
import sharp from 'sharp';
import { METALS } from '../../src/lib/renderSpec';
import { POSTER_ASPECT } from '../../src/lib/poster';

const base = process.argv[2] ?? 'http://localhost:5173';
const out = new URL('../../public/assets/posters/', import.meta.url).pathname;
const HEIGHT = 850;

mkdirSync(out, { recursive: true });
// CHROMIUM_PATH: a Chromium to use when Playwright's own download isn't installed.
const browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH || undefined, args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
// Reduced motion: no opening swing, so the still is the straight-on resting view.
const context = await browser.newContext({ viewport: { width: Math.round(HEIGHT * POSTER_ASPECT), height: HEIGHT }, deviceScaleFactor: 1.2, reducedMotion: 'reduce' });
for (const metal of METALS) {
  const page = await context.newPage();
  await page.goto(`${base}/lab?metal=${metal.id}&count=6`, { waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() => window.__lab?.ready);
  await page.waitForTimeout(2500);
  // Draw and read back in one task: the canvas doesn't keep its pixels between frames.
  const png = await page.evaluate(() => {
    const root = window.__lab!.root.get();
    root.gl.render(root.scene, root.camera);
    return root.gl.domElement.toDataURL('image/png');
  });
  const file = `${out}set-${metal.id}.webp`;
  const info = await sharp(Buffer.from(png.split(',')[1], 'base64')).webp({ quality: 78, alphaQuality: 85, effort: 6 }).toFile(file);
  console.log(`set-${metal.id}.webp ${info.width}x${info.height} ${Math.round(info.size / 1024)} KB`);
  await page.close();
}
await browser.close();
