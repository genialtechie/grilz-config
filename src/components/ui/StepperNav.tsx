import React from 'react';
import { StepperNavProps } from '../../lib/types';

const StepperNav: React.FC<StepperNavProps> = ({ instance }) => {
  if (!instance) return null;

  const { activeStep, goToStep } = instance;

  // Define step titles
  const stepTitles = ['Select Teeth', 'Choose Material', 'Select Variant'];

  return (
    <div className="flex justify-center space-x-4 mb-4">
      {stepTitles.map((title, index) => (
        <button
          key={index}
          onClick={() => goToStep(index + 1)}
          className={`px-4 py-2 rounded ${
            activeStep === index + 1 ? 'bg-blue-500 text-white' : 'bg-gray-200'
          }`}
        >
          {title}
        </button>
      ))}
    </div>
  );
};

export default StepperNav;
