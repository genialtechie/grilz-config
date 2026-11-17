# The VVS mark in 3D

The gold iced "VVS" mark rebuilt with the grillz' own materials from the
Grill Creator Lab: 14K yellow gold and 14K white gold under the jeweler's
light tent, and the same cut stones and setting beads, packed honeycomb-style
into the white-gold panels like an iced grill.

- `trace.py` traces `public/assets/vvs/logo-mark.png` into a height map (rounded
  edges, a soft ridge down each stroke), the white-gold panels and the stone
  layout. Writes `mark.json` (about 8 MB, so not committed). Argument: stone
  radius in source pixels (8.5).
- `logo.html` builds the mesh with side walls, sets the stones and renders it.
  Query: `bg` (stone, ink, clear), `w`, `h`, `yaw`, `pitch`, `dist`.
- `render.cjs` renders through Playwright and saves PNGs.

```bash
python3 trace.py 8.5
```

```bash
cp ../../redesign/creator-lab/test/three.min.js . && node render.cjs '[{"bg":"clear","w":2400,"h":1200,"yaw":0.22,"pitch":0.12,"dist":7.6,"out":"vvs-3d-clear.png"}]'
```
