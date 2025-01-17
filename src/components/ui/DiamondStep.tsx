import React from 'react';
import { DiamondStepProps } from '../../lib/types';

const DiamondStep: React.FC<DiamondStepProps> = ({
  hasDiamonds,
  onChange,
  goToStep, // eslint-disable-line @typescript-eslint/no-unused-vars
}) => {
  return (
    <div className="space-y-4 flex flex-col items-center">
      <h3 className="text-lg font-semibold text-center">
        Would you like to add diamond stones?
      </h3>
      <div className="flex justify-center space-x-4">
        <button
          className={`px-6 py-4 rounded-lg flex flex-col items-center ${
            hasDiamonds
              ? 'bg-blue-500 text-white'
              : 'bg-gray-100 hover:bg-gray-200'
          }`}
          onClick={() => onChange(true)}
        >
          <span className="text-xl mb-2">💎</span>
          <span>With Diamonds</span>
        </button>
        <button
          className={`px-6 py-4 rounded-lg flex flex-col items-center ${
            !hasDiamonds
              ? 'bg-blue-500 text-white'
              : 'bg-gray-100 hover:bg-gray-200'
          }`}
          onClick={() => onChange(false)}
        >
          <span className="text-xl mb-2">✨</span>
          <span>Without Diamonds</span>
        </button>
      </div>
    </div>
  );
};

export default DiamondStep;
