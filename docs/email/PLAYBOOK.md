# Email playbook

How we make email that holds its own next to the best (Wispr Flow, Linear, Arc,
Stripe, Cash App, Duolingo). Brand-agnostic: it's written to become a reusable
skill. VVS Lab specifics live in [`vvs-lab.md`](vvs-lab.md).

The kit that implements it is in `server/email/` (React Email):
`brand.ts` (one object per brand), `components.tsx` (the building blocks), and
`server/emailTemplates.tsx` (the emails). `scripts/email-preview.ts` renders
everything at phone and desktop width, light and dark. `scripts/email-art.ts`
draws the illustrations.

---

## 1. What best-in-class looks like

The pattern behind every standout email we studied:

1. **One frame, always the same.** Logo centred on top, one background colour,
   a 560–640px column, generous padding (32–40px), the same footer every time.
   Wispr's welcome and feature emails are visibly one system.
2. **A headline with character.** Display size (36–48px), usually a serif with
   **one italic or accent word** ("Start typing at the *speed* of thought").
3. **One owned visual.** Either a custom illustration in one house style
   (thick outlines + 2–3 brand colours) or the user's own thing (their design,
   their numbers). Never stock photos, never raw full-window screenshots.
4. **Short, specific copy.** 60–150 words, one idea, a person's voice
   ("Hey there,", "it's Pedro here"). Specifics beat adjectives ("Say X →
   Flow types Y").
5. **One clear ask.** One solid, high-contrast button with verb + object
   ("Set up my builder"). Anything else is a plain text link. Repeat the same
   CTA at the bottom of long emails rather than adding a second ask.
6. **A proper footer.** Small logo mark, social icons, why you got this,
   company name and street address, Terms / Privacy, Unsubscribe on marketing.
7. **Personal data as the hero when you have it.** Usage numbers (Loom's "you
   eliminated 9 meetings"), the customer's own design photo, what they built.
8. **Sender and preheader do work.** "Name from Brand" for letters, "Brand"
   for product mail. The preheader continues the subject; it doesn't repeat it.

## 2. Anatomy (the kit's components)

| Piece | Component | Rules |
| --- | --- | --- |
| Frame | `EmailFrame` | Page colour, centred logo, rounded card, footer. Max 600px. |
| Hero (optional) | `hero` prop | Illustration or product image above the text, inside the card. |
| Eyebrow | `Eyebrow` | 12px, uppercase, tracked. Says what kind of email this is. |
| Headline | `Headline` | Serif, `*one word*` in italic highlight colour. ≤ 2 lines on a phone. |
| Body | `Paragraph` | 16px, line-height 1.55. Muted variant for fine print. |
| Ask | `CTA` | One per email. Pill, ≥ 44px tall. Verb + object. |
| Details | `Facts`, `Lines`, `SectionLabel` | Label/value rows with hairlines; small price lines. |
| Image | `Photo` | 2× resolution, `width` attribute set, rounded 16px, caption if AI-made. |
| Footer | built into `EmailFrame` | Mark, social, links, reason, unsubscribe (marketing), legal address. |

## 3. Type

- Headline: brand serif via web font, with a real fallback stack:
  `'Instrument Serif', Georgia, 'Times New Roman', serif`. **Apple Mail shows
  the web font; Gmail and Outlook show Georgia.** Design so Georgia looks good
  too. Don't put headlines in images (accessibility, dark mode, clipping).
- Body: system sans stack (`-apple-system, Segoe UI, Helvetica, Arial`).
- Scale: headline 36–40px (32 on phones), subhead 20–24, body 16, fine print
  12–13.

## 4. Colour, contrast, dark mode

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

## 5. Illustration

- One house style per brand, written down: shapes, outline weight, palette,
  ornaments. (VVS Lab: flat shapes, warm gold gradients, 5–7px ink outlines,
  4-point sparkles, a soft circular halo.)
- **Draw in SVG, ship PNG.** Gmail, Outlook and Yahoo don't display SVG.
  `scripts/email-art.ts` draws with code (exact, consistent, regenerable) and
  renders 2× PNGs with `sharp`. Keep each under ~100 KB; set `alt=""` on
  decorative art.
- One illustration per email, about the email's one idea.
- Hand-coded SVG does bold flat art well. For loose hand-drawn characters
  (Wispr's motorbike rider), commission an illustrator or generate with an
  image model in a locked style, then approve the set.

## 6. Copy

- Write like a person at the brand, not like the brand. Contractions, short
  sentences, plain words.
- One idea per email; say it in the subject, the headline and the button.
- Subject ≤ ~45 characters; preheader adds information.
- Specific numbers and names over adjectives.
- Every merge field has a fallback (`{{first_name|there}}`); test with an
  empty name.
- Transactional emails stay transactional: no promotions in receipts or
  sign-in mail (it changes their legal status).

## 7. Sequences

### Trial (14 days, B2B to small shop owners)

Send by behaviour, not only by day: skip a step the user has already done.

| Day | Job | CTA |
| --- | --- | --- |
| 1 | Activation: the one action that makes the product real | Open / build the first thing |
| 3 | Show the money: how this earns or saves them money | Use the feature that pays |
| 7 | Proof and depth: a peer's result + one advanced feature | Try the advanced feature |
| 12 | Trial ending: recap what they built and what they'd lose | Keep my account |
| 14 | Last day: plain founder letter, offer help | Upgrade (secondary: reply to me) |

### Win-back

No guilt, a loss-framed fact, one easy way back (Duolingo). Typical cadence:
30 days inactive → +7 days with something new → a final "should we stop
emailing you?" → suppress.

### Announcements

Either one hero feature per email (Wispr) or a strict digest grid (Stripe:
image, title, two lines, "Learn more"). Credit the users who asked for it
(Arc). A monthly founder letter works well (Raycast).

## 8. Rendering realities

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

## 9. Deliverability and compliance

- **Separate streams.** Transactional (sign-in, receipts, lead
  notifications) on one subdomain, marketing on another (e.g.
  `mail.brand.com` / `news.brand.com`), so a marketing complaint can't sink
  the emails that make money.
- **Authentication:** SPF and DKIM (2048-bit) and DMARC aligned to the From
  domain; DMARC with an `rua` report address, moving from `p=none` toward
  `quarantine`. Warm up a new domain gradually.
- **Gmail/Yahoo bulk-sender rules:** spam complaints under 0.1% (never 0.3%);
  marketing mail needs one-click unsubscribe:
  `List-Unsubscribe: <https://…>` and
  `List-Unsubscribe-Post: List-Unsubscribe=One-Click`, with the endpoint
  answering a POST with 200/202, plus a visible unsubscribe link. Honour it
  within 2 days.
- **CAN-SPAM:** truthful From and subject, a physical address, a working
  opt-out honoured within 10 business days that needs nothing more than one
  click or page.
- **Resend:** Contacts are global and grouped into **Segments** (formerly
  Audiences); **Topics** are per-category opt-ins; **Broadcasts** send to a
  Segment with `{{{RESEND_UNSUBSCRIBE_URL}}}` and test sends; **Automations**
  run event-triggered sequences. Verify the unsubscribe headers on a real send
  ("Show original" in Gmail).

## 10. Pre-send QA checklist

1. SPF, DKIM, DMARC pass and align (Gmail → Show original).
2. Marketing: List-Unsubscribe headers present; a test POST unsubscribes;
   the body link works; the address is in the footer.
3. Subject ≤ ~45 chars, preheader adds information, sender name right.
4. Every merge field has a fallback; tested with an empty name.
5. `email-preview.ts`: phone and desktop, light and dark, all look right.
6. Real sends to Gmail (web + iPhone app) and Apple Mail (iPhone), dark mode
   on; Outlook if the audience uses it.
7. Images off: still makes sense; every image has alt text.
8. HTML under ~80 KB.
9. Every link resolves, UTM tags on marketing links, nothing points at
   localhost or a preview deployment, one primary CTA.
10. Contrast passes (body/links 4.5:1, headline 3:1), body ≥ 16px.
11. Plain-text version present and readable.
12. Right segment and topic, suppressions applied, send time sensible.
13. A second person approves; volume within the warm-up plan.

## 11. Making a new brand

1. Write a `Brand` in `server/email/brand.ts` (colours light and dark, fonts,
   logo, footer mark, legal line, links, social). Check contrast for
   `highlight` (3:1) and `link` (4.5:1) against the card in both modes.
2. Define the illustration style in a sentence and draw the first piece in
   `scripts/email-art.ts`.
3. Build the welcome email first; review it next to the reference email.
4. Run the QA checklist, then the trial sequence.

## Sources

Really Good Emails (Wispr Flow welcome and Snippets, Linear welcome, Arc
access and update, Raycast update, Stripe product digest, Cash App sign-in
code, Duolingo win-back, Airbnb host onboarding, Loom year in review, Figma
team welcome, Headspace verify), caniemail.com, Litmus dark-mode guide, Google
"Email sender guidelines" (support.google.com/a/answer/81126), Yahoo sender
best practices, FTC CAN-SPAM compliance guide, Resend docs (Segments, Topics,
Broadcasts, Automations, unsubscribe headers, subdomains, warm-up). Researched
Oct 2026; re-check client support tables before relying on a single cell.
