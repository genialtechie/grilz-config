import { createElement as h, Fragment, type ReactNode } from 'react';
import { Body, Button, Column, Container, Head, Html, Img, Link, Preview, Row, Section, Text } from '@react-email/components';
import type { Brand } from './brand.js';

// The email kit: brand-agnostic building blocks on React Email. Every email is
// an EmailFrame holding a few of these. Dark mode and phone padding come from
// one <style> block (class names below); everything else is inline, so Gmail
// and Outlook, which ignore most CSS, still get the full light design.
//
// Written with createElement (h) rather than JSX: Vercel's Node functions only
// compile and bundle .ts files, so .tsx server code would be left out.

type WithBrand = { brand: Brand };

function styles(brand: Brand) {
  const d = brand.dark;
  return `
  :root { color-scheme: light dark; supported-color-schemes: light dark; }
  @media (max-width: 620px) {
    .em-pad { padding-left: 24px !important; padding-right: 24px !important; }
    .em-h1 { font-size: 44px !important; }
  }
  @media (prefers-color-scheme: dark) {
    .em-page { background: ${d.page} !important; }
    .em-text { color: ${d.text} !important; }
    .em-muted { color: ${d.muted} !important; }
    .em-line { border-color: ${d.line} !important; }
    .em-rule { border-color: ${d.muted} !important; }
    .em-hl { color: ${d.highlight} !important; }
    .em-link { color: ${d.link} !important; }
    .em-btn { background: ${d.button} !important; color: ${d.buttonText} !important; }
  }
  [data-ogsc] .em-page { background: ${d.page} !important; }
  [data-ogsc] .em-text { color: ${d.text} !important; }
  [data-ogsc] .em-muted { color: ${d.muted} !important; }
  [data-ogsc] .em-hl { color: ${d.highlight} !important; }`;
}

export type FooterProps = {
  /** Why this person got the email. */
  reason: string;
  /** Marketing email: a visible unsubscribe link (also sent as List-Unsubscribe). */
  unsubscribe?: string;
};

/** Heavy rule, social tiles, legal line, links, why you got this, then the app-icon mark. */
function Footer({ brand, reason, unsubscribe }: WithBrand & FooterProps) {
  const c = brand.light;
  const small = { margin: '0 0 10px', fontFamily: brand.fonts.sans, fontSize: '13px', lineHeight: '1.6', color: c.muted, textAlign: 'center' } as const;
  const linkStyle = { color: c.muted, textDecoration: 'underline' } as const;
  const links = [...brand.links, ...(unsubscribe ? [{ label: 'Unsubscribe', href: unsubscribe }] : [])];
  const mark = brand.footerMark;
  return h(
    Section,
    { className: 'em-pad', style: { padding: '0 40px 48px' } },
    h(Section, { className: 'em-rule', style: { borderTop: `2px solid ${c.text}`, margin: '8px 0 32px' } }),
    brand.socials.length > 0 &&
      h(Row, {
        style: { width: 'auto', margin: '0 auto 22px' },
        children: brand.socials.map((social) =>
          h(Column, { key: social.href, style: { padding: '0 6px' } }, h(Link, { href: social.href }, h(Img, { src: social.icon, alt: social.label, width: 40, height: 40, style: { display: 'block' } }))),
        ),
      }),
    h(Text, { className: 'em-muted', style: small }, `©${new Date().getFullYear()} ${brand.company}`),
    links.length > 0 &&
      h(
        Text,
        { className: 'em-muted', style: small },
        ...links.map((item, index) => h(Fragment, { key: item.href }, index > 0 ? '\u00a0\u00a0|\u00a0\u00a0' : '', h(Link, { href: item.href, className: 'em-muted', style: linkStyle }, item.label))),
      ),
    h(Text, { className: 'em-muted', style: { ...small, margin: '0 0 24px' } }, reason),
    'src' in mark
      ? h(Img, { src: mark.src, alt: mark.alt, width: mark.height, height: mark.height, style: { display: 'block', margin: '0 auto', borderRadius: '10px' } })
      : h(Text, { className: 'em-muted', style: { ...small, margin: 0 } }, 'Powered by ', h(Link, { href: mark.poweredBy.href, className: 'em-muted', style: linkStyle }, mark.poweredBy.label)),
  );
}

/** One surface edge to edge: logo, the content column, the footer. */
export function EmailFrame({ brand, title, preheader, footer, children }: WithBrand & { title: string; preheader: string; footer: FooterProps; children?: ReactNode }) {
  const c = brand.light;
  const logo =
    'src' in brand.logo
      ? h(Img, { src: brand.logo.src, alt: brand.logo.alt, height: brand.logo.height, style: { height: `${brand.logo.height}px`, width: 'auto', maxWidth: '220px', margin: '0 auto' } })
      : h(Text, { className: 'em-text', style: { margin: 0, fontFamily: brand.fonts.serif, fontSize: '30px', lineHeight: '1', color: c.text } }, brand.logo.wordmark);
  return h(
    Html,
    { lang: 'en' },
    h(
      Head,
      null,
      h('title', null, title),
      h('meta', { name: 'color-scheme', content: 'light dark' }),
      h('meta', { name: 'supported-color-schemes', content: 'light dark' }),
      h('meta', { name: 'x-apple-disable-message-reformatting' }),
      brand.fonts.webFontCss && h('link', { href: brand.fonts.webFontCss, rel: 'stylesheet' }),
      h('style', null, styles(brand)),
    ),
    h(Preview, null, preheader),
    h(
      Body,
      { className: 'em-page', style: { margin: 0, padding: 0, background: c.page } },
      h(
        Container,
        { className: 'em-page', style: { maxWidth: '600px', width: '100%', background: c.page } },
        h(Section, { style: { padding: '44px 0 36px', textAlign: 'center' } }, logo),
        h(Section, { className: 'em-pad', style: { padding: '0 40px 40px' } }, children),
        h(Footer, { brand, ...footer }),
      ),
    ),
  );
}

/** "New design from *Ava*": starred words are set in italic in the highlight colour. */
export function Headline({ brand, text, size = 44, align = 'left' }: WithBrand & { text: string; size?: number; align?: 'left' | 'center' }) {
  const parts = text.split(/(\*[^*]+\*)/g).filter(Boolean);
  return h(
    Text,
    { className: size > 44 ? 'em-text em-h1' : 'em-text', style: { margin: 0, fontFamily: brand.fonts.serif, fontWeight: 400, fontSize: `${size}px`, lineHeight: '1.05', letterSpacing: '-0.01em', textAlign: align, color: brand.light.text } },
    ...parts.map((part, index) =>
      part.startsWith('*') && part.endsWith('*')
        ? h('em', { key: index, className: 'em-hl', style: { fontStyle: 'italic', color: brand.light.highlight } }, part.slice(1, -1))
        : h(Fragment, { key: index }, part),
    ),
  );
}

export const Paragraph = ({ brand, children, muted, size = 17, margin = '0 0 16px' }: WithBrand & { children?: ReactNode; muted?: boolean; size?: number; margin?: string }) =>
  h(Text, { className: muted ? 'em-muted' : 'em-text', style: { margin, fontFamily: brand.fonts.sans, fontSize: `${size}px`, lineHeight: '1.6', color: muted ? brand.light.muted : brand.light.text } }, children);

export const InlineLink = ({ brand, href, children }: WithBrand & { href: string; children?: ReactNode }) =>
  h(Link, { href, className: 'em-link', style: { color: brand.light.link, textDecoration: 'underline' } }, children);

/** The one clear ask. */
export const CTA = ({ brand, href, children, margin = '24px 0 18px' }: WithBrand & { href: string; children?: ReactNode; margin?: string }) =>
  h(
    Section,
    { style: { margin } },
    h(
      Button,
      {
        href,
        className: 'em-btn',
        style: { background: brand.light.button, color: brand.light.buttonText, borderRadius: '999px', padding: '15px 28px', fontFamily: brand.fonts.sans, fontSize: '16px', fontWeight: 600, lineHeight: '1', textDecoration: 'none' },
      },
      children,
    ),
  );

/** A quiet sentence-case label over a block of details (never shouty caps). */
export const SectionLabel = ({ brand, children }: WithBrand & { children?: ReactNode }) =>
  h(Text, { className: 'em-text', style: { margin: '28px 0 6px', fontFamily: brand.fonts.sans, fontSize: '15px', fontWeight: 600, lineHeight: '1.4', color: brand.light.text } }, children);

export const Photo = ({ brand, src, alt, caption }: WithBrand & { src: string; alt: string; caption?: string }) =>
  h(
    Section,
    { style: { margin: '22px 0 6px' } },
    h(Img, { src, alt, width: 536, style: { display: 'block', width: '100%', maxWidth: '536px', height: 'auto', borderRadius: '16px', background: brand.light.line } }),
    caption && h(Text, { className: 'em-muted', style: { margin: '8px 0 0', fontFamily: brand.fonts.sans, fontSize: '12px', lineHeight: '1.45', color: brand.light.muted } }, caption),
  );

/** The email's one illustration, centred under the headline. */
export const Illustration = ({ src, width = 440 }: { src: string; width?: number }) =>
  h(
    Section,
    { style: { padding: '28px 0 12px', textAlign: 'center' } },
    h(Img, { src, alt: '', width, style: { display: 'block', width: '100%', maxWidth: `${width}px`, height: 'auto', margin: '0 auto' } }),
  );

/** "— The VVS Lab team": the person or team the email is from. */
export const SignOff = ({ brand, children }: WithBrand & { children?: ReactNode }) =>
  h(Paragraph, { brand, margin: '28px 0 0' }, children ?? brand.signOff);

/** Someone's own words, set apart (a customer's note to the shop). */
export const Quote = ({ brand, children }: WithBrand & { children?: ReactNode }) =>
  h(
    Section,
    { className: 'em-line', style: { margin: '22px 0 0', borderLeft: `3px solid ${brand.light.highlight}`, paddingLeft: '16px' } },
    h(Text, { className: 'em-text', style: { margin: 0, fontFamily: brand.fonts.serif, fontStyle: 'italic', fontSize: '22px', lineHeight: '1.35', color: brand.light.text } }, children),
  );

/** Numbered "what happens next" steps. */
export const Steps = ({ brand, steps }: WithBrand & { steps: ReactNode[] }) =>
  h(
    Section,
    { style: { margin: '6px 0 0' } },
    ...steps.map((step, index) =>
      h(Row, {
        key: index,
        children: [
          h(Column, { key: 'n', style: { width: '28px', verticalAlign: 'top', padding: '4px 0' } }, h(Text, { className: 'em-hl', style: { margin: 0, fontFamily: brand.fonts.sans, fontWeight: 700, fontSize: '17px', lineHeight: '1.55', color: brand.light.highlight } }, `${index + 1}.`)),
          h(Column, { key: 'text', style: { verticalAlign: 'top', padding: '4px 0' } }, h(Text, { className: 'em-text', style: { margin: '0 0 10px', fontFamily: brand.fonts.sans, fontSize: '17px', lineHeight: '1.55', color: brand.light.text } }, step)),
        ],
      }),
    ),
  );
