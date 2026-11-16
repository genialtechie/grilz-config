# Working on VVS Lab

## Asking questions and showing plans

- Ask every question with the multiple-choice question tool (the "slides"),
  never as a list in chat. One question per slide, a recommended option first,
  and each slide readable on its own.
- On design and UX work, show the plan (what, how, open choices) and get it
  approved before building. The owner leads on taste and UX.

## The redesign

- All redesign work goes on the `redesign` branch and is pushed there.
  Never push it to `main`, merge it, or change anything the live site
  (vvslab.magpollo.com) depends on until the owner says so.
- The living plan and the prototype are private Claude artifacts; their
  sources and a README are in `docs/redesign/`.
- The redesign goes into the owner's portfolio. After each round, add to the
  "Case study notes" tab of the plan page (what was made, the owner's verdict,
  the decision and why, craft details, numbers) and save dated screenshots of
  our own work to `docs/redesign/case-study/`.

## Choosing services and data sources

Before recommending a paid service, API key or new vendor, check the simple
path first: a public endpoint the data is already served from, a free API,
or something the stack already has. Try it (one request is usually enough),
then present the options with their real trade-offs — cost, reliability,
whether it's official, what the data actually is — and recommend one.

Example: live metal prices. The first instinct was a paid metals feed; a
plain REST call to Yahoo Finance's chart endpoint (no key) does the job, with
gold-api.com (free, no key) as the fallback. The trade-offs are recorded in
`server/metalPrices.ts`: Yahoo is unofficial and serves futures, not spot.
