import { usableAccent } from '../../src/lib/tenant/theme.js';
import type { TenantConfig } from '../../src/lib/tenant/schema.js';

// Everything brand-specific about an email lives here. The components in
// components.tsx take a Brand and nothing else, so another product reuses the
// whole system by writing one of these.

export type Palette = {
  page: string;
  card: string;
  text: string;
  muted: string;
  line: string;
  /** The italic headline word (large text: needs 3:1 against the card). */
  highlight: string;
  /** Inline links in body text (needs 4.5:1 against the card). */
  link: string;
  button: string;
  buttonText: string;
};

export type Brand = {
  name: string;
  /** Top of the email: an image logo, or the name set in the serif. */
  logo: { src: string; alt: string; height: number } | { wordmark: string };
  /** Small mark in the footer, or a "Powered by" line for white-label mail. */
  footerMark: { src: string; alt: string; height: number } | { poweredBy: { label: string; href: string } };
  light: Palette & { footerText: string; footerLink: string };
  /** Applied by clients that support prefers-color-scheme (Apple Mail, iOS Mail, Outlook apps). */
  dark: Palette;
  fonts: { serif: string; sans: string; webFontCss?: string };
  /** Legal sender line (CAN-SPAM: name and physical address). */
  company: string;
  links: { label: string; href: string }[];
  instagram?: { handle: string; icon: string };
};

const SERIF = `'Instrument Serif',Georgia,'Times New Roman',serif`;
const SANS = `-apple-system,BlinkMacSystemFont,'Segoe UI',Helvetica,Arial,sans-serif`;
const INSTRUMENT_SERIF = 'https://fonts.googleapis.com/css2?family=Instrument+Serif:ital@0;1&display=swap';
const MAGPOLLO = 'Magpollo Corp · 2655 Daniel Park Run, Dacula, GA 30019';

const at = (origin: string, path: string) => (path.startsWith('http') ? path : `${origin.replace(/\/$/, '')}${path.startsWith('/') ? '' : '/'}${path}`);

const vvsLinks = (origin: string) => [
  { label: 'Your dashboard', href: at(origin, '/dashboard') },
  { label: 'Terms', href: at(origin, '/terms') },
  { label: 'Privacy', href: at(origin, '/privacy') },
];

/** VVS Lab writing to jewelers: ink frame, gold mark, cream card. */
export function vvsBrand(origin: string): Brand {
  return {
    name: 'VVS Lab',
    logo: { src: at(origin, '/assets/email/vvs-mark.png'), alt: 'VVS Lab', height: 44 },
    footerMark: { src: at(origin, '/assets/email/vvs-mark.png'), alt: 'VVS Lab', height: 20 },
    light: {
      page: '#1b1714',
      card: '#fbf7f0',
      text: '#1b1714',
      muted: '#6f655a',
      line: '#e7ddcd',
      highlight: '#a87b23',
      link: '#7a5714',
      button: '#1b1714',
      buttonText: '#fbf7f0',
      footerText: '#b9ad9a',
      footerLink: '#e7d7b8',
    },
    dark: { page: '#141110', card: '#221c17', text: '#f3ede4', muted: '#b5a995', line: '#3b332b', highlight: '#e2b85e', link: '#e2b85e', button: '#e2b85e', buttonText: '#1b1714' },
    fonts: { serif: SERIF, sans: SANS, webFontCss: INSTRUMENT_SERIF },
    company: MAGPOLLO,
    links: vvsLinks(origin),
    instagram: { handle: 'vvslab.ai', icon: at(origin, '/assets/email/instagram-light.png') },
  };
}

/** A shop writing to its customer (white-label): light frame, the shop's logo and accent. */
export function shopBrand(brand: TenantConfig['brand'], origin: string): Brand {
  const accent = usableAccent(brand.accent, '#ffffff');
  return {
    name: brand.name,
    logo: brand.logo ? { src: at(origin, brand.logo), alt: brand.name, height: 36 } : { wordmark: brand.name },
    footerMark: { poweredBy: { label: 'VVS Lab', href: 'https://vvslab.magpollo.com/?utm_source=email&utm_medium=powered_by' } },
    light: {
      page: '#f3efe8',
      card: '#ffffff',
      text: '#1b1714',
      muted: '#6f655a',
      line: '#ece5da',
      highlight: accent,
      link: accent,
      button: accent,
      buttonText: '#ffffff',
      footerText: '#8a8178',
      footerLink: '#5c544c',
    },
    dark: { page: '#151210', card: '#221c17', text: '#f3ede4', muted: '#b5a995', line: '#3b332b', highlight: '#f3ede4', link: '#f3ede4', button: accent, buttonText: '#ffffff' },
    fonts: { serif: SERIF, sans: SANS, webFontCss: INSTRUMENT_SERIF },
    company: MAGPOLLO,
    links: [],
  };
}
