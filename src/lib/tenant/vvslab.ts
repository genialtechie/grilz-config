import type { TenantConfig } from './schema.js';

/** Tenant zero: the public VVS Lab demo. Its prices are the sample prices shown on the site. */
export const VVSLAB_CONFIG: TenantConfig = {
  schemaVersion: 1,
  // Keeps the builder's existing look: Magpollo red accent, Inter throughout.
  brand: { name: 'VVS Lab', logo: '/assets/vvs/logo-mark.png', accent: '#CE4257', fontPair: 'modern-sans', instagram: 'vvslab.ai', poweredBy: false },
  catalog: {
    metals: ['yellow', 'white', 'rose', 'silver', 'platinum'],
    karats: ['10k', '14k', '18k'],
    types: ['plain', 'iced', 'photo'],
    styles: ['solid', 'open-face', 'diamond-cut', 'diamond-dust', 'engraving', 'opals'],
    settings: ['honeycomb', 'mosaic', 'prong'],
    stones: ['moissanite', 'lab', 'natural'],
    cuts: ['deep', 'permanent'],
    molds: ['kit', 'own', 'store'],
    fangs: true,
    inscription: { enabled: true, styles: ['cut', 'iced', 'engraved'] },
    vision: true,
  },
  pricing: {
    currency: 'USD',
    display: 'exact',
    base: 200,
    metalPerTooth: { yellow: 150, white: 150, rose: 150, silver: 85, platinum: 320 },
    karatMultiplier: { '10k': 1, '14k': 1.4, '18k': 1.85 },
    stylePerTooth: { solid: 0, 'open-face': 40, 'diamond-cut': 35, 'diamond-dust': 30, engraving: 45, opals: 90 },
    stonePerTooth: { moissanite: 75, lab: 160, natural: 320 },
    settingPerTooth: { honeycomb: 0, mosaic: 25, prong: 0 },
    extras: { fangs: 150, permanent: 100, photo: 250 },
    inscription: { cut: 75, iced: 150, engraved: 50 },
    minimumOrder: 0,
  },
  // The demo shows the deposit step but charges nothing (the tenant registry marks it as a demo).
  deposit: { mode: 'stripe', rule: { type: 'percent', value: 25, min: 100, roundTo: 10 } },
  leads: { email: [], sms: [] },
  ai: { monthlyGenerations: 1000 },
};
