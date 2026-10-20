import { supabase } from '../admin/supabase';

/**
 * Signs in with the session signup or a claim link hands back (MAG-91) and
 * opens the shop's dashboard. False if the session didn't take.
 */
export async function openShop(session: { access_token: string; refresh_token: string }, slug: string): Promise<boolean> {
  const { error } = await supabase().auth.setSession(session);
  if (error) return false;
  window.location.assign(`/dashboard/${slug}`);
  return true;
}
