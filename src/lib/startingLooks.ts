import { nearestOffered } from './pricing';
import type { SetOptions, ToothDesign } from './renderSpec';
import { setWithoutInscriptions, validSnapshot, type DesignSnapshot } from './savedDesign';
import type { Tenant } from './tenant/tenant';

// One-tap starting points on the first step (MAG-148): each sets the teeth, the
// tooth design and the set options together. A shop only shows a look it sells
// every part of; iced looks move to the nearest stone and karat the shop prices.

const row = (count: number, offset = 0) => Array.from({ length: count }, (_, i) => offset + Math.floor((16 - count) / 2) + i);
const SIX = [...row(6), ...row(6, 16)];
const EIGHT = [...row(8), ...row(8, 16)];

export type StartingLook = {
  id: string;
  label: string;
  teeth: number[];
  tooth: Partial<ToothDesign>;
  /** Some teeth in another design: the two-tone look. */
  accent?: { teeth: number[]; tooth: Partial<ToothDesign> };
  set: Pick<SetOptions, 'fangs'>;
};

export const STARTING_LOOKS: StartingLook[] = [
  { id: 'gold', label: 'Plain gold', teeth: SIX, tooth: { metal: 'yellow', type: 'plain', style: 'solid' }, set: { fangs: false } },
  { id: 'iced', label: 'Fully iced', teeth: EIGHT, tooth: { type: 'iced', style: 'solid' }, set: { fangs: false } },
  { id: 'open-face', label: 'Open face', teeth: SIX, tooth: { metal: 'yellow', type: 'plain', style: 'open-face' }, set: { fangs: false } },
  { id: 'iced-fangs', label: 'Iced fangs', teeth: row(6), tooth: { type: 'iced', style: 'solid' }, set: { fangs: true } },
  { id: 'two-tone', label: 'Two-tone', teeth: SIX, tooth: { metal: 'yellow', type: 'plain', style: 'solid' }, accent: { teeth: [7, 8], tooth: { metal: 'white', type: 'plain', style: 'solid' } }, set: { fangs: false } },
];

export const lookImage = (id: string) => `/assets/options/grillz/look-${id}.webp`;

type Shop = Pick<Tenant, 'slug' | 'config' | 'catalog' | 'defaultTooth' | 'defaultSet'>;

/** The look as a whole design in this shop, or null when the shop doesn't sell all of it. */
export function lookDesign(look: StartingLook, shop: Shop): DesignSnapshot | null {
  const stones = shop.catalog.stones.map((stone) => stone.id);
  const karats = shop.catalog.karats.map((karat) => karat.id);
  const priced = (patch: Partial<ToothDesign>) => nearestOffered(shop.config.pricing, { ...shop.defaultTooth, ...patch }, stones, karats);
  const base = priced(look.tooth);
  const accent = look.accent ? priced(look.accent.tooth) : null;
  if (!base || (look.accent && !accent)) return null;
  const overrides = look.accent && accent ? Object.fromEntries(look.accent.teeth.map((index) => [index, accent])) : {};
  return validSnapshot({ teeth: look.teeth, base, overrides, set: { ...setWithoutInscriptions(shop.defaultSet), ...look.set }, drafts: [] }, shop);
}

/** The looks this shop can offer, each with its design. */
export const shopLooks = (shop: Shop) => STARTING_LOOKS.flatMap((look) => {
  const design = lookDesign(look, shop);
  return design ? [{ look, design }] : [];
});
