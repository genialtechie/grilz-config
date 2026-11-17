# Landing track: the front door in the real app

Owns `src/components/landing/*` and the Geist font. Source of truth: the signed-off front door in
`docs/redesign/creator-lab/` (`src/page.html`, the "front door, final look" block; `src/50-ui.js`, `renderMore`)
and the Decisions table in `docs/redesign/plan.md`.

## Done (Nov 17)

- `/` rebuilt to match the prototype: top bar (3D VVS mark + "Lab", Sign in, Start free); hero over the live 3D
  piece with the build caption, "Design your grillz in 3D.", the two-line sub, both buttons and the fine print;
  the moving strip of grillz words; What happens when you hit send with the example request phone; The price
  (two cards); Questions (two lists, tabs on a phone); the closing card with "Or design your own grillz, free";
  footer with the demo-prices note. All words copied from the prototype, none changed.
- Page background #f8f7f4 with the 4px dot grain from the top bar to the footer (also set on `<html>` while
  the page is open, so overscroll matches). Text rises in on load and on scroll; the words strip moves and
  pauses on hover; `prefers-reduced-motion` turns all of it off.
- 3D: the builder's own `Scene` on a transparent canvas (`HeroPiece.tsx`), lazy-loaded after first paint
  (idle callback), fading in once ready. It turns through the builds every 3.8 s, only while the hero is on
  screen and the tab is visible. Captions are priced by the real engine with the demo tenant (`showcase.ts`,
  tested in `showcase.test.ts`).
- Links: Sign in → `/dashboard`, Start free / Start free as a jeweler / Start free trial → `/signup`, Design
  your grillz (hero, price card, closing link) → `/configurator`, DM “BUILD” → ig.me/m/vvslab.ai, footer →
  @vvslab.ai. PostHog events kept (`commerce_landing_viewed`, `signup_cta_clicked`,
  `sample_configurator_cta_clicked`, `contact_clicked`) plus `sign_in_clicked`.
- Accessibility: one h1, h2 per section, h3 per question list; `<details>` FAQ; tabs with roles and
  `aria-selected`; the words strip is `aria-hidden` with a visually hidden list beside it; the 3D is
  `aria-hidden` (the caption says what it shows); focus-visible outlines; 44px hit areas on the small pills,
  the tabs, the closing link and the footer link.
- Geist 400/500/600 from `@fontsource/geist`, imported by the landing page only (other pages keep their fonts).
- `eslint.config.js` now ignores `docs/redesign/creator-lab` (its sources are script fragments; `npm run lint`
  failed on them before this track started).

## Decisions made here (and why)

- **No one-of-one in the cycle.** The prototype shows a one-of-one with charms; the app's 3D has no charms
  yet. The cycle is the other five builds in the prototype's order. Add it back when charms land.
- **No poster still.** The existing posters (`public/assets/posters`) are of the old open-mouth model, not the
  redesigned piece in its clear holder, so showing one would flash the wrong piece. The words paint first;
  the piece fades in about a second later.
- **The piece can't be dragged on the front door.** The orbit controls would take over scrolling (touch and
  wheel) across most of the first screen; the canvas ignores the pointer, so the page always scrolls.
- **Framing.** The scene frames the piece to its box; the box is sized so the piece sits where the
  prototype's does (desktop: a little narrower than the prototype, whose camera is set up differently; phone:
  the canvas runs past both edges so the piece fills the width).
- **The example request's picture** is the existing iced-fangs option still (`look-iced-fangs.webp`), not a
  live render as in the prototype.
- Left out on purpose: the "proto-note" under Questions (a note to the owner), the prototype switches.

## How to check

`npm run build && npx vite preview`, open `/` at 390×844 and 1440×900. Screenshots (Nov 17):
`docs/redesign/case-study/2026-11-17-build-landing-{hero,full}-{desktop,phone}.jpg`; compare with
`2026-11-17-front-door-final-desktop.jpg` / `-phone.jpg`. `npm run build`, `npm run lint`, `npm test` pass.

## Left / for the owner

- `index.html` still carries the old title and share text ("Your DMs are losing custom orders."). New words
  need the owner.
- The old landing's images in `public/assets/vvs/` are no longer used by `/`; left in place for now.
- When the builder track moves the builder off `/configurator`, change `BUILDER` in `LandingPage.tsx`.

**Next**: owner's look at the built page; then the one-of-one build once the 3D has charms, and new share text
for `index.html` once the owner picks the words.
