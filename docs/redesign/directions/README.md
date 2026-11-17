# Three looks for the redesign (Nov 17)

The owner asked to see the landing page and the grill flow in three looks before
picking one: Showroom at night (dark), today's light look made sharper, and a
streetwear drop. Each is a layer of CSS over the real Creator Lab, with the 3D
room recoloured, so the screens are the real ones.

```bash
python3 make.py
```

```bash
PW_CHROMIUM=/opt/pw-browsers/chromium node shoot.cjs night phone
```

`make.py` writes `night.html`, `sharp.html`, `drop.html` (not committed);
`shoot.cjs` saves five screens per look to `shots/` (home, price, start, builder,
your grill). The comparison sheets go to `../case-study/`.
