# Charms + initials track (from Nov 18)

Owner's calls (Nov 18): add the Creator Lab's charms and its "One-of-one" build to the real app, priced
"quoted by the shop"; bring the old builder's letters back (across several teeth, block or script, enamel) in
the new panel's look. Branch `charms-initials`, built on `redesign`; the lead merges.

## Done (Nov 18)

- **Option model** (`src/lib/renderSpec.ts`): `CHARMS` (ten original pieces: Crest, Emblem, Winged heart,
  Crown, Pointed hat, Broom, Owl, Ruby potion, Emerald potion, Sapphire) and `SetOptions.charms?: { id, tooth }[]`,
  one a tooth. Optional everywhere: old saved designs, old clients and old leads parse exactly as before.
  `parseRenderSpec` checks ids, teeth in the set, one a tooth, and that the shop sells each charm.
  The summary names each one ("Crown charm on the upper left central incisor"); the AI photo prompt keeps them.
- **Shop catalogue and prices** (`src/lib/tenant/schema.ts`, `catalog.ts`, `diff.ts`): `catalog.charms?: { enabled, ids }`
  and `pricing.charms?: { each?, byId? }`. A charm with no price is **quoted by the shop**: it shows as
  "Quoted", stays out of the total, and `priceBreakdown` returns it in `quoted`. Shop editor (`src/admin/ShopEditor.tsx`):
  "One-of-one charms" on/off, which charms, and "I quote each charm" or one price each. New shops start with
  charms off (`src/admin/templates.ts`); the publish diff says when charms or their price change.
- **Demo shop** (`vvslab.ts`): every charm on, none priced (quoted, as in the lab).
- **3D** (`src/components/three/redesign/charms.ts`, `dress.ts`, `look.ts`): the lab's charm geometry ported,
  built on the tooth's face in its metal, with enamel, domed and faceted stones. Charm pictures for the tiles
  rendered from the 3D: `public/assets/options/grillz/charm-*.webp` (`npm run option-pictures`, `ONLY=^charm-`).
- **Builder** (`src/components/creator/*`): Extras row "One-of-one charms" (the lab's: a strip of charm tiles,
  on the picked teeth, else the first front tooth without one, which stays picked; tap again to take it off;
  "Quoted by {shop}" or "+$X each"). The **One-of-one** build on the start page (18K, top corners iced, a
  charm on all twelve teeth, card price "Quoted"); only at shops that sell every charm in it. Charms leave with
  their tooth, ride in the saved design and the link, and come back from Describe it.
- **Letters** ("Initials or a name", same row): up to 12 characters; Lettering as rows with a round preview of
  their own first letters (Block / Script); Finish chips with "$X a tooth"; Enamel chips for engraved letters;
  Where: Top row / Bottom row, 1–8 teeth (only spans that fit), or "Tap teeth on the 3D" (first tooth, then
  the last, the old builder's way). Priced per tooth covered, as the catalogue already did.
- **After Done**: "What's in the price" lists quoted charms as "Quoted", with "{shop} quotes your charm on top
  of the estimate." The lead email tells the shop "To quote yourself, not in the total: …".
- **Describe it** (`server/describeSpec.ts`): the schema and instructions list the shop's charms and twelve
  named front teeth; charms go on the tooth named, else the nearest free front tooth; null keeps them, [] takes
  them off; logos and characters are refused in favour of the closest plain charm. Shops without charms: schema
  `null`, "No charms here."
- **Fix on the way**: the Extras switches never looked on (CSS matched `aria-pressed`, the switch uses `aria-checked`).
- **Tests**: `src/lib/__tests__/charms.test.ts` (schema, prices, spec clamp, prompts, diff, templates),
  `src/components/creator/__tests__/creator.test.ts` (letters, charms, One-of-one, saved designs old and new),
  `server/__tests__/describe.test.ts` and `leads.test.ts` (charms in Describe it and the lead email).

## Decisions made here, and why

- **Charms stay original.** Two lab pieces were redrawn: the Emblem is a solid triangle with one stone (the
  lab's had a ring inside an open triangle, too close to a well-known film symbol), and the winged piece has a
  heart where the lab had a small ball with wings (too close to a well-known film prop). Ids and labels say
  what they are, nothing branded.
- **Charms on the set, not the tooth** (`SetOptions.charms`, not a `ToothDesign` field): tooth designs still
  group and price as before, and old clients that don't know charms send exactly what they did.
- **Quoted = out of the total**, not $0 in it: the estimate stays honest, and the shop sees what to price.
- **New shops: charms off.** A one-of-one piece is custom work; a shop opts in.
- **One letters line, not two.** The old builder allowed a second line on the other row; the new row keeps one
  (owner question below). Picking teeth for letters is a mode ("Tap teeth on the 3D") so taps in Extras still
  pick teeth for charms otherwise.

## Left

- Owner check on a phone: the charm tiles, the letters row (it is long when open), One-of-one's place in the list.
- Case-study notes tab of the plan page (lead).

## Owner questions

1. A second line of letters on the other row (the old builder had it): bring it back?
2. Done shows the estimate without quoted charms; add "+ quote" next to the total?
3. One-of-one is last of the builds; should it lead, as on the landing page's showcase?

## How to check

`npm test -- charms creator describe leads`; `npm run build && npx vite preview`, open `/configurator`, pick
One-of-one, or Gold 6 × 6 → Extras → One-of-one charms → Crown, or Initials or a name → "Lainee", Script,
Engraved, Pink, Bottom row, 4 teeth. Screens: `docs/redesign/case-study/2026-11-18-build-*` (390 × 844 and 1440 × 900).

**Next**: owner walk-through of charms, One-of-one and the letters row on a phone; answer the three questions.
