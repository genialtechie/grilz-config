export type Material = 'gold' | 'silver';
export type ToothCustomization = {
  material: Material;
  color: string;
  variant?: string;
  hasDiamonds?: boolean;
};

export interface MaterialSelectorProps {
  selectedMaterial: Material;
  onChange: (material: Material, variant?: string) => void;
}

export interface ColorPickerProps {
  selectedMaterial: Material;
  selectedColor: string;
  onChange: (color: string) => void;
}

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

export interface SelectionStepProps {
  selectedTeeth: number[];
  selectAllTeeth: () => void;
  goToStep: (step: number) => void;
}

export interface MaterialStepProps {
  selectedMaterial: Material;
  onChange: (material: Material) => void;
  updateSelectedTeethCustomization: (
    customization: Partial<ToothCustomization>
  ) => void;
  goToStep: (step: number) => void;
}

export interface ColorStepProps {
  selectedMaterial: Material;
  selectedColor: string;
  onChange: (color: string) => void;
  goToStep: (step: number) => void;
}

export interface StepWizardInstance {
  activeStep: number;
  currentStepIndex: number;
  firstStep: () => void;
  lastStep: () => void;
  nextStep: () => void;
  previousStep: () => void;
  goToStep: (step: number) => void;
  totalSteps: number;
}

export interface StepperNavProps {
  instance: StepWizardInstance | null;
  selectedTeeth: number[];
}

export interface CustomizationStepperProps {
  selectedTeeth: number[];
  selectAllTeeth: () => void;
  setIsSelectionMode: (mode: boolean) => void;
  customizations: ToothCustomization[];
  updateSelectedTeethCustomization: (
    customization: Partial<ToothCustomization>
  ) => void;
}

export interface DiamondStepProps {
  hasDiamonds: boolean;
  onChange: (hasDiamonds: boolean) => void;
  goToStep: (step: number) => void;
}
