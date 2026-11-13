import { describe, expect, it } from 'vitest';
import { shopLooks } from '../startingLooks';
import { buildTenant } from '../tenant/tenant';
import { VVSLAB_CONFIG } from '../tenant/vvslab';

// "Start from a look" on the first step (MAG-148): a shop sees only the looks it sells all of.

const ids = (config: typeof VVSLAB_CONFIG) => shopLooks(buildTenant('test', config)).map(({ look }) => look.id);

describe('starting looks', () => {
  it('the demo shop sells every look', () => {
    expect(ids(VVSLAB_CONFIG)).toEqual(['gold', 'iced', 'open-face', 'iced-fangs', 'two-tone']);
  });

  it('no iced looks without iced, no fangs without fangs', () => {
    const plainOnly = { ...VVSLAB_CONFIG, catalog: { ...VVSLAB_CONFIG.catalog, types: ['plain'] as const, fangs: false } };
    expect(ids(plainOnly as unknown as typeof VVSLAB_CONFIG)).toEqual(['gold', 'open-face', 'two-tone']);
    const noFangs = { ...VVSLAB_CONFIG, catalog: { ...VVSLAB_CONFIG.catalog, fangs: false } };
    expect(ids(noFangs)).not.toContain('iced-fangs');
  });

  it('no two-tone or open face when the shop lacks white gold or open face', () => {
    const narrow = { ...VVSLAB_CONFIG, catalog: { ...VVSLAB_CONFIG.catalog, metals: ['yellow'], styles: ['solid'] } };
    expect(ids(narrow as unknown as typeof VVSLAB_CONFIG)).toEqual(['gold', 'iced', 'iced-fangs']);
  });

  it('a look sets teeth, tooth design and fangs together', () => {
    const fangs = shopLooks(buildTenant('test', VVSLAB_CONFIG)).find(({ look }) => look.id === 'iced-fangs')!.design;
    expect(fangs.teeth).toEqual([5, 6, 7, 8, 9, 10]);
    expect(fangs.base.type).toBe('iced');
    expect(fangs.set.fangs).toBe(true);
  });
});
