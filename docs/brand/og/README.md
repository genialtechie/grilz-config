# The link preview (Nov 18)

`public/assets/vvs/og-vvslab.jpg` (1200×630) is what shows when someone shares vvslab.magpollo.com. The owner
asked for previews in the new branding to match the new title, "VVS Lab · Design your grillz in 3D", and the
hero's two lines. It's the page background with its grain, the 3D VVS mark with "Lab", the headline and the
two-tone 6 × 6 grill from the landing page's own 3D.

- `grill.cjs` captures the grill from the Creator Lab's landing hero (`node grill.cjs "Two-tone"`).
- `og.html` lays out the image; `shot.cjs` saves it as PNG (then saved as JPEG to `public/assets/vvs/`).
  The font paths in `og.html` point at `node_modules/@fontsource/geist`; adjust them to absolute paths if needed.

Shops' own builder pages still use their own logo as the preview (`server/shopPage.ts`).
