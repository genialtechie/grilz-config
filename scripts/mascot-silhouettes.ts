// Mascot round 1: silhouettes only. Every candidate is a solid black shape
// built from primitives, shown large and at 40px (the shrink test), so the
// choice is made on shape alone, before any face, colour or detail.
//   npx tsx scripts/mascot-silhouettes.ts
// Writes docs/brand/mascot/round-1-silhouettes.png (+ .svg).

import { mkdirSync, writeFileSync } from 'node:fs';
import sharp from 'sharp';

const OUT = 'docs/brand/mascot';
const INK = '#1b1714';

// Shared parts, in a 200×200 box.
const incisor = 'M62 44Q62 20 100 20Q138 20 138 44L134 118Q132 140 114 140L86 140Q68 140 66 118Z';
const rootLegs = (y = 148, gap = 30) =>
  `<rect x="${100 - gap / 2 - 18}" y="${y}" width="18" height="34" rx="9"/><rect x="${100 + gap / 2}" y="${y}" width="18" height="34" rx="9"/>`;
const sparkle = (cx: number, cy: number, r: number) => `<path d="M${cx} ${cy - r}Q${cx} ${cy} ${cx + r} ${cy}Q${cx} ${cy} ${cx} ${cy + r}Q${cx} ${cy} ${cx - r} ${cy}Q${cx} ${cy} ${cx} ${cy - r}Z"/>`;

type Candidate = { name: string; idea: string; svg: string };

const candidates: Candidate[] = [
  { name: 'Incisor', idea: 'Front tooth, root legs', svg: `<path d="${incisor}"/>${rootLegs()}` },
  {
    name: 'Molar',
    idea: 'Wide and square: sturdy craftsman',
    svg: `<path d="M38 52Q38 30 60 30L140 30Q162 30 162 52L157 118Q155 138 135 138L65 138Q45 138 43 118Z"/><path d="M58 146L84 146L80 182Q78 188 72 188Q64 188 62 182Z"/><path d="M116 146L142 146L138 182Q136 188 128 188Q122 188 120 182Z"/>`,
  },
  { name: 'Fang', idea: 'Pointed: swagger, a bit of mischief', svg: `<path d="M58 30Q100 16 142 30L138 96Q130 148 100 182Q70 148 62 96Z"/>` },
  {
    name: 'Bean',
    idea: 'All circles: soft, cute',
    svg: `<path d="M100 46Q122 26 148 46Q174 72 162 116Q150 158 100 158Q50 158 38 116Q26 72 52 46Q78 26 100 46Z"/><ellipse cx="78" cy="174" rx="14" ry="12"/><ellipse cx="122" cy="174" rx="14" ry="12"/>`,
  },
  {
    name: 'Crown molar',
    idea: 'Cusps as a crown: king tooth',
    svg: `<path d="M44 72L52 26L77 54L100 18L123 54L148 26L156 72L151 128Q149 146 131 146L69 146Q51 146 49 128Z"/>${rootLegs(154, 34)}`,
  },
  {
    name: 'Gem on top',
    idea: 'A floating VVS stone',
    svg: `<path d="M72 18L128 18L142 32L100 64L58 32Z"/><path d="M62 84Q62 68 100 68Q138 68 138 84L134 140Q132 158 114 158L86 158Q68 158 66 140Z"/>${rootLegs(166)}`,
  },
  {
    name: 'Snapback',
    idea: 'Streetwear: tooth in a cap',
    svg: `<path d="M60 58Q60 18 100 18Q140 18 140 58Z"/><path d="M128 50L178 50Q184 50 184 56Q184 62 178 62L128 62Z"/><path d="M62 70L138 70L134 128Q132 148 114 148L86 148Q68 148 66 128Z"/>${rootLegs(156)}`,
  },
  {
    name: 'Diamond',
    idea: 'The cut stone, not a tooth',
    svg: `<path d="M58 34L142 34L174 72L100 168L26 72Z"/><rect x="70" y="174" width="16" height="22" rx="8"/><rect x="114" y="174" width="16" height="22" rx="8"/>`,
  },
  {
    name: 'Classic',
    idea: 'The tooth icon everyone knows',
    svg: `<path d="M46 62Q46 26 78 28Q100 40 122 28Q154 26 154 62Q154 100 142 122L134 180Q130 192 118 186L106 142Q100 132 94 142L82 186Q70 192 66 180L58 122Q46 100 46 62Z"/>`,
  },
  {
    name: 'Chain',
    idea: 'Tooth + Cuban link',
    svg: `<path d="${incisor}"/><g fill="none" stroke="${INK}" stroke-width="12"><ellipse cx="100" cy="166" rx="44" ry="18"/></g>`,
  },
  {
    name: 'Sparkle',
    idea: 'Molar with a VVS sparkle',
    svg: `<path d="M34 64Q34 44 54 44L126 44Q146 44 146 64L142 128Q140 146 122 146L58 146Q40 146 38 128Z"/>${sparkle(164, 38, 26)}<rect x="50" y="154" width="18" height="32" rx="9"/><rect x="112" y="154" width="18" height="32" rx="9"/>`,
  },
  {
    name: 'Lean',
    idea: 'Tilted mid-step: attitude',
    svg: `<g transform="rotate(-12 100 100)"><path d="${incisor}"/><rect x="70" y="148" width="18" height="34" rx="9"/></g><rect x="120" y="150" width="18" height="34" rx="9" transform="rotate(28 129 167)"/>`,
  },
];

const COLS = 4;
const CELL_W = 300;
const CELL_H = 340;
const W = COLS * CELL_W;
const H = Math.ceil(candidates.length / COLS) * CELL_H + 70;

const escape = (text: string) => text.replace(/[&<>]/g, (char) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' })[char] ?? char);

const cells = candidates
  .map((candidate, index) => {
    const x = (index % COLS) * CELL_W;
    const y = 70 + Math.floor(index / COLS) * CELL_H;
    return `<g transform="translate(${x} ${y})">
<rect x="10" y="10" width="${CELL_W - 20}" height="${CELL_H - 20}" rx="18" fill="#ffffff" stroke="#e7ddcd" stroke-width="2"/>
<g transform="translate(40 26) scale(1.1)" fill="${INK}">${candidate.svg}</g>
<g transform="translate(${CELL_W - 70} 34) scale(0.2)" fill="${INK}">${candidate.svg}</g>
<text x="30" y="${CELL_H - 58}" font-family="Inter" font-size="20" font-weight="700" fill="${INK}">${index + 1}. ${escape(candidate.name)}</text>
<text x="30" y="${CELL_H - 32}" font-family="Inter" font-size="15" fill="#6f655a">${escape(candidate.idea)}</text>
</g>`;
  })
  .join('\n');

const sheet = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} ${H}" width="${W}" height="${H}">
<rect width="${W}" height="${H}" fill="#fbf7f0"/>
<text x="30" y="46" font-family="Inter" font-size="24" font-weight="700" fill="${INK}">VVS Lab mascot · round 1: silhouettes (small copy = 40px shrink test)</text>
${cells}
</svg>`;

async function main() {
  mkdirSync(OUT, { recursive: true });
  writeFileSync(`${OUT}/round-1-silhouettes.svg`, sheet);
  await sharp(Buffer.from(sheet)).png({ compressionLevel: 9 }).toFile(`${OUT}/round-1-silhouettes.png`);
  console.log('written', `${OUT}/round-1-silhouettes.png`);
}

void main();
