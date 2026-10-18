-- Self-serve signup: a jeweler creates their shop from /signup, sets it up in
-- the dashboard and goes live with no help. New shops start on a 7-day trial
-- with a small AI photo allowance; billing is arranged separately until card
-- billing ships (Stage 5).

alter table public.tenants add column trial_ends_at timestamptz;
alter table public.tenants add column created_via text not null default 'admin' check (created_via in ('admin', 'signup'));

-- Append-only log for rate limits (IP is salted and hashed).
create table public.signup_attempts (
  id bigint generated always as identity primary key,
  created_at timestamptz not null default now(),
  ip_hash text not null,
  email text not null,
  outcome text not null check (outcome in ('created', 'blocked'))
);
create index signup_attempts_recent_idx on public.signup_attempts (created_at desc);
alter table public.signup_attempts enable row level security;
revoke all on public.signup_attempts from anon, authenticated;
