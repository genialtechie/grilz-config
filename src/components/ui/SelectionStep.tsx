import React from 'react';
import { SelectionStepProps } from '../../lib/types';

const SelectionStep: React.FC<SelectionStepProps> = ({
  selectedTeeth,
  selectAllTeeth,
  goToStep,
}) => {
  return (
    <div className="flex flex-col items-center justify-center gap-8 w-full">

      <div className="flex gap-6 w-full justify-center">
        <button
          className={`w-32 h-20 rounded-xl flex flex-col items-center justify-center text-base font-semibold shadow transition-all duration-150 border-2 focus:outline-none focus:ring-2 focus:ring-blue-400 ${
            selectedTeeth.length === 14
              ? 'bg-blue-500 text-white border-blue-500'
              : 'bg-gray-50 text-gray-900 border-gray-200 hover:bg-gray-100'
          }`}
          onClick={selectAllTeeth}
        >
          <span className="text-2xl mb-1">👄</span>
          <span className="text-base">All Teeth</span>
        </button>
        <button
          className={`w-32 h-20 rounded-xl flex flex-col items-center justify-center text-base font-semibold shadow transition-all duration-150 border-2 focus:outline-none focus:ring-2 focus:ring-blue-400 ${
            selectedTeeth.length > 0 && selectedTeeth.length < 14
              ? 'bg-blue-500 text-white border-blue-500'
              : 'bg-gray-50 text-gray-400 border-gray-200 cursor-not-allowed opacity-60'
          }`}
          onClick={() => selectedTeeth.length > 0 && goToStep(2)}
          disabled={selectedTeeth.length === 0}
        >
          <span className="text-2xl mb-1">🦷</span>
          <span className="text-base">Selected ({selectedTeeth.length})</span>
        </button>
      </div>
    </div>
  );
};

export default SelectionStep;
