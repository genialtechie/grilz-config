import type { CSSProperties } from 'react';
import type { TenantConfig } from './schema';

// Brand tokens for a shop page. Shops pick an accent and a font pair; the rest
// of the design is fixed so every shop still looks premium.

const channel = (hex: string, i: number) => Number.parseInt(hex.slice(1 + i * 2, 3 + i * 2), 16) / 255;
const linear = (c: number) => (c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4);
export const luminance = (hex: string) => 0.2126 * linear(channel(hex, 0)) + 0.7152 * linear(channel(hex, 1)) + 0.0722 * linear(channel(hex, 2));
export const contrast = (a: string, b: string) => {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (hi + 0.05) / (lo + 0.05);
};

export const mix = (hex: string, toward: string, amount: number) => {
  const out = [0, 1, 2].map((i) => Math.round((channel(hex, i) * (1 - amount) + channel(toward, i) * amount) * 255));
  return `#${out.map((value) => value.toString(16).padStart(2, '0')).join('')}`;
};

/** The accent as a usable colour: darkened until it reads on the light surface (3:1 for UI marks). */
export const usableAccent = (accent: string, surface = '#faf8f5') => {
  let colour = accent.toLowerCase();
  for (let step = 0; step < 10 && contrast(colour, surface) < 3; step += 1) colour = mix(colour, '#000000', 0.12);
  return colour;
};

export const themeStyle = (brand: TenantConfig['brand']): CSSProperties => {
  const accent = usableAccent(brand.accent);
  return {
    '--accent': accent,
    '--accent-soft': mix(accent, '#ffffff', 0.86),
  } as CSSProperties;
};

export const fontPairClass = (brand: TenantConfig['brand']) => `font-pair--${brand.fontPair}`;
