-- Stage 6: custom domains (build.theirshop.com).
-- One domain per shop. Rows are written only by the server, which adds the
-- domain to the Vercel project and checks DNS; members can read their own.

create table public.tenant_domains (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null unique references public.tenants (id) on delete cascade,
  domain text not null unique
    check (domain = lower(domain) and char_length(domain) between 4 and 253
           and domain ~ '^([a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z]{2,63}$'),
  status text not null default 'pending' check (status in ('pending', 'active')),
  verification jsonb not null default '[]'::jsonb,
  created_by uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now(),
  checked_at timestamptz,
  verified_at timestamptz
);
alter table public.tenant_domains enable row level security;
create policy domains_read on public.tenant_domains for select to authenticated
  using (public.is_member(tenant_id) or public.is_platform_admin());
revoke all on public.tenant_domains from anon, authenticated;
grant select on public.tenant_domains to authenticated;
