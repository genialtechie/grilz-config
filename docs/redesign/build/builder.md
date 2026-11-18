# Builder track: the Grill Creator Lab in the app

Owns `src/components/creator/*` except `after/`, the routes to it, and the 3D additions in `src/components/three/`.
Source of truth: `docs/redesign/creator-lab/src/` (v15) and the Decisions table in `docs/redesign/plan.md`.

## Done (Nov 17)

- **Routes.** `/configurator`, `/b/:slug/*` (via `ShopPage.tsx`) and a shop's own domain now open `CreatorApp`.
  `src/components/Configurator.tsx` (the old five-step wizard) is **kept in the repo, unused**, to compare and
  to roll back: point the two `loadable(...)` lines in `App.tsx` and `ShopPage.tsx` back at it. While the code
  downloads, `CreatorShell` shows the start page's background. `vite.config.ts` preloads the creator's chunks.
- **Start page** (`StartPanel.tsx`, lab v15 `renderOpenings`): "Start your build", Build it yourself first, the
  builds with "From $X" from the shop's real prices, "or let AI build it", the composer
  ("Describe your grillz or upload inspiration", camera inside, sparkle send), "3 free AI builds per phone. We
  text you a code first." A kept build shows "Your build is waiting" + Continue your build. Page background
  `#f8f7f4` with grain; the builder keeps the grey room.
- **Build strip** (`BuildPanel.tsx`, lab `stripView`): five round pictures with gold rings on parts not opened,
  the part below, Back (to the part you were on, then the start page) and Next / "Done $X", "N of 5 explored".
  Parts on the app's catalogue (`useTenant()`): sets and +/− counts, metals + karats, finishes + photo + opal
  colours, settings + stones (iced price tables respected via `nearestOffered`), Extras (Fangs, Permanent look,
  Initials on one tooth, Your idea). Prices and "+$X" deltas from `lib/pricing`.
- **Select teeth** on the stage with quick groups (Whole set, Top row, Bottom row, Front teeth, Canines, Every
  other, "N teeth picked") and "Or tap any tooth on the 3D to pick it."; taps on the 3D pick teeth (or add/remove
  them on Teeth); a tap on no tooth clears the picks.
- **3D** (all new props optional; the old Configurator's props unchanged): `selectionLook: 'glow'` — amber glow
  drawn in its own pass above the holder (`three/GlowPass.tsx`, `three/redesign/glow.ts`) and picked teeth lift
  1.3 mm out of the arch; `frame` — the piece is fitted to the free area above the panel (phone) or beside it
  (computer), sideways by view offset; `jawOpen`; `onMissTap`.
- **Quick question** (`QuickQuestion.tsx`, rules in `guide.ts`): asks only when stuck (empty build at once,
  otherwise 9 s idle); answer → "Changed … Undo" for 6 s; Undo brings the question back; × keeps it quiet 20 s.
- **Undo tool** (`history.ts`): steps back through any design change (60 steps).
- **Describe it** (`AiPanel.tsx`): on the start page and as a stage tool; conversation; sign-up first with the
  decided words; real `describeBuild()` and `phoneAuth` (a stale proof is forgotten and a new code asked for);
  builds left from the server (kept per phone on the device); "AI built it" with Undo for 10 s.
- **Drag handles** (`useGrab.ts`): the start panel grows to show every build; on a phone the builder panel drags
  up for more room; tap toggles, Escape shrinks.
- **After Done:** the after track's real `AfterFlow` sits in the panel (my placeholder dropped at the merge);
  `?deposit=paid` opens it at once; the stage marks the free area with `data-after-photo` for the studio photo.
  `ShopPage`'s own deposit toast is removed (AfterFlow says it).
- **Performance:** the panel chunk is ~92 KB; three.js loads with the 3D only (the capture is imported on Done).
- **Tests:** `src/components/creator/__tests__/creator.test.ts` (history, Back, quick groups, the design model,
  prices, saved-design round trip, builds, the "seems stuck" rules).

## Decisions made here, and why

- **Option pictures** are the app's own option images (`/assets/options/grillz/*`), not the lab's live tooth
  renders: real data, no extra render work on phones.
- **One-of-one build and charms left out:** charms aren't in the app's catalogue or `RenderSpec` (owner question). Nov 18: added, see `charms.md`.
- **Labels** come from the catalogue ("Diamond-cut", "Open-face"), where the lab wrote "Diamond cut".
- Picked teeth don't zoom the camera (Nov 16: "no zooming in on just the chosen teeth"); the lab's per-part
  camera turns aren't ported.
- Initials are the lab's one-tooth version (block letters) mapped to the app's `Inscription`; multi-tooth
  letters, fonts and enamel stay in the old editor for now. Nov 18: back in the Extras row, see `charms.md`.
- Dark mode not ported (the lab's stage is a lit room in both themes).

## Left

- Owner check of the whole flow on a real phone (speed of the glow pass on phones is unmeasured).
- Shop add-ons are only on After Done's screen 1 (as decided); no builder row.
- Case-study notes tab of the plan page.

## How to check

`npm run build && npx vite preview`, open `/configurator` at 390×844 and 1440×900. Screens:
`docs/redesign/case-study/2026-11-17-build-creator-*`. `npm test -- creator` for the logic.

**Next**: owner walk-through of the built creator on a phone; then decide charms/one-of-one in the app catalogue.
