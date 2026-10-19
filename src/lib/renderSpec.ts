// The grillz design catalog: every option in the builder, validation, and the
// AI render prompt. Shared by the browser and /api/render. Prices and which
// options a shop sells live in its tenant config (src/lib/tenant).
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
  { id: '22k', label: '22K', detail: 'Deepest yellow, softest' },
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
  { id: 'cut', label: 'Diamond-cut', detail: 'Bold faceted letters', render: 'bold raised diamond-cut metal letters with sharp faceted edges that catch the light' },
  { id: 'iced', label: 'Iced letters', detail: 'Letters set with stones', render: 'raised letters paved with small sparkling stones' },
  { id: 'engraved', label: 'Engraved', detail: 'Cut into the metal', render: 'crisp letters engraved into the metal surface' },
] as const;
export type InscriptionStyleId = Id<typeof INSCRIPTION_STYLES>;
export const INSCRIPTION_MAX = 6;
const INSCRIPTION_PATTERN = /^[A-Za-z0-9&$#!.' -]{1,6}$/;

export type Inscription = { text: string; tooth: number; style: InscriptionStyleId };

/** A shop's own extra (rush order, carrier case…): defined in its config, not the platform catalog. */
export type AddOn = { id: string; label: string; detail?: string; price: number; per: 'order' | 'tooth' };
export const ADD_ON_ID = /^[a-z0-9-]{1,40}$/;
export const MAX_ADD_ONS = 8;

export type SetOptions = {
  fangs: boolean;
  cut: CutId;
  /** Ids of the shop's add-ons the customer picked. */
  addOns?: string[];
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

/**
 * An iced tooth takes no finish except open face: stones on the rim, the
 * natural tooth showing through the middle.
 */
export const icedOpenFace = (tooth: Pick<ToothDesign, 'type' | 'style'>) => tooth.type === 'iced' && tooth.style === 'open-face';

export const label = <T extends readonly { id: string; label: string }[]>(list: T, id: string) =>
  list.find((item) => item.id === id)?.label ?? id;

const designKey = (tooth: ToothDesign) =>
  [tooth.metal, isGold(tooth.metal) ? tooth.karat : '', tooth.type, tooth.type === 'iced' && !icedOpenFace(tooth) ? 'solid' : tooth.style, tooth.type === 'iced' ? `${tooth.setting}/${tooth.stone}` : ''].join('|');

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
      ? `Iced${icedOpenFace(tooth) ? ' open face' : ''} · ${label(SETTINGS, tooth.setting)} · ${label(STONES, tooth.stone)}`
      : tooth.type === 'photo'
        ? 'Photo'
        : label(STYLES, tooth.style);
  const extraStyle = tooth.type === 'photo' && tooth.style !== 'solid' ? ` + ${label(STYLES, tooth.style)}` : '';
  return `${metal} · ${surface}${extraStyle}`;
};

export const summarizeDesign = (spec: RenderSpec, addOns: readonly Pick<AddOn, 'id' | 'label'>[] = []): string[] => {
  const upper = spec.teeth.filter((tooth) => tooth.index < 16).length;
  const lines = [`${upper} top + ${spec.teeth.length - upper} bottom`];
  const groups = groupTeeth(spec.teeth);
  groups.forEach((group) => lines.push(groups.length > 1 ? `${group.length}× ${describeTooth(group[0])}` : describeTooth(group[0])));
  if (spec.fangs) lines.push('Fangs');
  if (spec.inscription) lines.push(`"${spec.inscription.text}" on ${wearerToothName(spec.inscription.tooth)}`);
  lines.push(label(CUTS, spec.cut));
  (spec.addOns ?? []).forEach((id) => lines.push(addOns.find((addOn) => addOn.id === id)?.label ?? id));
  return lines;
};

// ---- Validation (server side) ----
const oneOf = <T extends readonly { id: string }[]>(list: T, value: unknown): value is Id<T> =>
  typeof value === 'string' && list.some((item) => item.id === value);

/** Which options a shop sells; validation rejects anything else. Omit to allow the whole catalog. */
export type EnabledOptions = {
  metals: readonly string[];
  karats: readonly string[];
  types: readonly string[];
  styles: readonly string[];
  settings: readonly string[];
  stones: readonly string[];
  cuts: readonly string[];
  fangs: boolean;
  inscription: { enabled: boolean; styles: readonly string[] };
  vision: boolean;
  addOns?: readonly Pick<AddOn, 'id'>[];
};

const parseTooth = (value: unknown): RenderTooth | null => {
  if (!value || typeof value !== 'object') return null;
  const tooth = value as Record<string, unknown>;
  if (typeof tooth.index !== 'number' || !Number.isInteger(tooth.index) || tooth.index < 0 || tooth.index > 31) return null;
  if (!oneOf(METALS, tooth.metal) || !oneOf(KARATS, tooth.karat) || !oneOf(GRILLZ_TYPES, tooth.type)) return null;
  if (!oneOf(STYLES, tooth.style) || !oneOf(SETTINGS, tooth.setting) || !oneOf(STONES, tooth.stone)) return null;
  return { index: tooth.index, metal: tooth.metal, karat: tooth.karat, type: tooth.type, style: tooth.style, setting: tooth.setting, stone: tooth.stone };
};

const sells = (tooth: RenderTooth, enabled: EnabledOptions) =>
  enabled.metals.includes(tooth.metal) &&
  (!isGold(tooth.metal) || enabled.karats.includes(tooth.karat)) &&
  enabled.types.includes(tooth.type) &&
  (tooth.type === 'iced'
    ? enabled.settings.includes(tooth.setting) && enabled.stones.includes(tooth.stone) && (!icedOpenFace(tooth) || enabled.styles.includes(tooth.style))
    : enabled.styles.includes(tooth.style));

export const parseRenderSpec = (value: unknown, enabled?: EnabledOptions): RenderSpec | null => {
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
  const addOns = spec.addOns ?? [];
  if (!Array.isArray(addOns) || addOns.length > MAX_ADD_ONS || !addOns.every((id) => typeof id === 'string' && ADD_ON_ID.test(id))) return null;
  if (new Set(addOns).size !== addOns.length) return null;
  if (enabled) {
    const offered = new Set((enabled.addOns ?? []).map((addOn) => addOn.id));
    if (!addOns.every((id) => offered.has(id))) return null;
    if (!(teeth as RenderTooth[]).every((tooth) => sells(tooth, enabled))) return null;
    if (!enabled.cuts.includes(spec.cut) || (spec.fangs && !enabled.fangs)) return null;
    if (inscription && !(enabled.inscription.enabled && enabled.inscription.styles.includes(inscription.style))) return null;
    if (!enabled.vision && spec.vision.trim()) return null;
  }
  return {
    teeth: (teeth as RenderTooth[]).sort((a, b) => a.index - b.index),
    fangs: spec.fangs,
    cut: spec.cut,
    inscription,
    // Keep the customer's note to plain printable text.
    vision: spec.vision.replace(/[^\p{L}\p{N}\p{P}\p{Zs}$+=<>^`|~]/gu, ' ').trim(),
    ...(addOns.length ? { addOns: addOns as string[] } : {}),
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
  if (icedOpenFace(tooth)) {
    return `${metal}, iced open face: each tooth is a metal outline frame paved edge to edge with sparkling ${pick(STONES, tooth.stone).render} set in ${pick(SETTINGS, tooth.setting).render}, and the natural white tooth shows through the open middle of the frame`;
  }
  if (tooth.type === 'iced') {
    // Stones cover the whole face of an iced tooth, so other finishes (engraving…) do not apply.
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
  if (icedOpenFace(tooth)) {
    return `ICED OPEN FACE, a stone-paved metal frame with the natural white tooth showing in the middle (${label(SETTINGS, tooth.setting).toLowerCase()} setting, ${pick(STONES, tooth.stone).render}) in ${metal}`;
  }
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
  // Fangs are added by their own section edits; asking for them here makes the
  // model reshape the neighbouring teeth, which then no longer line up with the 3D masks.
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
    'Keep exactly the same teeth, tooth count, arrangement, camera angle and framing as the input: every tooth keeps the exact size, outline and position it has in the input, so the photo lines up with it pixel for pixel.',
    'Show the grillz fitted on a clean matte white dental display mold, with nothing inside the open mouth.',
    'Seamless pure white studio background, soft diffused softbox lighting, crisp macro detail, realistic metal reflections, accurate metal colour.',
    'Photorealistic. No text, no watermark, no logos, no people in the scene.',
  ]
    .filter(Boolean)
    .join(' ');

// ---- Section edits ----
// After the main render, each section of the set is repainted on its own: the
// server crops the photo around that section's mask (taken from the 3D model),
// edits the zoomed crop with a focused prompt, and blends the result back
// through the mask. Zoomed, single-purpose edits follow the design far more
// reliably than one prompt describing every tooth. Kinds:
// - "tooth": a run of adjacent teeth that share a design (mixed designs only)
// - "fangs": one upper canine, mask stretched down so a point fits
// - "inscription": the customer's letters on the tooth they picked
// - "bare": a row with no grillz, kept as plain white teeth

export const MAX_SECTION_EDITS = 10;
export const FANG_TEETH = [5, 10];

export type MaskKind = 'bare' | 'tooth' | 'fangs' | 'inscription';
export type MaskPlan = { kind: MaskKind; indices: number[] };

const KIND_ORDER: Record<MaskKind, number> = { bare: 0, tooth: 1, fangs: 2, inscription: 3 };

/** Splits teeth into runs of neighbours in the same row, at most `size` teeth per run. */
const runsOf = (indices: number[], size: number): number[][] => {
  const sorted = [...indices].sort((a, b) => a - b);
  const runs: number[][] = [];
  sorted.forEach((index) => {
    const last = runs.at(-1);
    const sameRow = last && Math.floor(last[0] / 16) === Math.floor(index / 16);
    if (last && sameRow && index === last.at(-1)! + 1 && last.length < size) last.push(index);
    else runs.push([index]);
  });
  return runs;
};

/**
 * The section edits to run, composited in this order (later ones win where they
 * overlap). Fangs and the inscription tooth get their own edits that include
 * the tooth's design, so they are left out of the "tooth" runs.
 */
export const planMasks = (spec: Pick<RenderSpec, 'teeth' | 'fangs' | 'inscription'>): MaskPlan[] => {
  const selected = new Set(spec.teeth.map((tooth) => tooth.index));
  const plans: MaskPlan[] = [];
  const special = new Set<number>();
  if (spec.inscription) {
    plans.push({ kind: 'inscription', indices: [spec.inscription.tooth] });
    special.add(spec.inscription.tooth);
  }
  if (spec.fangs) {
    FANG_TEETH.filter((index) => !special.has(index)).forEach((index) => {
      plans.push({ kind: 'fangs', indices: [index] });
      special.add(index);
    });
  }
  ([0, 16] as const).forEach((rowStart) => {
    const row = Array.from({ length: 16 }, (_, offset) => rowStart + offset);
    if (spec.teeth.length && !row.some((index) => selected.has(index))) plans.push({ kind: 'bare', indices: row });
  });
  const groups = groupTeeth(spec.teeth);
  if (groups.length > 1) {
    const budget = MAX_SECTION_EDITS - plans.length;
    // Smallest runs that fit the budget: single teeth zoom in best.
    for (const size of [1, 2, 3, 4, 16]) {
      const runs = groups.flatMap((group) => runsOf(group.map((tooth) => tooth.index).filter((index) => !special.has(index)), size));
      if (runs.length <= budget || size === 16) {
        runs.slice(0, Math.max(0, budget)).forEach((indices) => plans.push({ kind: 'tooth', indices }));
        break;
      }
    }
  }
  return plans.sort((a, b) => KIND_ORDER[a.kind] - KIND_ORDER[b.kind]);
};

const EDIT_STYLE =
  'Keep the same tooth shape, size and position, and match the lighting, reflections, white studio background and dental mold of the photo exactly. Photorealistic high-end jewelry macro photograph.';

/** Edit model per section: FLUX.2 [flex] is stronger at lettering. */
export const editModel = (plan: MaskPlan) => (plan.kind === 'inscription' ? 'flux-2-flex' : 'flux-2-pro');

/** The prompt for one section edit (on a zoomed crop). Built on the server only. */
export const buildFillPrompt = (spec: RenderSpec, plan: MaskPlan): string | null => {
  const designOf = (index: number): ToothDesign | undefined => spec.teeth.find((tooth) => tooth.index === index);
  if (plan.kind === 'bare') {
    return [
      'Make the teeth in this close-up clean natural white teeth, the same matte white as the dental display model: no metal, no gold, no stones, no grillz, no pink or peach tint.',
      'Keep their shape, size and position, and match the lighting and white studio background exactly. Photorealistic. No text.',
    ].join(' ');
  }
  if (plan.kind === 'fangs') {
    const design = designOf(plan.indices[0]) ?? groupTeeth(spec.teeth)[0][0];
    return [
      `Make the canine tooth in the centre of this close-up a long, sharp, pointed FANG grill cap: ${describeDesign(design)}.`,
      'The fang tapers to a clear point that reaches noticeably lower than the neighbouring teeth, like a vampire fang.',
      'Match the lighting, reflections, white studio background and dental mold of the photo exactly. Photorealistic high-end jewelry macro photograph. No text.',
    ].join(' ');
  }
  if (plan.kind === 'inscription') {
    if (!spec.inscription) return null;
    const design = designOf(spec.inscription.tooth) ?? groupTeeth(spec.teeth)[0][0];
    const style = INSCRIPTION_STYLES.find((item) => item.id === spec.inscription!.style)!;
    const text = spec.inscription.text;
    return [
      `Make the grillz tooth in the centre of this close-up ${describeDesign(design)}, and add the characters "${text}" across its front face as ${style.render}.`,
      `Spell it exactly "${text}": ${text.length} character${text.length === 1 ? '' : 's'} (${text.split('').join(', ')}), in this order, centred, upright and clearly legible, in the same metal as the tooth. Nothing else is written anywhere.`,
      EDIT_STYLE,
    ].join(' ');
  }
  const teeth = plan.indices.map(designOf);
  if (!teeth.length || teeth.some((tooth) => !tooth)) return null;
  const design = teeth[0]!;
  const what = teeth.length === 1 ? 'the grillz tooth in the centre of this close-up' : `the ${teeth.length} neighbouring grillz teeth in the centre of this close-up`;
  return [
    `Make ${what} ${shortDesign(design)}: ${describeDesign(design)}.`,
    EDIT_STYLE,
    'No text, lettering, numbers or marks.',
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
