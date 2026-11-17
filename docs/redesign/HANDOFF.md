# Picking up the redesign from another Claude account

Everything needed to carry on is in this repo, on the `redesign` branch. A new
Claude session should read, in this order:

1. `CLAUDE.md` (repo root): the working rules. Questions go on slides, flows go
   to the owner screen by screen, nothing goes to `main` or the live site, and
   case-study notes are kept up to date.
2. This file: where things stand and what comes next.
3. `docs/redesign/plan.md`: a snapshot of the living plan page. The
   **Decisions** table is the source of truth, newest first. Never change a
   decision in it without asking the owner.
4. `docs/redesign/case-study/notes.md`: the portfolio notes (timeline, key
   decisions, craft notes, numbers to capture). Screenshots sit next to it.

## Getting access from another account

- In claude.ai, connect a GitHub account that can see
  `genialtechie/grilz-config` (claude.ai/connect-github). If the Claude GitHub
  App isn't installed on the repo for that account, install it from the same
  page, or ask the repo owner to.
- Start a new Claude Code session with that repo selected, then
  `git checkout redesign`. Work and push there only.
- The plan page and the prototypes were published as **private artifacts** on
  the first account. A new account can't open them unless the first account
  shares them (each page's Share menu). Otherwise, republish them from the
  sources here:

| Artifact | Source in this repo | Link on the first account |
|---|---|---|
| Grill Creator Lab (the overhauled builder and the front door, v15) | `creator-lab/creator.html`, built from `creator-lab/src/` | First account: claude.ai/artifact/DK6Km1K4CZZiCDbGwsPWym (not shared). Republished Nov 17 from the second account: claude.ai/artifact/Apwvvs8JjwHDwus15UQKFg |
| Flow Lab (low-fidelity flow options, v3) | `flow-lab/flow-lab.html` | claude.ai/artifact/8YSgY8b6cgC4F8peaW2ZG1 |
| Prototype v6 (full journey before the overhaul) | `prototype/` | claude.ai/artifact/AuT9uiP5MtFsVjeVweLmLk |
| Plan page (living doc) | `plan.md` (snapshot) | claude.ai/artifact/VdVY5BdtTBEXdTvdErb6xD |

If the plan page can't be opened, make a new one from `plan.md`, or keep
`plan.md` itself up to date and commit it after every round.

## Where things stand (Nov 17)

- **The 3D piece:** approved ("the teeth are perfect") and rebuilt in the real
  app: `src/components/three/redesign/*`, `GrillzModel.tsx`, `Scene.tsx`.
  `npm run build`, lint and the test suite pass.
- **The builder overhaul** (Grill Creator Lab, for a first-timer: "I made my
  grill, I know the price, they'll text me" in under two minutes):
  - opens on bare teeth with a row of starting builds
  - the "Your build" menu: open any part in any order, with round pictures, no
    arrows or borders, one font
  - the guide asks a quick question only when someone seems stuck
  - tap teeth on the 3D to style them alone; they glow above the gums
  - several teeth at once: tap to add, or use quick groups
- **After "Done":** three screens.
  1. *Your grill.* Designed (Nov 17 row in the Decisions table).
  2. *Where should Gold Lab text you?* Designed (Nov 17): first name and
     phone, then the code opens in place, fills itself, and the 6th digit
     sends. An already verified phone skips the code. Instagram, the Follow
     ask and email move to the Sent screen.
  3. *Sent.* Designed (Nov 17). Top to bottom: the 3D develops into the
     studio photo (about 30 s) with "Sent. Gold Lab will text you." and their
     number; the deposit, "Start your order: $150 now, the rest after your
     fitting." with [Pay $150 deposit] and "Not now"; one small card, "While
     your photo develops": Instagram ("Gold Lab sees it as you typed it"),
     Follow @vvslab, "Email me a copy"; then What happens next: 1 Gold Lab
     texts you, 2 Fitting, 3 They make it, 4 It's yours.
- **Sign-up:** Firebase phone codes (about $7 a month per 1,000 sign-ups). No
  WhatsApp. No fake Instagram verification; the owner chose an honest optional
  handle plus a Follow ask.
- **The AI path (v11, Nov 17):** "Describe it" and "From a picture" as chips
  on the start page and a "Describe it" tool on the stage. One box, then keep
  talking. The phone sign-up comes first and says why, plainly; 3 free builds
  per verified phone, every reply counts; a photo or screenshot, no Instagram
  links; the closest match with a note on what's different, plus Undo. A word
  matcher stands in for the AI in the prototype (`wish()` in `50-ui.js`).
- **The start page (v15, Nov 17):** "Start your build", the builds row
  (Build it yourself first, one tap into the builder), "or let AI build it",
  then one AI field with a camera inside it. v12 and v11 behind a switch.

## Next, in order

1. ~~Build the builder fixes picked on Nov 17~~ Done in Creator Lab v6:
   Start empty opens Your build, "Next: Metal" with a smaller Back beside it,
   stages on top, Undo in the quick-question bubble. (Noticed, not changed: an
   empty build shows a $200 estimate, which is the service fee alone.)
2. ~~The own-site question~~ Decided Nov 17: on VVS Lab's own site the
   shopper sees VVS Lab and VVS Lab texts them (no partners yet). Deposit
   words: "$150 now, counted toward your grill. [Shop] confirms the rest."
3. ~~Pick the builder's structure~~ The build strip (v10), and the gold rings
   for progress confirmed. The unused sheet, expand, stages, steps, opening-B
   and start-questions code was deleted in v11.
4. ~~The AI paths~~ Decided on Nov 17 over eight slides and built in v11; the
   words confirmed on slides the same day. The owner then asked for the best
   start page "even if it means redesigning the start empty screen": v12 has
   three ways in and one-tap popular builds (v11 behind a switch).
   The owner wasn't set on v12 and gave the direction for v15 (built in the
   AI chat): the builds, OR one AI field with a camera inside it ("Describe
   your grillz or upload inspiration"), the same field that ends the AI
   conversation. **Waiting on:** the owner's verdict on v15 (choices listed in
   plan.md).
5. **The front door (v14, this chat):** v6's layout with words for both
   audiences, the two price cards, the 3D-to-studio-photo pair and the
   closing band from the live page (see plan.md, Nov 17). Pictures the page
   shows live in `creator-lab/src/assets/` and are inlined by `build.py`.
   Start free goes straight to sign-up and Sign in to sign-in (no trial preview).
   **Still needed from the owner:** delivery time, returns and warranty
   answers for the shoppers' questions; a studio photo remade from the new 3D.
6. **Later rounds:**
   - the shop's brand, and coming back to a design
   - building the approved builder into the real app
   - the jeweler's side
   - VVS Lab's brand and the 17 emails
   - the 3D follow-ups: posters, speed on real phones, studio photo prompts,
     the mouth open and close toggle
7. **Go-live** only when the owner says.

## Building and checking the Creator Lab

```bash
cd docs/redesign/creator-lab/src && python3 build.py
```

```bash
cd docs/redesign/creator-lab/test && node ctest.cjs 390 780 m v
```

`ctest.cjs` drives headless Chromium with Playwright and software WebGL (slow:
two to four minutes a run, and two runs at once starve each other, so run them
one after another). It saves screenshots to `test/shots/`. Plans: `v` (the
strip), `w` (Select teeth), `g` (after Done), `i` (the AI path). Copy the built
`src/creator.html` to `creator-lab/creator.html` before committing.

## Facts about the real app worth knowing

- The lead endpoint (`server/leads.ts`) requires a name of at least 2
  characters, an Instagram handle or US phone, and a Turnstile token. Fit and
  add-ons travel inside `spec`.
- The studio photo starts after the lead is saved, takes about 30 seconds, and
  is limited to 3 per visitor plus IP and budget limits (`server/render.ts`).
- The deposit is set per shop (`none`, `link` or `stripe`; a fixed amount or a
  percentage) and paid on the shop's own Stripe account. It is offered only
  after sending.
- There is no phone verification or texting in the app yet.
