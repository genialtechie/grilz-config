import type { MetalId, StyleId } from './renderSpec';
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
  /** This tooth is a fang cap (an upper canine with fangs on). */
  fang?: boolean;
  variant?: string;
  hasDiamonds: boolean;
  diamondType?: DiamondType;
};

export interface SceneProps {
  customizations: ToothCustomization[];
  selectedTeeth: number[];
  isSelectionMode: boolean;
  toggleToothSelection: (index: number) => void;
}

export type GrillzModelProps = SceneProps;
