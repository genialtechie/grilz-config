// Mascot round 3: the face, on the chosen body (F, Root fang). The grin wears
// obvious gold fangs, like the hero image, and one iced-out tooth; eyes and brows carry the
// personality. Each face is shown large and at 64px (avatar size).
//   npx tsx scripts/mascot-round3.ts
// Writes docs/brand/mascot/round-3-faces.png (+ .svg) and a close-up of the grin.

import { mkdirSync, writeFileSync } from 'node:fs';
import sharp from 'sharp';

const OUT = 'docs/brand/mascot';
const INK = '#1b1714';
const GOLD = `<stop offset="0" stop-color="#f8de98"/><stop offset=".55" stop-color="#d9ad4b"/><stop offset="1" stop-color="#a87b23"/>`;
const BODY = 'M46 60Q46 26 78 28Q100 40 122 28Q154 26 154 60Q154 98 142 120L130 186Q126 196 118 188L106 142Q100 132 94 142L84 172Q80 182 72 176L60 120Q46 98 46 60Z';

type Eye = 'round' | 'lidded' | 'wink' | 'happy';
type Face = {
  name: string;
  idea: string;
  eyes: [Eye, Eye];
  /** Brow strokes as [x1, y1, x2, y2], or none. */
  brows?: [number, number, number, number][];
  /** Mouth: top edge height, how far it opens, and a tilt in degrees (a smirk). */
  mouth: { y: number; open: number; tilt?: number };
};

function eye(kind: Eye, x: number, y: number) {
  switch (kind) {
    case 'round':
      return `<ellipse cx="${x}" cy="${y}" rx="9" ry="13" fill="${INK}"/><circle cx="${x + 3}" cy="${y - 5}" r="3.4" fill="#fff"/>`;
    case 'lidded':
      // Heavy lid: only the lower half shows. Confident, unbothered.
      return `<path d="M${x - 10} ${y - 1}A10 12 0 0 0 ${x + 10} ${y - 1}Z" fill="${INK}"/><path d="M${x - 13} ${y - 2}L${x + 12} ${y - 4}" stroke="${INK}" stroke-width="5" stroke-linecap="round"/><circle cx="${x + 3}" cy="${y + 3}" r="2.6" fill="#fff"/>`;
    case 'wink':
      return `<path d="M${x - 11} ${y + 1}Q${x} ${y - 9} ${x + 11} ${y + 1}" fill="none" stroke="${INK}" stroke-width="5" stroke-linecap="round"/>`;
    case 'happy':
      return `<path d="M${x - 11} ${y + 3}Q${x} ${y - 11} ${x + 11} ${y + 3}" fill="none" stroke="${INK}" stroke-width="5.5" stroke-linecap="round"/>`;
  }
}

/**
 * The grill, built like the hero image: separate gold caps with rounded tips
 * hanging from the upper lip, long tapered fangs on the canines, the centre
 * tooth iced out (white, with a pavé of stones), natural white teeth below.
 */
function grin(face: Face, id: string) {
  const { y, open, tilt = 0 } = face.mouth;
  // A wide, square-cornered open mouth so the fangs at the ends have room.
  const m0 = 57;
  const m1 = 143;
  const mouth = `M${m0} ${y}L${m1} ${y}C${m1} ${y + open * 0.95} ${m1 - 14} ${y + open} 100 ${y + open}C${m0 + 14} ${y + open} ${m0} ${y + open * 0.95} ${m0} ${y}Z`;
  const x0 = m0 + 5;
  const x1 = m1 - 5;
  const gap = 1;
  // Fang, lateral, central (iced), central, lateral, fang.
  const widths = [12, 12, 15, 15, 12, 12];
  const scale = (x1 - x0 - gap * (widths.length - 1)) / widths.reduce((sum, w) => sum + w, 0);
  let cursor = x0;
  const teeth = widths.map((raw, index) => {
    const w = raw * scale;
    const x = cursor;
    cursor += w + gap;
    const outline = `stroke="${INK}" stroke-width="1.6" stroke-linejoin="round"`;
    if (index === 0 || index === widths.length - 1) {
      const length = open * 0.78;
      const tip = x + w * (index === 0 ? 0.6 : 0.4);
      return `<path d="M${x} ${y}L${x + w} ${y}C${x + w} ${y + length * 0.45} ${tip + 2} ${y + length * 0.8} ${tip} ${y + length}C${tip - 2} ${y + length * 0.8} ${x} ${y + length * 0.45} ${x} ${y}Z" fill="url(#gold)" ${outline}/><path d="M${x + 2.5} ${y + 3}L${x + 3.5} ${y + length * 0.4}" stroke="#fff6d8" stroke-width="1.8" stroke-linecap="round" opacity=".9"/>`;
    }
    const h = open * (index === 2 || index === 3 ? 0.46 : 0.38);
    const r = Math.min(4, w / 3);
    const cap = `M${x} ${y}L${x + w} ${y}L${x + w} ${y + h - r}Q${x + w} ${y + h} ${x + w - r} ${y + h}L${x + r} ${y + h}Q${x} ${y + h} ${x} ${y + h - r}Z`;
    if (index === 2) {
      // Pavé: a tight grid of small stones, each with a glint.
      const stones = [0.22, 0.5, 0.78].flatMap((u) => [0.16, 0.38, 0.6, 0.82].map((v) => `<circle cx="${x + w * u}" cy="${y + h * v}" r="${w * 0.11}" fill="#ffffff" stroke="#9aa6b2" stroke-width=".5"/><circle cx="${x + w * u - w * 0.03}" cy="${y + h * v - w * 0.03}" r="${w * 0.035}" fill="#d6e6f2"/>`));
      return `<path d="${cap}" fill="#cfd9e2" ${outline}/>${stones.join('')}`;
    }
    return `<path d="${cap}" fill="url(#gold)" ${outline}/><path d="M${x + 2.5} ${y + 3}L${x + 2.5} ${y + h * 0.6}" stroke="#fff6d8" stroke-width="1.8" stroke-linecap="round" opacity=".9"/>`;
  });
  const lower = [0, 1, 2, 3]
    .map((i) => {
      const w = 9.5;
      const x = 100 - 2 * (w + 1) + i * (w + 1);
      const h = open * 0.26;
      const top = y + open * 0.92 - h;
      return `<path d="M${x} ${top + 3}Q${x} ${top} ${x + 3} ${top}L${x + w - 3} ${top}Q${x + w} ${top} ${x + w} ${top + 3}L${x + w} ${top + h + 4}L${x} ${top + h + 4}Z" fill="#fbf7f0" stroke="${INK}" stroke-width="1.5"/>`;
    })
    .join('');
  return `<g transform="rotate(${tilt} 100 ${y})">
<clipPath id="m${id}"><path d="${mouth}"/></clipPath>
<path d="${mouth}" fill="#2a1511"/>
<g clip-path="url(#m${id})">${lower}${teeth.join('')}</g>
<path d="${mouth}" fill="none" stroke="${INK}" stroke-width="4" stroke-linejoin="round"/>
</g>`;
}

function character(face: Face, id: string) {
  const brows = (face.brows ?? []).map(([x1, y1, x2, y2]) => `<path d="M${x1} ${y1}L${x2} ${y2}" stroke="${INK}" stroke-width="6" stroke-linecap="round"/>`).join('');
  return `<ellipse cx="100" cy="194" rx="62" ry="5" fill="#e7ddcd"/>
<path d="${BODY}" fill="url(#gold)" stroke="${INK}" stroke-width="5" stroke-linejoin="round"/>
<path d="M62 52Q62 40 72 37" fill="none" stroke="#fff6d8" stroke-width="6" stroke-linecap="round" opacity=".8"/>
<g transform="translate(136 42) rotate(20)"><path d="M-9 -4L-4 -9L4 -9L9 -4L0 8Z" fill="#eef4f8" stroke="${INK}" stroke-width="2.5" stroke-linejoin="round"/></g>
${eye(face.eyes[0], 80, 64)}${eye(face.eyes[1], 120, 64)}${brows}${grin(face, id)}`;
}

const faces: Face[] = [
  { name: 'Grin', idea: 'Friendly default: open grin, two fangs', eyes: ['round', 'round'], mouth: { y: 88, open: 40 } },
  {
    name: 'Smirk',
    idea: 'One side up, one brow: confident',
    eyes: ['round', 'round'],
    brows: [[70, 46, 88, 48], [112, 44, 130, 38]],
    mouth: { y: 89, open: 36, tilt: -6 },
  },
  {
    name: 'Cool',
    idea: 'Heavy lids, slow grin: flashy, unbothered',
    eyes: ['lidded', 'lidded'],
    mouth: { y: 89, open: 34 },
  },
  { name: 'Wink', idea: 'A wink as the signature (like Freddie)', eyes: ['round', 'wink'], mouth: { y: 88, open: 40, tilt: -3 } },
  { name: 'Hype', idea: 'Eyes shut, big laugh: celebrating', eyes: ['happy', 'happy'], mouth: { y: 86, open: 50 } },
  {
    name: 'Boss',
    idea: 'Low brows, wide grin: the craftsman',
    eyes: ['round', 'round'],
    brows: [[68, 48, 90, 54], [110, 54, 132, 48]],
    mouth: { y: 90, open: 34 },
  },
];

const COLS = 3;
const CELL_W = 360;
const CELL_H = 420;
const W = COLS * CELL_W;
const H = Math.ceil(faces.length / COLS) * CELL_H + 70;

const cells = faces
  .map((face, index) => {
    const x = (index % COLS) * CELL_W;
    const y = 70 + Math.floor(index / COLS) * CELL_H;
    return `<g transform="translate(${x} ${y})">
<rect x="10" y="10" width="${CELL_W - 20}" height="${CELL_H - 20}" rx="18" fill="#ffffff" stroke="#e7ddcd" stroke-width="2"/>
<g transform="translate(30 22) scale(1.5)">${character(face, `a${index}`)}</g>
<g transform="translate(${CELL_W - 92} 30) scale(0.32)">${character(face, `b${index}`)}</g>
<text x="30" y="${CELL_H - 60}" font-family="Inter" font-size="20" font-weight="700" fill="${INK}">${index + 1}. ${face.name}</text>
<text x="30" y="${CELL_H - 34}" font-family="Inter" font-size="15" fill="#6f655a">${face.idea}</text>
</g>`;
  })
  .join('\n');

const sheet = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} ${H}" width="${W}" height="${H}">
<defs><linearGradient id="gold" x1="0" y1="0" x2="0" y2="1">${GOLD}</linearGradient></defs>
<rect width="${W}" height="${H}" fill="#fbf7f0"/>
<text x="30" y="46" font-family="Inter" font-size="24" font-weight="700" fill="${INK}">VVS Lab mascot · round 3: faces on F, gold fangs + an iced-out tooth (small copy = 64px)</text>
${cells}
</svg>`;

/** The grin up close, to judge the teeth themselves. */
const closeup = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="52 76 96 64" width="960" height="640">
<defs><linearGradient id="gold" x1="0" y1="0" x2="0" y2="1">${GOLD}</linearGradient></defs>
<rect x="52" y="76" width="96" height="64" fill="#d9ad4b"/>${grin(faces[0], 'close')}</svg>`;

async function main() {
  mkdirSync(OUT, { recursive: true });
  writeFileSync(`${OUT}/round-3-faces.svg`, sheet);
  await sharp(Buffer.from(sheet)).png({ compressionLevel: 9 }).toFile(`${OUT}/round-3-faces.png`);
  await sharp(Buffer.from(closeup)).png({ compressionLevel: 9 }).toFile(`${OUT}/round-3-grin-closeup.png`);
  console.log('written', OUT);
}

void main();
