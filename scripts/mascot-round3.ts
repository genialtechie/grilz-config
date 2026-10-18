// Mascot round 3: the face, on the chosen body (F, Root fang). The grin wears
// obvious gold fangs, like the hero image, and one iced-out tooth; eyes and brows carry the
// personality. Each face is shown large and at 64px (avatar size).
//   npx tsx scripts/mascot-round3.ts
// Writes docs/brand/mascot/round-3-faces.png (+ .svg).

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
  /** Mouth: top-left and top-right corners of the grin, and how deep it opens. */
  mouth: { l: [number, number]; r: [number, number]; depth: number };
  /** Fang length. */
  fang: number;
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

function grin(face: Face, id: string) {
  const { l, r, depth } = face.mouth;
  const mid: [number, number] = [(l[0] + r[0]) / 2, (l[1] + r[1]) / 2];
  const mouth = `M${l[0]} ${l[1]}L${r[0]} ${r[1]}Q${mid[0] + 6} ${mid[1] + depth * 1.6} ${l[0]} ${l[1]}Z`;
  const at = (t: number): [number, number] => [l[0] + (r[0] - l[0]) * t, l[1] + (r[1] - l[1]) * t];
  // A gold grill row along the top of the mouth, and two long fang caps.
  const row = `M${l[0]} ${l[1] - 2}L${r[0]} ${r[1] - 2}L${r[0]} ${r[1] + 14}L${l[0]} ${l[1] + 14}Z`;
  // One tooth in the row is iced out: white with a pavé of stones.
  const iced = (a: [number, number], b: [number, number]) => {
    const stones = [0.25, 0.75].flatMap((u) => [2.5, 7, 11.5].map((dy) => `<circle cx="${a[0] + (b[0] - a[0]) * u}" cy="${a[1] + (b[1] - a[1]) * u + dy}" r="2.3" fill="#ffffff" stroke="#8d99a6" stroke-width=".8"/>`));
    return `<path d="M${a[0]} ${a[1] - 2}L${b[0]} ${b[1] - 2}L${b[0]} ${b[1] + 14}L${a[0]} ${a[1] + 14}Z" fill="#e3eaf0"/>${stones.join('')}`;
  };
  const fang = (t: number) => {
    const [x, y] = at(t);
    return `<path d="M${x - 8} ${y + 4}L${x + 8} ${y + 4}L${x + 1.5} ${y + 4 + face.fang}Q${x} ${y + 7 + face.fang} ${x - 1.5} ${y + 4 + face.fang}Z" fill="url(#gold)" stroke="${INK}" stroke-width="2.5" stroke-linejoin="round"/>`;
  };
  return `<clipPath id="m${id}"><path d="${mouth}"/></clipPath>
<path d="${mouth}" fill="#2a1511"/>
<g clip-path="url(#m${id})"><path d="${row}" fill="url(#gold)"/>${iced(at(0.4), at(0.6))}${[0.32, 0.4, 0.6, 0.68].map((t) => `<path d="M${at(t)[0]} ${at(t)[1] - 2}l0 16" stroke="#a87b23" stroke-width="1.5"/>`).join('')}</g>
<g clip-path="url(#m${id})">${fang(0.25)}${fang(0.75)}</g>
<path d="${mouth}" fill="none" stroke="${INK}" stroke-width="4" stroke-linejoin="round"/>`;
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
  { name: 'Grin', idea: 'Friendly default: open grin, two fangs', eyes: ['round', 'round'], mouth: { l: [68, 90], r: [132, 90], depth: 30 }, fang: 24 },
  {
    name: 'Smirk',
    idea: 'One side up, one brow: confident',
    eyes: ['round', 'round'],
    brows: [[70, 46, 88, 48], [112, 44, 130, 38]],
    mouth: { l: [70, 94], r: [132, 86], depth: 26 },
    fang: 22,
  },
  {
    name: 'Cool',
    idea: 'Heavy lids, slow grin: flashy, unbothered',
    eyes: ['lidded', 'lidded'],
    mouth: { l: [68, 90], r: [132, 90], depth: 26 },
    fang: 22,
  },
  { name: 'Wink', idea: 'A wink as the signature (like Freddie)', eyes: ['round', 'wink'], mouth: { l: [68, 91], r: [132, 88], depth: 30 }, fang: 24 },
  { name: 'Hype', idea: 'Eyes shut, big laugh: celebrating', eyes: ['happy', 'happy'], mouth: { l: [64, 88], r: [136, 88], depth: 40 }, fang: 28 },
  {
    name: 'Boss',
    idea: 'Low brows, wide grin: the craftsman',
    eyes: ['round', 'round'],
    brows: [[68, 48, 90, 54], [110, 54, 132, 48]],
    mouth: { l: [66, 92], r: [134, 92], depth: 24 },
    fang: 22,
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

async function main() {
  mkdirSync(OUT, { recursive: true });
  writeFileSync(`${OUT}/round-3-faces.svg`, sheet);
  await sharp(Buffer.from(sheet)).png({ compressionLevel: 9 }).toFile(`${OUT}/round-3-faces.png`);
  console.log('written', OUT);
}

void main();
