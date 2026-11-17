import { priceBreakdown } from '../../lib/pricing';
import { lookDesign, type StartingLook } from '../../lib/startingLooks';
import type { DesignSnapshot } from '../../lib/savedDesign';
import type { Tenant } from '../../lib/tenant/tenant';

// The front door's piece shows finished work: the popular builds in turn, each
// with its name and price above the headline (the signed-off prototype's
// showcase, docs/redesign/creator-lab/src/50-ui.js). Prices come from the demo
// shop's real price engine, so the caption matches what the builder would show.
//
// The prototype also shows a one-of-one with charms; the app's 3D has no charms
// yet, so that build waits until it does.

const row = (count: number, offset = 0) => Array.from({ length: count }, (_, i) => offset + Math.floor((16 - count) / 2) + i);
const SIX = [...row(6), ...row(6, 16)];
const plain = { metal: 'yellow', type: 'plain', style: 'solid' } as const;

/** The prototype's order (one-of-one aside): iced 8 bottom, iced fangs, two-tone, open face, gold. */
export const SHOWCASE: StartingLook[] = [
  { id: 'iced8', label: 'Iced 8 bottom', teeth: row(8, 16), tooth: { type: 'iced', style: 'solid' }, set: { fangs: false } },
  { id: 'fangs', label: 'Iced fangs', teeth: row(6), tooth: { type: 'iced', style: 'solid' }, set: { fangs: true } },
  { id: 'tone', label: 'Two-tone 6 × 6', teeth: SIX, tooth: plain, accent: { teeth: [7, 8], tooth: { ...plain, metal: 'white' } }, set: { fangs: false } },
  { id: 'open', label: 'Open face 6 × 6', teeth: SIX, tooth: { ...plain, style: 'open-face' }, set: { fangs: false } },
  { id: 'gold66', label: 'Gold 6 × 6', teeth: SIX, tooth: plain, set: { fangs: false } },
];

export type ShowcaseBuild = { id: string; caption: string; design: DesignSnapshot };

const money = (value: number) => `$${value.toLocaleString('en-US')}`;

/** The builds this shop sells, each with its design and its caption ("Two-tone 6 × 6 · from $2,000"). */
export function showcaseBuilds(shop: Tenant): ShowcaseBuild[] {
  return SHOWCASE.flatMap((look) => {
    const design = lookDesign(look, shop);
    if (!design) return [];
    const teeth = design.teeth.map((index) => ({ index, ...(design.overrides[index] ?? design.base) }));
    const { total } = priceBreakdown(shop.config.pricing, teeth, { ...design.set, inscriptions: [] });
    return [{ id: look.id, caption: `${look.label} · from ${money(total)}`, design }];
  });
}
