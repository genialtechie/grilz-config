-- Marketing email groundwork: who opted out of what, and a log of every
-- marketing send. Both are server-only (service role); no browser policies.

-- An opt-out per address and topic. 'all' covers every marketing topic.
-- Complaints and hard bounces (Resend webhook) land here too, as 'all'.
create table public.email_unsubscribes (
  email text not null check (email = lower(email)),
  topic text not null check (topic in ('all', 'tips', 'news')),
  source text not null check (source in ('link', 'one_click', 'complaint', 'bounce', 'admin')),
  created_at timestamptz not null default now(),
  primary key (email, topic)
);

-- Every marketing send, once. dedupe_key (e.g. 'trial-day-3:<tenant id>')
-- makes a sequence step idempotent: a retry or a second cron run can't send
-- the same step twice.
create table public.email_sends (
  id uuid primary key default gen_random_uuid(),
  dedupe_key text not null unique,
  kind text not null,
  topic text not null,
  email text not null,
  tenant_id uuid references public.tenants (id) on delete set null,
  status text not null default 'sending' check (status in ('sending', 'sent', 'skipped', 'failed')),
  detail text,
  resend_id text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index email_sends_email on public.email_sends (email);
create index email_sends_tenant on public.email_sends (tenant_id, kind);

alter table public.email_unsubscribes enable row level security;
alter table public.email_sends enable row level security;
