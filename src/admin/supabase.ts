import { createClient, type SupabaseClient } from '@supabase/supabase-js';

// Browser Supabase client for the admin and (later) the jeweler dashboard.
// The anon key is public by design; row-level security decides what a
// signed-in user can read or change. Only loaded on /admin and draft previews.

let client: SupabaseClient | null = null;

export function supabase(): SupabaseClient {
  if (client) return client;
  const url = import.meta.env.VITE_SUPABASE_URL as string | undefined;
  const key = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined;
  if (!url || !key) throw new Error('Supabase is not configured (VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY).');
  client = createClient(url, key, { auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true, flowType: 'pkce' } });
  return client;
}

/** Supabase sign-in errors in our words. Its rate limit ("…only request this after 16 seconds") means a link was just sent. */
export const friendlyAuthError = (message: string) =>
  /only request this after|rate limit|too many requests/i.test(message) ? 'We just sent a link. Check your email, or try again in a minute.' : message;

export async function accessToken(): Promise<string | null> {
  const { data } = await supabase().auth.getSession();
  return data.session?.access_token ?? null;
}
