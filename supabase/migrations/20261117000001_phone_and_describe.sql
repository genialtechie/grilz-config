-- The redesign's shopper flow (Nov 17): verified phones and "Describe it".
--
-- 1. leads.phone_verified: the contact is a phone the shopper proved with a
--    texted code (Firebase), not just typed.
-- 2. describe_builds: one row per AI build from someone's words or picture.
--    Each verified phone gets 3 free builds (every reply counts); counted by a
--    salted hash of the phone, never the number. A failed call is deleted, so
--    it isn't counted.

-- ---------- 1. Verified phones on leads ----------
alter table public.leads add column phone_verified boolean not null default false;

-- Same as 20261016000002_hardening.sql, plus phone_verified.
create or replace function public.create_lead(lead jsonb, per_ip_hour integer, per_shop_day integer, per_email_day integer)
returns text
language plpgsql security definer set search_path = public as $$
declare
  target uuid := (lead->>'tenant_id')::uuid;
begin
  perform pg_advisory_xact_lock(hashtext('lead:' || target::text));
  if (select count(*) from public.leads where tenant_id = target and ip_hash = lead->>'ip_hash' and created_at > now() - interval '1 hour') >= per_ip_hour then
    return 'ip';
  end if;
  if (select count(*) from public.leads where tenant_id = target and created_at > now() - interval '1 day') >= per_shop_day then
    return 'shop';
  end if;
  -- Confirmations go to whatever address is typed, so one address gets a few per day across all shops.
  if lead->>'email' is not null then
    perform pg_advisory_xact_lock(hashtext('lead-email:' || lower(lead->>'email')));
    if (select count(*) from public.leads where lower(email) = lower(lead->>'email') and created_at > now() - interval '1 day') >= per_email_day then
      return 'email';
    end if;
  end if;
  insert into public.leads (id, tenant_id, name, contact, email, note, spec, price, total, deposit, config_version, preview_path, source, ip_hash, render_status, phone_verified)
  values (
    (lead->>'id')::uuid, target, lead->>'name', lead->>'contact', lead->>'email', lead->>'note',
    lead->'spec', lead->'price', (lead->>'total')::numeric, (lead->>'deposit')::numeric, (lead->>'config_version')::integer,
    lead->>'preview_path', coalesce(lead->'source', '{}'::jsonb), lead->>'ip_hash', coalesce(lead->>'render_status', 'none'),
    coalesce((lead->>'phone_verified')::boolean, false)
  );
  insert into public.lead_events (lead_id, tenant_id, type, data) values ((lead->>'id')::uuid, target, 'created', coalesce(lead->'event', '{}'::jsonb));
  return 'ok';
end $$;
revoke all on function public.create_lead(jsonb, integer, integer, integer) from public, anon, authenticated;
grant execute on function public.create_lead(jsonb, integer, integer, integer) to service_role;

-- ---------- 2. "Describe it" builds ----------
create table public.describe_builds (
  id bigint generated always as identity primary key,
  phone_hash text not null check (length(phone_hash) between 16 and 64),
  -- Kept for reporting; a shop's offboarding doesn't give anyone builds back.
  tenant_id uuid references public.tenants (id) on delete set null,
  outcome text not null default 'pending' check (outcome in ('pending', 'ok')),
  model text,
  cost_usd numeric(8, 4),
  created_at timestamptz not null default now()
);
create index describe_builds_phone_idx on public.describe_builds (phone_hash);
create index describe_builds_created_idx on public.describe_builds (created_at desc);
alter table public.describe_builds enable row level security;
revoke all on public.describe_builds from anon, authenticated;

-- Takes one of a phone's free builds, under a lock so parallel requests can't
-- overspend it. Refused when the phone has none left ('builds'), the shop's AI
-- month is used up ('allowance'), the platform's AI photo day is used up or
-- AI builds hit their own daily cap ('daily').
create function public.use_describe_build(phone text, target uuid, free_builds integer, month_limit integer, day_limit integer, describe_day_limit integer)
returns table (build bigint, used_before integer, refused text)
language plpgsql security definer set search_path = public as $$
declare
  used integer;
begin
  perform pg_advisory_xact_lock(hashtext('describe:' || phone));
  select count(*)::integer into used from public.describe_builds where phone_hash = phone;
  if used >= free_builds then
    return query select null::bigint, used, 'builds'::text;
    return;
  end if;
  if target is not null and public.month_generations(target) >= month_limit then
    return query select null::bigint, used, 'allowance'::text;
    return;
  end if;
  if public.day_generations() >= day_limit
     or (select count(*) from public.describe_builds where created_at >= date_trunc('day', now())) >= describe_day_limit then
    return query select null::bigint, used, 'daily'::text;
    return;
  end if;
  return query
    insert into public.describe_builds (phone_hash, tenant_id) values (phone, target)
    returning id, used, null::text;
end $$;
revoke all on function public.use_describe_build(text, uuid, integer, integer, integer, integer) from public, anon, authenticated;
grant execute on function public.use_describe_build(text, uuid, integer, integer, integer, integer) to service_role;
