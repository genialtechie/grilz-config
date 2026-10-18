// Mascot round 2: the fang, made to read as a tooth. Every variant is a fang
// with Classic's squared crown on top (the craftsman) and a point below (the
// swagger), standing on detached feet. Silhouettes first, with the 40px shrink
// test, then a rough colour + face sketch of the recommended one.
//   npx tsx scripts/mascot-round2.ts
// Writes docs/brand/mascot/round-2-fang.png and round-2-sketch.png (+ .svg).

import { mkdirSync, writeFileSync } from 'node:fs';
import sharp from 'sharp';

const OUT = 'docs/brand/mascot';
const INK = '#1b1714';
const GOLD = `<stop offset="0" stop-color="#f8de98"/><stop offset=".55" stop-color="#d9ad4b"/><stop offset="1" stop-color="#a87b23"/>`;

// Body outlines in a 200×200 box; feet are separate so the body can pose.
const feet = (y = 172, spread = 44) => `<ellipse cx="${100 - spread}" cy="${y}" rx="17" ry="11"/><ellipse cx="${100 + spread}" cy="${y}" rx="17" ry="11"/>`;

type Variant = { name: string; idea: string; body: string; extra?: string };

const variants: Variant[] = [
  {
    name: 'Crown fang',
    idea: 'Square crown, clean point',
    body: 'M50 52Q50 22 82 22L118 22Q150 22 150 52L148 104Q146 136 122 158L100 184L78 158Q54 136 52 104Z',
    extra: feet(),
  },
  {
    name: 'Short fang',
    idea: 'Wider, short tip: friendliest',
    body: 'M42 56Q42 24 76 24L124 24Q158 24 158 56L156 112Q154 140 128 154L100 172L72 154Q46 140 44 112Z',
    extra: feet(176, 50),
  },
  {
    name: 'Long fang',
    idea: 'Narrow, long tip: most edge',
    body: 'M58 46Q58 18 86 18L114 18Q142 18 142 46L140 96Q138 128 120 150L100 190L80 150Q62 128 60 96Z',
    extra: feet(170, 42),
  },
  {
    name: 'Cusp fang',
    idea: 'Classic notch on top: reads "tooth"',
    body: 'M48 58Q48 24 78 26Q100 38 122 26Q152 24 152 58L150 106Q148 138 124 158L100 184L76 158Q52 138 50 106Z',
    extra: feet(),
  },
  {
    name: 'Hook fang',
    idea: 'Tip curves: a real canine, in motion',
    body: 'M50 52Q50 22 82 22L118 22Q150 22 150 52L150 106Q150 140 136 162Q126 180 104 188Q112 172 104 160Q76 140 56 120Q50 108 50 96Z',
    extra: feet(174, 46),
  },
  {
    name: 'Root fang',
    idea: 'Classic tooth; one root is the fang',
    body: 'M46 60Q46 26 78 28Q100 40 122 28Q154 26 154 60Q154 98 142 120L130 186Q126 196 118 188L106 142Q100 132 94 142L84 172Q80 182 72 176L60 120Q46 98 46 60Z',
  },
];

const COLS = 3;
const CELL_W = 340;
const CELL_H = 360;
const W = COLS * CELL_W;
const H = Math.ceil(variants.length / COLS) * CELL_H + 70;

const shape = (v: Variant) => `<path d="${v.body}"/>${v.extra ?? ''}`;

const cells = variants
  .map((v, index) => {
    const x = (index % COLS) * CELL_W;
    const y = 70 + Math.floor(index / COLS) * CELL_H;
    return `<g transform="translate(${x} ${y})">
<rect x="10" y="10" width="${CELL_W - 20}" height="${CELL_H - 20}" rx="18" fill="#ffffff" stroke="#e7ddcd" stroke-width="2"/>
<g transform="translate(60 24) scale(1.1)" fill="${INK}">${shape(v)}</g>
<g transform="translate(${CELL_W - 72} 32) scale(0.2)" fill="${INK}">${shape(v)}</g>
<text x="30" y="${CELL_H - 60}" font-family="Inter" font-size="20" font-weight="700" fill="${INK}">${String.fromCharCode(65 + index)}. ${v.name}</text>
<text x="30" y="${CELL_H - 34}" font-family="Inter" font-size="15" fill="#6f655a">${v.idea}</text>
</g>`;
  })
  .join('\n');

const sheet = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} ${H}" width="${W}" height="${H}">
<rect width="${W}" height="${H}" fill="#fbf7f0"/>
<text x="30" y="46" font-family="Inter" font-size="24" font-weight="700" fill="${INK}">VVS Lab mascot · round 2: the fang (small copy = 40px)</text>
${cells}
</svg>`;

/** A rough look at where the recommended shape goes: gold body, ink outline, face, one iced stone. Not final. */
function sketch(v: Variant, x: number, label: string) {
  return `<g transform="translate(${x} 40)">
<g transform="translate(20 20) scale(1.6)">
  <ellipse cx="100" cy="196" rx="70" ry="6" fill="#e7ddcd"/>
  <g fill="url(#gold)" stroke="${INK}" stroke-width="5" stroke-linejoin="round">${shape(v)}</g>
  <path d="M66 48Q66 36 76 34" fill="none" stroke="#fff6d8" stroke-width="6" stroke-linecap="round" opacity=".8"/>
  <ellipse cx="80" cy="82" rx="10" ry="14" fill="${INK}"/><ellipse cx="120" cy="82" rx="10" ry="14" fill="${INK}"/>
  <circle cx="83" cy="77" r="3.5" fill="#fff"/><circle cx="123" cy="77" r="3.5" fill="#fff"/>
  <path d="M74 112Q100 134 126 112Z" fill="#2a1511" stroke="${INK}" stroke-width="4" stroke-linejoin="round"/>
  <path d="M82 114L86 121L91 116L96 123L100 117L104 123L109 116L114 121L118 114Z" fill="url(#gold)" stroke="${INK}" stroke-width="1.5" stroke-linejoin="round"/>
  <g transform="translate(134 40) rotate(20)"><path d="M-9 -4L-4 -9L4 -9L9 -4L0 8Z" fill="#eef4f8" stroke="${INK}" stroke-width="2.5" stroke-linejoin="round"/></g>
</g>
<text x="40" y="380" font-family="Inter" font-size="18" font-weight="700" fill="${INK}">${label}</text>
</g>`;
}

const sketchSheet = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1410 440" width="1410" height="440">
<defs><linearGradient id="gold" x1="0" y1="0" x2="0" y2="1">${GOLD}</linearGradient></defs>
<rect width="1410" height="440" fill="#fbf7f0"/>
<text x="30" y="40" font-family="Inter" font-size="22" font-weight="700" fill="${INK}">Rough sketch, not final: gold body, ink outline, big eyes, a gold-grill grin, one iced stone</text>
${sketch(variants[5], 0, 'F. Root fang (recommended)')}
${sketch(variants[3], 350, 'D. Cusp fang')}
${sketch(variants[0], 700, 'A. Crown fang')}
${sketch(variants[4], 1050, 'E. Hook fang')}
</svg>`;

async function main() {
  mkdirSync(OUT, { recursive: true });
  writeFileSync(`${OUT}/round-2-fang.svg`, sheet);
  await sharp(Buffer.from(sheet)).png({ compressionLevel: 9 }).toFile(`${OUT}/round-2-fang.png`);
  writeFileSync(`${OUT}/round-2-sketch.svg`, sketchSheet);
  await sharp(Buffer.from(sketchSheet)).png({ compressionLevel: 9 }).toFile(`${OUT}/round-2-sketch.png`);
  console.log('written', OUT);
}

void main();
