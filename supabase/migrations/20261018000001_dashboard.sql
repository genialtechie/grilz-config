-- Stage 4: the jeweler dashboard.
-- Shop owners and staff sign in and manage their own shop. Everything a member
-- does goes through row-level security, except publishing and inviting, which go
-- through the server so the config is validated and plan limits can't be edited.

-- ---------- 1. Publishing is server-side for members ----------
-- Members could call publish_config directly, skipping schema validation and
-- publishing an AI allowance or white-label setting their plan doesn't include.
-- Now only platform admins call it from the browser; members publish through
-- POST /api/dashboard/publish, which validates the config, keeps plan-controlled
-- fields, then calls publish_config_service as the service role.
create or replace function public.publish_config(config_id uuid) returns integer
language plpgsql security definer set search_path = public as $$
declare
  target public.tenant_configs;
begin
  select * into target from public.tenant_configs where id = config_id for update;
  if target is null then raise exception 'config not found'; end if;
  if not public.is_platform_admin() then raise exception 'not allowed'; end if;
  if target.status <> 'draft' then raise exception 'only drafts can be published'; end if;
  update public.tenant_configs set status = 'archived' where tenant_id = target.tenant_id and status = 'published';
  update public.tenant_configs set status = 'published', published_at = now() where id = config_id;
  update public.tenants set published_version = target.version where id = target.tenant_id;
  return target.version;
end $$;

create function public.publish_config_service(config_id uuid, final_config jsonb, actor uuid) returns integer
language plpgsql security definer set search_path = public as $$
declare
  target public.tenant_configs;
begin
  select * into target from public.tenant_configs where id = config_id for update;
  if target is null then raise exception 'config not found'; end if;
  if target.status <> 'draft' then raise exception 'only drafts can be published'; end if;
  update public.tenant_configs set status = 'archived' where tenant_id = target.tenant_id and status = 'published';
  update public.tenant_configs set status = 'published', published_at = now(), config = final_config, created_by = coalesce(created_by, actor) where id = config_id;
  update public.tenants set published_version = target.version, name = coalesce(final_config #>> '{brand,name}', name) where id = target.tenant_id;
  return target.version;
end $$;
revoke all on function public.publish_config_service(uuid, jsonb, uuid) from public, anon, authenticated;
grant execute on function public.publish_config_service(uuid, jsonb, uuid) to service_role;

-- ---------- 2. Team ----------
-- A shop always keeps at least one owner, so nobody locks the shop out by removing
-- or demoting the last one. Platform admins are not exempt: offboarding removes
-- the tenant, not its members one by one.
create function public.keep_an_owner() returns trigger
language plpgsql security definer set search_path = public as $$
declare
  shop uuid := old.tenant_id;
begin
  if old.role <> 'owner' then return coalesce(new, old); end if;
  if tg_op = 'UPDATE' and new.role = 'owner' and new.tenant_id = old.tenant_id then return new; end if;
  if not exists (select 1 from public.tenants where id = shop) then return coalesce(new, old); end if;
  if (select count(*) from public.members where tenant_id = shop and role = 'owner' and user_id <> old.user_id) = 0 then
    raise exception 'a shop needs at least one owner';
  end if;
  return coalesce(new, old);
end $$;
create trigger members_keep_an_owner before update or delete on public.members
  for each row execute function public.keep_an_owner();

-- New members are added by the server (POST /api/dashboard/invite), never by a
-- browser insert, so an owner can't attach an arbitrary user id to their shop.
-- Owners can still change roles and remove people.
drop policy members_owner_write on public.members;
create policy members_owner_update on public.members for update to authenticated
  using (public.is_owner(tenant_id) or public.is_platform_admin())
  with check (public.is_owner(tenant_id) or public.is_platform_admin());
create policy members_owner_delete on public.members for delete to authenticated
  using (public.is_owner(tenant_id) or public.is_platform_admin() or user_id = auth.uid());
create policy members_admin_insert on public.members for insert to authenticated
  with check (public.is_platform_admin());
revoke update on public.members from authenticated;
grant update (role) on public.members to authenticated;

-- Members see each other's email in the team list (only for shops they belong to).
create function public.shop_team(target uuid) returns table (user_id uuid, email text, role text, created_at timestamptz, last_sign_in_at timestamptz)
language sql stable security definer set search_path = public as $$
  select m.user_id, u.email::text, m.role, m.created_at, u.last_sign_in_at
  from public.members m join auth.users u on u.id = m.user_id
  where m.tenant_id = target and (public.is_member(target) or public.is_platform_admin())
  order by m.role desc, m.created_at;
$$;
revoke all on function public.shop_team(uuid) from public, anon;
grant execute on function public.shop_team(uuid) to authenticated;

-- ---------- 3. Leads ----------
-- The customer's own note stays as they wrote it; the shop's notes are lead_events
-- of type 'note'. Members only change a lead's status.
revoke update on public.leads from authenticated;
grant update (status) on public.leads to authenticated;

-- Status changes are recorded as events with the actor, for the lead's history.
create function public.log_lead_status() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if new.status is distinct from old.status then
    insert into public.lead_events (lead_id, tenant_id, type, actor, data)
    values (new.id, new.tenant_id, 'status', auth.uid(), jsonb_build_object('from', old.status, 'to', new.status));
  end if;
  return new;
end $$;
create trigger leads_log_status after update of status on public.leads
  for each row execute function public.log_lead_status();

-- ---------- 4. Weekly stats ----------
-- Lead-based numbers for the dashboard, scoped by row-level security (security
-- invoker): a member only ever counts their own shop.
create function public.shop_stats(target uuid, since timestamptz) returns jsonb
language sql stable security invoker set search_path = public as $$
  with recent as (
    select * from public.leads where tenant_id = target and created_at >= since
  ), options as (
    select item, count(*) as n
    from recent, jsonb_array_elements_text(coalesce(spec -> 'summary', '[]'::jsonb)) as item
    group by item order by n desc limit 8
  )
  select jsonb_build_object(
    'leads', (select count(*) from recent),
    'contacted', (select count(*) from recent where status in ('contacted', 'deposit_paid', 'won')),
    'deposits', (select count(*) from recent where status in ('deposit_paid', 'won')),
    'won', (select count(*) from recent where status = 'won'),
    'value', (select coalesce(sum(total), 0) from recent),
    'wonValue', (select coalesce(sum(total), 0) from recent where status = 'won'),
    'popular', (select coalesce(jsonb_agg(jsonb_build_object('label', item, 'count', n)), '[]'::jsonb) from options)
  );
$$;
revoke all on function public.shop_stats(uuid, timestamptz) from public, anon;
grant execute on function public.shop_stats(uuid, timestamptz) to authenticated;
