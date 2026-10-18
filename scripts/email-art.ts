// Generates the email artwork into public/assets/email/ (SVG source + PNG for
// mail clients, which don't show SVG). Re-run after changing the drawing:
//   npx tsx scripts/email-art.ts
// House style: flat shapes, warm gold gradients, ink outlines, sparkles.

import { mkdirSync, writeFileSync } from 'node:fs';
import sharp from 'sharp';

const OUT = 'public/assets/email';
const INK = '#1b1714';
const GOLD_STOPS = `<stop offset="0" stop-color="#f8de98"/><stop offset=".55" stop-color="#d9ad4b"/><stop offset="1" stop-color="#a87b23"/>`;

type Point = [number, number];
const bezier = (p: Point[], t: number): Point => {
  const u = 1 - t;
  const x = u * u * u * p[0][0] + 3 * u * u * t * p[1][0] + 3 * u * t * t * p[2][0] + t * t * t * p[3][0];
  const y = u * u * u * p[0][1] + 3 * u * u * t * p[1][1] + 3 * u * t * t * p[2][1] + t * t * t * p[3][1];
  return [x, y];
};
const curve = (p: Point[]) => `M${p[0]} C${p[1]} ${p[2]} ${p[3]}`;
const n = (value: number) => Math.round(value * 10) / 10;

const sparkle = (cx: number, cy: number, r: number, fill: string, stroke = INK, width = 5) =>
  `<path d="M${cx} ${cy - r}Q${cx} ${cy} ${cx + r} ${cy}Q${cx} ${cy} ${cx} ${cy + r}Q${cx} ${cy} ${cx - r} ${cy}Q${cx} ${cy} ${cx} ${cy - r}Z" fill="${fill}" stroke="${stroke}" stroke-width="${width}" stroke-linejoin="round"/>`;

/** A tooth hanging from (x, top) when `down`, or standing on (x, bottom) otherwise. */
function tooth(x: number, anchor: number, width: number, height: number, down: boolean, iced: boolean) {
  const r = Math.min(16, width / 2.4);
  const half = width / 2;
  const [y0, y1] = down ? [anchor - 8, anchor + height] : [anchor + 8, anchor - height];
  const dir = down ? 1 : -1;
  const path = `M${n(x - half)} ${n(y0)}L${n(x + half)} ${n(y0)}L${n(x + half)} ${n(y1 - dir * r)}Q${n(x + half)} ${n(y1)} ${n(x + half - r)} ${n(y1)}L${n(x - half + r)} ${n(y1)}Q${n(x - half)} ${n(y1)} ${n(x - half)} ${n(y1 - dir * r)}Z`;
  const fill = iced ? '#eef1f4' : 'url(#gold)';
  let out = `<path d="${path}" fill="${fill}" stroke="${INK}" stroke-width="5" stroke-linejoin="round"/>`;
  if (iced) {
    // Pavé: a small grid of stones.
    const top = Math.min(y0, y1) + 14;
    const rows = Math.max(2, Math.floor((Math.abs(y1 - y0) - 22) / 17));
    for (let row = 0; row < rows; row += 1) {
      for (const dx of [-0.24, 0.24]) {
        out += `<circle cx="${n(x + dx * width)}" cy="${n(top + row * 17)}" r="6" fill="#ffffff" stroke="#9aa4ae" stroke-width="2"/>`;
      }
    }
  } else {
    // A highlight so the gold reads as polished metal.
    const hy = down ? y0 + 14 : y1 + 10;
    out += `<rect x="${n(x - half + 7)}" y="${n(hy)}" width="${n(Math.max(6, width * 0.16))}" height="${n(Math.abs(y1 - y0) * 0.45)}" rx="4" fill="#fff6d8" opacity=".75"/>`;
  }
  return out;
}

/** y on a left-to-right curve at a given x (the curve's x only grows). */
const yAt = (p: Point[], x: number) => {
  let lo = 0;
  let hi = 1;
  for (let i = 0; i < 40; i += 1) {
    const mid = (lo + hi) / 2;
    if (bezier(p, mid)[0] < x) lo = mid;
    else hi = mid;
  }
  return bezier(p, (lo + hi) / 2)[1];
};

function welcomeIllustration() {
  const W = 1200;
  const H = 640;
  const upperInner: Point[] = [[364, 300], [452, 222], [748, 222], [836, 300]];
  const lowerInner: Point[] = [[364, 300], [440, 452], [760, 452], [836, 300]];
  const mouth = `${curve(upperInner)}${curve([...lowerInner].reverse() as Point[]).replace('M', 'L')}Z`;
  let teeth = '';
  // Top row: eight teeth, evenly spaced, longest in the middle; two are iced.
  const upperLeft = 388;
  const upperSlot = (812 - upperLeft) / 8;
  for (let i = 0; i < 8; i += 1) {
    const x = upperLeft + upperSlot * (i + 0.5);
    const centre = 1 - Math.abs(x - 600) / 230;
    teeth += tooth(x, yAt(upperInner, x), upperSlot - 7, 46 + 40 * Math.max(0, centre), true, i === 2 || i === 5);
  }
  // Bottom row: six shorter teeth.
  const lowerLeft = 444;
  const lowerSlot = (756 - lowerLeft) / 6;
  for (let i = 0; i < 6; i += 1) {
    const x = lowerLeft + lowerSlot * (i + 0.5);
    const centre = 1 - Math.abs(x - 600) / 200;
    teeth += tooth(x, yAt(lowerInner, x), lowerSlot - 7, 34 + 22 * Math.max(0, centre), false, false);
  }
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} ${H}" width="${W}" height="${H}">
<defs><linearGradient id="gold" x1="0" y1="0" x2="0" y2="1">${GOLD_STOPS}</linearGradient><clipPath id="mouth"><path d="${mouth}"/></clipPath></defs>
<circle cx="600" cy="320" r="272" fill="#f3e6c8"/>
<circle cx="600" cy="320" r="302" fill="none" stroke="#e8d6ac" stroke-width="3" stroke-dasharray="2 14" stroke-linecap="round"/>
<path d="M300 296C396 160 804 160 900 296C836 520 364 520 300 296Z" fill="#9c4a3f" stroke="${INK}" stroke-width="7" stroke-linejoin="round"/>
<path d="${mouth}" fill="#2a1511"/>
<g clip-path="url(#mouth)">${teeth}</g>
<path d="${mouth}" fill="none" stroke="${INK}" stroke-width="7" stroke-linejoin="round"/>
<path d="M336 292C316 280 302 282 288 296M864 292C884 280 898 282 912 296" fill="none" stroke="${INK}" stroke-width="7" stroke-linecap="round"/>
<path d="M468 206C516 192 558 190 598 192" fill="none" stroke="#c9776a" stroke-width="8" stroke-linecap="round" opacity=".85"/>
${sparkle(250, 176, 42, 'url(#gold)')}
${sparkle(966, 160, 32, 'url(#gold)')}
${sparkle(1010, 436, 22, '#ffffff')}
${sparkle(196, 446, 18, '#ffffff')}
${sparkle(640, 96, 14, INK, INK, 2)}
<circle cx="926" cy="248" r="7" fill="${INK}"/><circle cx="284" cy="380" r="6" fill="${INK}"/><circle cx="770" cy="560" r="5" fill="#d9ad4b"/>
</svg>`;
}

const instagramIcon = (color: string) => `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 48 48" width="48" height="48">
<rect x="7" y="7" width="34" height="34" rx="10" fill="none" stroke="${color}" stroke-width="3.5"/>
<circle cx="24" cy="24" r="8" fill="none" stroke="${color}" stroke-width="3.5"/><circle cx="34" cy="14" r="2.4" fill="${color}"/></svg>`;

async function main() {
  mkdirSync(OUT, { recursive: true });
  const welcome = welcomeIllustration();
  writeFileSync(`${OUT}/welcome.svg`, welcome);
  await sharp(Buffer.from(welcome)).resize(960).png({ compressionLevel: 9, palette: true, quality: 90 }).toFile(`${OUT}/welcome.png`);
  for (const [name, color] of [['instagram-light', '#d9c9a6'], ['instagram-dark', '#6f655a']] as const) {
    await sharp(Buffer.from(instagramIcon(color))).resize(48).png().toFile(`${OUT}/${name}.png`);
  }
  // The gold mark at 2x its email size (48px tall), so it's light to load.
  await sharp('public/assets/vvs/logo-mark.png').resize({ height: 96 }).png({ compressionLevel: 9, palette: true, quality: 90 }).toFile(`${OUT}/vvs-mark.png`);
  console.log('email art written to', OUT);
}

void main();
