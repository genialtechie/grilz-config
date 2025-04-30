import React from 'react';
import StepWizard from 'react-step-wizard';
import {
  Material,
  StepWizardInstance,
  CustomizationStepperProps,
} from '../../lib/types';
import SelectionStep from './SelectionStep';
import MaterialColorStep from './MaterialColorStep';
import DiamondStep from './DiamondStep';
import StepperNav from './StepperNav';
import { materialConfigs } from '../../lib/constants';

const CustomizationStepper: React.FC<CustomizationStepperProps> = ({
  selectedTeeth,
  selectAllTeeth,
  customizations,
  updateSelectedTeethCustomization,
  setIsSelectionMode,
}) => {
  const [currentMaterial, setCurrentMaterial] = React.useState<Material>('gold');
  const [instance, setInstance] = React.useState<StepWizardInstance | null>(
    null
  );
  const [currentColor, setCurrentColor] = React.useState<string>(
    materialConfigs[currentMaterial].defaultColor
  );

  const hasDiamonds =
    selectedTeeth.length > 0
      ? customizations[selectedTeeth[0]].hasDiamonds || false
      : false;

  const safeGoToStep = (step: number) => {
    if (instance?.goToStep) {
      instance.goToStep(step);
      if (step > 1) {
        setIsSelectionMode(false);
      }
    }
  };

  return (
    <div className="bg-white rounded-t-2xl shadow-2xl p-6 max-w-md w-full flex flex-col gap-4 border border-gray-100">
      <StepWizard
        className="flex flex-col h-full gap-4"
        onStepChange={(stats) => {
          console.log('Step changed:', stats);
          setIsSelectionMode(stats.activeStep === 1);
        }}
        instance={(wizard) => setInstance(wizard as StepWizardInstance | null)}
        nav={
          <StepperNav
            instance={instance}
            selectedTeeth={selectedTeeth}
          />
        }
      >
        <SelectionStep
          selectedTeeth={selectedTeeth}
          selectAllTeeth={selectAllTeeth}
          goToStep={safeGoToStep}
        />
        <MaterialColorStep
          selectedMaterial={currentMaterial}
          selectedColor={currentColor}
          onMaterialChange={setCurrentMaterial}
          onColorChange={setCurrentColor}
          updateSelectedTeethCustomization={updateSelectedTeethCustomization}
          goToStep={safeGoToStep}
        />
        <DiamondStep
          hasDiamonds={hasDiamonds}
          onChange={(hasDiamonds) => {
            updateSelectedTeethCustomization({ hasDiamonds });
          }}
          goToStep={safeGoToStep}
        />
      </StepWizard>
    </div>
  );
};

export default CustomizationStepper;
