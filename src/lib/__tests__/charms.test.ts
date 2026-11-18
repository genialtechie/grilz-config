import { describe, expect, it } from 'vitest';
import { charmPrice, priceBreakdown, priceHints } from '../pricing';
import { CHARMS, DEFAULT_SET, buildPhotoPrompt, describeSpec, parseRenderSpec, summarizeDesign, type ToothDesign } from '../renderSpec';
import { shopCatalog } from '../tenant/catalog';
import { describeChanges } from '../tenant/diff';
import { parseTenantConfig, type TenantConfig } from '../tenant/schema';
import { VVSLAB_CONFIG } from '../tenant/vvslab';
import { TEMPLATES } from '../../admin/templates';

const tooth: ToothDesign = { metal: 'yellow', karat: '10k', type: 'plain', style: 'solid', setting: 'honeycomb', stone: 'moissanite' };
const teeth = [5, 6, 7, 8, 9, 10].map((index) => ({ ...tooth, index }));
const noCharms = { ...VVSLAB_CONFIG.catalog, charms: undefined };
const priced = (pricing: Partial<TenantConfig['pricing']['charms']>): TenantConfig['pricing'] => ({ ...VVSLAB_CONFIG.pricing, charms: pricing });

describe('charms in the shop config', () => {
  it('accepts the demo shop with every charm, and shops from before charms', () => {
    expect(parseTenantConfig(VVSLAB_CONFIG).ok).toBe(true);
    expect(VVSLAB_CONFIG.catalog.charms?.ids).toEqual(CHARMS.map((charm) => charm.id));
    expect(parseTenantConfig({ ...VVSLAB_CONFIG, catalog: noCharms }).ok).toBe(true);
  });

  it('rejects unknown, repeated or empty charm lists and bad prices', () => {
    const withIds = (ids: string[]) => ({ ...VVSLAB_CONFIG, catalog: { ...VVSLAB_CONFIG.catalog, charms: { enabled: true, ids } } });
    expect(parseTenantConfig(withIds(['crown', 'logo'])).ok).toBe(false);
    expect(parseTenantConfig(withIds(['crown', 'crown'])).ok).toBe(false);
    expect(parseTenantConfig(withIds([])).ok).toBe(false);
    expect(parseTenantConfig({ ...VVSLAB_CONFIG, pricing: priced({ each: -5 }) }).ok).toBe(false);
    expect(parseTenantConfig({ ...VVSLAB_CONFIG, pricing: priced({ each: 120, byId: { crown: 300 } }) }).ok).toBe(true);
  });

  it('lists the charms a shop sells, none when off', () => {
    expect(shopCatalog(VVSLAB_CONFIG.catalog).charms).toHaveLength(CHARMS.length);
    expect(shopCatalog({ ...VVSLAB_CONFIG.catalog, charms: { enabled: false, ids: ['crown'] } }).charms).toEqual([]);
    expect(shopCatalog(noCharms).charms).toEqual([]);
  });

  it('starts new shops with charms off', () => {
    TEMPLATES.forEach((template) => expect(template.build('New shop').catalog.charms?.enabled).toBe(false));
  });

  it('says when charms are turned on or their price changes', () => {
    const off = { ...VVSLAB_CONFIG, catalog: noCharms };
    expect(describeChanges(off, VVSLAB_CONFIG).map((change) => change.text)).toContain('Charms turned on');
    expect(describeChanges(VVSLAB_CONFIG, { ...VVSLAB_CONFIG, pricing: priced({ each: 150 }) }).map((change) => change.text)).toContain('Charms: quoted by you → $150 each');
  });
});

describe('charms in a design', () => {
  it('keeps old designs and clients valid: no charms, no charms field', () => {
    const spec = parseRenderSpec({ ...DEFAULT_SET, teeth }, VVSLAB_CONFIG.catalog);
    expect(spec).not.toBeNull();
    expect(spec).not.toHaveProperty('charms');
    expect(parseRenderSpec({ ...DEFAULT_SET, teeth, charms: [] }, VVSLAB_CONFIG.catalog)).not.toHaveProperty('charms');
  });

  it('takes charms on teeth in the set, one a tooth, sorted', () => {
    const spec = parseRenderSpec({ ...DEFAULT_SET, teeth, charms: [{ id: 'owl', tooth: 8 }, { id: 'crown', tooth: 7 }] }, VVSLAB_CONFIG.catalog);
    expect(spec?.charms).toEqual([
      { id: 'crown', tooth: 7 },
      { id: 'owl', tooth: 8 },
    ]);
  });

  it('clamps: unknown charms, teeth outside the set, two on a tooth, junk', () => {
    const parse = (charms: unknown) => parseRenderSpec({ ...DEFAULT_SET, teeth, charms }, VVSLAB_CONFIG.catalog);
    expect(parse([{ id: 'logo', tooth: 7 }])).toBeNull();
    expect(parse([{ id: 'crown', tooth: 20 }])).toBeNull();
    expect(parse([{ id: 'crown', tooth: 7 }, { id: 'owl', tooth: 7 }])).toBeNull();
    expect(parse([{ id: 'crown' }])).toBeNull();
    expect(parse('crown')).toBeNull();
    expect(parse([null])).toBeNull();
  });

  it('refuses charms the shop does not sell', () => {
    const charms = [{ id: 'crown', tooth: 7 }];
    expect(parseRenderSpec({ ...DEFAULT_SET, teeth, charms }, noCharms)).toBeNull();
    expect(parseRenderSpec({ ...DEFAULT_SET, teeth, charms }, { ...VVSLAB_CONFIG.catalog, charms: { enabled: false, ids: ['crown'] } })).toBeNull();
    expect(parseRenderSpec({ ...DEFAULT_SET, teeth, charms }, { ...VVSLAB_CONFIG.catalog, charms: { enabled: true, ids: ['owl'] } })).toBeNull();
    // Without a shop to check against (the platform catalogue), any charm passes.
    expect(parseRenderSpec({ ...DEFAULT_SET, teeth, charms })?.charms).toEqual(charms);
  });

  it('names each charm and its tooth for the shop and the photo', () => {
    const spec = parseRenderSpec({ ...DEFAULT_SET, teeth, charms: [{ id: 'crown', tooth: 7 }] }, VVSLAB_CONFIG.catalog)!;
    expect(summarizeDesign(spec)).toContain('Crown charm on the upper left central incisor');
    expect(describeSpec(spec)).toContain('five-pointed gold crown');
    expect(buildPhotoPrompt(spec)).toContain('Keep every charm');
    expect(buildPhotoPrompt({ ...spec, charms: undefined })).not.toContain('Keep every charm');
  });
});

describe('charm prices', () => {
  const set = { ...DEFAULT_SET, charms: [{ id: 'crown' as const, tooth: 7 }, { id: 'owl' as const, tooth: 8 }] };

  it('quotes charms the shop has not priced, out of the total', () => {
    const plain = priceBreakdown(VVSLAB_CONFIG.pricing, teeth, DEFAULT_SET);
    const quoted = priceBreakdown(VVSLAB_CONFIG.pricing, teeth, set);
    expect(quoted.total).toBe(plain.total);
    expect(quoted.quoted).toEqual(['Crown charm', 'Owl charm']);
    expect(plain).not.toHaveProperty('quoted');
  });

  it('prices each charm, a charm of its own price winning', () => {
    const pricing = priced({ each: 120, byId: { crown: 300 } });
    const breakdown = priceBreakdown(pricing, teeth, set);
    expect(breakdown.lines).toContainEqual({ label: 'Crown charm', amount: 300 });
    expect(breakdown.lines).toContainEqual({ label: 'Owl charm', amount: 120 });
    expect(breakdown.total).toBe(priceBreakdown(pricing, teeth, DEFAULT_SET).total + 420);
    expect(breakdown).not.toHaveProperty('quoted');
    expect(charmPrice(priced({ byId: { owl: 90 } }), 'crown')).toBeUndefined();
  });

  it('only counts charms on teeth in the set', () => {
    expect(priceBreakdown(priced({ each: 100 }), teeth, { ...DEFAULT_SET, charms: [{ id: 'crown', tooth: 30 }] }).total).toBe(priceBreakdown(VVSLAB_CONFIG.pricing, teeth, DEFAULT_SET).total);
  });

  it('hints the price, or that the shop quotes it', () => {
    expect(priceHints(VVSLAB_CONFIG.pricing).charm('crown')).toBe('Quoted');
    expect(priceHints(priced({ each: 150 })).charm('crown')).toBe('+$150');
    expect(priceHints({ ...priced({ each: 150 }), display: 'hidden' }).charm('crown')).toBeUndefined();
  });
});
