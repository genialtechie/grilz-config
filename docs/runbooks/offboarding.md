# Runbook: offboarding a shop

Use when a jeweler leaves (they asked to close, or they stopped paying and
won't return). Takes about 5 minutes. Needs a platform-admin account.

## What offboarding does

Pressing **Offboard** in `/admin` runs `POST /api/dashboard/offboard`
(`server/offboard.ts`), which does three things on the server:

| Step | Effect |
| --- | --- |
| Close the page | `status = offboarded`. `/b/<slug>`, the custom domain and the embed show "This builder is closed". Leads, renders and card deposits stop. |
| End the plan | The Stripe subscription is set to **cancel at period end**: no further charges and no refund needed. A card trial ends at trial end without a charge. |
| Remove the custom domain | Removed from the Vercel project and from `tenant_domains`, so the jeweler can point it elsewhere. |

Each step can be re-run, so a retry finishes any step that failed. A browser
session can't set `offboarded` directly (a database trigger refuses it), so
these steps can't be skipped.

Left alone on purpose:

- **The shop's own Stripe account** (deposits). It belongs to the jeweler.
- **The team's access.** Members keep read access for 90 days to export leads
  (Design requests → CSV).
- **The tenant row and slug.** The link stays reserved forever so nobody can
  take it over.

90 days later the daily cron deletes the shop's leads, their 3D captures and
photos, and its logos.

## Steps

1. **Confirm the request** in writing (email or DM from the shop's owner), or
   confirm with VVS Lab that a non-paying shop is being closed.
2. Tell the owner to **export their leads** if they want them (they have 90
   days, but it's easier now).
3. In `/admin`, open the shop → **Offboard** → confirm.
4. Read the result message:
   - `… is offboarded. Page closed. Plan ends YYYY-MM-DD; no further charges. Custom domain removed.`: done.
   - Anything ending in `Run Offboard again to finish.`: press **Finish
     offboarding** (same place). If it keeps failing, see *Troubleshooting*.
5. **Check**:
   - `https://vvslab.magpollo.com/b/<slug>` shows "This builder is closed"
     (allow up to a minute for caches).
   - Stripe Dashboard → Customers → the shop → subscription shows "Cancels
     <date>".
   - If they had a custom domain: Vercel → project → Domains no longer lists it.
6. **Tell the owner**: the page is closed, the last charge was on their
   previous invoice, the plan ends on `<date>`, leads stay exportable until
   `<offboard date + 90 days>`, and their domain can be pointed elsewhere.

## Troubleshooting

| Message | Likely cause | Fix |
| --- | --- | --- |
| Couldn't cancel the plan in Stripe | Stripe outage, or `STRIPE_SECRET_KEY` missing/rotated | Check status.stripe.com and the Vercel env; press **Finish offboarding**. Or in the Stripe Dashboard, open the subscription → Cancel → "At end of billing period". |
| Couldn't remove the custom domain | Vercel API error, or `VERCEL_DOMAINS_TOKEN` expired | Fix the token; press **Finish offboarding**. Or remove it in Vercel → Domains, then press **Finish offboarding** to clear the database row. |
| Couldn't close the page | Database unreachable | Check `/api/health`; retry when `database` is `true`. |
| "Only VVS Lab can offboard a shop." | Signed in without platform admin | Use an admin account (`supabase/README.md` explains how to grant one). |

Logs: Vercel → Functions → `api/dashboard`, search `offboard`. Each run logs
one line: `offboard {"tenant":"…","ok":…,"steps":{…}}`.

## Undoing an offboard

Within 90 days (before leads are deleted):

1. In `/admin`, open the shop → **Go live** (or **Pause**). Admins can still
   move a shop out of `offboarded`.
2. The plan was only scheduled to cancel. If it hasn't ended yet, in Stripe
   open the subscription → **Don't cancel**; webhooks bring billing back in sync.
   If it already ended, the owner starts a new plan from the dashboard.
3. Reconnect the custom domain from the shop's Share tab (DNS has to be checked
   again).

After 90 days the leads and logos are gone and can only come back from a
database and storage backup (see the restore runbook).
