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

  ok := false;
  begin update public.leads set total = 1 where id = la; exception when others then ok := true; end;
  if not ok then raise exception 'A changed a lead total'; end if;

  ok := false;
  begin insert into public.leads (tenant_id, name, contact, spec, price, total, config_version) values (ta, 'x', 'x', '{}', '{}', 1, 1); exception when others then ok := true; end;
  if not ok then raise exception 'A inserted a lead directly'; end if;

  ok := false;
  begin perform public.publish_config(ca); exception when others then ok := true; end;
  if ok then raise exception 'owner could not publish own draft'; end if;

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
