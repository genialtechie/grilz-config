# Email playbook

How we make email that holds its own next to the best (Wispr Flow, Linear, Arc,
Stripe, Cash App, Duolingo). Brand-agnostic: it's written to become a reusable
skill. VVS Lab specifics live in [`vvs-lab.md`](vvs-lab.md).

The kit that implements it is in `server/email/` (React Email):
`brand.ts` (one object per brand), `components.ts` (the building blocks), and
`server/emailTemplates.ts` (the emails). `scripts/email-preview.ts` renders
everything at phone and desktop width, light and dark. `scripts/email-art.ts`
draws the small art; the mascot comes from `scripts/mascot-model.ts`.

The components are written with `createElement` in `.ts` files, not JSX:
Vercel's Node functions compile and bundle only `.ts`, so a `.tsx` server
module is silently left out of the function and crashes at runtime. On a host
that bundles TSX, JSX works the same. Either way, check a production build
contains the email modules before relying on it.

---

## 1. What best-in-class looks like

The pattern behind every standout email we studied:

1. **One surface, always the same.** One background colour edge to edge (no
   card floating on a frame), logo centred on top, a 560–640px column,
   generous side padding (40px), the same footer every time. Wispr's emails
   are visibly one system.
2. **A headline with character.** Display size (48–60px on lifecycle mail,
   centred; ~44px left-aligned on transactional), a serif with **one italic or
   accent word** ("One quick *question* for you").
3. **One owned visual, under the headline.** Either a custom illustration in
   one house style (thick outlines, 2–3 brand colours, a light "sticker" edge
   so it lifts off a dark background, a little character: faces, a speech
   bubble) or the user's own thing (their design, their numbers). Never stock
   photos, never raw full-window screenshots.
4. **Short, specific copy.** 60–150 words at 17–18px, one idea, a person's
   voice ("Hey there,", "it's Pedro here"), signed off by a person or team
   ("— Written with Wispr Flow"). Specifics beat adjectives.
5. **One clear ask.** One solid, high-contrast button with verb + object
   ("Set up my builder"). Anything else is a plain text link. Repeat the same
   CTA at the bottom of long emails rather than adding a second ask.
6. **A proper footer.** A heavy rule, social icons as filled tiles, ©year,
   company and street address, links separated by pipes with Unsubscribe
   among them, why you got this, and the app-icon mark last.
7. **Personal data as the hero when you have it.** Usage numbers (Loom's "you
   eliminated 9 meetings"), the customer's own design photo, what they built.
8. **Sender and preheader do work.** "Name from Brand" for letters, "Brand"
   for product mail. The preheader continues the subject; it doesn't repeat it.

## 2. Plan from the smallest form out

Design an email the way a mascot designer starts from the silhouette: get the
smallest form right before adding anything. Write this plan before any layout.

0. **The moment.** What triggered it, who reads it, where they are (usually a
   phone, mid-task), how they feel, and the **one job** the email does for
   them.
1. **The inbox row** (sender · subject · preheader). Most people only ever see
   this. It must deliver the point on its own; the preheader adds a fact the
   subject doesn't have, never repeats it.
2. **The first screen** (about 600px on a phone). Headline, the one visual,
   the one action. If a reader stops here they have what they need.
3. **The details.** Only what helps the reader do the job, ranked.
4. **The reference.** Fine print and footer.

Then audit every element with two questions: **why does this reader need it
now, and what will they do with it?** No answer → cut it. Rules that fall out
of this:

- **Each fact appears once.** No subline repeating the headline, no table
  repeating the spec list.
- **Five sizes only:** headline (44–54px) · hero visual · body (17px) ·
  details (15–16px) · fine print (13px). Importance decides the tier, not the
  data type.
- **No eyebrows or shouty uppercase labels.** The headline says what kind of
  email it is; section labels are quiet sentence case.
- **Don't show state you don't know.** If a deposit may not be paid yet,
  don't list it as if it were.
- **People's own words beat fields.** A customer's note is shown as a quote,
  not a table row.

## 3. Anatomy (the kit's components)

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

## 4. Type

- Headline: brand serif via web font, with a real fallback stack:
  `'Instrument Serif', Georgia, 'Times New Roman', serif`. **Apple Mail shows
  the web font; Gmail and Outlook show Georgia.** Design so Georgia looks good
  too. Don't put headlines in images (accessibility, dark mode, clipping).
- Body: system sans stack (`-apple-system, Segoe UI, Helvetica, Arial`).
- Scale: lifecycle headline 54px (44 on phones), transactional 44, subhead
  20–24, body 17, fine print 12–13.

## 5. Colour, contrast, dark mode

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

## 6. Illustration and the mascot

- One house style per brand, written down: shapes, outline weight, palette,
  ornaments. (VVS Lab: flat shapes, warm gold gradients, 5px ink outlines,
  4-point sparkles, a cream sticker edge on dark backgrounds.)
- **Draw in SVG, ship PNG.** Gmail, Outlook and Yahoo don't display SVG.
  Draw with code (exact, consistent, regenerable) and render 2× PNGs with
  `sharp`. Keep each under ~100 KB; set `alt=""` on decorative art.
- One illustration per email, about the email's one idea.
- A **mascot** beats one-off illustrations: one character, many expressions,
  recognisable at a glance (Duolingo's Duo, Mailchimp's Freddie). Build it the
  way character designers do, one approved round at a time:
  1. **Brief before drawing.** Its jobs (welcome, celebrate wins, nudge,
     soften bad news, empty states), the audience, three traits **plus one
     contradiction** (VVS: flashy outside, meticulous craftsman inside), a
     goal and a fear (the fear feeds win-back: "losing my shine").
  2. **Silhouettes only.** 8–12 solid-black shapes from primitives; circles
     read friendly, squares sturdy, triangles edgy. Show each large **and at
     40px**: most fail the shrink test. Pick on shape alone.
  3. **Brand fit decides between survivors.** Look at the brand's own
     imagery and voice (VVS: the hero is a gold grill with fangs; the voice
     is confident with an edge), not at what's cute.
  4. **The face.** 4–6 faces on the chosen body, at 64px too. The product's
     signature details go in the face and must be drawn as the real thing:
     separate teeth with tips, long tapered fangs, pavé stones. A strip with
     triangles doesn't read as teeth. Keep features in contrast (gold teeth
     against a dark mouth) and small (a big open mouth reads "monster").
  5. **Resting face + expressions** from one set of parts: resting (avatar,
     footer), win, nudge, working, sad/win-back, sign-off. Then the signature
     accessory (VVS: an eyebrow piercing with iced-out stones).
  6. **Turnaround** (front, ¾, side on shared guides), exports (transparent
     2× PNG per expression with a light sticker edge so it survives dark
     mode, app icons), then put it in the emails: sign-off in every footer,
     the win face on win emails, the welcome face on the welcome.
  7. **Name it** with a word from the trade that sounds like a name (Karat:
     gold karats, diamond carats).
  The VVS Lab record of every round is in `docs/brand/mascot/`; the model is
  `scripts/mascot-model.ts`.

## 7. Copy

- Write like a person at the brand, not like the brand. Contractions, short
  sentences, plain words.
- One idea per email; say it in the subject, the headline and the button.
- Subject ≤ ~45 characters; preheader adds information.
- Specific numbers and names over adjectives.
- Every merge field has a fallback (`{{first_name|there}}`); test with an
  empty name.
- Transactional emails stay transactional: no promotions in receipts or
  sign-in mail (it changes their legal status).

## 8. Sequences

### Trial (14 days, B2B to small shop owners)

Send by behaviour, not only by day: skip a step the user has already done.

| Day | Job | CTA |
| --- | --- | --- |
| 1 | Activation: the one action that makes the product real | Open / build the first thing |
| 3 | Show the money: how this earns or saves them money | Use the feature that pays |
| 7 | Proof and depth: a peer's result + one advanced feature | Try the advanced feature |
| 12 | Trial ending: recap what they built and what they'd lose | Keep my account |
| 14 | Last day: plain founder letter, offer help | Upgrade (secondary: reply to me) |

**How the kit runs it** (VVS Lab: `server/trialSequence.ts`): a daily cron
computes each shop's state (setup progress, live, requests, payments set up,
card) and picks the one step due. Rules that matter:
- at most one email per person per day;
- each step has a window (e.g. days 3–4); outside it the step is skipped,
  so an outage never dumps three emails at once;
- the ending emails count *days left*, not days since signup, so "last day"
  can't arrive after the trial ended;
- each step is claimed once in the send log (`trial-day-3:<account>`);
- the founder letter comes from a person's name and needs a reply-to that
  reaches a real inbox (marketing subdomains usually don't receive mail).

### Win-back

No guilt, a loss-framed fact, one easy way back (Duolingo). Typical cadence:
30 days inactive → +7 days with something new → a final "should we stop
emailing you?" → suppress.

### Announcements

Either one hero feature per email (Wispr) or a strict digest grid (Stripe:
image, title, two lines, "Learn more"). Credit the users who asked for it
(Arc). A monthly founder letter works well (Raycast).

**How the kit runs them** (VVS Lab: `server/announcements.ts`): each
announcement is a code entry reviewed in a PR, sent by the daily run. It
starts with `audience: 'test'` (only the test inbox gets it); flipping to
`'all'` in a second PR sends it to everyone, once per address, skipping
opt-outs, paced under the provider's rate limit and spread over several runs
for big lists. Two reviews, no "oops, sent to everyone" button.

### Win-back mechanics

Trigger on the state that means "lapsed" (VVS Lab: paused after a trial with
no plan, or a cancelled plan), never on a billing failure (that's dunning) or
an account that asked to leave. Key the send to the lapse date, so someone
who comes back and lapses again gets the sequence again. Keep it to two
emails: the loss-framed fact with what's saved, then "should we stop?".

## 9. Rendering realities

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

## 10. Deliverability and compliance

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
- **How the kit does it:** `server/marketing.ts` (opt-out check, send log
  with a dedupe key, one-click headers, unsubscribe page, complaint/bounce
  webhook). Reuse it rather than Resend Broadcasts when sends are triggered
  by product events.
- **Resend:** Contacts are global and grouped into **Segments** (formerly
  Audiences); **Topics** are per-category opt-ins; **Broadcasts** send to a
  Segment with `{{{RESEND_UNSUBSCRIBE_URL}}}` and test sends; **Automations**
  run event-triggered sequences. Verify the unsubscribe headers on a real send
  ("Show original" in Gmail).

## 11. Pre-send QA checklist

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

## 12. The revamp, step by step (do this for a new brand)

The order we used for VVS Lab, each step reviewed before the next:

1. **Reference first.** Collect the emails you want to be next to (screenshots
   of real ones, light and dark). Write down what they do (section 1), not
   just how they look.
2. **Brand object.** A `Brand` in `server/email/brand.ts`: the product's real
   accent (from its CSS, not a guess), fonts, logo, legal line, links,
   socials. Contrast: `highlight` 3:1, `link` 4.5:1, button text 4.5:1, in
   both modes.
3. **Kit.** One surface, logo, content column, the footer (section 3). On
   Vercel write server email code as `.ts` with `createElement` and confirm
   a production build bundles it.
4. **Plan every email from the smallest form out** (section 2): moment, inbox
   row, first screen, details, reference. Cut eyebrows, repeated facts and
   state you don't know. Look for gaps the plan exposes (VVS: a deposit with
   no way to pay it; no email when a deposit is paid) and close them.
5. **Build, then preview** phone/desktop × light/dark (`email-preview.ts`)
   with production URLs in the copy. Compare side by side with the reference.
6. **Mascot** (section 6), then put it in the emails.
7. **Marketing groundwork** (section 10): separate sending subdomain
   verified in the email provider, opt-out list per topic, send log with a
   dedupe key, one-click unsubscribe headers and page, complaint and bounce
   webhook.
8. **Sequences** (section 8): trial, announcements, win-back, each planned
   with section 2 and sent through the marketing sender.
9. **QA** (section 11) on real inboxes, then warm up the domain.

Lessons from the VVS Lab review rounds:
- Show the work as images, every round; feedback on a picture is fast.
- Accent colour comes from the product, not the logo metal.
- A preview fixture's colours get read as the brand: make fixtures use the
  brand's own values.
- Hierarchy is decided by what the reader does next, never by the data you
  happen to have.

## Sources

Really Good Emails (Wispr Flow welcome and Snippets, Linear welcome, Arc
access and update, Raycast update, Stripe product digest, Cash App sign-in
code, Duolingo win-back, Airbnb host onboarding, Loom year in review, Figma
team welcome, Headspace verify), caniemail.com, Litmus dark-mode guide, Google
"Email sender guidelines" (support.google.com/a/answer/81126), Yahoo sender
best practices, FTC CAN-SPAM compliance guide, Resend docs (Segments, Topics,
Broadcasts, Automations, unsubscribe headers, subdomains, warm-up). Mascots:
Duolingo "Reshaping Duo" and "Building character" (blog.duolingo.com),
Collins' Freddie redesign for Mailchimp, character-design guides on shape
language, silhouette and shrink tests, model and expression sheets. Researched
Oct 2026; re-check client support tables before relying on a single cell.
