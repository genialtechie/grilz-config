export interface MaterialSelectorProps {
  selectedMaterial: string;
  onChange: (material: string) => void;
}

export interface ColorPickerProps {
  selectedColor: string;
  onChange: (color: string) => void;
}

export type Material = 'gold' | 'silver' | 'diamond';
export type ToothCustomization = {
  material: Material;
  color: string;
};

export interface SceneProps {
  customizations: ToothCustomization[];
  selectedTeeth: number[];
  isSelectionMode: boolean;
  toggleToothSelection: (index: number) => void;
}

export interface GrillzModelProps {
  customizations: ToothCustomization[];
  selectedTeeth: number[];
  isSelectionMode: boolean;
  toggleToothSelection: (index: number) => void;
}
