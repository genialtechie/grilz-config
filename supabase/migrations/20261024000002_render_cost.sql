-- MAG-76: what each AI photo cost and which model made it. OpenAI bills per
-- token, so the dollar cost is recorded per render (from the usage it returns).
alter table public.render_usage
  add column cost_usd numeric(8, 4),
  add column provider text check (provider in ('flux', 'openai'));
