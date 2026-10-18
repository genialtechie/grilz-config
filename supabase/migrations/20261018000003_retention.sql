-- Stage 7: retention and offboarding.
-- Leads are kept 24 months by default. When a shop is offboarded its leads stay
-- exportable for 90 days, then are deleted; the tenant row (and so its slug)
-- stays, so a link can never be taken over by someone else.

alter table public.tenants add column offboarded_at timestamptz;

create function public.stamp_offboarded() returns trigger
language plpgsql as $$
begin
  if new.status = 'offboarded' and old.status is distinct from 'offboarded' then new.offboarded_at := now(); end if;
  if new.status <> 'offboarded' then new.offboarded_at := null; end if;
  return new;
end $$;
create trigger tenants_stamp_offboarded before update of status on public.tenants
  for each row execute function public.stamp_offboarded();

-- Leads due for deletion, oldest first, with their media paths so the server can
-- remove the files too. Service role only.
create function public.expired_leads(max_rows integer default 500)
returns table (id uuid, tenant_id uuid, preview_path text, photo_path text, reason text)
language sql stable security definer set search_path = public as $$
  select l.id, l.tenant_id, l.preview_path, l.photo_path,
         case when t.offboarded_at is not null and t.offboarded_at < now() - interval '90 days' then 'offboarded' else 'retention' end
  from public.leads l join public.tenants t on t.id = l.tenant_id
  where (t.offboarded_at is not null and t.offboarded_at < now() - interval '90 days')
     or l.created_at < now() - interval '24 months'
  order by l.created_at
  limit greatest(1, least(max_rows, 2000));
$$;
revoke all on function public.expired_leads(integer) from public, anon, authenticated;
grant execute on function public.expired_leads(integer) to service_role;
