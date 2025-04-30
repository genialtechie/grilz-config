import React from 'react';
import { DiamondStepProps } from '../../lib/types';

const DiamondStep: React.FC<DiamondStepProps> = ({
  hasDiamonds,
  onChange,
}) => {
  return (
    <div className="flex flex-col items-center justify-center gap-8 w-full">

      <div className="flex gap-6 w-full justify-center">
        <button
          className={`w-32 h-20 rounded-xl flex flex-col items-center justify-center text-base font-semibold shadow transition-all duration-150 border-2 focus:outline-none focus:ring-2 focus:ring-blue-400 ${
            !hasDiamonds
              ? 'bg-blue-500 text-white border-blue-500 scale-105'
              : 'bg-gray-50 text-gray-900 border-gray-200 hover:bg-gray-100'
          }`}
          onClick={() => {
            onChange(false);
            // goToStep(1); // Removed to stay on this step
          }}
        >
          <span className="text-2xl mb-1">❌</span>
          <span className="text-base">No Diamonds</span>
        </button>
        <button
          className={`w-32 h-20 rounded-xl flex flex-col items-center justify-center text-base font-semibold shadow transition-all duration-150 border-2 focus:outline-none focus:ring-2 focus:ring-blue-400 ${
            hasDiamonds
              ? 'bg-blue-500 text-white border-blue-500 scale-105'
              : 'bg-gray-50 text-gray-900 border-gray-200 hover:bg-gray-100'
          }`}
          onClick={() => {
            onChange(true);
            // goToStep(1); // Removed to stay on this step
          }}
        >
          <span className="text-2xl mb-1">💎</span>
          <span className="text-base">Add Diamonds</span>
        </button>
      </div>
    </div>
  );
};

export default DiamondStep;
