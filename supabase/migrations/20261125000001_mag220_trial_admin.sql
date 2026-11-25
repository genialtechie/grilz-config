-- MAG-220: trials you can see, extend, and warn about.
--   - tenants.trial_started_at, so the trial sequence can count days on a
--     30-day claim/invite trial (the end alone can't say when it started).
--   - tenant_events, the audit log for trial extensions (who, when, what).
--   - accept_member_invites starts a 30-day trial when an owner joins:
--     founding is $149/mo AFTER the trial, not free. Staff joins don't
--     touch the trial, and a shop already on a trial or a paid plan keeps
--     what it has. Admin-created shops with no owner stay as they are.

alter table public.tenants add column trial_started_at timestamptz;

-- ---------- Trial audit log ----------
create table public.tenant_events (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants (id) on delete cascade,
  created_at timestamptz not null default now(),
  type text not null check (type in ('trial_extended')),
  data jsonb not null default '{}'::jsonb,
  actor uuid references auth.users (id) on delete set null
);
create index tenant_events_tenant_idx on public.tenant_events (tenant_id, created_at desc);
alter table public.tenant_events enable row level security;
create policy tenant_events_read on public.tenant_events for select to authenticated using (public.is_member(tenant_id) or public.is_platform_admin());
create policy tenant_events_insert on public.tenant_events for insert to authenticated
  with check (public.is_platform_admin() and actor = auth.uid() and type = 'trial_extended');
revoke all on public.tenant_events from anon, authenticated;
grant select, insert on public.tenant_events to authenticated;

-- ---------- Owner invites start the trial ----------
-- Same accept as before (20261024000001_email_confirm.sql: the unconfirmed
-- account rule), plus the trial start for owner joins.
create or replace function public.accept_member_invites() returns integer
language plpgsql security definer set search_path = public as $$
declare
  me auth.users;
  unconfirmed boolean;
  invite public.member_invites;
  added integer := 0;
begin
  select * into me from auth.users where id = auth.uid();
  if me is null or me.email_confirmed_at is null then return 0; end if;
  unconfirmed := coalesce((me.raw_app_meta_data ->> 'email_unconfirmed')::boolean, false);
  for invite in
    select * from public.member_invites
    where email = lower(me.email) and accepted_at is null and revoked_at is null and created_at > now() - interval '7 days'
      and (not unconfirmed or invited_by = me.id)
    for update
  loop
    insert into public.members (tenant_id, user_id, role) values (invite.tenant_id, me.id, invite.role)
    on conflict (tenant_id, user_id) do nothing;
    update public.member_invites set accepted_at = now() where id = invite.id;
    -- An owner joining starts the 30-day trial (MAG-220). A shop already on a
    -- trial or a paid plan keeps what it has; staff joins don't start one.
    if invite.role = 'owner' then
      update public.tenants
      set plan = 'trial',
          trial_started_at = now(),
          trial_ends_at = now() + interval '30 days'
      where id = invite.tenant_id
        and plan = 'founding'
        and billing_status in ('none', 'canceled');
    end if;
    added := added + 1;
  end loop;
  return added;
end $$;
revoke all on function public.accept_member_invites() from public, anon;
grant execute on function public.accept_member_invites() to authenticated;
