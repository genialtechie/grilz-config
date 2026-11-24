import { describe, expect, it } from 'vitest';
import { parseRenderSpec } from '../../../lib/renderSpec';
import { priceBreakdown } from '../../../lib/pricing';
import { toothCustomization } from '../../../lib/toothCustomization';
import { buildTenant } from '../../../lib/tenant/tenant';
import { VVSLAB_CONFIG } from '../../../lib/tenant/vvslab';
import { toothLook } from '../../three/redesign/dress';
import { apply, blankDesign, fromSnapshot, price, setOptions, setRange, summary, toSnapshot, toSpec } from '../model';

// Iced + opals on one tooth (an opal centre inside a border of stones), as the old builder and lib/pricing have it.
const shop = buildTenant('vvslab', VVSLAB_CONFIG, true);

const icedOpal = () => {
  let d = setRange(blankDesign(shop), 6, 6);
  d = apply(shop, d, d.teeth, { g: 'setting', k: 'honeycomb' }, true);
  d = apply(shop, d, d.teeth, { g: 'style', k: 'opals' }, true);
  return apply(shop, d, d.teeth, { g: 'opal', k: 'blue' }, true);
};

describe('iced with opals in the builder', () => {
  it('lets an iced tooth take opals, and picking a setting keeps the opal', () => {
    const d = icedOpal();
    expect(d.designs[7]).toMatchObject({ type: 'iced', style: 'opals', opal: 'blue' });
    const moved = apply(shop, d, d.teeth, { g: 'setting', k: 'prong' }, true);
    expect(moved.designs[7]).toMatchObject({ type: 'iced', setting: 'prong', style: 'opals', opal: 'blue' });
    // Opals first, stones after: still opals.
    let first = setRange(blankDesign(shop), 6, 6);
    first = apply(shop, first, first.teeth, { g: 'style', k: 'opals' }, true);
    first = apply(shop, first, first.teeth, { g: 'setting', k: 'honeycomb' }, true);
    expect(first.designs[7]).toMatchObject({ type: 'iced', style: 'opals' });
    // Open face stays under stones; any other finish becomes solid.
    let open = apply(shop, setRange(blankDesign(shop), 6, 6), [], { g: 'style', k: 'open-face' }, true);
    open = apply(shop, open, open.teeth, { g: 'style', k: 'open-face' }, true);
    expect(apply(shop, open, open.teeth, { g: 'setting', k: 'honeycomb' }, true).designs[7].style).toBe('open-face');
    let cut = setRange(blankDesign(shop), 6, 6);
    cut = apply(shop, cut, cut.teeth, { g: 'style', k: 'diamond-cut' }, true);
    expect(apply(shop, cut, cut.teeth, { g: 'setting', k: 'honeycomb' }, true).designs[7].style).toBe('solid');
  });

  it('prices it as lib/pricing does, says it in words, and keeps it through a saved design', () => {
    const d = icedOpal();
    const spec = toSpec(d)!;
    expect(price(shop, d)).toEqual(priceBreakdown(shop.config.pricing, spec.teeth, setOptions(d), shop.config.catalog.addOns ?? []));
    const solid = apply(shop, d, d.teeth, { g: 'style', k: 'solid' }, true);
    expect(price(shop, d).total).not.toBe(price(shop, solid).total);
    expect(summary(d)).toBe('6 × 6 · 10K yellow gold · iced with blue opal centre · honeycomb · moissanite');
    expect(parseRenderSpec(spec, shop.config.catalog)).toEqual(spec);
    expect(toSpec(fromSnapshot(shop, toSnapshot(d)))).toEqual(spec);
  });

  it('asks the 3D for stones and an opal on the same tooth', () => {
    const t = icedOpal().designs[7];
    const look = toothLook(toothCustomization(t, { fangs: false, cut: 'deep' }, 7));
    expect(look).toMatchObject({ type: 'iced', style: 'opal', opal: 'blue' });
  });
});
