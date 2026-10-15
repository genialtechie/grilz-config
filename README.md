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

## AI photo render

The review step ("Your photo") turns the 3D preview into a studio photo with
FLUX.2 pro (Black Forest Labs). The customer leaves their name and Instagram or
phone first; the render starts in the background as soon as they click into the
form, so the photo is usually ready when they submit.

- `api/render.ts` is the Vercel function; `server/render.ts` holds the logic and
  also serves `/api/render` during `npm run dev`.
- The browser sends a structured design only. The prompt is built on the server
  (`src/lib/renderSpec.ts`), so the endpoint can't generate arbitrary images.
- Set `FLUX_API_KEY` in Vercel (Production and Preview) and in `.env.local` for
  local work. Never prefix it with `VITE_`.
- Cost guards: 3 renders per visitor (browser), a best-effort per-IP throttle,
  and an optional daily cap via Upstash Redis (`UPSTASH_REDIS_REST_URL`,
  `UPSTASH_REDIS_REST_TOKEN`, `RENDER_DAILY_CAP`, default 100 renders/day).
  Also add a Vercel Firewall rate-limit rule on `/api/render` (e.g. 5 per 10
  minutes per IP) and keep auto top-up off in the BFL account.
- Option photo cards live in `public/assets/options/grillz/` (generated once
  with FLUX; regenerate with the same seed and framing to keep the set matched).

Mixed designs (e.g. 1 iced tooth in a plain set) get masked edits: the client
captures a black-and-white mask of each tooth group that differs from the
majority (same camera and crop as the preview), and the server repaints each
group with `flux-pro-1.0-fill` after the main render. Uniform designs skip
this. Each extra group adds about $0.05 and 15–20s; at most 3 groups, and
`api/render.ts` has `maxDuration: 120`.

Fangs and inscriptions also use masked edits, so they land on the right
teeth: fangs repaint the two upper canines with the mask stretched downward
(room for the point), and an inscription ("Initials or text" in Make it
yours, up to 6 characters, tooth picked on the model) writes the text on that
one tooth. Explicit extras win the 3 edit slots first; execution order is
mixed groups, then fangs, then the inscription. The server only accepts masks
that match the plan it computes itself (`planMasks` in renderSpec.ts).

Lead events: `sample_lead_submitted` (contact + full design),
`sample_render_started|completed|failed`, `sample_step_viewed`,
`sample_deposit_clicked`.

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

All events also carry `offer=jeweler_builder`. The PostHog project and the
"Jeweler sprint" dashboard can be (re)created with `scripts/setup_posthog.py`.

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
