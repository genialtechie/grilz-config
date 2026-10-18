-- Tenant isolation test. Runs in a transaction and rolls back; raises on any failure.
begin;
do $$
declare
  ua uuid := gen_random_uuid(); ub uuid := gen_random_uuid();
  ta uuid; tb uuid; la uuid; lb uuid; ca uuid; n int; ok boolean;
begin
  insert into auth.users (id, instance_id, aud, role, email) values
    (ua, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'iso-a@test.local'),
    (ub, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'iso-b@test.local');
  insert into public.tenants (slug, name, kind) values ('iso-a', 'Iso A', 'fixture') returning id into ta;
  insert into public.tenants (slug, name, kind) values ('iso-b', 'Iso B', 'fixture') returning id into tb;
  insert into public.members (tenant_id, user_id, role) values (ta, ua, 'owner'), (tb, ub, 'owner');
  insert into public.leads (tenant_id, name, contact, spec, price, total, config_version) values (ta, 'A lead', '@a', '{}', '{}', 100, 1) returning id into la;
  insert into public.leads (tenant_id, name, contact, spec, price, total, config_version) values (tb, 'B lead', '@b', '{}', '{}', 100, 1) returning id into lb;
  insert into public.tenant_configs (tenant_id, version, config) values (ta, 1, '{}') returning id into ca;

  -- nothing grants platform admin automatically: a confirmed new account is not an admin
  insert into auth.users (id, instance_id, aud, role, email, email_confirmed_at) values
    (gen_random_uuid(), '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'iso-new@test.local', now());
  select count(*) into n from public.platform_admins pa join auth.users u on u.id = pa.user_id where u.email = 'iso-new@test.local';
  if n <> 0 then raise exception 'a new account became admin'; end if;
  select count(*) into n from public.platform_admins where user_id in (ua, ub);
  if n <> 0 then raise exception 'uninvited user became admin'; end if;

  -- act as user A
  perform set_config('request.jwt.claims', json_build_object('sub', ua, 'role', 'authenticated')::text, true);
  set local role authenticated;

  select count(*) into n from public.leads; if n <> 1 then raise exception 'A sees % leads, expected 1', n; end if;
  select count(*) into n from public.leads where tenant_id = tb; if n <> 0 then raise exception 'A can read B leads'; end if;
  select count(*) into n from public.tenants; if n <> 1 then raise exception 'A sees % tenants', n; end if;
  update public.leads set status = 'won' where id = lb; get diagnostics n = row_count; if n <> 0 then raise exception 'A updated a B lead'; end if;
  update public.leads set status = 'contacted' where id = la; get diagnostics n = row_count; if n <> 1 then raise exception 'A cannot update own lead'; end if;

  ok := false;
  begin insert into public.tenant_configs (tenant_id, version, config) values (tb, 1, '{}'); exception when others then ok := true; end;
  if not ok then raise exception 'A inserted a config for B'; end if;

  -- A can't move its own draft into B's shop
  ok := false;
  begin update public.tenant_configs set tenant_id = tb where id = ca; get diagnostics n = row_count; if n = 0 then ok := true; end if; exception when others then ok := true; end;
  if not ok then raise exception 'A moved a draft into B'; end if;

  ok := false;
  begin update public.leads set total = 1 where id = la; exception when others then ok := true; end;
  if not ok then raise exception 'A changed a lead total'; end if;

  ok := false;
  begin insert into public.leads (tenant_id, name, contact, spec, price, total, config_version) values (ta, 'x', 'x', '{}', '{}', 1, 1); exception when others then ok := true; end;
  if not ok then raise exception 'A inserted a lead directly'; end if;

  -- Stage 4: members publish through the server (validated, plan fields kept), not this RPC
  ok := false;
  begin perform public.publish_config(ca); exception when others then ok := true; end;
  if not ok then raise exception 'owner published without the server'; end if;

  ok := false;
  begin perform public.publish_config_service(ca, '{}'::jsonb, ua); exception when others then ok := true; end;
  if not ok then raise exception 'A can call publish_config_service'; end if;

  -- members are added by the server, never by a browser insert
  ok := false;
  begin insert into public.members (tenant_id, user_id, role) values (ta, ub, 'staff'); exception when others then ok := true; end;
  if not ok then raise exception 'owner inserted a member directly'; end if;

  ok := false;
  begin insert into public.members (tenant_id, user_id, role) values (tb, ua, 'owner'); exception when others then ok := true; end;
  if not ok then raise exception 'A added itself to B'; end if;

  -- the last owner can't be removed or demoted
  ok := false;
  begin delete from public.members where tenant_id = ta and user_id = ua; exception when others then ok := true; end;
  if not ok then raise exception 'last owner was removed'; end if;
  ok := false;
  begin update public.members set role = 'staff' where tenant_id = ta and user_id = ua; exception when others then ok := true; end;
  if not ok then raise exception 'last owner was demoted'; end if;

  -- A can't touch B's team
  delete from public.members where tenant_id = tb; get diagnostics n = row_count;
  if n <> 0 then raise exception 'A removed B members'; end if;

  -- team list is scoped to own shops
  select count(*) into n from public.shop_team(tb); if n <> 0 then raise exception 'A sees B team'; end if;
  select count(*) into n from public.shop_team(ta); if n <> 1 then raise exception 'A sees % in own team', n; end if;

  -- stats only count own shop
  if (public.shop_stats(tb, now() - interval '30 days') ->> 'leads')::int <> 0 then raise exception 'A counted B leads'; end if;
  if (public.shop_stats(ta, now() - interval '30 days') ->> 'leads')::int <> 1 then raise exception 'A stats wrong'; end if;

  -- the customer's note can't be rewritten; status changes are logged
  ok := false;
  begin update public.leads set note = 'edited' where id = la; exception when others then ok := true; end;
  if not ok then raise exception 'A rewrote the customer note'; end if;
  select count(*) into n from public.lead_events where lead_id = la and type = 'status' and actor = ua;
  if n < 1 then raise exception 'status change was not logged'; end if;

  -- notes go in as lead events for own leads only
  insert into public.lead_events (lead_id, tenant_id, type, actor, data) values (la, ta, 'note', ua, '{"text":"called"}');
  ok := false;
  begin insert into public.lead_events (lead_id, tenant_id, type, actor, data) values (lb, tb, 'note', ua, '{"text":"x"}'); exception when others then ok := true; end;
  if not ok then raise exception 'A wrote a note on a B lead'; end if;

  ok := false;
  begin update public.leads set notified_at = now() where id = la; exception when others then ok := true; end;
  if not ok then raise exception 'A changed lead delivery fields'; end if;

  ok := false;
  begin perform public.month_generations(ta); exception when others then ok := true; end;
  if not ok then raise exception 'A can call month_generations'; end if;

  ok := false;
  begin perform public.set_tenant_status(ta, 'live'); exception when others then ok := true; end;
  if not ok then raise exception 'A changed tenant status'; end if;

  ok := false;
  begin insert into public.platform_admins (user_id) values (ua); exception when others then ok := true; end;
  if not ok then raise exception 'A made itself a platform admin'; end if;

  -- act as anon
  reset role;
  set local role anon;
  ok := false;
  begin select count(*) into n from public.leads; exception when others then ok := true; end;
  if not ok and n > 0 then raise exception 'anon can read leads'; end if;
  reset role;
end $$;
rollback;
select 'isolation ok' as result;
