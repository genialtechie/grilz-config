# VVS Lab email: brand and plan

Brand-specific companion to [`PLAYBOOK.md`](PLAYBOOK.md).

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

- Logo: the gold diamond "VVS" mark (`/assets/email/vvs-mark.png`, 2×); the
  footer closes with the app icon (`vvs-icon.png`: the mark on ink, gold edge).
- Socials: gold Instagram tile (`instagram-tile.png`); shops get the ink tile.
- Sign-off: "— The VVS Lab team" (shop mail: "— {shop name}").
- Type: Instrument Serif headlines (Georgia in Gmail), system sans body.
- Illustration style: flat shapes, warm gold gradients, 5–7px ink outlines,
  4-point sparkles, a cream sticker edge, a speech bubble for character. Grillz culture: gold teeth,
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
| Trial sequence (days 1, 3, 7, 12, 14) | marketing | planned below |
| Announcements | marketing | to do |
| Win-back | marketing | to do |

## Email plans

Written with the method in PLAYBOOK §2: moment → inbox row → first screen →
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

## Trial sequence plan

Send by behaviour: skip a step the shop has already done (published prices,
went live, got a design request, added a card).

| Day | Job | Subject ideas | CTA | Skip if |
| --- | --- | --- | --- | --- |
| 1 | Go live: logo, prices, switch it on | "Your builder in 10 minutes" | Finish setting up | already live |
| 3 | Share it: put the link in the Instagram bio, the embed on the site | "Put your builder where customers already are" | Copy my link | had a design request |
| 7 | Proof: what another shop's customers designed; deposits by card | "How shops close custom sets faster" | Turn on card deposits | Stripe connected |
| 12 | Trial ending: recap their designs/requests, what $199/mo keeps | "2 days left on your trial" | Keep my builder on | card added |
| 14 | Last day, plain letter from Haleem | "Today's the last day" / "One quick question for you" | Start my plan (or reply) | card added |

Win-back (after the day-14 gate, or a cancelled plan): +7 days "your builder
is paused, your designs are saved", +30 days "what's new", then stop.
