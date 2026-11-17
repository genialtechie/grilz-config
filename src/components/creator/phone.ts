// Phone numbers as people type them (US, as the lab): digits only, and "(555) 012-3456".

/** The 10 digits of a US number (a leading 1 dropped). */
export function digits(s: string) {
  const d = String(s || '').replace(/\D/g, '');
  return d.length === 11 && d[0] === '1' ? d.slice(1) : d;
}

/** "(555) 012-3456", formatted as far as it has been typed. */
export function formatPhone(s: string) {
  const d = digits(s).slice(0, 10);
  if (d.length < 4) return d;
  if (d.length < 7) return `(${d.slice(0, 3)}) ${d.slice(3)}`;
  return `(${d.slice(0, 3)}) ${d.slice(3, 6)}-${d.slice(6)}`;
}

/** What's missing before a code can be sent, and which field to fix: null when ready. */
export function contactError(name: string, phone: string): { field: 'name' | 'phone'; text: string } | null {
  if (name.trim().length < 2) return { field: 'name', text: 'Add your first name.' };
  if (digits(phone).length !== 10) return { field: 'phone', text: 'Add your 10-digit phone number.' };
  return null;
}
