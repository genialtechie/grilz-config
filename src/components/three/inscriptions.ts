import * as THREE from 'three';
import { ENAMELS, type Inscription, type MetalId } from '../../lib/renderSpec';

// Inscriptions drawn on the 3D set (MAG-76): the letters are part of the
// preview, so the AI photo starts from the exact text, font and placement
// instead of inventing them. One texture per inscription is laid across its
// teeth from the front: each tooth gets its own panel on the face of its cap,
// cut from the one picture (redesign/overlays.ts), so a name runs across
// neighbouring teeth as a jeweler lays it out.

export const INSCRIPTION_DECAL = 'inscription_decal';

// Both faces are declared in index.css; the browser only downloads them when asked.
const FONTS = {
  script: { family: 'VVS Script', weight: '400' },
  block: { family: 'Inter Tight', weight: '800' },
} as const;

const loaded = new Map<string, Promise<unknown>>();
/** Loads the letters' font once (the canvas can only draw with a font the document has loaded). */
export function loadInscriptionFont(font: Inscription['font']): Promise<unknown> {
  if (typeof document === 'undefined' || !document.fonts) return Promise.resolve();
  const spec = FONTS[font];
  if (!loaded.has(font)) loaded.set(font, document.fonts.load(`${spec.weight} 64px "${spec.family}"`).catch(() => undefined));
  return loaded.get(font)!;
}

/** Metal colours for raised letters (sRGB). */
const METAL_LETTER: Record<MetalId, string> = { yellow: '#f6d27e', white: '#f1f1ee', rose: '#f3bfa8', silver: '#f4f4f2', platinum: '#e6e6e3' };
const ENGRAVED_LINE = '#2a2621';

/** A darker shade of a #rrggbb colour. */
const shade = (hex: string, factor: number) => {
  const value = Number.parseInt(hex.slice(1), 16);
  const channel = (shift: number) => Math.round(((value >> shift) & 255) * factor);
  return `rgb(${channel(16)},${channel(8)},${channel(0)})`;
};

/** The letters on a canvas the shape of the panel (width:height), drawn in their colours. */
export function drawLetters(inscription: Inscription, metal: MetalId, aspect: number): HTMLCanvasElement {
  // One tooth curves away at its edges, so its letters keep a wider margin.
  const fill = inscription.teeth.length === 1 ? 0.84 : 0.92;
  const height = 256;
  const width = Math.min(4096, Math.round(height * aspect));
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const context = canvas.getContext('2d')!;
  const font = FONTS[inscription.font];
  const cursive = inscription.font !== 'block';
  const text = cursive ? inscription.text : inscription.text.toUpperCase();
  // As large as fits: 92% of the width, and no taller than the decal (script's loops reach past its capitals).
  let size = height * (cursive ? 0.92 : 0.6);
  context.font = `${font.weight} ${size}px "${font.family}", ${cursive ? 'cursive' : 'sans-serif'}`;
  const measured = context.measureText(text).width;
  if (measured > width * fill) size *= (width * fill) / measured;
  context.font = `${font.weight} ${size}px "${font.family}", ${cursive ? 'cursive' : 'sans-serif'}`;
  // A name across several teeth is drawn wider to fill them, as jewelers lay it out (script stretches well; block a little).
  const stretch = Math.min(cursive ? 1.35 : 1.15, Math.max(1, (width * fill) / context.measureText(text).width));
  context.setTransform(stretch, 0, 0, 1, 0, 0);
  context.textAlign = 'center';
  context.textBaseline = 'middle';
  const x = width / 2 / stretch;
  const y = height * (cursive ? 0.54 : 0.52);
  const stroke = Math.max(2, size * 0.06);

  if (inscription.style === 'engraved') {
    // Cut into the metal: a dark engraved line, or the cut filled with enamel and edged dark.
    const enamel = inscription.enamel ? ENAMELS.find((item) => item.id === inscription.enamel)?.swatch : null;
    context.lineJoin = 'round';
    context.strokeStyle = ENGRAVED_LINE;
    context.lineWidth = stroke;
    if (enamel) {
      // A fine cut edge round the enamel: script strokes are thin, so the edge must not swamp the colour.
      context.strokeStyle = shade(enamel, 0.55);
      context.lineWidth = Math.max(1.5, size * (cursive ? 0.03 : 0.014));
      context.strokeText(text, x, y);
      // Script: a second pass in the enamel colour thickens the fine strokes so the colour shows.
      if (cursive) {
        context.strokeStyle = enamel;
        context.lineWidth = Math.max(1, size * 0.016);
        context.strokeText(text, x, y);
      }
      context.fillStyle = enamel;
      context.fillText(text, x, y);
    } else if (cursive) {
      // Pinyon's hairlines are too fine to read on a tooth: the cut is drawn a little wider, keeping its shapes.
      context.strokeStyle = ENGRAVED_LINE;
      context.lineWidth = Math.max(1.5, size * 0.022);
      context.strokeText(text, x, y);
      context.fillStyle = ENGRAVED_LINE;
      context.fillText(text, x, y);
    } else {
      // Block letters engraved as outlines, as hand engravers cut them.
      context.strokeText(text, x, y);
    }
  } else if (inscription.style === 'cut') {
    // Raised, faceted letters: polished metal with a dark edge so they read against the tooth.
    context.lineJoin = 'round';
    context.strokeStyle = ENGRAVED_LINE;
    context.lineWidth = stroke * 1.2;
    context.strokeText(text, x, y);
    context.fillStyle = METAL_LETTER[metal];
    context.fillText(text, x, y);
  } else {
    // Iced letters: paved with tiny stones, edged in metal.
    context.lineJoin = 'round';
    context.strokeStyle = METAL_LETTER[metal];
    context.lineWidth = stroke * 1.4;
    context.strokeText(text, x, y);
    context.fillStyle = '#ffffff';
    context.fillText(text, x, y);
    context.globalCompositeOperation = 'source-atop';
    const dot = Math.max(2, size * 0.05);
    for (let row = 0; row * dot * 1.7 < height; row += 1) {
      for (let column = 0; column * dot * 2 < width / stretch; column += 1) {
        const cx = column * dot * 2 + (row % 2 ? dot : 0);
        const cy = row * dot * 1.7;
        const shade = 150 + ((row * 7 + column * 13) % 5) * 26;
        context.fillStyle = `rgb(${shade},${shade},${Math.min(255, shade + 10)})`;
        context.beginPath();
        context.arc(cx, cy, dot * 0.8, 0, Math.PI * 2);
        context.fill();
      }
    }
    context.globalCompositeOperation = 'source-over';
  }
  context.setTransform(1, 0, 0, 1, 0, 0);
  return canvas;
}

/**
 * The letters' material over their picture. Raised letters are metal (or
 * stones) and mirror the stones' bright room, as the prototype's raised letters
 * do; engraved lines are dark cuts in the metal's light tent; enamel is glossy
 * glass-like paint that keeps its colour under the studio light.
 */
export function letterMaterial(inscription: Inscription, texture: THREE.Texture, rooms: { metal: THREE.Texture; sparkle: THREE.Texture }) {
  const raised = inscription.style !== 'engraved';
  return new THREE.MeshPhysicalMaterial({
    map: texture,
    transparent: true,
    alphaTest: 0.08,
    depthWrite: false,
    metalness: raised ? 0.9 : inscription.enamel ? 0 : 0.4,
    roughness: raised ? 0.12 : inscription.enamel ? 0.4 : 0.5,
    clearcoat: 0,
    emissiveMap: inscription.enamel ? texture : null,
    emissive: inscription.enamel ? new THREE.Color('#ffffff') : new THREE.Color('#000000'),
    emissiveIntensity: inscription.enamel ? 0.45 : 0,
    envMap: raised ? rooms.sparkle : rooms.metal,
    envMapIntensity: inscription.style === 'iced' ? 1.6 : inscription.style === 'cut' ? 1.2 : inscription.enamel ? 0.5 : 0.8,
  });
}

/** The letters' picture for a run `aspect` wide (width over height). */
export function letterTexture(inscription: Inscription, metal: MetalId, aspect: number) {
  const texture = new THREE.CanvasTexture(drawLetters(inscription, metal, aspect));
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.anisotropy = 8;
  return texture;
}

