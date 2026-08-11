export type Material = 'gold' | 'silver' | 'default';
export type DiamondType = 'moissanite' | 'lab';
export type CutStyle = 'deep' | 'permanent';

export type ToothCustomization = {
  material: Material;
  color: string;
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
