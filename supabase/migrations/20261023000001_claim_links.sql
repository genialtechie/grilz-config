-- Claim links (MAG-89): VVS Lab builds a jeweler's shop ahead of time; the
-- jeweler scans a QR code, enters their email and the shop becomes theirs.
-- Only a hash of each token is stored. A link is single use, expires after
-- 7 days and can be revoked. Admins read links (who claimed, when); only the
-- server (service role) writes them.

create table public.claim_links (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants (id) on delete cascade,
  token_hash text not null unique check (token_hash ~ '^[0-9a-f]{64}$'),
  created_by uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now(),
  expires_at timestamptz not null,
  revoked_at timestamptz,
  claimed_at timestamptz,
  claimed_by uuid references auth.users (id) on delete set null,
  claimed_email text
);
create index claim_links_tenant_idx on public.claim_links (tenant_id, created_at desc);

alter table public.claim_links enable row level security;
create policy claim_links_admin_read on public.claim_links for select to authenticated using (public.is_platform_admin());
revoke all on public.claim_links from anon, authenticated;
grant select on public.claim_links to authenticated;

-- Claims are rate-limited with the signup log.
alter table public.signup_attempts drop constraint signup_attempts_outcome_check;
alter table public.signup_attempts add constraint signup_attempts_outcome_check check (outcome in ('created', 'blocked', 'claimed'));

-- Spends a link: true only for the one request that claims an open link.
create function public.spend_claim_link(link uuid, claimer uuid, claimer_email text)
returns boolean
language sql
security definer
set search_path = public
as $$
  with spent as (
    update public.claim_links
    set claimed_at = now(), claimed_by = claimer, claimed_email = claimer_email
    where id = link and claimed_at is null and revoked_at is null and expires_at > now()
    returning 1
  )
  select exists (select 1 from spent);
$$;
revoke all on function public.spend_claim_link(uuid, uuid, text) from public, anon, authenticated;
