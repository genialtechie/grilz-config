// Email through Resend. Without RESEND_API_KEY nothing is sent and callers
// record the lead as "email skipped", so leads are never lost. Marketing mail
// goes out from its own subdomain (EMAIL_MARKETING_FROM_DOMAIN), so a
// complaint about a newsletter can't hurt the reputation lead mail relies on.

export type EmailEnv = {
  RESEND_API_KEY?: string;
  EMAIL_FROM_DOMAIN?: string;
  /** Marketing sender domain; marketing mail isn't sent without it. */
  EMAIL_MARKETING_FROM_DOMAIN?: string;
  /** Tests point this at a local mock. */
  RESEND_BASE_URL?: string;
};

export type Attachment = { filename: string; content: Uint8Array; contentId: string; contentType: string };

export type Email = {
  fromName: string;
  /** Sender mailbox on the email domain: leads@ (default) for lead mail, hello@ for account mail. */
  fromLocal?: 'leads' | 'hello';
  /** marketing: sent from the marketing subdomain. */
  stream?: 'transactional' | 'marketing';
  to: string[];
  subject: string;
  html: string;
  text: string;
  replyTo?: string[];
  attachments?: Attachment[];
  headers?: Record<string, string>;
};

export type SendResult = { ok: true; id: string } | { ok: false; reason: 'not_configured' | 'rejected' | 'unreachable'; detail?: string };

export const fromDomain = (env: EmailEnv, stream: Email['stream'] = 'transactional') =>
  stream === 'marketing' ? env.EMAIL_MARKETING_FROM_DOMAIN ?? '' : env.EMAIL_FROM_DOMAIN || 'vvslab.magpollo.com';

/** Display names can't carry quotes or angle brackets into the From header. */
const safeName = (name: string) => name.replace(/["<>\r\n]/g, '').slice(0, 60);

/** Sends once, and retries once after a short pause if Resend is unreachable or busy. */
export async function sendEmail(email: Email, env: EmailEnv): Promise<SendResult> {
  const first = await sendOnce(email, env);
  if (first.ok || first.reason === 'not_configured' || (first.reason === 'rejected' && !/^(429|5\d\d)/.test(first.detail ?? ''))) return first;
  await new Promise((resolve) => setTimeout(resolve, 2000));
  return sendOnce(email, env);
}

async function sendOnce(email: Email, env: EmailEnv): Promise<SendResult> {
  if (!env.RESEND_API_KEY || !fromDomain(env, email.stream)) return { ok: false, reason: 'not_configured' };
  if (email.to.length === 0) return { ok: false, reason: 'rejected', detail: 'no recipients' };
  try {
    const response = await fetch(`${env.RESEND_BASE_URL || 'https://api.resend.com'}/emails`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${env.RESEND_API_KEY}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        from: `${safeName(email.fromName)} <${email.fromLocal ?? 'leads'}@${fromDomain(env, email.stream)}>`,
        to: email.to,
        subject: email.subject.replace(/[\r\n]+/g, ' ').slice(0, 200),
        html: email.html,
        text: email.text,
        reply_to: email.replyTo?.length ? email.replyTo : undefined,
        headers: email.headers,
        attachments: email.attachments?.map((item) => ({
          filename: item.filename,
          content: Buffer.from(item.content).toString('base64'),
          content_id: item.contentId,
          content_type: item.contentType,
        })),
      }),
    });
    const body = (await response.json().catch(() => ({}))) as { id?: string; message?: string };
    if (!response.ok || !body.id) return { ok: false, reason: 'rejected', detail: `${response.status} ${body.message ?? ''}`.trim() };
    return { ok: true, id: body.id };
  } catch (error) {
    return { ok: false, reason: 'unreachable', detail: error instanceof Error ? error.message : String(error) };
  }
}
