# MagPollo custom commerce demo

The Vite application behind `commerce.magpollo.com`. It contains the marketing
landing page and the interactive sample configurator.

## Development

```bash
npm install
npm run dev
```

Copy `.env.example` to `.env.local` and provide the PostHog project token and
host. Local development traffic is excluded from PostHog automatically.

## Campaign analytics

The application records this conversion path:

1. `commerce_landing_viewed`
2. `sample_configurator_cta_clicked`
3. `sample_configurator_opened`
4. `sample_design_started`
5. `sample_design_reviewed`
6. `sample_configuration_completed`

`contact_clicked` is a separate intent event because a visitor can contact
MagPollo from the landing page without completing the configurator.

All new external events include `analytics_version=commerce_v2`,
`traffic_type=external`, first-session campaign attribution, and the landing
path. Use those two fixed properties to keep new reports separate from the old
mixed traffic.

Use standard UTM parameters on outbound links. Keep values descriptive but do
not include a person's name, email address, or other personal information.

```text
https://commerce.magpollo.com/?utm_source=outbound&utm_medium=email&utm_campaign=commerce_jewelry&utm_content=kinn
```

Recommended conventions:

- `utm_source`: `outbound`, `linkedin`, `atv`, or the referring partner
- `utm_medium`: `email`, `dm`, `event`, or `referral`
- `utm_campaign`: the stable offer or campaign name, such as `commerce_jewelry`
- `utm_content`: a company or message-variant slug, never personal data

## Excluding internal traffic

Open this URL once in every MagPollo browser used to review the live site:

```text
https://commerce.magpollo.com/?mp_internal=1
```

The setting remains in that browser and events are dropped before they are sent
to PostHog. The control parameter is removed from the visible URL immediately.

To restore normal tracking in a browser:

```text
https://commerce.magpollo.com/?mp_internal=0
```
