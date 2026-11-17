# After Done track

Owns `src/components/creator/after/*`. Builds the three owner-signed-off screens after the shopper presses
Done (source of truth: Creator Lab `docs/redesign/creator-lab/src/50-ui.js` `afterOne`/`afterCode`/`afterSent`,
the plan's Decisions table, HANDOFF "After Done: three screens").

## Done (Nov 17)

- `AfterFlow.tsx` with exactly `AfterFlowProps` from `../contract.ts`. It fills its parent (flex column,
  `height: 100%`): the builder puts it inside its panel. Title fixed on top, body scrolls under it, footer fixed.
  - **Your grill**: "Here are your grillz"; "[Shop] confirms the exact price after your fitting." and "What's in
    the price" (the shop's price lines, recomputed with the fitting, add-ons and promo, plus "About $X"); "How will
    they get the shape of your teeth?" (shop's fittings; no in-store on VVS Lab's own site); the shop's add-ons as
    switches only if it has any; "Where should [Shop] text you?" first name + phone and the consent line;
    "+ Add a note or promo code" (promo only when the shop has codes); Keep editing / Send to [Shop]; "Free.
    Nothing to pay yet." Errors sit under their own field (`aria-invalid`, `role="alert"`), the field scrolls
    into view and takes focus.
  - **The code**: "Enter the 6-digit code", "We texted it to (555) 012-3456. Wrong number? Change it", one
    real `autocomplete="one-time-code"` input under six boxes, WebOTP on Android, the 6th digit sends; "Send a
    new code in 0:30" then a button; Back. A phone from `rememberedPhone()` skips this screen ("Marcus · (555)
    012-3456, Verified on this device, so no code this time." + Change).
  - **Sent**: "Sent. [Shop] will text you." / "At (555) 012-3456."; the 3D still develops into the studio photo
    (`useAiRender` + `/api/render` with the lead id/token); "Start your order: $X now, counted toward your grill.
    [Shop] confirms the rest." with Not now / Pay $X deposit → Pay deposit + Save my photo → "Order started" +
    Save my photo; "While your photo develops": Your Instagram ("[Shop] sees it as you typed it", saved on blur),
    Follow @vvslab.ai (VVS Lab's site) or the shop's Instagram, Email me a copy + Send; What happens next 1–4.
- Sending: `submitLead()` with the design's spec (+ fitting, add-ons, their AI words as `vision`), `preview`, the
  verified phone as `contact`, and the new optional `phoneToken` (added to `LeadSubmission` in `src/lib/leads.ts`).
  Turnstile as today. Shop name from `useTenant()`; "VVS Lab" on slug `vvslab`.
- Deposit: demo simulates; `link` opens the shop's link; `stripe` opens `/api/deposit` in a new tab (same as the
  Configurator). Stripe returns to `/b/<slug>?deposit=paid`: that tab opens Sent with "Order started" (from a
  record saved at send, `sentRecord.ts`) and tells the first tab through `localStorage`, which flips too.
- Pure rules in `afterLogic.ts` (contact errors, phone format, code, which screen comes next, deposit words and
  footer, photo caption) with 19 tests in `__tests__/afterLogic.test.ts`.
- Dev page `/lab/after` (`src/lab/AfterLab.tsx`, dev builds only) with a sample design, a stand-in stage and
  panel, and a faked server. `?site=shop`, `?verified=1|0`, `?stage=0`, `?photo=<s>`, `?mock=0`.
- `eslint.config.js` now ignores `docs/redesign/creator-lab/src` (the lab's script fragments made `npm run lint`
  fail on the branch before this track).

## Decisions made here, and why (for the owner to confirm)

- **Where the photo develops.** In the lab it develops on the stage, in place of the 3D. The contract has no slot
  for it, so: if the builder marks an element over the free part of its stage with `data-after-photo`, AfterFlow
  portals the photo there; otherwise it sits at the top of Sent in the panel (`?stage=0` shows that).
- **"Start a new build"**: a quiet link at the bottom of Sent, so `onStartOver` has a home. Not in the lab.
- **Instagram saves on blur/Enter** (no button, as in the lab), with "Added. [Shop] sees it as you typed it."
  Email has a Send button, as asked.
- **"About $X"** as the last line of "What's in the price" (the lab listed lines only; the EST pill shows the
  total on the stage, but a changed fitting fee or promo moves it here first).
- **Save my photo** shares the file on phones (share sheet) and downloads on computers. If the photo can't be
  made, it saves the 3D still and the caption says "Your design, as sent".

## Left / needs other tracks

- **Backend**: check `phoneToken` on `POST /api/leads` and answer `code: "phone"` when it's missing or expired
  (AfterFlow then asks for a code again). Add `POST /api/lead-extra { leadId, token, instagram?, email? }`
  (`addToLead()` in `src/lib/leads.ts`): store the handle on the lead, and email the copy. Until then those two
  fields show the server's error.
- **Builder**: mount `<AfterFlow>` in the panel; when `isDepositReturn()` (from `after/sentRecord.ts`) is true on
  load, open it straight away with the saved design; optionally add the `data-after-photo` element on the stage.
- The studio photo is asked for with the 3D preview only; the Configurator also sends a photo-stage still and
  tooth labels (`capturePhotoStill`). If the builder can, a `photoStill` on `CreatorDesign` would match it.
- Their AI picture (`design.idea.picture`) goes to the photo as inspiration; leads have no field for it yet.
- Not checked on a real phone (one-time-code suggestion, WebOTP, share sheet).

## How to check

- `npm run dev`, open `/lab/after` (phone and desktop widths). Walk: empty send → name error, then phone error;
  fill; Send → code; type 6 digits → Sent; the photo develops (8 s here); Pay → Order started.
  `/lab/after?site=shop&verified=1` for a jeweler's builder with a remembered phone.
- `npm test -- src/components/creator/after`, `npm run build`, `npm run lint`.
- Screens: `docs/redesign/case-study/2026-11-17-app-after-done-phone.jpg` and `…-desktop.jpg`; the lab's own
  with `PW_CHROMIUM=/opt/pw-browsers/chromium node docs/redesign/creator-lab/test/ctest.cjs 390 844 m g`.

**Next**: once the builder mounts AfterFlow, walk it inside the real panel at 390×844 and 1440×900 against the
lab's g-plan shots, and wire the `?deposit=paid` return with the builder track.
