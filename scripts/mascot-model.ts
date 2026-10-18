// The VVS Lab mascot, round 4: the polished model and its expressions.
// Body F (Root fang), resting face Cool, Hype for wins. Everything is built
// from one set of parts so every expression stays on-model.
//   npx tsx scripts/mascot-model.ts
// Writes docs/brand/mascot/round-4-expressions.png, round-4-on-dark.png and
// round-4-sizes.png (+ .svg).

import { mkdirSync, writeFileSync } from 'node:fs';
import sharp from 'sharp';

const OUT = 'docs/brand/mascot';
const INK = '#1b1714';
const CREAM = '#fbf7f0';
const BODY = 'M46 60Q46 26 78 28Q100 40 122 28Q154 26 154 60Q154 98 142 120L130 186Q126 196 118 188L106 142Q100 132 94 142L84 172Q80 182 72 176L60 120Q46 98 46 60Z';

const defs = `<defs>
<linearGradient id="gold" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#fbe7ab"/><stop offset=".35" stop-color="#ebc464"/><stop offset=".7" stop-color="#d1a03f"/><stop offset="1" stop-color="#a37624"/></linearGradient>
<linearGradient id="shade" x1="0" y1="0" x2="1" y2="0"><stop offset=".55" stop-color="#7a5414" stop-opacity="0"/><stop offset="1" stop-color="#7a5414" stop-opacity=".35"/></linearGradient>
<linearGradient id="dull" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#d9d2bf"/><stop offset=".6" stop-color="#b3a684"/><stop offset="1" stop-color="#8c7f60"/></linearGradient>
<filter id="sticker" x="-15%" y="-15%" width="130%" height="130%"><feMorphology in="SourceAlpha" operator="dilate" radius="7" result="grown"/><feFlood flood-color="${CREAM}"/><feComposite in2="grown" operator="in" result="edge"/><feMerge><feMergeNode in="edge"/><feMergeNode in="SourceGraphic"/></feMerge></filter>
</defs>`;

type Eye = 'lidded' | 'happy' | 'round' | 'side' | 'up' | 'droopy' | 'wink';
type Expression = {
  name: string;
  use: string;
  eyes: [Eye, Eye];
  brows?: [number, number, number, number][];
  mouth: { y: number; open: number; tilt?: number };
  /** Lean and lift for the whole body. */
  pose?: { rotate?: number; lift?: number };
  /** Tarnished: the win-back look ("losing my shine"). */
  dull?: boolean;
  extra?: string;
};

function eye(kind: Eye, x: number, y: number) {
  const glint = (dx: number, dy: number, r = 3.4) => `<circle cx="${x + dx}" cy="${y + dy}" r="${r}" fill="#fff"/>`;
  switch (kind) {
    case 'round':
      return `<ellipse cx="${x}" cy="${y}" rx="9" ry="13" fill="${INK}"/>${glint(3, -5)}`;
    case 'side':
      return `<ellipse cx="${x + 3}" cy="${y}" rx="9" ry="13" fill="${INK}"/>${glint(7, -5)}`;
    case 'up':
      return `<ellipse cx="${x + 2}" cy="${y - 3}" rx="9" ry="13" fill="${INK}"/>${glint(5, -10)}`;
    case 'lidded':
      return `<path d="M${x - 10} ${y - 1}A10 12 0 0 0 ${x + 10} ${y - 1}Z" fill="${INK}"/><path d="M${x - 13} ${y - 2}L${x + 12} ${y - 4}" stroke="${INK}" stroke-width="5" stroke-linecap="round"/>${glint(3, 3, 2.6)}`;
    case 'droopy':
      return `<path d="M${x - 9} ${y + 3}A9 8 0 0 0 ${x + 9} ${y + 3}Z" fill="${INK}"/><path d="M${x - 12} ${y + 1}Q${x} ${y + 5} ${x + 12} ${y + 3}" fill="none" stroke="${INK}" stroke-width="5" stroke-linecap="round"/>`;
    case 'wink':
      return `<path d="M${x - 11} ${y + 1}Q${x} ${y - 9} ${x + 11} ${y + 1}" fill="none" stroke="${INK}" stroke-width="5" stroke-linecap="round"/>`;
    case 'happy':
      return `<path d="M${x - 11} ${y + 3}Q${x} ${y - 11} ${x + 11} ${y + 3}" fill="none" stroke="${INK}" stroke-width="5.5" stroke-linecap="round"/>`;
  }
}

/** Gold caps, the iced-out centre tooth, and fangs hanging over the lip. */
function grin(expression: Expression, id: string) {
  const { y, open, tilt = 0 } = expression.mouth;
  const gold = expression.dull ? 'url(#dull)' : 'url(#gold)';
  const m0 = 64;
  const m1 = 136;
  const mouth = `M${m0} ${y}L${m1} ${y}C${m1} ${y + open * 0.95} ${m1 - 14} ${y + open} 100 ${y + open}C${m0 + 14} ${y + open} ${m0} ${y + open * 0.95} ${m0} ${y}Z`;
  const x0 = m0 + 4;
  const x1 = m1 - 4;
  const widths = [12, 12, 15, 15, 12, 12];
  const scale = (x1 - x0 - (widths.length - 1)) / widths.reduce((sum, w) => sum + w, 0);
  const outline = `stroke="${INK}" stroke-width="2" stroke-linejoin="round"`;
  const shine = (x: number, top: number, bottom: number) => (expression.dull ? '' : `<path d="M${x} ${top}L${x} ${bottom}" stroke="#fff6d8" stroke-width="1.8" stroke-linecap="round" opacity=".9"/>`);
  let cursor = x0;
  const fangs: string[] = [];
  const teeth = widths.map((raw, index) => {
    const w = raw * scale;
    const x = cursor;
    cursor += w + 1;
    if (index === 0 || index === widths.length - 1) {
      const length = open + 13;
      const tip = x + w * (index === 0 ? 0.6 : 0.4);
      fangs.push(`<path d="M${x} ${y}L${x + w} ${y}C${x + w} ${y + length * 0.45} ${tip + 2} ${y + length * 0.8} ${tip} ${y + length}C${tip - 2} ${y + length * 0.8} ${x} ${y + length * 0.45} ${x} ${y}Z" fill="${gold}" ${outline}/>${shine(x + 3, y + 3, y + length * 0.4)}`);
      return '';
    }
    const h = open * (index === 2 || index === 3 ? 0.78 : 0.66);
    const r = Math.min(4, w / 3);
    const cap = `M${x} ${y}L${x + w} ${y}L${x + w} ${y + h - r}Q${x + w} ${y + h} ${x + w - r} ${y + h}L${x + r} ${y + h}Q${x} ${y + h} ${x} ${y + h - r}Z`;
    if (index === 2) {
      const stones = [0.22, 0.5, 0.78].flatMap((u) => [0.16, 0.38, 0.6, 0.82].map((v) => `<circle cx="${x + w * u}" cy="${y + h * v}" r="${w * 0.11}" fill="${expression.dull ? '#c9c6bd' : '#ffffff'}" stroke="#9aa6b2" stroke-width=".5"/>`));
      return `<path d="${cap}" fill="${expression.dull ? '#b9b6ad' : '#cfd9e2'}" ${outline}/>${stones.join('')}`;
    }
    return `<path d="${cap}" fill="${gold}" ${outline}/>${shine(x + 2.5, y + 3, y + h * 0.6)}`;
  });
  return `<g transform="rotate(${tilt} 100 ${y})">
<clipPath id="m${id}"><path d="${mouth}"/></clipPath>
<path d="${mouth}" fill="#2a1511"/>
<g clip-path="url(#m${id})">${teeth.join('')}</g>
<path d="${mouth}" fill="none" stroke="${INK}" stroke-width="4" stroke-linejoin="round"/>
${fangs.join('')}
</g>`;
}

const sparkle = (cx: number, cy: number, r: number, fill = '#ebc464') =>
  `<path d="M${cx} ${cy - r}Q${cx} ${cy} ${cx + r} ${cy}Q${cx} ${cy} ${cx} ${cy + r}Q${cx} ${cy} ${cx - r} ${cy}Q${cx} ${cy} ${cx} ${cy - r}Z" fill="${fill}" stroke="${INK}" stroke-width="3" stroke-linejoin="round"/>`;

/** The whole character in its 200×200 box. `sticker` adds a cream edge for dark backgrounds. */
export function mascot(expression: Expression, id: string, { sticker = false, shadow = true } = {}) {
  const { rotate = 0, lift = 0 } = expression.pose ?? {};
  const fill = expression.dull ? 'url(#dull)' : 'url(#gold)';
  const brows = (expression.brows ?? []).map(([x1, y1, x2, y2]) => `<path d="M${x1} ${y1}L${x2} ${y2}" stroke="${INK}" stroke-width="6" stroke-linecap="round"/>`).join('');
  // The signature: one brilliant-cut stone set in the crown.
  const stone = `<g transform="translate(136 44) rotate(18)"><path d="M-11 -4L-6 -10L6 -10L11 -4L0 10Z" fill="${expression.dull ? '#c9c6bd' : '#f4f9fc'}" stroke="${INK}" stroke-width="2.5" stroke-linejoin="round"/><path d="M-11 -4L11 -4M-6 -10L-3 -4L0 10L3 -4L6 -10" fill="none" stroke="#9aa6b2" stroke-width="1"/></g>`;
  const body = `<g transform="translate(0 ${-lift}) rotate(${rotate} 100 120)"${sticker ? ' filter="url(#sticker)"' : ''}>
<path d="${BODY}" fill="${fill}" stroke="${INK}" stroke-width="5" stroke-linejoin="round"/>
<path d="${BODY}" fill="url(#shade)"/>
<path d="${BODY}" fill="none" stroke="${INK}" stroke-width="5" stroke-linejoin="round"/>
${expression.dull ? '' : '<path d="M60 56Q60 42 72 37" fill="none" stroke="#fff6d8" stroke-width="6" stroke-linecap="round" opacity=".85"/><path d="M58 70L58 78" stroke="#fff6d8" stroke-width="5" stroke-linecap="round" opacity=".7"/>'}
${stone}
${eye(expression.eyes[0], 80, 64)}${eye(expression.eyes[1], 120, 64)}${brows}${grin(expression, id)}
</g>`;
  const ground = shadow ? `<ellipse cx="100" cy="194" rx="${62 - lift}" ry="5" fill="${INK}" opacity=".12"/>` : '';
  return `${ground}${body}${expression.extra ?? ''}`;
}

export const expressions: Expression[] = [
  { name: 'Cool', use: 'Resting face: avatar, footer, dashboard', eyes: ['lidded', 'lidded'], mouth: { y: 92, open: 18 } },
  {
    name: 'Hype',
    use: 'Wins: first request, deposit paid, live',
    eyes: ['happy', 'happy'],
    mouth: { y: 90, open: 28 },
    pose: { rotate: -6, lift: 10 },
    extra: `${sparkle(30, 46, 14)}${sparkle(172, 34, 11)}${sparkle(178, 108, 8, '#fff')}<path d="M24 120l-12 4M28 138l-12 8M176 140l12 6" stroke="${INK}" stroke-width="4" stroke-linecap="round"/>`,
  },
  {
    name: 'Nudge',
    use: 'Reminders: finish setup, trial ending',
    eyes: ['side', 'side'],
    brows: [[70, 46, 88, 48], [110, 44, 124, 40]],
    mouth: { y: 92, open: 16, tilt: -5 },
    pose: { rotate: 4 },
  },
  {
    name: 'Working',
    use: 'Loading: rendering the studio photo',
    eyes: ['up', 'up'],
    mouth: { y: 93, open: 12 },
    extra: `<g><rect x="156" y="4" width="44" height="26" rx="13" fill="#fff" stroke="${INK}" stroke-width="3"/><circle cx="168" cy="17" r="3" fill="${INK}"/><circle cx="178" cy="17" r="3" fill="${INK}"/><circle cx="188" cy="17" r="3" fill="${INK}"/></g>`,
  },
  {
    name: 'Tarnished',
    use: 'Win-back: "I\'m losing my shine"',
    eyes: ['droopy', 'droopy'],
    mouth: { y: 94, open: 12 },
    pose: { rotate: 3 },
    dull: true,
    extra: `<path d="M152 52Q158 62 152 66Q146 62 152 52Z" fill="#bcd7ea" stroke="${INK}" stroke-width="2.5" stroke-linejoin="round"/>`,
  },
  { name: 'Wink', use: 'Sign-offs, thanks, welcome', eyes: ['lidded', 'wink'], mouth: { y: 92, open: 20, tilt: -3 } },
];

const COLS = 3;
const CELL_W = 360;
const CELL_H = 420;

function sheet(title: string, background: string, sticker: boolean, textColour: string, cellFill: string) {
  const W = COLS * CELL_W;
  const H = Math.ceil(expressions.length / COLS) * CELL_H + 70;
  const cells = expressions
    .map((expression, index) => {
      const x = (index % COLS) * CELL_W;
      const y = 70 + Math.floor(index / COLS) * CELL_H;
      return `<g transform="translate(${x} ${y})">
<rect x="10" y="10" width="${CELL_W - 20}" height="${CELL_H - 20}" rx="18" fill="${cellFill}"/>
<g transform="translate(30 18) scale(1.5)">${mascot(expression, `${sticker ? 'd' : 'l'}${index}`, { sticker })}</g>
<text x="30" y="${CELL_H - 60}" font-family="Inter" font-size="20" font-weight="700" fill="${textColour}">${expression.name}</text>
<text x="30" y="${CELL_H - 34}" font-family="Inter" font-size="15" fill="${textColour}" opacity=".7">${expression.use.replace(/&/g, '&amp;')}</text>
</g>`;
    })
    .join('\n');
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} ${H}" width="${W}" height="${H}">${defs}
<rect width="${W}" height="${H}" fill="${background}"/>
<text x="30" y="46" font-family="Inter" font-size="24" font-weight="700" fill="${textColour}">${title}</text>
${cells}
</svg>`;
}

/** The resting face from poster size down to a favicon. */
function sizes() {
  const steps = [256, 128, 64, 40, 24];
  let x = 30;
  const items = steps
    .map((size) => {
      const out = `<g transform="translate(${x - size * 0.2} ${300 - size})"><g transform="scale(${size / 200})">${mascot(expressions[0], `s${size}`, { shadow: false })}</g></g><text x="${x}" y="330" font-family="Inter" font-size="15" fill="#6f655a">${size}px</text>`;
      x += size * 0.62 + 40;
      return out;
    })
    .join('');
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${x} 350" width="${x}" height="350">${defs}<rect width="${x}" height="350" fill="${CREAM}"/>${items}</svg>`;
}

async function write(name: string, svg: string) {
  writeFileSync(`${OUT}/${name}.svg`, svg);
  await sharp(Buffer.from(svg)).png({ compressionLevel: 9 }).toFile(`${OUT}/${name}.png`);
}

async function main() {
  mkdirSync(OUT, { recursive: true });
  await write('round-4-expressions', sheet('VVS Lab mascot · round 4: Cool (resting) + expressions', CREAM, false, INK, '#ffffff'));
  await write('round-4-on-dark', sheet('On the dark brand background (Instagram, OG images): cream sticker edge', INK, true, '#f3ede4', '#241e19'));
  await write('round-4-sizes', sizes());
  console.log('written', OUT);
}

void main();
