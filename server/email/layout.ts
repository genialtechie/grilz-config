import { usableAccent } from '../../src/lib/tenant/theme.js';
import type { TenantConfig } from '../../src/lib/tenant/schema.js';

// One layout for every email (MAG-84). Table-based with inline styles so it
// holds up in Gmail, Apple Mail and Outlook; a <style> block adds dark mode
// (Apple Mail, iOS Mail, Outlook apps) and phone padding where supported.
//
// Two themes:
//   vvs  — mail from VVS Lab to jewelers: ink frame, gold mark, cream card.
//   shop — mail customers get from a shop: light frame, the shop's logo and
//          accent, "Powered by VVS Lab" in the footer.

export const esc = (value: string) =>
  value.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;');

export const SERIF = `'Instrument Serif',Georgia,'Times New Roman',serif`;
export const SANS = `-apple-system,BlinkMacSystemFont,'Segoe UI',Helvetica,Arial,sans-serif`;
export const COMPANY = 'Magpollo Corp · 2655 Daniel Park Run, Dacula, GA 30019';

export type Theme = {
  kind: 'vvs' | 'shop';
  page: string;
  card: string;
  text: string;
  muted: string;
  line: string;
  /** Italic headline word and links. */
  highlight: string;
  button: string;
  buttonText: string;
  footerText: string;
  footerLink: string;
  logo: { src: string; alt: string; height: number } | { wordmark: string };
  origin: string;
};

const absolute = (origin: string, path: string) => (path.startsWith('http') ? path : `${origin}${path.startsWith('/') ? '' : '/'}${path}`);

export function vvsTheme(origin: string): Theme {
  return {
    kind: 'vvs',
    page: '#1b1714',
    card: '#fbf7f0',
    text: '#1b1714',
    muted: '#6f655a',
    line: '#e7ddcd',
    highlight: '#a87b23',
    button: '#1b1714',
    buttonText: '#fbf7f0',
    footerText: '#b9ad9a',
    footerLink: '#e7d7b8',
    logo: { src: absolute(origin, '/assets/email/vvs-mark.png'), alt: 'VVS Lab', height: 44 },
    origin,
  };
}

export function shopTheme(brand: TenantConfig['brand'], origin: string): Theme {
  const accent = usableAccent(brand.accent, '#ffffff');
  return {
    kind: 'shop',
    page: '#f3efe8',
    card: '#ffffff',
    text: '#1b1714',
    muted: '#6f655a',
    line: '#ece5da',
    highlight: accent,
    button: accent,
    buttonText: '#ffffff',
    footerText: '#8a8178',
    footerLink: '#5c544c',
    logo: brand.logo ? { src: absolute(origin, brand.logo), alt: brand.name, height: 36 } : { wordmark: brand.name },
    origin,
  };
}

/** "New design from *Ava*": the *starred* words are set in italic in the highlight colour. */
export function headline(theme: Theme, text: string, size = 38) {
  const parts = text.split(/(\*[^*]+\*)/g).map((part) =>
    part.startsWith('*') && part.endsWith('*') ? `<em style="font-style:italic;color:${theme.highlight}" class="em-hl">${esc(part.slice(1, -1))}</em>` : esc(part),
  );
  return `<h1 class="em-text em-h1" style="margin:0;font-family:${SERIF};font-weight:400;font-size:${size}px;line-height:1.08;letter-spacing:-0.01em;color:${theme.text}">${parts.join('')}</h1>`;
}

export const eyebrow = (theme: Theme, text: string) =>
  `<p class="em-muted" style="margin:0 0 14px;font-family:${SANS};font-size:12px;font-weight:600;letter-spacing:.14em;text-transform:uppercase;color:${theme.muted}">${esc(text)}</p>`;

export const paragraph = (theme: Theme, html: string, options: { size?: number; muted?: boolean; margin?: string } = {}) =>
  `<p class="${options.muted ? 'em-muted' : 'em-text'}" style="margin:${options.margin ?? '0 0 14px'};font-family:${SANS};font-size:${options.size ?? 16}px;line-height:1.55;color:${options.muted ? theme.muted : theme.text}">${html}</p>`;

/** A pill button that also renders in Outlook (the table cell carries the colour). */
export const button = (theme: Theme, href: string, label: string) =>
  `<table role="presentation" cellpadding="0" cellspacing="0" style="margin:6px 0 4px"><tr><td align="center" bgcolor="${theme.button}" class="em-btn" style="border-radius:999px;background:${theme.button}">
<a href="${esc(href)}" class="em-btn-a" style="display:inline-block;padding:15px 28px;font-family:${SANS};font-size:16px;font-weight:600;line-height:1;color:${theme.buttonText};text-decoration:none;border-radius:999px">${esc(label)}</a></td></tr></table>`;

/** Label / value rows. Values are HTML (escape before passing). */
export const facts = (theme: Theme, rows: [string, string][]) =>
  `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" class="em-line" style="border-top:1px solid ${theme.line}">${rows
    .map(
      ([label, value]) =>
        `<tr><td class="em-muted em-line" style="padding:11px 12px 11px 0;width:110px;vertical-align:top;border-bottom:1px solid ${theme.line};font-family:${SANS};font-size:13px;color:${theme.muted}">${esc(label)}</td><td class="em-text em-line" style="padding:11px 0;border-bottom:1px solid ${theme.line};font-family:${SANS};font-size:15px;line-height:1.45;color:${theme.text}">${value}</td></tr>`,
    )
    .join('')}</table>`;

export const link = (theme: Theme, href: string, label: string) =>
  `<a href="${esc(href)}" class="em-hl" style="color:${theme.highlight};text-decoration:underline">${esc(label)}</a>`;

export const image = (theme: Theme, src: string, alt: string, caption?: string) =>
  `<img src="${esc(src)}" alt="${esc(alt)}" width="536" style="display:block;width:100%;max-width:536px;height:auto;border:0;border-radius:16px;background:${theme.line}">${
    caption ? `<p class="em-muted" style="margin:8px 0 0;font-family:${SANS};font-size:12px;line-height:1.45;color:${theme.muted}">${esc(caption)}</p>` : ''
  }`;

export type FooterInput = { reason: string; links?: [string, string][]; instagram?: string };

function footer(theme: Theme, input: FooterInput) {
  const links = (input.links ?? [])
    .map(([label, href]) => `<a href="${esc(href)}" style="color:${theme.footerLink};text-decoration:underline">${esc(label)}</a>`)
    .join(' &nbsp;·&nbsp; ');
  const ig = input.instagram
    ? `<a href="https://instagram.com/${esc(input.instagram)}" style="text-decoration:none"><img src="${esc(absolute(theme.origin, `/assets/email/instagram-${theme.kind === 'vvs' ? 'light' : 'dark'}.png`))}" width="24" height="24" alt="Instagram" style="display:inline-block;border:0;vertical-align:middle"></a>`
    : '';
  const mark =
    theme.kind === 'vvs'
      ? `<img src="${esc(absolute(theme.origin, '/assets/email/vvs-mark.png'))}" alt="VVS Lab" height="20" style="height:20px;width:auto;border:0;display:inline-block;vertical-align:middle">`
      : `<span style="font-family:${SANS};font-size:12px;color:${theme.footerText}">Powered by <a href="https://vvslab.magpollo.com/?utm_source=email&amp;utm_medium=powered_by" style="color:${theme.footerLink};text-decoration:underline">VVS Lab</a></span>`;
  const p = (html: string, margin = '0 0 8px') => `<p style="margin:${margin};font-family:${SANS};font-size:12px;line-height:1.6;color:${theme.footerText}">${html}</p>`;
  return `<tr><td align="center" class="em-pad-x" style="padding:28px 32px 8px">
<table role="presentation" cellpadding="0" cellspacing="0"><tr><td style="padding:0 10px 0 0;vertical-align:middle">${mark}</td>${ig ? `<td style="padding:0 0 0 10px;vertical-align:middle">${ig}</td>` : ''}</tr></table>
</td></tr>
<tr><td align="center" class="em-pad-x" style="padding:8px 32px 36px">
${links ? p(links, '0 0 10px') : ''}${p(esc(input.reason))}${p(esc(COMPANY), '0')}
</td></tr>`;
}

/** The whole email: frame, logo, card with `body` (HTML), footer. */
export function frame(theme: Theme, input: { title: string; preheader: string; body: string; footer: FooterInput; hero?: string }) {
  const logo =
    'src' in theme.logo
      ? `<img src="${esc(theme.logo.src)}" alt="${esc(theme.logo.alt)}" height="${theme.logo.height}" style="height:${theme.logo.height}px;width:auto;max-width:220px;display:block;border:0;margin:0 auto">`
      : `<span style="font-family:${SERIF};font-size:30px;line-height:1;color:${theme.kind === 'vvs' ? '#fbf7f0' : theme.text}">${esc(theme.logo.wordmark)}</span>`;
  const darkPage = theme.kind === 'vvs' ? '#141110' : '#151210';
  return `<!doctype html>
<html lang="en" xmlns:v="urn:schemas-microsoft-com:vml">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<meta name="x-apple-disable-message-reformatting">
<meta name="color-scheme" content="light dark">
<meta name="supported-color-schemes" content="light dark">
<title>${esc(input.title)}</title>
<link href="https://fonts.googleapis.com/css2?family=Instrument+Serif:ital@0;1&display=swap" rel="stylesheet">
<style>
  :root { color-scheme: light dark; supported-color-schemes: light dark; }
  body { margin:0; padding:0; -webkit-text-size-adjust:100%; }
  a { text-decoration-thickness: 1px; }
  @media (max-width: 620px) {
    .em-pad { padding: 28px 22px !important; }
    .em-pad-x { padding-left: 22px !important; padding-right: 22px !important; }
    .em-h1 { font-size: 32px !important; }
  }
  @media (prefers-color-scheme: dark) {
    .em-page { background: ${darkPage} !important; }
    .em-card { background: #221c17 !important; }
    .em-text { color: #f3ede4 !important; }
    .em-muted { color: #b5a995 !important; }
    .em-line { border-color: #3b332b !important; }
    .em-hl { color: ${theme.kind === 'vvs' ? '#e2b85e' : '#f3ede4'} !important; }
    .em-btn { background: ${theme.kind === 'vvs' ? '#e2b85e' : theme.button} !important; }
    .em-btn-a { color: ${theme.kind === 'vvs' ? '#1b1714' : theme.buttonText} !important; }
  }
  [data-ogsc] .em-card { background: #221c17 !important; }
  [data-ogsc] .em-text { color: #f3ede4 !important; }
  [data-ogsc] .em-muted { color: #b5a995 !important; }
</style>
</head>
<body class="em-page" style="margin:0;padding:0;background:${theme.page}">
<div style="display:none;max-height:0;overflow:hidden;opacity:0;color:transparent">${esc(input.preheader)}&#8199;&#65279;&#847;&#8199;&#65279;&#847;&#8199;&#65279;&#847;&#8199;&#65279;&#847;</div>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" class="em-page" style="background:${theme.page}">
<tr><td align="center" style="padding:0 12px">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:600px">
<tr><td align="center" style="padding:36px 0 26px">${logo}</td></tr>
<tr><td class="em-card" style="background:${theme.card};border-radius:24px">
${input.hero ? `<table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr><td align="center" style="padding:28px 28px 0">${input.hero}</td></tr></table>` : ''}
<table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr><td class="em-pad" style="padding:36px 32px 34px">
${input.body}
</td></tr></table>
</td></tr>
${footer(theme, input.footer)}
</table>
</td></tr>
</table>
</body>
</html>`;
}
