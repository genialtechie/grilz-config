-- MAG-91: signup and claim links sign a new account in on the spot, before
-- its email is proved (app_metadata.email_unconfirmed, set by the server).
-- Someone could sign up with an address that isn't theirs and keep that
-- session, so until the email is confirmed:
--   * the account accepts only the owner invite it made for itself at signup,
--     never another shop's team invite to that address;
--   * the server can end that first session once the real owner confirms
--     from the email, and end every session of a still-unconfirmed account
--     before a claim or a second signup adds a shop to it.

create or replace function public.accept_member_invites() returns integer
language plpgsql security definer set search_path = public as $$
declare
  me auth.users;
  unconfirmed boolean;
  invite public.member_invites;
  added integer := 0;
begin
  select * into me from auth.users where id = auth.uid();
  if me is null or me.email_confirmed_at is null then return 0; end if;
  unconfirmed := coalesce((me.raw_app_meta_data ->> 'email_unconfirmed')::boolean, false);
  for invite in
    select * from public.member_invites
    where email = lower(me.email) and accepted_at is null and revoked_at is null and created_at > now() - interval '7 days'
      and (not unconfirmed or invited_by = me.id)
    for update
  loop
    insert into public.members (tenant_id, user_id, role) values (invite.tenant_id, me.id, invite.role)
    on conflict (tenant_id, user_id) do nothing;
    update public.member_invites set accepted_at = now() where id = invite.id;
    added := added + 1;
  end loop;
  return added;
end $$;
revoke all on function public.accept_member_invites() from public, anon;
grant execute on function public.accept_member_invites() to authenticated;

-- Ends sign-in sessions (their refresh tokens go with them). One session, or
-- all of a user's when target_session is null. Server only.
create function public.end_auth_sessions(target_user uuid, target_session uuid default null) returns integer
language plpgsql security definer set search_path = public as $$
declare
  ended integer;
begin
  delete from auth.sessions where user_id = target_user and (target_session is null or id = target_session);
  get diagnostics ended = row_count;
  return ended;
end $$;
revoke all on function public.end_auth_sessions(uuid, uuid) from public, anon, authenticated;
grant execute on function public.end_auth_sessions(uuid, uuid) to service_role;
