import React from 'react';
import { SelectionStepProps } from '../../lib/types';

const SelectionStep: React.FC<SelectionStepProps> = ({
  selectedTeeth,
  selectAllTeeth,
  goToStep,
}) => {
  return (
    <div className="h-full flex flex-col justify-center items-center gap-2 md:gap-4 p-2 md:p-4">
      <h3 className="text-base sm:text-lg font-semibold text-center">
        Select teeth to customize
      </h3>
      <div className="flex justify-center gap-2 md:gap-4">
        <button
          className={`px-3 py-2 md:px-6 md:py-4 rounded-lg flex flex-col items-center ${
            selectedTeeth.length === 14
              ? 'bg-blue-500 text-white'
              : 'bg-gray-100 hover:bg-gray-200'
          }`}
          onClick={selectAllTeeth}
        >
          <span className="text-base md:text-xl mb-1">👄</span>
          <span className="text-sm md:text-base">All Teeth</span>
        </button>
        <button
          className={`px-3 py-2 md:px-6 md:py-4 rounded-lg flex flex-col items-center ${
            selectedTeeth.length > 0 && selectedTeeth.length < 14
              ? 'bg-blue-500 text-white'
              : 'bg-gray-100 hover:bg-gray-200'
          }`}
          onClick={() => selectedTeeth.length > 0 && goToStep(2)}
          disabled={selectedTeeth.length === 0}
        >
          <span className="text-base md:text-xl mb-1">🦷</span>
          <span className="text-sm md:text-base">
            Selected ({selectedTeeth.length})
          </span>
        </button>
      </div>
    </div>
  );
};

export default SelectionStep;
