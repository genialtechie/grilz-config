# Worked example: VVS Lab

VVS Lab is a 3D grillz builder that jewelers put on their sites ($199/mo,
14-day trial). Its emails were rebuilt with this skill in October 2026. File
paths refer to that repository (`server/`, `scripts/`, `docs/brand/mascot/`).
Use this as a model of what each step produces, not as content to copy.

## Brand

| | Light | Dark |
| --- | --- | --- |
| Page (one surface) | cream `#fbf7f0` | ink `#1b1714` |
| Text | `#1b1714` | `#f3ede4` |
| Muted | `#6f655a` (5.3:1) | `#b5a995` |
| Headline italic | red `#ce4257` (4.3:1, large text) | `#ec7385` |
| Links | deep red `#b02f45` (5.9:1) | `#ec7385` |
| Button | red `#ce4257`, white text (4.6:1) | `#ec7385`, ink text |

Red is the product's accent (`--accent` in `src/App.css`); gold belongs to the
mark and the illustrations (the metal), not to type or buttons.

- Logo: the gold diamond "VVS" mark (`/assets/email/vvs-mark.png`, 2×).
- Mascot: **Karat** (`docs/brand/mascot/`), a gold fanged tooth with an
  iced-out grill and an eyebrow piercing. Cool closes every VVS footer; Wink
  welcomes; Hype celebrates wins (deposit paid); Nudge, Working and Tarnished
  are for reminders, loading and win-back. PNGs in `/assets/mascot/`.
- Socials: gold Instagram tile (`instagram-tile.png`); shops get the ink tile.
- Sign-off: "— The VVS Lab team" (shop mail: "— {shop name}").
- Type: Instrument Serif headlines (Georgia in Gmail), system sans body.
- Illustration style: Karat's: flat shapes, warm gold gradients, 5px ink
  outlines, 4-point sparkles, a cream sticker edge on dark backgrounds. Grillz culture: gold teeth,
  iced (pavé) stones, smiles. Source: `scripts/email-art.ts`.
- Voice: a jeweler's friend who knows the trade. Short, warm, confident.
  "Hey there," openings; no hype words.
- Two themes: **VVS Lab** (mail to jewelers) and **shop** (mail a shop's
  customers get: the shop's logo and accent, "Powered by VVS Lab").
- Legal line: Magpollo Corp · 2655 Daniel Park Run, Dacula, GA 30019.

## Emails

| Email | Stream | Status |
| --- | --- | --- |
| New design request (to shop) | transactional | redesigned |
| Photo follow-up (to shop) | transactional | redesigned |
| Customer confirmation (shop brand) | transactional | redesigned |
| Welcome / set up builder | transactional | redesigned + illustration |
| Team invite | transactional | redesigned |
| Sign-in link (Supabase template) | transactional | to do |
| Trial sequence (days 1, 3, 7, 12, 14) | marketing | built (`server/trialEmails.ts`, daily cron) |
| Announcements | marketing | built (`server/announcements.ts`, reviewed in PRs) |
| Win-back | marketing | built (`server/winback.ts`, daily cron) |

## Email plans

Written with the method in `planning.md`: moment → inbox row → first screen →
details → reference.

### New design request (to the jeweler)

- **Moment:** a customer just sent a design and is waiting; the shop that
  answers first usually wins. Read on a phone, between jobs.
- **Job:** judge the lead and reach the customer, fast.
- **Inbox row:** VVS Lab · "New design from Marcus Reed · $4,150" · preheader
  = their note in quotes (or what they designed).
- **First screen:** headline "New $4,150 design from *Marcus*" (who + worth
  it?) → the studio photo (what they want) → their note as a quote (urgency,
  intent) → **Text Marcus** button.
- **Details:** name, phone, email as tappable links (to call or copy); "What
  they designed" (what to make).
- **Reference (13px):** how the estimate adds up and which price list made
  it; whether the customer saw a "from"/hidden price; reply-to.
- **Cut:** eyebrow; the dotted subline (repeated the headline); the facts
  table (repeated name and estimate); the deposit (not paid when this sends;
  the dashboard shows when it is); the separate price lines (now one line of
  fine print).

### Customer confirmation (shop's brand, to the customer)

- **Moment:** they just tapped send: excited, slightly unsure it went through.
- **Job:** confirm it arrived, keep the design, say what happens next and what
  it costs.
- **Inbox row:** {shop} · "{shop} has your grillz design" · preheader "Next:
  they'll reach out on {contact}."
- **First screen:** headline "{shop} has your *design*" → "Thanks, Marcus.
  Your estimate is $4,150." → their design photo (a keepsake).
- **Details:** What happens next → the one button → "Your design" list.
  - With a pay link (shop takes card deposits, or has its own payment link):
    1. hold your spot with a deposit, 2. the shop contacts you. Button: **Pay
    $500 deposit** (a 30-day signed link, `GET /api/deposit`, that opens the
    shop's Stripe Checkout). Instagram drops to a text link.
  - Without: 1. the shop contacts you, 2. a deposit holds your spot and the
    shop will say how to pay. Button: **Message {shop}**.
- **Reference:** questions/reply, sign-off from the shop.

### Deposit paid (to the jeweler)

- **Moment:** a customer just paid: the lead became a job.
- **Job:** know the money is in, and book the next step with the customer.
- **Inbox row:** {shop} via VVS Lab · "Marcus Reed paid a $500 deposit" ·
  preheader "$3,650 left on the $4,150 estimate."
- **First screen:** headline "*Marcus* paid a $500 deposit" → "It's in your
  Stripe account and their spot is held." → **Text Marcus**.
- **Details:** contact links, what they designed, what's left to pay.
- **Reference:** paid through Stripe Checkout; refunds and payouts live in
  Stripe. Sent once, from the Stripe webhook.

### Studio photo follow-up (to the jeweler, same thread)

- **Job:** show the photo that was still rendering; same action as before.
- Headline "Marcus's *studio photo*" → photo → Text Marcus. Nothing else.

## Trial sequence

Built in `server/trialEmails.ts` (the emails) and `server/trialSequence.ts`
(which step is due), sent by `/api/cron/marketing` daily at 14:07 UTC (10am
Eastern) through `sendMarketingEmail` (topic `tips`). One email a day at
most; a step only goes inside its window (missed → skipped, never stacked);
each step once per shop (`trial-day-N:<tenant>`). Shops made by signup on a
running free trial only. Replies go to `MARKETING_REPLY_TO` (falls back to
`PLATFORM_LEADS_EMAIL`): the marketing domain doesn't receive mail.

| Step | When | Job | Subject | Karat | CTA | Skip if |
| --- | --- | --- | --- | --- | --- | --- |
| Day 1 | days 1–2 | Go live: their own checklist (logo, prices, switch on) | "Your builder is 10 minutes from live" | Nudge | Finish setting up | live |
| Day 3 | days 3–4 | Share: Instagram bio and website; not live → "Your builder is still switched off" with the checklist | "Put your builder where customers already are" | Cool | Get my link and embed code | had a design request |
| Day 7 | days 7–8 | Card deposits: paid up front, straight to their Stripe | "Take the deposit when they send the design" | Hype | Turn on card deposits | Stripe connected |
| Ending | 3 or 2 days left | Keep it on: their requests and estimates, what switches off, what's kept, $199/mo | "3 days left on your trial" | Nudge | Keep my builder on | card added |
| Last day | under a day left | Plain letter from Haleem: why not, or start the plan | "Last day of your trial" (from "Haleem at VVS Lab") | none | Start my plan (or reply) | card added |

## Win-back

`server/winback.ts`, in the daily marketing run, topic `tips`. For shops
paused because the trial ended without a plan, or the plan was cancelled;
not for a failed payment (billing) or a shop that left (offboarded). Keyed to
the pause, so a shop paused again later gets them again.

| When | Subject | Karat | Content | CTA |
| --- | --- | --- | --- | --- |
| +7 days (2-day window) | "Your builder is paused" | Tarnished | When and why it switched off; what's saved (designs, prices, N requests); $199/mo | Switch it back on |
| +30 days | "Should we stop emailing you?" | none (plain) | Last email about it; all still there; reply with why, or do nothing | Switch it back on |

## Announcements

`server/announcements.ts`, in the daily marketing run, topic `news`. One
hero feature per email. Each announcement is an entry in `ANNOUNCEMENTS`
(reviewed in a PR):
1. Add it with `audience: 'test'` and a `sendAt`: only `ANNOUNCE_TEST_TO`
   gets it on the next 14:07 UTC run.
2. Check it in a real inbox, then change `audience` to `'all'` in a PR.
   Each address gets each announcement once; every shop owner who isn't
   offboarded and hasn't opted out of news. Paced at about 1.6/s, up to 80
   a run; a bigger list finishes on the next runs, within 7 days of `sendAt`.

First one: "Get the deposit, even after they close the tab" (pay deposit
from the confirmation email, and the deposit-paid email), queued as a test
for Oct 19.

## Marketing setup

- **Sender:** `Karat from VVS Lab <hello@news.vvslab.magpollo.com>`. The
  subdomain is its own Resend domain (DKIM and SPF verified; DNS records in
  Vercel), so marketing complaints can't touch `vvslab.magpollo.com`, which
  carries lead and account mail. DMARC comes from `magpollo.com` (`p=none`).
- **Topics:** `tips` (trial sequence, win-back) and `news` (announcements). An opt-out can be one topic or `all`.
- **Every marketing send** goes through `sendMarketingEmail`
  (`server/marketing.ts`): it checks the opt-out list, claims the send in
  `email_sends` by `dedupe_key` (a step never goes twice), adds
  `List-Unsubscribe` + `List-Unsubscribe-Post`, and passes the unsubscribe
  link to the template for the footer.
- **Unsubscribe page** (`/api/unsubscribe`): a GET only shows a confirm page
  (mail scanners prefetch links); one click from the mail client or the
  page's button opts out; "all" and resubscribe are on the page.
- **Complaints and hard bounces** arrive on `/api/resend-webhook` and opt the
  address out of all marketing. Account and lead mail still go.

Done (Oct 18 2026): migration applied to production; Resend webhook for
`email.bounced` and `email.complained` with its secret in Vercel
(`RESEND_WEBHOOK_SECRET`), checked end to end with Resend's test addresses;
a test to Gmail landed in the inbox with SPF, DKIM and DMARC pass and the
one-click unsubscribe headers DKIM-signed. Warm-up: the trial sequence is
naturally slow (a few sends a day); keep any broadcast small at first.

## The revamp, step by step (do this for a new brand)

How the revamp actually ran, each step reviewed before the next:

1. **Reference first.** Collect the emails you want to be next to (screenshots
   of real ones, light and dark). Write down what they do (section 1), not
   just how they look.
2. **Brand object.** A `Brand` in `server/email/brand.ts`: the product's real
   accent (from its CSS, not a guess), fonts, logo, legal line, links,
   socials. Contrast: `highlight` 3:1, `link` 4.5:1, button text 4.5:1, in
   both modes.
3. **Kit.** One surface, logo, content column, the footer (section 3). On
   Vercel write server email code as `.ts` with `createElement` and confirm
   a production build bundles it.
4. **Plan every email from the smallest form out** (section 2): moment, inbox
   row, first screen, details, reference. Cut eyebrows, repeated facts and
   state you don't know. Look for gaps the plan exposes (VVS: a deposit with
   no way to pay it; no email when a deposit is paid) and close them.
5. **Build, then preview** phone/desktop × light/dark (`email-preview.ts`)
   with production URLs in the copy. Compare side by side with the reference.
6. **Mascot** (section 6), then put it in the emails.
7. **Marketing groundwork** (section 10): separate sending subdomain
   verified in the email provider, opt-out list per topic, send log with a
   dedupe key, one-click unsubscribe headers and page, complaint and bounce
   webhook.
8. **Sequences** (section 8): trial, announcements, win-back, each planned
   with section 2 and sent through the marketing sender.
9. **QA** (section 11) on real inboxes, then warm up the domain.

Lessons from the VVS Lab review rounds:
- Show the work as images, every round; feedback on a picture is fast.
- Accent colour comes from the product, not the logo metal.
- A preview fixture's colours get read as the brand: make fixtures use the
  brand's own values.
- Hierarchy is decided by what the reader does next, never by the data you
  happen to have.
