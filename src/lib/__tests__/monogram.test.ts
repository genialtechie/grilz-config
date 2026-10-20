import { describe, expect, it } from 'vitest';
import { monogram } from '../tenant/monogram';

describe('monogram', () => {
  it('takes the first letters of the first two words', () => {
    expect(monogram('Gold Mouth ATL')).toBe('GM');
    expect(monogram('The Ice Box')).toBe('IB');
    expect(monogram('Goldie’s')).toBe('G');
    expect(monogram('ice & gold co')).toBe('IG');
    expect(monogram('Café Grillz')).toBe('CG');
    expect(monogram('404 Grillz')).toBe('4G');
    expect(monogram('  ')).toBe('?');
  });
});
