# Building the signed-off lab into the app (from Nov 17)

The owner signed off the landing page and the grill flow in the Grill Creator Lab
(`docs/redesign/creator-lab/creator.html`, sources in `creator-lab/src/`). This folder tracks porting it into
the real app, on the `redesign` branch only. Nothing goes to `main` or the live site until the owner says so.

Owner's calls for the build: all pieces at once, pushed often, written down here so another account can
pick it up; "Describe it" uses real AI on the OpenAI key the server already has.

## Tracks

| Track | Owns | Status file |
|---|---|---|
| Landing | `src/components/landing/*`, fonts | `landing.md` |
| Builder | `src/components/creator/*` except `after/`, routes to it | `builder.md` |
| After Done | `src/components/creator/after/*` | `after.md` |
| Backend | `server/*`, `api/*`, `src/lib/phoneAuth.ts`, `src/lib/describe.ts`, migrations | `backend.md` |

Hand-off points: `src/components/creator/contract.ts` (builder → after), `src/lib/phoneAuth.ts` and
`src/lib/describe.ts` (stand-ins now; the backend track fills them in without changing their signatures).

## Picking this up on another account

1. `git checkout redesign`, read `CLAUDE.md`, `docs/redesign/HANDOFF.md`, then this file and each track's file.
2. Each track file ends with **Next**: the very next step. Start there.
3. `npm ci`, then `npm run build`, `npm run lint`, `npm test` must pass before pushing.

## Log (newest first)

- Nov 17: backend: Firebase phone codes (browser + server), leads take a verified phone, `POST /api/describe`
  (3 free AI builds per phone, the shop's catalogue only), migration `20261117000001`. See `backend.md`.
- Nov 17: tracks set up; contract and stand-ins committed.
