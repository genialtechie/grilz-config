import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { chromium } from 'playwright';
import { EVAL_DESIGNS } from './designs';

// Captures each eval design's 3D preview from the dev /lab page: the exact
// image the AI photo starts from. Free (no model calls).
//   npx tsx scripts/photo-eval/capture.ts <origin> <out dir> [label]

const [origin = 'http://127.0.0.1:5199', out = 'photo-eval-out', label = 'capture'] = process.argv.slice(2);
mkdirSync(out, { recursive: true });
const browser = await chromium.launch({ args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
for (const design of EVAL_DESIGNS) {
  const page = await browser.newPage({ viewport: { width: 900, height: 700 } });
  await page.goto(`${origin}/lab?spec=${encodeURIComponent(JSON.stringify(design.spec))}`);
  await page.waitForFunction(() => window.__lab?.ready, null, { timeout: 60_000 });
  await page.waitForTimeout(9_000); // the model loads and the opening swing settles
  const started = Date.now();
  const still = await page.evaluate(() => window.__lab!.photo());
  const file = join(out, `${design.id}-${label}.jpg`);
  writeFileSync(file, Buffer.from(still.image.split(',')[1], 'base64'));
  writeFileSync(join(out, `${design.id}-${label}-labels.png`), Buffer.from(still.labels.split(',')[1], 'base64'));
  console.log(file, `${Date.now() - started} ms`);
  await page.close();
}
await browser.close();
