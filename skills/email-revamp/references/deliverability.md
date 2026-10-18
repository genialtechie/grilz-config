# Deliverability, compliance and the marketing groundwork

## Deliverability and compliance

- **Separate streams.** Transactional (sign-in, receipts, lead
  notifications) on one subdomain, marketing on another (e.g.
  `mail.brand.com` / `news.brand.com`), so a marketing complaint can't sink
  the emails that make money.
- **Authentication:** SPF and DKIM (2048-bit) and DMARC aligned to the From
  domain; DMARC with an `rua` report address, moving from `p=none` toward
  `quarantine`. Warm up a new domain gradually.
- **Gmail/Yahoo bulk-sender rules:** spam complaints under 0.1% (never 0.3%);
  marketing mail needs one-click unsubscribe:
  `List-Unsubscribe: <https://…>` and
  `List-Unsubscribe-Post: List-Unsubscribe=One-Click`, with the endpoint
  answering a POST with 200/202, plus a visible unsubscribe link. Honour it
  within 2 days.
- **CAN-SPAM:** truthful From and subject, a physical address, a working
  opt-out honoured within 10 business days that needs nothing more than one
  click or page.
- **How the kit does it:** `server/marketing.ts` (opt-out check, send log
  with a dedupe key, one-click headers, unsubscribe page, complaint/bounce
  webhook). Reuse it rather than Resend Broadcasts when sends are triggered
  by product events.
- **Resend:** Contacts are global and grouped into **Segments** (formerly
  Audiences); **Topics** are per-category opt-ins; **Broadcasts** send to a
  Segment with `{{{RESEND_UNSUBSCRIBE_URL}}}` and test sends; **Automations**
  run event-triggered sequences. Verify the unsubscribe headers on a real send
  ("Show original" in Gmail).

## The groundwork, concretely

Build this before the first marketing email:

1. **Marketing subdomain** in the email provider (e.g. `news.<product domain>`),
   DNS records added (DKIM TXT, SPF TXT, bounce MX), verified. Keep the lead
   and account domain separate. The marketing domain usually can't receive
   mail, so give every marketing send a reply-to that reaches a person.
2. **Tables**: `email_unsubscribes(email, topic|'all', source)` and
   `email_sends(dedupe_key unique, kind, topic, email, status, provider id)`,
   server-only.
3. **One send function** for marketing that: checks opt-outs (topic or all) →
   claims the send by inserting the dedupe key (a unique-violation means
   "already sent") → renders with the unsubscribe URL → sends with
   `List-Unsubscribe: <url>` and `List-Unsubscribe-Post:
   List-Unsubscribe=One-Click` → records the outcome.
4. **Unsubscribe endpoint**: signed, non-expiring links (HMAC of the address).
   GET shows a confirm page only (mail scanners prefetch links); POST acts:
   the client's one-click body, "this topic", "all", "resubscribe".
5. **Webhook** from the provider (verify the signature, e.g. Svix): spam
   complaints and hard bounces opt the address out of all marketing; soft
   bounces don't.
6. **After deploy**: apply the migration, register the webhook and store its
   secret, test it end to end with the provider's test addresses (Resend:
   `complained@resend.dev`, `bounced@resend.dev`), send one email to a real
   Gmail inbox and read the headers (SPF, DKIM, DMARC pass; unsubscribe
   headers present and DKIM-signed).

`assets/kit/marketing.ts` and `assets/kit/marketing_email.sql` are the VVS
Lab implementation of all of the above.

## Pre-send QA checklist

1. SPF, DKIM, DMARC pass and align (Gmail → Show original).
2. Marketing: List-Unsubscribe headers present; a test POST unsubscribes;
   the body link works; the address is in the footer.
3. Subject ≤ ~45 chars, preheader adds information, sender name right.
4. Every merge field has a fallback; tested with an empty name.
5. `email-preview.ts`: phone and desktop, light and dark, all look right.
6. Real sends to Gmail (web + iPhone app) and Apple Mail (iPhone), dark mode
   on; Outlook if the audience uses it.
7. Images off: still makes sense; every image has alt text.
8. HTML under ~80 KB.
9. Every link resolves, UTM tags on marketing links, nothing points at
   localhost or a preview deployment, one primary CTA.
10. Contrast passes (body/links 4.5:1, headline 3:1), body ≥ 16px.
11. Plain-text version present and readable.
12. Right segment and topic, suppressions applied, send time sensible.
13. A second person approves; volume within the warm-up plan.
