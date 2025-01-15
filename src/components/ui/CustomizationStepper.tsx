import React from 'react';
import StepWizard from 'react-step-wizard';
import {
  Material,
  StepWizardInstance,
  CustomizationStepperProps,
} from '../../lib/types';
import SelectionStep from './SelectionStep';
import MaterialStep from './MaterialStep';
import ColorStep from './ColorStep';
import StepperNav from './StepperNav';
import { materialConfigs } from '../../lib/constants';

const CustomizationStepper: React.FC<CustomizationStepperProps> = ({
  selectedTeeth,
  selectAllTeeth,
  customizations,
  updateSelectedTeethCustomization,
  setIsSelectionMode,
}) => {
  const [currentMaterial, setCurrentMaterial] =
    React.useState<Material>('gold');
  const [instance, setInstance] = React.useState<StepWizardInstance | null>(
    null
  );

  const currentColor =
    selectedTeeth.length > 0
      ? customizations[selectedTeeth[0]].color
      : materialConfigs[currentMaterial].defaultColor;

  const safeGoToStep = (step: number) => {
    if (instance?.goToStep) {
      instance.goToStep(step);
      if (step > 1) {
        setIsSelectionMode(false);
      }
    }
  };

  return (
    <div className="w-full max-w-2xl">
      <StepWizard
        onStepChange={(stats) => {
          console.log('Step changed:', stats);
          setIsSelectionMode(stats.activeStep === 1);
        }}
        instance={setInstance}
        nav={<StepperNav instance={instance} />}
      >
        <SelectionStep
          selectedTeeth={selectedTeeth}
          selectAllTeeth={selectAllTeeth}
          goToStep={safeGoToStep}
        />
        <MaterialStep
          selectedMaterial={currentMaterial}
          onChange={setCurrentMaterial}
          updateSelectedTeethCustomization={updateSelectedTeethCustomization}
          goToStep={safeGoToStep}
        />
        <ColorStep
          selectedMaterial={currentMaterial}
          selectedColor={currentColor}
          onChange={(color) => {
            updateSelectedTeethCustomization({ color });
          }}
          goToStep={safeGoToStep}
        />
      </StepWizard>
    </div>
  );
};

export default CustomizationStepper;
