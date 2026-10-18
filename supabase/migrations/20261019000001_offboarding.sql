-- Offboarding runs on the server (POST /api/dashboard/offboard): it closes the
-- page, sets the Stripe subscription to cancel at period end and removes the
-- custom domain. A browser session (even an admin's) can't set 'offboarded'
-- directly, so none of those steps can be skipped. The service role and direct
-- SQL are unaffected.

create function public.offboard_on_server_only() returns trigger
language plpgsql set search_path = public as $$
begin
  if new.status = 'offboarded' and old.status is distinct from 'offboarded'
     and coalesce(auth.jwt() ->> 'role', '') = 'authenticated' then
    raise exception 'offboard a shop with the Offboard button (server), not a direct status change';
  end if;
  return new;
end $$;
create trigger tenants_offboard_on_server_only before update of status on public.tenants
  for each row execute function public.offboard_on_server_only();

-- The daily cron deletes an offboarded shop's logos (tenant-assets/<tenant id>/)
-- with its leads, 90 days after offboarding; this marks it done.
alter table public.tenants add column assets_purged_at timestamptz;

-- A shop brought back from offboarding starts fresh: if it's offboarded again,
-- its new logos are purged too.
create or replace function public.stamp_offboarded() returns trigger
language plpgsql as $$
begin
  if new.status = 'offboarded' and old.status is distinct from 'offboarded' then new.offboarded_at := now(); end if;
  if new.status <> 'offboarded' then
    new.offboarded_at := null;
    new.assets_purged_at := null;
  end if;
  return new;
end $$;
