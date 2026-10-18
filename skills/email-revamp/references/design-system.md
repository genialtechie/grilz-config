# Design system: brand, kit, type, colour, rendering

## Anatomy (the kit's components)

| Piece | Component | Rules |
| --- | --- | --- |
| Frame | `EmailFrame` | One surface colour, centred logo, content column, footer. Max 600px. |
| Illustration | `Illustration` | Under the headline, centred, 440px. Lifecycle mail only. |
| Headline | `Headline` | Serif, `*one word*` in italic highlight colour. `align: 'center'`, size 54 on lifecycle mail; 44 left on transactional. |
| Body | `Paragraph` | 17px, line-height 1.6. Muted variant for fine print. |
| Sign-off | `SignOff` | "— The VVS Lab team" (from `brand.signOff`). |
| Ask | `CTA` | One per email. Pill, ≥ 44px tall. Verb + object. |
| Details | `SectionLabel` + `Paragraph` | Quiet sentence-case label, one line per item. |
| Quote | `Quote` | Someone's own words (a customer's note), serif italic with an accent rule. |
| Steps | `Steps` | Numbered "what happens next". |
| Image | `Photo` | 2× resolution, `width` attribute set, rounded 16px, caption if AI-made. |
| Footer | built into `EmailFrame` | Rule, social tiles, ©, address, links + Unsubscribe (marketing), reason, app-icon mark (or "Powered by"). |

## Type

- Headline: brand serif via web font, with a real fallback stack:
  `'Instrument Serif', Georgia, 'Times New Roman', serif`. **Apple Mail shows
  the web font; Gmail and Outlook show Georgia.** Design so Georgia looks good
  too. Don't put headlines in images (accessibility, dark mode, clipping).
- Body: system sans stack (`-apple-system, Segoe UI, Helvetica, Arial`).
- Scale: lifecycle headline 54px (44 on phones), transactional 44, subhead
  20–24, body 17, fine print 12–13.

## Colour, contrast, dark mode

- Off-black and off-white, never pure: they survive client inversion better.
- **Contrast (WCAG AA):** body text and inline links ≥ 4.5:1 against the card;
  large headline text ≥ 3:1. Brand golds and pastels usually fail as body
  text: keep them for the headline word, rules and ornaments, and give links
  their own darker shade (the `link` colour in `Brand`).
- **Dark mode strategy** (what the kit does):
  1. `<meta name="color-scheme" content="light dark">` and
     `supported-color-schemes`.
  2. A `prefers-color-scheme: dark` block remapping page, card, text, muted,
     lines, highlight, links and button (Apple Mail, iOS Mail, Outlook apps).
  3. The same for Outlook.com via `[data-ogsc]` selectors.
  4. Gmail ignores all of it and auto-inverts (iOS fully, Android partly):
     choose light colours that invert gracefully and use transparent PNG logos
     that read on both.
- Check every email in both modes before shipping (`email-preview.ts`).

## Rendering realities

| Feature | Apple Mail | Gmail | Outlook (classic Windows) |
| --- | --- | --- | --- |
| Web fonts | yes | no | no (falls back) |
| SVG | yes | **no** | **no** |
| `border-radius` | yes | yes | no (square corners) |
| Media queries | yes | partial | no |
| `prefers-color-scheme` | yes | no (auto-inverts) | no |
| Background images | yes | yes | VML only |

- Table-based, fluid, mobile-first layout (React Email does this).
- Gmail clips HTML over ~102 KB (hiding the footer and unsubscribe). Stay
  under ~80 KB; the kit's emails are 9–18 KB.
- Images at 2× with explicit `width`/`height`; never base64.
- Accessibility: `lang` on `<html>`, `role="presentation"` tables (React Email
  does this), alt text, 16px body, 44px tap targets, no text in images.

## Brand object checklist

- Accent from the product's CSS (`--accent` or the primary button colour),
  not the logo. Metals and pastels go to ornaments and illustration.
- Page colour (one surface) light and dark; text, muted, line colours.
- `highlight` (headline italic word, 3:1), `link` (4.5:1, usually a darker
  shade of the accent), `button` + `buttonText` (4.5:1). Check both modes
  with `scripts/contrast.py`.
- Serif for headlines with a Georgia fallback; system sans for body.
- Logo as a 2× transparent PNG; footer mark (mascot or app icon); socials as
  filled tiles that read on light and dark.
- Legal name and street address (CAN-SPAM), sign-off line, links.
- A second, white-label theme if the product sends on behalf of its
  customers (their logo and accent, "Powered by").

## Stack notes

- React Email renders table-based, client-safe HTML. On Vercel, write server
  email code as `.ts` with `createElement` (Vercel's Node builder silently
  leaves `.tsx` server modules out of the bundle); verify with a production
  build that the email modules are in the function output.
- Serverless plans cap functions (Vercel Hobby: 12 per deployment). Put new
  endpoints behind rewrites into an existing function rather than adding
  files.
- Previews: render each email with the real origin in the copy but load
  assets from a local server; screenshot at 390px and 640px, light and dark
  (Playwright `colorScheme`).
