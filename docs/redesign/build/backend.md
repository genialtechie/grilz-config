# Backend track

Owns `server/*`, `api/*`, `src/lib/phoneAuth.ts`, `src/lib/describe.ts`, migrations, `server/__tests__`.

## Done (Nov 17)

- **Phone codes, browser** (`src/lib/phoneAuth.ts`). Firebase phone auth: an invisible reCAPTCHA, then
  `signInWithPhoneNumber`, then `confirm(code)`; the token is the Firebase ID token. The Firebase SDK is
  imported only when a code is sent, so the builder bundle doesn't carry it. Contract kept
  (`startPhoneCode`, `confirmPhoneCode`, `rememberedPhone`); added `freshPhoneToken()` and `forgetPhone()`.
  Without `VITE_FIREBASE_*` it behaves like the old stand-in (any 6 digits, token `dev:<10 digits>`).
- **Phone codes, server** (`server/phoneAuth.ts`). `verifyPhoneToken` checks the ID token with
  `firebase-admin` (loaded lazily) and reads the phone only from a phone sign-in. Dev tokens pass only with
  `ALLOW_DEV_PHONE=1`, and never when `VERCEL_ENV=production`.
- **Leads** (`server/leads.ts`). Optional `phoneToken`: when sent, the verified phone is the contact and
  the typed contact is not needed (a handle sent with it is kept on the lead's `created` event). A token
  that doesn't verify gets `401 unverified`, never a silent fallback to the typed contact. No token: as
  before. `phone_verified` is stored on the lead. Turnstile, honeypot and rate limits unchanged.
  `phoneToken?: string` added to `LeadSubmission` in `src/lib/leads.ts`.
- **Describe it** (`server/describe.ts`, `server/describeSpec.ts`). `POST /api/describe`
  `{tenant, words?, picture?, phoneToken, current?}` → `{ok, spec, note, closest, buildsLeft}` or
  `{ok:false, error, code: no_builds_left | unverified | failed}`.
  1. Phone token checked. 2. One of the phone's 3 free builds is taken under a database lock
  (`use_describe_build`), which also refuses when the shop's monthly AI allowance or the platform's daily
  photo budget is used up, or AI builds hit their own daily cap. 3. One OpenAI Responses API call with
  strict JSON-schema output. 4. The answer is clamped onto the shop's catalogue and validated with
  `parseRenderSpec`, like any design from a browser. A failed call or an answer that doesn't validate gives
  the build back. Every reply that returns a design counts, small changes too.
- **Migration** `20261117000001_phone_and_describe.sql`: `leads.phone_verified`, `create_lead` taking it,
  `describe_builds` (no anon/authenticated access), `use_describe_build()`. Applied cleanly on a scratch
  Postgres 16 after all earlier migrations (pg_net stubbed out); the limits and refusals were checked there.
- **Routing**: `/api/describe` is rewritten to `/api/render?route=describe` (the Hobby plan caps the project
  at 12 functions and it is at 12). The Vite dev server serves `/api/describe` too.
- **Lint**: `eslint.config.js` now skips `docs/redesign/creator-lab` (script fragments, like the prototype).
  `npm run lint` was failing on the redesign branch before this.

## Decisions and why

- **The model only picks ids.** The JSON schema's enums are the shop's own options (nothing else can come
  back), the instructions carry the catalogue but none of the shopper's text, and their words go in the
  user message fenced as untrusted data. The model returns a plan (teeth per row, a look, which teeth it
  applies to, two-tone, fangs, cut, letters, and the plain-words differences); the server builds the
  design from it. Differences are stripped of markup and links and capped at 4 short sentences.
- **Closest match** follows the prototype's `wish()`: 6 × 6 when no teeth were named on a new build; fangs
  add teeth to reach the upper canines; stones take a solid or open face; iced combinations outside the
  shop's all-in price table move to the nearest offered (`nearestOffered`); letters that don't fit say so.
- **Budgets**: an AI build costs a fraction of a cent, so it doesn't spend the shop's photo generations,
  but it stops when they are used up (a shop with no AI plan has no AI builds) and when the platform's
  daily photo budget is reached, plus its own daily cap (`DESCRIBE_DAILY_LIMIT`, default 600). The cost of
  each build is recorded on `describe_builds.cost_usd`.
- **Phones are counted by a salted hash**, never stored for the quota. The 3 builds are per phone across
  all shops (it's the platform's spend). Fails closed: no database answer, no AI call.
- **Firebase tokens last an hour.** `describeBuild` refreshes the remembered phone's token through
  Firebase (the sign-in stays on the device) and returns `unverified` when it can't, so the UI asks for a
  new code.
- **firebase-admin rather than hand-checking Google's keys**: it's the official path, handles key rotation
  and revocation rules, and is imported only by the requests that check a token.

## Env vars (names only)

| Name | Where | What |
|---|---|---|
| `VITE_FIREBASE_API_KEY`, `VITE_FIREBASE_AUTH_DOMAIN`, `VITE_FIREBASE_PROJECT_ID`, `VITE_FIREBASE_APP_ID` | Vercel prod + preview | Firebase web app config (browser) |
| `FIREBASE_SERVICE_ACCOUNT` (JSON, one line) or `FIREBASE_PROJECT_ID` | Vercel prod + preview | Server checks ID tokens |
| `PHONE_HASH_SECRET` | Vercel prod + preview | Salt for the phone hash (falls back to `LEAD_TOKEN_SECRET`; changing it resets everyone's free builds) |
| `OPENAI_API_KEY` | already set | Describe it uses the same key as the studio photo |
| `OPENAI_DESCRIBE_MODEL`, `OPENAI_DESCRIBE_EFFORT`, `DESCRIBE_DAILY_LIMIT` | optional | Model id, reasoning effort (`none` for models without it), AI builds per day |
| `ALLOW_DEV_PHONE` | local only | `1` accepts `dev:` tokens; ignored on production |

Firebase console, once: enable Phone sign-in; add the live and preview domains (and the shops' custom
domains) to Authorized domains; set the SMS region policy to allow only the US, so the code can't be
used to send paid texts abroad. Then apply the migration to production (by hand, as the others).

## How to test

- `npm test` (`server/__tests__/describe.test.ts`, `leadsPhone.test.ts`; Firebase, OpenAI and the database
  stubbed), `npm run build`, `npm run lint`.
- Locally without Firebase: `ALLOW_DEV_PHONE=1` and `OPENAI_API_KEY` in `.env.local`, `npm run dev`, then
  `POST /api/describe {"tenant":"vvslab","words":"14k white gold 6 on 6 with rubies","phoneToken":"dev:4045550199"}`.
  Without a database the free builds are counted per server process.

## Left

- Not run against the real OpenAI or Firebase from here (no keys in this environment). First thing to try
  once keys are set: the curl above on a preview, and one real code to a phone.
- The Sent screen's Instagram and "Email me a copy" come after the lead is sent; there's no endpoint yet to
  add them to an existing lead (it would take the lead token).
- The after track should send `phoneToken` (from `confirmPhoneCode` or `freshPhoneToken()`) with the lead,
  and on `401 unverified` call `forgetPhone()` and ask for a code again.

**Next**: the lead merges this; then set the Firebase and `PHONE_HASH_SECRET` env vars on a preview, apply
the migration there, and try one real code and one real Describe it.
