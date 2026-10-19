-- Daily metal prices for market-linked pricing (MAG-88). Written by the daily
-- crons (server/metalPrices.ts, service role); quotes read the latest row.
-- US dollars per troy ounce of the pure metal. Public market data, so anyone
-- may read it (the dashboard shows today's price next to the shop's settings).

create table public.metal_prices (
  id bigint generated always as identity primary key,
  fetched_at timestamptz not null default now(),
  source text not null check (source in ('yahoo', 'gold-api')),
  gold numeric(12, 4) not null check (gold > 0),
  silver numeric(12, 4) not null check (silver > 0),
  platinum numeric(12, 4) not null check (platinum > 0)
);

create index metal_prices_fetched_at on public.metal_prices (fetched_at desc);

alter table public.metal_prices enable row level security;
create policy "metal prices are public" on public.metal_prices for select using (true);
-- No insert/update/delete policies: only the service role writes.
