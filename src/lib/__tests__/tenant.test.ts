import { describe, expect, it } from 'vitest';
import { parseRenderSpec } from '../renderSpec';
import { depositFor, displayTotal, priceBreakdown, priceHints } from '../pricing';
import { parseTenantConfig, type TenantConfig } from '../tenant/schema';
import { defaultTooth, shopCatalog } from '../tenant/catalog';
import { VVSLAB_CONFIG } from '../tenant/vvslab';
import { DESIGNS } from './designs';

const clone = (): TenantConfig => structuredClone(VVSLAB_CONFIG);

// A gold-only budget shop: no platinum/silver, no photo grillz, no opals, no 18k.
const budget = (): TenantConfig => {
  const c = clone();
  c.brand = { name: 'Gold Block', accent: '#B8860B', fontPair: 'modern-sans', poweredBy: true };
  c.catalog.metals = ['yellow', 'white'];
  c.catalog.karats = ['10k', '14k'];
  c.catalog.types = ['plain', 'iced'];
  c.catalog.styles = ['solid', 'diamond-cut'];
  c.catalog.settings = ['honeycomb'];
  c.catalog.stones = ['moissanite'];
  c.catalog.fangs = false;
  c.catalog.inscription = { enabled: false, styles: ['cut'] };
  c.catalog.vision = false;
  c.pricing.base = 100;
  c.pricing.metalPerTooth = { yellow: 90, white: 95 };
  c.pricing.minimumOrder = 400;
  return c;
};

describe('tenant config schema', () => {
  it('accepts tenant zero', () => expect(parseTenantConfig(VVSLAB_CONFIG).ok).toBe(true));
  it('accepts a budget shop', () => expect(parseTenantConfig(budget()).ok).toBe(true));

  it('requires a price for every option a shop sells', () => {
    const c = budget();
    c.catalog.metals.push('rose');
    const result = parseTenantConfig(c);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.issues.map((i) => i.path)).toContain('pricing.metalPerTooth.rose');
  });

  it('rejects unknown options, duplicates and empty lists', () => {
    const unknown = clone() as unknown as { catalog: { metals: string[] } };
    unknown.catalog.metals = ['bronze'];
    expect(parseTenantConfig(unknown).ok).toBe(false);
    const dup = clone();
    dup.catalog.karats = ['10k', '10k'];
    expect(parseTenantConfig(dup).ok).toBe(false);
    const empty = clone();
    empty.catalog.types = [] as unknown as TenantConfig['catalog']['types'];
    expect(parseTenantConfig(empty).ok).toBe(false);
  });

  it('needs a fixed deposit when prices are hidden', () => {
    const c = clone();
    c.pricing.display = 'hidden';
    expect(parseTenantConfig(c).ok).toBe(false);
    c.deposit.rule = { type: 'fixed', amount: 100 };
    expect(parseTenantConfig(c).ok).toBe(true);
  });

  it('needs a link when the deposit is an external link', () => {
    const c = clone();
    c.deposit.mode = 'link';
    expect(parseTenantConfig(c).ok).toBe(false);
    c.deposit.link = 'https://buy.stripe.com/test_123';
    expect(parseTenantConfig(c).ok).toBe(true);
  });

  it('rejects a bad accent colour and Instagram handle', () => {
    const c = clone();
    c.brand.accent = 'gold';
    expect(parseTenantConfig(c).ok).toBe(false);
    const d = clone();
    d.brand.instagram = '@vvslab.ai';
    expect(parseTenantConfig(d).ok).toBe(false);
  });
});

describe('shop catalog', () => {
  it('lists only what the shop sells, in platform order', () => {
    const cat = shopCatalog(budget().catalog);
    expect(cat.metals.map((m) => m.id)).toEqual(['yellow', 'white']);
    expect(cat.inscriptionStyles).toEqual([]);
    expect(cat.fangs).toBe(false);
  });

  it('moves the default tooth onto options the shop sells', () => {
    const c = budget();
    c.catalog.metals = ['white'];
    c.pricing.metalPerTooth = { white: 95 };
    expect(defaultTooth(c.catalog).metal).toBe('white');
  });
});

describe('pricing', () => {
  it('applies the minimum order', () => {
    const c = budget();
    const result = priceBreakdown(c.pricing, DESIGNS.single.teeth, DESIGNS.single);
    expect(result.total).toBe(400);
    expect(result.lines.at(-1)).toEqual({ label: 'Minimum order adjustment', amount: 400 - (100 + 90) });
  });

  it('computes percent and fixed deposits', () => {
    expect(depositFor(VVSLAB_CONFIG.deposit, 2000)).toBe(500);
    expect(depositFor(VVSLAB_CONFIG.deposit, 120)).toBe(100);
    expect(depositFor({ mode: 'stripe', rule: { type: 'fixed', amount: 150 } }, 9999)).toBe(150);
    expect(depositFor({ mode: 'none', rule: { type: 'fixed', amount: 150 } }, 9999)).toBeNull();
  });

  it('follows the price display mode', () => {
    const fmt = (v: number) => `$${v}`;
    const c = clone();
    expect(displayTotal(c.pricing, 1200, fmt).text).toBe('$1200');
    c.pricing.display = 'from';
    expect(displayTotal(c.pricing, 1200, fmt).text).toBe('From $1200');
    c.pricing.display = 'hidden';
    expect(displayTotal(c.pricing, 1200, fmt)).toEqual({ text: 'Price on request', amount: null });
    expect(priceHints(c.pricing).metal('yellow', '10k')).toBeUndefined();
  });
});

describe('render spec validation against a shop catalog', () => {
  const shop = budget().catalog;
  it('accepts a design the shop sells', () => expect(parseRenderSpec(DESIGNS.plain6x6, shop)).not.toBeNull());
  it('rejects options the shop does not sell', () => {
    expect(parseRenderSpec(DESIGNS.fullSetSilver, shop)).toBeNull();
    expect(parseRenderSpec(DESIGNS.openFaceFangs, shop)).toBeNull();
    expect(parseRenderSpec(DESIGNS.inscriptionCut, shop)).toBeNull();
    expect(parseRenderSpec(DESIGNS.engravingVision, shop)).toBeNull();
  });
  it('still accepts everything without a catalog', () => expect(parseRenderSpec(DESIGNS.mixedFour)).not.toBeNull());
});
