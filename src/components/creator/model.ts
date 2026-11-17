// The creator's design, as pure functions (no React): which teeth are in the set, what each one is
// made of, and the set's own options. Ported from the signed-off Grill Creator Lab
// (docs/redesign/creator-lab/src/10-core.js and 50-ui.js), on the real app's catalogue and prices:
// renderSpec for the options, the shop's tenant config for what it sells, lib/pricing for the price.
// Tooth numbering is the app's: 0–15 upper, 16–31 lower, the wearer's left first; 7 and 8 are the
// upper centrals, 5 and 10 the upper canines (the same numbering the lab used).
import {
  FANG_TEETH,
  INSCRIPTION_STYLES,
  KARATS,
  METALS,
  OPALS,
  SETTINGS,
  STONES,
  STYLES,
  isGold,
  label,
  type CutId,
  type InscriptionStyleId,
  type MoldId,
  type RenderSpec,
  type SetOptions,
  type ToothDesign,
} from '../../lib/renderSpec';
import { nearestOffered, priceBreakdown, type PriceBreakdown } from '../../lib/pricing';
import type { DesignSnapshot } from '../../lib/savedDesign';
import type { Tenant } from '../../lib/tenant/tenant';
import type { InscriptionDraft } from '../../lib/inscriptionDrafts';

export type Shop = Pick<Tenant, 'slug' | 'config' | 'catalog' | 'defaultTooth' | 'defaultSet'>;

/** Initials on one tooth (the lab's Extras row). */
export type Initials = { text: string; style: InscriptionStyleId; tooth: number | null };

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
    initials: { text: '', style: shop.catalog.inscriptionStyles[0]?.id ?? 'engraved', tooth: null },
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
  return { ...d, teeth, designs };
}

/** Adds a tooth to the set, or takes it out. */
export function toggleTooth(d: Design, k: number): Design {
  if (d.teeth.includes(k)) {
    const designs = { ...d.designs };
    delete designs[k];
    return { ...d, teeth: d.teeth.filter((x) => x !== k), designs };
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

/** A tooth after a choice, following the lab's rules (stones keep a solid or open frame; a finish ends photo). */
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
      if (x.style !== 'open-face') x.style = 'solid';
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

/** Initials count once they have text and sit on a tooth in the set. */
export const initialsOn = (d: Pick<Design, 'teeth' | 'initials'>) =>
  Boolean(d.initials.text.trim()) && d.initials.tooth !== null && d.teeth.includes(d.initials.tooth);

export function setOptions(d: Design): SetOptions {
  return {
    fangs: d.fangs && canHaveFangs(d),
    cut: d.cut,
    ...(d.mold ? { mold: d.mold } : {}),
    ...(d.addOns.length ? { addOns: d.addOns } : {}),
    vision: d.idea.slice(0, 500),
    inscriptions: initialsOn(d) ? [{ text: d.initials.text.trim(), teeth: [d.initials.tooth!], style: d.initials.style, font: 'block', enamel: null }] : [],
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
  if (t.type === 'iced') return `iced${t.style === 'open-face' ? ' open face' : ''} · ${label(SETTINGS, t.setting).toLowerCase()} · ${label(STONES, t.stone).toLowerCase()}`;
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
  if (initialsOn(d)) s += ` · "${d.initials.text.trim()}"`;
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
  if (initialsOn(d)) e.push(`"${d.initials.text.trim()}"`);
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
  const draft: InscriptionDraft[] = initialsOn(d)
    ? [{ text: d.initials.text.trim(), style: d.initials.style, font: 'block', enamel: null, teeth: [d.initials.tooth!], anchor: null }]
    : [];
  return {
    teeth: d.teeth,
    base: d.base,
    overrides,
    set: { fangs: d.fangs, cut: d.cut, vision: d.idea.slice(0, 500), ...(d.mold ? { mold: d.mold } : {}), ...(d.addOns.length ? { addOns: d.addOns } : {}) },
    drafts: draft,
  };
}

export function fromSnapshot(shop: Shop, s: DesignSnapshot): Design {
  const d = blankDesign(shop);
  const designs: Record<number, ToothDesign> = {};
  s.teeth.forEach((k) => {
    designs[k] = s.overrides[k] ?? s.base;
  });
  const first = s.drafts.find((x) => x.text.trim() && x.teeth.length === 1);
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
    initials: first ? { text: first.text.slice(0, 6).toUpperCase(), style: first.style, tooth: first.teeth[0] } : d.initials,
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
  const ins = spec.inscriptions[0];
  return {
    ...d,
    teeth,
    designs,
    base: teeth.length ? designs[teeth[Math.floor(teeth.length / 2)]] : d.base,
    fangs: spec.fangs,
    cut: spec.cut,
    mold: spec.mold ?? d.mold,
    addOns: spec.addOns ?? d.addOns,
    initials: ins ? { text: ins.text.slice(0, 6).toUpperCase(), style: ins.style, tooth: ins.teeth[0] } : d.initials,
    idea: d.idea,
  };
}

// ---------- the starting builds (the lab's popular builds, on the shop's options) ----------
export type Build = { id: string; label: string; picture: { top: number; bottom: number; kind: SetKind }; design: Design };
export type SetKind = 'gold' | 'iced' | 'fangs' | 'tone' | 'open';

const sells = (shop: Shop, t: ToothDesign) =>
  shop.config.catalog.metals.includes(t.metal) &&
  shop.config.catalog.types.includes(t.type) &&
  (t.type !== 'plain' || shop.config.catalog.styles.includes(t.style));

/**
 * The builds this shop can offer (each only when it sells every part of it). One-of-one, the lab's
 * seventh build, needs charms, which aren't in the app's catalogue yet.
 */
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
  ];
  return list.filter((b): b is Build => Boolean(b));
}

/** "From $1,100" for a build's card. */
export const buildPrice = (shop: Shop, b: Build) => `From ${money(price(shop, b.design).total)}`;

export const insStyles = INSCRIPTION_STYLES;
