import { usableAccent } from '../../src/lib/tenant/theme.js';
import type { TenantConfig } from '../../src/lib/tenant/schema.js';

// Everything brand-specific about an email lives here. The components in
// components.ts take a Brand and nothing else, so another product reuses the
// whole system by writing one of these.

export type Palette = {
  /** The one surface the whole email sits on. */
  page: string;
  text: string;
  muted: string;
  line: string;
  /** The highlighted headline word (large text: needs 3:1 against the page). */
  highlight: string;
  /** Inline links in body text (needs 4.5:1 against the page). */
  link: string;
  button: string;
  buttonText: string;
};

export type Brand = {
  name: string;
  /** Top of the email: an image logo (with an optional word set beside it, as in "VVS" mark + "Lab"), or the name set in type. */
  logo: { src: string; alt: string; height: number; word?: string } | { wordmark: string };
  /** Sign-off line under the body, e.g. "— The VVS Lab team". */
  signOff: string;
  /** What closes the footer: nothing, an image, or a "Powered by" line for white-label mail. */
  footerMark: { none: true } | { src: string; alt: string; height: number } | { poweredBy: { label: string; href: string } };
  light: Palette;
  /** Applied by clients that support prefers-color-scheme (Apple Mail, iOS Mail, Outlook apps). */
  dark: Palette;
  /** `display` sets headlines and quotes; `sans` everything else. */
  fonts: { display: string; sans: string; webFontCss?: string };
  /** Legal sender line (CAN-SPAM: name and physical address). */
  company: string;
  links: { label: string; href: string }[];
  /** Footer social tiles (PNG, shown at 40px). */
  socials: { label: string; href: string; icon: string }[];
};

// The redesign's one family, Geist (Apple Mail and iOS load it; Gmail and Outlook fall back to the system sans).
const SANS = `Geist,-apple-system,BlinkMacSystemFont,'Segoe UI',Helvetica,Arial,sans-serif`;
const GEIST = 'https://fonts.googleapis.com/css2?family=Geist:wght@400;500;600&display=swap';
const MAGPOLLO = 'Magpollo Corp · 2655 Daniel Park Run, Dacula, GA 30019';

const at = (origin: string, path: string) => (path.startsWith('http') ? path : `${origin.replace(/\/$/, '')}${path.startsWith('/') ? '' : '/'}${path}`);

const vvsLinks = (origin: string) => [
  { label: 'Your dashboard', href: at(origin, '/dashboard') },
  { label: 'Terms', href: at(origin, '/terms') },
  { label: 'Privacy', href: at(origin, '/privacy') },
];

/** VVS Lab's own mail (Nov 2026 redesign): one stone surface (ink in dark mode), the gold
 * "VVS" mark + "Lab", ink buttons, gold for the one highlighted headline word. Gold is the
 * metal, so it stays out of small text: on stone it is 4.1:1, fine for large type only. */
export function vvsBrand(origin: string): Brand {
  return {
    name: 'VVS Lab',
    logo: { src: at(origin, '/assets/email/vvs-mark.png'), alt: 'VVS', height: 22, word: 'Lab' },
    signOff: '— The VVS Lab team',
    footerMark: { none: true },
    // Contrast on the page: text 16.9:1, muted 5.3:1, highlight 4.1:1 (large text), button text 18.7:1; dark: muted 8.8:1, highlight 10.1:1.
    light: { page: '#f4f3ef', text: '#121211', muted: '#66645e', line: '#dcdad3', highlight: '#9a6d16', link: '#121211', button: '#121211', buttonText: '#ffffff' },
    dark: { page: '#121211', text: '#f4f3ef', muted: '#b5b2a9', line: '#2e2d2a', highlight: '#e3b95c', link: '#f4f3ef', button: '#f4f3ef', buttonText: '#121211' },
    fonts: { display: SANS, sans: SANS, webFontCss: GEIST },
    company: MAGPOLLO,
    links: vvsLinks(origin),
    socials: [{ label: 'Instagram', href: 'https://instagram.com/vvslab.ai', icon: at(origin, '/assets/email/instagram-tile.png') }],
  };
}

/** A shop writing to its customer (white-label): white surface, the shop's logo and accent. */
export function shopBrand(brand: TenantConfig['brand'], origin: string): Brand {
  const accent = usableAccent(brand.accent, '#ffffff');
  return {
    name: brand.name,
    logo: brand.logo ? { src: at(origin, brand.logo), alt: brand.name, height: 36 } : { wordmark: brand.name },
    signOff: `— ${brand.name}`,
    footerMark: { poweredBy: { label: 'VVS Lab', href: 'https://vvslab.magpollo.com/?utm_source=email&utm_medium=powered_by' } },
    light: { page: '#ffffff', text: '#121211', muted: '#66645e', line: '#e6e5e0', highlight: accent, link: accent, button: accent, buttonText: '#ffffff' },
    dark: { page: '#121211', text: '#f4f3ef', muted: '#b5b2a9', line: '#2e2d2a', highlight: '#f4f3ef', link: '#f4f3ef', button: accent, buttonText: '#ffffff' },
    fonts: { display: SANS, sans: SANS, webFontCss: GEIST },
    company: MAGPOLLO,
    links: [],
    socials: brand.instagram ? [{ label: 'Instagram', href: `https://instagram.com/${encodeURIComponent(brand.instagram.replace(/^@/, ''))}`, icon: at(origin, '/assets/email/instagram-tile-ink.png') }] : [],
  };
}
