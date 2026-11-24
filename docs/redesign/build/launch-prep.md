# Launch-prep track (from Nov 24)

Getting the new builder (`src/components/creator/*`) ready to replace the live one: nothing the live site does
should regress. Branch `launch-prep`, built on `redesign` (which has `main` merged in: MAG-169 iced + opals,
MAG-198 custom domains). The lead merges; nothing here touches `main` or the live site.

## Done (Nov 24)

- **Iced + opals on one tooth** (main's MAG-169) in the new builder. Finish part: iced teeth take the finishes in
  `ICED_FINISHES` (open face, opals) and the opal colour row; the note says "solid, open face, or an opal in the
  middle" where the shop sells opals. `model.ts`: picking a setting keeps an open-face or opal frame (any other
  finish becomes solid, as before); the summary says "iced with blue opal centre · honeycomb · moissanite".
  3D (`three/redesign/dress.ts`): a solid cap, one ring of stones (the open face's layout) and the opal in the
  open face's window with a thin gold rim, as main's old renderer did. Price is `lib/pricing`'s (`icedOpalPrice`),
  tested equal. Describe it (`server/describeSpec.ts`) offers iced opals where the shop sells both, and still
  turns them to solid where it doesn't. Tests: `creator/__tests__/icedOpal.test.ts`, `server/__tests__/describe.test.ts`.
- **Dashboard: "Phone verified"** (green, next to the contact) on leads in the admin and the shop dashboard
  (`src/admin/LeadsPanel.tsx`, `data.ts` selects `leads.phone_verified`), a "Phone verified" column in the CSV
  (`leadsCsv.ts`), and the column in the shop's data export.
- **Both lines of letters and charms reach the shop.** `summarizeDesign` and the shop email already listed every
  inscription and charm; now tested end to end: the builder's spec (fixture
  `creator/__tests__/fixtures/lead-two-lines.json`, checked against the builder in `leadSpec.test.ts`) goes
  through `POST /api/leads` and the stored summary and the shop email name "AB", "Lainee" and the Crown charm
  (`server/__tests__/leadsLetters.test.ts`).
- **Old links (fixed).** Links and saved designs from the old builder with letters it placed itself opened
  differently in the new one ("AB" on one tooth instead of two; with two lines, the rows swapped), so at a
  different price. The new builder now marks its own snapshots (`runs: 'centred'` in `lib/savedDesign.ts`;
  the live site's reader ignores it) and opens unmarked ones with the old builder's runs pinned (`placeDrafts`).
  Tests (`creator/__tests__/oldLinks.test.ts`): four old-format designs (iced opal, two-tone, two lines, top
  eight) by link and from device storage, through `startingDesign` as `CreatorApp` opens them: same spec, same price.
  A design kept before the fit step opens on the shop's default fit.
- **Embeds (fixed).** In a frame shorter than 640 px (embed.js makes them from 600) the builder scrolled inside
  the frame and Next sat below it; framed builders (`data-framed`) now fit the frame. On short phone-width
  screens (≤ 760 px tall) the quick question covered the tool column; the tools step aside while it's open, as
  Select teeth already did. The drag handle opens the panel to the top of a 380 × 600 frame and back.
- **Custom domains confirmed.** "/" served the way `api/shop-page.ts` serves a shop's own domain
  (`customDomainHead`, `<meta name="vvs-shop">`) renders the shop's builder (CreatorApp start page); without the
  marker "/" is the landing page. Checked in a local run (below).
- **Screens:** `docs/redesign/case-study/2026-11-24-launch-{embed-start,embed-builder,embed-handle-phone,iced-opal-phone,iced-opal-desktop,custom-domain}.jpg`.

## Left / for the owner

- **Owner check:** the iced-opal look on a phone; the tools hiding while the quick question is open on short
  screens (a small UX change made to fix the overlap: say if you'd rather move the question instead).
- In a 380 × 600 or 700 frame the builder panel shows its part strip and heading but few tiles until the
  handle is dragged up: it works, but a shop with a short embed may want `data-mode="button"` on phones (embed.js's
  default `auto` already uses the button under 640 px wide).
- Seen on the way, not changed: with a full saved design open, the quick question still asks "Which metal?"
  (the guide counts parts not opened yet), and the start page in a short frame shows only the top of the 3D.

## How to check

`npm test -- icedOpal oldLinks leadSpec leadsLetters describe`; then
`npm run build && npx vite preview --port 4317` and
`CHROMIUM_PATH=/opt/pw-browsers/chromium npx tsx scripts/launch-check/capture.ts http://localhost:4317`
(prints ok/FAIL for every frame and the custom-domain check, and rewrites the screens).

**Next**: owner looks at the six `2026-11-24-launch-*` screens and answers the two owner checks above; then the lead merges `launch-prep` into `redesign`.
