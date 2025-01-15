import React from 'react';
import { SelectionStepProps } from '../../lib/types';

const SelectionStep: React.FC<SelectionStepProps> = ({
  selectedTeeth,
  selectAllTeeth,
  goToStep,
}) => {
  return (
    <div className="flex flex-col items-center space-y-4">
      <p className="text-lg">Select teeth to customize by clicking on them</p>
      <div className="flex space-x-4">
        <button
          className="px-4 py-2 bg-blue-500 text-white rounded"
          onClick={selectAllTeeth}
        >
          Select All Teeth
        </button>
        <button
          className="px-4 py-2 bg-green-500 text-white rounded"
          onClick={() => goToStep(2)}
          disabled={selectedTeeth.length === 0}
        >
          Continue with Selected ({selectedTeeth.length})
        </button>
      </div>
    </div>
  );
};

export default SelectionStep;
