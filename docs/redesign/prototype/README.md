# VVS Lab redesign prototype (round 3)

A single-page sketch for agreeing the direction, not production code.

- Live: https://claude.ai/artifact/AuT9uiP5MtFsVjeVweLmLk (private; share from its Share menu)
- Plan, decisions and change log: https://claude.ai/artifact/VdVY5BdtTBEXdTvdErb6xD

Files:

- `vvs-blank-canvas.html`: the published page as a fragment (styles, markup and the engine inlined).
  To open it locally, wrap it in an HTML document and serve the folder; it loads three.js r147 from jsDelivr.
- `engine.js`: the 3D engine on its own, for reading. Everything is generated in code:
  tooth shapes (`S`, `toothGeo`), the arch (`archPath`), the clear holder (`ridge`),
  set stones and bezels (`buildStones`), one-of-one charms (`charmParts`, `buildCharm`),
  and the lighting rooms (`sceneEnv`, `metalEnv`, `sparkleEnv`).

Tooth proportions and the arch shape were measured from `public/assets/teeth_final.glb`;
no geometry is loaded from it.
