# VVS Lab email: brand and plan

Brand-specific companion to [`PLAYBOOK.md`](PLAYBOOK.md).

## Brand

| | Light | Dark |
| --- | --- | --- |
| Page (one surface) | cream `#fbf7f0` | ink `#1b1714` |
| Text | `#1b1714` | `#f3ede4` |
| Muted | `#6f655a` (5.3:1) | `#b5a995` |
| Headline italic | gold `#a87b23` (3.6:1, large text only) | `#e2b85e` |
| Links | deep gold `#7a5714` (6.1:1) | `#e2b85e` |
| Button | ink with cream text | gold with ink text |

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
