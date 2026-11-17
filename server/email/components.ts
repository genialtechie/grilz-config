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
    .em-h1 { font-size: 40px !important; }
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

/** A hairline, the legal line, links, why you got this, then the social tile (or "Powered by"). Left-aligned, quiet. */
function Footer({ brand, reason, unsubscribe }: WithBrand & FooterProps) {
  const c = brand.light;
  const small = { margin: '0 0 8px', fontFamily: brand.fonts.sans, fontSize: '13px', lineHeight: '1.6', color: c.muted } as const;
  const linkStyle = { color: c.muted, textDecoration: 'underline' } as const;
  const links = [...brand.links, ...(unsubscribe ? [{ label: 'Unsubscribe', href: unsubscribe }] : [])];
  const mark = brand.footerMark;
  return h(
    Section,
    { className: 'em-pad', style: { padding: '0 40px 44px' } },
    h(Section, { className: 'em-line', style: { borderTop: `1px solid ${c.line}`, margin: '4px 0 24px' } }),
    h(Text, { className: 'em-muted', style: small }, reason),
    links.length > 0 &&
      h(
        Text,
        { className: 'em-muted', style: small },
        ...links.map((item, index) => h(Fragment, { key: item.href }, index > 0 ? '\u00a0\u00a0·\u00a0\u00a0' : '', h(Link, { href: item.href, className: 'em-muted', style: linkStyle }, item.label))),
      ),
    h(Text, { className: 'em-muted', style: { ...small, margin: '0 0 18px' } }, `©${new Date().getFullYear()} ${brand.company}`),
    brand.socials.length > 0 &&
      h(Row, {
        style: { width: 'auto', margin: '0' },
        children: brand.socials.map((social) =>
          h(Column, { key: social.href, style: { padding: '0 10px 0 0' } }, h(Link, { href: social.href }, h(Img, { src: social.icon, alt: social.label, width: 32, height: 32, style: { display: 'block' } }))),
        ),
      }),
    'src' in mark && h(Img, { src: mark.src, alt: mark.alt, width: mark.height, height: mark.height, style: { display: 'block', margin: '18px 0 0' } }),
    'poweredBy' in mark && h(Text, { className: 'em-muted', style: { ...small, margin: '14px 0 0' } }, 'Powered by ', h(Link, { href: mark.poweredBy.href, className: 'em-muted', style: linkStyle }, mark.poweredBy.label)),
  );
}

/** One surface edge to edge: logo, the content column, the footer. */
export function EmailFrame({ brand, title, preheader, footer, children }: WithBrand & { title: string; preheader: string; footer: FooterProps; children?: ReactNode }) {
  const c = brand.light;
  const L = brand.logo;
  const logo =
    'src' in L
      ? h(
          Text,
          { className: 'em-text', style: { margin: 0, fontFamily: brand.fonts.display, fontSize: '17px', fontWeight: 600, lineHeight: `${L.height}px`, letterSpacing: '-0.02em', color: c.text } },
          h(Img, { src: L.src, alt: L.alt, height: L.height, style: { display: 'inline-block', height: `${L.height}px`, width: 'auto', maxWidth: '220px', verticalAlign: 'middle' } }),
          L.word ? h('span', { style: { verticalAlign: 'middle', paddingLeft: '6px' } }, L.word) : null,
        )
      : h(Text, { className: 'em-text', style: { margin: 0, fontFamily: brand.fonts.display, fontSize: '22px', fontWeight: 600, lineHeight: '1', letterSpacing: '-0.03em', color: c.text } }, L.wordmark);
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
    h(
      Body,
      { className: 'em-page', style: { margin: 0, padding: 0, background: c.page } },
      h(Preview, null, preheader),
      h(
        Container,
        { className: 'em-page', style: { maxWidth: '600px', width: '100%', background: c.page } },
        h(Section, { className: 'em-pad', style: { padding: '36px 40px 34px', textAlign: 'left' } }, logo),
        h(Section, { className: 'em-pad', style: { padding: '0 40px 40px' } }, children),
        h(Footer, { brand, ...footer }),
      ),
    ),
  );
}

/** "New design from *Ava*": starred words are set in the highlight colour. */
export function Headline({ brand, text, size = 44, align = 'left' }: WithBrand & { text: string; size?: number; align?: 'left' | 'center' }) {
  const parts = text.split(/(\*[^*]+\*)/g).filter(Boolean);
  return h(
    Text,
    { className: size > 40 ? 'em-text em-h1' : 'em-text', style: { margin: 0, fontFamily: brand.fonts.display, fontWeight: 600, fontSize: `${size}px`, lineHeight: '1.05', letterSpacing: '-0.045em', textAlign: align, color: brand.light.text } },
    ...parts.map((part, index) =>
      part.startsWith('*') && part.endsWith('*')
        ? h('span', { key: index, className: 'em-hl', style: { color: brand.light.highlight } }, part.slice(1, -1))
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
        style: { display: 'block', textAlign: 'center', background: brand.light.button, color: brand.light.buttonText, borderRadius: '999px', padding: '17px 28px', fontFamily: brand.fonts.sans, fontSize: '16px', fontWeight: 600, lineHeight: '1', textDecoration: 'none' },
      },
      children,
    ),
  );

/** A quiet sentence-case label over a block of details (never shouty caps). */
export const SectionLabel = ({ brand, children }: WithBrand & { children?: ReactNode }) =>
  h(Text, { className: 'em-text', style: { margin: '28px 0 8px', fontFamily: brand.fonts.sans, fontSize: '17px', fontWeight: 600, lineHeight: '1.4', letterSpacing: '-0.01em', color: brand.light.text } }, children);

export const Photo = ({ brand, src, alt, caption }: WithBrand & { src: string; alt: string; caption?: string }) =>
  h(
    Section,
    { style: { margin: '22px 0 6px' } },
    h(Img, { src, alt, width: 520, style: { display: 'block', width: '100%', maxWidth: '520px', height: 'auto', borderRadius: '18px', background: '#ffffff' } }),
    caption && h(Text, { className: 'em-muted', style: { margin: '8px 0 0', fontFamily: brand.fonts.sans, fontSize: '12px', lineHeight: '1.45', color: brand.light.muted } }, caption),
  );

/** The email's one illustration: centred under a centred headline, or left above a left one. */
export const Illustration = ({ src, width = 440, align = 'center', alt = '' }: { src: string; width?: number; align?: 'left' | 'center'; alt?: string }) =>
  h(
    Section,
    { style: { padding: align === 'center' ? '28px 0 12px' : '0 0 8px', textAlign: align } },
    h(Img, { src, alt, width, style: { display: 'block', width: '100%', maxWidth: `${width}px`, height: 'auto', margin: align === 'center' ? '0 auto' : '0' } }),
  );

/** "— The VVS Lab team": the person or team the email is from. */
export const SignOff = ({ brand, children }: WithBrand & { children?: ReactNode }) =>
  h(Paragraph, { brand, margin: '28px 0 0' }, children ?? brand.signOff);

/** Someone's own words, in quotes (a customer's note to the shop). */
export const Quote = ({ brand, children }: WithBrand & { children?: ReactNode }) =>
  h(Text, { className: 'em-text', style: { margin: '22px 0 0', fontFamily: brand.fonts.sans, fontSize: '17px', lineHeight: '1.5', color: brand.light.text } }, '“', children, '”');

/** Label and value rows on hairlines: the reference details under the one action. */
export const Details = ({ brand, rows }: WithBrand & { rows: [ReactNode, ReactNode][] }) =>
  h(
    Section,
    { className: 'em-line', style: { margin: '6px 0 0', borderTop: `1px solid ${brand.light.line}` } },
    ...rows.map(([label, value], index) =>
      h(Row, {
        key: index,
        className: 'em-line',
        style: { borderBottom: `1px solid ${brand.light.line}` },
        children: [
          h(Column, { key: 'l', style: { width: '34%', verticalAlign: 'top', padding: '11px 12px 11px 0' } }, h(Text, { className: 'em-muted', style: { margin: 0, fontFamily: brand.fonts.sans, fontSize: '15px', lineHeight: '1.45', color: brand.light.muted } }, label)),
          h(Column, { key: 'v', style: { verticalAlign: 'top', padding: '11px 0', textAlign: 'right' } }, h(Text, { className: 'em-text', style: { margin: 0, fontFamily: brand.fonts.sans, fontSize: '15px', lineHeight: '1.45', color: brand.light.text } }, value)),
        ],
      }),
    ),
  );

/** Numbered "what happens next" steps, one per hairline row. */
export const Steps = ({ brand, steps }: WithBrand & { steps: ReactNode[] }) =>
  h(
    Section,
    { style: { margin: '4px 0 0' } },
    ...steps.map((step, index) =>
      h(Row, {
        key: index,
        className: 'em-line',
        style: { borderTop: `1px solid ${brand.light.line}` },
        children: [
          h(Column, { key: 'n', style: { width: '24px', verticalAlign: 'top', padding: '10px 0' } }, h(Text, { className: 'em-muted', style: { margin: 0, fontFamily: brand.fonts.sans, fontSize: '15px', lineHeight: '1.5', color: brand.light.muted } }, `${index + 1}`)),
          h(Column, { key: 'text', style: { verticalAlign: 'top', padding: '10px 0' } }, h(Text, { className: 'em-text', style: { margin: 0, fontFamily: brand.fonts.sans, fontSize: '16px', lineHeight: '1.5', color: brand.light.text } }, step)),
        ],
      }),
    ),
  );

/** A progress checklist: done items get a filled check in the accent, open ones an empty ring. */
export const Checklist = ({ brand, items }: WithBrand & { items: { label: ReactNode; done: boolean }[] }) =>
  h(
    Section,
    { style: { margin: '6px 0 0' } },
    ...items.map((item, index) =>
      h(Row, {
        key: index,
        children: [
          h(
            Column,
            { key: 'mark', style: { width: '36px', verticalAlign: 'top', padding: '3px 0' } },
            h(
              Text,
              {
                className: item.done ? 'em-btn' : 'em-line',
                style: {
                  margin: 0,
                  width: '22px',
                  height: '22px',
                  lineHeight: '22px',
                  textAlign: 'center',
                  borderRadius: '50%',
                  fontFamily: brand.fonts.sans,
                  fontSize: '13px',
                  fontWeight: 700,
                  color: item.done ? brand.light.buttonText : 'transparent',
                  background: item.done ? brand.light.button : 'transparent',
                  border: item.done ? 'none' : `2px solid ${brand.light.line}`,
                  boxSizing: 'border-box',
                },
              },
              item.done ? '✓' : '',
            ),
          ),
          h(
            Column,
            { key: 'label', style: { verticalAlign: 'top', padding: '3px 0' } },
            h(Text, { className: item.done ? 'em-muted' : 'em-text', style: { margin: '0 0 10px', fontFamily: brand.fonts.sans, fontSize: '17px', lineHeight: '1.4', color: item.done ? brand.light.muted : brand.light.text, textDecoration: item.done ? 'line-through' : 'none' } }, item.label),
          ),
        ],
      }),
    ),
  );
