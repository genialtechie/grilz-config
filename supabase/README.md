# Database (Supabase)

- `migrations/` — schema, applied in filename order. Every tenant-owned table has
  `tenant_id` and row-level security; the anon role has no access.
- `tests/isolation.sql` — proves tenant A cannot read or change tenant B's data.
  Runs in a transaction and rolls back. Run it after every migration.
- Seed tenant zero and the test fixture: `npx tsx scripts/tenant-seed-sql.ts`
  prints idempotent SQL.

Server code uses `SUPABASE_URL` + `SUPABASE_SERVICE_ROLE_KEY` (never exposed to the
browser). The dashboard (Stage 4) uses `VITE_SUPABASE_URL` + `VITE_SUPABASE_ANON_KEY`
with a signed-in user, limited by the policies.

## Running the isolation test locally

CI runs this on every PR (the `database` job). To run it yourself (needs Docker):

```sh
npx supabase@2 start -x studio,realtime,imgproxy,mailpit,edge-runtime,logflare,vector,supavisor,postgres-meta
psql "postgresql://postgres:postgres@127.0.0.1:54322/postgres" -v ON_ERROR_STOP=1 -f supabase/tests/isolation.sql
npx supabase@2 stop --no-backup
```

It prints `isolation ok`, or fails naming the leak.

## Leads, emails and the admin (Stage 3)

**Flow.** `POST /api/leads` validates the design against the shop's catalog, recomputes the price from the shop's config, stores the lead (limits checked and insert done under one lock in `create_lead`), and stores a re-encoded 3D capture. The browser then calls `/api/render` with the lead's token (bound to the shop, valid 30 minutes). The shop's email goes once (`leads.notified_at` is claimed atomically): with the studio photo when it lands, or after 40 s without it, in which case the photo follows as a reply in the same thread. Each render reserves its generations first (`reserve_generations`), against the shop's monthly allowance and the global daily budget.

**Routing.** Paying shops email `config.leads.email`. Demo and test shops (`kind` = `demo` / `fixture`), and shops with no lead email yet, go to `PLATFORM_LEADS_EMAIL`. Test-shop subjects start with `[Test shop]`.

**Env (Vercel).**

| Name | Where | Purpose |
| --- | --- | --- |
| `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY` | prod, preview | Server database access |
| `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY` | all | Admin sign-in (RLS applies) |
| `RESEND_API_KEY` | prod, preview | Lead emails from `leads@vvslab.magpollo.com` |
| `PLATFORM_LEADS_EMAIL` | prod, preview | Demo/test leads and allowance warnings |
| `LEAD_TOKEN_SECRET` | prod, preview | Signs render tokens |
| `TURNSTILE_SECRET_KEY`, `VITE_TURNSTILE_SITE_KEY` | prod only | Turnstile can't cover `*.vercel.app` previews |
| `PUBLIC_ORIGIN` | prod, preview | Logo links in emails |

**Admin.** `/admin`, magic-link sign-in. Platform admins are granted by hand after the person has signed in once (Supabase gives magic-link accounts a random password hash, so an automatic invite can't tell the owner from someone who pre-registered the address):

```sql
insert into public.platform_admins (user_id)
select id from auth.users where email = 'name@magpollo.com' and email_confirmed_at is not null;
```
 Create a shop → set brand, catalog, prices, deposit, lead emails → **Preview** (`/b/<slug>?preview=<version>`, visible only to admins and the shop's members) → **Publish** → **Go live**.

**Integration tests.** `server/__tests__/pipeline.int.test.ts` runs the whole pipeline against a local Supabase with FLUX and Resend mocked. CI runs it in the `database` job; locally:

```sh
npx -y tsx@4.19.2 scripts/tenant-seed-sql.ts | psql "postgresql://postgres:postgres@127.0.0.1:54322/postgres" -q
INTEGRATION_SUPABASE_URL=http://127.0.0.1:54321 INTEGRATION_SERVICE_KEY=<local service key> npx vitest run server/__tests__/pipeline.int.test.ts
```

## Shop dashboard (Stage 4)

`/dashboard` is the jeweler's console: leads (search, notes, CSV), shop editor with a live preview, stats and team.

- **Accounts are invitation only.** Turn off public sign-up in Supabase (Authentication → Sign In / Providers → "Allow new users to sign up" off; keep the Email provider on). `POST /api/dashboard/invite` refuses to run while sign-up is on.
- Add `https://vvslab.magpollo.com/dashboard` to Authentication → URL Configuration → Redirect URLs.
- Invites are pending in `member_invites` until the invitee signs in with that email (`accept_member_invites()`); admins add a shop's first owner from the shop's Team tab in `/admin`.
- Members publish through `POST /api/dashboard/publish` (validated; AI allowance and footer kept from the live config). Drafts written by members are locked the same way by a trigger.
- Optional: `POSTHOG_PERSONAL_API_KEY` and `POSTHOG_PROJECT_ID` (prod) add builder views to the Stats tab.

## Embed and custom domains (Stage 6)

**Embed.** Shops paste `<script src="https://vvslab.magpollo.com/embed.js" data-shop="<slug>" async></script>` (or a `<div data-vvslab-shop="<slug>">` placeholder when the script must go in the head). Wide screens get the builder inline; phones get a button that opens it full screen. Leads carry `source.embed` (the website's hostname). `/admin` and `/dashboard` refuse to be framed.

**Custom domains.** Owners connect one domain per shop from Share → Your own domain. The server adds it to the Vercel project and shows the DNS record (CNAME `cname.vercel-dns.com` for a subdomain, A `76.76.21.21` for an apex, plus a TXT if Vercel asks for proof of ownership). It goes live once Vercel reports it verified and DNS points at us; then `/` on that host serves the shop (vercel.json rewrites `/` on any other host to `/api/shop-page?domain=1`). Unverified claims lapse after 48 hours.

Env (Vercel, prod): `VERCEL_DOMAINS_TOKEN` (a token for the team, used only to add, check and remove project domains), `VERCEL_PROJECT_ID=prj_YPlX7CGwCgGvHpAnypKUk7ndsFBv`, `VERCEL_TEAM_ID=team_yrOrLcapGc0sqZJVVW7Z0B1U`. Without them the Share tab says domains aren't switched on yet.
