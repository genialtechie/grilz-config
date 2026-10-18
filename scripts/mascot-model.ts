// Karat, the VVS Lab mascot: the polished model, its expressions, turnaround and exports.
// Body F (Root fang), resting face Cool, Hype for wins. Everything is built
// from one set of parts so every expression stays on-model.
//   npx tsx scripts/mascot-model.ts
// Writes the sheets to docs/brand/mascot/ (expressions, on dark, sizes,
// turnaround) and the PNG exports (each expression, app icons) to
// public/assets/mascot/.

import { mkdirSync, writeFileSync } from 'node:fs';
import sharp from 'sharp';

const OUT = 'docs/brand/mascot';
const INK = '#1b1714';
const CREAM = '#fbf7f0';
const BODY = 'M46 60Q46 26 78 28Q100 40 122 28Q154 26 154 60Q154 98 142 120L130 186Q126 196 118 188L106 142Q100 132 94 142L84 172Q80 182 72 176L60 120Q46 98 46 60Z';

const defs = `<defs>
<linearGradient id="gold" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#fbe7ab"/><stop offset=".35" stop-color="#ebc464"/><stop offset=".7" stop-color="#d1a03f"/><stop offset="1" stop-color="#a37624"/></linearGradient>
<linearGradient id="shade" x1="0" y1="0" x2="1" y2="0"><stop offset=".55" stop-color="#7a5414" stop-opacity="0"/><stop offset="1" stop-color="#7a5414" stop-opacity=".35"/></linearGradient>
<linearGradient id="turn" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="#6e4a10" stop-opacity=".55"/><stop offset=".3" stop-color="#6e4a10" stop-opacity="0"/></linearGradient>
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
export function mascot(expression: Expression, id: string, { sticker = false, shadow = true, turn = 0 } = {}) {
  const { rotate = 0, lift = 0 } = expression.pose ?? {};
  const fill = expression.dull ? 'url(#dull)' : 'url(#gold)';
  const brows = (expression.brows ?? []).map(([x1, y1, x2, y2]) => `<path d="M${x1} ${y1}L${x2} ${y2}" stroke="${INK}" stroke-width="6" stroke-linecap="round"/>`).join('');
  // The signature: an eyebrow piercing at the outer end of his right brow, a
  // curved gold barbell with an iced-out stone on each end.
  const ice = expression.dull ? '#c9c6bd' : '#f4f9fc';
  const gem = (cx: number, cy: number, r: number) =>
    `<circle cx="${cx}" cy="${cy}" r="${r}" fill="${ice}" stroke="${INK}" stroke-width="2.2"/><path d="M${cx - r * 0.5} ${cy}L${cx} ${cy - r * 0.5}L${cx + r * 0.5} ${cy}L${cx} ${cy + r * 0.5}Z" fill="#dbe7f0" stroke="#9aa6b2" stroke-width=".8"/>${expression.dull ? '' : `<circle cx="${cx - r * 0.35}" cy="${cy - r * 0.35}" r="${r * 0.28}" fill="#fff"/>`}`;
  const stone = `<g><path d="M130 40Q142 47 137 58" fill="none" stroke="${INK}" stroke-width="6" stroke-linecap="round"/><path d="M130 40Q142 47 137 58" fill="none" stroke="${expression.dull ? '#b3a684' : '#ebc464'}" stroke-width="3" stroke-linecap="round"/>${gem(130, 39, 6.2)}${gem(137, 59, 6.8)}</g>`;
  const body = `<g transform="translate(0 ${-lift}) rotate(${rotate} 100 120)"${sticker ? ' filter="url(#sticker)"' : ''}>
<path d="${BODY}" fill="${fill}" stroke="${INK}" stroke-width="5" stroke-linejoin="round"/>
<path d="${BODY}" fill="url(#shade)"/>
<path d="${BODY}" fill="none" stroke="${INK}" stroke-width="5" stroke-linejoin="round"/>
${expression.dull ? '' : '<path d="M60 56Q60 42 72 37" fill="none" stroke="#fff6d8" stroke-width="6" stroke-linecap="round" opacity=".85"/><path d="M58 70L58 78" stroke="#fff6d8" stroke-width="5" stroke-linecap="round" opacity=".7"/>'}
${turn ? `<path d="${BODY}" fill="url(#turn)" opacity="${turn}"/><path d="${BODY}" fill="none" stroke="${INK}" stroke-width="5" stroke-linejoin="round"/>` : ''}
<g transform="translate(${100 + turn * 14} 0) scale(${1 - turn * 0.14} 1) translate(-100 0)">
${stone}
${eye(expression.eyes[0], 80, 64)}${eye(expression.eyes[1], 120, 64)}${brows}${grin(expression, id)}
</g>
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

// ---------- Turnaround (model sheet) ----------

/** ¾ view: the body turns (its left side falls into shade) and the face slides toward the near side. */
function threeQuarter(expression: Expression, id: string) {
  return `<g transform="translate(100 0) scale(0.9 1) translate(-100 0)">${mascot(expression, id, { turn: 1 })}</g>`;
}

const SIDE = 'M68 42Q70 26 96 26Q126 26 132 50Q136 76 128 104Q124 118 118 126L112 186Q109 195 101 189L96 146Q92 138 86 146L82 176Q79 184 72 179L70 122Q62 104 63 76Q64 56 68 42Z';

/** Side view, facing right: one eye, the grin's corner and one fang over the lip. */
function side(id: string) {
  return `<ellipse cx="98" cy="194" rx="44" ry="5" fill="${INK}" opacity=".12"/>
<path d="${SIDE}" fill="url(#gold)" stroke="${INK}" stroke-width="5" stroke-linejoin="round"/>
<path d="${SIDE}" fill="url(#shade)" transform="scale(-1 1) translate(-196 0)" opacity=".7"/>
<path d="${SIDE}" fill="none" stroke="${INK}" stroke-width="5" stroke-linejoin="round"/>
<path d="M76 54Q78 42 88 37" fill="none" stroke="#fff6d8" stroke-width="6" stroke-linecap="round" opacity=".85"/>
<path d="M120 42Q128 47 125 56" fill="none" stroke="${INK}" stroke-width="5" stroke-linecap="round"/><path d="M120 42Q128 47 125 56" fill="none" stroke="#ebc464" stroke-width="2.4" stroke-linecap="round"/><circle cx="120" cy="41" r="4.5" fill="#f4f9fc" stroke="${INK}" stroke-width="2"/><circle cx="125" cy="57" r="4.5" fill="#f4f9fc" stroke="${INK}" stroke-width="2"/>
<path d="M110 63A8 11 0 0 0 126 63Z" fill="${INK}"/><path d="M107 62L128 59" stroke="${INK}" stroke-width="5" stroke-linecap="round"/><circle cx="121" cy="66" r="2.3" fill="#fff"/>
<clipPath id="side${id}"><path d="M98 90L129 90L127 103Q116 108 102 100Z"/></clipPath>
<path d="M98 90L129 90L127 103Q116 108 102 100Z" fill="#2a1511"/>
<g clip-path="url(#side${id})"><rect x="100" y="90" width="9" height="12" rx="2" fill="url(#gold)" stroke="${INK}" stroke-width="2"/><rect x="110" y="90" width="8" height="12" rx="2" fill="url(#gold)" stroke="${INK}" stroke-width="2"/></g>
<path d="M98 90L129 90L127 103Q116 108 102 100Z" fill="none" stroke="${INK}" stroke-width="4" stroke-linejoin="round"/>
<path d="M119 90L126 90C126 99 124 108 122 116C120 108 119 99 119 90Z" fill="url(#gold)" stroke="${INK}" stroke-width="2" stroke-linejoin="round"/>`;
}

function turnaround() {
  const W = 1080;
  const H = 520;
  const guides = [26, 64, 92, 189].map((y) => `<line x1="20" x2="${W - 20}" y1="${80 + y * 1.8}" y2="${80 + y * 1.8}" stroke="#c9bba3" stroke-width="1.5" stroke-dasharray="6 6"/>`).join('');
  const view = (x: number, content: string, label: string) => `<g transform="translate(${x} 80) scale(1.8)">${content}</g><text x="${x + 180}" y="${H - 22}" text-anchor="middle" font-family="Inter" font-size="18" font-weight="700" fill="${INK}">${label}</text>`;
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} ${H}" width="${W}" height="${H}">${defs}
<rect width="${W}" height="${H}" fill="${CREAM}"/>
<text x="30" y="44" font-family="Inter" font-size="24" font-weight="700" fill="${INK}">Karat · model sheet (guides: crown, eyes, grin, root tips)</text>
${guides}
${view(0, mascot(expressions[0], 'tf'), 'Front')}
${view(360, threeQuarter(expressions[0], 'tq'), '¾')}
${view(720, side('ts'), 'Side')}
</svg>`;
}

// ---------- Exports ----------

const ASSETS = 'public/assets/mascot';

/** Email/web PNGs at 2×, transparent, with the sticker edge so they hold up in dark mode too. */
async function exportExpressions() {
  mkdirSync(ASSETS, { recursive: true });
  for (const [index, expression] of expressions.entries()) {
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="-8 -8 216 216" width="432" height="432">${defs}${mascot(expression, `x${index}`, { sticker: true, shadow: false })}</svg>`;
    await sharp(Buffer.from(svg)).png({ compressionLevel: 9, palette: true, quality: 95 }).toFile(`${ASSETS}/karat-${expression.name.toLowerCase()}.png`);
  }
}

/** App icon: Karat (Cool) on the ink square, at the sizes stores and browsers ask for. */
async function exportIcons() {
  const icon = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 200 200" width="1024" height="1024">${defs}
<rect width="200" height="200" fill="${INK}"/>
<g transform="translate(100 104) scale(0.86) translate(-100 -104)">${mascot(expressions[0], 'icon', { sticker: true, shadow: false })}</g></svg>`;
  for (const size of [1024, 512, 180]) {
    await sharp(Buffer.from(icon)).resize(size).png({ compressionLevel: 9 }).toFile(`${ASSETS}/karat-icon-${size}.png`);
  }
}

async function main() {
  mkdirSync(OUT, { recursive: true });
  await write('round-4-expressions', sheet('VVS Lab mascot · round 4: Cool (resting) + expressions', CREAM, false, INK, '#ffffff'));
  await write('round-4-on-dark', sheet('On the dark brand background (Instagram, OG images): cream sticker edge', INK, true, '#f3ede4', '#241e19'));
  await write('round-4-sizes', sizes());
  await write('karat-turnaround', turnaround());
  await exportExpressions();
  await exportIcons();
  console.log('written', OUT);
}

void main();
