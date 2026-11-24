// The creator's design, as pure functions (no React): which teeth are in the set, what each one is
// made of, and the set's own options. Ported from the signed-off Grill Creator Lab
// (docs/redesign/creator-lab/src/10-core.js and 50-ui.js), on the real app's catalogue and prices:
// renderSpec for the options, the shop's tenant config for what it sells, lib/pricing for the price.
// Tooth numbering is the app's: 0–15 upper, 16–31 lower, the wearer's left first; 7 and 8 are the
// upper centrals, 5 and 10 the upper canines (the same numbering the lab used).
import {
  FANG_TEETH,
  ICED_FINISHES,
  INSCRIPTION_CHARS,
  INSCRIPTION_MAX,
  INSCRIPTION_PER_TOOTH,
  INSCRIPTION_SPAN_MAX,
  INSCRIPTION_STYLES,
  KARATS,
  METALS,
  OPALS,
  SETTINGS,
  STONES,
  STYLES,
  isGold,
  label,
  type Charm,
  type CharmId,
  type CutId,
  type EnamelId,
  type Inscription,
  type InscriptionFontId,
  type InscriptionStyleId,
  type MoldId,
  type RenderSpec,
  type SetOptions,
  type ToothDesign,
} from '../../lib/renderSpec';
import { nearestOffered, priceBreakdown, type PriceBreakdown } from '../../lib/pricing';
import type { DesignSnapshot } from '../../lib/savedDesign';
import type { Tenant } from '../../lib/tenant/tenant';
import { autoRun, fitsTeeth, type InscriptionDraft } from '../../lib/inscriptionDrafts';

export type Shop = Pick<Tenant, 'slug' | 'config' | 'catalog' | 'defaultTooth' | 'defaultSet'>;

/**
 * Letters on the set (the old builder's options in the lab's Extras row, Nov 18): the text, its lettering
 * (block or script), its finish, enamel in engraved letters, and the run of neighbouring teeth in one row
 * it goes across. No teeth = an automatic run centred on the front of the set, as many as the letters need.
 */
export type Initials = { text: string; style: InscriptionStyleId; font: InscriptionFontId; enamel: EnamelId | null; teeth: number[] };

export type Design = {
  /** The teeth in the set, sorted. */
  teeth: number[];
  /** What a tooth added to the set starts as (the lab's DEF). */
  base: ToothDesign;
  /** Every tooth in the set carries its own design. */
  designs: Record<number, ToothDesign>;
  fangs: boolean;
  cut: CutId;
  mold?: MoldId;
  addOns: string[];
  initials: Initials;
  /** A second line of letters, on the other row (owner, Nov 18). No text = none. */
  second: Initials;
  /** One-of-one charms: tooth → charm. */
  charms: Record<number, CharmId>;
  /** Their own words (typed in Extras, or said to the AI): goes to the shop as their idea. */
  idea: string;
};

export const PARTS = [
  { id: 'teeth', label: 'Teeth' },
  { id: 'metal', label: 'Metal' },
  { id: 'finish', label: 'Finish' },
  { id: 'stones', label: 'Stones' },
  { id: 'extras', label: 'Extras' },
] as const;
export type PartId = (typeof PARTS)[number]['id'];

/** The sets on the Teeth part, as the lab lists them. */
export const SETS = [
  { label: '6 × 6', top: 6, bottom: 6 },
  { label: '8 × 8', top: 8, bottom: 8 },
  { label: '6 top', top: 6, bottom: 0 },
  { label: '8 top', top: 8, bottom: 0 },
  { label: '6 bottom', top: 0, bottom: 6 },
  { label: '8 bottom', top: 0, bottom: 8 },
  { label: '2 piece', top: 2, bottom: 0 },
  { label: 'Single', top: 1, bottom: 0 },
  { label: '10 × 10', top: 10, bottom: 10 },
  { label: 'Full set', top: 16, bottom: 16 },
] as const;

export function blankDesign(shop: Shop): Design {
  return {
    teeth: [],
    base: { ...shop.defaultTooth },
    designs: {},
    fangs: false,
    cut: shop.defaultSet.cut,
    mold: shop.defaultSet.mold,
    addOns: [],
    initials: { text: '', style: shop.catalog.inscriptionStyles[0]?.id ?? 'engraved', font: 'block', enamel: null, teeth: [] },
    second: { text: '', style: shop.catalog.inscriptionStyles[0]?.id ?? 'engraved', font: 'block', enamel: null, teeth: [] },
    charms: {},
    idea: '',
  };
}

const sorted = (list: number[]) => [...new Set(list)].sort((a, b) => a - b);

/** A row's teeth, centred: `count` of 16, starting at `offset` (0 upper, 16 lower). */
export const centred = (count: number, offset = 0) => {
  const start = Math.floor((16 - count) / 2);
  return Array.from({ length: Math.max(0, Math.min(16, count)) }, (_, i) => offset + start + i);
};

export const counts = (d: Pick<Design, 'teeth'>): [number, number] => {
  const top = d.teeth.filter((k) => k < 16).length;
  return [top, d.teeth.length - top];
};

/** The set becomes `top` upper and `bottom` lower teeth, centred. New teeth take the base design. */
export function setRange(d: Design, top: number, bottom: number): Design {
  const teeth = sorted([...centred(top), ...centred(bottom, 16)]);
  const designs: Record<number, ToothDesign> = {};
  teeth.forEach((k) => {
    designs[k] = d.designs[k] ?? { ...d.base };
  });
  return { ...d, teeth, designs, charms: keepCharms(d.charms, teeth) };
}

/** The charms on teeth still in the set. */
const keepCharms = (charms: Design['charms'], teeth: readonly number[]) => Object.fromEntries(Object.entries(charms).filter(([k]) => teeth.includes(Number(k)))) as Design['charms'];

/** Adds a tooth to the set, or takes it out. */
export function toggleTooth(d: Design, k: number): Design {
  if (d.teeth.includes(k)) {
    const designs = { ...d.designs };
    delete designs[k];
    const teeth = d.teeth.filter((x) => x !== k);
    return { ...d, teeth, designs, charms: keepCharms(d.charms, teeth) };
  }
  return { ...d, teeth: sorted([...d.teeth, k]), designs: { ...d.designs, [k]: { ...d.base } } };
}

/** Is the set centred in each row (so it reads as "6 × 6" rather than "12 teeth")? */
export function isCentred(d: Pick<Design, 'teeth'>) {
  const [top, bottom] = counts(d);
  const want = [...centred(top), ...centred(bottom, 16)];
  return want.length === d.teeth.length && want.every((k) => d.teeth.includes(k));
}

/** "6 × 6", "8 top", or "5 teeth" when the set isn't one of the named ones. */
export function setLabel(d: Pick<Design, 'teeth'>) {
  const n = d.teeth.length;
  if (!n) return 'No teeth yet';
  const [top, bottom] = counts(d);
  const named = SETS.find((s) => s.top === top && s.bottom === bottom);
  return named && isCentred(d) ? named.label : `${n} ${n === 1 ? 'tooth' : 'teeth'}`;
}

// ---------- quick groups: teeth in the set to edit together ----------
export const GROUPS = [
  { id: 'top', label: 'Top row' },
  { id: 'bottom', label: 'Bottom row' },
  { id: 'front', label: 'Front teeth' },
  { id: 'canines', label: 'Canines' },
  { id: 'alt', label: 'Every other' },
] as const;
export type GroupId = (typeof GROUPS)[number]['id'];

const FRONT = [6, 7, 8, 9, 22, 23, 24, 25];
const CANINES = [5, 10, 21, 26];

/** The teeth of the set in a quick group. */
export function groupTeeth(teeth: readonly number[], g: GroupId): number[] {
  const on = sorted([...teeth]);
  if (g === 'top') return on.filter((k) => k < 16);
  if (g === 'bottom') return on.filter((k) => k >= 16);
  if (g === 'front') return on.filter((k) => FRONT.includes(k));
  if (g === 'canines') return on.filter((k) => CANINES.includes(k));
  // Every other: alternate teeth along each row, starting from its first.
  return [on.filter((k) => k < 16), on.filter((k) => k >= 16)].flatMap((row) => row.filter((_, i) => i % 2 === 0));
}

const sameSet = (a: readonly number[], b: readonly number[]) => a.length === b.length && a.every((x) => b.includes(x));

/** The groups worth offering: not empty, and not the whole set (that's "Whole set"). */
export function offeredGroups(teeth: readonly number[]) {
  return GROUPS.filter((g) => {
    const t = groupTeeth(teeth, g.id);
    return t.length > 0 && t.length < teeth.length;
  });
}

/** Which group the picked teeth are, if they are exactly one. */
export function matchingGroup(teeth: readonly number[], picks: readonly number[]): GroupId | null {
  if (!picks.length) return null;
  return GROUPS.find((g) => {
    const t = groupTeeth(teeth, g.id);
    return t.length > 0 && sameSet(picks, t);
  })?.id ?? null;
}

/** What Select teeth says: "Whole set", a group's name, or "3 teeth". */
export function selectionWord(teeth: readonly number[], picks: readonly number[]) {
  if (!picks.length) return 'Whole set';
  const g = matchingGroup(teeth, picks);
  if (g) return GROUPS.find((x) => x.id === g)!.label;
  return `${picks.length} ${picks.length === 1 ? 'tooth' : 'teeth'}`;
}

/** Picks, kept to teeth still in the set. */
export const livePicks = (d: Pick<Design, 'teeth'>, picks: readonly number[]) => picks.filter((k) => d.teeth.includes(k));

// ---------- tooth names ----------
const NAMES = ['central', 'lateral', 'canine', 'first premolar', 'second premolar', 'first molar', 'second molar', 'third molar'];
/** "upper left central" (the wearer's side). */
export function toothName(k: number) {
  const n = k % 16;
  const side = n < 8 ? 'left' : 'right';
  const d = n < 8 ? 7 - n : n - 8;
  return `${k < 16 ? 'upper' : 'lower'} ${side} ${NAMES[d]}`;
}

/** The first front tooth in the set: where initials go until a tooth is tapped. */
export function firstFront(d: Pick<Design, 'teeth'>): number | null {
  const p = [7, 8, 6, 9, 23, 24].find((k) => d.teeth.includes(k));
  return p ?? d.teeth[0] ?? null;
}

// ---------- changing the design ----------
/** One choice in a part, as the lab's buttons make it. */
export type Choice =
  | { g: 'metal'; k: ToothDesign['metal'] }
  | { g: 'karat'; k: ToothDesign['karat'] }
  | { g: 'style'; k: ToothDesign['style'] }
  | { g: 'photo' }
  | { g: 'opal'; k: NonNullable<ToothDesign['opal']> }
  | { g: 'setting'; k: ToothDesign['setting'] | 'none' }
  | { g: 'stone'; k: ToothDesign['stone'] };

/** A tooth after a choice, following the lab's rules (stones keep a solid, open or opal frame; a finish ends photo). */
export function chosen(t: ToothDesign, c: Choice): ToothDesign {
  const x = { ...t };
  if (c.g === 'metal') x.metal = c.k;
  if (c.g === 'karat') x.karat = c.k;
  if (c.g === 'style') {
    x.style = c.k;
    if (x.type === 'photo') x.type = 'plain';
  }
  if (c.g === 'photo') {
    x.type = 'photo';
    x.style = 'solid';
  }
  if (c.g === 'opal') x.opal = c.k;
  if (c.g === 'setting') {
    if (c.k === 'none') x.type = 'plain';
    else {
      x.type = 'iced';
      x.setting = c.k;
      // Stones keep a frame that takes them (open face, opals); any other finish becomes solid.
      if (!ICED_FINISHES.includes(x.style)) x.style = 'solid';
    }
  }
  if (c.g === 'stone') x.stone = c.k;
  return x;
}

/** The nearest design the shop prices (an iced price table can move the stone or karat). */
export function offeredDesign(shop: Shop, t: ToothDesign) {
  return nearestOffered(shop.config.pricing, t, shop.catalog.stones.map((s) => s.id), shop.catalog.karats.map((k) => k.id));
}

/**
 * Applies a choice to `targets` (the picked teeth, or every tooth when nothing is picked; then the base
 * too, so teeth added later match).
 */
export function apply(shop: Shop, d: Design, targets: readonly number[], c: Choice, whole: boolean): Design {
  const designs = { ...d.designs };
  targets.forEach((k) => {
    if (!designs[k]) return;
    designs[k] = offeredDesign(shop, chosen(designs[k], c)) ?? designs[k];
  });
  const base = whole ? offeredDesign(shop, chosen(d.base, c)) ?? d.base : d.base;
  return { ...d, designs, base };
}

/** Sets fields on some teeth directly (a build, the AI). */
export function paint(d: Design, patch: Partial<ToothDesign>, list: readonly number[]): Design {
  const designs = { ...d.designs };
  list.forEach((k) => {
    if (designs[k]) designs[k] = { ...designs[k], ...patch };
  });
  return { ...d, designs };
}

/** The design of the teeth a choice goes to: the last picked tooth, else the base. */
export function current(d: Design, picks: readonly number[]): ToothDesign {
  const p = livePicks(d, picks);
  return p.length ? d.designs[p[p.length - 1]] : d.base;
}

// ---------- the spec, the price and the words ----------
export const canHaveFangs = (d: Pick<Design, 'teeth'>) => d.teeth.some((k) => FANG_TEETH.includes(k));

// ---------- letters ----------
/** Text as the field takes it: the characters letters can be cut in, at most INSCRIPTION_MAX. */
export const cleanLetters = (text: string) => text.replace(INSCRIPTION_CHARS, '').slice(0, INSCRIPTION_MAX);

const rowOf = (k: number) => (k < 16 ? 0 : 1);
/** Neighbouring teeth of one row, all in the set. */
const isRun = (teeth: readonly number[], set: readonly number[]) =>
  teeth.length > 0 && teeth.every((k, i) => set.includes(k) && rowOf(k) === rowOf(teeth[0]) && (i === 0 || k === teeth[i - 1] + 1));

/** The rows of the set that have teeth (0 top, 1 bottom). */
export const rowsOf = (d: Pick<Design, 'teeth'>) => [0, 1].filter((row) => d.teeth.some((k) => rowOf(k) === row));
/** The row a run of teeth is on. */
export const runRow = (teeth: readonly number[]) => (teeth.length ? rowOf(teeth[0]) : null);

/** How many teeth the letters need at least (up to six a tooth). */
export const lettersNeed = (text: string) => Math.max(1, Math.ceil(text.trim().length / INSCRIPTION_PER_TOOTH));

/** `count` neighbouring teeth of `row`, centred on the front of the set (as the old builder placed them). */
export function centredRun(d: Pick<Design, 'teeth'>, row: number, count: number): number[] {
  // The longest stretch of neighbouring teeth in the row nearest its middle (lib/inscriptionDrafts' autoRun).
  const block = autoRun('x'.repeat(INSCRIPTION_PER_TOOTH * INSCRIPTION_SPAN_MAX), new Set(d.teeth), row);
  if (!block.length) return [];
  const n = Math.min(block.length, Math.max(1, count));
  const centre = row * 16 + 7.5;
  let best = 0;
  for (let i = 1; i + n <= block.length; i++) {
    if (Math.abs((block[i] + block[i + n - 1]) / 2 - centre) < Math.abs((block[best] + block[best + n - 1]) / 2 - centre) - 1e-9) best = i;
  }
  return block.slice(best, best + n);
}

/** Which line of letters: 0 the first, 1 the second (on the other row). */
export type Line = 0 | 1;
type Lettered = Pick<Design, 'teeth' | 'initials'> & Partial<Pick<Design, 'second'>>;
const NO_LINE: Initials = { text: '', style: 'engraved', font: 'block', enamel: null, teeth: [] };

/** A line of letters as edited. */
export const lineOf = (d: Lettered, line: Line): Initials => (line ? d.second ?? NO_LINE : d.initials);
/** The design with one line of letters changed. */
export const withLine = <D extends Design>(d: D, line: Line, patch: Partial<Initials>): D =>
  line ? { ...d, second: { ...d.second, ...patch } } : { ...d, initials: { ...d.initials, ...patch } };

/** The row the second line keeps off: the first line's, while it has letters. */
export function takenRow(d: Lettered, line: Line): number | null {
  return line && d.initials.text.trim() ? runRow(initialsRun(d, 0)) : null;
}

/**
 * The teeth a line goes across: the run the customer chose, else one centred on the front of the top row
 * (the bottom with no top teeth). The second line always takes the row the first one doesn't.
 */
export function initialsRun(d: Lettered, line: Line = 0): number[] {
  const l = lineOf(d, line);
  const avoid = takenRow(d, line);
  if (isRun(l.teeth, d.teeth) && runRow(l.teeth) !== avoid) return l.teeth;
  const row = rowsOf(d).find((r) => r !== avoid);
  return row === undefined ? [] : centredRun(d, row, lettersNeed(l.text));
}

/** A line as the 3D and the shop take it, or null (no text, no teeth, or too many letters for the teeth). */
export function initialsInscription(d: Lettered, line: Line = 0): Inscription | null {
  const l = lineOf(d, line);
  const text = l.text.trim();
  const teeth = initialsRun(d, line);
  if (!text || !teeth.length || !fitsTeeth({ text, teeth })) return null;
  return { text: l.font === 'block' ? text.toUpperCase() : text, teeth, style: l.style, font: l.font, enamel: l.style === 'engraved' ? l.enamel : null };
}

/** Every line of letters that counts, top row first. */
export const inscriptionsOf = (d: Lettered): Inscription[] =>
  ([0, 1] as const)
    .map((line) => initialsInscription(d, line))
    .filter((x): x is Inscription => x !== null)
    .sort((a, b) => a.teeth[0] - b.teeth[0]);

/** Initials count once they have text and fit the teeth they are on. */
export const initialsOn = (d: Lettered) => inscriptionsOf(d).length > 0;

/**
 * A tap on a tooth while choosing where the letters go (the old builder's way): the first tap starts a
 * run there, a second tap in the same row ends it (every tooth between must be in the set). Returns the
 * new run and the tooth still waiting for its other end, if any.
 */
export function tapLetters(d: Pick<Design, 'teeth'>, anchor: number | null, k: number): { teeth: number[]; anchor: number | null } {
  if (!d.teeth.includes(k)) return { teeth: [], anchor };
  if (anchor === null || rowOf(anchor) !== rowOf(k) || !d.teeth.includes(anchor)) return { teeth: [k], anchor: k };
  const teeth: number[] = [anchor];
  for (let x = anchor - 1; x >= Math.min(anchor, k) && d.teeth.includes(x); x--) teeth.unshift(x);
  for (let x = anchor + 1; x <= Math.max(anchor, k) && d.teeth.includes(x); x++) teeth.push(x);
  return { teeth: teeth.slice(0, INSCRIPTION_SPAN_MAX), anchor: null };
}

// ---------- charms ----------
/** The charms on teeth in the set, in tooth order. */
export const charmList = (d: Pick<Design, 'teeth' | 'charms'>): Charm[] =>
  d.teeth.filter((k) => d.charms[k]).map((k) => ({ id: d.charms[k], tooth: k }));

/** Where a charm goes when no tooth is picked: the first front tooth without one (the lab's rule). */
export function charmTooth(d: Pick<Design, 'teeth' | 'charms'>): number | null {
  const p = [7, 8, 6, 9, 5, 10, 23, 24, 22, 25].find((k) => d.teeth.includes(k) && !d.charms[k]);
  return p ?? d.teeth.find((k) => !d.charms[k]) ?? d.teeth[0] ?? null;
}

/** Puts a charm on these teeth, or takes it off them when they all wear it already. */
export function placeCharm(d: Design, targets: readonly number[], id: CharmId): Design {
  const on = targets.filter((k) => d.teeth.includes(k));
  const all = on.length > 0 && on.every((k) => d.charms[k] === id);
  const charms = { ...d.charms };
  on.forEach((k) => {
    if (all) delete charms[k];
    else charms[k] = id;
  });
  return { ...d, charms };
}

export function setOptions(d: Design): SetOptions {
  const charms = charmList(d);
  return {
    fangs: d.fangs && canHaveFangs(d),
    cut: d.cut,
    ...(d.mold ? { mold: d.mold } : {}),
    ...(d.addOns.length ? { addOns: d.addOns } : {}),
    vision: d.idea.slice(0, 500),
    inscriptions: inscriptionsOf(d),
    ...(charms.length ? { charms } : {}),
  };
}

/** The whole design as the server takes it (null with no teeth). */
export function toSpec(d: Design): RenderSpec | null {
  if (!d.teeth.length) return null;
  return { ...setOptions(d), teeth: d.teeth.map((index) => ({ index, ...d.designs[index] })) };
}

export function price(shop: Shop, d: Design): PriceBreakdown {
  const spec = toSpec(d);
  return priceBreakdown(shop.config.pricing, spec?.teeth ?? [], setOptions(d), shop.config.catalog.addOns ?? []);
}

const money = (n: number) => `${n < 0 ? '−$' : '$'}${Math.abs(Math.round(n)).toLocaleString('en-US')}`;
export { money };

/** What a change costs on the total: "+$70", "−$40" or "" for nothing. */
export function delta(shop: Shop, d: Design, next: Design) {
  const diff = price(shop, next).total - price(shop, d).total;
  return diff ? `${diff > 0 ? '+' : '−'}$${Math.abs(diff).toLocaleString('en-US')}` : '';
}

export const metalWords = (t: ToothDesign) => `${isGold(t.metal) ? `${label(KARATS, t.karat)} ` : ''}${label(METALS, t.metal).toLowerCase()}`;
export function finishWords(t: ToothDesign) {
  if (t.type === 'iced') {
    const frame = t.style === 'open-face' ? ' open face' : t.style === 'opals' ? ` with ${label(OPALS, t.opal ?? 'white').toLowerCase()} opal centre` : '';
    return `iced${frame} · ${label(SETTINGS, t.setting).toLowerCase()} · ${label(STONES, t.stone).toLowerCase()}`;
  }
  if (t.type === 'photo') return 'photo';
  return t.style === 'opals' ? `${label(OPALS, t.opal ?? 'white').toLowerCase()} opals` : label(STYLES, t.style).toLowerCase();
}
function same<T>(d: Design, f: (t: ToothDesign) => T): T | null {
  const v = d.teeth.length ? f(d.designs[d.teeth[0]]) : null;
  return d.teeth.every((k) => f(d.designs[k]) === v) ? v : null;
}

/** One line for people: "6 × 6 · 14K yellow gold · iced · honeycomb · moissanite · fangs". */
export function summary(d: Design) {
  if (!d.teeth.length) return 'No teeth yet';
  let s = `${setLabel(d)} · ${same(d, metalWords) ?? 'mixed metals'} · ${same(d, finishWords) ?? 'mixed finishes'}`;
  if (setOptions(d).fangs) s += ' · fangs';
  inscriptionsOf(d).forEach((ins) => {
    s += ` · "${ins.text}"`;
  });
  const c = charmList(d).length;
  if (c) s += ` · ${c} ${c === 1 ? 'charm' : 'charms'}`;
  if (d.cut === 'permanent') s += ' · permanent look';
  return s;
}

/** What a part holds now, under its round picture in the strip. */
export function partValue(d: Design, part: PartId, picks: readonly number[] = []) {
  if (part === 'teeth') return d.teeth.length ? setLabel(d) : 'Start here: pick your teeth';
  if (!d.teeth.length) return 'Pick teeth first';
  const list = livePicks(d, picks).length ? livePicks(d, picks) : d.teeth;
  const val = (f: (t: ToothDesign) => string, noun: string) => {
    const seen = [...new Set(list.map((k) => f(d.designs[k])))];
    return seen.length === 1 ? seen[0] : `${seen.length} ${noun}`;
  };
  if (part === 'metal') return val(metalWords, 'metals').replace(/^./, (x) => x.toUpperCase());
  if (part === 'finish') return val((t) => (t.type === 'photo' ? 'Photo' : label(STYLES, t.style)), 'finishes');
  if (part === 'stones') return val((t) => (t.type === 'iced' ? `${label(SETTINGS, t.setting)}, ${label(STONES, t.stone).toLowerCase()}` : 'None'), 'settings');
  const e: string[] = [];
  if (setOptions(d).fangs) e.push('Fangs');
  inscriptionsOf(d).forEach((ins) => e.push(`"${ins.text}"`));
  const c = charmList(d).length;
  if (c) e.push(`${c} ${c === 1 ? 'charm' : 'charms'}`);
  if (d.cut === 'permanent') e.push('Permanent look');
  if (d.idea.trim()) e.push('Your idea');
  return e.length ? e.join(', ') : 'None';
}

// ---------- keeping it: the app's saved-design format ----------
const sameTooth = (a: ToothDesign, b: ToothDesign) => JSON.stringify(Object.entries(a).sort()) === JSON.stringify(Object.entries(b).sort());

export function toSnapshot(d: Design): DesignSnapshot {
  const overrides: Record<number, ToothDesign> = {};
  d.teeth.forEach((k) => {
    if (!sameTooth(d.designs[k], d.base)) overrides[k] = d.designs[k];
  });
  // An automatic run is kept as no teeth: it is worked out again on the way back.
  const draft: InscriptionDraft[] = ([0, 1] as const).flatMap((line) => {
    const ins = initialsInscription(d, line);
    const l = lineOf(d, line);
    return ins ? [{ text: l.text.trim(), style: ins.style, font: ins.font, enamel: ins.enamel, teeth: isRun(l.teeth, d.teeth) && l.teeth.join() === ins.teeth.join() ? ins.teeth : [], anchor: null }] : [];
  });
  const charms = charmList(d);
  return {
    teeth: d.teeth,
    base: d.base,
    overrides,
    set: {
      fangs: d.fangs,
      cut: d.cut,
      vision: d.idea.slice(0, 500),
      ...(d.mold ? { mold: d.mold } : {}),
      ...(d.addOns.length ? { addOns: d.addOns } : {}),
      ...(charms.length ? { charms } : {}),
    },
    drafts: draft,
  };
}

export function fromSnapshot(shop: Shop, s: DesignSnapshot): Design {
  const d = blankDesign(shop);
  const designs: Record<number, ToothDesign> = {};
  s.teeth.forEach((k) => {
    designs[k] = s.overrides[k] ?? s.base;
  });
  // Designs from before the second line have one draft (or none): they read as before.
  const [first, second] = s.drafts.filter((x) => x.text.trim());
  const line = (x: InscriptionDraft): Initials => ({ text: cleanLetters(x.text), style: x.style, font: x.font, enamel: x.enamel, teeth: x.teeth });
  return {
    ...d,
    teeth: sorted(s.teeth),
    base: s.base,
    designs,
    fangs: s.set.fangs,
    cut: s.set.cut,
    mold: s.set.mold ?? d.mold,
    addOns: s.set.addOns ?? [],
    idea: s.set.vision ?? '',
    initials: first ? line(first) : d.initials,
    second: second ? line(second) : d.second,
    charms: Object.fromEntries((s.set.charms ?? []).map((c) => [c.tooth, c.id])),
  };
}

/** A design from a spec (what the AI sends back), on the shop's options. */
export function fromSpec(shop: Shop, spec: RenderSpec, keep?: Design): Design {
  const d = keep ? { ...keep } : blankDesign(shop);
  const teeth = sorted(spec.teeth.map((t) => t.index));
  const designs: Record<number, ToothDesign> = {};
  spec.teeth.forEach(({ index, ...t }) => {
    designs[index] = offeredDesign(shop, t) ?? { ...d.base };
  });
  const [ins, ins2] = spec.inscriptions;
  const line = (x: Inscription): Initials => ({ text: cleanLetters(x.text), style: x.style, font: x.font, enamel: x.enamel, teeth: x.teeth });
  return {
    ...d,
    teeth,
    designs,
    base: teeth.length ? designs[teeth[Math.floor(teeth.length / 2)]] : d.base,
    fangs: spec.fangs,
    cut: spec.cut,
    mold: spec.mold ?? d.mold,
    addOns: spec.addOns ?? d.addOns,
    initials: ins ? line(ins) : { ...d.initials, text: '' },
    second: ins2 ? line(ins2) : { ...d.second, text: '' },
    charms: Object.fromEntries((spec.charms ?? []).filter((c) => teeth.includes(c.tooth)).map((c) => [c.tooth, c.id])),
    idea: d.idea,
  };
}

// ---------- the starting builds (the lab's popular builds, on the shop's options) ----------
export type Build = { id: string; label: string; picture: { top: number; bottom: number; kind: SetKind }; design: Design };
export type SetKind = 'gold' | 'iced' | 'fangs' | 'tone' | 'open' | 'oneof';

const sells = (shop: Shop, t: ToothDesign) =>
  shop.config.catalog.metals.includes(t.metal) &&
  shop.config.catalog.types.includes(t.type) &&
  (t.type !== 'plain' || shop.config.catalog.styles.includes(t.style));

/**
 * The One-of-one showpiece (the lab's LOOKS.oneof): an 18K gold 6 × 6, the top corners iced, a charm on
 * every tooth. Tooth → [charm, iced].
 */
const ONE_OF_ONE: Record<number, [CharmId, boolean]> = {
  5: ['crest', true],
  6: ['emblem', true],
  7: ['winged-heart', false],
  8: ['crown', false],
  9: ['emblem', true],
  10: ['crest', true],
  21: ['ruby-potion', false],
  22: ['emerald-potion', false],
  23: ['hat', false],
  24: ['broom', false],
  25: ['owl', false],
  26: ['sapphire', true],
};

/** The builds this shop can offer (each only when it sells every part of it; One-of-one only with every charm in it). */
export function shopBuilds(shop: Shop): Build[] {
  const blank = blankDesign(shop);
  const tooth = (patch: Partial<ToothDesign>) => {
    const t = offeredDesign(shop, { ...blank.base, ...patch });
    return t && sells(shop, t) ? t : null;
  };
  const make = (base: ToothDesign | null, top: number, bottom: number, extra?: (d: Design) => Design | null) => {
    if (!base) return null;
    const d = setRange({ ...blank, base }, top, bottom);
    return extra ? extra(d) : d;
  };
  const gold = tooth({ metal: 'yellow', type: 'plain', style: 'solid' });
  const iced = tooth({ type: 'iced', style: 'solid' });
  const k18 = shop.config.catalog.karats.includes('18k') ? '18k' : blank.base.karat;
  const list: (Build | null)[] = [
    ((d) => d && { id: 'gold6', label: 'Gold 6 top', picture: { top: 6, bottom: 0, kind: 'gold' as const }, design: d })(make(gold, 6, 0)),
    ((d) => d && { id: 'gold66', label: 'Gold 6 × 6', picture: { top: 6, bottom: 6, kind: 'gold' as const }, design: d })(make(gold, 6, 6)),
    ((d) => d && { id: 'iced8', label: 'Iced 8 bottom', picture: { top: 0, bottom: 8, kind: 'iced' as const }, design: d })(make(iced, 0, 8)),
    ((d) => d && { id: 'fangs', label: 'Iced fangs', picture: { top: 6, bottom: 0, kind: 'fangs' as const }, design: d })(
      shop.catalog.fangs ? make(iced, 6, 0, (x) => ({ ...x, fangs: true })) : null,
    ),
    ((d) => d && { id: 'tone', label: 'Two-tone 6 × 6', picture: { top: 6, bottom: 6, kind: 'tone' as const }, design: d })(
      make(gold, 6, 6, (x) => {
        const white = tooth({ metal: 'white', type: 'plain', style: 'solid' });
        return white ? paint(x, white, [7, 8]) : null;
      }),
    ),
    ((d) => d && { id: 'open', label: 'Open face 6 × 6', picture: { top: 6, bottom: 6, kind: 'open' as const }, design: d })(
      make(tooth({ metal: 'yellow', type: 'plain', style: 'open-face' }), 6, 6),
    ),
    ((d) => d && { id: 'oneof', label: 'One-of-one', picture: { top: 6, bottom: 6, kind: 'oneof' as const }, design: d })(
      Object.values(ONE_OF_ONE).every(([c]) => shop.catalog.charms.some((x) => x.id === c))
        ? make(tooth({ metal: 'yellow', karat: k18, type: 'plain', style: 'solid' }), 6, 6, (x) => {
            const icedTooth = tooth({ metal: 'yellow', karat: k18, type: 'iced', style: 'solid' });
            if (!icedTooth) return null;
            const iced = Object.entries(ONE_OF_ONE).filter(([, [, ice]]) => ice).map(([k]) => Number(k));
            return { ...paint(x, icedTooth, iced), charms: Object.fromEntries(Object.entries(ONE_OF_ONE).map(([k, [c]]) => [Number(k), c])) };
          })
        : null,
    ),
  ];
  return list.filter((b): b is Build => Boolean(b));
}

/** "From $1,100" for a build's card, or "Quoted" when the shop quotes part of it (charms). */
export function buildPrice(shop: Shop, b: Build) {
  const p = price(shop, b.design);
  return p.quoted?.length ? 'Quoted' : `From ${money(p.total)}`;
}

export const insStyles = INSCRIPTION_STYLES;
