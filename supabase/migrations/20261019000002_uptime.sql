-- Uptime alerts from outside Vercel (MAG-75). Every 5 minutes Postgres asks
-- /api/health over HTTP (pg_net) on a schedule (pg_cron). Two failed checks in
-- a row email an alert, it repeats hourly while the site is down, and a
-- recovery email follows. Catches what the app can't report about itself:
-- Vercel down, DNS broken (the Oct 16 outage), a bad deploy, health failing.
-- It can't report a Supabase outage (it runs there); Vercel logs cover that.
--
-- Email goes through Resend. The key and recipient live in Supabase Vault, set
-- once outside migrations (never commit them):
--   select vault.create_secret('<resend api key>', 'uptime_resend_api_key');
--   select vault.create_secret('ops@example.com', 'uptime_alert_email');
-- Without them, checks still run and are recorded; no email is sent.

create extension if not exists pg_net with schema extensions;
create extension if not exists pg_cron;

create table public.uptime_settings (
  id boolean primary key default true check (id),
  url text not null default 'https://vvslab.magpollo.com/api/health',
  mail_url text not null default 'https://api.resend.com/emails',
  mail_from text not null default 'VVS Lab alerts <hello@vvslab.magpollo.com>',
  down_since timestamptz,
  alerted_at timestamptz
);
insert into public.uptime_settings default values;

create table public.uptime_checks (
  id bigint generated always as identity primary key,
  created_at timestamptz not null default now(),
  request_id bigint not null,
  ok boolean,
  status integer,
  detail text
);
create index uptime_checks_created_idx on public.uptime_checks (created_at desc);

create table public.uptime_alerts (
  id bigint generated always as identity primary key,
  created_at timestamptz not null default now(),
  kind text not null check (kind in ('down', 'still_down', 'recovered')),
  detail text,
  request_id bigint
);

alter table public.uptime_settings enable row level security;
alter table public.uptime_checks enable row level security;
alter table public.uptime_alerts enable row level security;
revoke all on public.uptime_settings, public.uptime_checks, public.uptime_alerts from anon, authenticated;

-- Sends one alert email (if Vault has the key and recipient) and records it.
create function public.uptime_notify(kind text, subject text, body text) returns void
language plpgsql security definer set search_path = public, extensions as $$
declare
  settings public.uptime_settings;
  api_key text;
  recipient text;
  request bigint;
begin
  select * into settings from public.uptime_settings;
  select decrypted_secret into api_key from vault.decrypted_secrets where name = 'uptime_resend_api_key';
  select decrypted_secret into recipient from vault.decrypted_secrets where name = 'uptime_alert_email';
  if api_key is not null and recipient is not null then
    request := net.http_post(
      url := settings.mail_url,
      body := jsonb_build_object('from', settings.mail_from, 'to', jsonb_build_array(recipient), 'subject', subject, 'text', body),
      headers := jsonb_build_object('Authorization', 'Bearer ' || api_key, 'Content-Type', 'application/json'),
      timeout_milliseconds := 10000
    );
  end if;
  insert into public.uptime_alerts (kind, detail, request_id) values (kind, subject, request);
end $$;

create function public.uptime_check() returns void
language plpgsql security definer set search_path = public, extensions as $$
declare
  settings public.uptime_settings;
  latest boolean[];
  last_detail text;
begin
  select * into settings from public.uptime_settings for update;

  -- Results of earlier checks: a 200 within the timeout is up; anything else,
  -- or no answer after two minutes, is down.
  update public.uptime_checks c
     set ok = (r.status_code = 200 and not coalesce(r.timed_out, false)),
         status = r.status_code,
         detail = left(coalesce(r.error_msg, r.content::text, ''), 300)
    from net._http_response r
   where r.id = c.request_id and c.ok is null;
  update public.uptime_checks set ok = false, detail = 'no response' where ok is null and created_at < now() - interval '2 minutes';

  select array_agg(ok order by created_at desc) into latest
    from (select ok, created_at from public.uptime_checks where ok is not null order by created_at desc limit 2) recent;
  select coalesce(detail, '') || coalesce(' (HTTP ' || status || ')', '') into last_detail
    from public.uptime_checks where ok is not null order by created_at desc limit 1;

  if latest is not null and array_length(latest, 1) = 2 and not latest[1] and not latest[2] then
    if settings.down_since is null then
      update public.uptime_settings set down_since = now(), alerted_at = now();
      perform public.uptime_notify('down', 'VVS Lab is DOWN: ' || settings.url || ' is failing',
        'Two health checks in a row failed for ' || settings.url || E'.\nLast result: ' || left(last_detail, 300) || E'\n\nRunbook: docs/runbooks/incident.md');
    elsif settings.alerted_at < now() - interval '60 minutes' then
      update public.uptime_settings set alerted_at = now();
      perform public.uptime_notify('still_down', 'VVS Lab still down since ' || to_char(settings.down_since at time zone 'America/New_York', 'HH12:MI AM') || ' ET',
        'Health checks for ' || settings.url || ' have been failing since ' || settings.down_since || E'.\nLast result: ' || left(last_detail, 300));
    end if;
  elsif latest is not null and latest[1] and settings.down_since is not null then
    perform public.uptime_notify('recovered', 'VVS Lab is back up',
      settings.url || ' answers again. It was down for about ' || greatest(1, round(extract(epoch from now() - settings.down_since) / 60)) || ' minutes.');
    update public.uptime_settings set down_since = null, alerted_at = null;
  end if;

  insert into public.uptime_checks (request_id) values (net.http_get(url := settings.url, timeout_milliseconds := 10000));
  delete from public.uptime_checks where created_at < now() - interval '14 days';
end $$;

revoke all on function public.uptime_check() from public, anon, authenticated;
revoke all on function public.uptime_notify(text, text, text) from public, anon, authenticated;

select cron.schedule('vvslab-uptime', '*/5 * * * *', 'select public.uptime_check()');
