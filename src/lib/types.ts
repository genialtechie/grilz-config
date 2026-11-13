import type { CutId, Inscription, MetalId, OpalId, SettingId, StyleId } from './renderSpec';
export type Material = 'gold' | 'silver' | 'default';
export type DiamondType = 'moissanite' | 'lab';
export type CutStyle = 'deep' | 'permanent';

export type ToothCustomization = {
  material: Material;
  color: string;
  /** Which alloy, for the 3D view's physically based colour (falls back to `material`). */
  metal?: MetalId;
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

export interface SceneProps {
  customizations: ToothCustomization[];
  selectedTeeth: number[];
  isSelectionMode: boolean;
  toggleToothSelection: (index: number) => void;
  /** How selected teeth show: filled in the accent (choosing the set), or their design with an outline (styling single teeth). */
  selectionLook?: 'fill' | 'outline' | 'none';
  /** Letters drawn on the set. */
  inscriptions?: Inscription[];
  /** The customer's picture for photo teeth (a data URL); a stand-in mark shows without one. */
  photoImage?: string | null;
  /** A still of the opening design, shown until the model is drawn (src/lib/poster.ts). */
  poster?: string | null;
  /** The covered teeth: once the model is drawn the camera frames them rather than the whole model. Absent: it stays on the whole model (the /lab page and its stills). */
  frameTeeth?: number[];
  closeUp?: CloseUp | null;
  view?: ViewRequest | null;
  /** The customer dragged or pinched the model. */
  onUserControl?: () => void;
}

export type GrillzModelProps = SceneProps;
