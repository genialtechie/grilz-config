import { CUTS, GRILLZ_TYPES, INSCRIPTION_STYLES, KARATS, METALS, MOLDS, SETTINGS, STONES, STYLES } from '../renderSpec.js';
import type { TenantConfig } from './schema.js';
import { cutPrice } from '../pricing.js';

// Plain-language list of what a draft changes compared with the live config,
// shown before a shop publishes ("Yellow gold: $150 → $165 per tooth").

export type Change = { area: string; text: string };

type Option = { id: string; label: string };
const label = (list: readonly Option[], id: string) => list.find((item) => item.id === id)?.label ?? id;
const usd = (value: number | undefined) => (value === undefined ? '—' : `$${Number(value).toLocaleString('en-US')}`);
const times = (value: number | undefined) => (value === undefined ? '—' : `${value}×`);

const LISTS: { key: keyof Pick<TenantConfig['catalog'], 'metals' | 'karats' | 'types' | 'styles' | 'settings' | 'stones' | 'cuts' | 'molds'>; name: string; options: readonly Option[] }[] = [
  { key: 'metals', name: 'Metals', options: METALS },
  { key: 'karats', name: 'Karats', options: KARATS },
  { key: 'types', name: 'Types', options: GRILLZ_TYPES },
  { key: 'styles', name: 'Finishes', options: STYLES },
  { key: 'settings', name: 'Stone settings', options: SETTINGS },
  { key: 'stones', name: 'Stones', options: STONES },
  { key: 'cuts', name: 'Fit', options: CUTS },
  { key: 'molds', name: 'Molds', options: MOLDS },
];

const PRICE_MAPS: { key: keyof Pick<TenantConfig['pricing'], 'metalPerTooth' | 'stylePerTooth' | 'stonePerTooth' | 'settingPerTooth' | 'inscription'>; options: readonly Option[]; suffix: string }[] = [
  { key: 'metalPerTooth', options: METALS, suffix: ' per tooth' },
  { key: 'stylePerTooth', options: STYLES, suffix: ' per tooth' },
  { key: 'stonePerTooth', options: STONES, suffix: ' per tooth' },
  { key: 'settingPerTooth', options: SETTINGS, suffix: ' setting per tooth' },
  { key: 'inscription', options: INSCRIPTION_STYLES, suffix: ' inscription' },
];

const DISPLAY: Record<TenantConfig['pricing']['display'], string> = { exact: 'exact price', from: '"from" price', hidden: 'price on request' };

const depositText = (deposit: TenantConfig['deposit']) => {
  if (deposit.mode === 'none') return 'no deposit';
  const how = deposit.mode === 'stripe' ? 'card checkout' : 'payment link';
  const amount = deposit.rule.type === 'fixed' ? usd(deposit.rule.amount) : `${deposit.rule.value}% (at least ${usd(deposit.rule.min)})`;
  return `${amount} by ${how}`;
};

export function describeChanges(live: TenantConfig | null, draft: TenantConfig): Change[] {
  if (!live) return [{ area: 'Shop', text: 'First version of the shop page' }];
  const changes: Change[] = [];
  const add = (area: string, text: string) => changes.push({ area, text });

  const b0 = live.brand;
  const b1 = draft.brand;
  if (b0.name !== b1.name) add('Brand', `Name: ${b0.name} → ${b1.name}`);
  if ((b0.logo ?? '') !== (b1.logo ?? '')) add('Brand', b1.logo ? (b0.logo ? 'New logo' : 'Logo added') : 'Logo removed');
  if (b0.accent.toLowerCase() !== b1.accent.toLowerCase()) add('Brand', `Accent colour: ${b0.accent} → ${b1.accent}`);
  if (b0.fontPair !== b1.fontPair) add('Brand', 'Fonts changed');
  if ((b0.instagram ?? '') !== (b1.instagram ?? '')) add('Brand', `Instagram: ${b0.instagram ? `@${b0.instagram}` : 'none'} → ${b1.instagram ? `@${b1.instagram}` : 'none'}`);
  if ((b0.phone ?? '') !== (b1.phone ?? '')) add('Brand', `Phone: ${b0.phone || 'none'} → ${b1.phone || 'none'}`);
  if (b0.poweredBy !== b1.poweredBy) add('Brand', b1.poweredBy ? '"Powered by VVS Lab" shown' : '"Powered by VVS Lab" hidden');

  for (const list of LISTS) {
    const before = live.catalog[list.key] as string[];
    const after = draft.catalog[list.key] as string[];
    after.filter((id) => !before.includes(id)).forEach((id) => add('What you sell', `${list.name}: added ${label(list.options, id)}`));
    before.filter((id) => !after.includes(id)).forEach((id) => add('What you sell', `${list.name}: removed ${label(list.options, id)}`));
  }
  if (live.catalog.fangs !== draft.catalog.fangs) add('What you sell', draft.catalog.fangs ? 'Fangs turned on' : 'Fangs turned off');
  if (live.catalog.vision !== draft.catalog.vision) add('What you sell', draft.catalog.vision ? 'Ideas & inspiration upload turned on' : 'Ideas & inspiration upload turned off');
  if (live.catalog.inscription.enabled !== draft.catalog.inscription.enabled) add('What you sell', draft.catalog.inscription.enabled ? 'Inscriptions turned on' : 'Inscriptions turned off');

  const a0 = live.catalog.addOns ?? [];
  const a1 = draft.catalog.addOns ?? [];
  const priced = (addOn: (typeof a1)[number]) => `${usd(addOn.price)}${addOn.per === 'tooth' ? ' / tooth' : ''}`;
  a1.forEach((addOn) => {
    const before = a0.find((item) => item.id === addOn.id);
    if (!before) add('Add-ons', `Added ${addOn.label} (${priced(addOn)})`);
    else if (before.label !== addOn.label || priced(before) !== priced(addOn) || (before.detail ?? '') !== (addOn.detail ?? '')) add('Add-ons', `${before.label} (${priced(before)}) → ${addOn.label} (${priced(addOn)})`);
  });
  a0.filter((addOn) => !a1.some((item) => item.id === addOn.id)).forEach((addOn) => add('Add-ons', `Removed ${addOn.label}`));

  const p0 = live.pricing;
  const p1 = draft.pricing;
  if (p0.display !== p1.display) add('Prices', `Show ${DISPLAY[p0.display]} → ${DISPLAY[p1.display]}`);
  if (p0.base !== p1.base) add('Prices', `Service fee: ${usd(p0.base)} → ${usd(p1.base)}`);
  if (p0.minimumOrder !== p1.minimumOrder) add('Prices', `Minimum order: ${usd(p0.minimumOrder)} → ${usd(p1.minimumOrder)}`);
  for (const map of PRICE_MAPS) {
    const before = p0[map.key] as Record<string, number>;
    const after = p1[map.key] as Record<string, number>;
    for (const id of Object.keys(after)) {
      if (before[id] !== undefined && before[id] !== after[id]) add('Prices', `${label(map.options, id)}: ${usd(before[id])} → ${usd(after[id])}${map.suffix}`);
    }
  }
  for (const id of Object.keys(p1.karatMultiplier)) {
    const before = (p0.karatMultiplier as Record<string, number>)[id];
    const after = (p1.karatMultiplier as Record<string, number>)[id];
    if (before !== undefined && before !== after) add('Prices', `${label(KARATS, id)} multiplier: ${times(before)} → ${times(after)}`);
  }
  const metalMode = (pricing: typeof p0) => (pricing.market?.enabled ? 'linked to the live metal price' : 'fixed per tooth');
  if (metalMode(p0) !== metalMode(p1)) add('Prices', `Metal priced ${metalMode(p0)} → ${metalMode(p1)}`);
  const marketText = (pricing: typeof p0) =>
    pricing.market?.enabled
      ? [`markup ${pricing.market.markupPercent}%`, ...METALS.filter((metal) => pricing.market!.gramsPerTooth[metal.id] !== undefined).map((metal) => `${metal.label} ${pricing.market!.gramsPerTooth[metal.id]}g + ${usd(pricing.market!.labourPerTooth[metal.id] ?? 0)}`)].join(', ')
      : '';
  if (p0.market?.enabled && p1.market?.enabled && marketText(p0) !== marketText(p1)) add('Prices', `Market pricing: ${marketText(p0)} → ${marketText(p1)}`);
  MOLDS.forEach((mold) => {
    const before = p0.molds?.[mold.id] ?? 0;
    const after = p1.molds?.[mold.id] ?? 0;
    if (before !== after) add('Prices', `${mold.label}: ${usd(before)} → ${usd(after)}`);
  });
  const openFace = (pricing: typeof p0) => `${pricing.icedOpenFace?.stoneShare ?? 100}% of stones + ${usd(pricing.icedOpenFace?.perTooth ?? pricing.stylePerTooth['open-face'] ?? 0)}`;
  if (openFace(p0) !== openFace(p1)) add('Prices', `Iced open face: ${openFace(p0)} → ${openFace(p1)}`);
  if ((p0.fangsPer ?? 'set') !== (p1.fangsPer ?? 'set')) add('Prices', `Fangs charged ${p1.fangsPer === 'fang' ? 'per fang' : 'per set'}`);
  (['premolar', 'molar'] as const).forEach((position) => {
    const before = p0.positions?.[position] ?? 100;
    const after = p1.positions?.[position] ?? 100;
    if (before !== after) add('Prices', `${position === 'premolar' ? 'Premolars' : 'Molars'}: ${before}% → ${after}% of a front tooth`);
  });
  const tiers = (pricing: typeof p0) => (pricing.volume ?? []).map((tier) => `${tier.percentOff}% off from ${tier.minTeeth} teeth`).join(', ') || 'none';
  if (tiers(p0) !== tiers(p1)) add('Prices', `Set-size discounts: ${tiers(p0)} → ${tiers(p1)}`);
  (['fangs', 'photo'] as const).forEach((key) => {
    if (p0.extras[key] !== p1.extras[key]) add('Prices', `${{ fangs: 'Fangs', photo: 'Photo artwork' }[key]}: ${usd(p0.extras[key])} → ${usd(p1.extras[key])}`);
  });
  // The fit: amount and how it's counted (permanent look's flat price included, for shops without cut prices).
  CUTS.forEach((cut) => {
    const text = (pricing: typeof p0) => {
      const price = cutPrice(pricing, cut.id);
      return price.amount ? `${usd(price.amount)} per ${price.per}` : 'free';
    };
    if (text(p0) !== text(p1)) add('Prices', `${cut.label}: ${text(p0)} → ${text(p1)}`);
  });

  const d0 = depositText(live.deposit);
  const d1 = depositText(draft.deposit);
  if (d0 !== d1) add('Deposit', `${d0} → ${d1}`);
  else if ((live.deposit.link ?? '') !== (draft.deposit.link ?? '')) add('Deposit', 'Payment link changed');

  const e0 = live.leads.email.join(', ');
  const e1 = draft.leads.email.join(', ');
  if (e0 !== e1) add('Leads', `Lead emails: ${e0 || 'none'} → ${e1 || 'none'}`);
  if (live.ai.monthlyGenerations !== draft.ai.monthlyGenerations) add('AI photos', `${live.ai.monthlyGenerations} → ${draft.ai.monthlyGenerations} a month`);
  return changes;
}
