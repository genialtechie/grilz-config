# VVS Lab redesign: end-to-end prototype

A single-page prototype of the whole redesign, for testing the direction. It is not wired
to the real back end: sending a request, the studio photo, the deposit and sign-up are simulated.

The live copy and the plan (decisions, change log) are private Claude artifacts; ask the owner for the links.

## What it covers

- Front door for jewelers: the live piece cycling through looks, a short scroll (what you get,
  price, FAQs) and a three-field sign-up that carries the shop's name into the builder.
- Builder for customers, five steps: Teeth, Metal, Finish, Details, Send.
  Every option of the live demo shop (`src/lib/tenant/vvslab.ts`) with the same prices and
  price rules (`src/lib/pricing.ts`): metals and karats, plain / iced / photo, six styles,
  opal colours, three settings, three stones, iced open face, fangs, deep cut or permanent look,
  initials, an inspiration photo and a written idea, fit, promo code, deposit.
- New: one-of-one charms (quoted by the shop), per-tooth editing by tapping a tooth,
  a clear holder with a solidity dial, live-rendered option pictures.

## Files

- `vvs-blank-canvas.html`: the built page, as published (a fragment: styles, markup, script).
- `src/page.html`: styles and markup.
- `src/10-core.js`: catalogue, prices, state, price rules, summary text, saving.
- `src/20-three.js`: renderer, lighting rooms, materials and finish shaders.
- `src/25-teeth.js`: the sixteen tooth shapes and where each sits (generated; see below).
- `src/30-sculpt.js`: smoothing the tooth shapes, caps, panels, rims, stone layouts, charms.
- `src/40-scene.js`: placing the teeth, the holder and its gum line, dressing a tooth, sparkle, option pictures, camera, touch.
- `src/50-ui.js`: the controls, review and send, sign-up, the front door.
- `src/build.py`: joins the parts into the page. Run it inside `src/`.

## The teeth

The tooth shapes and their spacing come from the hosted model, `public/assets/teeth_final.glb`.
Nothing is loaded from that file at run time: `src/teeth/` reads it once and writes `src/25-teeth.js`.

- The hosted arches are stored tilted open and turned a few degrees; the scripts stand them
  upright and use the right-hand teeth, mirrored for the left.
- Each crown is kept as its coarse cage (about 200 points) and smoothed in the page
  (two rounds of Catmull-Clark), so the surface is soft where the hosted one is faceted.
- Neighbours are seated so they touch without overlapping (the hosted ones overlap by up to 1 mm).
- The bite is closed with the lower row just inside the upper: about 1.6 mm of overbite,
  1 mm clear at the front and 0.6 mm at the back, so caps and stones never meet.
- Caps, rims, stones, panels, masks and charms are all laid out on a height map of each
  tooth's face, so they follow whatever shape the tooth has. A fang is the canine drawn out to a point.

To regenerate: `cd src/teeth && python3 seat.py && python3 bite.py` (needs numpy), then `cd .. && python3 build.py`.

## Taking it into the real app

The prototype shares the live app's data model on purpose (a design per tooth plus set options),
so the path is: port the geometry and materials into `src/components/three/`, drive them from
`RenderSpec`, replace `Configurator.tsx`'s panel with the bench, and keep `server/` as is.
The AI photo pipeline reads the 3D preview and per-tooth masks, so it needs re-tuning for the new model.
