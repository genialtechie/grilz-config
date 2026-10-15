// The grillz design catalog: every option in the builder, its sample price,
// validation, and the AI render prompt. Shared by the browser and /api/render.
// The client sends a structured design; the prompt is always built on the
// server so the endpoint cannot be used as a general-purpose image generator.

const card = (id: string) => `/assets/options/grillz/${id}.webp`;

export const GRILLZ_TYPES = [
  { id: 'plain', label: 'Plain', detail: 'Solid polished metal', image: card('type-plain') },
  { id: 'iced', label: 'Iced out', detail: 'Set with stones', image: card('type-iced') },
  { id: 'photo', label: 'Photo grillz', detail: 'Your image on the teeth', image: card('type-photo') },
] as const;

export const METALS = [
  { id: 'yellow', label: 'Yellow gold', swatch: '#d9ad45', image: card('metal-yellow'), render: 'yellow gold, warm rich gold colour' },
  { id: 'white', label: 'White gold', swatch: '#e4e2da', image: card('metal-white'), render: 'white gold, cool bright rhodium-plated white metal (not champagne, not yellow)' },
  { id: 'rose', label: 'Rose gold', swatch: '#c28b83', image: card('metal-rose'), render: 'rose gold, soft pinkish copper-gold colour' },
  { id: 'silver', label: 'Sterling silver', swatch: '#c9cdd1', image: card('metal-silver'), render: 'sterling silver, bright cool silver' },
  { id: 'platinum', label: 'Platinum', swatch: '#bec5c9', image: card('metal-platinum'), render: 'platinum, cool bright silver-white metal' },
] as const;

export const KARATS = [
  { id: '10k', label: '10K', detail: 'Most durable' },
  { id: '14k', label: '14K', detail: 'Richer colour' },
  { id: '18k', label: '18K', detail: 'Premium' },
] as const;

export const STYLES = [
  { id: 'solid', label: 'Solid', detail: 'Clean mirror polish', image: card('style-solid'), render: 'a smooth mirror-polished solid finish' },
  { id: 'open-face', label: 'Open-face', detail: 'Metal frame, tooth shows', image: card('style-open-face'), render: 'open-face windows: each of these teeth is a thin metal outline frame with the natural white tooth visible in the middle' },
  { id: 'diamond-cut', label: 'Diamond-cut', detail: 'Faceted, throws light', image: card('style-diamond-cut'), render: 'a diamond-cut finish: sharp geometric facets cut into the metal that throw bright light' },
  { id: 'diamond-dust', label: 'Diamond-dust', detail: 'Sparkly textured metal', image: card('style-diamond-dust'), render: 'a diamond-dust finish: a fine sparkling glitter texture across the metal surface' },
  { id: 'engraving', label: 'Engraving', detail: 'Hand-engraved patterns', image: card('style-engraving'), render: 'ornate hand-engraved scroll patterns across the metal surface' },
  { id: 'opals', label: 'Opals', detail: 'Inlaid opal stones', image: card('style-opals'), render: 'inlaid iridescent white fire opal panels set into the front of each tooth' },
] as const;

export const SETTINGS = [
  { id: 'honeycomb', label: 'Honeycomb', detail: 'Tight hexagon pavé', image: card('setting-honeycomb'), render: 'tight pave: small round stones packed edge to edge in a honeycomb pattern, covering the whole face with no gaps or openings' },
  { id: 'mosaic', label: 'Mosaic', detail: 'Mixed stone sizes', image: card('setting-mosaic'), render: 'a mosaic setting of mixed stone sizes, larger stones surrounded by smaller ones' },
  { id: 'prong', label: 'Prong', detail: 'Uniform rows', image: card('setting-prong'), render: 'a uniform prong setting in neat rows of equal round stones' },
] as const;

export const STONES = [
  { id: 'moissanite', label: 'Moissanite', detail: 'VVS, passes diamond tester', image: card('stone-moissanite'), render: 'moissanite stones' },
  { id: 'lab', label: 'Lab diamond', detail: 'Real diamond, lab-grown', image: card('stone-lab'), render: 'lab-grown diamonds' },
  { id: 'natural', label: 'Natural diamond', detail: 'VS clarity', image: card('stone-natural'), render: 'natural diamonds' },
] as const;

export const FANG_OPTIONS = [
  { id: 'no', label: 'No fangs', detail: 'Natural canines', image: card('fangs-no') },
  { id: 'yes', label: 'Fangs', detail: 'Extended canine caps', image: card('fangs-yes') },
] as const;

export const CUTS = [
  { id: 'deep', label: 'Deep cut', detail: 'Natural tooth lines, removable', image: card('cut-deep') },
  { id: 'permanent', label: 'Permanent look', detail: 'Seamless, custom-fit cap', image: card('cut-permanent') },
] as const;

export const MOLDS = [
  { id: 'kit', label: 'Mold kit by mail', detail: 'We ship a kit, you send it back' },
  { id: 'own', label: 'I have a mold or scan', detail: 'Dentist mold or STL file' },
  { id: 'store', label: 'In-store fitting', detail: 'Book a visit' },
] as const;

type Id<T extends readonly { id: string }[]> = T[number]['id'];
export type GrillzType = Id<typeof GRILLZ_TYPES>;
export type MetalId = Id<typeof METALS>;
export type KaratId = Id<typeof KARATS>;
export type StyleId = Id<typeof STYLES>;
export type SettingId = Id<typeof SETTINGS>;
export type StoneId = Id<typeof STONES>;
export type CutId = Id<typeof CUTS>;
export type MoldId = Id<typeof MOLDS>;

/** The design of one tooth. Teeth in a set can differ (e.g. front two plain, rest iced). */
export type ToothDesign = {
  metal: MetalId;
  karat: KaratId;
  type: GrillzType;
  style: StyleId;
  setting: SettingId;
  stone: StoneId;
};

/** Options that apply to the whole set. */
export const INSCRIPTION_STYLES = [
  { id: 'cut', label: 'Diamond-cut', detail: 'Bold faceted letters', price: 75, render: 'bold raised diamond-cut metal letters with sharp faceted edges that catch the light' },
  { id: 'iced', label: 'Iced letters', detail: 'Letters set with stones', price: 150, render: 'raised letters paved with small sparkling stones' },
  { id: 'engraved', label: 'Engraved', detail: 'Cut into the metal', price: 50, render: 'crisp letters engraved into the metal surface' },
] as const;
export type InscriptionStyleId = Id<typeof INSCRIPTION_STYLES>;
export const INSCRIPTION_MAX = 6;
const INSCRIPTION_PATTERN = /^[A-Za-z0-9&$#!.' -]{1,6}$/;

export type Inscription = { text: string; tooth: number; style: InscriptionStyleId };

export type SetOptions = {
  fangs: boolean;
  cut: CutId;
  vision: string;
  inscription: Inscription | null;
};

export type RenderTooth = ToothDesign & { index: number };
export type RenderSpec = SetOptions & { teeth: RenderTooth[] };

export const VISION_MAX = 500;

export const DEFAULT_TOOTH: ToothDesign = {
  metal: 'yellow',
  karat: '10k',
  type: 'plain',
  style: 'solid',
  setting: 'honeycomb',
  stone: 'moissanite',
};

export const DEFAULT_SET: SetOptions = { fangs: false, cut: 'deep', vision: '', inscription: null };

export const isGold = (metal: MetalId) => metal === 'yellow' || metal === 'white' || metal === 'rose';

// ---- Sample pricing (a jeweler would configure their own) ----
const METAL_PER_TOOTH: Record<MetalId, number> = { yellow: 150, white: 150, rose: 150, silver: 85, platinum: 320 };
const KARAT_MULTIPLIER: Record<KaratId, number> = { '10k': 1, '14k': 1.4, '18k': 1.85 };
const STYLE_PER_TOOTH: Record<StyleId, number> = { solid: 0, 'open-face': 40, 'diamond-cut': 35, 'diamond-dust': 30, engraving: 45, opals: 90 };
const STONE_PER_TOOTH: Record<StoneId, number> = { moissanite: 75, lab: 160, natural: 320 };
const SETTING_PER_TOOTH: Record<SettingId, number> = { honeycomb: 0, mosaic: 25, prong: 0 };
export const PRICES = { base: 200, fangs: 150, permanent: 100, photo: 250 } as const;

export const metalPerTooth = (metal: MetalId, karat: KaratId) =>
  Math.round(METAL_PER_TOOTH[metal] * (isGold(metal) ? KARAT_MULTIPLIER[karat] : 1));

export const priceBreakdown = (teeth: ToothDesign[], set: SetOptions) => {
  const lines: { label: string; amount: number }[] = [{ label: 'Service fee', amount: PRICES.base }];
  if (teeth.length === 0) return { lines, total: PRICES.base };
  const sum = (fn: (tooth: ToothDesign) => number) => teeth.reduce((total, tooth) => total + fn(tooth), 0);
  const add = (label: string, amount: number) => amount && lines.push({ label, amount });
  add(`Metal · ${teeth.length} teeth`, sum((tooth) => metalPerTooth(tooth.metal, tooth.karat)));
  add('Style & finish', sum((tooth) => (tooth.type === 'iced' ? 0 : STYLE_PER_TOOTH[tooth.style])));
  add('Stones', sum((tooth) => (tooth.type === 'iced' ? STONE_PER_TOOTH[tooth.stone] : 0)));
  add('Mosaic setting', sum((tooth) => (tooth.type === 'iced' ? SETTING_PER_TOOTH[tooth.setting] : 0)));
  if (teeth.some((tooth) => tooth.type === 'photo')) add('Photo artwork', PRICES.photo);
  if (set.fangs) add('Fangs', PRICES.fangs);
  if (set.cut === 'permanent') add('Permanent look', PRICES.permanent);
  if (set.inscription) add(`Inscription "${set.inscription.text}"`, INSCRIPTION_STYLES.find((item) => item.id === set.inscription!.style)!.price);
  return { lines, total: lines.reduce((total, line) => total + line.amount, 0) };
};

export const priceHint = {
  metal: (metal: MetalId, karat: KaratId) => `$${metalPerTooth(metal, karat)} / tooth`,
  style: (style: StyleId) => (STYLE_PER_TOOTH[style] ? `+$${STYLE_PER_TOOTH[style]} / tooth` : 'Included'),
  stone: (stone: StoneId) => `+$${STONE_PER_TOOTH[stone]} / tooth`,
  setting: (setting: SettingId) => (SETTING_PER_TOOTH[setting] ? `+$${SETTING_PER_TOOTH[setting]} / tooth` : 'Included'),
  type: (type: GrillzType) => (type === 'photo' ? `+$${PRICES.photo} artwork` : type === 'iced' ? 'Stones priced next' : 'Included'),
};

export const label = <T extends readonly { id: string; label: string }[]>(list: T, id: string) =>
  list.find((item) => item.id === id)?.label ?? id;

const designKey = (tooth: ToothDesign) =>
  [tooth.metal, isGold(tooth.metal) ? tooth.karat : '', tooth.type, tooth.style, tooth.type === 'iced' ? `${tooth.setting}/${tooth.stone}` : ''].join('|');

/** Groups teeth that share a design, largest group first. */
export const groupTeeth = <T extends ToothDesign & { index: number }>(teeth: T[]) => {
  const groups = new Map<string, T[]>();
  teeth.forEach((tooth) => groups.set(designKey(tooth), [...(groups.get(designKey(tooth)) ?? []), tooth]));
  return [...groups.values()].sort((a, b) => b.length - a.length);
};

export const describeTooth = (tooth: ToothDesign) => {
  const metal = `${label(METALS, tooth.metal)}${isGold(tooth.metal) ? ` ${label(KARATS, tooth.karat)}` : ''}`;
  const surface =
    tooth.type === 'iced'
      ? `Iced · ${label(SETTINGS, tooth.setting)} · ${label(STONES, tooth.stone)}`
      : tooth.type === 'photo'
        ? 'Photo'
        : label(STYLES, tooth.style);
  const extraStyle = tooth.type === 'photo' && tooth.style !== 'solid' ? ` + ${label(STYLES, tooth.style)}` : '';
  return `${metal} · ${surface}${extraStyle}`;
};

export const summarizeDesign = (spec: RenderSpec): string[] => {
  const upper = spec.teeth.filter((tooth) => tooth.index < 16).length;
  const lines = [`${upper} top + ${spec.teeth.length - upper} bottom`];
  const groups = groupTeeth(spec.teeth);
  groups.forEach((group) => lines.push(groups.length > 1 ? `${group.length}× ${describeTooth(group[0])}` : describeTooth(group[0])));
  if (spec.fangs) lines.push('Fangs');
  if (spec.inscription) lines.push(`"${spec.inscription.text}" on ${wearerToothName(spec.inscription.tooth)}`);
  lines.push(label(CUTS, spec.cut));
  return lines;
};

// ---- Validation (server side) ----
const oneOf = <T extends readonly { id: string }[]>(list: T, value: unknown): value is Id<T> =>
  typeof value === 'string' && list.some((item) => item.id === value);

const parseTooth = (value: unknown): RenderTooth | null => {
  if (!value || typeof value !== 'object') return null;
  const tooth = value as Record<string, unknown>;
  if (typeof tooth.index !== 'number' || !Number.isInteger(tooth.index) || tooth.index < 0 || tooth.index > 31) return null;
  if (!oneOf(METALS, tooth.metal) || !oneOf(KARATS, tooth.karat) || !oneOf(GRILLZ_TYPES, tooth.type)) return null;
  if (!oneOf(STYLES, tooth.style) || !oneOf(SETTINGS, tooth.setting) || !oneOf(STONES, tooth.stone)) return null;
  return { index: tooth.index, metal: tooth.metal, karat: tooth.karat, type: tooth.type, style: tooth.style, setting: tooth.setting, stone: tooth.stone };
};

export const parseRenderSpec = (value: unknown): RenderSpec | null => {
  if (!value || typeof value !== 'object') return null;
  const spec = value as Record<string, unknown>;
  if (!Array.isArray(spec.teeth) || spec.teeth.length === 0 || spec.teeth.length > 32) return null;
  const teeth = spec.teeth.map(parseTooth);
  if (teeth.some((tooth) => tooth === null)) return null;
  if (new Set(teeth.map((tooth) => tooth!.index)).size !== teeth.length) return null;
  if (!oneOf(CUTS, spec.cut) || typeof spec.fangs !== 'boolean') return null;
  if (typeof spec.vision !== 'string' || spec.vision.length > VISION_MAX) return null;
  let inscription: Inscription | null = null;
  if (spec.inscription !== undefined && spec.inscription !== null) {
    const raw = spec.inscription as Record<string, unknown>;
    if (typeof raw.text !== 'string' || !INSCRIPTION_PATTERN.test(raw.text.trim())) return null;
    if (!oneOf(INSCRIPTION_STYLES, raw.style)) return null;
    if (!(teeth as RenderTooth[]).some((tooth) => tooth.index === raw.tooth)) return null;
    inscription = { text: raw.text.trim(), tooth: raw.tooth as number, style: raw.style };
  }
  return {
    teeth: (teeth as RenderTooth[]).sort((a, b) => a.index - b.index),
    fangs: spec.fangs,
    cut: spec.cut,
    inscription,
    // Keep the customer's note to plain printable text.
    vision: spec.vision.replace(/[^\p{L}\p{N}\p{P}\p{Zs}$+=<>^`|~]/gu, ' ').trim(),
  };
};

// ---- Prompt ----
const TOOTH_NAMES = ['central incisor', 'lateral incisor', 'canine', 'first premolar', 'second premolar', 'molar'];

const toothName = (index: number) => {
  const row = index < 16 ? 'upper' : 'lower';
  const position = index % 16;
  const fromCentre = position < 8 ? 7 - position : position - 8;
  return `${row} ${TOOTH_NAMES.at(Math.min(fromCentre, 5))}`;
};

const describeLocation = (indices: number[], allCount: number) => {
  if (indices.length === allCount) return 'all of the grillz teeth';
  const counts = new Map<string, number>();
  indices.forEach((index) => counts.set(toothName(index), (counts.get(toothName(index)) ?? 0) + 1));
  return [...counts.entries()].map(([name, count]) => (count > 1 ? `the ${count} ${name}s` : `one ${name}`)).join(', ');
};

const pick = <T extends readonly { id: string }[]>(list: T, id: string): T[number] => list.find((item) => item.id === id)!;

const describeDesign = (tooth: ToothDesign) => {
  const metal = `${isGold(tooth.metal) ? `${tooth.karat.toUpperCase()} ` : ''}${pick(METALS, tooth.metal).render}`;
  if (tooth.type === 'iced') {
    // Stones cover the whole face of an iced tooth, so the finish (open-face, engraving…) does not apply.
    return `${metal}, fully iced out: the entire front face is covered edge to edge in sparkling ${pick(STONES, tooth.stone).render} set in ${pick(SETTINGS, tooth.setting).render}; solid, no openings or cut-outs`;
  }
  if (tooth.type === 'photo') {
    return `${metal} with a custom photo-realistic picture engraved and enamelled on the front, based on the reference image if one is provided`;
  }
  return `${metal} with ${pick(STYLES, tooth.style).render}`;
};

const rowText = (count: number, row: 'upper' | 'lower') =>
  count === 0 ? `no grillz on the ${row} teeth` : count === 16 ? `every ${row} tooth` : `${count} ${row} teeth`;

const shortDesign = (tooth: ToothDesign) => {
  const metal = `${isGold(tooth.metal) ? `${tooth.karat.toUpperCase()} ` : ''}${label(METALS, tooth.metal).toLowerCase()}`;
  if (tooth.type === 'iced') {
    return `ICED OUT, the whole face covered in sparkling ${pick(STONES, tooth.stone).render} (${label(SETTINGS, tooth.setting).toLowerCase()} setting) in ${metal}, no openings`;
  }
  if (tooth.type === 'photo') return `PHOTO ENGRAVED, ${metal}`;
  return `${label(STYLES, tooth.style).toUpperCase()} ${metal}, no stones`;
};

// The model numbers each row from the viewer's right (index 0) to the viewer's left (index 15),
// so higher indices sit further to the viewer's left in a front view.
const rowLayout = (teeth: RenderTooth[], row: 'upper' | 'lower') => {
  const inRow = teeth.filter((tooth) => (row === 'upper' ? tooth.index < 16 : tooth.index >= 16)).sort((a, b) => b.index - a.index);
  if (!inRow.length) return '';
  const items = inRow.map((tooth, position) => `(${position + 1}) ${toothName(tooth.index).replace(`${row} `, '')}: ${shortDesign(tooth)}`);
  return `${row === 'upper' ? 'Upper' : 'Lower'} row, listed tooth by tooth from the viewer's LEFT to the viewer's RIGHT in this front view: ${items.join('; ')}.`;
};

export const describeSpec = (spec: RenderSpec): string => {
  const upper = spec.teeth.filter((tooth) => tooth.index < 16).length;
  const groups = groupTeeth(spec.teeth);
  const parts = [`custom grillz covering ${rowText(upper, 'upper')} and ${rowText(spec.teeth.length - upper, 'lower')}`];
  groups.forEach((group) => {
    parts.push(`${describeLocation(group.map((tooth) => tooth.index), spec.teeth.length)}: ${describeDesign(group[0])}`);
  });
  if (groups.length > 1) {
    const layout = [rowLayout(spec.teeth, 'upper'), rowLayout(spec.teeth, 'lower')].filter(Boolean).join(' ');
    const counts = groups
      .map((group) => `exactly ${group.length} ${group.length === 1 ? 'tooth is' : 'teeth are'} ${shortDesign(group[0])}`)
      .join('; ');
    parts.push(
      `IMPORTANT, the teeth do NOT all match. ${layout} In total ${counts}. Never copy one tooth's design onto its neighbour or its mirror-image tooth; the 3D preview shows the same layout (sparkly = iced, smooth = metal)`,
    );
  }
  (['upper', 'lower'] as const).forEach((row) => {
    const count = spec.teeth.filter((tooth) => (row === 'upper' ? tooth.index < 16 : tooth.index >= 16)).length;
    if (count === 0) parts.push(`the ${row} row is completely bare natural white teeth: no metal, no outline, no frame, no gold line along the gums`);
  });
  if (spec.fangs) parts.push('the two upper canines are extended into long, sharp, clearly pointed fang caps');
  if (spec.cut === 'permanent') parts.push('the grillz look seamless and permanent, like custom fitted caps');
  return `${parts.join('; ')}.`;
};

export const buildRenderPrompt = (spec: RenderSpec, hasInspiration: boolean): string =>
  [
    'Turn this rough 3D preview into a professional high-end jewelry product photograph.',
    `The product is ${describeSpec(spec)}`,
    spec.vision
      ? `Customer notes (apply only if they describe the jewelry): "${spec.vision}". Apply each note to ONLY the tooth it names, never to the matching tooth on the other side; "left" and "right" in the notes mean the wearer's own left and right, which appear on the viewer's right and left in this front view.`
      : '',
    hasInspiration
      ? "The second image is the customer's inspiration reference: borrow its design details where they fit the spec above, but keep the tooth layout and camera of the first image."
      : '',
    'Only the teeth that are metal in the input are grillz; every other tooth stays a natural white tooth colour with no metal.',
    'Keep exactly the same teeth, tooth count, arrangement, camera angle and framing as the input.',
    'Show the grillz fitted on a clean matte white dental display mold, with nothing inside the open mouth.',
    'Seamless pure white studio background, soft diffused softbox lighting, crisp macro detail, realistic metal reflections, accurate metal colour.',
    'Photorealistic. No text, no watermark, no logos, no people in the scene.',
  ]
    .filter(Boolean)
    .join(' ');

// ---- Masked edits ----
// After the main render, targeted edits repaint just part of the photo inside a
// mask taken from the 3D model:
// - "group": tooth groups that differ from the majority (mixed designs)
// - "fangs": the two upper canines, mask stretched down so a point fits
// - "inscription": the customer's letters on the tooth they picked

export const MAX_MASKED_EDITS = 3;
export const FANG_TEETH = [5, 10];

export type MaskKind = 'group' | 'fangs' | 'inscription';
export type MaskPlan = { kind: MaskKind; indices: number[] };

/**
 * The edits to run, in execution order. Explicit paid extras (inscription,
 * fangs) win the slots first when the cap is hit; they still run last so a
 * group repaint never covers them.
 */
export const planMasks = (spec: Pick<RenderSpec, 'teeth' | 'fangs' | 'inscription'>): MaskPlan[] => {
  const priority: MaskPlan[] = [];
  if (spec.inscription) priority.push({ kind: 'inscription', indices: [spec.inscription.tooth] });
  if (spec.fangs) priority.push({ kind: 'fangs', indices: FANG_TEETH });
  groupTeeth(spec.teeth)
    .slice(1)
    .forEach((group) => priority.push({ kind: 'group', indices: group.map((tooth) => tooth.index) }));
  const order: Record<MaskKind, number> = { group: 0, fangs: 1, inscription: 2 };
  return priority.slice(0, MAX_MASKED_EDITS).sort((a, b) => order[a.kind] - order[b.kind]);
};

const SEAMLESS =
  'Match the surrounding metal colour, lighting, reflections and photo style exactly so the edit is seamless, and leave the gums and mold untouched.';

/** The prompt for one masked edit. Built on the server only. */
export const buildFillPrompt = (spec: RenderSpec, plan: MaskPlan): string | null => {
  const designOf = (index: number): ToothDesign => spec.teeth.find((tooth) => tooth.index === index) ?? groupTeeth(spec.teeth)[0][0];
  if (plan.kind === 'fangs') {
    const design = designOf(FANG_TEETH[0]);
    return [
      `Turn the two masked upper canine teeth into long, sharp, pointed fang caps made of ${shortDesign(design)}: ${describeDesign(design)}.`,
      'Each fang tapers to a clear point that reaches noticeably lower than the neighbouring teeth, like vampire fangs.',
      SEAMLESS,
      'Do not add any text, lettering or marks. Photorealistic high-end jewelry product photograph.',
    ].join(' ');
  }
  if (plan.kind === 'inscription') {
    if (!spec.inscription) return null;
    const design = designOf(spec.inscription.tooth);
    const style = INSCRIPTION_STYLES.find((item) => item.id === spec.inscription!.style)!;
    const text = spec.inscription.text;
    return [
      `On the masked grillz tooth (${shortDesign(design)}), add the characters "${text}" across its front face as ${style.render}.`,
      `Spell it exactly "${text}": ${text.length} character${text.length === 1 ? '' : 's'}, in this order, centred, upright and clearly legible. Nothing else is written anywhere.`,
      'Keep the tooth shape, size, metal and position the same.',
      SEAMLESS,
      'Photorealistic high-end jewelry product photograph.',
    ].join(' ');
  }
  const wanted = new Set(plan.indices);
  const teeth = spec.teeth.filter((tooth) => wanted.has(tooth.index));
  if (!teeth.length || teeth.length !== plan.indices.length) return null;
  const design = teeth[0];
  return [
    `Repaint only the masked grillz ${teeth.length === 1 ? 'tooth' : 'teeth'} as ${shortDesign(design)}: ${describeDesign(design)}.`,
    'Keep the same tooth shape, size and position.',
    SEAMLESS,
    'Do not add any text, lettering, numbers, labels or marks anywhere. Photorealistic high-end jewelry product photograph. No watermark.',
  ].join(' ');
};

/** "your upper left canine": side as the wearer sees it (index 0 is the wearer's left). */
export const wearerToothName = (index: number) => {
  const row = index < 16 ? 'upper' : 'lower';
  const position = index % 16;
  const fromCentre = position < 8 ? 7 - position : position - 8;
  const side = position < 8 ? 'left' : 'right';
  return `${row} ${side} ${TOOTH_NAMES.at(Math.min(fromCentre, 5))}`;
};
