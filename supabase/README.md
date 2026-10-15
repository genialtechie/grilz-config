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
