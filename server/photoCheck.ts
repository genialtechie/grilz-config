import sharp from 'sharp';
import { labelOf } from '../src/lib/photoLabels.js';
import { opalOf, type RenderSpec } from '../src/lib/renderSpec.js';

// Checks an AI photo against the 3D still it was made from, before anyone
// sees it (MAG-76). Free: no model calls. The photo stage also renders a label
// map with each covered tooth in its own flat colour (labelColor in
// src/lib/photoLabels.ts), which tells us where every tooth is.
//   - Metal colour: each tooth's pixels in the photo have its metal's hue
//     (gold reads gold, white gold reads neutral, fire opal reads orange-red).
//   - Nothing invented: no gold appears outside the grillz where the still had none.
//   - Same layout: the photo's edges line up with the still's (the model kept the framing).

const WIDTH = 384;
const HEIGHT = 256;

const hsv = (r: number, g: number, b: number) => {
  const max = Math.max(r, g, b) / 255;
  const min = Math.min(r, g, b) / 255;
  const delta = max - min;
  let hue = 0;
  if (delta > 0) {
    if (max === r / 255) hue = ((g - b) / 255 / delta) % 6;
    else if (max === g / 255) hue = (b - r) / 255 / delta + 2;
    else hue = (r - g) / 255 / delta + 4;
    hue = (hue * 60 + 360) % 360;
  }
  return { hue, sat: max === 0 ? 0 : delta / max, val: max };
};

const goldLike = (r: number, g: number, b: number) => {
  const { hue, sat, val } = hsv(r, g, b);
  return hue >= 25 && hue <= 62 && sat > 0.38 && val > 0.3;
};

async function raw(base64: string, mode: 'photo' | 'labels' | 'shapes' = 'photo') {
  let image = sharp(Buffer.from(base64, 'base64')).resize(WIDTH, HEIGHT, { fit: 'fill', kernel: mode === 'labels' ? 'nearest' : 'lanczos3' });
  // For the layout check, blur away fine texture (stones, reflections) so only the shapes are compared.
  if (mode === 'shapes') image = image.blur(3);
  const { data } = await image.removeAlpha().raw().toBuffer({ resolveWithObject: true });
  return data;
}

/** Mean hue (circular), saturation and value over a set of pixels. */
function meanColour(data: Buffer, pixels: number[]) {
  let x = 0;
  let y = 0;
  let sat = 0;
  let val = 0;
  pixels.forEach((p) => {
    const colour = hsv(data[p * 3], data[p * 3 + 1], data[p * 3 + 2]);
    // Weight hue by saturation so near-grey pixels don't pull it around.
    x += Math.cos((colour.hue * Math.PI) / 180) * colour.sat;
    y += Math.sin((colour.hue * Math.PI) / 180) * colour.sat;
    sat += colour.sat;
    val += colour.val;
  });
  const n = Math.max(1, pixels.length);
  return { hue: ((Math.atan2(y, x) * 180) / Math.PI + 360) % 360, sat: sat / n, val: val / n };
}

/** Pearson correlation of two images' edge strength inside a box. */
function edgeCorrelation(a: Buffer, b: Buffer, box: { x0: number; y0: number; x1: number; y1: number }) {
  const grey = (data: Buffer, p: number) => 0.299 * data[p * 3] + 0.587 * data[p * 3 + 1] + 0.114 * data[p * 3 + 2];
  const edges = (data: Buffer, x: number, y: number) => {
    const p = y * WIDTH + x;
    return Math.abs(grey(data, p + 1) - grey(data, p - 1)) + Math.abs(grey(data, p + WIDTH) - grey(data, p - WIDTH));
  };
  const xs: number[] = [];
  const ys: number[] = [];
  for (let y = Math.max(1, box.y0); y < Math.min(HEIGHT - 1, box.y1); y += 1) {
    for (let x = Math.max(1, box.x0); x < Math.min(WIDTH - 1, box.x1); x += 1) {
      xs.push(edges(a, x, y));
      ys.push(edges(b, x, y));
    }
  }
  const mean = (values: number[]) => values.reduce((sum, value) => sum + value, 0) / Math.max(1, values.length);
  const mx = mean(xs);
  const my = mean(ys);
  let cov = 0;
  let vx = 0;
  let vy = 0;
  xs.forEach((value, i) => {
    cov += (value - mx) * (ys[i] - my);
    vx += (value - mx) ** 2;
    vy += (ys[i] - my) ** 2;
  });
  return vx && vy ? cov / Math.sqrt(vx * vy) : 0;
}

export type PhotoCheck = {
  pass: boolean;
  reasons: string[];
  scores: { colour: number; invented: number; alignment: number; shapes: number; edges: number };
  teeth: { index: number; ok: boolean; hue: number; sat: number }[];
};

/** Thresholds, set on the eval set (scripts/photo-eval). */
export const CHECK_LIMITS = { colour: 0.85, invented: 0.006, alignment: 0.3 };

export async function checkPhoto(photo: string, still: string, labels: string, spec: RenderSpec): Promise<PhotoCheck> {
  const [out, base, label, outShapes, baseShapes] = await Promise.all([raw(photo), raw(still), raw(labels, 'labels'), raw(photo, 'shapes'), raw(still, 'shapes')]);
  const regions = new Map<number, number[]>();
  const covered = new Uint8Array(WIDTH * HEIGHT);
  const box = { x0: WIDTH, y0: HEIGHT, x1: 0, y1: 0 };
  for (let p = 0; p < WIDTH * HEIGHT; p += 1) {
    const index = labelOf(label[p * 3], label[p * 3 + 1], label[p * 3 + 2]);
    if (index === null) continue;
    covered[p] = 1;
    const x = p % WIDTH;
    const y = Math.floor(p / WIDTH);
    box.x0 = Math.min(box.x0, x);
    box.y0 = Math.min(box.y0, y);
    box.x1 = Math.max(box.x1, x);
    box.y1 = Math.max(box.y1, y);
    const region = regions.get(index);
    if (region) region.push(p);
    else regions.set(index, [p]);
  }

  // Each visible tooth's colour.
  const designs = new Map(spec.teeth.map((tooth) => [tooth.index, tooth]));
  const teeth: PhotoCheck['teeth'] = [];
  regions.forEach((pixels, index) => {
    const design = designs.get(index);
    if (!design || pixels.length < 40) return; // hidden behind the other row
    const colour = meanColour(out, pixels);
    const opal = opalOf(design);
    let ok: boolean;
    // The metal rim round an opal dilutes its colour, so the bar is lower than the stone's own.
    if (opal === 'fire') ok = (colour.hue <= 50 || colour.hue >= 340) && colour.sat >= 0.18;
    else if (opal === 'blue') ok = colour.hue >= 180 && colour.hue <= 270 && colour.sat >= 0.15;
    else if (design.metal === 'yellow') ok = colour.hue >= 22 && colour.hue <= 62 && colour.sat >= (design.type === 'iced' ? 0.1 : 0.2);
    else if (design.metal === 'rose') ok = (colour.hue <= 45 || colour.hue >= 330) && colour.sat >= 0.1;
    else ok = colour.sat <= (opal === 'white' || design.type === 'iced' ? 0.3 : 0.24); // white metals stay neutral
    teeth.push({ index, ok, hue: Math.round(colour.hue), sat: Math.round(colour.sat * 100) / 100 });
  });
  const colour = teeth.length ? teeth.filter((tooth) => tooth.ok).length / teeth.length : 1;

  // Gold that wasn't there: outside the grillz (with a margin), gold-like in the photo but not in the still.
  const margin = 6;
  let invented = 0;
  for (let y = 0; y < HEIGHT; y += 1) {
    for (let x = 0; x < WIDTH; x += 1) {
      const p = y * WIDTH + x;
      let near = false;
      for (let dy = -margin; dy <= margin && !near; dy += 3) {
        for (let dx = -margin; dx <= margin && !near; dx += 3) {
          const q = (y + dy) * WIDTH + (x + dx);
          if (y + dy >= 0 && y + dy < HEIGHT && x + dx >= 0 && x + dx < WIDTH && covered[q]) near = true;
        }
      }
      if (near) continue;
      if (goldLike(out[p * 3], out[p * 3 + 1], out[p * 3 + 2]) && !goldLike(base[p * 3], base[p * 3 + 1], base[p * 3 + 2])) invented += 1;
    }
  }
  const inventedShare = invented / (WIDTH * HEIGHT);

  // Same layout: edges inside the set's box (with room round it) line up.
  const pad = 12;
  const area = { x0: box.x0 - pad, y0: box.y0 - pad, x1: box.x1 + pad, y1: box.y1 + pad };
  // Two scales: fine edges catch a shift on plain metal, blurred shapes catch it on repetitive pavé.
  const edges = edgeCorrelation(base, out, area);
  const shapes = edgeCorrelation(baseShapes, outShapes, area);
  const alignment = Math.min(edges, shapes);

  const reasons: string[] = [];
  if (colour < CHECK_LIMITS.colour) reasons.push(`metal colour off on teeth ${teeth.filter((tooth) => !tooth.ok).map((tooth) => tooth.index).join(', ')}`);
  if (inventedShare > CHECK_LIMITS.invented) reasons.push(`gold added outside the grillz (${(inventedShare * 100).toFixed(1)}% of the photo)`);
  if (alignment < CHECK_LIMITS.alignment) reasons.push(`layout moved (edge match ${alignment.toFixed(2)})`);
  return {
    pass: reasons.length === 0,
    reasons,
    scores: {
      colour: Math.round(colour * 100) / 100,
      invented: Math.round(inventedShare * 10_000) / 10_000,
      alignment: Math.round(alignment * 100) / 100,
      shapes: Math.round(shapes * 100) / 100,
      edges: Math.round(edges * 100) / 100,
    },
    teeth,
  };
}
