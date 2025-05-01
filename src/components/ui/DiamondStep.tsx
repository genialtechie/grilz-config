import React from 'react';
import { DiamondStepProps } from '../../lib/types';

const DiamondStep: React.FC<DiamondStepProps> = ({
  hasDiamonds,
  onChange,
}) => {
  const toggleDiamonds = () => {
    onChange(!hasDiamonds);
  };

  return (
    <div className="flex flex-col items-center justify-center gap-6 w-full">
      {/* Add/Remove Diamonds Button - Styled like SelectionStep */}
      <button
        className={`w-36 h-16 rounded-lg flex items-center justify-center text-base font-semibold shadow-md transition-all duration-150 border focus:outline-none focus:ring-2 focus:ring-offset-2 ${
          hasDiamonds // Remove Diamonds -> Secondary Active (White BG, Black Text)
            ? 'bg-white text-black border-gray-400 hover:bg-gray-100 focus:ring-gray-500'
            : 'bg-black text-white border-black hover:bg-gray-800 focus:ring-gray-500' // Add Diamonds -> Primary Active (Black BG, White Text)
        }`}
        onClick={toggleDiamonds}
      >
        <span className="text-center leading-tight">
          {hasDiamonds ? 'Remove Diamonds' : 'Add Diamonds'}
        </span>
      </button>
      {/* Removed Back button and its container div */}
    </div>
  );
};

export default DiamondStep;
