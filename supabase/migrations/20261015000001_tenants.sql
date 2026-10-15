-- VVS Lab multi-tenant schema (Stage 0).
-- Every tenant-owned row carries tenant_id and is protected by row-level security.
-- The public builder never talks to the database directly: the API reads and
-- writes with the service role, and the jeweler dashboard uses a signed-in user
-- whose access is limited by the policies below. Anonymous access: none.

create extension if not exists pgcrypto;

-- ---------- Platform admins (Magpollo) ----------
create table public.platform_admins (
  user_id uuid primary key references auth.users (id) on delete cascade,
  created_at timestamptz not null default now()
);

-- ---------- Tenants ----------
create table public.tenants (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique
    check (slug ~ '^[a-z0-9](?:[a-z0-9-]{0,38}[a-z0-9])?$')
    check (slug not in ('admin', 'api', 'app', 'b', 'www', 'dashboard', 'login', 'signup', 'help', 'support', 'assets', 'static', 'configurator', 'watch')),
  name text not null check (char_length(name) between 2 and 60),
  kind text not null default 'shop' check (kind in ('demo', 'shop', 'fixture')),
  status text not null default 'draft' check (status in ('draft', 'live', 'paused', 'offboarded')),
  plan text not null default 'founding',
  published_version integer,
  stripe_customer_id text,
  stripe_account_id text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.members (
  tenant_id uuid not null references public.tenants (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  role text not null default 'staff' check (role in ('owner', 'staff')),
  created_at timestamptz not null default now(),
  primary key (tenant_id, user_id)
);
create index members_user_idx on public.members (user_id);

-- ---------- Configs (versioned) ----------
create table public.tenant_configs (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants (id) on delete cascade,
  version integer not null,
  config jsonb not null,
  status text not null default 'draft' check (status in ('draft', 'published', 'archived')),
  created_by uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now(),
  published_at timestamptz,
  unique (tenant_id, version)
);
create index tenant_configs_tenant_idx on public.tenant_configs (tenant_id, version desc);

alter table public.tenants
  add constraint tenants_published_version_fk foreign key (id, published_version)
  references public.tenant_configs (tenant_id, version) deferrable initially deferred;

-- ---------- Leads ----------
create table public.leads (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants (id) on delete cascade,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  status text not null default 'new' check (status in ('new', 'contacted', 'deposit_paid', 'won', 'lost')),
  name text not null check (char_length(name) between 1 and 80),
  contact text not null check (char_length(contact) between 1 and 80),
  note text check (char_length(note) <= 500),
  spec jsonb not null,
  price jsonb not null,
  total numeric(10, 2) not null,
  deposit numeric(10, 2),
  config_version integer not null,
  preview_path text,
  photo_path text,
  source jsonb not null default '{}'::jsonb,
  consent jsonb not null default '{}'::jsonb
);
create index leads_tenant_created_idx on public.leads (tenant_id, created_at desc);

create table public.lead_events (
  id uuid primary key default gen_random_uuid(),
  lead_id uuid not null references public.leads (id) on delete cascade,
  tenant_id uuid not null references public.tenants (id) on delete cascade,
  created_at timestamptz not null default now(),
  type text not null check (type in ('created', 'status', 'note', 'email_sent', 'email_failed', 'deposit_paid')),
  data jsonb not null default '{}'::jsonb,
  actor uuid references auth.users (id) on delete set null
);
create index lead_events_lead_idx on public.lead_events (lead_id, created_at);

-- ---------- AI usage ----------
create table public.render_usage (
  id bigint generated always as identity primary key,
  tenant_id uuid not null references public.tenants (id) on delete cascade,
  created_at timestamptz not null default now(),
  generations integer not null check (generations >= 0),
  outcome text not null check (outcome in ('ok', 'paused', 'failed')),
  seconds numeric(6, 1)
);
create index render_usage_tenant_month_idx on public.render_usage (tenant_id, created_at desc);

-- ---------- updated_at ----------
create function public.touch_updated_at() returns trigger language plpgsql as $$
begin
  new.updated_at := now();
  return new;
end $$;
create trigger tenants_touch before update on public.tenants for each row execute function public.touch_updated_at();
create trigger leads_touch before update on public.leads for each row execute function public.touch_updated_at();

-- ---------- Access helpers (security definer, fixed search_path) ----------
create function public.is_platform_admin() returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.platform_admins where user_id = auth.uid());
$$;

create function public.is_member(target uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.members where tenant_id = target and user_id = auth.uid());
$$;

create function public.is_owner(target uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.members where tenant_id = target and user_id = auth.uid() and role = 'owner');
$$;

revoke all on function public.is_platform_admin() from public, anon;
revoke all on function public.is_member(uuid) from public, anon;
revoke all on function public.is_owner(uuid) from public, anon;
grant execute on function public.is_platform_admin() to authenticated;
grant execute on function public.is_member(uuid) to authenticated;
grant execute on function public.is_owner(uuid) to authenticated;

-- ---------- Row-level security ----------
alter table public.platform_admins enable row level security;
alter table public.tenants enable row level security;
alter table public.members enable row level security;
alter table public.tenant_configs enable row level security;
alter table public.leads enable row level security;
alter table public.lead_events enable row level security;
alter table public.render_usage enable row level security;

-- No policies for anon anywhere: the anon role sees nothing.
revoke all on all tables in schema public from anon;

create policy admins_self on public.platform_admins for select to authenticated using (user_id = auth.uid());

create policy tenants_read on public.tenants for select to authenticated using (public.is_member(id) or public.is_platform_admin());
create policy tenants_admin on public.tenants for all to authenticated using (public.is_platform_admin()) with check (public.is_platform_admin());

create policy members_read on public.members for select to authenticated using (public.is_member(tenant_id) or public.is_platform_admin());
create policy members_owner_write on public.members for all to authenticated
  using (public.is_owner(tenant_id) or public.is_platform_admin())
  with check (public.is_owner(tenant_id) or public.is_platform_admin());

create policy configs_read on public.tenant_configs for select to authenticated using (public.is_member(tenant_id) or public.is_platform_admin());
create policy configs_draft_insert on public.tenant_configs for insert to authenticated
  with check ((public.is_member(tenant_id) or public.is_platform_admin()) and status = 'draft');
create policy configs_draft_update on public.tenant_configs for update to authenticated
  using ((public.is_member(tenant_id) or public.is_platform_admin()) and status = 'draft')
  with check (status = 'draft');

create policy leads_read on public.leads for select to authenticated using (public.is_member(tenant_id) or public.is_platform_admin());
create policy leads_update on public.leads for update to authenticated
  using (public.is_member(tenant_id) or public.is_platform_admin())
  with check (public.is_member(tenant_id) or public.is_platform_admin());

create policy lead_events_read on public.lead_events for select to authenticated using (public.is_member(tenant_id) or public.is_platform_admin());
create policy lead_events_insert on public.lead_events for insert to authenticated
  with check ((public.is_member(tenant_id) or public.is_platform_admin()) and actor = auth.uid() and type in ('status', 'note'));

create policy usage_read on public.render_usage for select to authenticated using (public.is_member(tenant_id) or public.is_platform_admin());

-- A lead's status changes only through these columns from the dashboard.
revoke update on public.leads from authenticated;
grant update (status, note) on public.leads to authenticated;

-- ---------- Publishing (owner or admin, atomic) ----------
create function public.publish_config(config_id uuid) returns integer
language plpgsql security definer set search_path = public as $$
declare
  target public.tenant_configs;
begin
  select * into target from public.tenant_configs where id = config_id for update;
  if target is null then raise exception 'config not found'; end if;
  if not (public.is_owner(target.tenant_id) or public.is_platform_admin()) then raise exception 'not allowed'; end if;
  if target.status <> 'draft' then raise exception 'only drafts can be published'; end if;
  update public.tenant_configs set status = 'archived' where tenant_id = target.tenant_id and status = 'published';
  update public.tenant_configs set status = 'published', published_at = now() where id = config_id;
  update public.tenants set published_version = target.version where id = target.tenant_id;
  return target.version;
end $$;
revoke all on function public.publish_config(uuid) from public, anon;
grant execute on function public.publish_config(uuid) to authenticated;

-- ---------- Storage ----------
-- tenant-assets: public logos and OG images under <tenant id>/...
-- lead-media: private 3D captures and studio photos under <tenant id>/<lead id>/...
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values
  ('tenant-assets', 'tenant-assets', true, 2097152, array['image/png', 'image/jpeg', 'image/webp', 'image/svg+xml']),
  ('lead-media', 'lead-media', false, 5242880, array['image/png', 'image/jpeg', 'image/webp'])
on conflict (id) do nothing;

create policy lead_media_read on storage.objects for select to authenticated
  using (bucket_id = 'lead-media' and (public.is_member(((storage.foldername(name))[1])::uuid) or public.is_platform_admin()));
create policy tenant_assets_write on storage.objects for insert to authenticated
  with check (bucket_id = 'tenant-assets' and (public.is_owner(((storage.foldername(name))[1])::uuid) or public.is_platform_admin()));
create policy tenant_assets_update on storage.objects for update to authenticated
  using (bucket_id = 'tenant-assets' and (public.is_owner(((storage.foldername(name))[1])::uuid) or public.is_platform_admin()));
