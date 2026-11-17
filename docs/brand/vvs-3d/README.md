# The VVS mark in 3D

The gold iced "VVS" mark rebuilt with the grillz' own materials from the
Grill Creator Lab: 14K yellow gold and 14K white gold under the jeweler's
light tent, and the same cut stones and setting beads, packed honeycomb-style
into the white-gold panels like an iced grill.

- `trace.py` traces `public/assets/vvs/logo-mark.png` into a height map (rounded
  edges, a soft ridge down each stroke), the white-gold panels and the stone
  layout. It works at 4x so the edges are smooth, and repairs the source on the
  way: the PNG's canvas clips the S on the right and the cut-out left a crack,
  nicks and a hooked tip in it, so the S's outer edge is refitted as one curve
  and the rest faired. The iced band ends on one level line, as in the flat mark. Writes `mark.json` (about 8 MB, so not committed). Argument: stone
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

## Files

- `vvs-3d-stone.png`, `vvs-3d-ink.png`, `vvs-3d-clear.png`: the hero renders
  (2400x1200, turned 0.22).
- `vvs-3d-mark.png`: the mark almost front-on, cropped tight, transparent. The
  small copies in use come from it: `public/assets/email/vvs-mark-3d.png` (66px
  tall, emails at 22px) and `creator-lab/src/assets/vvs-mark-3d.png` (72px tall,
  the top bar at 24px).

## The lockup

The mark, then "Lab" in Geist 600 sitting on the mark's baseline, its capitals
three quarters of the mark's height (Geist caps are 0.71em, so a 24px mark takes
25px type), 5px apart. Picked by the owner on Nov 17 over the old 17px centred
word, equal height, and equal height at 500.
