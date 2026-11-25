import { describe, expect, it } from 'vitest';
import { MARKET_DEFAULTS } from '../metalMarket';
import { gradePrice, nearestOffered, priceBreakdown } from '../pricing';
import { DEFAULT_SET, buildFillPrompt, describeSpec, describeTooth, gradePairsWithStone, gradesForStone, parseRenderSpec, planMasks, type KaratId, type MetalId, type RenderSpec, type RenderTooth, type ToothDesign } from '../renderSpec';
import { describeChanges } from '../tenant/diff';
import { parseTenantConfig, type TenantPricing } from '../tenant/schema';
import { VVSLAB_CONFIG } from '../tenant/vvslab';

// Diamond grade tiers in the ice step (MAG-215), on Luckey's real table:
// silver $80, 10K $115, 14K $180, 18K $220 a tooth, and a $50 appointment
// fee. His cuts are deep free, permanent $100 an order. Stone prices come
// from the demo config: moissanite $75, lab $160, natural $320 a tooth;
// honeycomb setting $0.

const LUCKEY: TenantPricing = {
  ...VVSLAB_CONFIG.pricing,
  base: 50,
  baseLabel: 'Appointment fee',
  metalPerTooth: { yellow: 100, white: 100, rose: 100, silver: 80, platinum: 320 },
  karatMultiplier: { '10k': 1.15, '14k': 1.8, '18k': 2.2, '22k': 2.3 },
  stylePerTooth: { solid: 0, 'open-face': 15, 'diamond-cut': 20, 'diamond-dust': 20, engraving: 30, opals: 60 },
  cuts: { deep: { amount: 0, per: 'tooth' }, permanent: { amount: 100, per: 'order' } },
  setPrices: [
    { size: 12, prices: { silver: 400, '10k': 1250, '14k': 1800, '18k': 2640 } },
    { size: 16, prices: { silver: 500, '10k': 1650, '14k': 2400, '18k': 3520 } },
    { size: 20, prices: { silver: 700, '10k': 2050, '14k': 3000, '18k': 4400 } },
    { size: 24, prices: { silver: 900, '10k': 2450, '14k': 3600, '18k': 5280 } },
  ],
  colourSurcharge: { white: 40, rose: 40 },
  extraPerTooth: {
    starburst: 25, pineapple: 25, princess: 20, nugget: 35, 'enamel-fill': 30,
    cross: 150, star: 150, heart: 150, lightning: 175, '3d': 200, 'diamond-shapes': 250, '3d-animal': 250,
    brushed: 0, laser: 0,
  },
  gradePerTooth: { 'grown-vvs': 250, 'natural-si-vs': 450, 'natural-vs1': 650 },
};

const tooth = (metal: MetalId, karat: KaratId, extra: Partial<ToothDesign> = {}): ToothDesign => ({
  metal, karat, type: 'iced', style: 'solid', setting: 'honeycomb', stone: 'natural', ...extra,
});

// Front teeth only (no back-teeth pricing): 6 top, or 6 top + 6 bottom.
const front = (count: number, extra: Partial<ToothDesign> = {}): RenderTooth[] => {
  const top = Math.min(count, 6);
  const bottom = count - top;
  return [
    ...[5, 6, 7, 8, 9, 10].slice(0, top).map((index) => ({ ...tooth('yellow', '10k', extra), index })),
    ...[21, 22, 23, 24, 25, 26].slice(0, bottom).map((index) => ({ ...tooth('yellow', '10k', extra), index })),
  ];
};
// Top teeth first, then bottom: 12 = 6/6 (indices 0..11, so back teeth count).
const setOf = (count: number, extra: Partial<ToothDesign> = {}): RenderTooth[] => {
  const top = Math.min(count, 12);
  const bottom = count - top;
  return [
    ...Array.from({ length: top }, (_, i) => ({ ...tooth('yellow', '10k', extra), index: i })),
    ...Array.from({ length: bottom }, (_, i) => ({ ...tooth('yellow', '10k', extra), index: 16 + i })),
  ];
};

const quote = (pricing: TenantPricing, teeth: RenderTooth[]) => priceBreakdown(pricing, teeth, DEFAULT_SET);
const line = (pricing: TenantPricing, teeth: RenderTooth[], startsWith: string) =>
  quote(pricing, teeth).lines.find((item) => item.label.startsWith(startsWith));

describe('diamond grade tiers (MAG-215)', () => {
  it('6 top 10K iced natural, no grade = $2,660', () => {
    expect(quote(LUCKEY, front(6)).total).toBe(2660);
    expect(line(LUCKEY, front(6), 'Metal')).toEqual({ label: 'Metal · 6 teeth', amount: 690 });
    expect(line(LUCKEY, front(6), 'Stones')).toEqual({ label: 'Stones', amount: 1920 });
    expect(line(LUCKEY, front(6), 'Natural VS1')).toBeUndefined();
  });

  it('6 top 10K iced natural VS1 = $6,560', () => {
    const teeth = front(6, { grade: 'natural-vs1' });
    expect(quote(LUCKEY, teeth).total).toBe(6560);
    expect(line(LUCKEY, teeth, 'Natural VS1')).toEqual({ label: 'Natural VS1 · 6 teeth', amount: 3900 });
  });

  it('6 top 10K iced lab Grown VVS = $3,200', () => {
    const teeth = front(6, { stone: 'lab', grade: 'grown-vvs' });
    expect(quote(LUCKEY, teeth).total).toBe(3200);
    expect(line(LUCKEY, teeth, 'Grown VVS')).toEqual({ label: 'Grown VVS · 6 teeth', amount: 1500 });
  });

  it('6 top 10K iced natural SI-VS = $5,360', () => {
    const teeth = front(6, { grade: 'natural-si-vs' });
    expect(quote(LUCKEY, teeth).total).toBe(5360);
    expect(line(LUCKEY, teeth, 'Natural SI-VS')).toEqual({ label: 'Natural SI-VS · 6 teeth', amount: 2700 });
  });

  it('12 top 10K iced natural VS1 stacks on the set price = $12,940', () => {
    const teeth = setOf(12, { grade: 'natural-vs1' });
    expect(quote(LUCKEY, teeth).total).toBe(12940);
    expect(line(LUCKEY, teeth, 'Set price')).toEqual({ label: 'Set price · 10K · 12 teeth', amount: -130 });
    expect(line(LUCKEY, teeth, 'Natural VS1')).toEqual({ label: 'Natural VS1 · 12 teeth', amount: 7800 });
  });

  it('stacks on a market quote, like any stone price = $6,710', () => {
    const quoted: TenantPricing = {
      ...LUCKEY,
      market: { ...MARKET_DEFAULTS, enabled: true, quote: { asOf: '2026-11-25', gold: 4000, silver: 50, platinum: 1600, perTooth: { 'yellow:10k': 140 } } },
    };
    const teeth = front(6, { grade: 'natural-vs1' });
    const breakdown = quote(quoted, teeth);
    expect(breakdown.total).toBe(6710);
    expect(breakdown.market).toBeDefined();
    expect(line(quoted, teeth, 'Set price')).toBeUndefined();
    expect(line(quoted, teeth, 'Natural VS1')).toEqual({ label: 'Natural VS1 · 6 teeth', amount: 3900 });
  });

  it('stacks on an all-in iced price = $6,350', () => {
    const allIn: TenantPricing = { ...LUCKEY, icedPerTooth: { natural: { '10k': 400 } } };
    const teeth = front(6, { grade: 'natural-vs1' });
    expect(quote(allIn, teeth).total).toBe(6350);
    expect(line(allIn, teeth, 'Iced')).toEqual({ label: 'Iced · 6 teeth', amount: 2400 });
    expect(line(allIn, teeth, 'Natural VS1')).toEqual({ label: 'Natural VS1 · 6 teeth', amount: 3900 });
    expect(line(allIn, teeth, 'Stones')).toBeUndefined();
    expect(line(allIn, teeth, 'Metal')).toBeUndefined();
  });

  it('takes the open-face border share, like the stone price = $3,740', () => {
    const openFace: TenantPricing = { ...LUCKEY, icedOpenFace: { stoneShare: 50 } };
    const teeth = front(6, { style: 'open-face', grade: 'natural-vs1' });
    expect(quote(openFace, teeth).total).toBe(3740);
    expect(line(openFace, teeth, 'Style & finish')).toEqual({ label: 'Style & finish', amount: 90 });
    expect(line(openFace, teeth, 'Stones')).toEqual({ label: 'Stones', amount: 960 });
    expect(line(openFace, teeth, 'Natural VS1')).toEqual({ label: 'Natural VS1 · 6 teeth', amount: 1950 });
  });

  it('sits in the % volume-discount base, like colour and extras = $11,768', () => {
    const volume: TenantPricing = { ...LUCKEY, setPrices: undefined, volume: [{ minTeeth: 12, percentOff: 10 }] };
    const teeth = setOf(12, { grade: 'natural-vs1' });
    expect(quote(volume, teeth).total).toBe(11768);
    expect(line(volume, teeth, 'Set discount')).toEqual({ label: 'Set discount · 12 teeth, 10% off', amount: -1302 });
  });

  it('sits in the back-teeth delta = $9,815', () => {
    const positions: TenantPricing = { ...LUCKEY, setPrices: undefined, positions: { premolar: 50, molar: 50 } };
    const teeth = setOf(12, { grade: 'natural-vs1' });
    // Indices 0..11: 6 front (5..10), 3 premolar (3, 4, 11), 3 molar (0..2);
    // each back tooth is (115 + 320 + 650) × (0.5 − 1) = −542.5, × 6 = −3255.
    expect(quote(positions, teeth).total).toBe(9815);
    expect(line(positions, teeth, 'Back teeth')).toEqual({ label: 'Back teeth · 6 teeth', amount: -3255 });
  });

  it('two-tone: upper natural VS1 + lower lab Grown VVS = $9,580, two grade lines', () => {
    const teeth: RenderTooth[] = [
      ...[5, 6, 7, 8, 9, 10].map((index) => ({ ...tooth('yellow', '10k', { grade: 'natural-vs1' }), index })),
      ...[21, 22, 23, 24, 25, 26].map((index) => ({ ...tooth('yellow', '10k', { stone: 'lab', grade: 'grown-vvs' }), index })),
    ];
    expect(quote(LUCKEY, teeth).total).toBe(9580);
    expect(line(LUCKEY, teeth, 'Natural VS1')).toEqual({ label: 'Natural VS1 · 6 teeth', amount: 3900 });
    expect(line(LUCKEY, teeth, 'Grown VVS')).toEqual({ label: 'Grown VVS · 6 teeth', amount: 1500 });
  });

  it('a grade on a plain tooth charges nothing', () => {
    const teeth = front(6, { type: 'plain', grade: 'natural-vs1' });
    expect(quote(LUCKEY, teeth).total).toBe(740);
    expect(line(LUCKEY, teeth, 'Natural VS1')).toBeUndefined();
  });

  it('a grade that does not pair with the stone charges nothing: lab + Natural VS1 = $1,700', () => {
    const teeth = front(6, { stone: 'lab', grade: 'natural-vs1' });
    expect(quote(LUCKEY, teeth).total).toBe(1700);
    expect(line(LUCKEY, teeth, 'Natural VS1')).toBeUndefined();
  });

  it('a grade that does not pair with the stone charges nothing: moissanite + Grown VVS = $1,190', () => {
    const teeth = front(6, { stone: 'moissanite', grade: 'grown-vvs' });
    expect(quote(LUCKEY, teeth).total).toBe(1190);
    expect(line(LUCKEY, teeth, 'Grown VVS')).toBeUndefined();
  });

  it('a grade on a photo tooth charges nothing = $990', () => {
    const teeth = front(6, { type: 'photo', grade: 'natural-vs1' });
    expect(quote(LUCKEY, teeth).total).toBe(990);
    expect(line(LUCKEY, teeth, 'Natural VS1')).toBeUndefined();
  });

  it('grade prices read back per tier', () => {
    expect(gradePrice(LUCKEY, 'grown-vvs')).toBe(250);
    expect(gradePrice(LUCKEY, 'natural-si-vs')).toBe(450);
    expect(gradePrice(LUCKEY, 'natural-vs1')).toBe(650);
    expect(gradePrice(VVSLAB_CONFIG.pricing, 'natural-vs1')).toBe(0);
  });
});

describe('grade pairing with the stone', () => {
  it('grown pairs with lab, natural tiers pair with natural, moissanite takes none', () => {
    expect(gradePairsWithStone('grown-vvs', 'lab')).toBe(true);
    expect(gradePairsWithStone('grown-vvs', 'natural')).toBe(false);
    expect(gradePairsWithStone('natural-si-vs', 'natural')).toBe(true);
    expect(gradePairsWithStone('natural-vs1', 'natural')).toBe(true);
    expect(gradePairsWithStone('natural-vs1', 'lab')).toBe(false);
    expect(gradePairsWithStone('grown-vvs', 'moissanite')).toBe(false);
    expect(gradesForStone('lab').map((grade) => grade.id)).toEqual(['grown-vvs']);
    expect(gradesForStone('natural').map((grade) => grade.id)).toEqual(['natural-si-vs', 'natural-vs1']);
    expect(gradesForStone('moissanite')).toEqual([]);
  });

  it('parse keeps a paired grade and strips the rest', () => {
    const spec = (extra: Partial<ToothDesign>): RenderSpec => ({
      ...DEFAULT_SET,
      teeth: [{ ...tooth('yellow', '10k'), index: 7, ...extra }],
    });
    expect(parseRenderSpec(spec({ grade: 'natural-vs1' }))?.teeth[0].grade).toBe('natural-vs1');
    expect(parseRenderSpec(spec({ stone: 'lab', grade: 'grown-vvs' }))?.teeth[0].grade).toBe('grown-vvs');
    expect(parseRenderSpec(spec({ type: 'plain', grade: 'natural-vs1' }))?.teeth[0].grade).toBeUndefined();
    expect(parseRenderSpec(spec({ stone: 'lab', grade: 'natural-vs1' }))?.teeth[0].grade).toBeUndefined();
    expect(parseRenderSpec(spec({ stone: 'moissanite', grade: 'grown-vvs' }))?.teeth[0].grade).toBeUndefined();
  });

  it('a shop that does not offer the tier rejects the design', () => {
    const graded: RenderSpec = { ...DEFAULT_SET, teeth: [{ ...tooth('yellow', '10k', { grade: 'natural-vs1' }), index: 7 }] };
    expect(parseRenderSpec(graded, { ...VVSLAB_CONFIG.catalog })).toBeNull();
    expect(parseRenderSpec(graded, { ...VVSLAB_CONFIG.catalog, grades: ['natural-vs1'] })?.teeth[0].grade).toBe('natural-vs1');
  });

  it('nearestOffered drops a grade when the stone changes to one it does not pair with', () => {
    const labOnly: TenantPricing = { ...VVSLAB_CONFIG.pricing, base: 0, icedPerTooth: { lab: { '10k': 300 } } };
    const design = tooth('yellow', '10k', { grade: 'natural-vs1' });
    const moved = nearestOffered(labOnly, design, ['moissanite', 'lab', 'natural'], ['10k', '14k']);
    expect(moved?.stone).toBe('lab');
    expect(moved?.grade).toBeUndefined();
    const naturalOnly: TenantPricing = { ...VVSLAB_CONFIG.pricing, base: 0, icedPerTooth: { natural: { '14k': 500 } } };
    const kept = nearestOffered(naturalOnly, design, ['moissanite', 'lab', 'natural'], ['10k', '14k']);
    expect(kept?.stone).toBe('natural');
    expect(kept?.karat).toBe('14k');
    expect(kept?.grade).toBe('natural-vs1');
  });
});

describe('grade in words', () => {
  it('describeTooth names the grade', () => {
    expect(describeTooth(tooth('yellow', '10k', { grade: 'natural-vs1' }))).toBe('Yellow gold 10K · Iced · Honeycomb · Natural diamond, Natural VS1');
    expect(describeTooth(tooth('yellow', '10k', { stone: 'lab', grade: 'grown-vvs' }))).toBe('Yellow gold 10K · Iced · Honeycomb · Lab diamond, Grown VVS');
    expect(describeTooth(tooth('yellow', '10k'))).toBe('Yellow gold 10K · Iced · Honeycomb · Natural diamond');
  });

  it('the render prompt names the exact stones', () => {
    const spec: RenderSpec = { ...DEFAULT_SET, teeth: [{ ...tooth('yellow', '10k', { grade: 'natural-vs1' }), index: 7 }] };
    expect(describeSpec(spec)).toContain('natural diamonds, VS1 clarity');
    const lab: RenderSpec = { ...DEFAULT_SET, teeth: [{ ...tooth('yellow', '10k', { stone: 'lab', grade: 'grown-vvs' }), index: 7 }] };
    expect(describeSpec(lab)).toContain('lab-grown diamonds, VVS clarity');
    const plain: RenderSpec = { ...DEFAULT_SET, teeth: [{ ...tooth('yellow', '10k'), index: 7 }] };
    expect(describeSpec(plain)).toContain('natural diamonds');
    expect(describeSpec(plain)).not.toContain('VS1');
  });

  it('a section edit on a graded tooth names the grade', () => {
    const spec: RenderSpec = {
      ...DEFAULT_SET,
      teeth: [
        { ...tooth('yellow', '10k', { grade: 'natural-vs1' }), index: 7 },
        { ...tooth('yellow', '10k', { type: 'plain' }), index: 8 },
      ],
    };
    const plans = planMasks(spec);
    const graded = plans.find((plan) => plan.indices.includes(7));
    expect(buildFillPrompt(spec, graded!)).toContain('natural diamonds, VS1 clarity');
    const plain = plans.find((plan) => plan.indices.includes(8));
    expect(buildFillPrompt(spec, plain!)).not.toContain('VS1');
  });
});

describe('grade in the shop config', () => {
  const withGrades = (grades: string[], prices?: Record<string, number>) => ({
    ...VVSLAB_CONFIG,
    catalog: { ...VVSLAB_CONFIG.catalog, grades },
    pricing: { ...VVSLAB_CONFIG.pricing, ...(prices ? { gradePerTooth: prices } : {}) },
  });

  it('a tier with no price blocks saving', () => {
    const parsed = parseTenantConfig(withGrades(['grown-vvs']));
    expect(parsed.ok).toBe(false);
    if (!parsed.ok) expect(parsed.issues).toContainEqual({ path: 'pricing.gradePerTooth.grown-vvs', message: 'Add a price for grown-vvs.' });
  });

  it('a tier with a price saves, and a config without grades still validates', () => {
    expect(parseTenantConfig(withGrades(['grown-vvs'], { 'grown-vvs': 250 })).ok).toBe(true);
    expect(parseTenantConfig(VVSLAB_CONFIG).ok).toBe(true);
  });

  it('prices for tiers turned off are pruned', () => {
    const parsed = parseTenantConfig(withGrades(['grown-vvs'], { 'grown-vvs': 250, 'natural-vs1': 650 }));
    expect(parsed.ok).toBe(true);
    if (parsed.ok) expect(parsed.config.pricing.gradePerTooth).toEqual({ 'grown-vvs': 250 });
  });

  it('the publish diff names the toggle and the price', () => {
    const added = withGrades(['natural-vs1'], { 'natural-vs1': 650 });
    const parsedAdded = parseTenantConfig(added);
    expect(parsedAdded.ok).toBe(true);
    if (!parsedAdded.ok) return;
    const changes = describeChanges(VVSLAB_CONFIG, parsedAdded.config);
    expect(changes).toContainEqual({ area: 'What you sell', text: 'Diamond grades: added Natural VS1' });
    const repriced = withGrades(['natural-vs1'], { 'natural-vs1': 700 });
    const parsedRepriced = parseTenantConfig(repriced);
    expect(parsedRepriced.ok).toBe(true);
    if (!parsedRepriced.ok) return;
    expect(describeChanges(parsedAdded.config, parsedRepriced.config)).toContainEqual({ area: 'Prices', text: 'Natural VS1: $650 → $700 grade per tooth' });
  });
});
