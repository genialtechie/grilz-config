import React from 'react';
import { SelectionStepProps } from '../../lib/types';

const TOTAL_TEETH = 32; // Define total teeth constant

const SelectionStep: React.FC<SelectionStepProps> = ({
  selectedTeeth,
  selectAllTeeth,
  clearAllTeeth, // Receive clear function
  goToStep,
  resetCustomizationForSelection,
}) => {
  const allSelected = selectedTeeth.length === TOTAL_TEETH;
  const noneSelected = selectedTeeth.length === 0;

  return (
    <div className="flex flex-col items-center justify-center gap-4 w-full">

      <div className="flex gap-6 w-full justify-center">
        {/* All Teeth / Clear Selection Button */}
        <button
          className={`flex items-center justify-center px-6 py-3 rounded-lg font-semibold transition-all duration-150 border-2 shadow focus:outline-none focus:ring-2 focus:ring-black ${
            allSelected
              ? 'bg-white text-black border-black hover:bg-gray-100 focus:ring-black'
              : 'bg-black text-white border-black hover:bg-gray-800 focus:ring-black'
          }`}
          onClick={allSelected ? clearAllTeeth : selectAllTeeth}
        >
          <span className="text-center leading-tight">{allSelected ? 'Clear Selection' : 'Select All'}</span>
        </button>

        {/* Clear Style Button */}
        <button
          className={`flex items-center justify-center px-6 py-3 rounded-lg font-semibold transition-all duration-150 border-2 shadow focus:outline-none focus:ring-2 focus:ring-black ${
            !noneSelected
              ? 'bg-white text-black border-black hover:bg-gray-100 focus:ring-black'
              : 'bg-gray-100 text-gray-400 border-gray-300 cursor-not-allowed opacity-70'
          }`}
          onClick={resetCustomizationForSelection}
          disabled={noneSelected}
        >
          <span className="text-center leading-tight">Clear Style</span>
        </button>

        {/* Continue Button */}
        <button
          className={`flex items-center justify-center px-6 py-3 rounded-lg font-semibold transition-all duration-150 border-2 shadow focus:outline-none focus:ring-2 focus:ring-black ${
            !noneSelected
              ? 'bg-black text-white border-black hover:bg-gray-800 focus:ring-black'
              : 'bg-gray-100 text-gray-400 border-gray-300 cursor-not-allowed opacity-70'
          }`}
          onClick={() => !noneSelected && goToStep(2)}
          disabled={noneSelected}
        >
          <span className="text-center leading-tight">Continue ({selectedTeeth.length})</span>
        </button>
      </div>
    </div>
  );
};

export default SelectionStep;
