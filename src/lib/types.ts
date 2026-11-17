import type { CutId, Inscription, KaratId, MetalId, OpalId, SettingId, StyleId } from './renderSpec';
export type Material = 'gold' | 'silver' | 'default';
export type DiamondType = 'moissanite' | 'lab';
export type CutStyle = 'deep' | 'permanent';

export type ToothCustomization = {
  material: Material;
  color: string;
  /** Which alloy, for the 3D view's physically based colour (falls back to `material`). */
  metal?: MetalId;
  /** The gold's karat: the 3D view shows deeper yellow at higher karats (10K when absent; ignored for silver and platinum). */
  karat?: KaratId;
  /** The finish cut into the front of a plain cap (open face, diamond cut…); solid when absent. */
  style?: StyleId;
  /** The opal's colour, for the opals style. */
  opal?: OpalId;
  /** A photo grillz tooth: the customer's picture goes on its face. */
  photo?: boolean;
  /** This tooth is a fang cap (an upper canine with fangs on). */
  fang?: boolean;
  /** Deep cut (separate teeth, the default) or permanent look (fuller caps that meet). */
  cut?: CutId;
  variant?: string;
  hasDiamonds: boolean;
  diamondType?: DiamondType;
  /** How an iced tooth's stones are set (honeycomb when absent). */
  setting?: SettingId;
};

/** Teeth the camera glides in on, filling `fill` of the canvas; `turn` also turns to face them (MAG-148). */
export type CloseUp = { teeth: number[]; fill: number; turn?: boolean };
/** A fixed view the customer asked for; a new object each time, so asking twice glides twice. */
export type ViewRequest = { side: 'front' | 'left' | 'right' };
/**
 * The free part of the canvas, in CSS pixels from its top-left corner: the piece is framed to fill it
 * (the creator's panel covers the rest). Without one the viewer frames between its own overlays.
 */
export type Frame = { top: number; bottom: number; left: number; right: number };

export interface SceneProps {
  customizations: ToothCustomization[];
  selectedTeeth: number[];
  isSelectionMode: boolean;
  toggleToothSelection: (index: number) => void;
  /**
   * How selected teeth show: filled in the accent (choosing the set), their design with an outline
   * (styling single teeth), or their design with an amber glow drawn above the holder, lifted a little
   * out of the arch (the creator's picked teeth).
   */
  selectionLook?: 'fill' | 'outline' | 'none' | 'glow';
  /** Letters drawn on the set. */
  inscriptions?: Inscription[];
  /** The customer's picture for photo teeth (a data URL); a stand-in mark shows without one. */
  photoImage?: string | null;
  /** A still of the opening design, shown until the model is drawn (src/lib/poster.ts). */
  poster?: string | null;
  closeUp?: CloseUp | null;
  view?: ViewRequest | null;
  /** The customer dragged or pinched the model. */
  onUserControl?: () => void;
  /** Frame the piece in this part of the canvas (see Frame). */
  frame?: Frame | null;
  /** A tap that lands on no tooth. */
  onMissTap?: () => void;
  /** Open the mouth (the lower half swings down a little). */
  jawOpen?: boolean;
}

export type GrillzModelProps = SceneProps;
