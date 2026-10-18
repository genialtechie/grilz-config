# Mascot and illustration

## Illustration and the mascot

- One house style per brand, written down: shapes, outline weight, palette,
  ornaments. (VVS Lab: flat shapes, warm gold gradients, 5px ink outlines,
  4-point sparkles, a cream sticker edge on dark backgrounds.)
- **Draw in SVG, ship PNG.** Gmail, Outlook and Yahoo don't display SVG.
  Draw with code (exact, consistent, regenerable) and render 2× PNGs with
  `sharp`. Keep each under ~100 KB; set `alt=""` on decorative art.
- One illustration per email, about the email's one idea.
- A **mascot** beats one-off illustrations: one character, many expressions,
  recognisable at a glance (Duolingo's Duo, Mailchimp's Freddie). Build it the
  way character designers do, one approved round at a time:
  1. **Brief before drawing.** Its jobs (welcome, celebrate wins, nudge,
     soften bad news, empty states), the audience, three traits **plus one
     contradiction** (VVS: flashy outside, meticulous craftsman inside), a
     goal and a fear (the fear feeds win-back: "losing my shine").
  2. **Silhouettes only.** 8–12 solid-black shapes from primitives; circles
     read friendly, squares sturdy, triangles edgy. Show each large **and at
     40px**: most fail the shrink test. Pick on shape alone.
  3. **Brand fit decides between survivors.** Look at the brand's own
     imagery and voice (VVS: the hero is a gold grill with fangs; the voice
     is confident with an edge), not at what's cute.
  4. **The face.** 4–6 faces on the chosen body, at 64px too. The product's
     signature details go in the face and must be drawn as the real thing:
     separate teeth with tips, long tapered fangs, pavé stones. A strip with
     triangles doesn't read as teeth. Keep features in contrast (gold teeth
     against a dark mouth) and small (a big open mouth reads "monster").
  5. **Resting face + expressions** from one set of parts: resting (avatar,
     footer), win, nudge, working, sad/win-back, sign-off. Then the signature
     accessory (VVS: an eyebrow piercing with iced-out stones).
  6. **Turnaround** (front, ¾, side on shared guides), exports (transparent
     2× PNG per expression with a light sticker edge so it survives dark
     mode, app icons), then put it in the emails: sign-off in every footer,
     the win face on win emails, the welcome face on the welcome.
  7. **Name it** with a word from the trade that sounds like a name (Karat:
     gold karats, diamond carats).
  The VVS Lab record of every round is in `docs/brand/mascot/`; the model is
  `scripts/mascot-model.ts`.

## How the rounds went on VVS Lab (Karat)

- Round 1: brief + 12 silhouettes. The shrink test killed most; only the
  classic tooth read instantly at 40px.
- The user picked Classic, Fang and Smile. Brand fit (the product's hero is
  a gold grill with fangs; the voice is "Your DMs are losing custom orders")
  pointed to the fang, but fang shapes read as shields at 40px.
- Round 2: six fang variants; the "root fang" (a classic tooth whose longer
  root is the fang, roots as legs) was the only one that still read as a
  tooth. The fang moved into the face.
- Round 3: faces. First attempt failed ("those don't look like teeth"): a
  gold strip with triangles. Rebuilt from real shapes (separate caps, long
  tapered fangs, a pavé iced-out tooth). Then "hide the bottom teeth, let the
  fangs go over the lip" made the mouth small and the fangs the feature.
- Round 4: resting face Cool (fits the voice), Hype for wins, plus Nudge,
  Working, Tarnished (win-back) and Wink. Final touch from the user: the
  signature diamond became an eyebrow piercing with iced-out stones.
- Name: Karat (gold karats, diamond carats; a jeweler's word that sounds
  like a name).

## Building it in code

Draw the mascot as SVG from one set of parts (body path, eyes by type, mouth
builder, accessory) so every expression stays on-model, and export with
`sharp`: transparent 2× PNGs with a light sticker edge (an SVG
`feMorphology` dilate behind the art) so they survive dark mode, plus app
icons on the brand's dark colour. `assets/kit/mascot-model.ts` is the VVS
Lab model to adapt.
