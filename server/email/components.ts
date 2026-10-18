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
    .em-pad { padding: 28px 22px !important; }
    .em-pad-x { padding-left: 22px !important; padding-right: 22px !important; }
    .em-h1 { font-size: 32px !important; }
  }
  @media (prefers-color-scheme: dark) {
    .em-page { background: ${d.page} !important; }
    .em-card { background: ${d.card} !important; }
    .em-text { color: ${d.text} !important; }
    .em-muted { color: ${d.muted} !important; }
    .em-line { border-color: ${d.line} !important; }
    .em-hl { color: ${d.highlight} !important; }
    .em-link { color: ${d.link} !important; }
    .em-btn { background: ${d.button} !important; color: ${d.buttonText} !important; }
  }
  [data-ogsc] .em-card { background: ${d.card} !important; }
  [data-ogsc] .em-text { color: ${d.text} !important; }
  [data-ogsc] .em-muted { color: ${d.muted} !important; }`;
}

export type FooterProps = {
  /** Why this person got the email. */
  reason: string;
  /** Marketing email: a visible unsubscribe link (also sent as List-Unsubscribe). */
  unsubscribe?: string;
};

function Footer({ brand, reason, unsubscribe }: WithBrand & FooterProps) {
  const c = brand.light;
  const small = { margin: '0 0 8px', fontFamily: brand.fonts.sans, fontSize: '12px', lineHeight: '1.6', color: c.footerText } as const;
  const linkStyle = { color: c.footerLink, textDecoration: 'underline' } as const;
  const mark = brand.footerMark;
  const markCell =
    'src' in mark
      ? h(Img, { src: mark.src, alt: mark.alt, height: mark.height, style: { height: `${mark.height}px`, width: 'auto', display: 'inline-block' } })
      : h(Text, { style: { ...small, margin: 0 } }, 'Powered by ', h(Link, { href: mark.poweredBy.href, style: linkStyle }, mark.poweredBy.label));
  return h(
    Section,
    { style: { padding: '28px 32px 36px', textAlign: 'center' }, className: 'em-pad-x' },
    h(
      Row,
      {
        style: { width: 'auto', margin: '0 auto 14px' },
        children: [
          h(Column, { key: 'mark', style: { padding: '0 10px', verticalAlign: 'middle' } }, markCell),
          brand.instagram &&
            h(
              Column,
              { key: 'instagram', style: { padding: '0 10px', verticalAlign: 'middle' } },
              h(Link, { href: `https://instagram.com/${brand.instagram.handle}` }, h(Img, { src: brand.instagram.icon, alt: 'Instagram', width: 24, height: 24, style: { display: 'inline-block' } })),
            ),
        ],
      },
    ),
    brand.links.length > 0 &&
      h(
        Text,
        { style: { ...small, margin: '0 0 10px' } },
        ...brand.links.map((item, index) => h(Fragment, { key: item.href }, index > 0 ? '  ·  ' : '', h(Link, { href: item.href, style: linkStyle }, item.label))),
      ),
    h(Text, { style: small }, reason),
    unsubscribe && h(Text, { style: small }, h(Link, { href: unsubscribe, style: linkStyle }, 'Unsubscribe'), ' from these emails.'),
    h(Text, { style: { ...small, margin: 0 } }, brand.company),
  );
}

export function EmailFrame({ brand, title, preheader, hero, footer, children }: WithBrand & { title: string; preheader: string; hero?: ReactNode; footer: FooterProps; children?: ReactNode }) {
  const c = brand.light;
  const logo =
    'src' in brand.logo
      ? h(Img, { src: brand.logo.src, alt: brand.logo.alt, height: brand.logo.height, style: { height: `${brand.logo.height}px`, width: 'auto', maxWidth: '220px', margin: '0 auto' } })
      : h(Text, { style: { margin: 0, fontFamily: brand.fonts.serif, fontSize: '30px', lineHeight: '1', color: c.text } }, brand.logo.wordmark);
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
        { style: { maxWidth: '600px', width: '100%', padding: '0 12px' } },
        h(Section, { style: { padding: '36px 0 26px', textAlign: 'center' } }, logo),
        h(
          Section,
          { className: 'em-card', style: { background: c.card, borderRadius: '24px' } },
          hero && h(Section, { style: { padding: '28px 28px 0', textAlign: 'center' } }, hero),
          h(Section, { className: 'em-pad', style: { padding: '36px 32px 34px' } }, children),
        ),
        h(Footer, { brand, ...footer }),
      ),
    ),
  );
}

/** "New design from *Ava*": starred words are set in italic in the highlight colour. */
export function Headline({ brand, text, size = 38 }: WithBrand & { text: string; size?: number }) {
  const parts = text.split(/(\*[^*]+\*)/g).filter(Boolean);
  return h(
    Text,
    { className: 'em-text em-h1', style: { margin: 0, fontFamily: brand.fonts.serif, fontWeight: 400, fontSize: `${size}px`, lineHeight: '1.08', letterSpacing: '-0.01em', color: brand.light.text } },
    ...parts.map((part, index) =>
      part.startsWith('*') && part.endsWith('*')
        ? h('em', { key: index, className: 'em-hl', style: { fontStyle: 'italic', color: brand.light.highlight } }, part.slice(1, -1))
        : h(Fragment, { key: index }, part),
    ),
  );
}

export const Eyebrow = ({ brand, children }: WithBrand & { children?: ReactNode }) =>
  h(Text, { className: 'em-muted', style: { margin: '0 0 14px', fontFamily: brand.fonts.sans, fontSize: '12px', fontWeight: 600, letterSpacing: '.14em', textTransform: 'uppercase', color: brand.light.muted } }, children);

export const Paragraph = ({ brand, children, muted, size = 16, margin = '0 0 14px' }: WithBrand & { children?: ReactNode; muted?: boolean; size?: number; margin?: string }) =>
  h(Text, { className: muted ? 'em-muted' : 'em-text', style: { margin, fontFamily: brand.fonts.sans, fontSize: `${size}px`, lineHeight: '1.55', color: muted ? brand.light.muted : brand.light.text } }, children);

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

/** Label / value rows with hairlines. */
export function Facts({ brand, rows }: WithBrand & { rows: [string, ReactNode][] }) {
  const c = brand.light;
  return h(
    Section,
    { className: 'em-line', style: { borderTop: `1px solid ${c.line}` } },
    ...rows.map(([label, value]) =>
      h(Row, {
        key: label,
        className: 'em-line',
        style: { borderBottom: `1px solid ${c.line}` },
        children: [
          h(Column, { key: 'label', className: 'em-muted', style: { width: '120px', padding: '11px 12px 11px 0', verticalAlign: 'top', fontFamily: brand.fonts.sans, fontSize: '13px', color: c.muted } }, label),
          h(Column, { key: 'value', className: 'em-text', style: { padding: '11px 0', fontFamily: brand.fonts.sans, fontSize: '15px', lineHeight: '1.45', color: c.text } }, value),
        ],
      }),
    ),
  );
}

export const SectionLabel = ({ brand, children }: WithBrand & { children?: ReactNode }) =>
  h(Text, { className: 'em-muted', style: { margin: '24px 0 8px', fontFamily: brand.fonts.sans, fontSize: '12px', fontWeight: 600, letterSpacing: '.12em', textTransform: 'uppercase', color: brand.light.muted } }, children);

export const Photo = ({ brand, src, alt, caption }: WithBrand & { src: string; alt: string; caption?: string }) =>
  h(
    Section,
    { style: { margin: '22px 0 6px' } },
    h(Img, { src, alt, width: 536, style: { display: 'block', width: '100%', maxWidth: '536px', height: 'auto', borderRadius: '16px', background: brand.light.line } }),
    caption && h(Text, { className: 'em-muted', style: { margin: '8px 0 0', fontFamily: brand.fonts.sans, fontSize: '12px', lineHeight: '1.45', color: brand.light.muted } }, caption),
  );

/** Small label/amount lines (e.g. a price breakdown). */
export const Lines = ({ brand, lines }: WithBrand & { lines: [string, string][] }) =>
  h(
    Section,
    { style: { marginTop: '18px' } },
    ...lines.map(([label, value], index) =>
      h(Row, {
        key: `${label}-${index}`,
        children: [
          h(Column, { key: 'label', className: 'em-muted', style: { padding: '3px 0', fontFamily: brand.fonts.sans, fontSize: '13px', color: brand.light.muted } }, label),
          h(Column, { key: 'value', align: 'right', className: 'em-muted', style: { padding: '3px 0', fontFamily: brand.fonts.sans, fontSize: '13px', color: brand.light.muted } }, value),
        ],
      }),
    ),
  );
