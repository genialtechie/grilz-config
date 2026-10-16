-- Platform admins are granted by hand, not by invite.
-- Supabase stores a random password hash even for magic-link accounts, so an
-- invite can't tell the real owner from someone who pre-registered the address
-- with a password. With two admins, a manual grant is simpler and safer:
--   insert into public.platform_admins (user_id)
--   select id from auth.users where email = '<address>' and email_confirmed_at is not null;
drop trigger if exists grant_invited_admin on auth.users;
drop function if exists public.grant_invited_admin();
drop function if exists public.claim_admin_invite();
drop table if exists public.platform_admin_invites;
