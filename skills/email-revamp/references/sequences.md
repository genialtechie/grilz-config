# Copy and sequences

## Copy

- Write like a person at the brand, not like the brand. Contractions, short
  sentences, plain words.
- One idea per email; say it in the subject, the headline and the button.
- Subject ≤ ~45 characters; preheader adds information.
- Specific numbers and names over adjectives.
- Every merge field has a fallback (`{{first_name|there}}`); test with an
  empty name.
- Transactional emails stay transactional: no promotions in receipts or
  sign-in mail (it changes their legal status).

## Sequences

### Trial (14 days, B2B to small shop owners)

Send by behaviour, not only by day: skip a step the user has already done.

| Day | Job | CTA |
| --- | --- | --- |
| 1 | Activation: the one action that makes the product real | Open / build the first thing |
| 3 | Show the money: how this earns or saves them money | Use the feature that pays |
| 7 | Proof and depth: a peer's result + one advanced feature | Try the advanced feature |
| 12 | Trial ending: recap what they built and what they'd lose | Keep my account |
| 14 | Last day: plain founder letter, offer help | Upgrade (secondary: reply to me) |

**How the kit runs it** (VVS Lab: `server/trialSequence.ts`): a daily cron
computes each shop's state (setup progress, live, requests, payments set up,
card) and picks the one step due. Rules that matter:
- at most one email per person per day;
- each step has a window (e.g. days 3–4); outside it the step is skipped,
  so an outage never dumps three emails at once;
- the ending emails count *days left*, not days since signup, so "last day"
  can't arrive after the trial ended;
- each step is claimed once in the send log (`trial-day-3:<account>`);
- the founder letter comes from a person's name and needs a reply-to that
  reaches a real inbox (marketing subdomains usually don't receive mail).

### Win-back

No guilt, a loss-framed fact, one easy way back (Duolingo). Typical cadence:
30 days inactive → +7 days with something new → a final "should we stop
emailing you?" → suppress.

### Announcements

Either one hero feature per email (Wispr) or a strict digest grid (Stripe:
image, title, two lines, "Learn more"). Credit the users who asked for it
(Arc). A monthly founder letter works well (Raycast).

**How the kit runs them** (VVS Lab: `server/announcements.ts`): each
announcement is a code entry reviewed in a PR, sent by the daily run. It
starts with `audience: 'test'` (only the test inbox gets it); flipping to
`'all'` in a second PR sends it to everyone, once per address, skipping
opt-outs, paced under the provider's rate limit and spread over several runs
for big lists. Two reviews, no "oops, sent to everyone" button.

### Win-back mechanics

Trigger on the state that means "lapsed" (VVS Lab: paused after a trial with
no plan, or a cancelled plan), never on a billing failure (that's dunning) or
an account that asked to leave. Key the send to the lapse date, so someone
who comes back and lapses again gets the sequence again. Keep it to two
emails: the loss-framed fact with what's saved, then "should we stop?".

## Picking the step: the pattern

```
for each account on the journey:
  state = what they've done (setup, live, first value, payment set up, card)
  step  = the one step whose window contains today and whose skip-condition is false
  send through the marketing sender with dedupeKey = "<step>:<account>"
```

Unit-test the picker with a fixed clock (walk an account that does nothing
through every day; check each skip; check a missed window is skipped), and
integration-test the whole run against a real database with the email
provider mocked.
