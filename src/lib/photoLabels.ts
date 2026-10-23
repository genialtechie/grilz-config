// The tooth label map the photo stage renders next to its still (MAG-76):
// each covered tooth in its own flat colour, everything else black. The
// browser draws it (photoStage.ts); the server reads it (server/photoCheck.ts).

/** Tooth i is drawn as rgb(i*7+20, 255-i*7, 128). */
export const labelColor = (index: number) => [index * 7 + 20, 255 - index * 7, 128] as const;

/** The tooth a label-map pixel belongs to, or null. */
export const labelOf = (r: number, g: number, b: number): number | null => {
  if (Math.abs(b - 128) > 6) return null;
  const index = Math.round((r - 20) / 7);
  return index >= 0 && index < 32 && Math.abs(255 - index * 7 - g) <= 8 ? index : null;
};
