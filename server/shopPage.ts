import type { PublishedTenant } from './tenants.js';

// Shop pages are client-rendered, so link previews (iMessage, IG, WhatsApp)
// would all show VVS Lab. This rewrites the head of index.html for /b/<slug>
// with the shop's own title, description and image.

const escape = (value: string) =>
  value.replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

const setTag = (html: string, pattern: RegExp, tag: string) => (pattern.test(html) ? html.replace(pattern, tag) : html.replace('</head>', `    ${tag}\n  </head>`));

export function shopHead(html: string, tenant: PublishedTenant, origin: string): string {
  const name = tenant.config.brand.name;
  const title = `Design your custom grillz · ${name}`;
  const description = `Build your grillz in 3D, see the price and get a studio photo of your exact set from ${name}.`;
  const logo = tenant.config.brand.logo;
  const image = logo ? (logo.startsWith('http') ? logo : `${origin}${logo.startsWith('/') ? '' : '/'}${logo}`) : `${origin}/assets/vvs/og.png`;
  const url = `${origin}/b/${tenant.slug}`;
  // The default share image's size no longer applies to a shop's logo.
  let out = html.replace(/\s*<meta\s+property="og:image:(?:width|height)"[^>]*>/g, '');
  out = setTag(out, /<title>[^<]*<\/title>/, `<title>${escape(title)}</title>`);
  out = setTag(out, /<meta\s+name="description"[^>]*>/, `<meta name="description" content="${escape(description)}" />`);
  out = setTag(out, /<meta\s+property="og:title"[^>]*>/, `<meta property="og:title" content="${escape(title)}" />`);
  out = setTag(out, /<meta\s+property="og:description"[^>]*>/, `<meta property="og:description" content="${escape(description)}" />`);
  out = setTag(out, /<meta\s+property="og:image"[^>]*>/, `<meta property="og:image" content="${escape(image)}" />`);
  out = setTag(out, /<meta\s+property="og:url"[^>]*>/, `<meta property="og:url" content="${escape(url)}" />`);
  out = setTag(out, /<meta\s+name="twitter:title"[^>]*>/, `<meta name="twitter:title" content="${escape(title)}" />`);
  out = setTag(out, /<meta\s+name="twitter:image"[^>]*>/, `<meta name="twitter:image" content="${escape(image)}" />`);
  out = setTag(out, /<link\s+rel="canonical"[^>]*>/, `<link rel="canonical" href="${escape(url)}" />`);
  // The logo is the largest thing in the header; fetch it alongside the JS instead of after it.
  if (logo) out = out.replace('</head>', `    <link rel="preload" as="image" href="${escape(image)}" fetchpriority="high" />\n  </head>`);
  return out;
}
