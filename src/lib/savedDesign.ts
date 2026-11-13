import { inscriptionsFrom, placeDrafts, type InscriptionDraft } from './inscriptionDrafts';
import { offered } from './pricing';
import { posterFor } from './poster';
import {
  ENAMELS,
  INSCRIPTION_CHARS,
  INSCRIPTION_FONTS,
  INSCRIPTION_MAX,
  INSCRIPTION_STYLES,
  parseRenderSpec,
  type SetOptions,
  type ToothDesign,
} from './renderSpec';
import type { TenantCatalog, TenantPricing } from './tenant/schema';

// A customer's design, kept so it isn't lost (MAG-148): saved in the browser per
// shop and brought back on return, and put in a link they can copy. Whatever
// comes back is checked against what the shop sells today; a design that no
// longer passes is dropped without a word and the builder opens as usual.
// Not saved: the uploaded image and anything about the customer.

export type DesignSnapshot = {
  teeth: number[];
  base: ToothDesign;
  overrides: Record<number, ToothDesign>;
  set: Omit<SetOptions, 'inscriptions'>;
  /** The inscriptions as edited: text and any teeth the customer picked. */
  drafts: InscriptionDraft[];
};

type Shop = { slug: string; config: { catalog: TenantCatalog; pricing: TenantPricing } };

const VERSION = 1;
const storageKey = (slug: string) => `vvslab:design:${slug}`;
const HASH_KEY = 'design';
/** The opening 6 x 6 (useGrillzCustomization's centred set). */
export const OPENING_TEETH = [5, 6, 7, 8, 9, 10, 21, 22, 23, 24, 25, 26];

const isIndex = (value: unknown): value is number => typeof value === 'number' && Number.isInteger(value) && value >= 0 && value <= 31;
const oneOf = (list: readonly { id: string }[], value: unknown) => typeof value === 'string' && list.some((item) => item.id === value);

function cleanDraft(value: unknown): InscriptionDraft | null {
  if (!value || typeof value !== 'object') return null;
  const raw = value as Record<string, unknown>;
  if (typeof raw.text !== 'string' || raw.text.length > INSCRIPTION_MAX || raw.text.replace(INSCRIPTION_CHARS, '') !== raw.text) return null;
  if (!oneOf(INSCRIPTION_STYLES, raw.style) || !oneOf(INSCRIPTION_FONTS, raw.font)) return null;
  if (raw.enamel !== null && !oneOf(ENAMELS, raw.enamel)) return null;
  if (!Array.isArray(raw.teeth) || raw.teeth.length > 16 || !raw.teeth.every(isIndex)) return null;
  return { text: raw.text, style: raw.style, font: raw.font, enamel: raw.enamel, teeth: raw.teeth, anchor: null } as InscriptionDraft;
}

/** The snapshot, if it is well formed and the shop sells everything in it; otherwise null. */
export function checkSnapshot(value: unknown, shop: Shop): DesignSnapshot | null {
  if (!value || typeof value !== 'object') return null;
  const raw = value as Record<string, unknown>;
  if (raw.v !== VERSION || !Array.isArray(raw.teeth) || !raw.teeth.every(isIndex)) return null;
  const teeth = [...new Set(raw.teeth as number[])].sort((a, b) => a - b);
  if (!teeth.length || !raw.set || typeof raw.set !== 'object' || !Array.isArray(raw.drafts) || raw.drafts.length > 2) return null;
  const drafts = raw.drafts.map(cleanDraft);
  if (drafts.some((draft) => draft === null)) return null;
  const set = raw.set as Record<string, unknown>;
  const setOptions = { fangs: set.fangs, cut: set.cut, vision: set.vision, ...(set.addOns !== undefined ? { addOns: set.addOns } : {}), ...(set.mold !== undefined ? { mold: set.mold } : {}) };
  const overridesRaw = raw.overrides && typeof raw.overrides === 'object' ? (raw.overrides as Record<string, unknown>) : {};
  const overrides = Object.fromEntries(Object.entries(overridesRaw).filter(([index]) => teeth.includes(Number(index)))) as Record<number, unknown>;
  const designOf = (index: number) => overrides[index] ?? raw.base;
  const inSet = new Set(teeth);
  const inscriptions = inscriptionsFrom(placeDrafts(drafts as InscriptionDraft[], inSet), inSet);
  // The whole design, and the shared tooth design on its own, through the same check the server runs.
  const spec = parseRenderSpec({ ...setOptions, inscriptions, teeth: teeth.map((index) => ({ ...(designOf(index) as object), index })) }, shop.config.catalog);
  const baseSpec = parseRenderSpec({ ...setOptions, inscriptions: [], teeth: [{ ...(raw.base as object), index: 0 }] }, shop.config.catalog);
  if (!spec || !baseSpec) return null;
  // Iced from a price table: only combinations the shop prices.
  if (![...spec.teeth, ...baseSpec.teeth].every((tooth) => offered(shop.config.pricing, tooth))) return null;
  const strip = (tooth: ToothDesign & { index: number }): ToothDesign => {
    const design: Partial<typeof tooth> = { ...tooth };
    delete design.index;
    return design as ToothDesign;
  };
  return {
    teeth,
    base: strip(baseSpec.teeth[0]),
    overrides: Object.fromEntries(spec.teeth.filter((tooth) => overrides[tooth.index] !== undefined).map((tooth) => [tooth.index, strip(tooth)])),
    set: setOptions as DesignSnapshot['set'],
    drafts: drafts as InscriptionDraft[],
  };
}

/** A design built in code (a starting look), through the same check as a stored one. */
export const validSnapshot = (snapshot: DesignSnapshot, shop: Shop) => checkSnapshot(JSON.parse(toJson(snapshot)), shop);

const toJson = (snapshot: DesignSnapshot) =>
  JSON.stringify({
    v: VERSION,
    ...snapshot,
    drafts: snapshot.drafts.map(({ text, style, font, enamel, teeth }) => ({ text, style, font, enamel, teeth })),
  });

/** Storage can be blocked (private modes, third-party frames): every use is optional. */
function storage(): Storage | null {
  try {
    return typeof window === 'undefined' ? null : window.localStorage;
  } catch {
    return null;
  }
}

export function saveDesign(slug: string, snapshot: DesignSnapshot | null) {
  try {
    const store = storage();
    if (!store) return;
    if (snapshot) store.setItem(storageKey(slug), toJson(snapshot));
    else store.removeItem(storageKey(slug));
  } catch {
    // Full or blocked: the design just isn't kept.
  }
}

function readSaved(shop: Shop): DesignSnapshot | null {
  try {
    const text = storage()?.getItem(storageKey(shop.slug));
    return text ? checkSnapshot(JSON.parse(text), shop) : null;
  } catch {
    return null;
  }
}

const toBase64Url = (text: string) => {
  const bytes = new TextEncoder().encode(text);
  let binary = '';
  bytes.forEach((byte) => {
    binary += String.fromCharCode(byte);
  });
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
};

const fromBase64Url = (value: string) => {
  const binary = atob(value.replace(/-/g, '+').replace(/_/g, '/'));
  return new TextDecoder().decode(Uint8Array.from(binary, (char) => char.charCodeAt(0)));
};

/** The design in a link's hash (#design=…), or null. */
export function designFromHash(hash: string, shop: Shop): DesignSnapshot | null {
  const value = new URLSearchParams(hash.replace(/^#/, '')).get(HASH_KEY);
  if (!value) return null;
  try {
    return checkSnapshot(JSON.parse(fromBase64Url(value)), shop);
  } catch {
    return null;
  }
}

export const hasDesignHash = (hash: string) => new URLSearchParams(hash.replace(/^#/, '')).has(HASH_KEY);

/**
 * A link that opens this design in the shop's builder. Built from the shop's
 * public address, not the page's: inside an embed the page carries embed
 * parameters, and on a shop's own domain the builder is at "/".
 */
export function designLink(snapshot: DesignSnapshot, slug: string, origin: string, customDomain: boolean) {
  return `${origin}${customDomain ? '/' : `/b/${slug}`}#${HASH_KEY}=${toBase64Url(toJson(snapshot))}`;
}

/** Where the builder starts: a design from the link, else the one saved on this device, else none. */
export function startingDesign(shop: Shop): { snapshot: DesignSnapshot; source: 'link' | 'saved' } | null {
  if (typeof window === 'undefined') return null;
  const fromLink = designFromHash(window.location.hash, shop);
  if (fromLink) return { snapshot: fromLink, source: 'link' };
  const saved = readSaved(shop);
  return saved ? { snapshot: saved, source: 'saved' } : null;
}

/** Set options as kept: inscriptions are kept as drafts instead. */
export function setWithoutInscriptions(set: SetOptions): DesignSnapshot['set'] {
  const copy: Partial<SetOptions> = { ...set };
  delete copy.inscriptions;
  return copy as DesignSnapshot['set'];
}

/** The design every builder opens on: a 6 x 6 in the shop's default tooth and set options. */
export function openingDesign(shop: { defaultTooth: ToothDesign; defaultSet: SetOptions }): DesignSnapshot {
  return { teeth: OPENING_TEETH, base: shop.defaultTooth, overrides: {}, set: setWithoutInscriptions(shop.defaultSet), drafts: [] };
}

/** JSON with keys in a fixed order, so equal designs compare equal however they were built. */
const stable = (value: unknown): unknown =>
  Array.isArray(value)
    ? value.map(stable)
    : value && typeof value === 'object'
      ? Object.fromEntries(Object.keys(value).sort().filter((key) => (value as Record<string, unknown>)[key] !== undefined).map((key) => [key, stable((value as Record<string, unknown>)[key])]))
      : value;

/** Same design? (For not saving the shop's opening design.) */
export const sameDesign = (a: DesignSnapshot, b: DesignSnapshot) => JSON.stringify(stable(JSON.parse(toJson(a)))) === JSON.stringify(stable(JSON.parse(toJson(b))));

/**
 * The still to open on: the shop's opening still when the builder opens on the
 * opening set in one of the poster designs, none otherwise (a restored design
 * isn't the still, and showing it would flash the wrong set).
 */
export function startingPoster(start: DesignSnapshot | null, opening: DesignSnapshot): string | null {
  const design = start ?? opening;
  const sameSet = design.teeth.join() === opening.teeth.join() && !Object.keys(design.overrides).length && !design.drafts.some((draft) => draft.text.trim());
  return sameSet ? posterFor(design.base, design.set) : null;
}
