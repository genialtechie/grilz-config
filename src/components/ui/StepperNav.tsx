import React from 'react';
import Tippy from '@tippyjs/react';
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
    'Choose Material',
    'Select Variant',
    'Add Diamonds',
  ];

  return (
    <div className="flex justify-center gap-1 md:gap-2 mb-2 md:mb-4">
      {stepTitles.map((title, index) => {
        const isDisabled = index > 0 && !hasTeethSelected;
        const isActive = currentStepIndex === index;

        return (
          <Tippy
            key={index}
            content="Please select teeth first"
            disabled={!isDisabled}
            placement="top"
            theme="light"
            arrow={true}
            animation="scale"
            duration={200}
            className="shadow-lg"
          >
            <button
              onClick={() => !isDisabled && goToStep(index + 1)}
              disabled={isDisabled}
              className={`px-2 py-1 md:px-4 md:py-2 text-xs md:text-base rounded transition-all duration-200
                ${
                  isActive
                    ? 'bg-blue-500 text-white'
                    : isDisabled
                    ? 'bg-gray-200 text-gray-400 cursor-not-allowed opacity-60'
                    : 'bg-gray-200 hover:bg-gray-300'
                }`}
            >
              {title}
            </button>
          </Tippy>
        );
      })}
    </div>
  );
};

export default StepperNav;
