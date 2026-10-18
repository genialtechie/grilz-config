# Runbook: onboarding a shop

Two ways a jeweler gets a builder. Self-serve is the default; use the admin
path for founding shops and shops we set up for them.

## A. Self-serve (`/signup`)

Nothing to do unless something goes wrong. What happens (`server/signup.ts`):

1. The jeweler enters shop name, email, link (`/b/<slug>`) and Instagram.
2. The shop is created as a **draft** on a **14-day trial** (card optional), with
   a 30-photo AI allowance and their email as the lead inbox. Config v1 is
   published straight away from the first template.
3. They get a **"Set up your VVS Lab builder"** email from `hello@` with a
   one-time link to `/dashboard/welcome`, which signs them in and opens their shop.
4. The dashboard's **Getting started** list walks them through logo, prices,
   lead email, publish and **Go live**.

### Check a new signup

- `/admin` lists the shop (status Draft, plan Trial).
- Their page `https://vvslab.magpollo.com/b/<slug>` says the builder will be
  back soon until they go live.

### When a jeweler says "I didn't get the email" / "the link doesn't work"

| Symptom | Cause | Fix |
| --- | --- | --- |
| No email | Spam folder, or Resend failed | Ask them to check spam. In Vercel logs (`api/signup`), look for Resend errors. They can always sign in at `/dashboard` with their email. |
| "That link has expired or was already used" | Links work once and expire in 24 hours; some mail apps open links to scan them | Tell them to enter their email on `/dashboard` for a fresh sign-in link. |
| "Signups are paused right now" | Public sign-up got switched **on** in Supabase Auth, so signup refuses to run | Supabase → Authentication → Sign In / Providers → turn **off** "Allow new users to sign up" (keep the Email provider on). |
| "Too many signups from here today" | 3 per IP / 2 per email per day | Create the shop for them with path B. |
| "That link is reserved" / "taken" | Reserved or used slug | Pick another slug. |

## B. Admin-created shop (`/admin`)

Use for founding shops (`plan = founding`, never trial-gated) or when we set a
shop up on someone's behalf. Needs a platform-admin account
(`supabase/README.md` explains the one-time SQL grant).

1. `/admin` → **New shop**: shop name, link, template, kind **Shop** (use
   **Test or demo shop** only for internal fixtures; their leads go to
   `PLATFORM_LEADS_EMAIL`, marked `[Test shop]`).
2. In the editor: logo (PNG/JPEG/WebP, under 2 MB), catalog, prices, deposit
   rule, lead email(s). **Save draft** → **Preview** (opens `/b/<slug>?preview=<v>`,
   visible only to admins and the shop's team) → **Publish**.
3. **Team** tab → invite the owner's email as **Owner**. They get a "join"
   email from `hello@`; the membership is created when they open it.
4. **Go live** when the owner has approved the preview.
5. Deposits by card: the owner connects Stripe from their dashboard (Shop tab →
   deposit section → Connect Stripe). Until then use **Shop's payment link** or
   no deposit.
6. Optional: custom domain from the shop's **Share** tab (DNS records shown
   there), and the embed snippet for their website.

## Hand-off message to the jeweler

> Your VVS Lab builder is live at https://vvslab.magpollo.com/b/<slug>. Design
> requests go to <lead email>. Sign in any time at
> https://vvslab.magpollo.com/dashboard with this email to see requests,
> change prices or add your team.

## Done when

- [ ] `/b/<slug>` loads the builder with their logo and prices.
- [ ] A test design sent from their page reaches their lead inbox (send one,
      then delete it from **Design requests**, or tell them it's a test).
- [ ] The owner has signed in to `/dashboard` at least once.
