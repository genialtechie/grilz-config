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
| Charms + initials (Nov 18) | charms and letters across the option model, prices, 3D, Extras, Describe it | `charms.md` |

Hand-off points: `src/components/creator/contract.ts` (builder → after), `src/lib/phoneAuth.ts` and
`src/lib/describe.ts` (stand-ins now; the backend track fills them in without changing their signatures).

## Picking this up on another account

1. `git checkout redesign`, read `CLAUDE.md`, `docs/redesign/HANDOFF.md`, then this file and each track's file.
2. Each track file ends with **Next**: the very next step. Start there.
3. `npm ci`, then `npm run build`, `npm run lint`, `npm test` must pass before pushing.

## Log (newest first)

- Nov 18: Charms + initials: the lab's ten charms (two redrawn to stay original) and the One-of-one build in the app, quoted by the shop unless it sets a price; shops turn charms on in the Shop editor; Describe it places them; letters back across several teeth with Block/Script and enamel in the Extras row. Build, lint, tests pass. Screens `case-study/2026-11-18-build-*`. See `charms.md`.
- Nov 18 (lead): new title, share text and link preview (`public/assets/vvs/og-vvslab.jpg`, sources in `docs/brand/og/`); shop pages now also replace the twitter description and drop VVS Lab's image description. `npm test` skips `.claude/` (local agent copies). Charms + initials track started (`charms.md`).
- Nov 17 (lead): builder merged — all four tracks are in `redesign`. `/configurator`, `/b/:slug` and shops' own domains open the new `CreatorApp` (old `Configurator.tsx` kept, unused, for rollback). Build, lint and 1,826 tests pass. Owner questions collected in `builder.md` and `after.md`.
- Nov 17: Builder: `/configurator` and shop builders now open the Grill Creator Lab (`src/components/creator/`): start page, build strip, Select teeth with the amber glow, quick question + Undo, Describe it, drag handles, the real AfterFlow in the panel. `Configurator.tsx` kept, unused. Build, lint, tests pass. See `builder.md`.
- Nov 17 (lead): landing, after-Done and backend merged into `redesign` and pushed; build, lint and 1,756 tests pass. After-Done now accepts the backend's `unverified` error (forgets the phone, asks for a new code) and refreshes a remembered phone's proof before sending. Builder still in progress. Owner to-dos: Firebase keys + `PHONE_HASH_SECRET` (names in `backend.md`), apply migration `20261117000001` to production when going live, new title/share text for `index.html`.
- Nov 17: Landing: `/` rebuilt as the signed-off front door (live 3D hero cycling five builds with real demo prices, words strip, send, price, questions, closing card); Geist added; screenshots in `case-study/2026-11-17-build-landing-*`. See `landing.md`.
- Nov 17: After Done built: `AfterFlow` (Your grill, the code, Sent) with tests and a dev page at `/lab/after`; `phoneToken` and `addToLead()` added to `src/lib/leads.ts`; backend asks and builder hooks in `after.md`. Lint now skips the Creator Lab's script fragments.
- Nov 17: backend: Firebase phone codes (browser + server), leads take a verified phone, `POST /api/describe`
  (3 free AI builds per phone, the shop's catalogue only), migration `20261117000001`. See `backend.md`.
- Nov 17: tracks set up; contract and stand-ins committed.
