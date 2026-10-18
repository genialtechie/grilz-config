import React from 'react';
import { Body, Button, Column, Container, Head, Html, Img, Link, Preview, Row, Section, Text } from '@react-email/components';
import type { Brand } from './brand.js';

// The email kit: brand-agnostic building blocks on React Email. Every email is
// an <EmailFrame> holding a few of these. Dark mode and phone padding come from
// one <style> block (class names below); everything else is inline, so Gmail
// and Outlook, which ignore most CSS, still get the full light design.

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
  return (
    <Section style={{ padding: '28px 32px 36px', textAlign: 'center' }} className="em-pad-x">
      <Row style={{ width: 'auto', margin: '0 auto 14px' }}>
        <Column style={{ padding: '0 10px', verticalAlign: 'middle' }}>
          {'src' in mark ? (
            <Img src={mark.src} alt={mark.alt} height={mark.height} style={{ height: `${mark.height}px`, width: 'auto', display: 'inline-block' }} />
          ) : (
            <Text style={{ ...small, margin: 0 }}>
              Powered by <Link href={mark.poweredBy.href} style={linkStyle}>{mark.poweredBy.label}</Link>
            </Text>
          )}
        </Column>
        {brand.instagram && (
          <Column style={{ padding: '0 10px', verticalAlign: 'middle' }}>
            <Link href={`https://instagram.com/${brand.instagram.handle}`}>
              <Img src={brand.instagram.icon} alt="Instagram" width={24} height={24} style={{ display: 'inline-block' }} />
            </Link>
          </Column>
        )}
      </Row>
      {brand.links.length > 0 && (
        <Text style={{ ...small, margin: '0 0 10px' }}>
          {brand.links.map((item, index) => (
            <React.Fragment key={item.href}>
              {index > 0 && '  ·  '}
              <Link href={item.href} style={linkStyle}>{item.label}</Link>
            </React.Fragment>
          ))}
        </Text>
      )}
      <Text style={small}>{reason}</Text>
      {unsubscribe && (
        <Text style={small}>
          <Link href={unsubscribe} style={linkStyle}>Unsubscribe</Link> from these emails.
        </Text>
      )}
      <Text style={{ ...small, margin: 0 }}>{brand.company}</Text>
    </Section>
  );
}

export function EmailFrame({ brand, title, preheader, hero, footer, children }: WithBrand & { title: string; preheader: string; hero?: React.ReactNode; footer: FooterProps; children: React.ReactNode }) {
  const c = brand.light;
  return (
    <Html lang="en">
      <Head>
        <title>{title}</title>
        <meta name="color-scheme" content="light dark" />
        <meta name="supported-color-schemes" content="light dark" />
        <meta name="x-apple-disable-message-reformatting" />
        {brand.fonts.webFontCss && <link href={brand.fonts.webFontCss} rel="stylesheet" />}
        <style>{styles(brand)}</style>
      </Head>
      <Preview>{preheader}</Preview>
      <Body className="em-page" style={{ margin: 0, padding: 0, background: c.page }}>
        <Container style={{ maxWidth: '600px', width: '100%', padding: '0 12px' }}>
          <Section style={{ padding: '36px 0 26px', textAlign: 'center' }}>
            {'src' in brand.logo ? (
              <Img src={brand.logo.src} alt={brand.logo.alt} height={brand.logo.height} style={{ height: `${brand.logo.height}px`, width: 'auto', maxWidth: '220px', margin: '0 auto' }} />
            ) : (
              <Text style={{ margin: 0, fontFamily: brand.fonts.serif, fontSize: '30px', lineHeight: '1', color: c.text }}>{brand.logo.wordmark}</Text>
            )}
          </Section>
          <Section className="em-card" style={{ background: c.card, borderRadius: '24px' }}>
            {hero && <Section style={{ padding: '28px 28px 0', textAlign: 'center' }}>{hero}</Section>}
            <Section className="em-pad" style={{ padding: '36px 32px 34px' }}>{children}</Section>
          </Section>
          <Footer brand={brand} {...footer} />
        </Container>
      </Body>
    </Html>
  );
}

/** "New design from *Ava*": starred words are set in italic in the highlight colour. */
export function Headline({ brand, children, size = 38 }: WithBrand & { children: string; size?: number }) {
  const parts = children.split(/(\*[^*]+\*)/g).filter(Boolean);
  return (
    <Text className="em-text em-h1" style={{ margin: 0, fontFamily: brand.fonts.serif, fontWeight: 400, fontSize: `${size}px`, lineHeight: '1.08', letterSpacing: '-0.01em', color: brand.light.text }}>
      {parts.map((part, index) =>
        part.startsWith('*') && part.endsWith('*') ? (
          <em key={index} className="em-hl" style={{ fontStyle: 'italic', color: brand.light.highlight }}>{part.slice(1, -1)}</em>
        ) : (
          <React.Fragment key={index}>{part}</React.Fragment>
        ),
      )}
    </Text>
  );
}

export const Eyebrow = ({ brand, children }: WithBrand & { children: React.ReactNode }) => (
  <Text className="em-muted" style={{ margin: '0 0 14px', fontFamily: brand.fonts.sans, fontSize: '12px', fontWeight: 600, letterSpacing: '.14em', textTransform: 'uppercase', color: brand.light.muted }}>{children}</Text>
);

export const Paragraph = ({ brand, children, muted, size = 16, margin = '0 0 14px' }: WithBrand & { children: React.ReactNode; muted?: boolean; size?: number; margin?: string }) => (
  <Text className={muted ? 'em-muted' : 'em-text'} style={{ margin, fontFamily: brand.fonts.sans, fontSize: `${size}px`, lineHeight: '1.55', color: muted ? brand.light.muted : brand.light.text }}>{children}</Text>
);

export const InlineLink = ({ brand, href, children }: WithBrand & { href: string; children: React.ReactNode }) => (
  <Link href={href} className="em-link" style={{ color: brand.light.link, textDecoration: 'underline' }}>{children}</Link>
);

/** The one clear ask. */
export const CTA = ({ brand, href, children, margin = '24px 0 18px' }: WithBrand & { href: string; children: React.ReactNode; margin?: string }) => (
  <Section style={{ margin }}>
    <Button href={href} className="em-btn" style={{ background: brand.light.button, color: brand.light.buttonText, borderRadius: '999px', padding: '15px 28px', fontFamily: brand.fonts.sans, fontSize: '16px', fontWeight: 600, lineHeight: '1', textDecoration: 'none' }}>
      {children}
    </Button>
  </Section>
);

/** Label / value rows with hairlines. */
export function Facts({ brand, rows }: WithBrand & { rows: [string, React.ReactNode][] }) {
  const c = brand.light;
  return (
    <Section className="em-line" style={{ borderTop: `1px solid ${c.line}` }}>
      {rows.map(([label, value]) => (
        <Row key={label} className="em-line" style={{ borderBottom: `1px solid ${c.line}` }}>
          <Column className="em-muted" style={{ width: '120px', padding: '11px 12px 11px 0', verticalAlign: 'top', fontFamily: brand.fonts.sans, fontSize: '13px', color: c.muted }}>{label}</Column>
          <Column className="em-text" style={{ padding: '11px 0', fontFamily: brand.fonts.sans, fontSize: '15px', lineHeight: '1.45', color: c.text }}>{value}</Column>
        </Row>
      ))}
    </Section>
  );
}

export const SectionLabel = ({ brand, children }: WithBrand & { children: React.ReactNode }) => (
  <Text className="em-muted" style={{ margin: '24px 0 8px', fontFamily: brand.fonts.sans, fontSize: '12px', fontWeight: 600, letterSpacing: '.12em', textTransform: 'uppercase', color: brand.light.muted }}>{children}</Text>
);

export const Photo = ({ brand, src, alt, caption }: WithBrand & { src: string; alt: string; caption?: string }) => (
  <Section style={{ margin: '22px 0 6px' }}>
    <Img src={src} alt={alt} width={536} style={{ display: 'block', width: '100%', maxWidth: '536px', height: 'auto', borderRadius: '16px', background: brand.light.line }} />
    {caption && <Text className="em-muted" style={{ margin: '8px 0 0', fontFamily: brand.fonts.sans, fontSize: '12px', lineHeight: '1.45', color: brand.light.muted }}>{caption}</Text>}
  </Section>
);

/** Small label/amount lines (e.g. a price breakdown). */
export const Lines = ({ brand, lines }: WithBrand & { lines: [string, string][] }) => (
  <Section style={{ marginTop: '18px' }}>
    {lines.map(([label, value], index) => (
      <Row key={`${label}-${index}`}>
        <Column className="em-muted" style={{ padding: '3px 0', fontFamily: brand.fonts.sans, fontSize: '13px', color: brand.light.muted }}>{label}</Column>
        <Column align="right" className="em-muted" style={{ padding: '3px 0', fontFamily: brand.fonts.sans, fontSize: '13px', color: brand.light.muted }}>{value}</Column>
      </Row>
    ))}
  </Section>
);
