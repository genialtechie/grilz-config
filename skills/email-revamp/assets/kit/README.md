# Reference kit (from VVS Lab)

The working implementation the skill was developed on: React Email on
Vercel (Node functions), Supabase (Postgres via PostgREST) and Resend.
Imports point at that repository; adapt them to the new project.

| File | What it is |
| --- | --- |
| `brand.ts` | The `Brand` type and two brands: the product's own, and a white-label one for mail sent on a customer's behalf |
| `components.ts` | The kit: EmailFrame (one surface, logo, footer), Headline (`*accent*` word), Paragraph, CTA, Quote, Steps, Checklist, Photo, Illustration, SignOff. Written with `createElement` in `.ts` so Vercel bundles it |
| `marketing.ts` | Marketing sender: opt-outs, send log with dedupe key, one-click unsubscribe headers, unsubscribe page, Resend webhook (Svix) for complaints and bounces |
| `marketing_email.sql` | Tables for opt-outs and the send log |
| `trialSequence.ts`, `trialEmails.ts` | Behaviour-based trial sequence: the step picker and the five emails |
| `winback.ts` | Two-email win-back keyed to the lapse date |
| `announcements.ts` | Announcements as reviewed code entries, test audience first |
| `email-preview.ts` | Renders every email at phone/desktop, light/dark with Playwright |
| `mascot-model.ts` | The mascot as code: one set of parts, expressions, turnaround, PNG and icon exports |
