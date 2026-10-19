-- Promo codes a shop gives its customers (MAG-88). Kept out of the shop's
-- public config: the builder checks one code through /api/promo (service
-- role) and only ever sees that code's terms. A use is counted when a design
-- request is sent, atomically, so a capped code can't be over-used.

create table public.promo_codes (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants (id) on delete cascade,
  code text not null check (code ~ '^[A-Z0-9][A-Z0-9-]{1,22}[A-Z0-9]$'),
  kind text not null check (kind in ('percent', 'amount')),
  value numeric(10, 2) not null check (value > 0 and (kind = 'amount' or value <= 90) and value <= 100000),
  min_order numeric(10, 2) not null default 0 check (min_order >= 0 and min_order <= 1000000),
  expires_at timestamptz,
  max_uses integer check (max_uses is null or max_uses between 1 and 100000),
  uses integer not null default 0 check (uses >= 0),
  active boolean not null default true,
  created_at timestamptz not null default now(),
  unique (tenant_id, code)
);

alter table public.promo_codes enable row level security;

-- The shop's team sees its codes; owners add, pause and change them.
create policy promo_codes_read on public.promo_codes for select to authenticated
  using (public.is_member(tenant_id) or public.is_platform_admin());
create policy promo_codes_insert on public.promo_codes for insert to authenticated
  with check ((public.is_owner(tenant_id) or public.is_platform_admin()) and uses = 0);
create policy promo_codes_update on public.promo_codes for update to authenticated
  using (public.is_owner(tenant_id) or public.is_platform_admin())
  with check (public.is_owner(tenant_id) or public.is_platform_admin());
-- A code that was used stays (pause it instead), so leads keep making sense.
create policy promo_codes_delete on public.promo_codes for delete to authenticated
  using ((public.is_owner(tenant_id) or public.is_platform_admin()) and uses = 0);

-- Use counts are the server's alone; a code's text and terms are fixed once made.
revoke all on public.promo_codes from anon, authenticated;
grant select, delete on public.promo_codes to authenticated;
grant insert (tenant_id, code, kind, value, min_order, expires_at, max_uses) on public.promo_codes to authenticated;
grant update (active, expires_at, max_uses) on public.promo_codes to authenticated;

-- Code checks from the builder, to slow down anyone guessing codes. Server only; kept a day.
create table public.promo_attempts (
  id bigint generated always as identity primary key,
  tenant_id uuid not null references public.tenants (id) on delete cascade,
  ip_hash text not null,
  created_at timestamptz not null default now()
);
create index promo_attempts_recent on public.promo_attempts (ip_hash, created_at desc);
create index promo_attempts_age on public.promo_attempts (created_at);
alter table public.promo_attempts enable row level security;
revoke all on public.promo_attempts from anon, authenticated;

-- Logs a check and says whether this visitor is still under the limit; clears day-old checks as it goes.
create function public.promo_attempt(target uuid, visitor text, per_window integer, window_minutes integer)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
begin
  perform pg_advisory_xact_lock(hashtext('promo:' || visitor));
  delete from public.promo_attempts where created_at < now() - interval '1 day';
  if (select count(*) from public.promo_attempts where ip_hash = visitor and created_at > now() - make_interval(mins => window_minutes)) >= per_window then
    return false;
  end if;
  insert into public.promo_attempts (tenant_id, ip_hash) values (target, visitor);
  return true;
end;
$$;

-- Counts a use, if the code is still good: active, unexpired and under its cap.
create function public.redeem_promo(promo uuid)
returns boolean
language sql
security definer
set search_path = public
as $$
  with used as (
    update public.promo_codes set uses = uses + 1
    where id = promo and active and (expires_at is null or expires_at > now()) and (max_uses is null or uses < max_uses)
    returning 1
  )
  select exists (select 1 from used);
$$;

-- Gives a use back when the design request it was counted for didn't go through.
create function public.release_promo(promo uuid)
returns void
language sql
security definer
set search_path = public
as $$
  update public.promo_codes set uses = uses - 1 where id = promo and uses > 0;
$$;

revoke all on function public.promo_attempt(uuid, text, integer, integer) from public, anon, authenticated;
revoke all on function public.redeem_promo(uuid) from public, anon, authenticated;
revoke all on function public.release_promo(uuid) from public, anon, authenticated;
