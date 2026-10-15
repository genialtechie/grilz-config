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
