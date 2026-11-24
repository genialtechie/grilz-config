# Launch checklist: the new VVS Lab (from Nov 24)

The plan the owner approved: everything switches at once, **but nothing touches the live site until the owner
says "go live"**. Sign-up, the dashboard and the older emails launch as they are and get restyled right after.
Orders on VVS Lab's own site go to a partner jeweler.

Status key: [x] done · [ ] to do · (owner) = only the owner can do it.

## 1. Branch up to date with the live site
- [x] `main` merged into `redesign` (custom domains at "/", iced + opals). Build, lint, 397 tests pass.
- [ ] Iced + opals work in the new builder (launch-prep track, `launch-prep.md`).
- [ ] Dashboard shows "Phone verified"; request emails and summaries include charms and both lines of letters.
- [ ] Old share links and saved designs open in the new builder (test).
- [ ] The builder works inside shops' website embeds (`public/embed.js`).
- [ ] Custom domains open the shop's builder at "/".

## 2. Owner inputs
- [ ] (owner) Partner jeweler for orders on VVS Lab's own site: their prices (or keep today's demo prices) and
      which fittings they offer (mold kit by mail / own mold or scan / in store).
- [ ] (owner, can come after launch) Delivery time, returns, warranty answers for the shoppers' questions.

## 3. Services (owner, step by step)
**Firebase (phone codes; about $7 per 1,000 sign-ups).** Without it, sending a design fails on the live site.
1. console.firebase.google.com → Add project (e.g. "vvs-lab"). Analytics not needed.
2. Build → Authentication → Get started → Sign-in method → Phone → Enable.
3. Authentication → Settings → Authorized domains → add `vvslab.magpollo.com`, the Vercel preview domain, and
   each shop's custom domain.
4. Authentication → Settings → SMS region policy → Allow only → United States.
5. Project settings → General → Your apps → Add app → Web. Copy `apiKey`, `authDomain`, `projectId`, `appId`.
6. Project settings → Service accounts → Generate new private key (a JSON file). Keep it secret.

**Vercel → Project → Settings → Environment Variables** (Production and Preview):
| Name | Value |
|---|---|
| `VITE_FIREBASE_API_KEY` | `apiKey` from step 5 |
| `VITE_FIREBASE_AUTH_DOMAIN` | `authDomain` |
| `VITE_FIREBASE_PROJECT_ID` | `projectId` |
| `VITE_FIREBASE_APP_ID` | `appId` |
| `FIREBASE_SERVICE_ACCOUNT` | the whole JSON file from step 6, pasted as one value |
| `PHONE_HASH_SECRET` | any long random text (keeps phone numbers hashed when counting free AI builds) |
`OPENAI_API_KEY` is already set (studio photos). Optional: `OPENAI_DESCRIBE_MODEL`, `DESCRIBE_DAILY_LIMIT` (600).
Never set `ALLOW_DEV_PHONE` on Production (the server ignores it there anyway).

**Database (Supabase).** Nothing applies migrations automatically. In the Supabase dashboard → SQL editor, run
`supabase/migrations/20261117000001_phone_and_describe.sql`, then `supabase/tests/isolation.sql`. Safe to do
before launch: the live code ignores the new column and table.

**Vercel.** Confirm Settings → Git → Production Branch is `main`. Functions stay at 12 of 12 (nothing added).

## 4. Full test on the preview link (before "go live")
Vercel → Deployments → branch `redesign` → latest. On a real phone and a computer:
- [ ] Landing page `/`: words, moving strip, hero grill, questions, links (Sign in, Start free, Design your grillz).
- [ ] A shop link `/b/<shop>`, one custom-domain shop at "/", one website embed.
- [ ] Build: starting build, drag the panel, Select teeth + tap teeth, Undo, quick question, iced + opal,
      a charm (+ quote on Done), letters on both rows.
- [ ] Describe it with words, and with a picture; the closest-match note; the 3 free builds count.
- [ ] Done → Your grill → real text code → Sent → studio photo develops → deposit (a test shop in Stripe test
      mode) → "Order started".
- [ ] The shop gets the request email; the lead shows in the dashboard with "Phone verified".
- [ ] An old share link from the live site opens the same design.
- [ ] GitHub CI green on the latest `redesign` commit (checks + database job).

## 5. Go live (only when the owner says "go live")
1. Open a pull request `redesign` → `main`; CI must be green.
2. Owner merges it (or tells Claude to). Vercel deploys production from `main`.
3. Straight away: open vvslab.magpollo.com, two shop links, one custom domain, and send one real test design.
4. If anything is wrong: Vercel → Deployments → the previous production deployment → **Instant Rollback**, then
   revert the merge on GitHub so `main` matches (see `docs/runbooks/incident.md`). The old builder is still in
   the code (`src/components/Configurator.tsx`) if a quick switch-back of the builder alone is needed.

## 6. Right after launch
Restyle shop sign-up, the dashboard and sign-in, and the welcome / trial / win-back / announcement emails
(removing Karat), screen by screen with the owner as usual.
