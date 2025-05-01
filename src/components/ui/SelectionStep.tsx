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
          className={`w-36 h-16 rounded-lg flex items-center justify-center text-base font-semibold shadow-md transition-all duration-150 border focus:outline-none focus:ring-2 focus:ring-offset-2 ${
            allSelected // Clear Selection -> Secondary Active (White BG, Black Text)
              ? 'bg-white text-black border-gray-400 hover:bg-gray-100 focus:ring-gray-500'
              : 'bg-black text-white border-black hover:bg-gray-800 focus:ring-gray-500' // Select All -> Primary Active (Black BG, White Text)
          }`}
          onClick={allSelected ? clearAllTeeth : selectAllTeeth}
        >
          <span className="text-center leading-tight">{allSelected ? 'Clear Selection' : 'Select All'}</span> 
        </button>

        {/* Clear Style Button */}
        <button
          className={`w-36 h-16 rounded-lg flex items-center justify-center text-base font-semibold shadow-md transition-all duration-150 border focus:outline-none focus:ring-2 focus:ring-offset-2 ${
            !noneSelected // Secondary Active (White BG, Black Text)
              ? 'bg-white text-black border-gray-400 hover:bg-gray-100 focus:ring-gray-500'
              : 'bg-gray-100 text-gray-400 border-gray-300 cursor-not-allowed opacity-70' // Disabled
          }`}
          onClick={resetCustomizationForSelection}
          disabled={noneSelected}
        >
          <span className="text-center leading-tight">Clear Style</span> 
        </button>

        {/* Continue Button */}
        <button
          className={`w-36 h-16 rounded-lg flex items-center justify-center text-base font-semibold shadow-md transition-all duration-150 border focus:outline-none focus:ring-2 focus:ring-offset-2 ${
            !noneSelected // Primary Active (Black BG, White Text)
              ? 'bg-black text-white border-black hover:bg-gray-800 focus:ring-gray-500'
              : 'bg-gray-100 text-gray-400 border-gray-300 cursor-not-allowed opacity-70' // Disabled
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
