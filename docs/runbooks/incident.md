# Runbook: incidents

For anything a jeweler or customer would notice: builder not loading, designs
not arriving, photos failing, payments failing, a custom domain down.

Alerts that may have brought you here: **"VVS Lab is DOWN"** (the uptime
monitor in Supabase: two failed health checks in a row) and **"VVS Lab
alert: …"** (the daily spend and error check). See `HANDOFF.md` →
*Health and observability*.

## 1. Triage (5 minutes)

1. **Health:** `curl -s https://vvslab.magpollo.com/api/health`. 200 with
   `"ok":true` means the database answers, every live shop's config is valid
   and the AI, email and lead-token keys are set. A 503 names the failing check:

   | Check | Meaning | Go to |
   | --- | --- | --- |
   | `database` | Supabase unreachable from Vercel | §3 Database |
   | `shopConfigs` | A live shop's published config no longer parses | §3 Bad config |
   | `aiPhotos` / `email` / `leadTokens` | `FLUX_API_KEY` / `RESEND_API_KEY` / `LEAD_TOKEN_SECRET` missing in Vercel | Restore the env var, redeploy |

   Health doesn't cover Stripe, Black Forest Labs credits, email delivery or the
   daily cron, so a green health doesn't rule those out.
2. **Scope:** one shop or all? Try the demo `https://vvslab.magpollo.com/b/vvslab`
   (bundled, works without the database) and the affected `/b/<slug>`.
3. **Recent change?** Vercel → Deployments: was something deployed in the last
   hours? If the timing matches, **roll back first** (§2), investigate after.
4. **Severity:**
   - **SEV1:** builders down for everyone, or leads being lost.
   - **SEV2:** one shop down, photos or deposits failing, emails delayed.
   - **SEV3:** cosmetic or a workaround exists.

## 2. Mitigate

- **Bad deploy:** Vercel → Deployments → previous production deployment →
  **Instant Rollback**. Then revert the PR on GitHub so `main` matches.
- **Bad migration:** migrations are applied by hand (see `HANDOFF.md`). Write
  and apply the reverse SQL; never edit a migration that was already applied.
  If data was damaged, see `restore.md`.
- **One shop misbehaving:** `/admin` → shop → **Pause** (page shows "back
  soon"). Publishing the previous config version fixes a bad config.

## 3. Common failures

| Symptom | Likely cause | Fix |
| --- | --- | --- |
| Every `/b/<slug>` except the demo says "couldn't load" | **Database**: Supabase down or keys rotated | status.supabase.com; Supabase → project `grillz` → health. Check `SUPABASE_URL` / `SUPABASE_SERVICE_ROLE_KEY` in Vercel. |
| One shop "couldn't load" / 404 | **Bad config** or the shop isn't live | `/admin` → shop: status and live config version. Re-publish the last good version. |
| Studio photos "paused" | AI budget or credits | Vercel logs: `render paused:` gives the reason. `low credits` → top up Black Forest Labs. `daily budget reached` → wait for UTC midnight or raise `RENDER_DAILY_GENERATIONS`. `monthly allowance used` → that shop's plan allowance (raise `ai.monthlyGenerations` in `/admin` if agreed). `usage ledger unavailable` → database. |
| Shops not getting design emails | Resend | Vercel logs: `lead email failed`. resend.com → Logs. Leads are always saved: shops can see them in **Design requests**. |
| "Payments aren't available right now" | Stripe | status.stripe.com; Vercel logs `stripe`. Check `STRIPE_SECRET_KEY`. |
| Paid shop still paused / deposit not marked paid | Stripe webhooks | Stripe → Developers → Webhooks: both endpoints (`/api/stripe/webhook` and `?connect=1`) should show 2xx. Resend failed events from there; they apply once. |
| Expired trials not paused, old leads not deleted | Daily cron | Vercel → Crons → `/api/cron/retention` (04:17 UTC). 401 = `CRON_SECRET` mismatch. Logs show one `daily {…}` line per run. |
| "Signups are paused" / invites refused | Supabase public sign-up turned on | Turn it off (see `onboarding.md`). |
| Custom domain down | DNS changed on their side | The shop's **Share** tab → **Check now** shows the record that's wrong. |
| Lots of junk leads | Bot getting through | Check `TURNSTILE_SECRET_KEY` is set; per-IP and per-shop limits apply automatically. Pause the shop if needed. |

Logs: Vercel → project → Logs, filter by function (`api/leads`, `api/render`,
`api/stripe/webhook`, `api/cron/retention`, …). Useful searches are listed in
`HANDOFF.md` → *Health and observability*.

## 4. Communicate

- **SEV1/SEV2 affecting shops:** message affected jewelers directly (they know
  us personally): what's broken, that their leads are safe (they're stored
  even when email fails), and when we'll update next.
- When fixed: a short "all good" with what happened in one line.

## 5. Afterwards

Within two days, write a short note in Linear: timeline, cause, what we
changed, and one follow-up that makes it less likely (an alert, a test, a
guard). No blame; fix the system.
