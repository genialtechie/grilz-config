import type { TenantConfig } from '../lib/tenant/schema.js';
import { VVSLAB_CONFIG } from '../lib/tenant/vvslab.js';

// Starting points for a new shop. Prices are placeholders the onboarding call
// replaces; every shop starts with no deposit until Stripe (Stage 5) or a link.

const base = (name: string): TenantConfig => ({
  ...structuredClone(VVSLAB_CONFIG),
  brand: { name, accent: '#C9A45C', fontPair: 'modern-sans', poweredBy: true },
  deposit: { mode: 'none', rule: { type: 'fixed', amount: 100 } },
  leads: { email: [], sms: [] },
  ai: { monthlyGenerations: 300 },
});

export const TEMPLATES: { id: string; label: string; detail: string; build: (name: string) => TenantConfig }[] = [
  { id: 'full', label: 'Full catalog', detail: 'Every metal, style, stone and extra', build: base },
  {
    id: 'gold',
    label: 'Gold only',
    detail: 'Yellow and white gold, plain and iced, no photo grillz',
    build: (name) => {
      const config = base(name);
      config.catalog = {
        ...config.catalog,
        metals: ['yellow', 'white'],
        karats: ['10k', '14k'],
        types: ['plain', 'iced'],
        styles: ['solid', 'diamond-cut'],
        settings: ['honeycomb'],
        stones: ['moissanite'],
        inscription: { enabled: false, styles: ['cut'] },
        vision: false,
        molds: ['kit', 'store'],
      };
      return config;
    },
  },
];

/** A fallback price when an option is switched on, taken from the VVS Lab sample prices. */
export const SAMPLE_PRICING = VVSLAB_CONFIG.pricing;
