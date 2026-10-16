// Contact checks shared by the lead form and the lead API.

const IG = /^@?[a-z0-9._]{1,30}$/i;
const digits = (value: string) => value.replace(/\D/g, '');

/** An Instagram handle or a US phone number, normalised; null if it is neither. */
export function normaliseContact(raw: string): { kind: 'instagram' | 'phone'; value: string } | null {
  const value = raw.trim();
  if (/^[\d\s()+.-]+$/.test(value)) {
    const phone = digits(value);
    if (phone.length === 10) return { kind: 'phone', value: `+1${phone}` };
    if (phone.length === 11 && phone.startsWith('1')) return { kind: 'phone', value: `+${phone}` };
    return null;
  }
  const handle = value.replace(/^@/, '');
  if (IG.test(value) && !/^\.|\.\.|\.$/.test(handle)) return { kind: 'instagram', value: `@${handle.toLowerCase()}` };
  return null;
}

export const isEmail = (value: string) => value.length <= 120 && /^[^@\s]+@[^@\s]+\.[^@\s]{2,}$/.test(value);

/** "(555) 555-0100" for a +1 number, the handle otherwise. */
export const displayContact = (value: string) => {
  if (!/^[\d\s()+.-]+$/.test(value)) return value;
  const match = value.replace(/\D/g, '').match(/^1?(\d{3})(\d{3})(\d{4})$/);
  return match ? `(${match[1]}) ${match[2]}-${match[3]}` : value;
};
