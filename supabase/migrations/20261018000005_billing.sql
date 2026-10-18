-- Stage 5: money.
-- Billing: each shop's $199/mo Stripe subscription (Checkout + customer portal),
-- kept in sync by webhooks. Deposits: customers pay into the shop's own Stripe
-- account (Connect, standard accounts); the webhook marks the lead.

alter table public.tenants
  add column stripe_subscription_id text,
  add column billing_status text not null default 'none'
    check (billing_status in ('none', 'trialing', 'active', 'past_due', 'canceled')),
  add column current_period_end timestamptz,
  add column past_due_since timestamptz,
  add column stripe_charges_enabled boolean not null default false;
create unique index tenants_stripe_customer_idx on public.tenants (stripe_customer_id) where stripe_customer_id is not null;
create unique index tenants_stripe_account_idx on public.tenants (stripe_account_id) where stripe_account_id is not null;

alter table public.leads
  add column deposit_paid_at timestamptz,
  add column deposit_checkout_id text;

-- Webhook events already handled (Stripe retries; each event applies once).
create table public.stripe_events (
  id text primary key,
  type text not null,
  received_at timestamptz not null default now()
);
alter table public.stripe_events enable row level security;
revoke all on public.stripe_events from anon, authenticated;
