---
name: email-revamp
description: Plan, design, build and ship a product's email to the standard of the best (Wispr Flow, Linear, Stripe, Duolingo) - transactional emails, a mascot, marketing groundwork (separate sending domain, one-click unsubscribe, opt-outs, send log, bounce/complaint webhook), trial sequence, win-back and announcements, with design-review rounds the user approves. Use this whenever someone wants their emails redesigned or "best in class", wants a welcome/onboarding/trial/lifecycle/win-back/announcement email or sequence, asks for an email design system or React Email kit, wants a brand mascot for their product, or needs marketing email set up properly (deliverability, unsubscribe, CAN-SPAM, Gmail/Yahoo sender rules) - even if they only mention one email or say "make our emails better".
---

# Email revamp

A repeatable way to take a product's email from "works" to "holds its own next
to Wispr Flow, Linear and Stripe", built and shipped, not just mocked up. It
was developed on a real product (VVS Lab, a 3D grillz builder for jewelers);
`references/vvs-lab-example.md` is that worked example end to end.

The method in one line: **reference first, plan every email from the inbox row
out, build one design system, show the work as images every round, then lay
the marketing groundwork before any marketing email goes out.**

## How to work with the user

This is design work with a person who has taste and a brand. What made it
work, learned the hard way:

- **Show images, every round.** Render every email at phone width (light and
  dark) and send the PNGs. Feedback on a picture takes seconds; feedback on a
  description is guesswork. Combine several emails into one strip image when
  comparing.
- **One approved round at a time.** Don't skip ahead (e.g. drawing a full
  mascot before the silhouette is chosen). Each round ends with a clear
  question: "which one?", "does this read as X?".
- **Recommend, don't just list.** When offering options, say which you'd pick
  and why, grounded in the brand's own material (its site CSS, hero images,
  voice), not in what's cute.
- **Read their feedback literally, then fix the cause.** "Those don't look
  like teeth" means the drawing lacks the real detail, not "make it bigger".
  "The eyebrows are disgusting" means remove the eyebrow labels and rethink
  the hierarchy, not restyle them.
- **Never invent claims.** No made-up stats, testimonials or "most shops do
  X". Use the product's real numbers or say nothing. Every promise in copy
  (data is kept, a link works for 30 days) must be true in the code.
- **Ask before anything outward-facing**: DNS records, sending to real
  customers, production migrations. A test send to the user's own inbox is
  fine once they've asked for the setup.

## The revamp, step by step

Each step ends with something the user can look at.

1. **Reference.** Ask for 1–3 emails they want to be next to (screenshots,
   ideally light and dark). Note what those emails *do* (one surface, one
   visual, one ask...) using `references/best-in-class.md`. If they have no
   reference, show them the patterns there and pick one together.
2. **Brand object.** Read the product's real colours from its CSS (the accent
   is in the app, not the logo; a gold logo doesn't make gold the accent),
   its fonts, logo, legal name and street address, socials. Check contrast
   with `scripts/contrast.py` (links and body 4.5:1, headline word 3:1,
   button text 4.5:1, light and dark). See `references/design-system.md`.
3. **Kit.** One surface, centred logo, content column, footer. For a
   TypeScript/React stack, start from `assets/kit/` (React Email components,
   brand object, preview script); otherwise port the same anatomy. Check the
   production build actually bundles the email code (on Vercel, server files
   must be `.ts`; `.tsx` is silently left out).
4. **Plan each email from the smallest form out** before any layout:
   moment → inbox row → first screen → details → reference, and audit every
   element ("why does this reader need it now, what will they do with it?").
   This is the most important step; see `references/planning.md`. Planning
   usually exposes product gaps (VVS: a deposit customers couldn't pay from
   the email; no email when a deposit was paid). Raise them and close them.
5. **Build and preview.** Render phone and desktop, light and dark, with
   production URLs in the copy (never `localhost` in visible text). Preview
   fixtures must use the brand's own colours, or the user will read a
   fixture's colour as the brand.
6. **Mascot** (if the brand wants an owned visual). Brief → silhouettes with
   a shrink test → brand fit → face with real details → expressions →
   turnaround and exports → name. `references/mascot.md`. Then use it in the
   emails: resting face in every footer, win face on win emails.
7. **Marketing groundwork** before any marketing email: separate sending
   subdomain, opt-out list per topic, send log with a dedupe key, one-click
   unsubscribe headers and a confirm page, complaint/bounce webhook.
   `references/deliverability.md` (with the reference code in
   `assets/kit/marketing.ts`).
8. **Sequences**: trial (behaviour-based, windows, days-left for the ending),
   win-back (lapsed state, two emails, stop), announcements (code entries,
   test audience first, reviewed twice). `references/sequences.md`.
9. **QA and ship.** The pre-send checklist in `references/deliverability.md`,
   a real send to Gmail with headers checked (SPF, DKIM, DMARC pass;
   List-Unsubscribe present), then warm up slowly.

## Rules that do most of the work

These come up in every email; the reasons are why they matter.

- **One surface, one visual, one ask.** A single background colour edge to
  edge, the one illustration or the user's own content, one button with verb
  + object. Every extra element competes with the one thing the email is for.
- **Each fact appears once.** A subline that repeats the headline, or a table
  that repeats the list, reads as clutter and buries what's new.
- **Five sizes only**: headline 44–54px · hero visual · body 17px · details
  15–16px · fine print 13px. Importance decides the tier, not the data type.
- **No eyebrows or shouty uppercase labels.** The headline already says what
  the email is; small caps above it are noise people notice.
- **People's own words beat fields.** A customer's note as a quote; their own
  numbers as the hero ("3 design requests, worth $9,450").
- **Don't show state you don't know** (a deposit that may not be paid yet).
- **Transactional stays transactional**: no promotions in receipts or sign-in
  mail, and no unsubscribe on it; marketing always has one.

## Reference files

| File | Read when |
| --- | --- |
| `references/best-in-class.md` | Starting out; choosing the bar; sources |
| `references/planning.md` | Planning any email (do this before designing it) |
| `references/design-system.md` | Brand object, type, colour, dark mode, client support, kit anatomy |
| `references/mascot.md` | Designing a mascot or illustration style |
| `references/sequences.md` | Copy rules; trial, win-back, announcement mechanics |
| `references/deliverability.md` | Domains, unsubscribe, opt-outs, webhooks, compliance, QA checklist |
| `references/vvs-lab-example.md` | A complete worked example: brand, plans, sequences, setup, lessons |

`assets/kit/` holds the reference implementation from the VVS Lab repo
(React Email on Vercel + Supabase + Resend). Its imports point at that repo:
treat it as a pattern to adapt, not a drop-in package. `scripts/contrast.py`
checks a palette's WCAG contrast.
