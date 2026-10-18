import type { RenderSpec } from './renderSpec';

// Browser side of POST /api/leads.

export type LeadSubmission = {
  tenant: string;
  configVersion: number;
  name: string;
  contact: string;
  email?: string;
  note?: string;
  spec: RenderSpec;
  preview: string;
  /** Whether a studio photo will be requested for this lead. */
  photo: boolean;
  turnstile?: string;
  /** Honeypot: always empty for people. */
  website?: string;
  elapsedMs: number;
};

export type LeadReceipt = { leadId: string; token: string };

export type LeadOutcome = { ok: true; receipt: LeadReceipt } | { ok: false; error: string; code: string };

/** UTM tags, the landing path and the referring site (host only), never personal data. */
export function leadSource(): Record<string, string> {
  const source: Record<string, string> = { path: window.location.pathname };
  const params = new URLSearchParams(window.location.search);
  for (const key of ['utm_source', 'utm_medium', 'utm_campaign', 'utm_content', 'utm_term']) {
    const value = params.get(key);
    if (value) source[key] = value.slice(0, 120);
  }
  // Embedded on the shop's own website: embed.js passes the site's hostname.
  const embed = params.get('embed');
  if (embed && /^[a-z0-9.-]{1,253}$/i.test(embed)) source.embed = embed.toLowerCase();
  // On the shop's own domain (build.theirshop.com).
  if (document.querySelector('meta[name="vvs-shop"]')) source.domain = window.location.host.toLowerCase();
  try {
    if (document.referrer) source.ref = new URL(document.referrer).host;
  } catch {
    // ignore malformed referrers
  }
  return source;
}

export async function submitLead(submission: LeadSubmission): Promise<LeadOutcome> {
  try {
    const response = await fetch('/api/leads', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...submission, source: leadSource() }),
    });
    const body = (await response.json().catch(() => ({}))) as { leadId?: string; token?: string; error?: string; code?: string };
    if (!response.ok || !body.leadId) {
      return { ok: false, error: body.error ?? 'Something went wrong. Please try again.', code: body.code ?? `http_${response.status}` };
    }
    return { ok: true, receipt: { leadId: body.leadId, token: body.token ?? '' } };
  } catch {
    return { ok: false, error: 'Could not send your design. Check your connection and try again.', code: 'network' };
  }
}
