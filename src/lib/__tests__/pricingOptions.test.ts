import { describe, expect, it } from 'vitest';
import { metalPerTooth, priceBreakdown, volumeDiscount } from '../pricing';
import { DEFAULT_SET, type RenderTooth } from '../renderSpec';
import { parseTenantConfig, type TenantPricing } from '../tenant/schema';
import { VVSLAB_CONFIG } from '../tenant/vvslab';
import { describeChanges } from '../tenant/diff';

const base = VVSLAB_CONFIG.pricing;
const plain: RenderTooth = { index: 7, metal: 'yellow', karat: '10k', type: 'plain', style: 'solid', setting: 'honeycomb', stone: 'moissanite' };
const iced: RenderTooth = { ...plain, type: 'iced' };
const set = (tooth: RenderTooth, count: number) => Array.from({ length: count }, () => tooth);
const total = (pricing: TenantPricing, teeth: RenderTooth[]) => priceBreakdown(pricing, teeth, DEFAULT_SET).total;

describe('pricing options', () => {
  it("leaves a shop's totals unchanged until it sets the new options", () => {
    const parsed = parseTenantConfig(VVSLAB_CONFIG);
    expect(parsed.ok).toBe(true);
    const openFace = { ...iced, style: 'open-face' as const };
    const before = base.metalPerTooth.yellow! + base.stonePerTooth.moissanite! + (base.settingPerTooth.honeycomb ?? 0) + base.stylePerTooth['open-face']!;
    expect(total(base, [openFace])).toBe(Math.max(base.minimumOrder, base.base + before));
  });

  it('charges iced open face a share of the stones plus its own labour', () => {
    const pricing: TenantPricing = { ...base, minimumOrder: 0, icedOpenFace: { stoneShare: 50, perTooth: 25 } };
    const lines = priceBreakdown(pricing, [{ ...iced, style: 'open-face' }], DEFAULT_SET).lines;
    expect(lines.find((line) => line.label === 'Stones')?.amount).toBe(Math.round(base.stonePerTooth.moissanite! / 2));
    expect(lines.find((line) => line.label === 'Style & finish')?.amount).toBe(25);
  });

  it('takes the biggest set-size discount the set reaches off the per-tooth prices only', () => {
    const pricing: TenantPricing = { ...base, minimumOrder: 0, volume: [{ minTeeth: 8, percentOff: 5 }, { minTeeth: 12, percentOff: 10 }] };
    expect(volumeDiscount(pricing, 7)).toBe(0);
    expect(volumeDiscount(pricing, 8)).toBe(5);
    expect(volumeDiscount(pricing, 16)).toBe(10);
    const teeth = set(plain, 12);
    const perTooth = 12 * metalPerTooth(base, 'yellow', '10k');
    expect(total(pricing, teeth)).toBe(base.base + perTooth - Math.round(perTooth * 0.1));
    expect(JSON.stringify(describeChanges(VVSLAB_CONFIG, { ...VVSLAB_CONFIG, pricing }))).toContain('Set-size discounts');
  });

  it('rejects two discounts for the same set size', () => {
    const result = parseTenantConfig({ ...VVSLAB_CONFIG, pricing: { ...base, volume: [{ minTeeth: 8, percentOff: 5 }, { minTeeth: 8, percentOff: 10 }] } });
    expect(result.ok).toBe(false);
  });

  it('prices 22K with its own multiplier', () => {
    expect(metalPerTooth(base, 'yellow', '22k')).toBe(Math.round(base.metalPerTooth.yellow! * base.karatMultiplier['22k']!));
  });
});
