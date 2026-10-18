# Runbook: restoring data

Use when data was lost or damaged (bad migration, a wrong delete, a compromised
key) and fixing forward isn't enough. Restoring is slow and rolls back
everything since the backup, so first ask whether a targeted fix would do.

## What can be restored

| Data | Where it lives | Backed up by |
| --- | --- | --- |
| Shops, configs, leads, team, billing state | Supabase Postgres (project `grillz`) | Supabase backups. Daily backups come with paid plans; point-in-time recovery (PITR) is an add-on. **Confirm the tier:** Supabase → project → Database → Backups. |
| 3D captures and studio photos (`lead-media`), logos (`tenant-assets`) | Supabase Storage | **Not** in database backups. Only what's still in the bucket. |
| Auth users | Supabase Auth (same database) | Database backups |
| Subscriptions, payments, deposits | Stripe | Stripe is the source of truth; webhooks rebuild our copy |
| Custom domains | Vercel project + `tenant_domains` | Re-add from the shop's Share tab |
| Code and migrations | GitHub | Git history |

## Choose the smallest restore

1. **A few rows wrong** (one shop's config, a lead's status): fix them directly
   in SQL, or re-publish an older config version from `/admin`. No restore.
2. **One table or one shop damaged:** restore a backup **into a new project**
   (Supabase → Database → Backups → restore to a new project, where your plan
   offers it), then copy the needed rows back with SQL. Production keeps running.
3. **Everything damaged:** restore production itself from a backup or PITR
   point. Everything written since that point is lost, including new leads, so:
   - Pause intake first: set every live shop to Paused in `/admin`, or roll
     Vercel back to a maintenance build.
   - Note the exact time of the damage; choose a PITR point just before it.

## Steps for a full production restore

1. Tell affected jewelers it's happening (see `incident.md` §4).
2. Supabase → project `grillz` → Database → Backups → pick the backup or PITR
   time → Restore. The project is unavailable during the restore.
3. After it finishes:
   - `curl -s https://vvslab.magpollo.com/api/health` → `ok: true`.
   - Migrations: `select version from supabase_migrations.schema_migrations order by version desc limit 3;`
     must match the latest file in `supabase/migrations/`. Re-apply any newer ones.
   - Stripe: Developers → Webhooks → resend events since the restore point, so
     subscription and deposit state catch up (each event applies once).
   - Spot-check two shops: `/b/<slug>` loads, `/dashboard` shows their leads.
4. Leads created between the restore point and the restore are gone from the
   database. Shops received an email for each of them; ask them to forward any
   they still need.
5. Write the incident note (`incident.md` §5).

## Drill (twice a year, and after any big schema change)

Restore the latest backup into a **new, temporary project**, never into
production, then:

- [ ] Row counts match production within the backup's age: `tenants`,
      `tenant_configs`, `leads`, `members`, `render_usage`.
- [ ] `supabase/tests/isolation.sql` passes against it.
- [ ] A shop's published config parses (open `/api/health` against a preview
      deployment pointed at the restored project, or run the check in SQL).
- [ ] Time taken, written down here with the date.
- [ ] Delete the temporary project.

| Date | Backup used | Time to restore | Result |
| --- | --- | --- | --- |
| _not yet run_ | | | |
