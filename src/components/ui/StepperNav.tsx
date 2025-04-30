import React from 'react';
import 'tippy.js/dist/tippy.css';
import 'tippy.js/themes/light.css';
import { StepperNavProps } from '../../lib/types';

const StepperNav: React.FC<StepperNavProps> = ({ instance, selectedTeeth }) => {
  if (!instance) return null;

  const { goToStep } = instance;
  const currentStepIndex = (instance as any).state?.activeStep; //eslint-disable-line
  const hasTeethSelected = selectedTeeth.length > 0;

  console.log('Current instance:', instance);
  console.log('Current step:', currentStepIndex);

  const stepTitles = [
    'Select Teeth',
    'Material & Color',
    'Add Diamonds',
  ];

  const totalSteps = stepTitles.length;
  const currentStep = Math.max(0, Math.min(currentStepIndex, totalSteps - 1));
  const canGoBack = currentStep > 0;
  const canGoForward = currentStep < totalSteps - 1 && (currentStep !== 0 || hasTeethSelected);

  return (
    <div className="flex items-center justify-center gap-4 mb-2 w-full">
      <button
        onClick={() => canGoBack && goToStep(currentStep)}
        disabled={!canGoBack}
        className={`text-3xl px-4 py-2 rounded-full transition-all duration-150 focus:outline-none focus:ring-2 focus:ring-blue-400
          ${canGoBack ? 'text-gray-700 hover:bg-gray-100' : 'text-gray-300 cursor-not-allowed'}`}
        aria-label="Previous step"
      >
        &#8592;
      </button>
      <div className="flex flex-col items-center">
        <span className="text-base md:text-lg font-semibold text-gray-900 whitespace-nowrap">
          {stepTitles[currentStep]}
        </span>
        <span className="text-gray-400 text-sm mt-1">
          {currentStep + 1} / {totalSteps}
        </span>
      </div>
      <button
        onClick={() => canGoForward && goToStep(currentStep + 1)}
        disabled={!canGoForward}
        className={`text-3xl px-4 py-2 rounded-full transition-all duration-150 focus:outline-none focus:ring-2 focus:ring-blue-400
          ${canGoForward ? 'text-gray-700 hover:bg-gray-100' : 'text-gray-300 cursor-not-allowed'}`}
        aria-label="Next step"
      >
        &#8594;
      </button>
    </div>
  );
};

export default StepperNav;
