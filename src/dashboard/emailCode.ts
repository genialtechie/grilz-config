import { supabase } from '../admin/supabase';

/**
 * Signs in with a 6-digit emailed code (Supabase's email OTP: works once,
 * expires with the link, wrong tries rate-limited). Returns an error to show, or null.
 */
export async function verifyEmailCode(email: string, code: string): Promise<string | null> {
  const { error } = await supabase().auth.verifyOtp({ email: email.trim().toLowerCase(), token: code, type: 'email' });
  if (!error) return null;
  return /rate|too many/i.test(error.message) ? 'Too many tries. Wait a minute, or send a new code.' : 'That code didn’t work. Check it, or send a new one.';
}

/** Keeps a code field to six digits. */
export const codeDigits = (value: string) => value.replace(/\D/g, '').slice(0, 6);
