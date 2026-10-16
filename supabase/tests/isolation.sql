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

  -- an invited email becomes a platform admin only once confirmed, and only for a
  -- password-less (magic link) account; others never do
  insert into public.platform_admin_invites (email) values ('iso-admin@test.local'), ('iso-squat@test.local');
  insert into auth.users (id, instance_id, aud, role, email) values
    (gen_random_uuid(), '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'ISO-Admin@test.local');
  select count(*) into n from public.platform_admins pa join auth.users u on u.id = pa.user_id where u.email = 'ISO-Admin@test.local';
  if n <> 0 then raise exception 'unconfirmed invite became admin'; end if;
  update auth.users set email_confirmed_at = now() where email = 'ISO-Admin@test.local';
  select count(*) into n from public.platform_admins pa join auth.users u on u.id = pa.user_id where u.email = 'ISO-Admin@test.local';
  if n <> 1 then raise exception 'confirmed invite was not granted'; end if;
  -- someone pre-registers an invited address with a password; confirming it must not grant admin
  insert into auth.users (id, instance_id, aud, role, email, encrypted_password) values
    (gen_random_uuid(), '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'iso-squat@test.local', crypt('attacker', gen_salt('bf')));
  update auth.users set email_confirmed_at = now() where email = 'iso-squat@test.local';
  select count(*) into n from public.platform_admins pa join auth.users u on u.id = pa.user_id where u.email = 'iso-squat@test.local';
  if n <> 0 then raise exception 'password account with an invited email became admin'; end if;
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

  ok := false;
  begin perform public.publish_config(ca); exception when others then ok := true; end;
  if ok then raise exception 'owner could not publish own draft'; end if;

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
  begin select count(*) into n from public.platform_admin_invites; exception when others then ok := true; end;
  if not ok and n > 0 then raise exception 'A can read admin invites'; end if;

  if public.claim_admin_invite() then raise exception 'A claimed an admin invite'; end if;

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
