// The pictures on the builder's option cards (public/assets/options/grillz/*.webp),
// rendered from the 3D model so each card shows what choosing it does (MAG-148).
// Same file names and size (480 × 480) as before, so no component changes.
// Rerun whenever the model, the metals, the stones or the lighting change:
//
//   npm run dev                                  (in another terminal; /lab is dev-only)
//   npm run option-pictures [-- http://localhost:5173]
//
// CHROMIUM_PATH: a Chromium to use when Playwright's own download isn't installed.
// Software rendering is fine (the stones are traced in a shader that runs on it).
import { mkdirSync } from 'node:fs';
import { chromium } from 'playwright';
import sharp from 'sharp';

const base = process.argv[2] ?? 'http://localhost:5173';
const out = new URL('../../public/assets/options/grillz/', import.meta.url).pathname;
const SIZE = 480;
/** The card's backdrop: a soft studio grey the white mould stands out from. */
const BACKDROP = '#d9d4cc';

const row = (count, offset = 0) => Array.from({ length: count }, (_, i) => offset + Math.floor((16 - count) / 2) + i);
const SIX = [...row(6), ...row(6, 16)];
const TOP_SIX = row(6);
const FRONT = [7, 8];
const tooth = (patch = {}) => ({ metal: 'yellow', karat: '14k', type: 'plain', style: 'solid', setting: 'honeycomb', stone: 'moissanite', ...patch });
const spec = (teeth, patch = {}, set = {}) => ({ fangs: false, cut: 'deep', vision: '', inscriptions: [], ...set, teeth: teeth.map((index) => ({ index, ...tooth(patch) })) });

// Angles: a little from the side and above, as a jeweler shoots a set.
const SET_VIEW = { azimuth: 0.32, polar: 1.45, fill: 0.74 };
const ROW_VIEW = { azimuth: 0.3, polar: 1.48, fill: 0.86 };
// Stones and settings differ stone by stone: tight on the two front teeth.
const STONE_VIEW = { azimuth: 0.18, polar: 1.5, fill: 0.98 };

const shots = [
  ...['yellow', 'white', 'rose', 'silver', 'platinum'].map((metal) => ({ file: `metal-${metal}`, spec: spec(SIX, { metal }), frame: SIX, view: SET_VIEW })),
  { file: 'type-plain', spec: spec(SIX), frame: SIX, view: SET_VIEW },
  { file: 'type-iced', spec: spec(SIX, { type: 'iced' }), frame: SIX, view: SET_VIEW },
  { file: 'type-photo', spec: { ...spec(SIX), teeth: SIX.map((index) => ({ index, ...tooth(FRONT.includes(index) ? { type: 'photo' } : {}) })) }, frame: TOP_SIX, view: ROW_VIEW },
  // Opals in blue: white opal reads as bare tooth at card size.
  ...['solid', 'open-face', 'diamond-cut', 'diamond-dust', 'engraving', 'opals'].map((style) => ({ file: `style-${style}`, spec: spec(SIX, style === 'opals' ? { style, opal: 'blue' } : { style }), frame: TOP_SIX, view: ROW_VIEW })),
  ...['honeycomb', 'mosaic', 'prong'].map((setting) => ({ file: `setting-${setting}`, spec: spec(SIX, { type: 'iced', setting }), frame: FRONT, view: STONE_VIEW })),
  // Lab and natural diamonds look alike in 3D; moissanite throws more colour.
  ...['moissanite', 'lab', 'natural'].map((stone) => ({ file: `stone-${stone}`, spec: spec(SIX, { type: 'iced', metal: 'white', stone }), frame: FRONT, view: STONE_VIEW })),
  { file: 'fangs-no', spec: spec(TOP_SIX), frame: TOP_SIX, view: { azimuth: 0.45, polar: 1.5, fill: 0.9 } },
  { file: 'fangs-yes', spec: spec(TOP_SIX, {}, { fangs: true }), frame: TOP_SIX, view: { azimuth: 0.45, polar: 1.5, fill: 0.9 } },
  { file: 'cut-deep', spec: spec(SIX), frame: TOP_SIX, view: ROW_VIEW },
  { file: 'cut-permanent', spec: spec(SIX, {}, { cut: 'permanent' }), frame: TOP_SIX, view: ROW_VIEW },
  // The starting looks on the first step (src/lib/startingLooks.ts), as the demo shop offers them.
  ...[
    ['gold', SIX],
    ['iced', SIX],
    ['open-face', SIX],
    ['iced-fangs', TOP_SIX],
    ['two-tone', SIX],
  ].map(([id, frame]) => ({ file: `look-${id}`, look: id, frame, view: SET_VIEW })),
];

const only = process.env.ONLY ? new RegExp(process.env.ONLY) : null;
mkdirSync(out, { recursive: true });
const browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH || undefined, args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
// Reduced motion: no opening swing. Drawn at the canvas's top pixel ratio and scaled down, for crisp edges.
const context = await browser.newContext({ viewport: { width: SIZE, height: SIZE }, deviceScaleFactor: 2, reducedMotion: 'reduce' });
for (const shot of shots) {
  if (only && !only.test(shot.file)) continue;
  const page = await context.newPage();
  const query = shot.look ? `look=${shot.look}` : `spec=${encodeURIComponent(JSON.stringify(shot.spec))}`;
  await page.goto(`${base}/lab?${query}`, { waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() => window.__lab?.ready);
  // The model, its stones and any letters or pictures settle over a few frames.
  await page.waitForTimeout(3500);
  const png = await page.evaluate(({ frame, view }) => window.__lab.shot(frame, view), { frame: shot.frame, view: shot.view });
  const info = await sharp(Buffer.from(png.split(',')[1], 'base64'))
    .resize(SIZE, SIZE)
    .flatten({ background: BACKDROP })
    // Close-ups of stones are busy: a little more compression keeps them under 25 KB.
    .webp({ quality: /^setting-/.test(shot.file) ? 44 : /^stone-/.test(shot.file) ? 58 : 74, effort: 6 })
    .toFile(`${out}${shot.file}.webp`);
  console.log(`${shot.file}.webp ${info.width}x${info.height} ${Math.round(info.size / 1024)} KB`);
  await page.close();
}
await browser.close();
