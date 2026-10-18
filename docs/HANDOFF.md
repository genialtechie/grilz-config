# VVS Lab: architecture handoff

VVS Lab is a 3D grillz builder that jewelers put on their own site. A customer
designs a set in 3D, sees the shop's price, gets an AI studio photo and sends
the design to the shop as a lead (optionally paying a deposit). Jewelers pay
$199/month and manage everything from a dashboard.

This document describes the system as the code stands after Stages 4–7a
(dashboard, Stripe billing and deposits, embed and custom domains, self-serve
signup with a 14-day trial). It is written from the code; where a comment or
another doc disagrees with the code, the code wins and the gap is listed under
[Known gaps](#known-gaps-and-risks).

Related docs: [`README.md`](../README.md) (render pipeline, analytics),
[`supabase/README.md`](../supabase/README.md) (database, admin, dashboard and
domain setup).

---

## System at a glance

```
              customers                           jewelers / VVS Lab admins
                  │                                         │
   vvslab.magpollo.com/b/<slug>                 /dashboard        /admin
   build.theirshop.com  (custom domain)            │                 │
   <script src=…/embed.js> on their site           │  Supabase Auth (magic link, PKCE)
                  │                                │  + RLS-scoped reads/writes
                  ▼                                ▼                 ▼
 ┌─────────────────────────────── Vercel ───────────────────────────────────┐
 │  Static SPA (Vite + React + three.js)                                    │
 │  Functions (api/*.ts → server/*.ts):                                     │
 │    tenant · shop-page · leads · render · deposit · signup · dashboard    │
 │    stripe/webhook · cron/retention · health                              │
 └──────┬──────────────┬─────────────┬──────────────┬──────────────┬────────┘
        │ service role │             │              │              │
        ▼              ▼             ▼              ▼              ▼
   Supabase       Black Forest    Stripe          Resend       Vercel API
   Postgres +     Labs (FLUX)     Billing +       (email)      (custom
   Storage +      studio photos   Connect                      domains)
   Auth
                 + Cloudflare Turnstile (bot check) · PostHog (analytics)
                 + Upstash Redis (optional render budget, no-DB fallback only)
```

- **One Vercel project** serves everything: the marketing site, the public
  builder, the dashboard, the admin and all API functions.
- **The browser never writes to the database anonymously.** Public endpoints
  run on the server with the Supabase service role and scope every query by
  `tenant_id` themselves. Signed-in jewelers and admins use the anon key plus
  their session, and row-level security (RLS) limits what they see.
- **Tenant zero (`vvslab`)** is the public demo. Its config is bundled with the
  app (`src/lib/tenant/vvslab.ts`), so the demo keeps working when the database
  is down.

## Hosts and routes

Routing lives in [`vercel.json`](../vercel.json) (rewrites, headers, cron) and
[`src/App.tsx`](../src/App.tsx) (client routes).

| Path | Served by | Notes |
| --- | --- | --- |
| `/` on `vvslab.magpollo.com` | SPA → `LandingPage` | Marketing page |
| `/` on any other host | `api/shop-page.ts?domain=1` | Custom domain: looks up the shop by host, injects `<meta name="vvs-shop">`, SPA renders that shop |
| `/b/<slug>` | `api/shop-page.ts?slug=` | Rewrites `index.html` head (title, OG image) per shop; SPA renders `ShopPage` |
| `/configurator` | SPA | Original demo configurator |
| `/signup`, `/privacy`, `/terms` | SPA | |
| `/dashboard/*` | SPA → `DashboardApp` | Jeweler console. `X-Frame-Options: DENY` |
| `/admin/*` | SPA → `AdminApp` | VVS Lab console. `X-Frame-Options: DENY` |
| `/embed.js` | static (`public/embed.js`) | CORS `*`, cached 5 min browser / 1 h edge |
| `GET /api/tenant/<slug>` | `api/tenant.ts` | Published config (public view). `?preview=<version>` + bearer token returns a draft to members/admins |
| `POST /api/leads` | `api/leads.ts` | Customer sends a design. `maxDuration` 60 s |
| `POST /api/render` | `api/render.ts` | AI studio photo. `maxDuration` 120 s |
| `POST /api/deposit` | `api/deposit.ts` | Stripe Checkout on the shop's own account. `GET ?lead=&t=` is the 30-day pay link in the customer email (redirects to Checkout) |
| `GET/POST /api/unsubscribe` | `api/email.ts` (rewrite) | Marketing unsubscribe: GET shows the confirm page, POST acts (page buttons, or one-click `List-Unsubscribe-Post`) |
| `POST /api/resend-webhook` | `api/email.ts` (rewrite) | Resend events (Svix-signed); complaints and hard bounces become opt-outs |
| `GET/POST /api/signup` | `api/signup.ts` | Slug availability / create a shop |
| `POST /api/dashboard/<action>` | `api/dashboard.ts` | Signed-in member actions (see below) |
| `POST /api/stripe/webhook[?connect=1]` | `api/stripe/webhook.ts` | Platform events / connected-account events |
| `GET /api/cron/retention` | `api/cron/retention.ts` | Daily at 04:17 UTC; requires `Authorization: Bearer $CRON_SECRET` |
| `GET /api/cron/marketing` | `api/cron/marketing.ts` | Daily at 14:07 UTC: the trial email sequence (`?dry=1` reports without sending); same auth |
| `GET /api/health` | `api/health.ts` | Uptime probe, never cached |

## Repository layout

```
api/            Vercel function entry points. Thin: parse the request, call server/, return JSON.
server/         All server logic, framework-free (also served by the Vite dev server).
  db.ts           Minimal PostgREST/Storage/Auth-admin client using the service role.
  tenants.ts      Published-config lookup, caches, custom-domain → slug, session price grace.
  leads.ts        Lead intake, lead tokens. notify.ts: exactly-once shop email.
  render.ts       FLUX pipeline. usage.ts: generation reservations and allowance warnings.
  billing.ts      Subscription checkout/portal, Connect onboarding, deposits, webhooks, daily enforcement.
  stripe.ts       Stripe REST v1/v2 client and webhook signature check.
  signup.ts       Self-serve signup. dashboard.ts: member actions. domains.ts: Vercel domains.
  retention.ts    Lead deletion (24 months, offboarded + 90 days, on request).
  health.ts, email.ts, emailTemplates.ts, spam.ts, preview.ts, shopPage.ts, tenantApi.ts
src/            React SPA.
  components/     Landing, Configurator (3D builder), ShopPage, signup, legal, three/ (R3F scene).
  dashboard/      Jeweler console (leads, shop editor, website/embed/domain, stats, team, Stripe).
  admin/          VVS Lab console; also hosts shared panels (LeadsPanel, ShopEditor) and data.ts.
  lib/            Shared by browser and server: tenant schema (zod), pricing, renderSpec, trial rules.
supabase/       migrations/ (applied in filename order), tests/isolation.sql, config.toml.
scripts/        tenant-seed-sql.ts, demo-shops.ts (print idempotent seed SQL), setup_posthog.py.
public/         Static assets, embed.js, watch.html, 3D model and HDR environment.
```

Code in `src/lib/` is imported by both the browser and `server/`, so pricing,
config validation and trial rules have exactly one implementation. Server
imports use `.js` extensions because Vercel runs the functions as Node ESM.

## Core flows

### 1. Loading a shop's builder

1. `/b/<slug>` hits `api/shop-page.ts`, which fetches the built `index.html`,
   rewrites its `<head>` for the shop (`server/shopPage.ts`) and returns it
   (404 + `noindex` for unknown slugs).
2. The SPA calls `GET /api/tenant/<slug>` (`server/tenantApi.ts`), which returns
   `publicTenant()`: the config with lead routes stripped.
3. `getPublishedTenant()` reads `tenants` + the published `tenant_configs` row,
   validates it with the zod schema and **treats a live shop whose no-card trial
   has ended as `paused`** at read time, so the trial gate is immediate rather
   than waiting for the nightly cron.
4. `ShopPage` renders the builder only when `status === 'live'`; `paused` shows
   "will be back soon", `offboarded` shows "this builder is closed".

### 2. Lead → studio photo → shop email

```
browser ──POST /api/leads──▶ validate design against shop catalog, recompute price & deposit
                             create_lead() RPC: rate limits + insert under one advisory lock
                             store re-encoded 3D capture → lead-media/<tenant>/<lead>/preview.jpg
                             ◀── { leadId, token (HMAC, 30 min), total, deposit }
        ──POST /api/render { leadId, token, image, spec, masks }──▶
                             checks: shop live, design valid, per-IP throttle, BFL credits,
                             reserve_generations() (shop monthly allowance + global daily budget)
                             FLUX.2 pro main render → up to 10 masked section edits → blend
                             upload photo → lead-media/<tenant>/<lead>/photo.jpg
                             notifyLead('photo')
   fallback timer (waitUntil, 40 s) ─────────────────▶ notifyLead('timeout')
```

- **Exactly-once email** (`server/notify.ts`): whichever path first sets
  `leads.notified_at` (conditional `UPDATE … WHERE notified_at IS NULL`) sends
  the shop's email. If the photo lands after the email, it follows as a reply in
  the same thread (`photo_notified_at`). The customer's confirmation only ever
  carries the AI photo, never the uploaded capture.
- **Recipients**: paying shops → `config.leads.email`; `demo`/`fixture` shops and
  shops with no lead email → `PLATFORM_LEADS_EMAIL`. Fixture subjects are tagged
  `[Test shop]`.
- **Price grace**: a customer who started before a new price list was published
  keeps the previous list for 6 hours (`configForSession`).
- Every email outcome is written to `lead_events` (`email_sent`,
  `email_failed`, `email_skipped`, `photo_sent`, `confirmation_*`).

### 3. Deposits (Stripe Connect)

1. Owner clicks **Connect Stripe** → `connect_onboard` creates a Stripe v2
   account (full dashboard; Stripe collects fees and holds loss liability;
   MCC 5944) and returns a Stripe-hosted onboarding link.
2. `connect_status` and the `account.updated` webhook keep
   `tenants.stripe_charges_enabled` in sync.
3. A shop can publish `deposit.mode = 'stripe'` only once charges are enabled
   (`lockPlanFields`).
4. After sending a design, the customer calls `POST /api/deposit { leadId, token }`;
   the server creates a Checkout session **on the shop's account**
   (`Stripe-Account` header) for the exact deposit stored on the lead.
5. `checkout.session.completed` arrives on the Connect webhook; the server checks
   the event's `account` matches the lead's shop, sets `deposit_paid_at`, moves
   the lead to `deposit_paid` and logs a `deposit_paid` event.

Money for deposits never touches the VVS Lab Stripe account.

### 4. Signup → trial → plan

1. `/signup` → `POST /api/signup` (`server/signup.ts`): validates name/email/slug,
   Turnstile, honeypot + minimum form time, per-IP/per-email/global daily
   limits, reserved slugs. **Refuses to run unless Supabase Auth has public
   sign-up disabled** (accounts are only created by the server).
2. Creates the tenant as `status=draft, plan=trial, created_via=signup`,
   `trial_ends_at = now + 14 days` (`TRIAL_DAYS`), publishes config v1 from the
   first template with a 30-generation AI allowance, records an owner invite and
   emails a one-time sign-in link.
3. The owner signs in at `/dashboard`; `accept_member_invites()` turns the
   invite into a membership. They edit, publish and **Go live** themselves.
4. The card is optional during the trial. The dashboard prompts for it on a
   schedule that gets more insistent near the end (`src/lib/trial.ts`).
5. **Start plan** → `billing_checkout`: Stripe Checkout (subscription,
   `STRIPE_PRICE_ID`). Remaining trial days carry over when more than 48 h are
   left; otherwise billing starts immediately. **Manage billing** →
   `billing_portal`.
6. **Day 14 without a plan**: the public page is served as paused at once,
   `go_live` returns 402, the dashboard is locked to "Start your plan" /
   "Download your data", and the nightly cron persists `status=paused`.

### 5. Dashboard actions (`POST /api/dashboard/<action>`)

Every action resolves the caller from their Supabase access token and their
role for the shop (`platform_admins` → `admin`, else `members.role`).

| Action | Who | What |
| --- | --- | --- |
| `publish` | owner, admin | Validates the draft; for owners, resets plan-controlled fields (`ai.monthlyGenerations`, `brand.poweredBy`) to the live values; calls `publish_config_service` |
| `invite` | owner, admin | Creates/finds the account, records `member_invites`, emails a sign-in link. Same answer for every outcome (no account enumeration) |
| `stats` | any member | Builder views from PostHog HogQL (if configured) |
| `go_live` / `pause` | owner, admin | `go_live` needs a published version and an unexpired trial |
| `lead_delete` | owner, admin | Deletes one lead, its events and its files (customer request) |
| `domain`, `domain_check` | any member | Read / re-check custom domain state |
| `domain_add`, `domain_remove` | owner, admin | Adds/removes the domain on the Vercel project |
| `billing_checkout`, `billing_portal`, `connect_onboard` | owner, admin | Stripe |
| `connect_status` | any member | Refreshes `stripe_charges_enabled` |
| `offboard` | admin | Closes the page, sets the plan to cancel at period end, removes the custom domain. Safe to re-run (`server/offboard.ts`) |

Billing and Connect actions other than `connect_status` answer 409 for an
offboarded shop.

Everything else goes straight to Supabase from the browser under RLS: any
member reads leads, changes lead status, adds notes and edits drafts; owners
also change team roles, revoke invites and upload the logo.

### 6. Embed and custom domains

- **Embed**: shops paste `<script src="https://vvslab.magpollo.com/embed.js"
  data-shop="<slug>" async>` (or a `<div data-vvslab-shop>` placeholder).
  Inline iframe on wide screens, full-screen button on phones. Leads record the
  embedding site's hostname in `source.embed`.
- **Custom domain**: one per shop. `domain_add` registers it on the Vercel
  project (`VERCEL_DOMAINS_TOKEN`) and stores a `pending` row in
  `tenant_domains` with the DNS records to show (CNAME `cname.vercel-dns.com`
  for subdomains, A `76.76.21.21` for apex, plus TXT when Vercel wants proof).
  `domain_check` marks it `active` once Vercel reports it verified and DNS is
  not misconfigured. Pending claims older than 48 h can be taken over. Our own
  and shared-hosting domains (`magpollo.com`, `vercel.app`, …) are blocked.

### 7. Daily cron (`/api/cron/retention`, 04:17 UTC)

1. **Retention** (`server/retention.ts`): `expired_leads()` returns leads older
   than 24 months and every lead of a shop offboarded more than 90 days ago.
   Files are deleted first, then rows, in batches (max 20 × 500 per run).
   Then the logos (`tenant-assets/<tenant id>/`) of shops offboarded more than
   90 days ago, up to 50 shops a run, each marked once its folder is empty
   (`assets_purged_at`, cleared if the shop comes back).
   `?dry=1` reports what would be deleted.
2. **Billing enforcement** (`enforceBilling`): pauses live shops whose trial
   ended with no plan, and shops `past_due` for more than 7 days
   (`GRACE_DAYS`).
3. **Spend and error alerts** (`server/alerts.ts`): emails `ALERT_EMAIL` (or
   `PLATFORM_LEADS_EMAIL`) only when Black Forest Labs credits are low, the
   last 24 hours used 80% of the daily AI budget, photos were refused or
   failed, or emails to shops failed.

The run logs one `daily {…}` JSON line with counts.

## Data model

All tables are in `public`, all have RLS enabled, and the `anon` role has no
grants. Migrations in `supabase/migrations/` are the source of truth.

| Table | Purpose | Key columns |
| --- | --- | --- |
| `tenants` | One row per shop. Never deleted, so a slug can't be reused | `slug`, `kind` (demo/shop/fixture), `status` (draft/live/paused/offboarded), `plan` (founding/trial/paid/canceled), `published_version`, `trial_ends_at`, `created_via`, `offboarded_at`, `assets_purged_at`, `stripe_customer_id`, `stripe_subscription_id`, `billing_status` (none/trialing/active/past_due/canceled), `current_period_end`, `past_due_since`, `stripe_account_id`, `stripe_charges_enabled` |
| `tenant_configs` | Versioned shop config (jsonb, validated by `src/lib/tenant/schema.ts`) | `version`, `status` (draft/published/archived), `published_at` |
| `members` | User ↔ shop, role owner/staff | trigger `keep_an_owner` |
| `member_invites` | Append-only invite log (also the invite rate limit) | `accepted_at`, `revoked_at`; valid 7 days |
| `platform_admins` | VVS Lab staff. Granted by hand with SQL (see `supabase/README.md`) | |
| `leads` | Customer designs | `spec`, `price`, `total`, `deposit`, `config_version`, `status` (new/contacted/deposit_paid/won/lost), `render_status`, `notified_at`, `photo_notified_at`, `preview_path`, `photo_path`, `source`, `ip_hash`, `deposit_paid_at` |
| `lead_events` | Lead history (status, notes, email outcomes, deposits) | |
| `render_usage` | AI generation ledger: per-shop monthly allowance and global daily budget | `generations`, `outcome` (pending/ok/paused/failed) |
| `tenant_domains` | Custom domain per shop (server-written only) | `status` (pending/active), `verification` |
| `signup_attempts` | Signup rate-limit log (hashed IP) | |
| `stripe_events` | Processed webhook event ids (dedupe) | |
| `email_unsubscribes` | Marketing opt-outs per address and topic (`all`, `tips`, `news`) | `source` (link/one_click/complaint/bounce/admin) |
| `email_sends` | Every marketing send, once | `dedupe_key` (unique), `kind`, `topic`, `status` (sending/sent/skipped/failed), `resend_id` |

**Storage buckets**: `tenant-assets` (public; logos; png/jpeg/webp, 2 MB; owners
write under `<tenant id>/`) and `lead-media` (private; 5 MB; members read
`<tenant id>/<lead id>/preview.jpg|photo.jpg`).

**Key database functions** (all `security definer`, fixed `search_path`):

| Function | Caller | Purpose |
| --- | --- | --- |
| `create_lead` | service role | Rate limits + insert under an advisory lock |
| `reserve_generations` | service role | Atomic AI budget reservation (global lock) |
| `month_generations` / `day_generations` | service role | Allowance month is US Eastern; daily budget day is the DB day (UTC) |
| `publish_config_service` | service role | Publish a validated config |
| `publish_config` | admins (browser) | Admin publish |
| `set_tenant_status` | admins (browser) | Status changes; refuses `live` without a published version. Can't set `offboarded` (trigger `offboard_on_server_only`) |
| `accept_member_invites` | signed-in user | Turns pending invites for their confirmed email into memberships |
| `shop_team`, `shop_stats` | members | Team list with emails; lead-based stats (`shop_stats` is security invoker) |
| `expired_leads` | service role | Retention queue |

Triggers worth knowing: `lock_member_draft` (members can't change plan fields
even in drafts), `log_lead_status` (status changes become events),
`stamp_offboarded` (sets/clears `offboarded_at`), `keep_an_owner`,
`offboard_on_server_only` (signed-in sessions can't set `offboarded`).

`supabase/tests/isolation.sql` proves tenant A can't read or change tenant B's
data. CI runs it on every PR.

## Shop lifecycle

```
          signup / admin create
                   │
                   ▼
   ┌────────────  draft  ────────────┐
   │      owner go_live (needs a     │
   │      published version and an   │
   │      unexpired trial)           │
   ▼                                 │
  live ◀──────────────────────────▶ paused
   │  owner pause / go_live           ▲
   │  cron: trial over, or past_due   │
   │        > 7 days ─────────────────┤
   │  webhook: subscription canceled ─┘
   │  webhook: active/trialing again ─▶ back to live (if paused for billing)
   │
   └── admin only (Offboard → POST /api/dashboard/offboard) ──▶ offboarded
         page closed; plan cancels at period end; custom domain removed;
         team keeps read access to export leads for 90 days; then the cron
         deletes the leads and logos. Tenant row and slug stay reserved.
         A browser session can't set 'offboarded' directly (DB trigger).
         Runbook: docs/runbooks/offboarding.md
```

`plan` and `billing_status` are kept in sync by the subscription webhooks:
`active`/`trialing`/`past_due` → `plan=paid`; a canceled paid plan →
`plan=canceled`. Shops created by an admin before signup existed are on
`plan=founding` (the column default) and are outside the trial gate; they
can still start a subscription like any other shop.

## Limits and abuse controls

| Area | Control | Value | Where |
| --- | --- | --- | --- |
| Leads | per IP per shop / per shop / per customer email | 5 per hour / 150 per day / 3 per day | `server/spam.ts` `LIMITS`, enforced in `create_lead` |
| Leads, signup | honeypot + minimum form time | 4 s | `looksAutomated` |
| Leads, signup | Cloudflare Turnstile | Fails closed on a bad token; passes if not configured or Cloudflare is unreachable | `verifyTurnstile` |
| Lead → render/deposit | HMAC lead token bound to shop + lead | 30 min | `server/leads.ts` |
| Render | per-IP throttle (per instance, memory) | 6 per 10 min | `server/render.ts` |
| Render | client cap | 3 per visitor | builder |
| Render | BFL balance check before rendering | ≥ 7 credits per generation | `server/render.ts` |
| Render | shop monthly allowance | config `ai.monthlyGenerations` (plan default 300, trial 30); email to `PLATFORM_LEADS_EMAIL` at 80% | `reserve_generations` |
| Render | global daily budget | `RENDER_DAILY_GENERATIONS` (default 45, about $3) | `reserve_generations` |
| Render | ledger unavailable | fail closed ("paused") | `server/render.ts` |
| Signup | per IP / per email / global | 3 / 2 / 60 per day | `SIGNUP_LIMITS` |
| Invites | per shop / per email | 20 / 3 per day | `server/dashboard.ts` |
| Stripe webhooks | signature + 5 min replay window; event id dedupe | | `server/stripe.ts`, `stripe_events` |
| Cron | bearer `CRON_SECRET` | | `api/cron/retention.ts` |

When the render is refused for budget/credits, the API answers `code: "paused"`
and the builder falls back to the 3D preview with a friendly note. Leads are
never lost because of the render.

## Caching

| What | TTL | Effect |
| --- | --- | --- |
| `getPublishedTenant` (per function instance) | 20 s | |
| `GET /api/tenant/<slug>` (edge) | `s-maxage=30, stale-while-revalidate=10` | A publish shows up within about a minute |
| `/b/<slug>` HTML (edge) | `s-maxage=300, swr=600` | Link-preview metadata can lag up to ~15 min |
| Custom-domain HTML (edge) | `s-maxage=60, swr=300` | A newly verified domain can serve the plain app for a minute or two |
| Host → slug (per instance) | 60 s found / 10 s not found | |
| BFL credit balance (per instance) | 60 s | |
| `embed.js` | browser 5 min, edge 1 h | |

## Environment variables

Names only; values live in Vercel project settings (and `.env.local` for
development). Never prefix a secret with `VITE_`: anything with that prefix
ships to the browser.

**Server (Vercel functions)**

| Name | Required | Used for | Without it |
| --- | --- | --- | --- |
| `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY` | yes | All server DB/Storage/Auth-admin access | Only tenant zero works; most APIs 503 |
| `LEAD_TOKEN_SECRET` | yes | Signs lead tokens; salts IP hashes | Falls back to the service-role key; `/api/health` reports 503 |
| `FLUX_API_KEY` | yes | Black Forest Labs renders | No studio photos; `/api/health` reports 503 |
| `RESEND_API_KEY` | yes | All email | Emails skipped (logged as `email_skipped`); `/api/health` reports 503 |
| `PLATFORM_LEADS_EMAIL` | yes | Demo/test leads, allowance warnings | Those emails have no recipient |
| `PUBLIC_ORIGIN` | recommended | Links in emails and Stripe return URLs | Defaults to `https://vvslab.magpollo.com` |
| `EMAIL_FROM_DOMAIN` | optional | Sender domain (`leads@…`) | Defaults to `vvslab.magpollo.com` |
| `EMAIL_MARKETING_FROM_DOMAIN` | for marketing | Marketing sender (`hello@news.vvslab.magpollo.com`) | Marketing mail isn't sent (`not_configured`) |
| `MARKETING_REPLY_TO` | optional | Reply-to on marketing mail (the trial founder letter invites replies) | Falls back to `PLATFORM_LEADS_EMAIL` |
| `RESEND_WEBHOOK_SECRET` | for marketing | Verifies `/api/resend-webhook` (Resend → Webhooks → signing secret) | Webhook answers 400: complaints and bounces aren't suppressed |
| `TURNSTILE_SECRET_KEY` | prod | Bot check on leads and signup | Check is skipped |
| `CRON_SECRET` | yes | Authenticates Vercel Cron | Cron returns 401: retention and billing enforcement stop |
| `STRIPE_SECRET_KEY` | yes | All Stripe calls | Billing and deposits 503 |
| `STRIPE_PRICE_ID` | yes | The $199/mo price | "Billing isn't switched on yet" |
| `STRIPE_WEBHOOK_SECRET` | yes | Platform webhook (`/api/stripe/webhook`) | Subscription state stops syncing |
| `STRIPE_CONNECT_WEBHOOK_SECRET` | yes | Connect webhook (`?connect=1`) | Deposits never marked paid |
| `VERCEL_DOMAINS_TOKEN`, `VERCEL_PROJECT_ID`, `VERCEL_TEAM_ID` | for domains | Custom domains | "Domains aren't switched on yet" |
| `RENDER_DAILY_GENERATIONS` | optional | Global daily AI budget | Default 45 |
| `ALERT_EMAIL`, `ALERT_LOW_CREDITS` | optional | Where daily spend/error alerts go (falls back to `PLATFORM_LEADS_EMAIL`); credit level that triggers a warning (default 1000 ≈ $10) | No alert email |
| `POSTHOG_PERSONAL_API_KEY`, `POSTHOG_PROJECT_ID`, `POSTHOG_HOST` | optional | Dashboard Stats tab | Stats shows lead numbers only |
| `UPSTASH_REDIS_REST_URL`, `UPSTASH_REDIS_REST_TOKEN` | optional | Daily render budget only when there is no database (local dev) | Per-instance counting |

**Browser (`VITE_*`, public by design)**: `VITE_SUPABASE_URL`,
`VITE_SUPABASE_ANON_KEY`, `VITE_TURNSTILE_SITE_KEY`,
`VITE_POSTHOG_PROJECT_TOKEN`, `VITE_POSTHOG_HOST`.

**Tests only**: `INTEGRATION_SUPABASE_URL`, `INTEGRATION_SERVICE_KEY`,
`INTEGRATION_ANON_KEY`, `INTEGRATION_STRIPE_KEY` (must be `sk_test_…`),
`INTEGRATION_STRIPE_PRICE`, `RESEND_BASE_URL` (points email at a mock).

**Supabase dashboard settings the code depends on**: Authentication → "Allow
new users to sign up" **off** (signup and invites refuse to run otherwise);
`https://vvslab.magpollo.com/dashboard` in the redirect URL allow-list.

**Stripe settings**: two webhook endpoints. Platform:
`/api/stripe/webhook` with `customer.subscription.created|updated|deleted`.
Connect ("events on connected accounts"): `/api/stripe/webhook?connect=1` with
`checkout.session.completed`, `checkout.session.async_payment_succeeded`,
`account.updated`. The customer portal must be enabled. API versions are pinned
in `server/stripe.ts` (v1 `2025-03-31.basil`, v2 for Connect accounts).

## External services

| Service | Used for | Failure mode for customers |
| --- | --- | --- |
| Supabase (Postgres 17, Auth, Storage) | Everything stateful | Shop pages for real tenants show "couldn't load" (demo still works); leads, dashboard, signup down |
| Vercel | Hosting, functions, cron, edge cache, domains API | Full outage |
| Black Forest Labs | FLUX.2 pro render + `flux-pro-1.0-fill` edits | Render answers "paused"; leads still go through with the 3D capture |
| Resend | Lead, confirmation, invite, signup emails (`vvslab.magpollo.com`); marketing (`news.vvslab.magpollo.com`, a separate domain so complaints can't hurt lead mail) | Leads saved; shop not emailed (`email_failed` events). One retry on 429/5xx |
| Stripe | Subscriptions, Connect deposits | Checkout/portal/deposit 502; webhooks retried by Stripe |
| Cloudflare Turnstile | Bot check | Fails open if unreachable |
| PostHog | Funnel analytics, dashboard stats | Stats shows lead numbers only |

## Health and observability

`GET /api/health` (`server/health.ts`) returns
`{ ok, checks: { database, shopConfigs, aiPhotos, email, leadTokens }, at }`
with **200** when all checks pass and **503** otherwise:

- `database`: the live-tenant query succeeds.
- `shopConfigs`: every live shop's published config parses.
- `aiPhotos`, `email`, `leadTokens`: the corresponding env var is set. They
  check configuration only, not whether the provider is reachable.

It does not check Stripe, BFL credits, Resend reachability, the cron or the
Supabase sign-up setting. It is public and returns no counts or customer data.

**Uptime** is watched from outside Vercel: a `pg_cron` job in Supabase asks
`/api/health` every 5 minutes through `pg_net` (migration
`20261019000002_uptime.sql`). Two failures in a row email an alert, it
repeats hourly while down, and a recovery email follows. The Resend key and
recipient live in Supabase Vault (`uptime_resend_api_key`,
`uptime_alert_email`); checks and alerts are recorded in `uptime_checks` and
`uptime_alerts`. It can't report a Supabase outage, since it runs there.

**Load test:** `npx tsx scripts/load-test.ts --origin <url> --users 50 --seconds 60`
runs 50 virtual customers over the public read paths and fails on >1% errors
or a p95 over 1.5 s.

Logging is `console.error`/`console.log` into Vercel function logs. Useful
grep targets: `lead failed`, `lead email failed`, `lead daily cap reached`,
`render paused:`, `reservation failed`, `stripe`, `tenant lookup failed`,
`signup refused`, `invite refused`, `daily {` (cron summary). There is no error
tracker (Sentry) yet.

## CI and tests

[`.github/workflows/ci.yml`](../.github/workflows/ci.yml) runs on every PR and
on pushes to `main`:

- **check**: `eslint`, `tsc -p tsconfig.app.json`,
  `tsc -p tsconfig.vercel-check.json` (Node ESM check of `api/*.ts`),
  `vitest run`, `vite build`.
- **database**: starts a local Supabase, applies all migrations, runs
  `supabase/tests/isolation.sql`, seeds fixtures, then runs the
  pipeline, dashboard and signup integration tests (FLUX and Resend mocked).

Unit tests: `server/__tests__/*.test.ts`, `src/lib/__tests__/` (golden pricing
and prompt tests over 20 designs; regenerate `fixtures/golden.json` only for an
intended price or prompt change).

## Local development

```sh
npm install
cp .env.example .env.local   # then fill in what you need (see the table above)
npm run dev                  # Vite serves the SPA and /api/{tenant,dashboard,signup,deposit,leads,render}
```

The Vite dev server (`vite.config.ts`) mounts the same `server/` handlers.
`/api/stripe/webhook`, `/api/cron/retention`, `/api/shop-page` and
`/api/health` are not served locally; call the handler functions from a test
or use `vercel dev`. For a local database, see
[`supabase/README.md`](../supabase/README.md).

Deploys: the env setup in `supabase/README.md` assumes Vercel's Git
integration (a preview deployment per PR, production from `main`); confirm in
the Vercel project. Nothing in CI or Vercel applies database migrations: apply
them to production by hand, in filename order, then run
`supabase/tests/isolation.sql`.

## Known gaps and risks

- **Vercel function limit.** The project is on Vercel's Hobby plan, which caps a
  deployment at **12 serverless functions** (every file under `api/` is one) and
  is meant for non-commercial use. It's at 12. A 13th fails the production
  deploy (`exceeded_serverless_functions_per_deployment`) while the previous
  build keeps serving. Add routes to an existing function behind a rewrite
  (as `/api/dashboard/:action` and `/api/email` do), or move to Pro.

Verified in the code at the time of writing. Items 2–3 should shape the
remaining Stage 7b runbooks.

1. ~~**Offboarding is partly manual.**~~ Fixed: offboarding runs on the server
   (plan cancels at period end, domain removed, logos purged with the leads).
   See [`runbooks/offboarding.md`](runbooks/offboarding.md).
2. **The restore procedure is documented but not yet drilled**
   ([`runbooks/restore.md`](runbooks/restore.md)), and nothing in the repo
   shows which Supabase backup tier is enabled. Storage objects (`lead-media`,
   `tenant-assets`) are not part of Postgres backups.
3. ~~**No alerting.**~~ Uptime is watched from Supabase (`pg_cron`), and the
   daily cron sends spend and error alerts. Still missing: an error tracker
   (Sentry), and an alert if the daily cron itself stops running.
4. `.env.example` is out of date: it lists `RENDER_DAILY_CAP`, but the code
   reads `RENDER_DAILY_GENERATIONS`; most server variables are missing.
5. The comment at the top of `20261018000004_signup.sql` says the trial is
   7 days; the code uses 14 (`TRIAL_DAYS` in `src/lib/trial.ts`).
6. `tsconfig.vercel-check.json` includes only `api/*.ts`, so the nested entry
   points `api/stripe/webhook.ts` and `api/cron/retention.ts` are not type-checked
   in CI (Vercel still type-checks them at deploy).
7. `server/__tests__/billing.int.test.ts` is skipped in CI (it needs a Stripe
   test key), so billing and deposits have no automated end-to-end coverage.
8. Webhook dedupe is check-then-insert on `stripe_events`, not atomic. Two
   simultaneous deliveries of one event could both apply. The updates are
   idempotent, but a `deposit_paid` lead event could be recorded twice.
9. Several protections are per function instance (render per-IP throttle,
   tenant and host caches, BFL credit cache). They slow abuse rather than cap it;
   the database-backed limits (`create_lead`, `reserve_generations`) are the
   real caps.
10. If `LEAD_TOKEN_SECRET` is unset, lead tokens and IP hashes fall back to the
    service-role key. Rotating it invalidates in-flight lead tokens (30 min) and
    resets IP-based rate-limit history.
11. `VITE_PLAN_PAYMENT_LINK` is declared in `src/vite-env.d.ts` but not used.

## Stage 7b

- Runbooks: [`runbooks/`](runbooks/) (onboarding, offboarding, incident, restore).
- Uptime monitor and daily spend/error alerts (see *Health and observability*).
- Load-test script (`scripts/load-test.ts`); results of production runs are
  recorded in Linear (MAG-75).
- Still open: the backup and restore drill (gap 2) and Sentry.
