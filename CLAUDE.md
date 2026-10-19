# Working on VVS Lab

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
