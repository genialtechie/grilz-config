// Generates the small email artwork into public/assets/email/: the logo mark
// and the footer's social tiles. Re-run after changing them:
//   npx tsx scripts/email-art.ts
// Illustrations are Karat, the mascot: scripts/mascot-model.ts writes those to
// public/assets/mascot/.

import { mkdirSync } from 'node:fs';
import sharp from 'sharp';

const OUT = 'public/assets/email';
const INK = '#1b1714';
const CREAM = '#fbf7f0';

/** A 2x footer tile (shown at 40px): the Instagram glyph on a rounded square. */
const instagramTile = (tile: string, glyph: string, edge?: string) => `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 80 80" width="80" height="80">
<rect x="2" y="2" width="76" height="76" rx="18" fill="${tile}"${edge ? ` stroke="${edge}" stroke-width="3"` : ''}/>
<rect x="21" y="21" width="38" height="38" rx="11" fill="none" stroke="${glyph}" stroke-width="5"/>
<circle cx="40" cy="40" r="9" fill="none" stroke="${glyph}" stroke-width="5"/><circle cx="51.5" cy="28.5" r="3" fill="${glyph}"/></svg>`;

async function main() {
  mkdirSync(OUT, { recursive: true });
  // Gold tile for VVS Lab mail; ink tile with a light edge for shop mail (any accent).
  await sharp(Buffer.from(instagramTile('#e2b85e', INK))).png().toFile(`${OUT}/instagram-tile.png`);
  await sharp(Buffer.from(instagramTile(INK, CREAM, '#e7ddcd'))).png().toFile(`${OUT}/instagram-tile-ink.png`);
  // The gold mark at 2x its email size (48px tall), so it's light to load.
  await sharp('public/assets/vvs/logo-mark.png').resize({ height: 96 }).png({ compressionLevel: 9, palette: true, quality: 90 }).toFile(`${OUT}/vvs-mark.png`);
  console.log('email art written to', OUT);
}

void main();
