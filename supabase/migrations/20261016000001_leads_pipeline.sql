-- Stage 3: leads delivered to the jeweler, per-shop AI allowance, admin access.

-- ---------- Leads ----------
-- email: optional customer email for their confirmation (contact stays IG or phone).
-- ip_hash: salted hash for rate limiting; the raw IP is never stored.
-- notified_at: set once, atomically, by whichever path sends the shop's email first.
alter table public.leads
  add column email text check (email is null or (char_length(email) <= 120 and email ~* '^[^@\s]+@[^@\s]+\.[^@\s]+$')),
  add column ip_hash text,
  add column notified_at timestamptz,
  add column photo_notified_at timestamptz,
  add column render_status text not null default 'none' check (render_status in ('none', 'rendering', 'ready', 'paused', 'failed'));

create index leads_tenant_ip_idx on public.leads (tenant_id, ip_hash, created_at desc);

alter table public.lead_events drop constraint lead_events_type_check;
alter table public.lead_events add constraint lead_events_type_check check (type in (
  'created', 'status', 'note', 'email_sent', 'email_failed', 'email_skipped',
  'confirmation_sent', 'confirmation_failed', 'photo_ready', 'photo_sent', 'deposit_paid'
));

-- ---------- AI usage ----------
alter table public.render_usage add column lead_id uuid references public.leads (id) on delete set null;

-- Generations used by a tenant this calendar month (US Eastern), for the allowance.
create function public.month_generations(target uuid) returns integer
language sql stable security definer set search_path = public as $$
  select coalesce(sum(generations), 0)::integer from public.render_usage
  where tenant_id = target
    and created_at >= (date_trunc('month', now() at time zone 'America/New_York') at time zone 'America/New_York');
$$;

-- Generations used across all tenants today (UTC), for the global daily budget.
create function public.day_generations() returns integer
language sql stable security definer set search_path = public as $$
  select coalesce(sum(generations), 0)::integer from public.render_usage where created_at >= date_trunc('day', now());
$$;

revoke all on function public.month_generations(uuid) from public, anon, authenticated;
revoke all on function public.day_generations() from public, anon, authenticated;
grant execute on function public.month_generations(uuid) to service_role;
grant execute on function public.day_generations() to service_role;

-- ---------- Platform admin invites ----------
-- An invited email becomes a platform admin the moment that person first signs in.
create table public.platform_admin_invites (
  email text primary key check (email = lower(email)),
  created_at timestamptz not null default now()
);
alter table public.platform_admin_invites enable row level security;
revoke all on public.platform_admin_invites from anon, authenticated;

create function public.grant_invited_admin() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if exists (select 1 from public.platform_admin_invites where email = lower(new.email)) then
    insert into public.platform_admins (user_id) values (new.id) on conflict do nothing;
  end if;
  return new;
end $$;
revoke all on function public.grant_invited_admin() from public, anon, authenticated;

create trigger grant_invited_admin after insert on auth.users
  for each row execute function public.grant_invited_admin();

-- Users who already exist and are invited (e.g. after the invite is added later).
create function public.claim_admin_invite() returns boolean
language plpgsql security definer set search_path = public as $$
declare
  user_email text;
begin
  select lower(email) into user_email from auth.users where id = auth.uid();
  if user_email is null or not exists (select 1 from public.platform_admin_invites where email = user_email) then
    return false;
  end if;
  insert into public.platform_admins (user_id) values (auth.uid()) on conflict do nothing;
  return true;
end $$;
revoke all on function public.claim_admin_invite() from public, anon;
grant execute on function public.claim_admin_invite() to authenticated;

insert into public.platform_admin_invites (email) values ('haleem@magpollo.com') on conflict do nothing;

-- ---------- Admin writes ----------
-- Admins pause, resume and go live through this function so status changes are
-- validated in one place (a shop can only go live with a published config).
create function public.set_tenant_status(target uuid, next_status text) returns text
language plpgsql security definer set search_path = public as $$
declare
  current public.tenants;
begin
  if not public.is_platform_admin() then raise exception 'not allowed'; end if;
  if next_status not in ('draft', 'live', 'paused', 'offboarded') then raise exception 'bad status'; end if;
  select * into current from public.tenants where id = target for update;
  if current is null then raise exception 'tenant not found'; end if;
  if next_status = 'live' and current.published_version is null then raise exception 'publish a config before going live'; end if;
  update public.tenants set status = next_status where id = target;
  return next_status;
end $$;
revoke all on function public.set_tenant_status(uuid, text) from public, anon;
grant execute on function public.set_tenant_status(uuid, text) to authenticated;
