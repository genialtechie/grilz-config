-- Stage 3 hardening, from the security review of the lead pipeline.

-- ---------- 1. Admin invites need a confirmed, password-less account ----------
-- An invite used to grant admin on sign-up, before the email was confirmed: anyone
-- could register an invited address and become admin. Now the grant happens only
-- once the address is confirmed, and only for magic-link accounts, so an attacker
-- can't pre-register the address with a password and wait for the owner to confirm it.
drop trigger if exists grant_invited_admin on auth.users;

create or replace function public.grant_invited_admin() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if new.email_confirmed_at is not null
     and coalesce(new.encrypted_password, '') = ''
     and exists (select 1 from public.platform_admin_invites where email = lower(new.email)) then
    insert into public.platform_admins (user_id) values (new.id) on conflict do nothing;
  end if;
  return new;
end $$;
revoke all on function public.grant_invited_admin() from public, anon, authenticated;

create trigger grant_invited_admin after insert or update of email_confirmed_at on auth.users
  for each row execute function public.grant_invited_admin();

create or replace function public.claim_admin_invite() returns boolean
language plpgsql security definer set search_path = public as $$
declare
  account auth.users;
begin
  select * into account from auth.users where id = auth.uid();
  if account.id is null or account.email_confirmed_at is null or coalesce(account.encrypted_password, '') <> ''
     or not exists (select 1 from public.platform_admin_invites where email = lower(account.email)) then
    return false;
  end if;
  insert into public.platform_admins (user_id) values (account.id) on conflict do nothing;
  return true;
end $$;
revoke all on function public.claim_admin_invite() from public, anon;
grant execute on function public.claim_admin_invite() to authenticated;

-- ---------- 2. A draft can't be moved to another shop ----------
drop policy configs_draft_update on public.tenant_configs;
create policy configs_draft_update on public.tenant_configs for update to authenticated
  using ((public.is_member(tenant_id) or public.is_platform_admin()) and status = 'draft')
  with check ((public.is_member(tenant_id) or public.is_platform_admin()) and status = 'draft');
revoke update on public.tenant_configs from authenticated;
grant update (config) on public.tenant_configs to authenticated;

-- ---------- 3. AI spend is reserved atomically before a render starts ----------
-- Usage used to be written after the render finished, so a burst of parallel
-- requests all saw the same total and overspent. Now each render reserves its
-- generations under a lock and settles the row when it ends.
alter table public.render_usage drop constraint render_usage_outcome_check;
alter table public.render_usage add constraint render_usage_outcome_check check (outcome in ('pending', 'ok', 'paused', 'failed'));

create function public.reserve_generations(target uuid, wanted integer, month_limit integer, day_limit integer, lead uuid)
returns table (reservation bigint, used_before integer, refused text)
language plpgsql security definer set search_path = public as $$
declare
  month_used integer;
  day_used integer;
begin
  -- One global lock: the daily budget is shared by every shop.
  perform pg_advisory_xact_lock(hashtext('render_usage'));
  month_used := public.month_generations(target);
  day_used := public.day_generations();
  if month_used + wanted > month_limit then
    return query select null::bigint, month_used, 'allowance'::text;
    return;
  end if;
  if day_used + wanted > day_limit then
    return query select null::bigint, month_used, 'daily'::text;
    return;
  end if;
  return query
    insert into public.render_usage (tenant_id, generations, outcome, lead_id)
    values (target, wanted, 'pending', lead)
    returning id, month_used, null::text;
end $$;
revoke all on function public.reserve_generations(uuid, integer, integer, integer, uuid) from public, anon, authenticated;
grant execute on function public.reserve_generations(uuid, integer, integer, integer, uuid) to service_role;

-- ---------- 4. Lead limits are checked and the lead inserted under one lock ----------
-- Parallel submissions used to pass the count before any insert landed.
create function public.create_lead(lead jsonb, per_ip_hour integer, per_shop_day integer, per_email_day integer)
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
  insert into public.leads (id, tenant_id, name, contact, email, note, spec, price, total, deposit, config_version, preview_path, source, ip_hash, render_status)
  values (
    (lead->>'id')::uuid, target, lead->>'name', lead->>'contact', lead->>'email', lead->>'note',
    lead->'spec', lead->'price', (lead->>'total')::numeric, (lead->>'deposit')::numeric, (lead->>'config_version')::integer,
    lead->>'preview_path', coalesce(lead->'source', '{}'::jsonb), lead->>'ip_hash', coalesce(lead->>'render_status', 'none')
  );
  insert into public.lead_events (lead_id, tenant_id, type, data) values ((lead->>'id')::uuid, target, 'created', coalesce(lead->'event', '{}'::jsonb));
  return 'ok';
end $$;
revoke all on function public.create_lead(jsonb, integer, integer, integer) from public, anon, authenticated;
grant execute on function public.create_lead(jsonb, integer, integer, integer) to service_role;

create index leads_email_created_idx on public.leads (lower(email), created_at desc) where email is not null;

-- ---------- 5. No SVG in the public assets bucket (it can carry script) ----------
update storage.buckets set allowed_mime_types = array['image/png', 'image/jpeg', 'image/webp'] where id = 'tenant-assets';
